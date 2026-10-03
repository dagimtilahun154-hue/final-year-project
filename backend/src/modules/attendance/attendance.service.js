'use strict';
/**
 * src/modules/attendance/attendance.service.js
 * Business logic & State Machine for Attendance Management.
 * SRS Refs: FR-ATT-01–06, UC-05, BR-04
 * Architecture Plan: §6.2 Query 1 & 2
 */
const db = require('../../config/db');
const { isParentLinked } = require('../children/children.service');

/**
 * Record attendance event with state machine validation.
 */
const recordAttendance = (body,user) => require('../portal/portal.service').recordAttendance(body,user,true);

/**
 * Get attendance history for a specific child.
 */
const getChildAttendance = async (childIdParam, query = {}, user) => {
  const childId = parseInt(childIdParam, 10);

  // Verify child exists
  const { rows: childRows } = await db.query(
    `SELECT id, caregiver_id FROM children WHERE id = $1`,
    [childId]
  );
  if (childRows.length === 0) {
    const err = new Error('Child profile not found');
    err.statusCode = 404;
    throw err;
  }

  const child = childRows[0];

  // RBAC checks
  if (user.role === 'parent') {
    const linked = await isParentLinked(user.id, childId);
    if (!linked) {
      const err = new Error('Access denied: You are not linked to this child record');
      err.statusCode = 403;
      throw err;
    }
  } else if (user.role === 'caregiver' && child.caregiver_id !== user.id) {
    const err = new Error('Access denied: You are not assigned to this child');
    err.statusCode = 403;
    throw err;
  }

  const startDate = query.startDate ? new Date(query.startDate).toISOString() : null;
  const endDate = query.endDate ? new Date(query.endDate).toISOString() : null;

  const { rows } = await db.query(
    `SELECT a.id, a.child_id, a.event_type, a.event_time, a.notes,
            u.name AS recorded_by_name
     FROM attendance a
     JOIN users u ON u.id = a.recorded_by
     WHERE a.child_id = $1
       AND ($2::timestamptz IS NULL OR a.event_time >= $2::timestamptz)
       AND ($3::timestamptz IS NULL OR a.event_time <= $3::timestamptz)
     ORDER BY a.event_time DESC`,
    [childId, startDate, endDate]
  );

  return { data: rows };
};

/**
 * Admin Attendance Monitor Grid & Summary Counts (LATERAL JOIN pattern).
 */
const listAttendance = async (query = {}) => {
  const groupId = query.group_id ? parseInt(query.group_id, 10) : null;

  // Query 1: Admin live attendance grid
  const { rows: grid } = await db.query(
    `SELECT c.id AS child_id, c.full_name, g.name AS group_name, u.name AS caregiver_name,
            a.event_type AS latest_status, a.event_time AS last_event_time
     FROM children c
     LEFT JOIN groups g ON g.id = c.group_id
     LEFT JOIN users u ON u.id = c.caregiver_id
     LEFT JOIN LATERAL (
       SELECT event_type, event_time FROM attendance
       WHERE child_id = c.id AND event_time::date = CURRENT_DATE
       ORDER BY event_time DESC LIMIT 1
     ) a ON TRUE
     WHERE c.enrollment_status = 'active'
       AND ($1::integer IS NULL OR c.group_id = $1)
     ORDER BY g.name NULLS LAST, c.full_name ASC`,
    [groupId]
  );

  // Query 2: Attendance summary statistics
  const { rows: summaryRows } = await db.query(
    `SELECT
       COUNT(c.id)::integer AS total_enrolled,
       COUNT(a.event_type) FILTER (WHERE a.event_type = 'checkin')::integer AS checked_in,
       COUNT(a.event_type) FILTER (WHERE a.event_type = 'checkout')::integer AS checked_out,
       COUNT(a.event_type) FILTER (WHERE a.event_type = 'absent')::integer AS absent,
       (COUNT(c.id) - COUNT(a.event_type))::integer AS no_record_yet
     FROM children c
     LEFT JOIN LATERAL (
       SELECT event_type FROM attendance
       WHERE child_id = c.id AND event_time::date = CURRENT_DATE
       ORDER BY event_time DESC LIMIT 1
     ) a ON TRUE
     WHERE c.enrollment_status = 'active'`,
    []
  );

  return {
    summary: summaryRows[0] || {
      total_enrolled: 0,
      checked_in: 0,
      checked_out: 0,
      absent: 0,
      no_record_yet: 0,
    },
    grid,
  };
};

/**
 * Child or Center Attendance Summary Aggregation — FR-ATT-04
 */
const getAttendanceSummary = async (query = {}, user) => {
  const childIdParam = query.child_id ? parseInt(query.child_id, 10) : null;
  const startDate = query.start_date || null;
  const endDate = query.end_date || null;

  if (childIdParam) {
    const { rows: childRows } = await db.query(
      `SELECT id, full_name, caregiver_id FROM children WHERE id = $1`,
      [childIdParam]
    );
    if (childRows.length === 0) {
      const err = new Error('Child not found');
      err.statusCode = 404;
      throw err;
    }
    const child = childRows[0];

    if (user.role === 'parent') {
      const linked = await isParentLinked(user.id, childIdParam);
      if (!linked) {
        const err = new Error('Access denied: You are not linked to this child record');
        err.statusCode = 403;
        throw err;
      }
    } else if (user.role === 'caregiver' && child.caregiver_id !== user.id) {
      const err = new Error('Access denied: You are not assigned to this child');
      err.statusCode = 403;
      throw err;
    }

    const { rows: events } = await db.query(
      `SELECT event_type, event_time::date AS log_date, event_time
       FROM attendance
       WHERE child_id = $1
         AND ($2::date IS NULL OR event_time::date >= $2::date)
         AND ($3::date IS NULL OR event_time::date <= $3::date)
       ORDER BY event_time ASC`,
      [childIdParam, startDate, endDate]
    );

    const dateMap = new Map();
    for (const ev of events) {
      const dStr = ev.log_date instanceof Date ? ev.log_date.toISOString().split('T')[0] : String(ev.log_date);
      if (!dateMap.has(dStr)) {
        dateMap.set(dStr, { checkin: null, checkout: null, absent: false });
      }
      const day = dateMap.get(dStr);
      if (ev.event_type === 'checkin') day.checkin = ev.event_time;
      if (ev.event_type === 'checkout') day.checkout = ev.event_time;
      if (ev.event_type === 'absent') day.absent = true;
    }

    let presentDays = 0;
    let absentDays = 0;
    let totalStayMinutes = 0;
    let completedStays = 0;

    for (const [, day] of dateMap) {
      if (day.checkin) {
        presentDays++;
        if (day.checkout) {
          const diffMs = new Date(day.checkout) - new Date(day.checkin);
          if (diffMs > 0) {
            totalStayMinutes += diffMs / (1000 * 60);
            completedStays++;
          }
        }
      } else if (day.absent) {
        absentDays++;
      }
    }

    const recordedDays = presentDays + absentDays;
    const attendanceRate = recordedDays > 0 ? Math.round((presentDays / recordedDays) * 100) : 100;
    const avgStayHours = completedStays > 0 ? parseFloat((totalStayMinutes / (completedStays * 60)).toFixed(1)) : 0;

    return {
      child_id: childIdParam,
      child_name: child.full_name,
      total_recorded_days: recordedDays,
      present_days: presentDays,
      absent_days: absentDays,
      attendance_rate_percent: attendanceRate,
      average_stay_hours: avgStayHours,
      period: { start_date: startDate, end_date: endDate },
    };
  }

  // Center-wide aggregated summary (Admin only)
  if (user.role !== 'admin') {
    const err = new Error('Access denied: Only admins can view center-wide attendance summary');
    err.statusCode = 403;
    throw err;
  }

  const { rows: stats } = await db.query(
    `SELECT
       COUNT(DISTINCT c.id)::int AS total_active_children,
       COUNT(DISTINCT CASE WHEN a.event_type = 'checkin' THEN a.child_id END)::int AS unique_children_attended,
       COUNT(CASE WHEN a.event_type = 'checkin' THEN 1 END)::int AS total_checkins,
       COUNT(CASE WHEN a.event_type = 'absent' THEN 1 END)::int AS total_absences
     FROM children c
     LEFT JOIN attendance a ON a.child_id = c.id
       AND ($1::date IS NULL OR a.event_time::date >= $1::date)
       AND ($2::date IS NULL OR a.event_time::date <= $2::date)
     WHERE c.enrollment_status = 'active'`,
    [startDate, endDate]
  );

  const stat = stats[0];
  const totalDaysLogged = (stat.total_checkins || 0) + (stat.total_absences || 0);
  const centerRate = totalDaysLogged > 0 ? Math.round(((stat.total_checkins || 0) / totalDaysLogged) * 100) : 100;

  return {
    center_summary: {
      total_active_children: stat.total_active_children,
      total_checkins: stat.total_checkins || 0,
      total_absences: stat.total_absences || 0,
      overall_attendance_rate_percent: centerRate,
      period: { start_date: startDate, end_date: endDate },
    },
  };
};

module.exports = {
  recordAttendance,
  getChildAttendance,
  listAttendance,
  getAttendanceSummary,
};
