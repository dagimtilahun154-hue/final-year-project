import React, { useEffect, useMemo, useRef, useState } from "react";
import "./portal.css";
import {
  Dataset,
  Row,
  allowedDuty,
  attendanceStatus,
  dayOf,
  dutyError,
  metrics,
  label,
  localDay,
  makePreview,
  emptyDataset,
  today,
} from "./model";
import { portalApi, apiError } from "./api";
import {
  Analytics,
  Attendance,
  Children,
  Duties,
  Groups,
  Monitoring,
  Overview,
  PageContext,
  Registry,
  Reports,
  childName,
  userName,
} from "./pages.web";
import {
  Badge,
  Button,
  Card,
  FieldSpec,
  Icon,
  Modal,
  Person,
  RecordForm,
  downloadRecords,
} from "./ui.web";
const logo = require("../../design/figma-exports/ankelba-symbol.png");
const nav = [
  {
    group: "YOUR DAYCARE",
    items: [
      ["dashboard", "Overview", "home"],
      ["analytics", "Analytics", "chart"],
      ["children", "Children & enrollment", "child"],
      ["users", "Caregivers & parents", "people"],
      ["groups", "Groups & classrooms", "leaf"],
    ],
  },
  {
    group: "DAILY CARE",
    items: [
      ["front-desk", "Front-desk duties", "desk"],
      ["attendance", "Attendance & pickups", "check"],
      ["reports", "Daily reports", "file"],
      ["health", "Health & incidents", "heart"],
      ["biometric", "Guardian verification", "shield"],
    ],
  },
  {
    group: "COMMUNITY",
    items: [
      ["communication", "Communication", "message"],
      ["events", "Events & calendar", "calendar"],
      ["store", "Products & stock", "store"],
      ["orders", "Orders & payments", "file"],
      ["audit", "Audit history", "audit"],
    ],
  },
];
const subtitles: Record<string, string> = {
  dashboard: "A thoughtful overview of your daycare, all in one place.",
  analytics: "Understand the patterns behind each day of care.",
  children: "Every child, their family and the people caring for them.",
  users: "Personal accounts for the people in your daycare community.",
  groups: "A little organization. More room to grow.",
  "front-desk":
    "Plan coverage and give each caregiver the right responsibilities.",
  attendance: "Know who is here, who is expected and who has gone home.",
  reports: "Keep every family connected to their child’s day.",
  health: "Stay informed and follow up with care.",
  biometric: "Approved adults. Clear verification. Thoughtful pickup.",
  communication: "Small updates that bring your community together.",
  events: "Make space for the moments that matter.",
  store: "Keep everyday essentials ready for little learners.",
  orders: "Follow each order from placement to daycare collection.",
  audit: "A clear record of who did what, and when.",
  workspace: "Your assigned children and front-desk responsibilities.",
};
const num = (value: any) => (value ? Number(value) : null);
const options = (rows: Row[], key = "name") =>
  rows.map((r) => ({ value: String(r.id), label: r[key] }));
function Brand() {
  return (
    <div className="p-brand">
      <img src={typeof logo === "string" ? logo : logo.uri} alt="Ankelba" />
      <span>
        Ankelba<small>GROWING TOGETHER</small>
      </span>
    </div>
  );
}
export default function Portal() {
  const path = window.location.pathname;
  const preview = __DEV__ && /^\/(admin|staff)\/preview(\/|$)/.test(path);
  const startStaff = path.startsWith("/staff");
  const [actor, setActor] = useState<Row | null>(
    preview
      ? {
          id: startStaff ? 11 : 1,
          name: startStaff ? "Meron Alemu" : "Aster Alemayehu",
          role: startStaff ? "caregiver" : "admin",
        }
      : null,
  );
  const [checking, setChecking] = useState(!preview);
  const [loginError, setLoginError] = useState("");
  const [loginBusy, setLoginBusy] = useState(false);
  const [page, setPage] = useState(
    path.split("/").filter(Boolean).at(-1) || "dashboard",
  );
  const [date, setDate] = useState(today());
  const [query, setQuery] = useState("");
  const [menu, setMenu] = useState(false);
  const [data, setData] = useState<Dataset>(() => preview ? makePreview() : emptyDataset());
  const [loading, setLoading] = useState(!preview);
  const [loadError, setLoadError] = useState("");
  const [toast, setToast] = useState("");
  const [modal, setModal] = useState<{ kind: string; row: Row } | null>(null);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const loadingRequest = useRef(0);
  const staff = actor?.role === "caregiver";
  const base = `/${staff ? "staff" : "admin"}${preview ? "/preview" : ""}`;
  const navigation = staff
    ? [
        {
          group: "YOUR SHIFT",
          items: [["workspace", "Front-desk workspace", "desk"]],
        },
      ]
    : nav;
  const available = navigation.flatMap((g) => g.items).map((i) => i[0]);
  const selected = available.includes(page)
    ? page
    : staff
      ? "workspace"
      : "dashboard";
  const title =
    navigation.flatMap((g) => g.items).find((i) => i[0] === selected)?.[1] ||
    "Overview";
  const go = (next: string) => {
    window.history.pushState({}, "", base + "/" + next);
    setPage(next);
    setQuery("");
    setMenu(false);
  };
  useEffect(() => {
    const change = () => {
      setPage(
        window.location.pathname.split("/").filter(Boolean).at(-1) ||
          "dashboard",
      );
      setQuery("");
      setMenu(false);
    };
    window.addEventListener("popstate", change);
    return () => window.removeEventListener("popstate", change);
  }, []);
  useEffect(() => {
    document.title = actor ? title + " · Ankelba" : "Staff sign in · Ankelba";
  }, [actor, title]);
  useEffect(() => {
    if (preview) return;
    let active = true;
    portalApi
      .session()
      .then((user) => {
        if (active) setActor(user);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setChecking(false);
      });
    return () => {
      active = false;
    };
  }, []);
  const refresh = async () => {
    if (preview || !actor) return;
    const request = ++loadingRequest.current;
    setLoading(true);
    setLoadError("");
    try {
      const snapshot = await portalApi.snapshot(staff ? today() : date, staff);
      if (request === loadingRequest.current) setData(snapshot);
    } catch (error: any) {
      if (request !== loadingRequest.current) return;
      if (error.response?.status === 401) {
        setActor(null);
        setLoginError("Your session has ended. Please sign in again.");
      } else setLoadError(apiError(error));
    } finally {
      if (request === loadingRequest.current) setLoading(false);
    }
  };
  useEffect(() => {
    if (actor && ["admin", "caregiver"].includes(actor.role)) {
      if (!available.includes(page)) go(staff ? "workspace" : "dashboard");
      void refresh();
    }
    return () => {
      loadingRequest.current++;
    };
  }, [actor?.id, date]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 4500);
    return () => clearTimeout(timer);
  }, [toast]);
  const login = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoginBusy(true);
    setLoginError("");
    const values = new FormData(e.currentTarget);
    try {
      const user = await portalApi.login(
        String(values.get("email")).trim(),
        String(values.get("password")),
      );
      if (user.role === "parent") {
        setLoginError(
          "This workspace is for daycare staff. Open the parent app below.",
        );
        return;
      }
      setActor(user);
      setPage(user.role === "caregiver" ? "workspace" : "dashboard");
      window.history.replaceState(
        {},
        "",
        `/${user.role === "caregiver" ? "staff" : "admin"}/${user.role === "caregiver" ? "workspace" : "dashboard"}`,
      );
    } catch (error) {
      setLoginError(apiError(error));
    } finally {
      setLoginBusy(false);
    }
  };
  const signOut = async () => {
    if (preview) {
      window.location.assign("/admin/login");
      return;
    }
    await portalApi.logout().catch(() => {});
    setActor(null);
    setData(emptyDataset());
    setLoading(true);
    window.history.replaceState({}, "", "/admin/login");
  };
  const open = (kind: string, row: Row = { id: 0 }) => {
    setFormError("");
    setModal({ kind, row });
  };
  const close = () => {
    if (!saving) setModal(null);
  };
  const mutate = async (
    path: string,
    body: any,
    apply: (d: Dataset) => Dataset,
    method: "post" | "patch" = "post",
  ) => {
    if (preview) {
      setData((old) => {
        const next = apply(old);
        return {
          ...next,
          audit: [
            {
              id: Date.now(),
              actor_id: actor!.id,
              action: path
                .replace(/^\//, "")
                .replaceAll("/", "_")
                .toUpperCase(),
              target_table: path.split("/")[1],
              target_id: body.id || null,
              created_at: new Date().toISOString(),
            },
            ...next.audit,
          ],
        };
      });
    } else {
      await portalApi.save(path, body, method);
      await refresh();
    }
    setToast(
      preview
        ? "Saved in this preview. No live records changed."
        : "Saved successfully.",
    );
  };
  const upsert = (key: keyof Dataset, row: Row) => (d: Dataset) => ({
    ...d,
    [key]:
      row.id && d[key].some((r) => r.id === row.id)
        ? d[key].map((r) => (r.id === row.id ? { ...r, ...row } : r))
        : [{ ...row, id: row.id || Date.now() }, ...d[key]],
  });
  const save = async (values: Record<string, any>) => {
    if (!modal || saving) return;
    setSaving(true);
    setFormError("");
    const { kind, row } = modal;
    try {
      if (kind === "user") {
        if (!values.name?.trim() || !values.email?.trim())
          throw Error("Name and email are required.");
        if (
          data.users.some(
            (u) =>
              u.id !== row.id &&
              u.email.toLowerCase() === values.email.trim().toLowerCase(),
          )
        )
          throw Error("This email is already registered.");
        if (!preview && !row.id && String(values.password || "").length < 8)
          throw Error("Use a temporary password of at least 8 characters.");
        const body: any = {
          name: values.name.trim(),
          email: values.email.trim().toLowerCase(),
        };
        if (!row.id) {
          body.role = row.role || "caregiver";
          body.password = values.password;
        }
        await mutate(
          "/users" + (row.id ? "/" + row.id : ""),
          body,
          upsert("users", {
            id: row.id,
            name: body.name,
            email: body.email,
            role: row.role || "caregiver",
            status: row.status || "active",
          }),
          row.id ? "patch" : "post",
        );
      } else if (kind === "user-status") {
        const status = row.status === "active" ? "inactive" : "active";
        await mutate(
          "/users/" + row.id + "/status",
          { status },
          upsert("users", { ...row, status }),
          "patch",
        );
      } else if (kind === "child") {
        if (values.dob > today())
          throw Error("Birth date cannot be in the future.");
        const body = {
          full_name: values.full_name.trim(),
          dob: values.dob,
          gender: values.gender,
          group_id: num(values.group_id),
          caregiver_id: num(values.caregiver_id),
          enrollment_status: values.enrollment_status,
        };
        await mutate(
          "/children" + (row.id ? "/" + row.id : ""),
          body,
          upsert("children", { id: row.id, ...body }),
          row.id ? "patch" : "post",
        );
      } else if (kind === "contact" || kind === "instruction") {
        const contact=kind==="contact";
        const body=contact ? {name:values.name.trim(),relationship:values.relationship.trim(),phone:values.phone.trim()} : {category:values.category,instruction_text:values.instruction_text.trim()};
        if(contact&&!/^[+0-9() -]{7,30}$/.test(values.phone.trim()))throw Error("Enter a valid contact phone number.");
        const list=contact?"emergency_contacts":"care_instructions";
        const child=data.children.find(c=>c.id===row.child_id)!;
        const rows=child[list]||[];
        const saved={id:row.id||Date.now(),...body};
        const updated=row.id?rows.map((r:Row)=>r.id===row.id?saved:r):[...rows,saved];
        await mutate("/children/"+(row.id?(contact?"contacts/":"instructions/")+row.id:row.child_id+(contact?"/contacts":"/instructions")),body,upsert("children",{...child,[list]:updated}),row.id?"patch":"post");
      } else if (kind === "guardian") {
        if (
          data.guardians.some(
            (g) => g.child_id === row.id && g.user_id === num(values.user_id),
          )
        )
          throw Error("This guardian is already linked to this child.");
        const body = {
          user_id: num(values.user_id),
          relationship: values.relationship,
          pickup_authorized: !!values.pickup_authorized,
        };
        await mutate(
          "/children/" + row.id + "/guardians",
          body,
          upsert("guardians", { id: 0, child_id: row.id, ...body }),
        );
      } else if (kind === "group") {
        const body = {
          name: values.name.trim(),
          description: values.description || "",
        };
        await mutate(
          "/groups" + (row.id ? "/" + row.id : ""),
          body,
          upsert("groups", { id: row.id, ...body }),
          row.id ? "patch" : "post",
        );
      } else if (kind === "duty") {
        const body = {
          staff_id: Number(values.staff_id),
          group_id: num(values.group_id),
          starts_at: values.date + "T" + values.start + ":00+03:00",
          ends_at: values.date + "T" + values.end + ":00+03:00",
          can_attendance: !!values.can_attendance,
          can_pickup: !!values.can_pickup,
        };
        const error = dutyError(
          data.users.find((u) => u.id === body.staff_id),
          body.starts_at,
          body.ends_at,
          data.duties,
        );
        if (error) throw Error(error);
        if (!body.can_attendance && !body.can_pickup)
          throw Error("Choose at least one responsibility.");
        await mutate(
          "/portal/assignments",
          body,
          upsert("duties", { id: 0, ...body, status: "active" }),
        );
      } else if (kind === "revoke-duty") {
        await mutate(
          "/portal/assignments/" + row.id + "/revoke",
          {},
          upsert("duties", { ...row, status: "revoked" }),
          "patch",
        );
      } else if (kind === "checkin" || kind === "absent") {
        if (attendanceStatus(data, row.id, today()))
          throw Error(
            "Attendance has already changed. Refresh and review this child.",
          );
        if (
          staff &&
          !allowedDuty(data.duties, actor!.id, row.group_id, "attendance")
        )
          throw Error(
            "Your current shift does not permit attendance for this child.",
          );
        const body = {
          child_id: row.id,
          event_type: kind,
          notes: values.notes || "",
        };
        await mutate(
          "/portal/attendance",
          body,
          upsert("attendance", {
            id: 0,
            ...body,
            event_time: new Date().toISOString(),
            recorded_by: actor!.id,
          }),
        );
      } else if (kind === "pickup") {
        if (
          !values.identity_confirmed ||
          !values.reason ||
          values.reason.trim().length < 12
        )
          throw Error(
            "Confirm the identity check and describe how identity was verified (at least 12 characters).",
          );
        if (
          !data.guardians.some(
            (g) =>
              g.child_id === row.id &&
              g.user_id === Number(values.guardian_user_id) &&
              g.pickup_authorized,
          )
        )
          throw Error("Choose an approved pickup guardian.");
        if (attendanceStatus(data, row.id, today())?.event_type !== "checkin")
          throw Error("This child is no longer checked in.");
        if (
          staff &&
          !allowedDuty(data.duties, actor!.id, row.group_id, "pickup")
        )
          throw Error(
            "Your current shift does not permit pickup for this child.",
          );
        const body = {
          child_id: row.id,
          guardian_user_id: Number(values.guardian_user_id),
          method: "manual",
          identity_confirmed: true,
          reason: values.reason.trim(),
        };
        await mutate("/portal/checkout", body, (d) => ({
          ...d,
          attendance: [
            {
              id: Date.now(),
              child_id: row.id,
              event_type: "checkout",
              event_time: new Date().toISOString(),
              recorded_by: actor!.id,
            },
            ...d.attendance,
          ],
          verifications: [
            {
              id: Date.now(),
              ...body,
              result: "manual_fallback",
              verified_by: actor!.id,
              verified_at: new Date().toISOString(),
            },
            ...d.verifications,
          ],
        }));
      } else if (kind === "event") {
        const body = {
          title: values.title.trim(),
          event_date: values.event_date,
          event_time: values.event_time || null,
          event_type: values.event_type,
          description: values.description || "",
        };
        await mutate(
          "/events" + (row.id ? "/" + row.id : ""),
          body,
          upsert("events", {
            ...row,
            ...body,
            cancelled: row.cancelled || false,
          }),
          row.id ? "patch" : "post",
        );
      } else if (kind === "announcement") {
        const body = {
          title: values.title.trim(),
          body: values.body,
          announcement_type: values.announcement_type || "general",
          audience: values.target_group_id ? "group" : "all",
          target_group_id: num(values.target_group_id),
        };
        await mutate(
          "/announcements",
          body,
          upsert("announcements", {
            id: 0,
            ...body,
            created_at: new Date().toISOString(),
          }),
        );
      } else if (kind === "message") {
        const body = {
          recipient_id: Number(values.recipient_id),
          subject: values.subject || "",
          body: values.body,
        };
        await mutate(
          "/messages",
          body,
          upsert("messages", {
            id: 0,
            ...body,
            sender_id: actor!.id,
            created_at: new Date().toISOString(),
          }),
        );
      } else if (kind === "product") {
        const body = {
          name: values.name.trim(),
          price: Number(values.price),
          stock_qty: Number(values.stock_qty),
          available: !!values.available,
          description: values.description || "",
        };
        if (
          !Number.isInteger(body.stock_qty) ||
          body.stock_qty < 0 ||
          !Number.isFinite(body.price) ||
          body.price < 0
        )
          throw Error("Enter a valid price and whole-number stock quantity.");
        await mutate(
          "/store/products" + (row.id ? "/" + row.id : ""),
          body,
          upsert("products", { id: row.id, ...body }),
          row.id ? "patch" : "post",
        );
      } else if (kind === "order") {
        const body = { order_status: values.order_status };
        await mutate(
          "/store/orders/" + row.id + "/status",
          body,
          upsert("orders", { ...row, ...body }),
          "patch",
        );
      }
      setModal(null);
    } catch (error: any) {
      setFormError(
        error.response ? apiError(error) : error.message || "Unable to save.",
      );
    } finally {
      setSaving(false);
    }
  };
  const visibleData = useMemo(() => {
    if (!staff || !preview) return data;
    const children = data.children.filter(
      (c) =>
        allowedDuty(data.duties, actor!.id, c.group_id, "attendance") ||
        allowedDuty(data.duties, actor!.id, c.group_id, "pickup"),
    );
    const ids = new Set(children.map((c) => c.id));
    return {
      ...data,
      children,
      guardians: data.guardians.filter((g) => ids.has(g.child_id)),
      attendance: data.attendance.filter((a) => ids.has(a.child_id)),
      duties: data.duties.filter((d) => d.staff_id === actor!.id),
    };
  }, [data, actor, staff, preview]);
  const ctx: PageContext = {
    data: visibleData,
    date,
    query,
    staff,
    actor: actor || { id: 0 },
    preview,
    go,
    open,
  };
  const download = () => { const m=metrics(visibleData,date); downloadRecords([{id:1,date,enrolled:m.total,present:m.present,collected:m.collected,absent:m.absent,not_marked:m.pending,reports_submitted:m.submitted,reports_missing:m.missing}], 'ankelba-summary-'+date+(preview?'-preview':'')); };
  if (checking)
    return (
      <div
        className="ankelba-portal p-login-card"
        style={{ minHeight: "100vh" }}
      >
        <p>Opening your workspace…</p>
      </div>
    );
  if (!actor || !["admin", "caregiver"].includes(actor.role))
    return (
      <div className="ankelba-portal p-login">
        <div className="p-login-story">
          <Brand />
          <span className="p-eyebrow">A LITTLE CLOSER. EVERY DAY.</span>
          <h1>Thoughtful care starts with a connected team.</h1>
          <p>
            Your children, families and caregivers. One calm place to keep
            everything together.
          </p>
          <div className="p-legend">
            <span>
              <i className="p-dot" />
              Care with confidence
            </span>
            <span>
              <i className="p-dot gold" />
              Grow together
            </span>
          </div>
        </div>
        <div className="p-login-card">
          <div>
            <span className="p-eyebrow">DAYCARE WORKSPACE</span>
            <h1>Welcome back.</h1>
            <p>Sign in with your personal staff account.</p>
            <form onSubmit={login}>
              <label>
                Email address
                <input
                  name="email"
                  type="email"
                  autoComplete="username"
                  placeholder="you@daycare.com"
                  required
                />
              </label>
              <label>
                Password
                <input
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="Your password"
                  required
                />
              </label>
              {loginError && (
                <div role="alert" className="p-error">
                  {loginError}
                </div>
              )}
              <Button type="submit" disabled={loginBusy}>
                {loginBusy ? "Signing in…" : "Sign in to your workspace"}
                <Icon name="arrow" size={16} />
              </Button>
            </form>
            <footer>
              <a href="/">Open parent app</a>
              {__DEV__ && (
                <a href="/admin/preview/dashboard">Explore admin preview</a>
              )}
            </footer>
          </div>
        </div>
      </div>
    );
  const pageComponent =
    selected === "dashboard" ? (
      <Overview {...ctx} />
    ) : selected === "analytics" ? (
      <Analytics {...ctx} />
    ) : selected === "users" ? (
      <Registry {...ctx} />
    ) : selected === "children" ? (
      <Children {...ctx} />
    ) : selected === "groups" ? (
      <Groups {...ctx} />
    ) : selected === "front-desk" ? (
      <Duties {...ctx} />
    ) : ["attendance", "workspace"].includes(selected) ? (
      <Attendance {...ctx} />
    ) : selected === "reports" ? (
      <Reports {...ctx} />
    ) : (
      <Monitoring {...ctx} page={selected} />
    );
  return (
    <div className="ankelba-portal">
      <aside
        className={"p-sidebar " + (menu ? "open" : "")}
        aria-label="Workspace navigation"
      >
        <Brand />
        {navigation.map((group) => (
          <div key={group.group}>
            <div className="p-nav-group">{group.group}</div>
            <nav aria-label={group.group}>
              {group.items.map(([key, name, icon]) => (
                <a
                  href={base + "/" + key}
                  key={key}
                  className={"p-nav-link " + (selected === key ? "active" : "")}
                  aria-current={selected === key ? "page" : undefined}
                  onClick={(e) => {
                    e.preventDefault();
                    go(key);
                  }}
                >
                  <Icon name={icon} size={18} />
                  {name}
                </a>
              ))}
            </nav>
          </div>
        ))}
        <div className="p-sidebar-foot">
          <div className="p-care-note">
            <Icon name="leaf" />
            <div>
              Little moments.
              <br />
              <strong>Lasting connections.</strong>
            </div>
          </div>
          <button
            className="p-nav-link"
            style={{ border: 0, width: "100%", background: "transparent" }}
            onClick={signOut}
          >
            <Icon name="logout" size={17} />
            {preview ? "Leave preview" : "Sign out"}
          </button>
        </div>
      </aside>
      <main className="p-workspace">
        <header className="p-topbar">
          <button
            className="p-icon-button p-menu-toggle"
            aria-label="Toggle navigation"
            aria-expanded={menu}
            onClick={() => setMenu(!menu)}
          >
            <Icon name={menu ? "close" : "menu"} />
          </button>
          <div className="p-breadcrumb">
            Ankelba <span>/</span>{" "}
            <strong>{staff ? "Staff workspace" : "Administration"}</strong>
          </div>
          <div className="p-top-actions">
            {!["dashboard","analytics"].includes(selected) && <label className="p-search">
              <Icon name="search" size={17} />
              <input
                aria-label="Search this page"
                placeholder="Search this page…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>}
            <button
              className="p-icon-button"
              aria-label="Refresh data"
              onClick={() =>
                preview ? setToast("Preview is up to date.") : refresh()
              }
            >
              <Icon name="refresh" size={17} />
            </button>
            <div className="p-admin-person">
              <Person
                name={actor.name}
                sub={staff ? "Caregiver" : "Daycare administrator"}
              />
            </div>
          </div>
        </header>
        <div className="p-content" key={selected}>
          {preview && (
            <div className="p-preview">
              <span>
                <strong>Design preview</strong> · Sample records. Changes stay
                in this tab.
              </span>
              <a
                href={
                  staff
                    ? "/admin/preview/dashboard"
                    : "/staff/preview/workspace"
                }
              >
                {staff ? "Admin preview" : "Staff preview"} ↗
              </a>
            </div>
          )}
          <div className="p-page-head">
            <div>
              <span className="p-eyebrow">
                {selected === "dashboard"
                  ? "WELCOME TO YOUR DAYCARE"
                  : staff
                    ? "FRONT-DESK WORKSPACE"
                    : "CARE, CONNECTED"}
              </span>
              <h1>
                {selected === "dashboard" ? "A good day starts here." : title}
              </h1>
              <p>{subtitles[selected]}</p>
            </div>
            <div className="p-head-actions">
              <input
                aria-label="Selected date"
                type="date"
                value={date}
                disabled={staff}
                onInput={(e) => { if(e.currentTarget.value) setDate(e.currentTarget.value); }}
                onChange={(e) => {
                  if (e.target.value) setDate(e.target.value);
                }}
              />
              {selected === "dashboard" && (
                <Button variant="secondary" icon="download" onClick={download}>
                  Export summary
                </Button>
              )}
              {selected === "dashboard" && (
                <Button icon="plus" onClick={() => open("child")}>
                  Register child
                </Button>
              )}
            </div>
          </div>
          {loadError ? (
            <Card>
              <div role="alert" className="p-error">
                {loadError}
              </div>
              <Button onClick={refresh}>Retry loading</Button>
            </Card>
          ) : loading ? (
            <Card>
              <p role="status">Loading your daycare records…</p>
            </Card>
          ) : (
            <div className="p-grid" style={{ gap: 20 }}>
              {pageComponent}
            </div>
          )}
          <p className="p-kpi-note">
            Ankelba · Connect, share, nurture.{" "}
            <span style={{ float: "right" }}>Times in Africa/Addis_Ababa</span>
          </p>
        </div>
      </main>
      {toast && (
        <div role="status" className="p-toast">
          {toast}
        </div>
      )}
      {modal && (
        <PortalModal
          modal={modal}
          ctx={ctx}
          busy={saving}
          error={formError}
          save={save}
          close={close}
        />
      )}
    </div>
  );
}

function PortalModal({
  modal,
  ctx,
  busy,
  error,
  save,
  close,
}: {
  modal: { kind: string; row: Row };
  ctx: PageContext;
  busy: boolean;
  error: string;
  save: (v: Record<string, any>) => void;
  close: () => void;
}) {
  const { kind, row } = modal;
  const { data, date, preview } = ctx;
  let fields: FieldSpec[] = [];
  let initial: Record<string, any> = { ...row };
  let title = "Review record";
  let submit = preview ? "Save in preview" : "Save changes";
  let detail: React.ReactNode = null;
  const field = (
    key: string,
    label: string,
    type = "text",
    required = true,
    extra: Partial<FieldSpec> = {},
  ): FieldSpec => ({ key, label, type, required, ...extra });
  if (kind === "user") {
    title =
      (row.id ? "Edit " : "Register ") +
      (row.role === "parent" ? "parent / guardian" : "caregiver");
    fields = [
      field("name", "Full name"),
      field("email", "Email address", "email"),
    ];
    if (!row.id && !preview)
      fields.push(
        field("password", "Temporary password", "password", true, {
          wide: true,
          hint: "At least 8 characters. Share securely with the account owner.",
        }),
      );
  } else if (kind === "child") {
    title = row.id ? "Edit child profile" : "Register a child";
    initial = {
      gender: "female",
      enrollment_status: "active",
      ...row,
      dob: dayOf(row.dob),
    };
    fields = [
      field("full_name", "Child’s full name"),
      field("dob", "Date of birth", "date", true, { max: today() }),
      field("gender", "Gender", "select", true, {
        options: ["female", "male", "other"].map((v) => ({
          value: v,
          label: label(v),
        })),
      }),
      field("enrollment_status", "Enrollment", "select", true, {
        options: ["active", "waitlist", "inactive"].map((v) => ({
          value: v,
          label: label(v),
        })),
      }),
      field("group_id", "Group", "select", false, {
        options: options(data.groups),
      }),
      field("caregiver_id", "Assigned caregiver", "select", false, {
        options: options(
          data.users.filter(
            (u) => u.role === "caregiver" && u.status === "active",
          ),
        ),
      }),
    ];
    detail = (
      <div className="p-notice">
        Register the child first, then link their parents and approved pickup
        guardians from the children list.
      </div>
    );
  } else if (kind === "child-profile") {
    return <Modal title={row.full_name + " · profile"} onClose={close}>
      <Person name={row.full_name} sub={"Born "+dayOf(row.dob)+" · "+label(row.enrollment_status)} />
      <section className="p-profile-section"><h3>Family & pickup</h3>
        {data.guardians.filter(g=>g.child_id===row.id).map(g=><div className="p-profile-row" key={g.id}><Person name={userName(data,g.user_id)} sub={g.relationship}/><Badge value={g.pickup_authorized?"Approved":"Not authorized"}/></div>)}
        {!data.guardians.some(g=>g.child_id===row.id)&&<p>No linked guardians yet.</p>}
        <Button variant="secondary" onClick={()=>ctx.open("guardian",row)}>Link guardian</Button>
      </section>
      <section className="p-profile-section"><div className="p-card-head"><h3>Emergency contacts</h3><Button variant="secondary" icon="plus" onClick={()=>ctx.open("contact",{id:0,child_id:row.id})}>Add contact</Button></div>
        {(row.emergency_contacts||[]).map((c:Row)=><div className="p-profile-row" key={c.id}><Person name={c.name} sub={c.relationship+" · "+c.phone}/><Button variant="quiet" onClick={()=>ctx.open("contact",{...c,child_id:row.id})}>Edit</Button></div>)}
        {!row.emergency_contacts?.length&&<p>No emergency contacts recorded.</p>}
      </section>
      <section className="p-profile-section"><div className="p-card-head"><h3>Care instructions</h3><Button variant="secondary" icon="plus" onClick={()=>ctx.open("instruction",{id:0,child_id:row.id})}>Add instruction</Button></div>
        {(row.care_instructions||[]).map((c:Row)=><div className="p-profile-row" key={c.id}><div><Badge value={c.category}/><p>{c.instruction_text}</p></div><Button variant="quiet" onClick={()=>ctx.open("instruction",{...c,child_id:row.id})}>Edit</Button></div>)}
        {!row.care_instructions?.length&&<p>No care instructions recorded.</p>}
      </section>
      <div className="p-dialog-footer"><Button onClick={close}>Done</Button></div>
    </Modal>;
  } else if (kind === "contact") {
    title=row.id?"Edit emergency contact":"Add emergency contact";
    fields=[field("name","Full name"),field("relationship","Relationship"),field("phone","Phone number","tel",true,{wide:true})];
  } else if (kind === "instruction") {
    title=row.id?"Edit care instruction":"Add care instruction";
    fields=[field("category","Category","select",true,{wide:true,options:["allergy","dietary","medical_note","general"].map(value=>({value,label:label(value)}))}),field("instruction_text","Instruction","textarea",true,{wide:true})];
  } else if (kind === "guardian") {
    title = "Link guardian to " + row.full_name;
    initial = { pickup_authorized: false };
    fields = [
      field("user_id", "Registered parent / guardian", "select", true, {
        wide: true,
        options: options(
          data.users.filter(
            (u) => u.role === "parent" && u.status === "active",
          ),
        ),
      }),
      field("relationship", "Relationship"),
      field(
        "pickup_authorized",
        "Authorize this adult for pickup",
        "checkbox",
        false,
      ),
    ];
    detail = (
      <div className="p-notice">
        A linked account can access this child’s information. Pickup
        authorization is a separate permission.
      </div>
    );
  } else if (kind === "group") {
    title = row.id ? "Edit group" : "Create a group";
    fields = [
      field("name", "Group name", "text", true, { wide: true }),
      field("description", "Description", "textarea", false, { wide: true }),
    ];
  } else if (kind === "duty") {
    title = "Assign front-desk duty";
    initial = {
      date,
      start: "07:00",
      end: "13:00",
      can_attendance: true,
      can_pickup: false,
    };
    fields = [
      field("staff_id", "Caregiver", "select", true, {
        options: options(
          data.users.filter(
            (u) => u.role === "caregiver" && u.status === "active",
          ),
        ),
      }),
      field("date", "Duty date", "date"),
      field("start", "Start time · Addis Ababa", "time"),
      field("end", "End time · Addis Ababa", "time"),
      field("group_id", "Group scope", "select", false, {
        wide: true,
        options: options(data.groups),
        hint: "Leave unselected for all daycare groups.",
      }),
      field("can_attendance", "Record attendance", "checkbox", false),
      field("can_pickup", "Verify and complete pickups", "checkbox", false),
    ];
  } else if (["user-status", "revoke-duty"].includes(kind)) {
    title =
      kind === "user-status"
        ? (row.status === "active" ? "Deactivate" : "Activate") + " " + row.name
        : "Revoke front-desk duty";
    detail = (
      <div className="p-notice">
        {kind === "user-status"
          ? "The account’s access will reflect the new status. Existing records stay available."
          : "This staff member will lose this assignment’s attendance and pickup permissions."}
      </div>
    );
    submit = preview ? "Confirm in preview" : "Confirm change";
  } else if (kind === "checkin" || kind === "absent") {
    title =
      (kind === "checkin" ? "Check in " : "Mark absent: ") + row.full_name;
    fields = [
      field("notes", "Note (optional)", "textarea", false, { wide: true }),
    ];
    detail = (
      <div className="p-notice">
        Attendance is recorded for today under your staff account.
      </div>
    );
    submit = preview ? "Record in preview" : "Record attendance";
  } else if (kind === "pickup") {
    title = "Verify pickup · " + row.full_name;
    initial = { identity_confirmed: false };
    const guardians = data.guardians.filter(
      (g) =>
        g.child_id === row.id &&
        g.pickup_authorized &&
        data.users.some((u) => u.id === g.user_id && u.status === "active"),
    );
    fields = [
      field(
        "guardian_user_id",
        "Approved adult collecting this child",
        "select",
        true,
        {
          wide: true,
          options: guardians.map((g) => ({
            value: String(g.user_id),
            label: userName(data, g.user_id) + " · " + g.relationship,
          })),
        },
      ),
      field("reason", "Manual identity check performed", "textarea", true, {
        wide: true,
        hint: "Record the check and why manual verification is used. Do not enter an ID document number.",
      }),
      field(
        "identity_confirmed",
        "I checked this adult’s identity and pickup authorization",
        "checkbox",
        false,
        { wide: true },
      ),
    ];
    detail = (
      <>
        <div className="p-pickup-step">
          <span>
            <Icon name="check" size={17} />
          </span>
          <div>
            <strong>Child selected</strong>
            <p>{row.full_name} · Currently at daycare</p>
          </div>
        </div>
        <div className="p-pickup-step pending">
          <span>
            <Icon name="shield" size={17} />
          </span>
          <div>
            <strong>Verify the adult, then confirm release</strong>
            <p>
              Biometric device connection is pending. The manual check and
              checkout are recorded together.
            </p>
          </div>
        </div>
      </>
    );
    submit = preview
      ? "Preview verified checkout"
      : "Verify & complete checkout";
  } else if (kind === "event") {
    title = row.id ? "Edit daycare event" : "Create daycare event";
    initial = {
      event_type: "activity_day",
      ...row,
      event_date: dayOf(row.event_date) || date,
    };
    fields = [
      field("title", "Title", "text", true, { wide: true }),
      field("event_date", "Date", "date"),
      field("event_time", "Time", "time", false),
      field("event_type", "Type", "select", true, {
        wide: true,
        options: [
          "meeting",
          "holiday",
          "activity_day",
          "special_program",
          "closing_date",
        ].map((v) => ({ value: v, label: label(v) })),
      }),
      field("description", "Description", "textarea", false, { wide: true }),
    ];
  } else if (kind === "announcement") {
    title = "New announcement";
    initial = { announcement_type: "general" };
    fields = [
      field("title", "Title", "text", true, { wide: true }),
      field("body", "Message", "textarea", true, { wide: true }),
      field("announcement_type", "Category", "select", true, {
        options: ["general", "alert", "meal_plan"].map((v) => ({
          value: v,
          label: label(v),
        })),
      }),
      field("target_group_id", "Group audience", "select", false, {
        options: options(data.groups),
        hint: "Leave unselected to publish to all families and staff.",
      }),
    ];
    submit = preview ? "Publish in preview" : "Publish announcement";
  } else if (kind === "message") {
    title = "Write a message";
    fields = [
      field("recipient_id", "Recipient", "select", true, {
        wide: true,
        options: options(
          data.users.filter(
            (u) => u.id !== ctx.actor.id && u.status === "active",
          ),
        ),
      }),
      field("subject", "Subject", "text", false, { wide: true }),
      field("body", "Message", "textarea", true, { wide: true }),
    ];
    submit = preview ? "Send in preview" : "Send message";
  } else if (kind === "product") {
    title = row.id ? "Edit product" : "Add daycare product";
    initial = { available: true, stock_qty: 0, ...row };
    fields = [
      field("name", "Product name", "text", true, { wide: true }),
      field("price", "Price (ETB)", "number", true, { min: "0" }),
      field("stock_qty", "Stock quantity", "number", true, { min: "0" }),
      field("available", "Available in the store", "checkbox", false, {
        wide: true,
      }),
      field("description", "Description", "textarea", false, { wide: true }),
    ];
  } else if (kind === "order") {
    title = "Update order #ANK-" + row.id;
    fields = [
      field("order_status", "Fulfillment status", "select", true, {
        wide: true,
        options: [
          "placed",
          "confirmed",
          "ready_for_pickup",
          "collected",
          "cancelled",
        ].map((v) => ({ value: v, label: label(v) })),
      }),
    ];
    detail = (
      <div className="p-notice">
        Payment: <Badge value={row.payment_status} /> Payment verification is
        handled separately.
      </div>
    );
  } else {
    title =
      kind === "report-detail"
        ? "Daily report"
        : kind === "health-detail"
          ? "Health / incident record"
          : kind === "message-detail"
            ? "Message"
            : "Attendance history";
    const lines =
      kind === "report-detail"
        ? {
            Child: childName(data, row.child_id),
            Caregiver: userName(data, row.caregiver_id),
            Date: dayOf(row.report_date),
            Mood: label(row.mood),
            "Sleep (minutes)": row.sleep_duration_min,
            Observations:
              row.general_observations || "No observations recorded",
          }
        : kind === "health-detail"
          ? {
              Child: childName(data, row.child_id),
              Type: row.record_type,
              Severity: row.severity,
              Description: row.description,
              "Parent informed": row.parent_notified ? "Yes" : "Pending",
            }
          : kind === "message-detail"
            ? {
                From: userName(data, row.sender_id),
                Subject: row.subject || "No subject",
                Message: row.body,
              }
            : {
                Child: row.full_name,
                History: data.attendance
                  .filter((a) => a.child_id === row.id)
                  .map(
                    (a) => localDay(a.event_time) + " · " + label(a.event_type),
                  )
                  .slice(0, 30)
                  .join("\n"),
              };
    return (
      <Modal title={title} onClose={close}>
        <div className="p-detail-grid">
          {Object.entries(lines).map(([key, value]) => (
            <div key={key}>
              <small>{key}</small>
              <p>{String(value ?? "—")}</p>
            </div>
          ))}
        </div>
        <div className="p-dialog-footer">
          <Button onClick={close}>Done</Button>
        </div>
      </Modal>
    );
  }
  return (
    <Modal title={title} onClose={close}>
      {detail}
      <RecordForm
        fields={fields}
        initial={initial}
        onSave={save}
        onCancel={close}
        busy={busy}
        error={error}
        submit={submit}
      />
    </Modal>
  );
}
