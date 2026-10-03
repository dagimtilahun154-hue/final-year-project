'use strict';
const db = require('../../config/db');
const { failure, shiftError, transitionError } = require('./policy');
const zoneDay = "(event_time AT TIME ZONE 'Africa/Addis_Ababa')::date";
const queryRows = async (client, sql, values=[]) => (await client.query(sql,values)).rows;
async function transaction(work) {
 const client=await db.connect();
 try {await client.query('BEGIN'); const result=await work(client); await client.query('COMMIT');return result;}
 catch(error){await client.query('ROLLBACK');throw error;} finally {client.release();}
}
async function audit(client, actor, action, table, id, metadata={}) {
 await client.query('INSERT INTO audit_logs(actor_id,action,target_table,target_id,metadata) VALUES($1,$2,$3,$4,$5)',[actor,action,table,id,JSON.stringify(metadata)]);
}
async function activeActor(client,user,adminOnly=false) {
 const [actor]=await queryRows(client,'SELECT u.id,u.status,r.name AS role FROM users u JOIN roles r ON r.id=u.role_id WHERE u.id=$1 FOR SHARE OF u',[user.id]);
 if(!actor||actor.status!=='active')throw failure('Your account is inactive.',403);
 if(adminOnly?actor.role!=='admin':!['admin','caregiver'].includes(actor.role))throw failure('Staff access required.',403);
 return actor;
}
async function assertScope(client,user,child,action,regular=false) {
 const actor=await activeActor(client,user);
 if(actor.role==='admin')return;
 if(regular&&action==='attendance'&&child.caregiver_id===actor.id)return;
 const rows=await queryRows(client,`SELECT id FROM front_desk_assignments WHERE staff_id=$1 AND status='active' AND starts_at<=clock_timestamp() AND ends_at>clock_timestamp() AND (group_id IS NULL OR group_id=$2) AND ${action==='pickup'?'can_pickup':'can_attendance'}=TRUE FOR SHARE`,[actor.id,child.group_id]);
 if(!rows.length)throw failure('No active front-desk assignment for this child and action.',403);
}
async function saveDuty(body,user) {
 if(!body.can_attendance&&!body.can_pickup)throw failure('Choose at least one responsibility.');
 const problem=shiftError(body.starts_at,body.ends_at); if(problem)throw failure(problem);
 return transaction(async client=>{
  await activeActor(client,user,true);
  const [staff]=await queryRows(client,"SELECT u.id,u.status,r.name AS role FROM users u JOIN roles r ON r.id=u.role_id WHERE u.id=$1 FOR UPDATE OF u",[body.staff_id]);
  if(!staff||staff.status!=='active'||staff.role!=='caregiver')throw failure('Choose an active caregiver.');
  const overlap=await queryRows(client,"SELECT id FROM front_desk_assignments WHERE staff_id=$1 AND status='active' AND starts_at<$3 AND ends_at>$2",[body.staff_id,body.starts_at,body.ends_at]);
  if(overlap.length)throw failure('This staff member already has an overlapping shift.',409);
  const [duty]=await queryRows(client,'INSERT INTO front_desk_assignments(staff_id,group_id,starts_at,ends_at,can_attendance,can_pickup,assigned_by) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *',[body.staff_id,body.group_id||null,body.starts_at,body.ends_at,body.can_attendance,body.can_pickup,user.id]);
  await audit(client,user.id,'FRONT_DESK_ASSIGNED','front_desk_assignments',duty.id,{staff_id:body.staff_id});return duty;
 });
}
async function revokeDuty(id,user) {return transaction(async client=>{
 await activeActor(client,user,true);
 const [row]=await queryRows(client,"UPDATE front_desk_assignments SET status='revoked',revoked_at=NOW() WHERE id=$1 AND status='active' RETURNING *",[id]);
 if(!row)throw failure('Assignment is missing or already revoked.',409);
 await audit(client,user.id,'FRONT_DESK_REVOKED','front_desk_assignments',row.id);return row;
});}
async function recordAttendance(body,user,regular=false) {return transaction(async client=>{
 const [child]=await queryRows(client,'SELECT * FROM children WHERE id=$1 FOR UPDATE',[body.child_id]);
 if(!child||child.enrollment_status!=='active')throw failure('Active child not found.',404);
 await assertScope(client,user,child,'attendance',regular);
 if(body.event_type==='checkout')throw failure('Use the verified front-desk pickup flow to check out a child.',409);
 const [previous]=await queryRows(client,`SELECT event_type FROM attendance WHERE child_id=$1 AND ${zoneDay}=(clock_timestamp() AT TIME ZONE 'Africa/Addis_Ababa')::date ORDER BY event_time DESC,id DESC LIMIT 1`,[child.id]);
 const error=transitionError(previous?.event_type,body.event_type);if(error)throw failure(error,409);
 const [record]=await queryRows(client,'INSERT INTO attendance(child_id,recorded_by,event_type,notes) VALUES($1,$2,$3,$4) RETURNING *',[child.id,user.id,body.event_type,body.notes||null]);
 await audit(client,user.id,'ATTENDANCE_RECORDED','attendance',record.id,{child_id:child.id,event_type:record.event_type});return record;
});}
async function checkout(body,user) {return transaction(async client=>{
 const [child]=await queryRows(client,'SELECT * FROM children WHERE id=$1 FOR UPDATE',[body.child_id]);
 if(!child||child.enrollment_status!=='active')throw failure('Active child not found.',404);
 await assertScope(client,user,child,'pickup');
 const [guardian]=await queryRows(client,"SELECT gl.id FROM guardian_links gl JOIN users u ON u.id=gl.user_id WHERE gl.child_id=$1 AND gl.user_id=$2 AND gl.pickup_authorized=TRUE AND u.status='active' FOR SHARE OF gl,u",[child.id,body.guardian_user_id]);
 if(!guardian)throw failure('This adult is not currently authorized for pickup.',403);
 const [previous]=await queryRows(client,`SELECT event_type FROM attendance WHERE child_id=$1 AND ${zoneDay}=(clock_timestamp() AT TIME ZONE 'Africa/Addis_Ababa')::date ORDER BY event_time DESC,id DESC LIMIT 1`,[child.id]);
 const error=transitionError(previous?.event_type,'checkout');if(error)throw failure(error,409);
 if(body.method!=='manual')throw failure('Biometric device integration is not configured. Use the approved manual check.',503);
 if(body.identity_confirmed!==true||!body.reason||body.reason.trim().length<12)throw failure('Record the identity check performed and confirm the adult identity.');
 // Verify and release within one locked transaction; no reusable client-supplied success token.
 const [attendance]=await queryRows(client,"INSERT INTO attendance(child_id,recorded_by,event_type) VALUES($1,$2,'checkout') RETURNING *",[child.id,user.id]);
 const [verification]=await queryRows(client,"INSERT INTO guardian_verification_events(child_id,guardian_user_id,verified_by,result,method,attendance_id,manual_reason) VALUES($1,$2,$3,'manual_fallback','manual',$4,$5) RETURNING id,verified_at,result,method",[child.id,body.guardian_user_id,user.id,attendance.id,body.reason.trim()]);
 await assertScope(client,user,child,'pickup');
 await audit(client,user.id,'PICKUP_COMPLETED','attendance',attendance.id,{child_id:child.id,guardian_user_id:body.guardian_user_id,verification_id:verification.id,method:'manual'});
 return {attendance,verification};
});}
async function snapshot(date,days,user,staffOnly=false) {
 return transaction(async client=>{
  const actor=await activeActor(client,user,!staffOnly);
  if(staffOnly){date=new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Addis_Ababa',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());days=1;}
  const duties=await queryRows(client,`SELECT * FROM front_desk_assignments WHERE ($1::integer IS NULL OR staff_id=$1) ORDER BY starts_at DESC`,[staffOnly?actor.id:null]);
  const children=await queryRows(client,staffOnly?`SELECT c.* FROM children c WHERE c.enrollment_status='active' AND EXISTS (SELECT 1 FROM front_desk_assignments d WHERE d.staff_id=$1 AND d.status='active' AND d.starts_at<=clock_timestamp() AND d.ends_at>clock_timestamp() AND (d.group_id IS NULL OR d.group_id=c.group_id)) ORDER BY c.full_name`:'SELECT * FROM children ORDER BY full_name',staffOnly?[actor.id]:[]);
  const ids=children.map(c=>c.id);
  if(!staffOnly) {
   const contacts=await queryRows(client,'SELECT * FROM emergency_contacts WHERE child_id=ANY($1::int[]) ORDER BY id',[ids]);
   const instructions=await queryRows(client,'SELECT * FROM care_instructions WHERE child_id=ANY($1::int[]) ORDER BY id',[ids]);
   children.forEach(child=>{child.emergency_contacts=contacts.filter(r=>r.child_id===child.id);child.care_instructions=instructions.filter(r=>r.child_id===child.id);});
  }
  const base={children,duties,groups:await queryRows(client,staffOnly?'SELECT * FROM groups WHERE id=ANY($1::int[])':'SELECT * FROM groups ORDER BY name',staffOnly?[children.map(c=>c.group_id).filter(Boolean)]:[])};
  const attendance=await queryRows(client,`SELECT * FROM attendance WHERE child_id=ANY($1::int[]) AND ${zoneDay} BETWEEN $2::date-($3::int-1) AND $2::date ORDER BY event_time DESC`,[ids,date,days]);
  const guardians=await queryRows(client,'SELECT gl.*,EXISTS(SELECT 1 FROM biometric_references br WHERE br.guardian_link_id=gl.id AND br.active) AS enrolled FROM guardian_links gl WHERE child_id=ANY($1::int[])',[ids]);
  const users=await queryRows(client,staffOnly?'SELECT u.id,u.name,u.email,u.status,r.name AS role FROM users u JOIN roles r ON r.id=u.role_id WHERE u.id=$1 OR u.id=ANY($2::int[])':'SELECT u.id,u.name,u.email,u.status,r.name AS role,u.created_at FROM users u JOIN roles r ON r.id=u.role_id ORDER BY u.name',staffOnly?[actor.id,guardians.map(g=>g.user_id)]:[]);
  const verifications=await queryRows(client,"SELECT id,child_id,guardian_user_id,verified_by,result,method,verified_at,attendance_id FROM guardian_verification_events WHERE child_id=ANY($1::int[]) AND (verified_at AT TIME ZONE 'Africa/Addis_Ababa')::date BETWEEN $2::date-($3::int-1) AND $2::date",[ids,date,days]);
  if(staffOnly)return {...base,attendance,guardians,users,verifications,reports:[],health:[],events:[],announcements:[],products:[],orders:[],audit:[],messages:[]};
  return {...base,attendance,guardians,users,verifications,
   reports:await queryRows(client,'SELECT * FROM daily_reports WHERE report_date BETWEEN $1::date-($2::int-1) AND $1::date',[date,days]),
   health:await queryRows(client,"SELECT * FROM health_records WHERE (recorded_at AT TIME ZONE 'Africa/Addis_Ababa')::date BETWEEN $1::date-($2::int-1) AND $1::date",[date,days]),
   events:await queryRows(client,'SELECT * FROM events WHERE event_date >= $1::date-30 ORDER BY event_date',[date]),
   announcements:await queryRows(client,'SELECT * FROM announcements ORDER BY created_at DESC LIMIT 100'),
   products:await queryRows(client,'SELECT * FROM products ORDER BY name'),
   orders:await queryRows(client,"SELECT * FROM orders WHERE (created_at AT TIME ZONE 'Africa/Addis_Ababa')::date BETWEEN $1::date-($2::int-1) AND $1::date ORDER BY created_at DESC",[date,days]),
   audit:await queryRows(client,'SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 200'),
   messages:await queryRows(client,'SELECT m.id,m.subject,m.body,m.sender_id,m.recipient_id,m.read_at,m.created_at FROM messages m WHERE sender_id=$1 OR recipient_id=$1 ORDER BY created_at DESC LIMIT 100',[actor.id])};
 });
}
module.exports={saveDuty,revokeDuty,recordAttendance,checkout,snapshot};
