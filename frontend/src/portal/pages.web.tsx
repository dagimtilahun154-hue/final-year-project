import React, { useState } from "react";
import {
  Dataset,
  Row,
  addDays,
  attendanceStatus,
  dayOf,
  dutyState,
  localDay,
  localTime,
  metrics,
  money,
  label,
  today,
} from "./model";
import { Badge, Button, Card, Empty, Icon, Person, Table } from "./ui.web";
export type PageContext = {
  data: Dataset;
  date: string;
  query: string;
  staff: boolean;
  actor: Row;
  preview: boolean;
  go: (page: string) => void;
  open: (kind: string, row?: Row) => void;
};
const find = (rows: Row[], id: number, key = "name") =>
  rows.find((r) => r.id === id)?.[key] || "Unassigned";
export const userName = (data: Dataset, id: number) => find(data.users, id);
export const childName = (data: Dataset, id: number) =>
  find(data.children, id, "full_name");
export const groupName = (data: Dataset, id: number) => find(data.groups, id);
const search = (rows: Row[], query: string) =>
  rows.filter((r) =>
    JSON.stringify(r).toLowerCase().includes(query.trim().toLowerCase()),
  );
function Stat({
  title,
  value,
  note,
  icon,
  tint,
  ink,
}: {
  title: string;
  value: React.ReactNode;
  note: string;
  icon: string;
  tint: string;
  ink?: string;
}) {
  return (
    <Card className="p-stat">
      <div
        style={{ position: "absolute", inset: 0, background: tint, zIndex: 0 }}
      />
      <div style={{ position: "relative" }}>
        <label>{title}</label>
        <span className="p-stat-icon" style={{ color: ink }}>
          <Icon name={icon} />
        </span>
      </div>
      <b style={{ position: "relative" }}>{value}</b>
      <small style={{ position: "relative" }}>{note}</small>
    </Card>
  );
}
function AttendanceChart({
  data,
  date,
  days = 7,
  group = "",
}: {
  data: Dataset;
  date: string;
  days?: number;
  group?: string;
}) {
  const series = Array.from({ length: days }, (_, i) => {
    const day = addDays(date, i - days + 1);
    const m = metrics(data, day, group);
    return { day, value: m.present + m.collected, absent: m.absent };
  });
  const max = Math.max(4, ...series.map((s) => s.value + s.absent));
  const x = (i: number) => 45 + i * (570 / (days - 1 || 1));
  const y = (value: number) => 155 - (value / max) * 125;
  const points = series.map((s, i) => `${x(i)},${y(s.value)}`).join(" ");
  return (
    <>
      <svg
        className="p-chart"
        viewBox="0 0 650 185"
        role="img"
        aria-label={`Daily children attending: ${series.map((s) => s.day + ": " + s.value).join(", ")}`}
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="attendance-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#b4cbb2" stopOpacity=".38" />
            <stop offset="1" stopColor="#f9fbf7" stopOpacity=".1" />
          </linearGradient>
        </defs>
        {[0, 1, 2, 3].map((i) => (
          <g key={i}>
            <line
              x1="42"
              x2="626"
              y1={30 + i * 42}
              y2={30 + i * 42}
              stroke="#edf0e9"
              strokeDasharray="3 5"
            />
            <text x="10" y={34 + i * 42}>
              {Math.round(max * (1 - i / 3))}
            </text>
          </g>
        ))}
        <polygon
          points={`45,155 ${points} 615,155`}
          fill="url(#attendance-fill)"
        />
        <polyline
          points={points}
          fill="none"
          stroke="#7ba083"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        {series.map((s, i) => (
          <g key={s.day}>
            {days <= 7 && (
              <circle
                cx={x(i)}
                cy={y(s.value)}
                r="3.5"
                fill="#fff"
                stroke="#7ba083"
                strokeWidth="2"
              />
            )}
            {(days <= 7 || i % 5 === 0 || i === days - 1) && (
              <text x={x(i)} y="182" textAnchor="middle">
                {new Date(s.day + "T12:00:00Z").toLocaleDateString("en", {
                  [days <= 7 ? "weekday" : "day"]: "short" as any,
                  ...(days > 7 ? { day: "numeric" } : {}),
                })}
              </text>
            )}
          </g>
        ))}
      </svg>
      <div className="p-legend">
        <span>
          <i className="p-dot" />
          Attended (including collected)
        </span>
        <span>Daily unique children</span>
      </div>
    </>
  );
}
export function Overview(ctx: PageContext) {
  const { data, date, go, open } = ctx;
  const m = metrics(data, date);
  const reportRate = m.total ? Math.round((m.submitted / m.total) * 100) : 0;
  const lowStock = data.products.filter((p) => p.stock_qty <= 5).length;
  const health = data.health.filter((h) => !h.parent_notified).length;
  return (
    <>
      <div className="p-grid stats">
        <Stat
          title="Enrolled children"
          value={m.total}
          note={`${data.groups.length} groups, growing together`}
          icon="child"
          tint="#eff3e8"
        />
        <Stat
          title="At daycare"
          value={m.present}
          note={`${m.absent} absent · ${m.pending} not marked`}
          icon="heart"
          tint="#f9eedb"
          ink="#ac8c4a"
        />
        <Stat
          title="Reports submitted"
          value={
            <>
              {m.submitted}
              <span style={{ fontSize: 16, color: "#a0a1a4" }}>
                {" "}
                / {m.total}
              </span>
            </>
          }
          note={`${reportRate}% of active children`}
          icon="file"
          tint="#efeef7"
          ink="#9c91ba"
        />
        <Stat
          title="Safe pickups"
          value={m.collected}
          note="Recorded check-outs for selected day"
          icon="shield"
          tint="#eaf2f4"
          ink="#7e9fab"
        />
      </div>
      <div className="p-grid main">
        <Card>
          <div className="p-card-head">
            <div>
              <h2>Little steps, every day</h2>
              <p>Attendance across the last seven days</p>
            </div>
            <Button variant="quiet" onClick={() => go("analytics")}>
              View analytics <Icon name="arrow" size={15} />
            </Button>
          </div>
          <AttendanceChart data={data} date={date} />
        </Card>
        <Card>
          <div className="p-card-head">
            <div>
              <h2>A little attention needed</h2>
              <p>The things worth a closer look</p>
            </div>
            <Icon name="bell" size={19} />
          </div>
          {[
            {
              n: m.missing,
              t: "Daily reports remaining",
              s: "Keep families connected to their day",
              go: "reports",
              icon: "file",
            },
            {
              n: health,
              t: "Parent updates pending",
              s: "Health and incident communication",
              go: "health",
              icon: "heart",
            },
            {
              n: lowStock,
              t: "Items running low",
              s: "Review daycare essentials",
              go: "store",
              icon: "store",
            },
          ].map((item) => (
            <div className="p-attention" key={item.go}>
              <span className="p-icon-tile">
                <Icon name={item.icon} size={17} />
              </span>
              <div>
                <strong>
                  {item.n} {item.t.toLowerCase()}
                </strong>
                <p>{item.s}</p>
              </div>
              <button
                className="p-icon-button"
                aria-label={"Review " + item.t.toLowerCase()}
                onClick={() => go(item.go)}
              >
                <Icon name="arrow" size={17} />
              </button>
            </div>
          ))}
        </Card>
      </div>
      <div className="p-grid main">
        <Card>
          <div className="p-card-head">
            <div>
              <h2>Today at a glance</h2>
              <p>Children, caregivers and little daily moments</p>
            </div>
            <Button variant="quiet" onClick={() => go("attendance")}>
              All attendance <Icon name="arrow" size={15} />
            </Button>
          </div>
          <Table
            pageSize={5}
            rows={m.rows.map(({ child, status }) => ({
              ...child,
              event_type: status?.event_type || "not_marked",
              event_time: status?.event_time,
            }))}
            columns={[
              {
                key: "full_name",
                title: "Child",
                render: (r) => (
                  <Person
                    name={r.full_name}
                    sub={groupName(data, r.group_id)}
                  />
                ),
              },
              {
                key: "caregiver_id",
                title: "Caregiver",
                render: (r) => (
                  <span>{userName(data, r.caregiver_id).split(" ")[0]}</span>
                ),
              },
              {
                key: "event_type",
                title: "Status",
                render: (r) => <Badge value={r.event_type} />,
              },
              {
                key: "event_time",
                title: "Last update",
                render: (r) => localTime(r.event_time),
              },
            ]}
          />
        </Card>
        <Card>
          <div className="p-card-head">
            <div>
              <h2>Our groups</h2>
              <p>Daily report completion</p>
            </div>
            <Button variant="quiet" onClick={() => go("groups")}>
              View all
            </Button>
          </div>
          {data.groups.map((g) => {
            const s = metrics(data, date, String(g.id));
            return (
              <div key={g.id} className="p-group-row">
                <div>
                  <strong>{g.name}</strong>
                  <small>
                    {s.submitted}/{s.total} reports
                  </small>
                </div>
                <div className="p-progress">
                  <span
                    style={{
                      width: `${s.total ? (s.submitted / s.total) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>
            );
          })}
          <div className="p-notice" style={{ marginTop: 26, marginBottom: 0 }}>
            Every update helps a family feel a little closer.
          </div>
        </Card>
      </div>
      <div className="p-grid main">
        <Card>
          <div className="p-card-head">
            <div>
              <h2>Front-desk coverage</h2>
              <p>Personal logins. Clear responsibilities.</p>
            </div>
            <Button variant="quiet" onClick={() => go("front-desk")}>
              Manage duties <Icon name="arrow" size={15} />
            </Button>
          </div>
          {data.duties.filter((d) => localDay(d.starts_at) === date).length ? (
            data.duties
              .filter((d) => localDay(d.starts_at) === date)
              .map((d) => (
                <div className="p-attention" key={d.id}>
                  <Person
                    name={userName(data, d.staff_id)}
                    sub={`${localTime(d.starts_at)} – ${localTime(d.ends_at)}`}
                  />
                  <div style={{ flex: 1 }} />
                  <Badge value={dutyState(d)} />
                </div>
              ))
          ) : (
            <Empty
              title="No desk coverage"
              text="Assign a caregiver for this day."
            />
          )}
        </Card>
        <Card>
          <div className="p-card-head">
            <h2>Coming up</h2>
            <Button variant="quiet" onClick={() => go("events")}>
              Calendar
            </Button>
          </div>
          {data.events
            .filter((e) => !e.cancelled && dayOf(e.event_date) >= date)
            .slice(0, 2)
            .map((e) => (
              <div className="p-event" key={e.id}>
                <div className="p-date-tile">
                  {new Date(e.event_date).toLocaleDateString("en", {
                    month: "short",
                  })}
                  <b>{Number(dayOf(e.event_date).slice(-2))}</b>
                </div>
                <div>
                  <h3>{e.title}</h3>
                  <p>
                    {label(e.event_type)} ·{" "}
                    {e.event_time?.slice(0, 5) || "All day"}
                  </p>
                </div>
              </div>
            ))}
        </Card>
      </div>
    </>
  );
}
export function Analytics({ data, date }: PageContext) {
  const [days, setDays] = useState(7);
  const [group, setGroup] = useState("");
  const m = metrics(data, date, group);
  const dates = Array.from({ length: days }, (_, i) => addDays(date, -i));
  const childIds = new Set(m.rows.map((r) => r.child.id));
  const sample = dates.map((d) => metrics(data, d, group));
  const attendanceDays = sample.reduce(
    (n, s) => n + s.present + s.collected,
    0,
  );
  const paid = data.orders.filter(
    (o) =>
      o.payment_status === "paid" && dates.includes(localDay(o.created_at)),
  );
  const submitted = data.reports.filter(
    (r) => childIds.has(r.child_id) && dates.includes(dayOf(r.report_date)),
  ).length;
  return (
    <>
      <div className="p-filters">
        <div className="p-tabs" style={{ margin: 0 }}>
          {[7, 30].map((n) => (
            <button
              key={n}
              className={days === n ? "active" : ""}
              aria-pressed={days === n}
              onClick={() => setDays(n)}
            >
              Last {n} days
            </button>
          ))}
        </div>
        <select
          aria-label="Analytics group"
          value={group}
          onChange={(e) => setGroup(e.target.value)}
        >
          <option value="">All groups</option>
          {data.groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
      </div>
      <div className="p-grid stats">
        <Stat
          title="Child attendance days"
          value={attendanceDays}
          note={`${days} calendar days · unique child/day`}
          icon="calendar"
          tint="#eff3e8"
        />
        <Stat
          title="Reports recorded"
          value={submitted}
          note="Within selected group and date range"
          icon="file"
          tint="#efedf6"
        />
        <Stat
          title="Paid order value"
          value={money(paid.reduce((n, o) => n + Number(o.total), 0))}
          note="Center-wide · by order creation date"
          icon="store"
          tint="#faf0df"
        />
        <Stat
          title="Parent updates pending"
          value={
            data.health.filter(
              (h) =>
                !h.parent_notified &&
                childIds.has(h.child_id) &&
                dates.includes(localDay(h.recorded_at)),
            ).length
          }
          note="Health records in selected range"
          icon="heart"
          tint="#f8eae7"
        />
      </div>
      <div className="p-grid main">
        <Card>
          <div className="p-card-head">
            <div>
              <h2>Attendance trend</h2>
              <p>
                {addDays(date, 1 - days)} through {date}
              </p>
            </div>
            <Badge value={`${m.total} active children`} tone="green" />
          </div>
          <AttendanceChart data={data} date={date} days={days} group={group} />
          <p className="p-kpi-note">
            Current active enrollment is used for group membership. This chart
            shows recorded attendance, not a forecast.
          </p>
        </Card>
        <Card>
          <h2>Selected-day attendance</h2>
          {[
            { n: m.present, l: "At daycare", c: "#8eae92" },
            { n: m.collected, l: "Collected", c: "#b6c9d2" },
            { n: m.absent, l: "Absent", c: "#e5b49e" },
            { n: m.pending, l: "Not marked", c: "#e7d29d" },
          ].map((s) => (
            <div className="p-group-row" key={s.l}>
              <div>
                <strong>{s.l}</strong>
                <small>{s.n} children</small>
              </div>
              <div className="p-progress">
                <span
                  style={{
                    background: s.c,
                    width: `${m.total ? (s.n / m.total) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>
          ))}
        </Card>
      </div>
      <Card>
        <div className="p-card-head">
          <div>
            <h2>Caregiver reporting</h2>
            <p>Selected-day completion by assigned active children</p>
          </div>
        </div>
        <Table
          rows={data.users
            .filter((u) => u.role === "caregiver")
            .map((u) => {
              const kids = m.rows
                .filter((r) => r.child.caregiver_id === u.id)
                .map((r) => r.child.id);
              const count = kids.filter((id) =>
                data.reports.some(
                  (r) => r.child_id === id && dayOf(r.report_date) === date,
                ),
              ).length;
              return {
                ...u,
                assigned: kids.length,
                submitted: count,
                missing: kids.length - count,
              };
            })}
          columns={[
            {
              key: "name",
              title: "Caregiver",
              render: (r) => <Person name={r.name} />,
            },
            { key: "assigned", title: "Assigned children" },
            { key: "submitted", title: "Reports submitted" },
            {
              key: "missing",
              title: "Remaining",
              render: (r) => (
                <Badge
                  value={
                    r.missing === 0 ? "complete" : `${r.missing} remaining`
                  }
                  tone={r.missing ? "gold" : "green"}
                />
              ),
            },
          ]}
        />
      </Card>
    </>
  );
}
export function Registry(ctx: PageContext) {
  const { data, query, open } = ctx;
  const [role, setRole] = useState("caregiver");
  const [status, setStatus] = useState("");
  const rows = search(
    data.users.filter(
      (u) => u.role === role && (!status || u.status === status),
    ),
    query,
  );
  return (
    <Card>
      <div className="p-card-head">
        <div>
          <h2>People who make care possible</h2>
          <p>
            {rows.length}{" "}
            {role === "parent" ? "parents & guardians" : "caregivers"}
          </p>
        </div>
        <Button icon="plus" onClick={() => open("user", { id: 0, role })}>
          Register {role === "parent" ? "parent" : "caregiver"}
        </Button>
      </div>
      <div className="p-filters">
        <div className="p-tabs" style={{ margin: 0 }}>
          {["caregiver", "parent"].map((r) => (
            <button
              key={r}
              aria-pressed={role === r}
              className={role === r ? "active" : ""}
              onClick={() => setRole(r)}
            >
              {r === "parent" ? "Parents & guardians" : "Caregivers"}
            </button>
          ))}
        </div>
        <select
          aria-label="Account status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">All statuses</option>
          <option>active</option>
          <option>inactive</option>
        </select>
      </div>
      <Table
        rows={rows}
        columns={[
          {
            key: "name",
            title: "Name",
            render: (r) => <Person name={r.name} sub={r.email} />,
          },
          { key: "role", title: "Role", render: (r) => label(r.role) },
          {
            key: "linked",
            title: role === "parent" ? "Linked children" : "Assigned children",
            render: (r) =>
              role === "parent"
                ? data.guardians.filter((g) => g.user_id === r.id).length
                : data.children.filter((c) => c.caregiver_id === r.id).length,
          },
          {
            key: "status",
            title: "Account",
            render: (r) => <Badge value={r.status} />,
          },
          {
            key: "actions",
            title: "Actions",
            render: (r) => (
              <div className="p-row-actions">
                <Button variant="quiet" onClick={() => open("user", r)}>
                  Edit
                </Button>
                <Button variant="quiet" onClick={() => open("user-status", r)}>
                  {r.status === "active" ? "Deactivate" : "Activate"}
                </Button>
              </div>
            ),
          },
        ]}
      />
    </Card>
  );
}
export function Children(ctx: PageContext) {
  const { data, query, open } = ctx;
  const [group, setGroup] = useState("");
  const [status, setStatus] = useState("");
  return (
    <Card>
      <div className="p-card-head">
        <div>
          <h2>A place for every little learner</h2>
          <p>Student profiles, families and care assignments</p>
        </div>
        <Button icon="plus" onClick={() => open("child")}>
          Register child
        </Button>
      </div>
      <div className="p-filters">
        <select
          aria-label="Child group"
          value={group}
          onChange={(e) => setGroup(e.target.value)}
        >
          <option value="">All groups</option>
          {data.groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
        <select
          aria-label="Enrollment status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">All enrollment</option>
          {["active", "waitlist", "inactive"].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </div>
      <Table
        rows={search(
          data.children.filter(
            (c) =>
              (!group || String(c.group_id) === group) &&
              (!status || c.enrollment_status === status),
          ),
          query,
        )}
        columns={[
          {
            key: "full_name",
            title: "Child",
            render: (r) => (
              <Person name={r.full_name} sub={"Born " + dayOf(r.dob)} />
            ),
          },
          {
            key: "group_id",
            title: "Group",
            render: (r) => groupName(data, r.group_id),
          },
          {
            key: "caregiver_id",
            title: "Caregiver",
            render: (r) => userName(data, r.caregiver_id),
          },
          {
            key: "enrollment_status",
            title: "Enrollment",
            render: (r) => <Badge value={r.enrollment_status} />,
          },
          {
            key: "actions",
            title: "Manage",
            render: (r) => (
              <div className="p-row-actions">
                <Button variant="quiet" onClick={() => open("child-profile", r)}>Profile</Button>
                <Button variant="quiet" onClick={() => open("child", r)}>
                  Edit
                </Button>
                <Button variant="quiet" onClick={() => open("guardian", r)}>
                  Link guardian
                </Button>
              </div>
            ),
          },
        ]}
      />
    </Card>
  );
}
export function Groups(ctx: PageContext) {
  const { data, query, open, date } = ctx;
  return (
    <>
      <div
        className="p-head-actions"
        style={{ justifyContent: "flex-end", marginBottom: 20 }}
      >
        <Button icon="plus" onClick={() => open("group")}>
          Create group
        </Button>
      </div>
      <div
        className="p-grid"
        style={{ gridTemplateColumns: "repeat(auto-fit,minmax(250px,1fr))" }}
      >
        {search(data.groups, query).map((g) => {
          const m = metrics(data, date, String(g.id));
          return (
            <Card key={g.id}>
              <div className="p-card-head">
                <span className="p-avatar">
                  <Icon name="leaf" />
                </span>
                <Button variant="quiet" onClick={() => open("group", g)}>
                  Edit group
                </Button>
              </div>
              <h2>{g.name}</h2>
              <p style={{ fontSize: 12 }}>
                {g.description || "Learning and growing, together."}
              </p>
              <div className="p-detail-grid">
                <div>
                  <small>Active children</small>
                  <strong>{m.total}</strong>
                </div>
                <div>
                  <small>At daycare</small>
                  <strong>{m.present}</strong>
                </div>
              </div>
              <div className="p-group-row">
                <div>
                  <small>Daily reports</small>
                  <small>
                    {m.submitted}/{m.total}
                  </small>
                </div>
                <div className="p-progress">
                  <span
                    style={{
                      width: `${m.total ? (m.submitted / m.total) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>
              <Button variant="secondary" onClick={() => ctx.go("children")}>
                Manage roster
              </Button>
            </Card>
          );
        })}
      </div>
    </>
  );
}
export function Duties(ctx: PageContext) {
  const { data, date, query, open } = ctx;
  return (
    <Card>
      <div className="p-card-head">
        <div>
          <h2>The right people, at the right time</h2>
          <p>Assignments are separate from classroom responsibilities.</p>
        </div>
        <Button icon="plus" onClick={() => open("duty")}>
          Assign staff
        </Button>
      </div>
      <div className="p-notice">
        Staff use their own credentials. Access is limited by shift, group and
        the actions you assign.
      </div>
      <Table
        rows={search(
          data.duties
            .map((d): Row => ({ ...d, name: userName(data, d.staff_id) }))
            .filter((d) => localDay(d.starts_at) === date),
          query,
        )}
        columns={[
          {
            key: "name",
            title: "Staff member",
            render: (r) => <Person name={r.name} />,
          },
          {
            key: "starts_at",
            title: "Shift · Addis Ababa",
            render: (r) =>
              `${localTime(r.starts_at)} – ${localTime(r.ends_at)}`,
          },
          {
            key: "group_id",
            title: "Scope",
            render: (r) =>
              r.group_id ? groupName(data, r.group_id) : "All groups",
          },
          {
            key: "capabilities",
            title: "Responsibilities",
            render: (r) =>
              [
                r.can_attendance ? "Attendance" : "",
                r.can_pickup ? "Pickup" : "",
              ]
                .filter(Boolean)
                .join(" + "),
          },
          {
            key: "status",
            title: "Status",
            render: (r) => <Badge value={dutyState(r)} />,
          },
          {
            key: "actions",
            title: "Actions",
            render: (r) => (
              <Button
                variant="quiet"
                disabled={r.status === "revoked"}
                onClick={() => open("revoke-duty", r)}
              >
                Revoke
              </Button>
            ),
          },
        ]}
      />
    </Card>
  );
}
export function Attendance(ctx: PageContext) {
  const { data, date, query, open, staff } = ctx;
  const [status, setStatus] = useState("");
  const m = metrics(data, date);
  const editable = date === today();
  return (
    <>
      <div className="p-grid stats">
        <Stat
          title="At daycare"
          value={m.present}
          note="Children currently checked in"
          icon="child"
          tint="#eff3e8"
        />
        <Stat
          title="Collected"
          value={m.collected}
          note="Completed check-outs"
          icon="shield"
          tint="#eaf2f4"
        />
        <Stat
          title="Absent"
          value={m.absent}
          note="Recorded for selected day"
          icon="calendar"
          tint="#faf0df"
        />
        <Stat
          title="Not marked"
          value={m.pending}
          note="Awaiting attendance"
          icon="clock"
          tint="#efedf6"
        />
      </div>
      {staff && (
        <div className="p-notice">
          Your assigned groups only. Shift permissions are rechecked on every
          action.
        </div>
      )}
      <Card>
        <div className="p-card-head">
          <h2>{staff ? "Your front desk" : "Daily attendance"}</h2>
          <select
            aria-label="Attendance status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">All statuses</option>
            {["checkin", "checkout", "absent", "not_marked"].map((s) => (
              <option key={s} value={s}>
                {label(s)}
              </option>
            ))}
          </select>
        </div>
        <Table
          rows={search(
            m.rows
              .map(({ child, status }) => ({
                ...child,
                event_type: status?.event_type || "not_marked",
                event_time: status?.event_time,
              }))
              .filter((r) => !status || r.event_type === status),
            query,
          )}
          columns={[
            {
              key: "full_name",
              title: "Child",
              render: (r) => (
                <Person name={r.full_name} sub={groupName(data, r.group_id)} />
              ),
            },
            {
              key: "event_type",
              title: "Status",
              render: (r) => <Badge value={r.event_type} />,
            },
            {
              key: "event_time",
              title: "Last update",
              render: (r) => localTime(r.event_time),
            },
            {
              key: "actions",
              title: "Actions",
              render: (r) => (
                <div className="p-row-actions">
                  {r.event_type === "not_marked" ? (
                    <>
                      <Button
                        variant="secondary small"
                        disabled={!editable}
                        onClick={() => open("checkin", r)}
                      >
                        Check in
                      </Button>
                      <Button
                        variant="quiet"
                        disabled={!editable}
                        onClick={() => open("absent", r)}
                      >
                        Absent
                      </Button>
                    </>
                  ) : r.event_type === "checkin" ? (
                    <Button
                      variant="secondary small"
                      disabled={!editable}
                      onClick={() => open("pickup", r)}
                    >
                      Verify pickup
                    </Button>
                  ) : (
                    <Button
                      variant="quiet"
                      onClick={() => open("attendance-history", r)}
                    >
                      History
                    </Button>
                  )}
                </div>
              ),
            },
          ]}
        />
      </Card>
    </>
  );
}
export function Reports(ctx: PageContext) {
  const { data, date, query, open } = ctx;
  const [mode, setMode] = useState("submitted");
  const rows = data.children
    .filter((c) => c.enrollment_status === "active")
    .map((c) => ({
      ...c,
      report: data.reports.find(
        (r) => r.child_id === c.id && dayOf(r.report_date) === date,
      ),
    }));
  return (
    <Card>
      <div className="p-card-head">
        <div>
          <h2>Every child's day, thoughtfully recorded</h2>
          <p>Report completion for {date}</p>
        </div>
      </div>
      <div className="p-tabs">
        {["submitted", "missing"].map((t) => (
          <button
            className={mode === t ? "active" : ""}
            aria-pressed={mode === t}
            key={t}
            onClick={() => setMode(t)}
          >
            {label(t)} (
            {
              rows.filter((r) => (t === "submitted" ? r.report : !r.report))
                .length
            }
            )
          </button>
        ))}
      </div>
      <Table
        rows={search(
          rows.filter((r) => (mode === "submitted" ? r.report : !r.report)),
          query,
        )}
        columns={[
          {
            key: "full_name",
            title: "Child",
            render: (r) => (
              <Person name={r.full_name} sub={groupName(data, r.group_id)} />
            ),
          },
          {
            key: "caregiver_id",
            title: "Caregiver",
            render: (r) => userName(data, r.caregiver_id),
          },
          {
            key: "report",
            title: "Report",
            render: (r) => (
              <Badge
                value={r.report ? "submitted" : "pending"}
                tone={r.report ? "green" : "gold"}
              />
            ),
          },
          {
            key: "actions",
            title: "Details",
            render: (r) =>
              r.report ? (
                <Button
                  variant="quiet"
                  onClick={() => open("report-detail", r.report)}
                >
                  Read report
                </Button>
              ) : (
                <span className="p-kpi-note">Awaiting caregiver</span>
              ),
          },
        ]}
      />
    </Card>
  );
}
export function Monitoring(ctx: PageContext & { page: string }) {
  const { page, data, query, date, open } = ctx;
  if (page === "health")
    return (
      <Card>
        <div className="p-card-head">
          <div>
            <h2>Health & incident records</h2>
            <p>Factual observations and parent notification status</p>
          </div>
        </div>
        <Table
          rows={search(
            data.health.map((h) => ({
              ...h,
              child_name: childName(data, h.child_id),
            })),
            query,
          )}
          columns={[
            {
              key: "child_name",
              title: "Child",
              render: (r) => <Person name={r.child_name} />,
            },
            { key: "record_type", title: "Type" },
            {
              key: "severity",
              title: "Severity",
              render: (r) => <Badge value={r.severity} />,
            },
            {
              key: "parent_notified",
              title: "Parent informed",
              render: (r) => (
                <Badge value={r.parent_notified ? "complete" : "pending"} />
              ),
            },
            {
              key: "actions",
              title: "Record",
              render: (r) => (
                <Button
                  variant="quiet"
                  onClick={() => open("health-detail", r)}
                >
                  View details
                </Button>
              ),
            },
          ]}
        />
      </Card>
    );
  if (page === "biometric")
    return (
      <>
        <div className="p-notice">
          Enrollment and today's identity check are separate. Biometric device
          integration is pending; authorized staff can use the recorded manual
          pickup workflow.
        </div>
        <Card>
          <div className="p-card-head">
            <h2>Guardian authorization & enrollment</h2>
          </div>
          <Table
            rows={search(
              data.guardians.map((g) => ({
                ...g,
                name: userName(data, g.user_id),
                child_name: childName(data, g.child_id),
              })),
              query,
            )}
            columns={[
              {
                key: "name",
                title: "Guardian",
                render: (r) => <Person name={r.name} sub={r.relationship} />,
              },
              { key: "child_name", title: "Child" },
              {
                key: "pickup_authorized",
                title: "Pickup permission",
                render: (r) => (
                  <Badge value={r.pickup_authorized ? "approved" : "pending"} />
                ),
              },
              {
                key: "enrolled",
                title: "Biometric record",
                render: (r) => (
                  <Badge value={r.enrolled ? "enrolled" : "not_enrolled"} />
                ),
              },
            ]}
          />
        </Card>
        <Card className="">
          <h2>Verification history</h2>
          <Table
            rows={search(
              data.verifications.map((v) => ({
                ...v,
                child_name: childName(data, v.child_id),
                name: userName(data, v.guardian_user_id),
              })),
              query,
            )}
            columns={[
              { key: "child_name", title: "Child" },
              { key: "name", title: "Adult guardian" },
              { key: "method", title: "Method" },
              {
                key: "result",
                title: "Result",
                render: (r) => <Badge value={r.result} />,
              },
              {
                key: "verified_at",
                title: "Time",
                render: (r) =>
                  localDay(r.verified_at) + " · " + localTime(r.verified_at),
              },
            ]}
          />
        </Card>
      </>
    );
  if (page === "events")
    return (
      <Card>
        <div className="p-card-head">
          <div>
            <h2>Moments to look forward to</h2>
            <p>Daycare events, meetings and closures</p>
          </div>
          <Button icon="plus" onClick={() => open("event")}>
            Create event
          </Button>
        </div>
        <Table
          rows={search(data.events, query)}
          columns={[
            { key: "title", title: "Event" },
            {
              key: "event_date",
              title: "Date",
              render: (r) => dayOf(r.event_date),
            },
            {
              key: "event_time",
              title: "Time",
              render: (r) => r.event_time?.slice(0, 5) || "All day",
            },
            { key: "event_type", title: "Type" },
            {
              key: "cancelled",
              title: "Status",
              render: (r) => (
                <Badge value={r.cancelled ? "cancelled" : "scheduled"} />
              ),
            },
            {
              key: "actions",
              title: "Manage",
              render: (r) => (
                <Button variant="quiet" onClick={() => open("event", r)}>
                  Edit
                </Button>
              ),
            },
          ]}
        />
      </Card>
    );
  if (page === "communication")
    return (
      <>
        <Card>
          <div className="p-card-head">
            <div>
              <h2>Keep your community connected</h2>
              <p>Announcements for families and caregivers</p>
            </div>
            <Button icon="plus" onClick={() => open("announcement")}>
              New announcement
            </Button>
          </div>
          {search(data.announcements, query).map((a) => (
            <div key={a.id} className="p-attention">
              <span className="p-icon-tile">
                <Icon name="message" />
              </span>
              <div>
                <strong>{a.title}</strong>
                <p>{a.body}</p>
                <Badge
                  value={
                    a.audience === "group"
                      ? groupName(data, a.target_group_id)
                      : "All families & staff"
                  }
                />
              </div>
            </div>
          ))}
          {!data.announcements.length && <Empty />}
        </Card>
        <Card>
          <div className="p-card-head">
            <div>
              <h2>Your messages</h2>
              <p>Conversations sent to or from your account</p>
            </div>
            <Button icon="message" onClick={() => open("message")}>
              Write message
            </Button>
          </div>
          <Table
            rows={search(
              data.messages.map((m) => ({
                ...m,
                from: userName(data, m.sender_id),
              })),
              query,
            )}
            columns={[
              { key: "from", title: "From" },
              { key: "subject", title: "Subject" },
              {
                key: "read_at",
                title: "State",
                render: (r) => <Badge value={r.read_at ? "read" : "unread"} />,
              },
              {
                key: "actions",
                title: "Message",
                render: (r) => (
                  <Button
                    variant="quiet"
                    onClick={() => open("message-detail", r)}
                  >
                    Read
                  </Button>
                ),
              },
            ]}
          />
        </Card>
      </>
    );
  if (page === "store")
    return (
      <Card>
        <div className="p-card-head">
          <div>
            <h2>Daycare essentials</h2>
            <p>Products, availability and stock</p>
          </div>
          <Button icon="plus" onClick={() => open("product")}>
            Add product
          </Button>
        </div>
        <Table
          rows={search(data.products, query)}
          columns={[
            { key: "name", title: "Product" },
            { key: "price", title: "Price", render: (r) => money(r.price) },
            {
              key: "stock_qty",
              title: "Stock",
              render: (r) => (
                <Badge
                  value={r.stock_qty + " in stock"}
                  tone={r.stock_qty <= 5 ? "gold" : "green"}
                />
              ),
            },
            {
              key: "available",
              title: "Availability",
              render: (r) => (
                <Badge value={r.available ? "available" : "unavailable"} />
              ),
            },
            {
              key: "actions",
              title: "Manage",
              render: (r) => (
                <Button variant="quiet" onClick={() => open("product", r)}>
                  Edit
                </Button>
              ),
            },
          ]}
        />
      </Card>
    );
  if (page === "orders")
    return (
      <Card>
        <div className="p-card-head">
          <div>
            <h2>Orders & payments</h2>
            <p>Fulfillment and payment are tracked separately.</p>
          </div>
        </div>
        <Table
          rows={search(
            data.orders.map((o) => ({
              ...o,
              name: userName(data, o.parent_id),
            })),
            query,
          )}
          columns={[
            { key: "id", title: "Order", render: (r) => "#ANK-" + r.id },
            {
              key: "name",
              title: "Parent",
              render: (r) => <Person name={r.name} />,
            },
            { key: "total", title: "Total", render: (r) => money(r.total) },
            {
              key: "order_status",
              title: "Fulfillment",
              render: (r) => <Badge value={r.order_status} />,
            },
            {
              key: "payment_status",
              title: "Payment",
              render: (r) => <Badge value={r.payment_status} />,
            },
            {
              key: "actions",
              title: "Manage",
              render: (r) => (
                <Button variant="quiet" onClick={() => open("order", r)}>
                  Update status
                </Button>
              ),
            },
          ]}
        />
      </Card>
    );
  if (page === "audit")
    return (
      <Card>
        <div className="p-card-head">
          <div>
            <h2>Accountability, in one place</h2>
            <p>Latest 200 recorded actions. Search by action or actor.</p>
          </div>
        </div>
        <Table
          rows={search(
            data.audit.map((a) => ({ ...a, name: userName(data, a.actor_id) })),
            query,
          )}
          columns={[
            {
              key: "created_at",
              title: "When",
              render: (r) =>
                localDay(r.created_at) + " · " + localTime(r.created_at),
            },
            { key: "name", title: "Actor" },
            {
              key: "action",
              title: "Action",
              render: (r) => label(r.action.toLowerCase()),
            },
            {
              key: "target_table",
              title: "Record",
              render: (r) =>
                label(r.target_table) + " #" + (r.target_id || "—"),
            },
          ]}
        />
      </Card>
    );
  return (
    <Empty
      title="Page unavailable"
      text="Choose a section from the navigation."
    />
  );
}
