const { useState, useEffect, useRef } = React;

const PRIORITY = {
  high: { label: "High", color: "#E24B4A", bg: "#FCEBEB", text: "#A32D2D" },
  medium: { label: "Medium", color: "#EF9F27", bg: "#FAEEDA", text: "#854F0B" },
  low: { label: "Low", color: "#639922", bg: "#EAF3DE", text: "#3B6D11" }
};
const THEMES = { purple: "#7F77DD", blue: "#378ADD", teal: "#1D9E75", coral: "#D85A30", pink: "#D4537E" };
const DEFAULT_TAGS = ["Quick", "Errands", "Focus", "Admin", "Personal", "Work"];
const TAG_COLORS = ["#7F77DD","#378ADD","#1D9E75","#D85A30","#D4537E","#BA7517","#639922","#888780"];
const REPEAT_OPTIONS = ["none","daily","weekly","monthly","yearly"];
const FINANCE_EMOJIS = ["🍔","🛒","✈️","🚗","⛽","🏠","💡","📱","🎉","🎬","☕","🏋️","💊","👕","🎁","📚","🐾","💰","💷","🏥"];
// Default budget groups for a NEW account — generic starter template only.
// (No personal names or amounts; users rename / add / remove items in the Plan tab.)
const DEFAULT_FINANCE_CATS = [
  { id: "g_housing", name: "Housing", emoji: "🏠", color: "#7F77DD", kind: "spending", items: [
    { id: "i_rent", name: "Rent or mortgage" }, { id: "i_utilities", name: "Utilities" } ] },
  { id: "g_transport", name: "Transportation", emoji: "🚗", color: "#378ADD", kind: "spending", items: [
    { id: "i_fuel", name: "Fuel / transport" } ] },
  { id: "g_food", name: "Food", emoji: "🍔", color: "#D85A30", kind: "spending", items: [
    { id: "i_groceries", name: "Groceries" }, { id: "i_dining", name: "Dining out" } ] },
  { id: "g_ent", name: "Entertainment", emoji: "🎉", color: "#D4537E", kind: "spending", items: [
    { id: "i_subscriptions", name: "Subscriptions" }, { id: "i_daysout", name: "Days out" } ] },
  { id: "g_personal", name: "Personal Care", emoji: "🧴", color: "#1D9E75", kind: "spending", items: [
    { id: "i_phone", name: "Phone" }, { id: "i_health", name: "Health & grooming" } ] },
  { id: "g_loans", name: "Loans", emoji: "💳", color: "#BA7517", kind: "spending", items: [
    { id: "i_loan", name: "Loan repayment" } ] },
  { id: "g_gifts", name: "Gifts", emoji: "🎁", color: "#BA7517", kind: "spending", items: [
    { id: "i_gifts", name: "General gifts" } ] }
];
const RELATIONSHIPS = ["Partner", "Family", "Friend", "Colleague", "Other"];
const DATE_TYPES = [
  { v: "birthday", l: "Birthday", icon: "🎂" },
  { v: "anniversary", l: "Anniversary", icon: "💍" },
  { v: "event", l: "Event", icon: "🎉" },
  { v: "reminder", l: "Reminder", icon: "🔔" }
];
const VIEWS = ["home","today","important-dates","people","docs","finance","settings"];
const VIEW_META = {
  home: { icon: "🏠", label: "Home" },
  today: { icon: "☀️", label: "Tasks" },
  "important-dates": { icon: "🎂", label: "Important Dates" },
  people: { icon: "🎁", label: "People" },
  docs: { icon: "🗂", label: "Documents & Policies" },
  finance: { icon: "💵", label: "Finance" },
  settings: { icon: "⚙️", label: "Settings" }
};

function genId() { return Math.random().toString(36).slice(2, 10); }
function todayStr() { return new Date().toISOString().slice(0, 10); }
function fmtDate(d) { if (!d) return ""; return new Date(d + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }); }
function fmtShort(d) { if (!d) return ""; return new Date(d + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" }); }
// Ordinal suffix for a day-of-month (1 → "1st", 22 → "22nd"). Used for the longer date styles.
function ord(n) { const v = n % 100; const s = ["th", "st", "nd", "rd"]; return n + (s[(v - 20) % 10] || s[v] || s[0]); }
// "Thursday 12th June 2026" — accepts a Date or a "YYYY-MM-DD" string.
function fmtLongDate(d) { const x = d instanceof Date ? d : (d ? new Date(d + "T00:00:00") : new Date()); return x.toLocaleDateString("en-GB", { weekday: "long" }) + " " + ord(x.getDate()) + " " + x.toLocaleDateString("en-GB", { month: "long", year: "numeric" }); }
// "29th May" — day with ordinal + full month, for pay-period ranges.
function fmtDM(d) { if (!d) return ""; const x = new Date(d + "T00:00:00"); return ord(x.getDate()) + " " + x.toLocaleDateString("en-GB", { month: "long" }); }
// 24-hour clock, e.g. "14:05".
function fmtTime24(d) { return (d instanceof Date ? d : new Date()).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false }); }
function daysUntil(d) { if (!d) return null; return Math.round((new Date(d + "T00:00:00") - new Date(new Date().toDateString())) / 86400000); }
function getDaysInMonth(y, m) { return new Date(y, m + 1, 0).getDate(); }
function getFirstDayOfMonth(y, m) { return new Date(y, m, 1).getDay(); }

const INIT = { tasks: [], groups: [{ id: "g1", name: "Work", emoji: "💼", color: "#378ADD" }, { id: "g2", name: "Personal", emoji: "🏠", color: "#1D9E75" }], importantDates: [], tags: DEFAULT_TAGS.map((t, i) => ({ id: genId(), name: t, color: TAG_COLORS[i % TAG_COLORS.length] })), financeCategories: DEFAULT_FINANCE_CATS, financePlans: {}, transactions: [], savingsAccounts: [], subscriptions: [], debts: [], netWorthHistory: {}, safetyBuffer: 0, investments: [], pension: {}, insurance: [], cashFlow: {}, currentAccounts: [], pensions: [], payday: { type: "monthly", day: 1 }, monthlyReports: {}, audit: {}, people: [], warranties: [], risks: [], dismissedSubs: [], name: "", theme: "purple", mode: "system", streak: 0 };

// Cloud-backed state. Loads the signed-in user's blob from Supabase, merges over
// INIT defaults, and saves changes back (debounced). Falls back to a local cache
// so the app still opens if briefly offline.
function useAppState(user) {
  const uid = user && user.id;
  const seed = () => {
    const c = uid && window.TendCloud && window.TendCloud.cacheGet(uid);
    return c && c.data ? { ...INIT, ...c.data } : INIT;
  };
  const [state, setState] = useState(seed);
  const [loaded, setLoaded] = useState(false);
  const [calendarToken, setCalendarToken] = useState(
    (uid && window.TendCloud && (window.TendCloud.cacheGet(uid) || {}).calendarToken) || ""
  );
  const saveTimer = useRef(null);
  const dirty = useRef(false);

  // Load this user's state whenever they log in.
  useEffect(() => {
    let alive = true;
    if (!user || !window.TendCloud) { setLoaded(true); return; }
    setLoaded(false);
    window.TendCloud.load().then((res) => {
      if (!alive || !res) { setLoaded(true); return; }
      setState({ ...INIT, ...(res.data || {}) });
      setCalendarToken(res.calendarToken || "");
      setLoaded(true);
    });
    return () => { alive = false; };
  }, [user && user.id]);

  // Debounced save on change (only after initial load, only when logged in).
  useEffect(() => {
    if (!loaded || !user || !dirty.current) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      window.TendCloud.save(state);
      dirty.current = false;
    }, 600);
    return () => saveTimer.current && clearTimeout(saveTimer.current);
  }, [state, loaded, user && user.id]);

  const up = (patch) => {
    dirty.current = true;
    setState((prev) => ({ ...prev, ...patch }));
  };
  return [state, up, { loaded, calendarToken }];
}

const accent = (theme) => THEMES[theme] || THEMES.purple;
const hex2rgba = (hex, a) => { const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16); return `rgba(${r},${g},${b},${a})`; };

// ── UI Atoms ──────────────────────────────────────────────────────────────────

function Badge({ color, bg, text, children }) {
  return <span style={{ background: bg, color: text, fontSize: 11, padding: "2px 8px", borderRadius: 20, fontWeight: 500, whiteSpace: "nowrap" }}>{children}</span>;
}

function PriBadge({ p }) {
  const pr = PRIORITY[p] || PRIORITY.low;
  return <Badge bg={pr.bg} text={pr.text}>{pr.label}</Badge>;
}

function TagChip({ tag, onRemove }) {
  if (!tag) return null;
  return (
    <span style={{ background: hex2rgba(tag.color, 0.12), color: tag.color, fontSize: 11, padding: "2px 9px", borderRadius: 20, display: "inline-flex", alignItems: "center", gap: 4, fontWeight: 500 }}>
      {tag.name}
      {onRemove && <span onClick={onRemove} style={{ cursor: "pointer", fontSize: 14, lineHeight: 1, opacity: 0.7 }}>×</span>}
    </span>
  );
}

function Pill({ active, color, onClick, children }) {
  return (
    <button onClick={onClick} style={{ background: active ? hex2rgba(color, 0.12) : "var(--color-background-secondary)", color: active ? color : "var(--color-text-secondary)", border: `1.5px solid ${active ? color : "transparent"}`, borderRadius: 20, padding: "4px 13px", fontSize: 12, fontWeight: active ? 500 : 400, cursor: "pointer", transition: "all 0.15s" }}>
      {children}
    </button>
  );
}

function Modal({ onClose, children, width = 480 }) {
  return (
    <div onClick={e => e.target === e.currentTarget && onClose()} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 }}>
      <div style={{ background: "var(--color-background-primary)", borderRadius: 18, padding: 28, width: "100%", maxWidth: width, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 24px 64px rgba(0,0,0,0.2)" }}>
        {children}
      </div>
    </div>
  );
}

function ModalHeader({ title, onClose }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
      <h2 style={{ margin: 0, fontSize: 17, fontWeight: 500 }}>{title}</h2>
      <button onClick={onClose} style={{ background: "var(--color-background-secondary)", border: "none", borderRadius: "50%", width: 30, height: 30, cursor: "pointer", fontSize: 16, color: "var(--color-text-secondary)", display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--color-text-secondary)", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</label>
      {children}
    </div>
  );
}

function Divider() { return <div style={{ height: "0.5px", background: "var(--color-border-tertiary)", margin: "18px 0" }} />; }

// ── Task Modal ────────────────────────────────────────────────────────────────

function TaskModal({ task, groups, tags, financeCats, accentColor, onSave, onClose }) {
  const defaults = { title: "", priority: "medium", groupId: "", deadline: "", scheduledDate: "", notes: "", tags: [], subtasks: [], someday: false, repeat: "none", duration: "", cost: "", costCategory: "", done: false };
  const [t, setT] = useState({ ...defaults, ...(task || {}) });
  const [newSub, setNewSub] = useState("");
  const up = (k, v) => setT(p => ({ ...p, [k]: v }));

  function exportICS() {
    if (!t.deadline) return alert("Set a deadline first.");
    const d = t.deadline.replace(/-/g, "");
    const blob = new Blob([`BEGIN:VCALENDAR\nVERSION:2.0\nBEGIN:VEVENT\nSUMMARY:${t.title}\nDTSTART;VALUE=DATE:${d}\nDTEND;VALUE=DATE:${d}\nEND:VEVENT\nEND:VCALENDAR`], { type: "text/calendar" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `${t.title || "task"}.ics`; a.click();
  }

  return (
    <Modal onClose={onClose} width={520}>
      <ModalHeader title={task?.id ? "Edit task" : "New task"} onClose={onClose} />
      <Field label="Title">
        <input placeholder="What needs to be done?" value={t.title} onChange={e => up("title", e.target.value)} style={{ width: "100%", boxSizing: "border-box", fontSize: 15 }} autoFocus />
      </Field>
      <Field label="Notes">
        <textarea placeholder="Add notes, links or context…" value={t.notes} onChange={e => up("notes", e.target.value)} rows={2} style={{ width: "100%", boxSizing: "border-box", resize: "vertical" }} />
      </Field>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
        <Field label="Priority">
          <div style={{ display: "flex", gap: 6 }}>
            {Object.keys(PRIORITY).map(p => (
              <button key={p} onClick={() => up("priority", p)} style={{ flex: 1, padding: "6px 4px", borderRadius: 8, border: `1.5px solid ${t.priority === p ? PRIORITY[p].color : "var(--color-border-tertiary)"}`, background: t.priority === p ? PRIORITY[p].bg : "transparent", color: t.priority === p ? PRIORITY[p].text : "var(--color-text-secondary)", fontSize: 12, fontWeight: t.priority === p ? 500 : 400, cursor: "pointer" }}>
                {PRIORITY[p].label}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Group">
          <select value={t.groupId || ""} onChange={e => up("groupId", e.target.value)} style={{ width: "100%" }}>
            <option value="">No group</option>
            {groups.map(g => <option key={g.id} value={g.id}>{g.emoji} {g.name}</option>)}
          </select>
        </Field>
        <Field label="Deadline">
          <input type="date" value={t.deadline || ""} onChange={e => up("deadline", e.target.value)} style={{ width: "100%", boxSizing: "border-box" }} />
        </Field>
        <Field label="Scheduled completion date">
          <input type="date" value={t.scheduledDate || ""} onChange={e => up("scheduledDate", e.target.value)} style={{ width: "100%", boxSizing: "border-box" }} />
        </Field>
        <Field label="Duration (min)">
          <input type="number" placeholder="e.g. 30" value={t.duration || ""} onChange={e => up("duration", e.target.value)} style={{ width: "100%", boxSizing: "border-box" }} />
        </Field>
        <Field label="Repeat">
          <select value={t.repeat || "none"} onChange={e => up("repeat", e.target.value)} style={{ width: "100%" }}>
            {REPEAT_OPTIONS.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
          </select>
        </Field>
        <Field label="Cost (£)">
          <input type="number" step="0.01" placeholder="0.00" value={t.cost} onChange={e => up("cost", e.target.value)} style={{ width: "100%", boxSizing: "border-box" }} />
        </Field>
        <Field label="Budget category">
          <select value={t.costCategory || ""} onChange={e => up("costCategory", e.target.value)} style={{ width: "100%" }}>
            <option value="">None</option>
            {(financeCats || []).map(c => <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>)}
          </select>
        </Field>
      </div>
      {parseFloat(t.cost) > 0 && t.costCategory && (
        <div style={{ fontSize: 12, color: accentColor, marginTop: -4, marginBottom: 12 }}>💷 Adds {`£${(parseFloat(t.cost) || 0).toFixed(2)}`} to your budget plan automatically{(t.scheduledDate || t.deadline) ? ` for ${monthLabel((t.scheduledDate || t.deadline).slice(0, 7))}` : ""}.</div>
      )}
      <Field label="Tags">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {tags.map(tag => {
            const sel = t.tags?.includes(tag.id);
            return (
              <button key={tag.id} onClick={() => up("tags", sel ? t.tags.filter(x => x !== tag.id) : [...(t.tags || []), tag.id])} style={{ background: sel ? hex2rgba(tag.color, 0.14) : "var(--color-background-secondary)", color: sel ? tag.color : "var(--color-text-secondary)", border: `1.5px solid ${sel ? tag.color : "transparent"}`, borderRadius: 20, padding: "4px 12px", fontSize: 12, fontWeight: sel ? 500 : 400, cursor: "pointer" }}>
                {tag.name}
              </button>
            );
          })}
        </div>
      </Field>
      <Divider />
      <Field label="Subtasks">
        {(t.subtasks || []).map((s, i) => (
          <div key={s.id} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6, padding: "6px 10px", background: "var(--color-background-secondary)", borderRadius: 8 }}>
            <div onClick={() => up("subtasks", t.subtasks.map((x, j) => j === i ? { ...x, done: !x.done } : x))} style={{ width: 16, height: 16, borderRadius: "50%", border: "2px solid var(--color-border-secondary)", background: s.done ? accentColor : "transparent", cursor: "pointer", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
              {s.done && <span style={{ color: "#fff", fontSize: 9 }}>✓</span>}
            </div>
            <span style={{ flex: 1, fontSize: 13, textDecoration: s.done ? "line-through" : "none", color: s.done ? "var(--color-text-secondary)" : "var(--color-text-primary)" }}>{s.title}</span>
            <button onClick={() => up("subtasks", t.subtasks.filter((_, j) => j !== i))} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-text-secondary)", fontSize: 16 }}>×</button>
          </div>
        ))}
        <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
          <input placeholder="Add a subtask and press Enter…" value={newSub} onChange={e => setNewSub(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && newSub.trim()) { up("subtasks", [...(t.subtasks || []), { id: genId(), title: newSub.trim(), done: false }]); setNewSub(""); } }} style={{ flex: 1, fontSize: 13 }} />
          <button onClick={() => { if (newSub.trim()) { up("subtasks", [...(t.subtasks || []), { id: genId(), title: newSub.trim(), done: false }]); setNewSub(""); } }} style={{ padding: "0 14px" }}>+</button>
        </div>
      </Field>
      <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14, cursor: "pointer", marginTop: 4 }}>
        <input type="checkbox" checked={!!t.someday} onChange={e => up("someday", e.target.checked)} /> 🌂 Rainy day — save for when I have free time
      </label>
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 22 }}>
        {t.deadline && <button onClick={exportICS} style={{ padding: "9px 16px", fontSize: 13, borderRadius: 9 }}>📅 Export .ics</button>}
        <button onClick={onClose} style={{ padding: "9px 16px", fontSize: 13, borderRadius: 9 }}>Cancel</button>
        <button onClick={() => { if (t.title.trim()) onSave({ ...t, id: t.id || genId(), cost: parseFloat(t.cost) || 0 }); }} style={{ padding: "9px 20px", fontSize: 13, background: accentColor, color: "#fff", border: "none", borderRadius: 9, cursor: "pointer", fontWeight: 500 }}>
          {task?.id ? "Save changes" : "Add task"}
        </button>
      </div>
    </Modal>
  );
}

// ── Group Modal ───────────────────────────────────────────────────────────────

function GroupModal({ group, accentColor, onSave, onClose }) {
  const [name, setName] = useState(group?.name || "");
  const [emoji, setEmoji] = useState(group?.emoji || "📁");
  const [color, setColor] = useState(group?.color || "#7F77DD");
  const emojis = ["📁","💼","🏠","🚗","🏋️","🎯","📚","💡","🌍","🛒","❤️","🎉","🔬","🎨","💰","🧠"];
  return (
    <Modal onClose={onClose} width={360}>
      <ModalHeader title={group?.id ? "Edit group" : "New group"} onClose={onClose} />
      <Field label="Name">
        <input placeholder="Group name…" value={name} onChange={e => setName(e.target.value)} style={{ width: "100%", boxSizing: "border-box" }} autoFocus />
      </Field>
      <Field label="Icon">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {emojis.map(e => <span key={e} onClick={() => setEmoji(e)} style={{ fontSize: 22, cursor: "pointer", padding: 6, borderRadius: 8, background: emoji === e ? "var(--color-background-secondary)" : "transparent", border: emoji === e ? "1.5px solid var(--color-border-secondary)" : "1.5px solid transparent" }}>{e}</span>)}
        </div>
      </Field>
      <Field label="Colour">
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {Object.values(THEMES).map(c => <div key={c} onClick={() => setColor(c)} style={{ width: 28, height: 28, borderRadius: "50%", background: c, cursor: "pointer", outline: color === c ? `3px solid ${c}` : "none", outlineOffset: 2 }} />)}
        </div>
      </Field>
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 20 }}>
        <button onClick={onClose} style={{ padding: "9px 16px", borderRadius: 9 }}>Cancel</button>
        <button onClick={() => { if (name.trim()) onSave({ ...group, id: group?.id || genId(), name, emoji, color }); }} style={{ padding: "9px 20px", background: accentColor, color: "#fff", border: "none", borderRadius: 9, cursor: "pointer", fontWeight: 500 }}>Save</button>
      </div>
    </Modal>
  );
}

// ── Important Date Modal ──────────────────────────────────────────────────────

function DateModal({ item, tags, groups, financeCats, accentColor, onSave, onClose }) {
  const [d, setD] = useState(item || { title: "", date: "", type: "birthday", repeatMonths: 12, notes: "", tasks: [], cost: "", costCategory: "" });
  const [newTask, setNewTask] = useState("");
  const up = (k, v) => setD(p => ({ ...p, [k]: v }));

  return (
    <Modal onClose={onClose} width={480}>
      <ModalHeader title={item?.id ? "Edit important date" : "New important date"} onClose={onClose} />
      <Field label="Name / Title">
        <input placeholder="e.g. Mum's Birthday" value={d.title} onChange={e => up("title", e.target.value)} style={{ width: "100%", boxSizing: "border-box" }} autoFocus />
      </Field>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
        <Field label="Type">
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {DATE_TYPES.map(ty => (
              <button key={ty.v} onClick={() => up("type", ty.v)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", borderRadius: 8, border: `1.5px solid ${d.type === ty.v ? accentColor : "var(--color-border-tertiary)"}`, background: d.type === ty.v ? hex2rgba(accentColor, 0.08) : "transparent", color: d.type === ty.v ? accentColor : "var(--color-text-primary)", fontSize: 13, cursor: "pointer", fontWeight: d.type === ty.v ? 500 : 400, textAlign: "left" }}>
                <span>{ty.icon}</span>{ty.l}
              </button>
            ))}
          </div>
        </Field>
        <div>
          <Field label="Date">
            <input type="date" value={d.date} onChange={e => up("date", e.target.value)} style={{ width: "100%", boxSizing: "border-box" }} />
          </Field>
          <Field label="Repeats">
            <select value={d.repeatMonths || 12} onChange={e => up("repeatMonths", parseInt(e.target.value, 10))} style={{ width: "100%" }}>
              {REPEAT_MONTH_OPTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </Field>
          <Field label="Notes">
            <textarea placeholder="Add a note…" value={d.notes} onChange={e => up("notes", e.target.value)} rows={2} style={{ width: "100%", boxSizing: "border-box", resize: "vertical" }} />
          </Field>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 4 }}>
        <Field label="Cost (£)">
          <input type="number" step="0.01" placeholder="0.00" value={d.cost} onChange={e => up("cost", e.target.value)} style={{ width: "100%", boxSizing: "border-box" }} />
        </Field>
        <Field label="Budget category">
          <select value={d.costCategory || ""} onChange={e => up("costCategory", e.target.value)} style={{ width: "100%" }}>
            <option value="">None</option>
            {(financeCats || []).map(c => <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>)}
          </select>
        </Field>
      </div>
      {parseFloat(d.cost) > 0 && d.costCategory && (
        <div style={{ fontSize: 12, color: accentColor, marginBottom: 8 }}>💷 Adds {`£${(parseFloat(d.cost) || 0).toFixed(2)}`} to your budget plan automatically each {d.date ? monthLabel(d.date.slice(0, 7)).split(" ")[0] : "year"}.</div>
      )}
      <Divider />
      <Field label="To-dos for this date">
        <p style={{ fontSize: 12, color: "var(--color-text-secondary)", margin: "0 0 8px" }}>Add tasks linked to this occasion — e.g. "Buy birthday card"</p>
        {(d.tasks || []).map((t, i) => (
          <div key={t.id} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6, padding: "7px 10px", background: "var(--color-background-secondary)", borderRadius: 8 }}>
            <div onClick={() => up("tasks", d.tasks.map((x, j) => j === i ? { ...x, done: !x.done } : x))} style={{ width: 16, height: 16, borderRadius: "50%", border: "2px solid var(--color-border-secondary)", background: t.done ? accentColor : "transparent", cursor: "pointer", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
              {t.done && <span style={{ color: "#fff", fontSize: 9 }}>✓</span>}
            </div>
            <span style={{ flex: 1, fontSize: 13, textDecoration: t.done ? "line-through" : "none", color: t.done ? "var(--color-text-secondary)" : "var(--color-text-primary)" }}>{t.title}</span>
            <button onClick={() => up("tasks", d.tasks.filter((_, j) => j !== i))} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-text-secondary)", fontSize: 16 }}>×</button>
          </div>
        ))}
        <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
          <input placeholder="Add a to-do and press Enter…" value={newTask} onChange={e => setNewTask(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && newTask.trim()) { up("tasks", [...(d.tasks || []), { id: genId(), title: newTask.trim(), done: false }]); setNewTask(""); } }} style={{ flex: 1, fontSize: 13 }} />
          <button onClick={() => { if (newTask.trim()) { up("tasks", [...(d.tasks || []), { id: genId(), title: newTask.trim(), done: false }]); setNewTask(""); } }} style={{ padding: "0 14px" }}>+</button>
        </div>
      </Field>
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 20 }}>
        <button onClick={onClose} style={{ padding: "9px 16px", borderRadius: 9 }}>Cancel</button>
        <button onClick={() => { if (d.title && d.date) onSave({ ...d, id: d.id || genId(), repeatMonths: Number(d.repeatMonths) || 12, cost: parseFloat(d.cost) || 0 }); }} style={{ padding: "9px 20px", background: accentColor, color: "#fff", border: "none", borderRadius: 9, cursor: "pointer", fontWeight: 500 }}>
          {item?.id ? "Save changes" : "Add date"}
        </button>
      </div>
    </Modal>
  );
}

// ── Task Row ──────────────────────────────────────────────────────────────────

function TaskRow({ task, tags, groups, onToggle, onEdit, onDelete, onToggleSubtask }) {
  const du = daysUntil(task.deadline);
  const overdue = du !== null && du < 0 && !task.done;
  const grp = groups.find(g => g.id === task.groupId);
  const taskTags = (task.tags || []).map(id => tags.find(t => t.id === id)).filter(Boolean);

  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "11px 14px", borderRadius: 11, background: "var(--color-background-primary)", border: `0.5px solid ${overdue ? "#E24B4A" : "var(--color-border-tertiary)"}`, marginBottom: 6, opacity: task.done ? 0.5 : 1, transition: "opacity 0.2s" }}>
      <div onClick={() => onToggle(task.id)} style={{ width: 20, height: 20, borderRadius: "50%", border: `2px solid ${task.done ? "#639922" : "var(--color-border-secondary)"}`, background: task.done ? "#639922" : "transparent", cursor: "pointer", flexShrink: 0, marginTop: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {task.done && <span style={{ color: "#fff", fontSize: 11 }}>✓</span>}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <span style={{ fontWeight: 500, fontSize: 14, textDecoration: task.done ? "line-through" : "none" }}>{task.title}</span>
          <PriBadge p={task.priority} />
          {taskTags.map(t => <TagChip key={t.id} tag={t} />)}
          {overdue && <Badge bg="#FCEBEB" text="#A32D2D">Overdue</Badge>}
          {task.someday && <Badge bg="#FAEEDA" text="#854F0B">🌂 Rainy day</Badge>}
        </div>
        {task.notes && <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 3, lineHeight: 1.5 }}>{task.notes}</div>}
        <div style={{ display: "flex", gap: 10, marginTop: 5, flexWrap: "wrap" }}>
          {task.deadline && <span title="Deadline" style={{ fontSize: 11, color: overdue ? "#A32D2D" : "var(--color-text-secondary)" }}>⚑ {fmtDate(task.deadline)}</span>}
          {task.scheduledDate && <span title="Scheduled completion date" style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>▷ {fmtDate(task.scheduledDate)}</span>}
          {task.duration && <span style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>⏱ {task.duration}min</span>}
          {grp && <span style={{ fontSize: 11, color: grp.color || "var(--color-text-secondary)", fontWeight: 500 }}>{grp.emoji} {grp.name}</span>}
          {task.repeat && task.repeat !== "none" && <span style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>↻ {task.repeat}</span>}
        </div>
        {task.subtasks?.length > 0 && (
          <div style={{ marginTop: 7, paddingLeft: 10, borderLeft: "2px solid var(--color-border-tertiary)" }}>
            {task.subtasks.map(s => (
              <div key={s.id} onClick={onToggleSubtask ? () => onToggleSubtask(task.id, s.id) : undefined} style={{ fontSize: 12, color: "var(--color-text-secondary)", display: "flex", alignItems: "center", gap: 6, marginBottom: 3, cursor: onToggleSubtask ? "pointer" : "default" }}>
                <span style={{ width: 13, height: 13, border: `1.5px solid ${s.done ? "#639922" : "var(--color-border-secondary)"}`, borderRadius: "50%", background: s.done ? "#639922" : "transparent", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{s.done && <span style={{ color: "#fff", fontSize: 8 }}>✓</span>}</span>
                <span style={{ textDecoration: s.done ? "line-through" : "none" }}>{s.title}</span>
              </div>
            ))}
            <div style={{ fontSize: 11, color: "var(--color-text-secondary)", marginTop: 2 }}>{task.subtasks.filter(s => s.done).length}/{task.subtasks.length} done</div>
          </div>
        )}
      </div>
      <div style={{ display: "flex", gap: 2, flexShrink: 0 }}>
        <button onClick={() => onEdit(task)} style={{ background: "none", border: "none", cursor: "pointer", padding: "4px 6px", borderRadius: 6, color: "var(--color-text-secondary)", fontSize: 14 }}>✏️</button>
        <button onClick={() => onDelete(task.id)} style={{ background: "none", border: "none", cursor: "pointer", padding: "4px 6px", borderRadius: 6, color: "var(--color-text-secondary)", fontSize: 14 }}>🗑</button>
      </div>
    </div>
  );
}

// ── Calendar View ─────────────────────────────────────────────────────────────

// Calendar dot colours: scheduled-completion = theme accent, deadline = red,
// important date = amber. (Deadline is the red dot the user asked for.)
const CAL_DEADLINE = "#E24B4A";
const CAL_DATE = "#BA7517";

function CalendarView({ tasks, importantDates, accentColor, onAddTask, onEditDate }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [selected, setSelected] = useState(now.getDate());

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = (getFirstDayOfMonth(year, month) + 6) % 7; // Mon start
  const todayDate = now.getDate(), todayMonth = now.getMonth(), todayYear = now.getFullYear();
  const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const DAY_NAMES = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

  function dateStr(d) { return `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`; }

  function getEventsForDay(d) {
    const ds = dateStr(d);
    const monthDay = ds.slice(5);
    const scheduled = tasks.filter(t => t.scheduledDate === ds);
    const deadlines = tasks.filter(t => t.deadline === ds);
    const dates = importantDates.filter(id => dateOccursOn(id, ds));
    return { scheduled, deadlines, dates };
  }

  const selDateStr = selected ? dateStr(selected) : null;
  const selEvents = selected ? getEventsForDay(selected) : null;
  const goToday = () => { setYear(todayYear); setMonth(todayMonth); setSelected(todayDate); };
  const Dot = ({ c }) => <div style={{ width: 6, height: 6, borderRadius: "50%", background: c }} />;
  const LegendItem = ({ c, label }) => <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, color: "var(--color-text-secondary)" }}><span style={{ width: 7, height: 7, borderRadius: "50%", background: c }} />{label}</span>;

  return (
    <div>
      {/* Big calendar spanning the top */}
      <div style={{ background: "var(--color-background-primary)", borderRadius: 14, border: "0.5px solid var(--color-border-tertiary)", overflow: "hidden", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", borderBottom: "0.5px solid var(--color-border-tertiary)" }}>
          <button onClick={() => { let m = month - 1, y = year; if (m < 0) { m = 11; y--; } setMonth(m); setYear(y); }} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: "var(--color-text-secondary)", padding: "2px 10px" }}>‹</button>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontWeight: 600, fontSize: 17 }}>{MONTH_NAMES[month]} {year}</span>
            <button onClick={goToday} style={{ fontSize: 12, padding: "4px 11px", borderRadius: 8, cursor: "pointer", color: accentColor }}>Today</button>
          </div>
          <button onClick={() => { let m = month + 1, y = year; if (m > 11) { m = 0; y++; } setMonth(m); setYear(y); }} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: "var(--color-text-secondary)", padding: "2px 10px" }}>›</button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", padding: "12px 14px 0" }}>
          {DAY_NAMES.map(d => <div key={d} style={{ textAlign: "center", fontSize: 11, fontWeight: 600, color: "var(--color-text-secondary)", padding: "0 0 8px", textTransform: "uppercase", letterSpacing: "0.05em" }}>{d}</div>)}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", padding: "0 14px 16px", gap: 5 }}>
          {Array(firstDay).fill(null).map((_, i) => <div key={"e" + i} />)}
          {Array(daysInMonth).fill(null).map((_, i) => {
            const d = i + 1;
            const isToday = d === todayDate && month === todayMonth && year === todayYear;
            const isSel = d === selected;
            const ev = getEventsForDay(d);
            return (
              <div key={d} onClick={() => setSelected(d)} style={{ minHeight: 52, borderRadius: 10, padding: "7px 4px 5px", textAlign: "center", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-start", background: isSel ? accentColor : isToday ? hex2rgba(accentColor, 0.1) : "var(--color-background-secondary)", border: isToday && !isSel ? `1.5px solid ${accentColor}` : "1.5px solid transparent", transition: "background 0.15s" }}>
                <div style={{ fontSize: 15, fontWeight: isToday || isSel ? 600 : 400, color: isSel ? "#fff" : isToday ? accentColor : "var(--color-text-primary)" }}>{d}</div>
                <div style={{ display: "flex", gap: 3, justifyContent: "center", marginTop: 5, flexWrap: "wrap" }}>
                  {ev.scheduled.length > 0 && <Dot c={isSel ? "rgba(255,255,255,0.85)" : accentColor} />}
                  {ev.deadlines.length > 0 && <Dot c={isSel ? "#fff" : CAL_DEADLINE} />}
                  {ev.dates.length > 0 && <Dot c={isSel ? "rgba(255,255,255,0.7)" : CAL_DATE} />}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 14, padding: "0 4px" }}>
        <LegendItem c={accentColor} label="Scheduled completion" />
        <LegendItem c={CAL_DEADLINE} label="Deadline" />
        <LegendItem c={CAL_DATE} label="Important date" />
      </div>

      {/* Selected day — underneath the calendar */}
      <div style={{ background: "var(--color-background-primary)", borderRadius: 14, border: "0.5px solid var(--color-border-tertiary)", padding: 18, minHeight: 140 }}>
        {selected ? (() => {
          const deadlineOnly = selEvents.deadlines.filter(t => t.scheduledDate !== selDateStr);
          const empty = selEvents.scheduled.length === 0 && selEvents.deadlines.length === 0 && selEvents.dates.length === 0;
          return (
            <>
              <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 12 }}>{selected} {MONTH_NAMES[month]} {year}</div>
              {empty && <div style={{ fontSize: 13, color: "var(--color-text-secondary)", marginBottom: 12 }}>Nothing on this day.</div>}
              {selEvents.dates.map(id => {
                const typeInfo = DATE_TYPES.find(t => t.v === id.type);
                return (
                  <div key={id.id} onClick={() => onEditDate(id)} style={{ padding: "9px 12px", borderRadius: 9, background: hex2rgba(CAL_DATE, 0.12), marginBottom: 6, cursor: "pointer", borderLeft: `3px solid ${CAL_DATE}` }}>
                    <div style={{ fontSize: 13.5, fontWeight: 500 }}>{typeInfo?.icon} {id.title}</div>
                    <div style={{ fontSize: 11, color: CAL_DATE, marginTop: 2 }}>Important date · repeats {repeatLabel(id.repeatMonths)}</div>
                  </div>
                );
              })}
              {selEvents.scheduled.map(t => {
                const alsoDeadline = t.deadline === selDateStr;
                return (
                  <div key={"s" + t.id} style={{ padding: "9px 12px", borderRadius: 9, background: hex2rgba(accentColor, 0.08), marginBottom: 6, borderLeft: `3px solid ${accentColor}` }}>
                    <div style={{ fontSize: 13.5, fontWeight: 500 }}>{t.title}</div>
                    <div style={{ fontSize: 11, color: accentColor, marginTop: 2 }}>▷ Scheduled completion{alsoDeadline ? ` & ⚑ deadline` : ""}</div>
                    {(t.subtasks || []).length > 0 && <div style={{ marginTop: 6, paddingLeft: 12, borderLeft: "2px solid var(--color-border-tertiary)" }}>{t.subtasks.map(s => <div key={s.id} style={{ fontSize: 11.5, color: "var(--color-text-secondary)", display: "flex", gap: 6 }}><span>•</span><span style={{ textDecoration: s.done ? "line-through" : "none" }}>{s.title}</span></div>)}</div>}
                  </div>
                );
              })}
              {deadlineOnly.map(t => (
                <div key={"d" + t.id} style={{ padding: "9px 12px", borderRadius: 9, background: hex2rgba(CAL_DEADLINE, 0.08), marginBottom: 6, borderLeft: `3px solid ${CAL_DEADLINE}` }}>
                  <div style={{ fontSize: 13.5, fontWeight: 500 }}>{t.title}</div>
                  <div style={{ fontSize: 11, color: CAL_DEADLINE, marginTop: 2 }}>⚑ Deadline</div>
                  {(t.subtasks || []).length > 0 && <div style={{ marginTop: 6, paddingLeft: 12, borderLeft: "2px solid var(--color-border-tertiary)" }}>{t.subtasks.map(s => <div key={s.id} style={{ fontSize: 11.5, color: "var(--color-text-secondary)", display: "flex", gap: 6 }}><span>•</span><span style={{ textDecoration: s.done ? "line-through" : "none" }}>{s.title}</span></div>)}</div>}
                </div>
              ))}
              <button onClick={() => onAddTask(selDateStr)} style={{ marginTop: 8, padding: "8px 16px", borderRadius: 8, border: `1px dashed ${accentColor}`, background: "transparent", color: accentColor, fontSize: 13, cursor: "pointer" }}>+ Add task on this day</button>
            </>
          );
        })() : (
          <div style={{ textAlign: "center", padding: "24px 0", color: "var(--color-text-secondary)", fontSize: 13 }}>Select a day to see what's on.</div>
        )}
      </div>
    </div>
  );
}

// ── Settings View ─────────────────────────────────────────────────────────────

function SettingsView({ state, up, accentColor, user, calendarToken }) {
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState(TAG_COLORS[0]);
  const [copied, setCopied] = useState(false);

  // The live subscription feed URL for Apple Calendar. webcal:// makes iOS/macOS
  // offer to subscribe directly. It auto-refreshes (Apple controls the interval).
  const origin = (typeof window !== "undefined" && window.location.origin) || "";
  const httpsFeed = calendarToken ? `${origin}/api/feed?token=${calendarToken}` : "";
  const webcalFeed = httpsFeed.replace(/^https?:\/\//, "webcal://");

  function copyFeed() {
    if (!httpsFeed) return;
    navigator.clipboard.writeText(httpsFeed).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 1800);
    });
  }

  function addTag() {
    if (!newTagName.trim()) return;
    if (state.tags.find(t => t.name.toLowerCase() === newTagName.trim().toLowerCase())) return;
    up({ tags: [...state.tags, { id: genId(), name: newTagName.trim(), color: newTagColor }] });
    setNewTagName("");
  }

  function removeTag(id) { up({ tags: state.tags.filter(t => t.id !== id) }); }

  function exportAll() {
    const events = state.tasks.filter(t => t.deadline).map(t => {
      const d = t.deadline.replace(/-/g, "");
      return `BEGIN:VEVENT\nSUMMARY:${t.title}\nDTSTART;VALUE=DATE:${d}\nDTEND;VALUE=DATE:${d}\nEND:VEVENT`;
    }).join("\n");
    const blob = new Blob([`BEGIN:VCALENDAR\nVERSION:2.0\n${events}\nEND:VCALENDAR`], { type: "text/calendar" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "all-tasks.ics"; a.click();
  }

  const metaName = (user && user.user_metadata && (user.user_metadata.full_name || user.user_metadata.name)) || "";
  return (
    <div style={{ maxWidth: 560 }}>
      <div style={{ background: "var(--color-background-primary)", borderRadius: 14, border: "0.5px solid var(--color-border-tertiary)", padding: 20, marginBottom: 14 }}>
        <h3 style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 500 }}>Your name</h3>
        <p style={{ margin: "0 0 12px", fontSize: 12, color: "var(--color-text-secondary)" }}>Used to greet you on the Home dashboard.</p>
        <input type="text" placeholder={metaName || "e.g. Josh"} value={state.name || ""} onChange={e => up({ name: e.target.value })} style={{ width: "100%", padding: "10px 12px", fontSize: 14, boxSizing: "border-box" }} />
      </div>

      <div style={{ background: "var(--color-background-primary)", borderRadius: 14, border: "0.5px solid var(--color-border-tertiary)", padding: 20, marginBottom: 14 }}>
        <h3 style={{ margin: "0 0 14px", fontSize: 14, fontWeight: 500 }}>Appearance</h3>
        <div style={{ display: "flex", gap: 8 }}>
          {[["system", "🌗", "System"], ["light", "☀️", "Light"], ["dark", "🌙", "Dark"]].map(([val, icon, label]) => {
            const active = (state.mode || "system") === val;
            return (
              <button key={val} onClick={() => up({ mode: val })} style={{ flex: 1, padding: "12px 8px", borderRadius: 11, cursor: "pointer", border: `1.5px solid ${active ? accentColor : "var(--color-border-tertiary)"}`, background: active ? hex2rgba(accentColor, 0.1) : "transparent", color: active ? accentColor : "var(--color-text-primary)", fontWeight: active ? 600 : 400, display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
                <span style={{ fontSize: 20 }}>{icon}</span>
                <span style={{ fontSize: 12.5 }}>{label}</span>
              </button>
            );
          })}
        </div>
        <div style={{ fontSize: 11.5, color: "var(--color-text-secondary)", marginTop: 8 }}>System follows your device's light/dark setting automatically.</div>
      </div>

      <div style={{ background: "var(--color-background-primary)", borderRadius: 14, border: "0.5px solid var(--color-border-tertiary)", padding: 20, marginBottom: 14 }}>
        <h3 style={{ margin: "0 0 14px", fontSize: 14, fontWeight: 500 }}>Theme colour</h3>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {Object.entries(THEMES).map(([name, color]) => (
            <div key={name} onClick={() => up({ theme: name })} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, cursor: "pointer" }}>
              <div style={{ width: 36, height: 36, borderRadius: "50%", background: color, outline: state.theme === name ? `3px solid ${color}` : "none", outlineOffset: 3, transition: "outline 0.15s" }} />
              <span style={{ fontSize: 11, color: state.theme === name ? color : "var(--color-text-secondary)", fontWeight: state.theme === name ? 500 : 400, textTransform: "capitalize" }}>{name}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ background: "var(--color-background-primary)", borderRadius: 14, border: "0.5px solid var(--color-border-tertiary)", padding: 20, marginBottom: 14 }}>
        <h3 style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 500 }}>Tags</h3>
        <p style={{ margin: "0 0 14px", fontSize: 12, color: "var(--color-text-secondary)" }}>Create and manage custom tags to categorise your tasks</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
          {state.tags.map(tag => (
            <div key={tag.id} style={{ display: "flex", alignItems: "center", gap: 6, background: hex2rgba(tag.color, 0.1), border: `1.5px solid ${hex2rgba(tag.color, 0.3)}`, borderRadius: 20, padding: "5px 12px" }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: tag.color }} />
              <span style={{ fontSize: 13, color: tag.color, fontWeight: 500 }}>{tag.name}</span>
              <button onClick={() => removeTag(tag.id)} style={{ background: "none", border: "none", cursor: "pointer", color: tag.color, fontSize: 16, lineHeight: 1, padding: 0, opacity: 0.7 }}>×</button>
            </div>
          ))}
        </div>
        <div style={{ background: "var(--color-background-secondary)", borderRadius: 12, padding: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: "var(--color-text-secondary)", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>Create new tag</div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
            <input placeholder="Tag name…" value={newTagName} onChange={e => setNewTagName(e.target.value)} onKeyDown={e => e.key === "Enter" && addTag()} style={{ flex: 1, fontSize: 13 }} />
          </div>
          <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginBottom: 8 }}>Choose a colour</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
            {TAG_COLORS.map(c => (
              <div key={c} onClick={() => setNewTagColor(c)} style={{ width: 28, height: 28, borderRadius: "50%", background: c, cursor: "pointer", outline: newTagColor === c ? `3px solid ${c}` : "none", outlineOffset: 2 }} />
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {newTagName && <div style={{ background: hex2rgba(newTagColor, 0.12), color: newTagColor, fontSize: 12, padding: "4px 12px", borderRadius: 20, fontWeight: 500 }}>{newTagName}</div>}
            <button onClick={addTag} style={{ padding: "8px 18px", background: accentColor, color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 500 }}>Create tag</button>
          </div>
        </div>
      </div>

      <div style={{ background: "var(--color-background-primary)", borderRadius: 14, border: "0.5px solid var(--color-border-tertiary)", padding: 20, marginBottom: 14 }}>
        <h3 style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 500 }}>🗓 Sync to Apple Calendar</h3>
        <p style={{ margin: "0 0 12px", fontSize: 12, color: "var(--color-text-secondary)" }}>
          Subscribe once and your tasks with dates appear in Apple Calendar automatically,
          refreshing in the background. (One-way: tasks show up here, you manage them in Tend.)
        </p>
        {httpsFeed ? (
          <div>
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <a href={webcalFeed} style={{ flex: 1, textAlign: "center", padding: "10px 16px", background: accentColor, color: "#fff", borderRadius: 9, fontSize: 13, fontWeight: 600, textDecoration: "none" }}>
                ＋ Subscribe in Apple Calendar
              </a>
              <button onClick={copyFeed} style={{ padding: "10px 16px", fontSize: 13, borderRadius: 9, cursor: "pointer" }}>
                {copied ? "✓ Copied" : "Copy link"}
              </button>
            </div>
            <div style={{ fontSize: 11, color: "var(--color-text-secondary)", lineHeight: 1.5 }}>
              <strong>On iPhone:</strong> tap “Subscribe” above → Add.<br />
              <strong>On Mac:</strong> Calendar → File → New Calendar Subscription → paste the copied link.<br />
              Keep this link private — anyone with it can see your task dates.
            </div>
            <div style={{ marginTop: 12 }}>
              <button onClick={exportAll} style={{ padding: "8px 14px", fontSize: 12, borderRadius: 8, cursor: "pointer" }}>
                Or download a one-time .ics file
              </button>
            </div>
          </div>
        ) : (
          <p style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>Calendar link will appear once your account finishes syncing.</p>
        )}
      </div>

      <div style={{ background: "var(--color-background-primary)", borderRadius: 14, border: "0.5px solid var(--color-border-tertiary)", padding: 20 }}>
        <h3 style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 500 }}>Account</h3>
        <p style={{ margin: "0 0 14px", fontSize: 13, color: "var(--color-text-secondary)" }}>
          Signed in as <strong>{user && (user.email || user.user_metadata?.name || "you")}</strong>
        </p>
        <button onClick={() => window.TendCloud.signOut()} style={{ padding: "9px 18px", fontSize: 13, borderRadius: 9, cursor: "pointer", color: "#E24B4A" }}>
          Sign out
        </button>
      </div>
    </div>
  );
}

// ── Natural-language parser (offline fallback for the AI quick-add) ───────────

function localParse(text, ctx) {
  ctx = ctx || {};
  const tags = ctx.tags || [];
  const groups = ctx.groups || [];
  const out = { title: text, tags: [], notes: "" };
  let title = " " + text + " ";
  const strip = (re) => { title = title.replace(re, " "); };

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const WD = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const MO = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };

  // someday / rainy-day
  if (/\b(someday|some day|rainy[ -]?day|no rush|eventually|one day)\b/i.test(title)) {
    out.someday = true;
    strip(/\b(someday|some day|rainy[ -]?day|no rush|eventually|one day)\b/i);
  }

  // repeat
  const rep = [
    [/\b(every ?day|daily)\b/i, "daily"],
    [/\b(every ?week|weekly|every (mon|tue|wed|thu|fri|sat|sun)\w*)\b/i, "weekly"],
    [/\b(every ?month|monthly)\b/i, "monthly"],
    [/\b(every ?year|yearly|annually)\b/i, "yearly"],
  ];
  for (const [re, val] of rep) { if (re.test(title)) { out.repeat = val; strip(re); break; } }

  // priority
  if (/\b(high( priority)?|urgent|asap|important)\b|!!!|!!/i.test(title)) { out.priority = "high"; strip(/\b(high( priority)?|urgent|asap|important)\b|!!!|!!/i); }
  else if (/\b(low( priority)?|whenever)\b/i.test(title)) { out.priority = "low"; strip(/\b(low( priority)?|whenever)\b/i); }
  else if (/\b(medium|med|normal)( priority)?\b/i.test(title)) { out.priority = "medium"; strip(/\b(medium|med|normal)( priority)?\b/i); }

  // explicit #tags (strip) + bare tag-name mentions (keep in title)
  const names = new Set();
  let hm; const hashRe = /#([a-z0-9][a-z0-9_-]*)/ig;
  while ((hm = hashRe.exec(text))) {
    const found = tags.find((t) => t.name.toLowerCase() === hm[1].toLowerCase());
    if (found) names.add(found.name);
  }
  strip(/#[a-z0-9][a-z0-9_-]*/ig);
  for (const t of tags) {
    const re = new RegExp("\\b" + t.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b", "i");
    if (re.test(title)) names.add(t.name);
  }
  out.tags = [...names];

  // group: @name or "in/for <name>" (strip), else bare name (keep)
  for (const g of groups) {
    const esc = g.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const marked = new RegExp("(@|\\b(?:in|for)\\s+)" + esc + "\\b", "i");
    const bare = new RegExp("\\b" + esc + "\\b", "i");
    if (marked.test(title)) { out.group = g.name; strip(marked); break; }
    if (bare.test(title)) { out.group = g.name; break; }
  }

  // dates — up to two (scheduled + deadline). Leading keyword decides which.
  const KW = "(by|before|due|deadline|on|start(?:ing)?|do|scheduled?|for)?\\s*";
  const norm = (n) => ({ sun: "sunday", mon: "monday", tue: "tuesday", tues: "tuesday", wed: "wednesday", thu: "thursday", thur: "thursday", thurs: "thursday", fri: "friday", sat: "saturday" }[n] || n);
  const patterns = [
    { re: new RegExp(KW + "\\b(today|tonight)\\b", "i"), get: () => today },
    { re: new RegExp(KW + "\\b(tomorrow|tmrw|tmw)\\b", "i"), get: () => addDays(today, 1) },
    { re: new RegExp(KW + "\\bnext week\\b", "i"), get: () => addDays(today, 7) },
    { re: new RegExp(KW + "\\bnext month\\b", "i"), get: () => { const d = new Date(today); d.setMonth(d.getMonth() + 1); return d; } },
    { re: new RegExp(KW + "\\bin (\\d+) days?\\b", "i"), get: (m) => addDays(today, +m[2]) },
    { re: new RegExp(KW + "\\bin (\\d+) weeks?\\b", "i"), get: (m) => addDays(today, 7 * +m[2]) },
    { re: new RegExp(KW + "\\bin (\\d+) months?\\b", "i"), get: (m) => { const d = new Date(today); d.setMonth(d.getMonth() + +m[2]); return d; } },
    { re: new RegExp(KW + "\\b(next )?(sunday|monday|tuesday|wednesday|thursday|friday|saturday|sun|mon|tues?|wed|thu|thur|thurs|fri|sat)\\b", "i"),
      get: (m) => { const name = norm(m[3].toLowerCase()); let delta = (WD.indexOf(name) - today.getDay() + 7) % 7; if (delta === 0) delta = 7; return addDays(today, delta); } },
    { re: new RegExp(KW + "\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\\.?(?:\\s+(\\d{4}))?", "i"),
      get: (m) => { const y = m[4] ? +m[4] : today.getFullYear(); const d = new Date(y, MO[m[3].slice(0, 3).toLowerCase()], +m[2]); if (!m[4] && d < today) d.setFullYear(y + 1); return d; } },
    { re: new RegExp(KW + "\\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s+(\\d{4}))?", "i"),
      get: (m) => { const y = m[4] ? +m[4] : today.getFullYear(); const d = new Date(y, MO[m[2].slice(0, 3).toLowerCase()], +m[3]); if (!m[4] && d < today) d.setFullYear(y + 1); return d; } },
    { re: new RegExp(KW + "\\bthe (\\d{1,2})(?:st|nd|rd|th)\\b", "i"),
      get: (m) => { const d = new Date(today.getFullYear(), today.getMonth(), +m[2]); if (d < today) d.setMonth(d.getMonth() + 1); return d; } },
    { re: new RegExp(KW + "\\b(\\d{4})-(\\d{2})-(\\d{2})\\b", "i"), get: (m) => new Date(+m[2], +m[3] - 1, +m[4]) },
    { re: new RegExp(KW + "\\b(\\d{1,2})/(\\d{1,2})(?:/(\\d{2,4}))?\\b", "i"),
      get: (m) => { const y = m[4] ? (+m[4] < 100 ? 2000 + +m[4] : +m[4]) : today.getFullYear(); const d = new Date(y, +m[3] - 1, +m[2]); if (!m[4] && d < today) d.setFullYear(y + 1); return d; } },
  ];

  for (let pass = 0; pass < 2; pass++) {
    let best = null;
    for (const p of patterns) {
      const m = p.re.exec(title);
      if (m && (best === null || m.index < best.m.index)) best = { p, m };
    }
    if (!best) break;
    const dt = best.p.get(best.m);
    title = title.replace(best.p.re, " ");
    if (!dt || isNaN(dt.getTime())) continue;
    const kw = (best.m[1] || "").toLowerCase();
    const isDeadline = /^(by|before|due|deadline)$/.test(kw);
    if (isDeadline) { if (!out.deadline) out.deadline = iso(dt); }
    else if (!out.scheduledDate) out.scheduledDate = iso(dt);
    else if (!out.deadline) out.deadline = iso(dt);
  }
  if (out.someday) { out.scheduledDate = ""; out.deadline = ""; }

  // tidy the leftover title
  out.title = title.replace(/\s+/g, " ").replace(/^[\s,;:.\-]+|[\s,;:.\-]+$/g, "").trim() || text.trim();
  return out;
}

// Map a parsed result (AI or local) into a full task object.
function buildTask(p, ctx, defaults) {
  ctx = ctx || {}; defaults = defaults || {};
  const tags = ctx.tags || [], groups = ctx.groups || [];
  const tagId = (n) => (tags.find((t) => t.name.toLowerCase() === String(n).toLowerCase()) || {}).id;
  const groupId = (n) => (groups.find((g) => g.name.toLowerCase() === String(n).toLowerCase()) || {}).id;
  const someday = !!(p.someday || defaults.someday);
  let scheduledDate = p.scheduledDate || "";
  if (!scheduledDate && defaults.scheduledToday && !someday) scheduledDate = todayStr();
  let gid = p.group ? groupId(p.group) : "";
  if (!gid && defaults.groupId) gid = defaults.groupId;
  return {
    id: genId(),
    title: p.title || "",
    notes: p.notes || "",
    priority: p.priority || "medium",
    groupId: gid || "",
    deadline: someday ? "" : (p.deadline || ""),
    scheduledDate: someday ? "" : scheduledDate,
    duration: "",
    repeat: p.repeat || "none",
    tags: (p.tags || []).map(tagId).filter(Boolean),
    subtasks: [],
    someday,
    done: false,
  };
}

// ── Quick Add (the "talk to it in plain English" box) ─────────────────────────

function QuickAdd({ ctx, accentColor, defaults, onAdd }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [focused, setFocused] = useState(false);
  const [hint, setHint] = useState(null);
  const ref = useRef(null);

  async function submit() {
    const value = text.trim();
    if (!value || busy) return;
    setBusy(true); setHint(null);
    let parsed = null, ai = false;
    try {
      const res = await fetch("/api/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: value, context: { tags: ctx.tags, groups: ctx.groups } }),
      });
      const data = await res.json();
      if (data && data.ai && data.result) { parsed = data.result; ai = true; }
    } catch (e) { /* offline — fall through to local parser */ }
    if (!parsed) parsed = localParse(value, ctx);

    const task = buildTask(parsed, ctx, defaults);
    onAdd(task);

    const bits = [];
    if (task.scheduledDate) bits.push("📅 " + fmtShort(task.scheduledDate));
    if (task.deadline) bits.push("⚑ " + fmtShort(task.deadline));
    if (task.priority && task.priority !== "medium") bits.push(PRIORITY[task.priority].label);
    if (task.tags && task.tags.length) bits.push("🏷 " + task.tags.length);
    if (task.someday) bits.push("🌂 Rainy day");
    setHint((ai ? "✨ " : "") + (bits.length ? bits.join(" · ") : "Added"));
    setText(""); setBusy(false);
    setTimeout(() => setHint(null), 2800);
    if (ref.current) ref.current.focus();
  }

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 15px", background: "var(--color-background-primary)", border: `1.5px solid ${focused ? accentColor : "var(--color-border-tertiary)"}`, borderRadius: 13, boxShadow: "0 1px 3px rgba(0,0,0,0.04)", transition: "border-color 0.15s" }}>
        <span style={{ fontSize: 16, color: accentColor, width: 18, textAlign: "center" }}>{busy ? "⏳" : "✨"}</span>
        <input
          ref={ref}
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={(e) => { if (e.key === "Enter") submit(); if (e.key === "Escape") setText(""); }}
          placeholder={'Add a to-do — e.g. "buy mum a present by 15 jun, high #gift"'}
          style={{ flex: 1, border: "none", background: "transparent", fontSize: 15, padding: 0, outline: "none", boxShadow: "none", minWidth: 0 }}
        />
        {hint && <span style={{ fontSize: 12, color: accentColor, whiteSpace: "nowrap", fontWeight: 500 }}>{hint}</span>}
      </div>
      <div style={{ fontSize: 11, color: "var(--color-text-secondary)", marginTop: 5, marginLeft: 4 }}>
        Type naturally — dates, priority and tags are filled in for you. Press Enter to add.
      </div>
    </div>
  );
}

// ── Login screen ──────────────────────────────────────────────────────────────

function LoginScreen() {
  const [mode, setMode] = useState("signin"); // signin | signup
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const ac = THEMES.purple;

  async function emailAuth() {
    if (!email.trim() || !pw) { setMsg({ t: "err", m: "Enter your email and password." }); return; }
    if (mode === "signup" && !name.trim()) { setMsg({ t: "err", m: "Enter your name so we can say hello." }); return; }
    setBusy(true); setMsg(null);
    try {
      const { data, error } = mode === "signup"
        ? await window.TendCloud.signUpWithEmail(email.trim(), pw, name.trim())
        : await window.TendCloud.signInWithEmail(email.trim(), pw);
      if (error) { setMsg({ t: "err", m: error.message }); }
      else if (mode === "signup" && data && data.user && !data.session) {
        setMsg({ t: "ok", m: "Check your email to confirm your account, then sign in." });
      }
      // On success with a session, onAuth fires and the app swaps in automatically.
    } catch (e) {
      setMsg({ t: "err", m: String(e) });
    }
    setBusy(false);
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, background: "var(--color-background-tertiary)" }}>
      <div style={{ width: "100%", maxWidth: 380, background: "var(--color-background-primary)", borderRadius: 18, padding: 28, boxShadow: "0 10px 40px rgba(0,0,0,0.10)" }}>
        <div style={{ textAlign: "center", marginBottom: 22 }}>
          <div style={{ fontSize: 40, marginBottom: 6 }}>🌱</div>
          <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: -0.5 }}>Tend</div>
          <div style={{ fontSize: 14, color: "var(--color-text-secondary)", marginTop: 4 }}>
            Sign in to your task manager
          </div>
        </div>

        <button
          onClick={() => window.TendCloud.signInWithGoogle()}
          style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, padding: "11px 14px", borderRadius: 11, border: "1px solid var(--color-border-secondary)", background: "var(--color-background-primary)", fontSize: 15, fontWeight: 500, marginBottom: 16 }}
        >
          <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.6 2.4 30.1 0 24 0 14.6 0 6.4 5.4 2.5 13.3l7.9 6.1C12.3 13.2 17.6 9.5 24 9.5z"/><path fill="#4285F4" d="M46.1 24.6c0-1.6-.1-3.1-.4-4.6H24v9.1h12.4c-.5 2.9-2.1 5.3-4.6 7l7.1 5.5c4.2-3.9 6.6-9.6 6.6-16z"/><path fill="#FBBC05" d="M10.4 28.6c-.5-1.5-.8-3-.8-4.6s.3-3.1.8-4.6l-7.9-6.1C.9 16.5 0 20.1 0 24s.9 7.5 2.5 10.7l7.9-6.1z"/><path fill="#34A853" d="M24 48c6.1 0 11.3-2 15-5.5l-7.1-5.5c-2 1.3-4.6 2.1-7.9 2.1-6.4 0-11.7-3.7-13.6-9.4l-7.9 6.1C6.4 42.6 14.6 48 24 48z"/></svg>
          Continue with Google
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "4px 0 16px", color: "var(--color-text-secondary)", fontSize: 12 }}>
          <div style={{ flex: 1, height: 1, background: "var(--color-border-tertiary)" }} /> or <div style={{ flex: 1, height: 1, background: "var(--color-border-tertiary)" }} />
        </div>

        {mode === "signup" && (
          <input type="text" placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)}
            style={{ width: "100%", marginBottom: 10, padding: "11px 12px", fontSize: 15 }} />
        )}
        <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)}
          style={{ width: "100%", marginBottom: 10, padding: "11px 12px", fontSize: 15 }} />
        <input type="password" placeholder="Password" value={pw} onChange={(e) => setPw(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && emailAuth()}
          style={{ width: "100%", marginBottom: 14, padding: "11px 12px", fontSize: 15 }} />

        <button onClick={emailAuth} disabled={busy}
          style={{ width: "100%", padding: "11px 14px", borderRadius: 11, border: "none", background: ac, color: "#fff", fontSize: 15, fontWeight: 600, opacity: busy ? 0.6 : 1 }}>
          {busy ? "…" : mode === "signup" ? "Create account" : "Sign in"}
        </button>

        {msg && (
          <div style={{ marginTop: 12, fontSize: 13, color: msg.t === "err" ? "#E24B4A" : "#1D9E75", textAlign: "center" }}>
            {msg.m}
          </div>
        )}

        <div style={{ marginTop: 16, textAlign: "center", fontSize: 13, color: "var(--color-text-secondary)" }}>
          {mode === "signup" ? "Already have an account? " : "New here? "}
          <span onClick={() => { setMode(mode === "signup" ? "signin" : "signup"); setMsg(null); }}
            style={{ color: ac, cursor: "pointer", fontWeight: 500 }}>
            {mode === "signup" ? "Sign in" : "Create one"}
          </span>
        </div>
      </div>
    </div>
  );
}

// Friendly screen if Supabase isn't configured yet.
function SetupNeeded() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, textAlign: "center" }}>
      <div style={{ maxWidth: 460 }}>
        <div style={{ fontSize: 40, marginBottom: 10 }}>🌱</div>
        <h2 style={{ margin: "0 0 8px" }}>Tend — almost ready</h2>
        <p style={{ color: "var(--color-text-secondary)", fontSize: 15, lineHeight: 1.5 }}>
          Accounts aren't connected yet. Add your Supabase URL and anon key in
          <code style={{ background: "var(--color-background-tertiary)", padding: "2px 6px", borderRadius: 6, margin: "0 4px" }}>config.js</code>
          (see <strong>SETUP-ACCOUNTS.md</strong>), then redeploy.
        </p>
      </div>
    </div>
  );
}

// ── Auth gate ─────────────────────────────────────────────────────────────────

function AuthGate() {
  const [user, setUser] = useState(undefined); // undefined = checking
  useEffect(() => {
    if (!window.TendCloud || !window.TendCloud.isConfigured) { setUser(null); return; }
    const off = window.TendCloud.onAuth((u) => setUser(u));
    return off;
  }, []);

  if (window.TendCloud && !window.TendCloud.isConfigured) return <SetupNeeded />;
  if (user === undefined) {
    return <div className="boot-msg" style={{ paddingTop: 80 }}>Loading Tend…</div>;
  }
  if (!user) return <LoginScreen />;
  return <App user={user} />;
}

// ── Finance: helpers ────────────────────────────────────────────────────────

const GBP2 = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const GBP0 = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 });
function fmtMoney(n, round) { return (round ? GBP0 : GBP2).format(Number(n) || 0); }
function curMonthKey() { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0"); }
function monthLabel(k) { const [y, m] = k.split("-").map(Number); return new Date(y, m - 1, 1).toLocaleDateString("en-GB", { month: "long", year: "numeric" }); }
function monthShort(k) { const [y, m] = k.split("-").map(Number); return new Date(y, m - 1, 1).toLocaleDateString("en-GB", { month: "short" }); }
// Pure year/month arithmetic — no Date object, so timezone can never shift the result.
function shiftMonth(k, delta) { const [y, m] = k.split("-").map(Number); const t = y * 12 + (m - 1) + delta; return Math.floor(t / 12) + "-" + String((t % 12) + 1).padStart(2, "0"); }

// ── Savings forecasts ────────────────────────────────────────────────────────
// Months until a balance + monthly contribution (compounded at an annual %) reaches target.
function monthsToGoal(balance, monthly, annualRatePct, target) {
  balance = Number(balance) || 0; monthly = Number(monthly) || 0; target = Number(target) || 0;
  if (target <= balance) return 0;
  const i = (Number(annualRatePct) || 0) / 100 / 12;
  if (monthly <= 0 && i <= 0) return null; // never grows
  let b = balance, n = 0;
  while (b < target && n < 1200) { b = b * (1 + i) + monthly; n++; }
  return n >= 1200 ? null : n;
}
function projectBalance(balance, monthly, annualRatePct, months) {
  let b = Number(balance) || 0; const i = (Number(annualRatePct) || 0) / 100 / 12, m = Number(monthly) || 0;
  for (let k = 0; k < months; k++) b = b * (1 + i) + m;
  return b;
}
// Amortising loan: monthly payment, total payable and total interest over a term.
function loanSchedule(balance, ratePct, months) {
  const P = Number(balance) || 0, n = Number(months) || 0, r = (Number(ratePct) || 0) / 100 / 12;
  if (n <= 0) return { monthly: 0, total: 0, interest: 0 };
  const monthly = r === 0 ? P / n : P * r / (1 - Math.pow(1 + r, -n));
  const total = monthly * n;
  return { monthly, total, interest: total - P };
}
// Where you are in a debt and what's left, accounting for how many months
// you've already paid plus any extra payments / payment breaks.
//   - extra payment: reduces the balance.
//   - break "extend": pause N months and push the end date out by N.
//   - break "higher": pause N months but keep the end date (pay more, sooner end).
function debtPlan(d) {
  const bal = Number(d.balance) || 0, rate = Number(d.rate) || 0, term = Number(d.termMonths) || 0;
  const paid = Math.max(0, Math.min(Number(d.monthsPaid) || 0, term || 9999));
  const adj = d.adjustments || [];
  const extra = adj.filter(a => a.kind === "extra").reduce((s, a) => s + (Number(a.value) || 0), 0);
  const extendMonths = adj.filter(a => a.kind === "break" && a.mode === "extend").reduce((s, a) => s + (Number(a.value) || 0), 0);
  const higherMonths = adj.filter(a => a.kind === "break" && a.mode === "higher").reduce((s, a) => s + (Number(a.value) || 0), 0);
  const effBal = Math.max(0, bal - extra);
  if (!term) return { hasTerm: false, effBal, extra };
  const baseLeft = Math.max(0, term - paid);
  const payMonths = Math.max(1, baseLeft - higherMonths);
  const monthsToEnd = baseLeft + extendMonths;
  const sched = loanSchedule(effBal, rate, payMonths);
  return { hasTerm: true, paid, term, baseLeft, payMonths, monthsToEnd, extra, extendMonths, higherMonths,
    monthly: sched.monthly, remainingPayable: sched.monthly * payMonths, interestLeft: sched.interest };
}
// Monthly contribution needed to reach target in `months`.
function requiredMonthly(balance, annualRatePct, target, months) {
  balance = Number(balance) || 0; target = Number(target) || 0; months = Number(months) || 0;
  if (months <= 0) return target > balance ? Infinity : 0;
  const i = (Number(annualRatePct) || 0) / 100 / 12;
  if (i === 0) return Math.max(0, (target - balance) / months);
  const f = Math.pow(1 + i, months);
  return Math.max(0, (target - balance * f) / ((f - 1) / i));
}
function monthsBetweenToday(dateStr) {
  if (!dateStr) return null;
  const t = new Date(); const d = new Date(dateStr + "T00:00:00");
  return (d.getFullYear() - t.getFullYear()) * 12 + (d.getMonth() - t.getMonth());
}
function monthsFromNowLabel(months) {
  const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() + Math.round(months));
  return d.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
}
function monthsAgoKey(n) { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - n); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0"); }
function ymdLocal(d) { return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
function addDaysStr(ds, n) { const d = new Date(ds + "T00:00:00"); d.setDate(d.getDate() + n); return ymdLocal(d); }
// Mon–Sun calendar week containing `anchor`, shifted by `offset` weeks.
function weekBounds(anchor, offset) {
  const d = new Date(anchor + "T00:00:00"); const dow = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - dow + offset * 7);
  const from = ymdLocal(d), to = addDaysStr(from, 6);
  return { from, to, label: `${fmtShort(from)} – ${fmtShort(to)}` };
}
// Calendar month containing `anchor`, shifted by `offset` months.
function monthBoundsStr(anchor, offset) {
  const d = new Date(anchor + "T00:00:00"); d.setDate(1); d.setMonth(d.getMonth() + offset);
  const from = ymdLocal(d), to = ymdLocal(new Date(d.getFullYear(), d.getMonth() + 1, 0));
  return { from, to, label: d.toLocaleDateString("en-GB", { month: "long", year: "numeric" }) };
}
// Pay-period from a payday config (monthly day-of-month, or weekly weekday).
function payPeriodBounds(payday, anchor, offset) {
  payday = payday || { type: "monthly", day: 1 };
  if (payday.type === "weekly") {
    const w = Number(payday.day) || 5; // 0=Sun..6=Sat (default Fri)
    const d = new Date(anchor + "T00:00:00");
    const back = (d.getDay() - w + 7) % 7; d.setDate(d.getDate() - back + offset * 7);
    const from = ymdLocal(d), to = addDaysStr(from, 6);
    // Payday-to-next-payday so the boundaries read clearly, e.g. "29th May to 5th June".
    return { from, to, label: `${fmtDM(from)} to ${fmtDM(addDaysStr(from, 7))}` };
  }
  if (payday.type === "lastWeekday") {
    const w = Number(payday.day); // 0=Sun..6=Sat
    const lastOf = (y, m) => { const e = new Date(y, m + 1, 0); while (e.getDay() !== w) e.setDate(e.getDate() - 1); return e; };
    const a = new Date(anchor + "T00:00:00");
    let start = lastOf(a.getFullYear(), a.getMonth());
    if (a < start) start = lastOf(a.getFullYear(), a.getMonth() - 1);
    start = lastOf(start.getFullYear(), start.getMonth() + offset);
    const next = lastOf(start.getFullYear(), start.getMonth() + 1);
    // Show the actual paydays at each end, e.g. "29th May to 29th June".
    return { from: ymdLocal(start), to: addDaysStr(ymdLocal(next), -1), label: `${fmtDM(ymdLocal(start))} to ${fmtDM(ymdLocal(next))}` };
  }
  const day = Math.min(28, Math.max(1, Number(payday.day) || 1));
  const d = new Date(anchor + "T00:00:00");
  let start = new Date(d.getFullYear(), d.getMonth(), day);
  if (d < start) start = new Date(d.getFullYear(), d.getMonth() - 1, day);
  start = new Date(start.getFullYear(), start.getMonth() + offset, day);
  const next = new Date(start.getFullYear(), start.getMonth() + 1, day);
  const endD = new Date(next); endD.setDate(endD.getDate() - 1);
  const from = ymdLocal(start), to = ymdLocal(endD);
  return { from, to, label: `${fmtDM(from)} to ${fmtDM(ymdLocal(next))}` };
}
// One month's report snapshot (persisted so it survives the 6-month txn prune).
// Current net worth (assets − debts) from today's balances. Used for the home
// snapshot and as a fallback when a month has no saved net-worth snapshot.
function currentNetWorth(state) {
  const cur = (state.currentAccounts || []).reduce((s, a) => s + (Number(a.balance) || 0), 0);
  const sav = (state.savingsAccounts || []).reduce((s, a) => s + (Number(a.balance) || 0), 0);
  const debt = (state.debts || []).reduce((s, d) => s + (Number(d.balance) || 0), 0);
  return cur + sav + investmentTotals(state.investments).value + pensionPotsTotal(state) - debt;
}
function computeMonthReport(state, mk) {
  const st = monthStats(state, mk);
  const giftsCat = (state.financeCategories || []).find(c => c.id === "g_gifts") || (state.financeCategories || []).find(c => /gift/i.test(c.name));
  const giftId = giftsCat && giftsCat.id;
  const gifts = (state.transactions || []).filter(t => t.type !== "income" && (t.date || "").slice(0, 7) === mk && t.categoryId === giftId).length;
  const nwHist = state.netWorthHistory || {};
  const netWorth = nwHist[mk] != null ? nwHist[mk] : currentNetWorth(state);
  return { forecast: st.plannedTotal, actual: st.spend, income: st.income, saved: Math.max(0, st.income - st.spend),
    savedInto: st.savingsContrib, debtPaid: st.debtPayments, netWorth,
    debt: (state.debts || []).reduce((s, d) => s + (Number(d.balance) || 0), 0), gifts };
}

// ── Pension forecast ─────────────────────────────────────────────────────────
// Projects a pension pot year-by-year to retirement. Contributions are a % of
// salary (employee + employer); salary grows with inflation; the pot compounds at
// `growthPct`. Returns nominal + real (today's money) figures plus a 4%-rule income.
function pensionForecast(p) {
  p = p || {};
  const pot0 = Number(p.currentPot) || 0;
  const empPct = (Number(p.employeePct) || 0) / 100;
  const erPct = (Number(p.employerPct) || 0) / 100;
  const growth = (Number(p.growthPct) || 0) / 100;
  const infl = (Number(p.inflationPct) || 0) / 100;
  const age = Number(p.currentAge) || 0;
  const retire = Number(p.retireAge) || 0;
  const years = Math.max(0, retire - age);
  const contributing = p.contributing !== false; // false = paid-up, growth only
  let pot = pot0, salary = Number(p.salary) || 0, totalContrib = 0;
  const series = [{ age, pot }];
  for (let y = 0; y < years; y++) {
    const contrib = contributing ? salary * (empPct + erPct) : 0;
    totalContrib += contrib;
    pot = pot * (1 + growth) + contrib;
    salary = salary * (1 + infl);
    series.push({ age: age + y + 1, pot });
  }
  const realFactor = years > 0 ? Math.pow(1 + infl, years) : 1;
  const potReal = pot / realFactor;
  return {
    years, finalPot: pot, finalPotReal: potReal,
    totalContributions: totalContrib, growthEarned: pot - pot0 - totalContrib,
    annualIncome4: pot * 0.04, annualIncome4Real: potReal * 0.04, series,
  };
}
// Full new UK State Pension (2024/25): £221.20/week ≈ £11,502/yr. Editable per person.
const STATE_PENSION_WEEKLY = 221.20;
// The working list of pensions — new array, or migrate the legacy single pension in.
function pensionList(state) {
  const list = state.pensions;
  if (Array.isArray(list) && list.length) return list;
  const legacy = state.pension || {};
  if (Object.keys(legacy).some(k => legacy[k] !== "" && legacy[k] != null && legacy[k] !== 0)) {
    return [{ id: "legacy", name: "My pension", type: "private", contributing: true, ...legacy }];
  }
  return [];
}
// State pension is an annual income from state-pension age, not a pot.
function statePensionAnnual(p) { return (Number(p.weekly) || STATE_PENSION_WEEKLY) * 52; }
// Total of all PRIVATE pension pots (state pension has no pot).
function pensionPotsTotal(state) {
  return pensionList(state).filter(p => p.type !== "state").reduce((s, p) => s + (Number(p.currentPot) || 0), 0);
}
// Your monthly contribution into all contributing private pensions (employee share only).
function pensionMonthlyContribution(state) {
  return pensionList(state).filter(p => p.type !== "state" && p.contributing !== false)
    .reduce((s, p) => s + ((Number(p.salary) || 0) * (Number(p.employeePct) || 0) / 100) / 12, 0);
}
// How many years a pot lasts drawing `annualDraw`, compounding at `growthPct`.
function potLastsYears(pot, annualDraw, growthPct) {
  pot = Number(pot) || 0; annualDraw = Number(annualDraw) || 0;
  const g = (Number(growthPct) || 0) / 100;
  if (annualDraw <= 0) return Infinity;
  let y = 0, b = pot;
  while (b > 0 && y < 100) { b = b * (1 + g) - annualDraw; y++; }
  return y >= 100 ? Infinity : y;
}

// ── Investments ──────────────────────────────────────────────────────────────
// Roll a list of holdings into portfolio value, cost basis and gain.
function investmentTotals(list) {
  let value = 0, cost = 0;
  (list || []).forEach(h => {
    const u = Number(h.units) || 0;
    value += u * (Number(h.price) || 0);
    cost += u * (Number(h.avgCost) || 0);
  });
  return { value, cost, gain: value - cost, gainPct: cost > 0 ? (value - cost) / cost * 100 : 0 };
}
function holdingValue(h) { return (Number(h.units) || 0) * (Number(h.price) || 0); }

// ── Digital Life Audit ───────────────────────────────────────────────────────
const AUDIT_SECTIONS = [
  { id: "security", icon: "🔐", title: "Security", items: [
    { id: "sec_2fa_email", label: "Two-factor auth on your email" },
    { id: "sec_2fa_key", label: "Two-factor auth on banking & key accounts" },
    { id: "sec_pwmgr", label: "Using a password manager" },
    { id: "sec_unique", label: "No reused passwords on important accounts" },
    { id: "sec_hibp", label: "Checked haveibeenpwned.com for breaches" },
    { id: "sec_recovery", label: "Recovery email / phone up to date" },
    { id: "sec_lock", label: "Devices lock with PIN or biometrics" },
    { id: "sec_updates", label: "Phone & computer software up to date" },
  ] },
  { id: "hygiene", icon: "🧹", title: "Data hygiene", items: [
    { id: "hyg_unused", label: "Closed or deleted unused accounts" },
    { id: "hyg_apps", label: "Reviewed third-party app permissions (Google/Apple/Facebook logins)" },
    { id: "hyg_backup", label: "Photos & key documents backed up" },
    { id: "hyg_inbox", label: "Cleared old emails / downloads" },
    { id: "hyg_privacy", label: "Reviewed privacy settings on social media" },
    { id: "hyg_spam", label: "Unsubscribed from junk newsletters" },
  ] },
];
const AUDIT_STATUS_COLOR = { good: "#1D9E75", warn: "#BA7517", bad: "#E24B4A" };

// Total monthly subscription spend (manual + auto-detected, de-duplicated).
function auditSubsMonthly(state) {
  const manual = state.subscriptions || [];
  const manualTotal = manual.reduce((s, x) => s + (Number(x.amount) || 0), 0);
  const autoTotal = detectSubscriptions(state)
    .filter(a => !manual.some(m => (m.name || "").toLowerCase() === a.name.toLowerCase()))
    .reduce((s, a) => s + a.amount, 0);
  return manualTotal + autoTotal;
}
// Derive a financial-health scorecard from existing finance state. Pure, no input.
function financialHealth(state) {
  const stats = monthStats(state, curMonthKey());
  const savAccts = state.savingsAccounts || [];
  const savings = savAccts.reduce((s, a) => s + (Number(a.balance) || 0), 0);
  const investVal = investmentTotals(state.investments).value;
  const pensionVal = pensionPotsTotal(state);
  const currentVal = (state.currentAccounts || []).reduce((s, a) => s + (Number(a.balance) || 0), 0);
  const debtTotal = (state.debts || []).reduce((s, d) => s + (Number(d.balance) || 0), 0);
  const netWorth = currentVal + savings + investVal + pensionVal - debtTotal;
  const income = stats.income || stats.incomeProjected || 0;
  const monthlySpend = stats.spend || stats.plannedTotal || 0;
  const contrib = savAccts.reduce((s, a) => s + (Number(a.contribution) || 0), 0);
  // Emergency fund: prefer accounts explicitly flagged as emergency funds; else all savings.
  const efAccts = savAccts.filter(a => a.type === "emergency");
  const efPot = efAccts.length ? efAccts.reduce((s, a) => s + (Number(a.balance) || 0), 0) : savings;
  const efMonths = monthlySpend > 0 ? efPot / monthlySpend : null;
  const savingsRate = income > 0 ? contrib / income * 100 : null;
  const subs = auditSubsMonthly(state);
  const subsPct = income > 0 ? subs / income * 100 : null;
  const monthNet = income - monthlySpend;
  const indicators = [
    { label: "Net worth", value: fmtMoney(netWorth, true), status: netWorth > 0 ? "good" : netWorth === 0 ? "warn" : "bad",
      note: `Savings ${fmtMoney(savings, true)}${investVal > 0 ? ` + investments ${fmtMoney(investVal, true)}` : ""}${pensionVal > 0 ? ` + pension ${fmtMoney(pensionVal, true)}` : ""}${debtTotal > 0 ? ` − debts ${fmtMoney(debtTotal, true)}` : ""}` },
    { label: "Emergency fund", value: efMonths == null ? "—" : `${efMonths.toFixed(1)} mo`, status: efMonths == null ? "warn" : efMonths >= 6 ? "good" : efMonths >= 3 ? "warn" : "bad",
      note: efMonths == null ? "Add savings & spending to gauge this" : `${efAccts.length ? "Your emergency fund" : "Your savings"} would cover this many months of spending (aim 3–6)` },
    { label: "Savings rate", value: savingsRate == null ? "—" : `${savingsRate.toFixed(0)}%`, status: savingsRate == null ? "warn" : savingsRate >= 20 ? "good" : savingsRate >= 10 ? "warn" : "bad",
      note: "Monthly savings as a share of income (aim 20%+)" },
    { label: "This month", value: `${monthNet >= 0 ? "+" : "−"}${fmtMoney(Math.abs(monthNet), true)}`, status: monthNet >= 0 ? "good" : "bad",
      note: `Income ${fmtMoney(income, true)} − spend ${fmtMoney(monthlySpend, true)}` },
    { label: "Debt", value: fmtMoney(debtTotal, true), status: debtTotal <= 0 ? "good" : "warn",
      note: debtTotal <= 0 ? "No tracked debts — nice" : "Tracked in Finance → Savings → Net worth" },
    { label: "Subscriptions", value: `${fmtMoney(subs, true)}/mo`, status: subsPct == null ? "warn" : subsPct < 5 ? "good" : subsPct <= 10 ? "warn" : "bad",
      note: `${fmtMoney(subs * 12, true)}/yr${subsPct != null ? ` · ${subsPct.toFixed(0)}% of income` : ""}` },
  ];
  return { netWorth, indicators };
}

// Sum spend/income/by-category over an inclusive date range [from, to] (YYYY-MM-DD).
function rangeStats(state, from, to) {
  const cats = state.financeCategories || [];
  const txns = (state.transactions || []).filter(t => { const d = t.date || ""; return d >= from && d <= to; });
  let spent = 0, earnt = 0; const byCat = {}; const merchants = {};
  cats.forEach(c => { byCat[c.id] = 0; });
  txns.forEach(t => {
    const amt = Number(t.amount) || 0;
    if (t.type === "income") { earnt += amt; return; }
    spent += amt;
    if (byCat[t.categoryId] != null) byCat[t.categoryId] += amt;
    const m = (t.description || "Other").trim(); merchants[m] = (merchants[m] || 0) + amt;
  });
  const days = Math.max(1, Math.round((new Date(to) - new Date(from)) / 86400000) + 1);
  const topMerchants = Object.entries(merchants).sort((a, b) => b[1] - a[1]).slice(0, 5);
  return { txns, spent, earnt, net: earnt - spent, byCat, days, count: txns.length, topMerchants };
}

// Roll up one month's budget + transactions into the numbers every finance view needs.
// Projected = the plan. Actual = real transactions for a group when present, otherwise the
// manually-typed Actual column (which the Lloyds link will replace in Phase B).
function monthStats(state, mk) {
  const cats = state.financeCategories || [];
  const txns = (state.transactions || []).filter(t => (t.date || "").slice(0, 7) === mk);
  const plan = (state.financePlans || {})[mk] || {};
  const byItem = plan.byItem || {};

  // Real transactions grouped by category (the eventual source of "actual").
  const txnByCat = {}; let txnIncome = 0;
  txns.forEach(t => {
    const amt = Number(t.amount) || 0;
    if (t.type === "income") { txnIncome += amt; return; }
    txnByCat[t.categoryId] = (txnByCat[t.categoryId] || 0) + amt;
  });

  // Auto-costs: planned outgoings carried by tasks (by their plan/deadline month) and
  // important dates (recurring yearly → match the month). Aligned to a budget category.
  const autoByCat = {};
  const pushAuto = (catId, entry) => { if (catId) (autoByCat[catId] = autoByCat[catId] || []).push(entry); };
  (state.tasks || []).forEach(t => {
    const amt = Number(t.cost) || 0;
    const day = t.scheduledDate || t.deadline;
    if (amt > 0 && t.costCategory && day && day.slice(0, 7) === mk) pushAuto(t.costCategory, { label: t.title || "Task", amount: amt, source: "task" });
  });
  (state.importantDates || []).forEach(d => {
    const amt = Number(d.cost) || 0;
    if (amt > 0 && d.costCategory && dateOccursInMonth(d, mk)) pushAuto(d.costCategory, { label: d.title || "Important date", amount: amt, source: "date" });
  });
  // Insurance premiums recur every month: monthly premium as-is; annual spread /12 (sinking fund).
  (state.insurance || []).forEach(p => {
    const prem = Number(p.premium) || 0;
    if (prem <= 0 || !p.budgetCategory) return;
    const monthly = p.frequency === "annual" ? prem / 12 : prem;
    pushAuto(p.budgetCategory, { label: `${p.type || "Insurance"}${p.provider ? " · " + p.provider : ""}`, amount: monthly, source: "insurance" });
  });

  const byCat = {};
  let plannedTotal = 0, manualActualTotal = 0;
  cats.forEach(c => {
    let itemsPlanned = 0, manualActual = 0;
    (c.items || []).forEach(it => {
      const v = byItem[it.id] || {};
      itemsPlanned += Number(v.projected) || 0;
      manualActual += Number(v.actual) || 0;
    });
    const auto = autoByCat[c.id] || [];
    const autoSum = auto.reduce((s, a) => s + a.amount, 0);
    const planned = itemsPlanned + autoSum; // task/date costs add to projected
    const spent = txnByCat[c.id] != null ? txnByCat[c.id] : manualActual; // txns override manual
    byCat[c.id] = { planned, itemsPlanned, autoSum, auto, manualActual, spent };
    plannedTotal += planned; manualActualTotal += manualActual;
  });

  // Auto commitments pulled from the Savings & Debts / Pension tabs (made there first).
  const savingsContrib = (state.savingsAccounts || []).reduce((s, a) => s + (Number(a.contribution) || 0), 0);
  const debtPayments = (state.debts || []).reduce((s, d) => { const pl = debtPlan(d); return s + (pl.hasTerm ? pl.monthly : (Number(d.minPayment) || 0)); }, 0);
  const pensionContrib = pensionMonthlyContribution(state);
  const commitments = savingsContrib + debtPayments + pensionContrib;
  plannedTotal += commitments;

  const incomeKeys = ["income", "income2", "extra"];
  const incomeProjected = incomeKeys.reduce((s, k) => s + (Number((plan[k] || {}).projected) || 0), 0);
  const incomeManualActual = incomeKeys.reduce((s, k) => s + (Number((plan[k] || {}).actual) || 0), 0);
  const incomeActual = txnIncome > 0 ? txnIncome : incomeManualActual;
  const spend = cats.reduce((s, c) => s + byCat[c.id].spent, 0);

  return { txns, plan, byItem, byCat, incomeProjected, incomeManualActual, incomeActual, income: incomeActual, spend, plannedTotal, manualActualTotal, savingsContrib, debtPayments, pensionContrib, commitments };
}

// Best-effort, offline plan parser ("groceries 100, fuel 80, spotify 13, income 2289").
// Splits into clauses (comma / "and") and reads one amount + one line item per clause,
// matching on item name first, then group name. Phase B swaps this for a Claude call
// with this as the fallback.
function localParsePlan(text, cats) {
  const out = { byItem: {}, income: null };
  const items = [];
  cats.forEach(c => (c.items || []).forEach(it => items.push({ id: it.id, name: it.name.toLowerCase(), group: c.name.toLowerCase() })));
  const clauses = text.toLowerCase().split(/[,;\n]|\band\b/);
  clauses.forEach(cl => {
    const m = cl.match(/([\d][\d,]*(?:\.\d+)?)/);
    if (!m) return;
    const val = parseFloat(m[1].replace(/,/g, ""));
    if (/income|salary|earn|take[\s-]?home|wage/.test(cl)) { out.income = val; return; }
    const matched = items.find(it => cl.includes(it.name)) || items.find(it => cl.includes(it.group));
    if (matched) out.byItem[matched.id] = val;
  });
  return out;
}

// Demo transactions across the last 3 months so charts have something to show.
function makeSampleTransactions(cats) {
  const spend = cats.filter(c => c.kind !== "savings");
  const sav = cats.find(c => c.kind === "savings");
  const byName = {};
  cats.forEach(c => { byName[c.name.toLowerCase()] = c; });
  const merchants = {
    food: ["Tesco", "Sainsbury's", "Pret", "Deliveroo", "Co-op", "Greggs"],
    transportation: ["Shell", "BP", "Esso", "Trainline", "Uber"],
    housing: ["Lloyds Mortgage", "B&Q", "Homebase"],
    entertainment: ["Spotify", "Starlink", "Cineworld", "Costa Coffee", "The Crown (pub)"],
    loans: ["Club Lloyds", "Loan repayment"],
    "personal care": ["Boots", "Apple", "Superdrug", "Barber"]
  };
  const txns = [];
  const rnd = (a, b) => Math.round((a + Math.random() * (b - a)) * 100) / 100;
  for (let back = 2; back >= 0; back--) {
    const mk = shiftMonth(curMonthKey(), -back);
    const [y, m] = mk.split("-").map(Number);
    const dim = new Date(y, m, 0).getDate();
    const day = d => `${mk}-${String(Math.min(d, dim)).padStart(2, "0")}`;
    // Monthly salary in
    txns.push({ id: genId(), date: day(1), amount: rnd(2200, 2400), description: "Salary — ACME Ltd", type: "income", categoryId: "" });
    // A spread of spending
    spend.forEach(c => {
      const key = c.name.toLowerCase();
      const list = merchants[key] || ["Card payment"];
      const n = 3 + Math.floor(Math.random() * 4);
      for (let i = 0; i < n; i++) {
        txns.push({ id: genId(), date: day(2 + Math.floor(Math.random() * (dim - 3))), amount: rnd(6, key === "housing" ? 420 : 55), description: list[Math.floor(Math.random() * list.length)], type: "spend", categoryId: c.id });
      }
    });
    // A transfer to savings
    if (sav) txns.push({ id: genId(), date: day(2), amount: rnd(150, 300), description: "Transfer to savings", type: "spend", categoryId: sav.id });
  }
  return txns.sort((a, b) => b.date.localeCompare(a.date));
}

// ── Finance: charts (lightweight SVG, no libraries) ──────────────────────────

function Donut({ segments, size = 150, thickness = 24, center }) {
  const total = segments.reduce((s, x) => s + (x.value || 0), 0);
  const r = (size - thickness) / 2, cx = size / 2, cy = size / 2, circ = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--color-background-secondary)" strokeWidth={thickness} />
        {total > 0 && segments.map((s, i) => {
          const len = (s.value / total) * circ;
          const el = <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={s.color} strokeWidth={thickness} strokeDasharray={`${len} ${circ - len}`} strokeDashoffset={-offset} transform={`rotate(-90 ${cx} ${cy})`} />;
          offset += len;
          return el;
        })}
      </svg>
      {center && <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center" }}>{center}</div>}
    </div>
  );
}

function BarsChart({ data, height = 150, money }) {
  const max = Math.max(1, ...data.map(d => d.value || 0));
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 10, height }}>
      {data.map((d, i) => (
        <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 5, height: "100%", justifyContent: "flex-end" }}>
          <div style={{ fontSize: 10, color: "var(--color-text-secondary)", fontWeight: 500 }}>{d.value ? (money ? fmtMoney(d.value, true) : d.value) : ""}</div>
          <div title={`${d.label}: ${money ? fmtMoney(d.value) : d.value}`} style={{ width: "100%", maxWidth: 44, height: `${(d.value / max) * 100}%`, minHeight: d.value > 0 ? 4 : 0, background: d.color, borderRadius: "6px 6px 0 0", transition: "height 0.4s" }} />
          <div style={{ fontSize: 10, color: "var(--color-text-secondary)", whiteSpace: "nowrap" }}>{d.label}</div>
        </div>
      ))}
    </div>
  );
}

// ── Finance: modals ──────────────────────────────────────────────────────────

function TxnModal({ txn, cats, accentColor, onSave, onClose }) {
  const spend = cats.filter(c => c.kind !== "income");
  const defaults = { date: todayStr(), amount: "", description: "", type: "spend", categoryId: spend[0]?.id || "" };
  const [t, setT] = useState({ ...defaults, ...(txn || {}) });
  const up = (k, v) => setT(p => ({ ...p, [k]: v }));
  function save() {
    const amt = parseFloat(t.amount);
    if (!amt || amt <= 0) return alert("Enter an amount greater than zero.");
    onSave({ ...t, id: t.id || genId(), amount: Math.round(amt * 100) / 100, source: t.source || "manual" });
  }
  return (
    <Modal onClose={onClose} width={400}>
      <ModalHeader title={txn?.id ? "Edit transaction" : "New transaction"} onClose={onClose} />
      <Field label="Type">
        <div style={{ display: "flex", gap: 6 }}>
          {[["spend", "💸 Spending"], ["income", "💰 Income"]].map(([v, l]) => (
            <button key={v} onClick={() => up("type", v)} style={{ flex: 1, padding: "7px 4px", borderRadius: 8, border: `1.5px solid ${t.type === v ? accentColor : "var(--color-border-tertiary)"}`, background: t.type === v ? hex2rgba(accentColor, 0.1) : "transparent", color: t.type === v ? accentColor : "var(--color-text-secondary)", fontSize: 12, fontWeight: t.type === v ? 500 : 400, cursor: "pointer" }}>{l}</button>
          ))}
        </div>
      </Field>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="Amount (£)"><input type="number" step="0.01" placeholder="0.00" value={t.amount} onChange={e => up("amount", e.target.value)} style={{ width: "100%", boxSizing: "border-box" }} autoFocus /></Field>
        <Field label="Date"><input type="date" value={t.date} onChange={e => up("date", e.target.value)} style={{ width: "100%", boxSizing: "border-box" }} /></Field>
      </div>
      <Field label="Description"><input placeholder="e.g. Tesco, salary…" value={t.description} onChange={e => up("description", e.target.value)} style={{ width: "100%", boxSizing: "border-box" }} /></Field>
      {t.type === "spend" && (
        <Field label="Category">
          <select value={t.categoryId} onChange={e => up("categoryId", e.target.value)} style={{ width: "100%" }}>
            {spend.map(c => <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>)}
          </select>
        </Field>
      )}
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 18 }}>
        <button onClick={onClose} style={{ padding: "9px 16px", fontSize: 13, borderRadius: 9 }}>Cancel</button>
        <button onClick={save} style={{ padding: "9px 20px", fontSize: 13, background: accentColor, color: "#fff", border: "none", borderRadius: 9, cursor: "pointer", fontWeight: 500 }}>{txn?.id ? "Save" : "Add"}</button>
      </div>
    </Modal>
  );
}

function FinanceCatModal({ cat, accentColor, onSave, onClose }) {
  const [name, setName] = useState(cat?.name || "");
  const [emoji, setEmoji] = useState(cat?.emoji || "🛒");
  const [color, setColor] = useState(cat?.color || "#7F77DD");
  const [kind, setKind] = useState(cat?.kind || "spending");
  return (
    <Modal onClose={onClose} width={360}>
      <ModalHeader title={cat?.id ? "Edit category" : "New category"} onClose={onClose} />
      <Field label="Name"><input placeholder="e.g. Food, Travel…" value={name} onChange={e => setName(e.target.value)} style={{ width: "100%", boxSizing: "border-box" }} autoFocus /></Field>
      <Field label="Type">
        <div style={{ display: "flex", gap: 6 }}>
          {[["spending", "Spending"], ["savings", "Savings"]].map(([v, l]) => (
            <button key={v} onClick={() => setKind(v)} style={{ flex: 1, padding: "7px 4px", borderRadius: 8, border: `1.5px solid ${kind === v ? accentColor : "var(--color-border-tertiary)"}`, background: kind === v ? hex2rgba(accentColor, 0.1) : "transparent", color: kind === v ? accentColor : "var(--color-text-secondary)", fontSize: 12, fontWeight: kind === v ? 500 : 400, cursor: "pointer" }}>{l}</button>
          ))}
        </div>
      </Field>
      <Field label="Icon">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {FINANCE_EMOJIS.map(e => <span key={e} onClick={() => setEmoji(e)} style={{ fontSize: 22, cursor: "pointer", padding: 6, borderRadius: 8, background: emoji === e ? "var(--color-background-secondary)" : "transparent", border: emoji === e ? "1.5px solid var(--color-border-secondary)" : "1.5px solid transparent" }}>{e}</span>)}
        </div>
      </Field>
      <Field label="Colour">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {TAG_COLORS.map(c => <span key={c} onClick={() => setColor(c)} style={{ width: 26, height: 26, borderRadius: "50%", background: c, cursor: "pointer", border: color === c ? "3px solid var(--color-text-primary)" : "3px solid transparent" }} />)}
        </div>
      </Field>
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 18 }}>
        <button onClick={onClose} style={{ padding: "9px 16px", fontSize: 13, borderRadius: 9 }}>Cancel</button>
        <button onClick={() => { if (name.trim()) onSave({ id: cat?.id || genId(), name: name.trim(), emoji, color, kind }); }} style={{ padding: "9px 20px", fontSize: 13, background: accentColor, color: "#fff", border: "none", borderRadius: 9, cursor: "pointer", fontWeight: 500 }}>{cat?.id ? "Save" : "Add"}</button>
      </div>
    </Modal>
  );
}

// ── Finance: the workspace ───────────────────────────────────────────────────

const FINANCE_TABS = [
  { id: "dashboard", icon: "📊", label: "Dashboard" },
  { id: "plan", icon: "🎯", label: "Breakdown Plan" },
  { id: "savings", icon: "🐖", label: "Savings & Debts" },
  { id: "investments", icon: "💹", label: "Investments" },
  { id: "pension", icon: "🏖", label: "Pension" },
  { id: "subs", icon: "🔁", label: "Subscriptions" },
  { id: "trends", icon: "📈", label: "Reports & Trends" },
  { id: "transactions", icon: "💳", label: "Transactions" },
  { id: "categories", icon: "🏷", label: "Categories" },
  { id: "connect", icon: "🏦", label: "Connect bank" }
];

// Detect likely recurring payments from transactions: same (normalised) description
// appearing in 2+ distinct months. Returns [{name, amount, lastDate, months, categoryId}].
function detectSubscriptions(state) {
  const norm = s => String(s || "").toLowerCase().replace(/\s+/g, " ").trim();
  const byName = {};
  (state.transactions || []).forEach(t => {
    if (t.type === "income") return;
    const k = norm(t.description);
    if (!k) return;
    (byName[k] = byName[k] || { name: (t.description || "").trim(), amounts: [], months: new Set(), lastDate: "", categoryId: t.categoryId }).amounts.push(Number(t.amount) || 0);
    byName[k].months.add((t.date || "").slice(0, 7));
    if ((t.date || "") > byName[k].lastDate) { byName[k].lastDate = t.date || ""; byName[k].categoryId = t.categoryId; }
  });
  return Object.values(byName).filter(x => x.months.size >= 2).map(x => ({
    name: x.name, amount: Math.round((x.amounts.reduce((a, b) => a + b, 0) / x.amounts.length) * 100) / 100,
    lastDate: x.lastDate, months: x.months.size, categoryId: x.categoryId, auto: true
  })).sort((a, b) => b.amount - a.amount);
}
// Parse a Lloyds (or generic) bank CSV into transactions.
function parseBankCSV(text, cats) {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (!lines.length) return [];
  const splitRow = l => { const out = []; let cur = "", q = false; for (let i = 0; i < l.length; i++) { const c = l[i]; if (c === '"') q = !q; else if (c === "," && !q) { out.push(cur); cur = ""; } else cur += c; } out.push(cur); return out.map(s => s.trim().replace(/^"|"$/g, "")); };
  const header = splitRow(lines[0]).map(h => h.toLowerCase());
  const idx = (...names) => { for (const n of names) { const i = header.findIndex(h => h.includes(n)); if (i >= 0) return i; } return -1; };
  const di = idx("transaction date", "date"), de = idx("description", "details", "reference"), dr = idx("debit"), cr = idx("credit"), am = idx("amount"), ty = idx("type");
  const toISO = s => { const m = (s || "").match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/); if (m) { let y = m[3]; if (y.length === 2) y = "20" + y; return y + "-" + m[2].padStart(2, "0") + "-" + m[1].padStart(2, "0"); } const m2 = (s || "").match(/(\d{4})-(\d{2})-(\d{2})/); return m2 ? m2[0] : ""; };
  const guessCat = desc => { const d = (desc || "").toLowerCase(); const map = [["g_food", ["tesco", "sainsbury", "asda", "aldi", "lidl", "co-op", "coop", "morrisons", "waitrose", "deliveroo", "uber eats", "just eat", "greggs", "pret", "mcdonald", "costa", "starbucks", "restaurant", "cafe"]], ["g_transport", ["shell", "bp", "esso", "texaco", "fuel", "petrol", "tfl", "trainline", "uber", "rail", "parking", "national rail"]], ["g_ent", ["spotify", "netflix", "disney", "cinema", "starlink", "steam", "playstation", "xbox", "prime video"]], ["g_housing", ["mortgage", "rent", "british gas", "octopus", "water", "council tax", "thames"]], ["g_loans", ["club lloyds", "loan", "finance", "credit"]], ["g_personal", ["boots", "superdrug", "gym", "pharmacy", "apple.com", "phone"]]]; for (const [cid, kws] of map) { if ((cats || []).some(c => c.id === cid) && kws.some(k => d.includes(k))) return cid; } return ""; };
  const out = [];
  for (let i = 1; i < lines.length; i++) {
    const r = splitRow(lines[i]); if (!r.length || r.every(c => !c)) continue;
    const date = toISO(di >= 0 ? r[di] : r[0]); if (!date) continue;
    const desc = de >= 0 ? r[de] : (r[1] || "Transaction");
    let amount = 0, type = "spend";
    if (dr >= 0 || cr >= 0) { const d = parseFloat((r[dr] || "").replace(/[^\d.\-]/g, "")) || 0; const c = parseFloat((r[cr] || "").replace(/[^\d.\-]/g, "")) || 0; if (c > 0) { amount = c; type = "income"; } else { amount = d; type = "spend"; } }
    else if (am >= 0) { const v = parseFloat((r[am] || "").replace(/[^\d.\-]/g, "")) || 0; amount = Math.abs(v); type = v >= 0 ? "income" : "spend"; }
    if (!amount) continue;
    out.push({ id: genId(), date, description: desc, amount: Math.round(amount * 100) / 100, type, categoryId: type === "spend" ? guessCat(desc) : "", source: "csv" });
  }
  return out;
}

function StatCard({ label, value, color, sub }) {
  return (
    <div style={{ background: "var(--color-background-primary)", borderRadius: 12, padding: "16px 16px", border: "0.5px solid var(--color-border-tertiary)" }}>
      <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 23, fontWeight: 600, color: color || "var(--color-text-primary)" }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "var(--color-text-secondary)", marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

// A right-aligned £ amount input cell, sized to line up with the budget table columns.
function MoneyCell({ value, onChange }) {
  return (
    <div style={{ width: 96, display: "flex", justifyContent: "flex-end" }}>
      <input type="number" step="0.01" value={value ? value : ""} placeholder="0"
        onFocus={e => e.target.select()}
        onChange={e => onChange(e.target.value === "" ? 0 : (parseFloat(e.target.value) || 0))}
        style={{ width: 84, textAlign: "right", fontSize: 13, padding: "5px 7px", boxSizing: "border-box" }} />
    </div>
  );
}

// Inline "add a line item" row with its own draft state.
function AddItemRow({ accentColor, onAdd }) {
  const [name, setName] = useState("");
  const add = () => { if (name.trim()) { onAdd(name.trim()); setName(""); } };
  return (
    <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
      <input value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === "Enter" && add()} placeholder="+ Add line item…" style={{ flex: 1, fontSize: 13 }} />
      <button onClick={add} style={{ padding: "0 14px", fontSize: 13, color: accentColor }}>Add</button>
    </div>
  );
}

function CurrentAccountModal({ account, accentColor, onSave, onClose }) {
  const blank = { name: "", institution: "", balance: "", linked: false };
  const [a, setA] = useState({ ...blank, ...(account || {}) });
  const up = (k, v) => setA(x => ({ ...x, [k]: v }));
  const ac = accentColor;
  const inp = { width: "100%", boxSizing: "border-box" };
  return (
    <Modal onClose={onClose} width={400}>
      <ModalHeader title={account?.id ? "Edit current account" : "New current account"} onClose={onClose} />
      <Field label="Name"><input placeholder="e.g. Lloyds Club, Monzo" value={a.name} onChange={e => up("name", e.target.value)} style={inp} autoFocus /></Field>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="Bank / provider"><input placeholder="e.g. Lloyds" value={a.institution} onChange={e => up("institution", e.target.value)} style={inp} /></Field>
        <Field label="Current balance (£)"><input type="number" step="0.01" placeholder="0.00" value={a.balance} onChange={e => up("balance", e.target.value)} style={inp} /></Field>
      </div>
      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--color-text-secondary)", cursor: "pointer" }}>
        <input type="checkbox" checked={!!a.linked} onChange={e => up("linked", e.target.checked)} /> Link this to my bank (auto-updates once Open Banking is on — Phase B)
      </label>
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 18 }}>
        <button onClick={onClose} style={{ padding: "9px 16px", fontSize: 13, borderRadius: 9 }}>Cancel</button>
        <button onClick={() => { if (a.name.trim()) onSave({ id: account?.id || genId(), name: a.name.trim(), institution: a.institution, balance: parseFloat(a.balance) || 0, linked: !!a.linked }); }} style={{ padding: "9px 20px", fontSize: 13, background: ac, color: "#fff", border: "none", borderRadius: 9, cursor: "pointer", fontWeight: 500 }}>{account?.id ? "Save" : "Add"}</button>
      </div>
    </Modal>
  );
}

const SAVINGS_TYPES = [["general", "💰 General savings"], ["emergency", "🚨 Emergency fund"], ["isa", "📈 ISA"], ["goal", "🎯 Goal pot"], ["other", "🏦 Other"]];
function savTypeLabel(t) { const m = SAVINGS_TYPES.find(x => x[0] === t); return m ? m[1] : SAVINGS_TYPES[0][1]; }

function SavingsModal({ account, accentColor, onSave, onClose }) {
  const blank = { name: "", institution: "", type: "general", balance: "", contribution: "", rate: "", target: "", targetDate: "" };
  const [a, setA] = useState({ ...blank, ...(account || {}) });
  const up = (k, v) => setA(x => ({ ...x, [k]: v }));
  const ac = accentColor;
  return (
    <Modal onClose={onClose} width={420}>
      <ModalHeader title={account?.id ? "Edit savings account" : "New savings account"} onClose={onClose} />
      <Field label="Name"><input placeholder="e.g. Rainy day, House deposit" value={a.name} onChange={e => up("name", e.target.value)} style={{ width: "100%", boxSizing: "border-box" }} autoFocus /></Field>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="Account type">
          <select value={a.type || "general"} onChange={e => up("type", e.target.value)} style={{ width: "100%" }}>
            {SAVINGS_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </Field>
        <Field label="Provider / institution"><input placeholder="e.g. Club Lloyds Saver" value={a.institution} onChange={e => up("institution", e.target.value)} style={{ width: "100%", boxSizing: "border-box" }} /></Field>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="Current balance (£)"><input type="number" step="0.01" placeholder="0.00" value={a.balance} onChange={e => up("balance", e.target.value)} style={{ width: "100%", boxSizing: "border-box" }} /></Field>
        <Field label="Monthly contribution (£)"><input type="number" step="0.01" placeholder="0.00" value={a.contribution} onChange={e => up("contribution", e.target.value)} style={{ width: "100%", boxSizing: "border-box" }} /></Field>
        <Field label="Interest rate (% AER)"><input type="number" step="0.01" placeholder="e.g. 4.5" value={a.rate} onChange={e => up("rate", e.target.value)} style={{ width: "100%", boxSizing: "border-box" }} /></Field>
        <Field label="Goal target (£)"><input type="number" step="0.01" placeholder="optional" value={a.target} onChange={e => up("target", e.target.value)} style={{ width: "100%", boxSizing: "border-box" }} /></Field>
      </div>
      <Field label="Target date (optional)"><input type="date" value={a.targetDate || ""} onChange={e => up("targetDate", e.target.value)} style={{ width: "100%", boxSizing: "border-box" }} /></Field>
      <div style={{ fontSize: 11, color: "var(--color-text-secondary)", marginTop: -4 }}>🔒 Balances will sync automatically once your bank is linked. For now, enter them manually.</div>
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 18 }}>
        <button onClick={onClose} style={{ padding: "9px 16px", fontSize: 13, borderRadius: 9 }}>Cancel</button>
        <button onClick={() => { if (a.name.trim()) onSave({ id: account?.id || genId(), name: a.name.trim(), institution: a.institution, type: a.type || "general", balance: parseFloat(a.balance) || 0, contribution: parseFloat(a.contribution) || 0, rate: parseFloat(a.rate) || 0, target: parseFloat(a.target) || 0, targetDate: a.targetDate || "" }); }} style={{ padding: "9px 20px", fontSize: 13, background: ac, color: "#fff", border: "none", borderRadius: 9, cursor: "pointer", fontWeight: 500 }}>{account?.id ? "Save" : "Add"}</button>
      </div>
    </Modal>
  );
}

function InvestmentModal({ holding, accentColor, onSave, onClose }) {
  const blank = { name: "", ticker: "", account: "", units: "", avgCost: "", price: "", contribution: "" };
  const [h, setH] = useState({ ...blank, ...(holding || {}) });
  const up = (k, v) => setH(x => ({ ...x, [k]: v }));
  const ac = accentColor;
  const value = (parseFloat(h.units) || 0) * (parseFloat(h.price) || 0);
  const cost = (parseFloat(h.units) || 0) * (parseFloat(h.avgCost) || 0);
  const gain = value - cost;
  return (
    <Modal onClose={onClose} width={440}>
      <ModalHeader title={holding?.id ? "Edit holding" : "New holding"} onClose={onClose} />
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12 }}>
        <Field label="Name"><input placeholder="e.g. Vanguard S&P 500" value={h.name} onChange={e => up("name", e.target.value)} style={{ width: "100%", boxSizing: "border-box" }} autoFocus /></Field>
        <Field label="Ticker"><input placeholder="VUSA" value={h.ticker} onChange={e => up("ticker", e.target.value)} style={{ width: "100%", boxSizing: "border-box" }} /></Field>
      </div>
      <Field label="Account / platform"><input placeholder="e.g. Trading 212 ISA, Vanguard SIPP" value={h.account} onChange={e => up("account", e.target.value)} style={{ width: "100%", boxSizing: "border-box" }} /></Field>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
        <Field label="Units / shares"><input type="number" step="any" placeholder="0" value={h.units} onChange={e => up("units", e.target.value)} style={{ width: "100%", boxSizing: "border-box" }} /></Field>
        <Field label="Avg cost (£)"><input type="number" step="any" placeholder="0.00" value={h.avgCost} onChange={e => up("avgCost", e.target.value)} style={{ width: "100%", boxSizing: "border-box" }} /></Field>
        <Field label="Price now (£)"><input type="number" step="any" placeholder="0.00" value={h.price} onChange={e => up("price", e.target.value)} style={{ width: "100%", boxSizing: "border-box" }} /></Field>
      </div>
      <Field label="Monthly contribution (£, optional)"><input type="number" step="0.01" placeholder="0.00" value={h.contribution} onChange={e => up("contribution", e.target.value)} style={{ width: "100%", boxSizing: "border-box" }} /></Field>
      {value > 0 && (
        <div style={{ fontSize: 12.5, color: "var(--color-text-secondary)", marginTop: -2 }}>
          Value {fmtMoney(value)} · {gain >= 0 ? "up" : "down"} <span style={{ color: gain >= 0 ? "#1D9E75" : "#E24B4A", fontWeight: 600 }}>{fmtMoney(Math.abs(gain))}</span>{cost > 0 ? ` (${gain >= 0 ? "+" : "−"}${Math.abs(gain / cost * 100).toFixed(1)}%)` : ""}
        </div>
      )}
      <div style={{ fontSize: 11, color: "var(--color-text-secondary)", marginTop: 6 }}>🔒 Live prices &amp; balances will sync once Trading 212 is linked. For now, update prices manually.</div>
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 18 }}>
        <button onClick={onClose} style={{ padding: "9px 16px", fontSize: 13, borderRadius: 9 }}>Cancel</button>
        <button onClick={() => { if (h.name.trim()) onSave({ id: holding?.id || genId(), name: h.name.trim(), ticker: (h.ticker || "").trim().toUpperCase(), account: h.account.trim(), units: parseFloat(h.units) || 0, avgCost: parseFloat(h.avgCost) || 0, price: parseFloat(h.price) || 0, contribution: parseFloat(h.contribution) || 0 }); }} style={{ padding: "9px 20px", fontSize: 13, background: ac, color: "#fff", border: "none", borderRadius: 9, cursor: "pointer", fontWeight: 500 }}>{holding?.id ? "Save" : "Add"}</button>
      </div>
    </Modal>
  );
}

const INSURANCE_TYPES = [
  { v: "Car", icon: "🚗" }, { v: "Home", icon: "🏠" }, { v: "Phone / Gadget", icon: "📱" },
  { v: "Travel", icon: "✈️" }, { v: "Life", icon: "❤️" }, { v: "Health", icon: "🩺" },
  { v: "Dental", icon: "🦷" }, { v: "Pet", icon: "🐾" }, { v: "Other", icon: "📄" }
];
const insIcon = type => (INSURANCE_TYPES.find(t => t.v === type) || { icon: "📄" }).icon;
function insMonthly(p) { const prem = Number(p.premium) || 0; return p.frequency === "annual" ? prem / 12 : prem; }
function insAnnual(p) { const prem = Number(p.premium) || 0; return p.frequency === "annual" ? prem : prem * 12; }

function InsuranceModal({ policy, cats, accentColor, onSave, onClose }) {
  const blank = { type: "Car", provider: "", policyNumber: "", premium: "", frequency: "monthly", renewalDate: "", startDate: "", coverAmount: "", excess: "", autoRenew: false, renewTask: true, contactPhone: "", website: "", notes: "", budgetCategory: "" };
  const [p, setP] = useState({ ...blank, ...(policy || {}) });
  const up = (k, v) => setP(x => ({ ...x, [k]: v }));
  const ac = accentColor;
  const inp = { width: "100%", boxSizing: "border-box" };
  return (
    <Modal onClose={onClose} width={520}>
      <ModalHeader title={policy?.id ? "Edit policy" : "New insurance policy"} onClose={onClose} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 12 }}>
        <Field label="Type">
          <select value={p.type} onChange={e => up("type", e.target.value)} style={inp}>
            {INSURANCE_TYPES.map(t => <option key={t.v} value={t.v}>{t.icon} {t.v}</option>)}
          </select>
        </Field>
        <Field label="Provider"><input placeholder="e.g. Aviva, Admiral" value={p.provider} onChange={e => up("provider", e.target.value)} style={inp} autoFocus /></Field>
      </div>
      <Field label="Policy number"><input placeholder="e.g. AB123456789" value={p.policyNumber} onChange={e => up("policyNumber", e.target.value)} style={inp} /></Field>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="Premium (£)"><input type="number" step="0.01" placeholder="0.00" value={p.premium} onChange={e => up("premium", e.target.value)} style={inp} /></Field>
        <Field label="Paid">
          <select value={p.frequency} onChange={e => up("frequency", e.target.value)} style={inp}>
            <option value="monthly">Monthly</option>
            <option value="annual">Annually</option>
          </select>
        </Field>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="Renewal date"><input type="date" value={p.renewalDate} onChange={e => up("renewalDate", e.target.value)} style={inp} /></Field>
        <Field label="Start date (optional)"><input type="date" value={p.startDate} onChange={e => up("startDate", e.target.value)} style={inp} /></Field>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="Cover / limit (optional)"><input placeholder="e.g. £50,000" value={p.coverAmount} onChange={e => up("coverAmount", e.target.value)} style={inp} /></Field>
        <Field label="Excess (£, optional)"><input type="number" step="0.01" placeholder="0.00" value={p.excess} onChange={e => up("excess", e.target.value)} style={inp} /></Field>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="Claims / contact phone"><input placeholder="e.g. 0800 123 456" value={p.contactPhone} onChange={e => up("contactPhone", e.target.value)} style={inp} /></Field>
        <Field label="Website / login"><input placeholder="e.g. aviva.co.uk" value={p.website} onChange={e => up("website", e.target.value)} style={inp} /></Field>
      </div>
      <Field label="Add to budget category">
        <select value={p.budgetCategory} onChange={e => up("budgetCategory", e.target.value)} style={inp}>
          <option value="">— Don't add to budget —</option>
          {cats.map(c => <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>)}
        </select>
      </Field>
      <Field label="Notes"><textarea placeholder="Cover details, exclusions, no-claims, anything useful…" value={p.notes} onChange={e => up("notes", e.target.value)} rows={2} style={{ ...inp, resize: "vertical" }} /></Field>
      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--color-text-secondary)", cursor: "pointer" }}>
        <input type="checkbox" checked={!!p.autoRenew} onChange={e => up("autoRenew", e.target.checked)} /> Auto-renews
      </label>
      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--color-text-secondary)", cursor: "pointer", marginTop: 6 }}>
        <input type="checkbox" checked={p.renewTask !== false} onChange={e => up("renewTask", e.target.checked)} /> 🔔 Add a yearly “renew {p.type || "insurance"}” task to my calendar &amp; tasks
      </label>
      {Number(p.premium) > 0 && (
        <div style={{ fontSize: 12.5, color: "var(--color-text-secondary)", marginTop: 8 }}>
          {fmtMoney(insMonthly(p))}/mo · {fmtMoney(insAnnual(p))}/yr{p.budgetCategory ? " — added to your monthly budget" : ""}
        </div>
      )}
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 18 }}>
        <button onClick={onClose} style={{ padding: "9px 16px", fontSize: 13, borderRadius: 9 }}>Cancel</button>
        <button onClick={() => onSave({ ...p, id: policy?.id || genId(), premium: parseFloat(p.premium) || 0, excess: parseFloat(p.excess) || 0, provider: (p.provider || "").trim(), renewTask: p.renewTask !== false })} style={{ padding: "9px 20px", fontSize: 13, background: ac, color: "#fff", border: "none", borderRadius: 9, cursor: "pointer", fontWeight: 500 }}>{policy?.id ? "Save" : "Add"}</button>
      </div>
    </Modal>
  );
}

function SubModal({ sub, cats, accentColor, onSave, onClose }) {
  const [s, setS] = useState({ name: "", amount: "", day: 1, categoryId: "", ...(sub || {}) });
  const up = (k, v) => setS(x => ({ ...x, [k]: v }));
  const ac = accentColor;
  return (
    <Modal onClose={onClose} width={380}>
      <ModalHeader title={sub?.id ? "Edit subscription" : "New subscription"} onClose={onClose} />
      <Field label="Name"><input placeholder="e.g. Spotify" value={s.name} onChange={e => up("name", e.target.value)} style={{ width: "100%", boxSizing: "border-box" }} autoFocus /></Field>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="Amount / month (£)"><input type="number" step="0.01" placeholder="0.00" value={s.amount} onChange={e => up("amount", e.target.value)} style={{ width: "100%", boxSizing: "border-box" }} /></Field>
        <Field label="Billing day"><input type="number" min="1" max="28" placeholder="1" value={s.day} onChange={e => up("day", e.target.value)} style={{ width: "100%", boxSizing: "border-box" }} /></Field>
      </div>
      <Field label="Category">
        <select value={s.categoryId || ""} onChange={e => up("categoryId", e.target.value)} style={{ width: "100%" }}>
          <option value="">Uncategorised</option>
          {(cats || []).map(c => <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>)}
        </select>
      </Field>
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 18 }}>
        <button onClick={onClose} style={{ padding: "9px 16px", fontSize: 13, borderRadius: 9 }}>Cancel</button>
        <button onClick={() => { if (s.name.trim()) onSave({ id: sub?.id || genId(), name: s.name.trim(), amount: parseFloat(s.amount) || 0, day: Math.min(28, Math.max(1, parseInt(s.day, 10) || 1)), categoryId: s.categoryId }); }} style={{ padding: "9px 20px", fontSize: 13, background: ac, color: "#fff", border: "none", borderRadius: 9, cursor: "pointer", fontWeight: 500 }}>{sub?.id ? "Save" : "Add"}</button>
      </div>
    </Modal>
  );
}

// Sinking-fund "pot" inside a savings account, optionally tied to an Important Date.
function PotModal({ pot, importantDates, accentColor, onSave, onClose }) {
  const [p, setP] = useState({ label: "", target: "", dueDate: "", importantDateId: "", ...(pot || {}) });
  const up = (k, v) => setP(x => ({ ...x, [k]: v }));
  const ac = accentColor;
  const dated = (importantDates || []).filter(d => d.date);
  return (
    <Modal onClose={onClose} width={400}>
      <ModalHeader title={pot?.id ? "Edit pot" : "New sinking fund / pot"} onClose={onClose} />
      <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginBottom: 12 }}>Earmark part of this account for an irregular cost (e.g. car insurance) and we'll work out the monthly amount to set aside.</div>
      <Field label="What for?"><input placeholder="e.g. Car insurance" value={p.label} onChange={e => up("label", e.target.value)} style={{ width: "100%", boxSizing: "border-box" }} autoFocus /></Field>
      <Field label="Target amount (£)"><input type="number" step="0.01" placeholder="e.g. 600" value={p.target} onChange={e => up("target", e.target.value)} style={{ width: "100%", boxSizing: "border-box" }} /></Field>
      <Field label="Link to an important date (sets the due date)">
        <select value={p.importantDateId || ""} onChange={e => { const d = dated.find(x => x.id === e.target.value); up("importantDateId", e.target.value); if (d) up("dueDate", nextOccurrence(d.date) || d.date); }} style={{ width: "100%" }}>
          <option value="">— none —</option>
          {dated.map(d => <option key={d.id} value={d.id}>{d.title} ({fmtShort(d.date)})</option>)}
        </select>
      </Field>
      <Field label="Due date"><input type="date" value={p.dueDate || ""} onChange={e => up("dueDate", e.target.value)} style={{ width: "100%", boxSizing: "border-box" }} /></Field>
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 18 }}>
        <button onClick={onClose} style={{ padding: "9px 16px", fontSize: 13, borderRadius: 9 }}>Cancel</button>
        <button onClick={() => { if (p.label.trim()) onSave({ id: pot?.id || genId(), label: p.label.trim(), target: parseFloat(p.target) || 0, dueDate: p.dueDate || "", importantDateId: p.importantDateId || "" }); }} style={{ padding: "9px 20px", fontSize: 13, background: ac, color: "#fff", border: "none", borderRadius: 9, cursor: "pointer", fontWeight: 500 }}>{pot?.id ? "Save" : "Add pot"}</button>
      </div>
    </Modal>
  );
}

// Money insights with a flexible date range — lives in the Insights tab.
function MoneyInsights({ state, accentColor }) {
  const ac = accentColor;
  const cats = state.financeCategories || [];
  const ymd = d => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  const [preset, setPreset] = useState("this-month");
  const [cf, setCf] = useState(todayStr());
  const [ct, setCt] = useState(todayStr());
  const PRESETS = [["this-month", "This month"], ["last-month", "Last month"], ["last-3", "Last 3 months"], ["this-year", "This year"], ["all", "All time"], ["custom", "Custom"]];
  function range() {
    const d = new Date(); const today = todayStr();
    if (preset === "this-month") return { from: ymd(new Date(d.getFullYear(), d.getMonth(), 1)), to: today };
    if (preset === "last-month") return { from: ymd(new Date(d.getFullYear(), d.getMonth() - 1, 1)), to: ymd(new Date(d.getFullYear(), d.getMonth(), 0)) };
    if (preset === "last-3") return { from: ymd(new Date(d.getFullYear(), d.getMonth() - 2, 1)), to: today };
    if (preset === "this-year") return { from: d.getFullYear() + "-01-01", to: today };
    if (preset === "all") return { from: "2000-01-01", to: "2999-12-31" };
    return { from: cf, to: ct };
  }
  const { from, to } = range();
  const r = rangeStats(state, from, to);
  const maxCat = Math.max(1, ...cats.map(c => r.byCat[c.id] || 0));

  return (
    <div>
      <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 12 }}>🔎 Explore by date range</div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
        {PRESETS.map(([v, l]) => (
          <button key={v} onClick={() => setPreset(v)} style={{ fontSize: 12, padding: "6px 12px", borderRadius: 20, border: "none", cursor: "pointer", background: preset === v ? ac : "var(--color-background-secondary)", color: preset === v ? "#fff" : "var(--color-text-secondary)", fontWeight: preset === v ? 500 : 400 }}>{l}</button>
        ))}
      </div>
      {preset === "custom" && (
        <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 12, fontSize: 13 }}>
          <span style={{ color: "var(--color-text-secondary)" }}>From</span>
          <input type="date" value={cf} onChange={e => setCf(e.target.value)} />
          <span style={{ color: "var(--color-text-secondary)" }}>to</span>
          <input type="date" value={ct} onChange={e => setCt(e.target.value)} />
        </div>
      )}
      {preset !== "all" && <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginBottom: 12 }}>{fmtDate(from)} → {fmtDate(to)} · {r.count} transaction{r.count !== 1 ? "s" : ""}</div>}

      {r.count === 0 ? (
        <div style={{ background: "var(--color-background-primary)", borderRadius: 12, padding: 30, border: "0.5px solid var(--color-border-tertiary)", textAlign: "center", color: "var(--color-text-secondary)", fontSize: 13 }}>
          No transactions in this range yet. Add them in Finance → Transactions (or load sample data), and they'll appear here. Real transactions arrive once your bank is linked.
        </div>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 10, marginBottom: 14 }}>
            <StatCard label="Money spent" value={fmtMoney(r.spent)} color="#E24B4A" sub={`${fmtMoney(r.spent / r.days, true)}/day avg`} />
            <StatCard label="Money earnt" value={fmtMoney(r.earnt)} color="#1D9E75" />
            <StatCard label="Net" value={fmtMoney(r.net)} color={r.net >= 0 ? "#639922" : "#E24B4A"} sub={r.net >= 0 ? "saved" : "overspent"} />
          </div>
          <div style={{ background: "var(--color-background-primary)", borderRadius: 12, padding: 18, border: "0.5px solid var(--color-border-tertiary)", marginBottom: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 12 }}>Spending by category</div>
            {cats.filter(c => (r.byCat[c.id] || 0) > 0).sort((a, b) => r.byCat[b.id] - r.byCat[a.id]).map(c => (
              <div key={c.id} style={{ marginBottom: 11 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                  <span>{c.emoji} {c.name}</span>
                  <span style={{ color: "var(--color-text-secondary)" }}>{fmtMoney(r.byCat[c.id])} · {Math.round(r.byCat[c.id] / r.spent * 100)}%</span>
                </div>
                <div style={{ height: 7, background: "var(--color-background-secondary)", borderRadius: 4 }}>
                  <div style={{ height: "100%", width: `${(r.byCat[c.id] / maxCat) * 100}%`, background: c.color, borderRadius: 4 }} />
                </div>
              </div>
            ))}
            {!cats.some(c => (r.byCat[c.id] || 0) > 0) && <div style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>No categorised spending in this range.</div>}
          </div>
          {r.topMerchants.length > 0 && (
            <div style={{ background: "var(--color-background-primary)", borderRadius: 12, padding: 18, border: "0.5px solid var(--color-border-tertiary)" }}>
              <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 12 }}>Top merchants</div>
              {r.topMerchants.map(([name, amt], i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "5px 0", borderBottom: i < r.topMerchants.length - 1 ? "0.5px solid var(--color-border-tertiary)" : "none" }}>
                  <span>{name}</span><span style={{ color: "var(--color-text-secondary)" }}>{fmtMoney(amt)}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// Net worth = savings (assets) − debts, with a monthly snapshot history that builds over time.
function NetWorth({ state, up, accentColor }) {
  const ac = accentColor;
  const debts = state.debts || [];
  const currentTotal = (state.currentAccounts || []).reduce((s, a) => s + (Number(a.balance) || 0), 0);
  const savingsTotal = (state.savingsAccounts || []).reduce((s, a) => s + (Number(a.balance) || 0), 0);
  const investTotal = investmentTotals(state.investments).value;
  const pensionTotal = pensionPotsTotal(state);
  const assets = currentTotal + savingsTotal + investTotal + pensionTotal;
  const debtTotal = debts.reduce((s, d) => s + (Number(d.balance) || 0), 0);
  const nw = assets - debtTotal;
  const mk = curMonthKey();
  useEffect(() => {
    const hist = state.netWorthHistory || {};
    if (hist[mk] !== nw) up({ netWorthHistory: { ...hist, [mk]: nw } });
  }, [nw]);
  const hist = state.netWorthHistory || {};
  const months = Object.keys(hist).sort().slice(-6);
  const bars = months.map(m => ({ label: monthShort(m), value: Math.max(0, hist[m]), color: "#7F77DD" }));
  const prevKey = Object.keys(hist).sort().filter(k => k < mk).pop();
  const change = prevKey != null ? nw - hist[prevKey] : null;
  const col = nw >= 0 ? "#1D9E75" : "#E24B4A";
  const Line = ({ label, value, neg }) => (Number(value) === 0) ? null : (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, padding: "2px 0" }}>
      <span style={{ color: "var(--color-text-secondary)" }}>{label}</span>
      <span style={{ fontWeight: 500, color: neg ? "#E24B4A" : "var(--color-text-primary)" }}>{neg ? "−" : ""}{fmtMoney(value, true)}</span>
    </div>
  );
  return (
    <div style={{ background: "var(--color-background-primary)", borderRadius: 14, padding: 18, border: "0.5px solid var(--color-border-tertiary)" }}>
      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>📈 Net worth</div>
      <div style={{ background: hex2rgba(col, 0.08), border: `1px solid ${hex2rgba(col, 0.3)}`, borderRadius: 12, padding: "14px 16px", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 180 }}>
          <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>Total net worth</div>
          <div style={{ fontSize: 30, fontWeight: 700, color: col }}>{fmtMoney(nw)}</div>
          <div style={{ fontSize: 11.5, color: "var(--color-text-secondary)", marginTop: 2 }}>
            {fmtMoney(assets, true)} assets − {fmtMoney(debtTotal, true)} owed
            {change != null && change !== 0 && <span style={{ color: change > 0 ? "#1D9E75" : "#E24B4A", fontWeight: 500 }}> · {change > 0 ? "▲" : "▼"} {fmtMoney(Math.abs(change), true)} this month</span>}
          </div>
        </div>
        <div style={{ minWidth: 180, flex: 1 }}>
          <Line label="🏦 Current accounts" value={currentTotal} />
          <Line label="🐖 Savings" value={savingsTotal} />
          <Line label="💹 Investments" value={investTotal} />
          <Line label="🏖 Pensions" value={pensionTotal} />
          <Line label="💳 Debts & credit cards" value={debtTotal} neg />
        </div>
      </div>
      {assets === 0 && debtTotal === 0 && <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 10 }}>Add current/savings accounts, investments, a pension or debts and your net worth builds here.</div>}
      {bars.length >= 2 && (
        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginBottom: 8 }}>Net worth over time</div>
          <BarsChart data={bars} money height={110} />
        </div>
      )}
    </div>
  );
}

// "Will my money last the month?" — fully automatic. Uses this month's income
// (plan or actual) as the pot, your spend so far, and a spend rate that starts
// from your PLAN and switches to your ACTUAL pace as the month progresses.
// Recomputed from today's date on every open, so it moves day to day.
function CashFlowForecast({ state, accentColor }) {
  const ac = accentColor;
  const mk = curMonthKey();
  const st = monthStats(state, mk);
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const dayOfMonth = now.getDate();
  const daysLeft = Math.max(0, daysInMonth - dayOfMonth);
  const income = st.incomeActual > 0 ? st.incomeActual : st.incomeProjected;
  const spentSoFar = st.spend;
  const plannedDaily = st.plannedTotal > 0 ? st.plannedTotal / daysInMonth : 0;
  const actualDaily = dayOfMonth > 0 ? spentSoFar / dayOfMonth : 0;
  // Lean on the plan early on; switch to your real pace once a few days of
  // spending have landed this month.
  const haveActual = spentSoFar > 0 && dayOfMonth >= 3;
  const dailyRate = haveActual ? actualDaily : plannedDaily;
  const projRemaining = dailyRate * daysLeft;
  const projTotalSpend = spentSoFar + projRemaining;
  const projEnd = income - projTotalSpend;
  const weekly = dailyRate * 7;
  const weeksLeft = Math.max(1, Math.round(daysLeft / 7));
  const col = projEnd >= 0 ? "#1D9E75" : "#E24B4A";
  const lastDay = fmtShort(`${mk}-${String(daysInMonth).padStart(2, "0")}`);
  const noIncome = income <= 0;
  return (
    <div style={{ background: "var(--color-background-primary)", borderRadius: 14, padding: 18, border: "0.5px solid var(--color-border-tertiary)", marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
        <div style={{ fontSize: 14, fontWeight: 600, flex: 1 }}>🔮 Cash flow forecast</div>
        <span style={{ fontSize: 10.5, background: hex2rgba(ac, 0.12), color: ac, padding: "2px 8px", borderRadius: 10 }}>{haveActual ? "live · from your spending" : "from your plan"}</span>
      </div>
      <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginBottom: 12 }}>Updates automatically each day — starts from your plan, then tracks your actual spending as the month goes on.</div>

      {noIncome ? (
        <div style={{ fontSize: 13, color: "var(--color-text-secondary)", background: "var(--color-background-secondary)", borderRadius: 10, padding: "12px 14px" }}>
          Add your monthly income in the <b>Plan</b> tab and the forecast will tell you whether your money lasts the month. {spentSoFar > 0 && `So far you've spent ${fmtMoney(spentSoFar, true)} this month (~${fmtMoney(weekly, true)}/week).`}
        </div>
      ) : (
        <>
          <div style={{ background: hex2rgba(col, 0.08), border: `1px solid ${hex2rgba(col, 0.3)}`, borderRadius: 12, padding: "14px 16px", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 180 }}>
              <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>Projected money left by {lastDay}</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: col }}>{fmtMoney(projEnd)}</div>
              <div style={{ fontSize: 11.5, color: col, marginTop: 2 }}>{projEnd >= 0 ? `on track — about ${fmtMoney(projEnd, true)} spare 🎉` : `heading for a ${fmtMoney(Math.abs(projEnd), true)} shortfall — trim ~${fmtMoney(Math.abs(projEnd) / weeksLeft, true)}/week`}</div>
            </div>
            <div style={{ fontSize: 12, color: "var(--color-text-secondary)", lineHeight: 1.8 }}>
              <div>Income this month <b style={{ color: "var(--color-text-primary)" }}>{fmtMoney(income, true)}</b></div>
              <div>− Spent so far ({dayOfMonth}d) <b style={{ color: "var(--color-text-primary)" }}>{fmtMoney(spentSoFar, true)}</b></div>
              <div>− Projected rest ({daysLeft}d) <b style={{ color: "var(--color-text-primary)" }}>{fmtMoney(projRemaining, true)}</b></div>
            </div>
          </div>
          <div style={{ fontSize: 11.5, color: "var(--color-text-secondary)", marginTop: 8 }}>
            Spending about <b style={{ color: "var(--color-text-primary)" }}>{fmtMoney(weekly, true)}/week</b> ({fmtMoney(dailyRate, true)}/day) with {daysLeft} day{daysLeft !== 1 ? "s" : ""} left. On this pace you'll spend {fmtMoney(projTotalSpend, true)} vs your {fmtMoney(st.plannedTotal, true)} plan.
          </div>
          <div style={{ fontSize: 11, color: "var(--color-text-secondary)", marginTop: 6 }}>🔒 Based on your plan &amp; transactions now; will use your live bank balance once it's linked.</div>
        </>
      )}
    </div>
  );
}

function DebtModal({ debt, accentColor, onSave, onClose }) {
  const blank = { name: "", balance: "", rate: "", minPayment: "", termMonths: "", monthsPaid: "", adjustments: [] };
  const [d, setD] = useState({ ...blank, ...(debt || {}) });
  const up = (k, v) => setD(x => ({ ...x, [k]: v }));
  const ac = accentColor;
  const inp = { width: "100%", boxSizing: "border-box" };
  const adj = d.adjustments || [];
  const [exVal, setExVal] = useState("");
  const [brkVal, setBrkVal] = useState("");
  const [brkMode, setBrkMode] = useState("extend");
  const addExtra = () => { const v = parseFloat(exVal); if (!v) return; up("adjustments", [...adj, { id: genId(), kind: "extra", value: v }]); setExVal(""); };
  const addBreak = () => { const v = parseInt(brkVal, 10); if (!v) return; up("adjustments", [...adj, { id: genId(), kind: "break", value: v, mode: brkMode }]); setBrkVal(""); };
  const rmAdj = id => up("adjustments", adj.filter(a => a.id !== id));
  const plan = debtPlan({ ...d, balance: Number(d.balance) || 0 });
  return (
    <Modal onClose={onClose} width={470}>
      <ModalHeader title={debt?.id ? "Edit debt / loan" : "New debt / loan"} onClose={onClose} />
      <Field label="Name"><input placeholder="e.g. Visa, Car loan, Klarna" value={d.name} onChange={e => up("name", e.target.value)} style={inp} autoFocus /></Field>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="Balance owed now (£)"><input type="number" step="0.01" placeholder="0.00" value={d.balance} onChange={e => up("balance", e.target.value)} style={inp} /></Field>
        <Field label="Interest (% APR)"><input type="number" step="0.01" placeholder="e.g. 22.9" value={d.rate} onChange={e => up("rate", e.target.value)} style={inp} /></Field>
        <Field label="Original term (months)"><input type="number" step="1" placeholder="e.g. 36" value={d.termMonths} onChange={e => up("termMonths", e.target.value)} style={inp} /></Field>
        <Field label="Months already paid"><input type="number" step="1" placeholder="e.g. 12" value={d.monthsPaid} onChange={e => up("monthsPaid", e.target.value)} style={inp} /></Field>
      </div>
      <Field label="Min payment (£/mo, optional)"><input type="number" step="0.01" placeholder="0.00" value={d.minPayment} onChange={e => up("minPayment", e.target.value)} style={inp} /></Field>

      <Divider />
      <Field label="Extra payments & payment breaks">
        {adj.map(a => (
          <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, marginBottom: 6, padding: "6px 10px", background: "var(--color-background-secondary)", borderRadius: 8 }}>
            <span style={{ flex: 1 }}>{a.kind === "extra" ? `💷 Extra payment ${fmtMoney(a.value, true)}` : `⏸ ${a.value}-month break — ${a.mode === "extend" ? "push end date back" : "pay more, same end date"}`}</span>
            <button onClick={() => rmAdj(a.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-text-secondary)", fontSize: 16 }}>×</button>
          </div>
        ))}
        <div style={{ display: "flex", gap: 8, marginTop: 4, marginBottom: 8 }}>
          <input type="number" placeholder="£ extra payment" value={exVal} onChange={e => setExVal(e.target.value)} style={{ flex: 1, fontSize: 13 }} />
          <button onClick={addExtra} style={{ padding: "0 14px", fontSize: 13 }}>+ Extra</button>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <input type="number" placeholder="break (months)" value={brkVal} onChange={e => setBrkVal(e.target.value)} style={{ width: 130, fontSize: 13 }} />
          <select value={brkMode} onChange={e => setBrkMode(e.target.value)} style={{ fontSize: 12.5 }}>
            <option value="extend">push loan back</option>
            <option value="higher">pay more after</option>
          </select>
          <button onClick={addBreak} style={{ padding: "6px 14px", fontSize: 13 }}>+ Break</button>
        </div>
      </Field>

      {plan.hasTerm ? (
        <div style={{ fontSize: 12.5, color: "var(--color-text-secondary)", marginTop: 4, lineHeight: 1.7, background: "var(--color-background-secondary)", borderRadius: 8, padding: "10px 12px" }}>
          <b style={{ color: "var(--color-text-primary)" }}>{plan.paid}</b> of {plan.term} months paid · <b style={{ color: "var(--color-text-primary)" }}>{plan.monthsToEnd}</b> left{plan.extendMonths ? " (incl. break)" : ""}. Now about <b style={{ color: "var(--color-text-primary)" }}>{fmtMoney(plan.monthly)}/mo</b> · still payable <b style={{ color: "#E24B4A" }}>{fmtMoney(plan.remainingPayable)}</b>{plan.extra ? ` · ${fmtMoney(plan.extra, true)} extra applied` : ""}.
        </div>
      ) : (Number(d.balance) > 0 && Number(d.rate) > 0) ? (
        <div style={{ fontSize: 12.5, color: "var(--color-text-secondary)", marginTop: 4 }}>About {fmtMoney((Number(d.balance) || 0) * (Number(d.rate) || 0) / 100 / 12)}/mo in interest. Add a term + months paid to track your progress.</div>
      ) : null}

      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 18 }}>
        <button onClick={onClose} style={{ padding: "9px 16px", fontSize: 13, borderRadius: 9 }}>Cancel</button>
        <button onClick={() => { if (d.name.trim()) onSave({ id: debt?.id || genId(), name: d.name.trim(), balance: parseFloat(d.balance) || 0, rate: parseFloat(d.rate) || 0, minPayment: parseFloat(d.minPayment) || 0, termMonths: parseInt(d.termMonths, 10) || 0, monthsPaid: parseInt(d.monthsPaid, 10) || 0, adjustments: adj }); }} style={{ padding: "9px 20px", fontSize: 13, background: ac, color: "#fff", border: "none", borderRadius: 9, cursor: "pointer", fontWeight: 500 }}>{debt?.id ? "Save" : "Add"}</button>
      </div>
    </Modal>
  );
}

// Consistent section header with breathing room (used to space out finance pages).
function SectionHead({ children, sub, top = 0 }) {
  return (
    <div style={{ marginTop: top, marginBottom: 12 }}>
      <div style={{ fontSize: 15, fontWeight: 600 }}>{children}</div>
      {sub && <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

// Saved monthly report snapshots (forecast vs actual, saved, debt, gifts).
function MonthlyReports({ state }) {
  const [showAll, setShowAll] = useState(false);
  const merged = { ...(state.monthlyReports || {}) };
  const recent = new Set((state.transactions || []).map(t => (t.date || "").slice(0, 7)).filter(Boolean));
  recent.add(curMonthKey());
  Object.keys(state.financePlans || {}).forEach(m => recent.add(m));
  recent.forEach(mk => { merged[mk] = computeMonthReport(state, mk); });
  const allKeys = Object.keys(merged).filter(k => merged[k]).sort().reverse().slice(0, 24);
  if (allKeys.length === 0) return <div style={{ textAlign: "center", padding: 30, color: "var(--color-text-secondary)", fontSize: 13 }}>No monthly history yet — it builds up as you use Tend.</div>;
  const keys = showAll ? allKeys : allKeys.slice(0, 4);
  return (
    <div>
      {keys.map(mk => {
        const r = merged[mk];
        const over = r.actual > r.forecast && r.forecast > 0;
        return (
          <div key={mk} style={{ background: "var(--color-background-primary)", borderRadius: 12, padding: 16, border: "0.5px solid var(--color-border-tertiary)", marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
              <div style={{ fontSize: 15, fontWeight: 600 }}>{monthLabel(mk)}</div>
              <div style={{ fontSize: 12, color: r.saved > 0 ? "#1D9E75" : "var(--color-text-secondary)" }}>{r.saved > 0 ? `saved ${fmtMoney(r.saved, true)}` : "no surplus"}</div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(96px,1fr))", gap: 8 }}>
              {[["Forecast", fmtMoney(r.forecast, true), "var(--color-text-secondary)"],
                ["Actual", fmtMoney(r.actual, true), over ? "#E24B4A" : "#639922"],
                ["Income", fmtMoney(r.income, true), "#1D9E75"],
                ["Saved", fmtMoney(r.savedInto || 0, true), "#1D9E75"],
                ["Debt paid", fmtMoney(r.debtPaid || 0, true), (r.debtPaid || 0) > 0 ? "#BA7517" : "var(--color-text-secondary)"],
                ["Net worth", fmtMoney(r.netWorth || 0, true), (r.netWorth || 0) >= 0 ? "#1D9E75" : "#E24B4A"],
                ["Owed", fmtMoney(r.debt, true), r.debt > 0 ? "#E24B4A" : "var(--color-text-secondary)"],
                ["Gifts", String(r.gifts || 0), "var(--color-text-primary)"]].map(([l, v, c]) => (
                <div key={l} style={{ background: "var(--color-background-secondary)", borderRadius: 8, padding: "8px 10px" }}>
                  <div style={{ fontSize: 10.5, color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: "0.03em" }}>{l}</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: c }}>{v}</div>
                </div>
              ))}
            </div>
            {r.forecast > 0 && <div style={{ fontSize: 11.5, color: over ? "#E24B4A" : "#639922", marginTop: 8 }}>{over ? `Over forecast by ${fmtMoney(r.actual - r.forecast, true)}` : `Under forecast by ${fmtMoney(r.forecast - r.actual, true)}`}</div>}
          </div>
        );
      })}
      {allKeys.length > 4 && (
        <button onClick={() => setShowAll(v => !v)} style={{ fontSize: 13, padding: "8px 16px", borderRadius: 9, cursor: "pointer", width: "100%", color: "var(--color-text-primary)" }}>
          {showAll ? "Show fewer" : `View all ${allKeys.length} months`}
        </button>
      )}
    </div>
  );
}

function FinanceView({ state, up, accentColor }) {
  const [tab, setTab] = useState("dashboard");
  const [month, setMonth] = useState(curMonthKey());
  const [txnModal, setTxnModal] = useState(null);
  const [catModal, setCatModal] = useState(null);
  const [savModal, setSavModal] = useState(null);
  const [invModal, setInvModal] = useState(null);
  const [potModal, setPotModal] = useState(null);
  const [subModal, setSubModal] = useState(null);
  const [debtModal, setDebtModal] = useState(null);
  const [debtStrategy, setDebtStrategy] = useState("avalanche");
  const [savDate, setSavDate] = useState("");
  const [caModal, setCaModal] = useState(null);
  const [planText, setPlanText] = useState("");
  const [txnFilter, setTxnFilter] = useState("");
  const [txnSearch, setTxnSearch] = useState("");
  const [txnMode, setTxnMode] = useState("payperiod"); // payperiod | week | month | range
  const [txnOffset, setTxnOffset] = useState(0);
  const [txnFrom, setTxnFrom] = useState("");
  const [txnTo, setTxnTo] = useState("");
  const [paydayEdit, setPaydayEdit] = useState(false);
  const csvRef = useRef(null);

  const ac = accentColor;
  const cats = state.financeCategories || [];
  const catById = id => cats.find(c => c.id === id);
  const stats = monthStats(state, month);

  // ── mutations ──
  function saveTxn(t) {
    const list = state.transactions || [];
    const exists = list.find(x => x.id === t.id);
    up({ transactions: exists ? list.map(x => x.id === t.id ? t : x) : [t, ...list] });
    setTxnModal(null);
  }
  function deleteTxn(id) { up({ transactions: (state.transactions || []).filter(t => t.id !== id) }); }
  function setTxnCat(id, categoryId) { up({ transactions: (state.transactions || []).map(t => t.id === id ? { ...t, categoryId } : t) }); }
  function saveCat(c) {
    const exists = cats.find(x => x.id === c.id);
    up({ financeCategories: exists ? cats.map(x => x.id === c.id ? { ...x, ...c } : x) : [...cats, { ...c, items: c.items || [] }] });
    setCatModal(null);
  }
  function deleteCat(id) {
    if (!confirm("Delete this group and its line items? Its transactions become uncategorised.")) return;
    up({ financeCategories: cats.filter(c => c.id !== id), transactions: (state.transactions || []).map(t => t.categoryId === id ? { ...t, categoryId: "" } : t) });
  }
  // Budget structure (line items) lives on the category; per-month amounts live on the plan.
  function addItem(catId, name) {
    const nm = (name || "").trim(); if (!nm) return;
    up({ financeCategories: cats.map(c => c.id === catId ? { ...c, items: [...(c.items || []), { id: genId(), name: nm }] } : c) });
  }
  function renameItem(catId, itemId, name) {
    up({ financeCategories: cats.map(c => c.id === catId ? { ...c, items: (c.items || []).map(i => i.id === itemId ? { ...i, name } : i) } : c) });
  }
  function removeItem(catId, itemId) {
    up({ financeCategories: cats.map(c => c.id === catId ? { ...c, items: (c.items || []).filter(i => i.id !== itemId) } : c) });
  }
  function setItemAmount(itemId, sub, value) {
    const plans = { ...(state.financePlans || {}) };
    const cur = plans[month] || {};
    const byItem = { ...(cur.byItem || {}) };
    byItem[itemId] = { ...(byItem[itemId] || {}), [sub]: value };
    plans[month] = { ...cur, byItem };
    up({ financePlans: plans });
  }
  function setIncomeField(field, sub, value) {
    const plans = { ...(state.financePlans || {}) };
    const cur = plans[month] || {};
    plans[month] = { ...cur, [field]: { ...(cur[field] || {}), [sub]: value } };
    up({ financePlans: plans });
  }
  function applyParsed() {
    if (!planText.trim()) return;
    const p = localParsePlan(planText, cats);
    const plans = { ...(state.financePlans || {}) };
    const cur = plans[month] || {};
    const byItem = { ...(cur.byItem || {}) };
    Object.entries(p.byItem).forEach(([id, v]) => { byItem[id] = { ...(byItem[id] || {}), projected: v }; });
    const next = { ...cur, byItem };
    if (p.income != null) next.income = { ...(cur.income || {}), projected: p.income };
    plans[month] = next;
    up({ financePlans: plans });
    setPlanText("");
    const n = Object.keys(p.byItem).length + (p.income != null ? 1 : 0);
    if (!n) alert("Couldn't pick out any amounts. Try e.g. 'groceries 100, fuel 80, spotify 13, income 2289'.");
  }
  function copyLastMonth() {
    const prev = (state.financePlans || {})[shiftMonth(month, -1)];
    if (!prev) return alert("No plan to copy from last month.");
    const plans = { ...(state.financePlans || {}) };
    plans[month] = JSON.parse(JSON.stringify(prev));
    up({ financePlans: plans });
  }
  function loadSample() {
    if ((state.transactions || []).length && !confirm("Add sample transactions on top of your existing ones?")) return;
    up({ transactions: [...makeSampleTransactions(cats), ...(state.transactions || [])] });
    setMonth(curMonthKey());
  }
  const savings = state.savingsAccounts || [];
  function saveSav(s) {
    const exists = savings.some(x => x.id === s.id);
    up({ savingsAccounts: exists ? savings.map(x => x.id === s.id ? s : x) : [...savings, s] });
    setSavModal(null);
  }
  function deleteSav(id) { if (confirm("Delete this savings account?")) up({ savingsAccounts: savings.filter(s => s.id !== id) }); }
  const investments = state.investments || [];
  function saveInvestment(h) {
    const exists = investments.some(x => x.id === h.id);
    up({ investments: exists ? investments.map(x => x.id === h.id ? h : x) : [...investments, h] });
    setInvModal(null);
  }
  function deleteInvestment(id) { if (confirm("Delete this holding?")) up({ investments: investments.filter(h => h.id !== id) }); }
  // Insurance is managed under Documents & Policies; the list is still read here so
  // premiums show as projected commitments in the breakdown plan.
  const insurance = state.insurance || [];
  function setPensionField(k, v) { up({ pension: { ...(state.pension || {}), [k]: v } }); }
  function savePot(accId, pot) {
    up({ savingsAccounts: savings.map(s => s.id === accId ? { ...s, pots: (s.pots || []).some(p => p.id === pot.id) ? (s.pots || []).map(p => p.id === pot.id ? pot : p) : [...(s.pots || []), pot] } : s) });
    setPotModal(null);
  }
  function deletePot(accId, potId) { up({ savingsAccounts: savings.map(s => s.id === accId ? { ...s, pots: (s.pots || []).filter(p => p.id !== potId) } : s) }); }
  const subs = state.subscriptions || [];
  function saveSub(s) { up({ subscriptions: subs.some(x => x.id === s.id) ? subs.map(x => x.id === s.id ? s : x) : [...subs, s] }); setSubModal(null); }
  function deleteSub(id) { up({ subscriptions: subs.filter(s => s.id !== id) }); }
  const debts = state.debts || [];
  function saveDebt(dt) { up({ debts: debts.some(x => x.id === dt.id) ? debts.map(x => x.id === dt.id ? dt : x) : [...debts, dt] }); setDebtModal(null); }
  function deleteDebt(id) { if (confirm("Delete this debt?")) up({ debts: debts.filter(d => d.id !== id) }); }
  const currentAccounts = state.currentAccounts || [];
  function saveCA(c) { up({ currentAccounts: currentAccounts.some(x => x.id === c.id) ? currentAccounts.map(x => x.id === c.id ? c : x) : [...currentAccounts, c] }); setCaModal(null); }
  function deleteCA(id) { if (confirm("Delete this account?")) up({ currentAccounts: currentAccounts.filter(c => c.id !== id) }); }
  // Pensions: migrate the legacy single pension into the array once, then operate on the array.
  useEffect(() => {
    if ((state.pensions || []).length) return;
    const legacy = state.pension || {};
    if (Object.keys(legacy).some(k => legacy[k] !== "" && legacy[k] != null && legacy[k] !== 0)) {
      up({ pensions: [{ id: genId(), name: "My pension", type: "private", contributing: true, ...legacy }], pension: {} });
    }
  }, []);
  const pensions = state.pensions || [];
  function setPension(list) { up({ pensions: list }); }
  function addPension(type) {
    const base = pensions[0] || {};
    const p = type === "state"
      ? { id: genId(), name: "State pension", type: "state", weekly: STATE_PENSION_WEEKLY, startAge: 67 }
      : { id: genId(), name: `Pension ${pensions.filter(x => x.type !== "state").length + 1}`, type: "private", contributing: true, currentAge: base.currentAge || "", retireAge: base.retireAge || 67, currentPot: "", salary: base.salary || "", employeePct: 5, employerPct: 3, growthPct: 5, inflationPct: 2.5 };
    setPension([...pensions, p]);
  }
  function setPensionById(id, k, v) { setPension(pensions.map(p => p.id === id ? { ...p, [k]: v } : p)); }
  function deletePension(id) { if (confirm("Delete this pension?")) setPension(pensions.filter(p => p.id !== id)); }
  function importCSV(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
      const rows = parseBankCSV(String(e.target.result || ""), cats);
      if (!rows.length) { alert("Couldn't find any transactions in that CSV. Expecting a Lloyds export (Date, Description, Debit/Credit amounts)."); return; }
      up({ transactions: [...rows, ...(state.transactions || [])] });
      alert(`Imported ${rows.length} transaction${rows.length !== 1 ? "s" : ""}. Auto-categorised where possible — review under each row.`);
    };
    reader.readAsText(file);
  }

  // ── month switcher ──
  const MonthNav = () => (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <button onClick={() => setMonth(shiftMonth(month, -1))} style={{ padding: "5px 11px", borderRadius: 8, cursor: "pointer" }}>◀</button>
      <div style={{ fontSize: 14, fontWeight: 500, minWidth: 130, textAlign: "center" }}>{monthLabel(month)}</div>
      <button onClick={() => setMonth(shiftMonth(month, 1))} style={{ padding: "5px 11px", borderRadius: 8, cursor: "pointer" }}>▶</button>
      {month !== curMonthKey() && <button onClick={() => setMonth(curMonthKey())} style={{ fontSize: 12, padding: "5px 10px", borderRadius: 8, cursor: "pointer", color: ac }}>This month</button>}
    </div>
  );

  const net = stats.income - stats.spend;
  const donutSegs = cats.map(c => ({ value: stats.byCat[c.id]?.spent || 0, color: c.color, label: c.name })).filter(s => s.value > 0);

  return (
    <div style={{ maxWidth: 760 }}>
      {txnModal !== null && <TxnModal txn={txnModal === "new" ? null : txnModal} cats={cats} accentColor={ac} onSave={saveTxn} onClose={() => setTxnModal(null)} />}
      {catModal !== null && <FinanceCatModal cat={catModal === "new" ? null : catModal} accentColor={ac} onSave={saveCat} onClose={() => setCatModal(null)} />}
      {savModal !== null && <SavingsModal account={savModal === "new" ? null : savModal} accentColor={ac} onSave={saveSav} onClose={() => setSavModal(null)} />}
      {invModal !== null && <InvestmentModal holding={invModal === "new" ? null : invModal} accentColor={ac} onSave={saveInvestment} onClose={() => setInvModal(null)} />}
      {potModal && <PotModal pot={potModal.pot} importantDates={state.importantDates || []} accentColor={ac} onSave={p => savePot(potModal.accId, p)} onClose={() => setPotModal(null)} />}
      {subModal !== null && <SubModal sub={subModal === "new" ? null : subModal} cats={cats} accentColor={ac} onSave={saveSub} onClose={() => setSubModal(null)} />}
      {debtModal !== null && <DebtModal debt={debtModal === "new" ? null : debtModal} accentColor={ac} onSave={saveDebt} onClose={() => setDebtModal(null)} />}
      {caModal !== null && <CurrentAccountModal account={caModal === "new" ? null : caModal} accentColor={ac} onSave={saveCA} onClose={() => setCaModal(null)} />}

      {/* Sub-tabs */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 18 }}>
        {FINANCE_TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ fontSize: 13, padding: "7px 13px", borderRadius: 9, cursor: "pointer", border: "none", background: tab === t.id ? ac : "var(--color-background-secondary)", color: tab === t.id ? "#fff" : "var(--color-text-secondary)", fontWeight: tab === t.id ? 500 : 400 }}>{t.icon} {t.label}</button>
        ))}
      </div>

      {/* ── Dashboard ── */}
      {tab === "dashboard" && (
        <div>
          <div style={{ marginBottom: 16 }}><MonthNav /></div>
          {stats.txns.length === 0 && stats.plannedTotal === 0 ? (
            <div style={{ textAlign: "center", padding: 50, color: "var(--color-text-secondary)" }}>
              <div style={{ fontSize: 38, marginBottom: 12 }}>💷</div>
              <div style={{ fontSize: 15, marginBottom: 6 }}>Nothing to show for {monthLabel(month)} yet</div>
              <div style={{ fontSize: 13, marginBottom: 18 }}>Set a plan, add transactions, or load sample data to explore.</div>
              <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
                <button onClick={() => setTab("plan")} style={{ fontSize: 13, padding: "8px 16px", background: ac, color: "#fff", border: "none", borderRadius: 9, cursor: "pointer" }}>🎯 Create a plan</button>
                <button onClick={loadSample} style={{ fontSize: 13, padding: "8px 16px", borderRadius: 9, cursor: "pointer" }}>✨ Load sample data</button>
              </div>
            </div>
          ) : (
            <>
              <CashFlowForecast state={state} accentColor={ac} />
              {(() => {
                const buffer = Number(state.safetyBuffer) || 0;
                const expIncome = stats.incomeActual > 0 ? stats.incomeActual : stats.incomeProjected;
                const safe = expIncome - stats.plannedTotal - buffer;
                const col = safe >= 0 ? "#1D9E75" : "#E24B4A";
                return (
                  <div style={{ background: "var(--color-background-primary)", borderRadius: 14, padding: 18, border: "0.5px solid var(--color-border-tertiary)", marginBottom: 16 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>💸 Safe to spend this month</div>
                    <div style={{ background: hex2rgba(col, 0.08), border: `1px solid ${hex2rgba(col, 0.3)}`, borderRadius: 12, padding: "14px 16px", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
                      <div style={{ flex: 1, minWidth: 180 }}>
                        <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>Free to spend after plan, savings, debts &amp; pension</div>
                        <div style={{ fontSize: 28, fontWeight: 700, color: col }}>{fmtMoney(safe)}</div>
                        <div style={{ fontSize: 11.5, color: col, marginTop: 2 }}>{safe >= 0 ? "free to spend 🎉" : "over budget — trim the plan"}</div>
                      </div>
                      <div style={{ fontSize: 12, color: "var(--color-text-secondary)", lineHeight: 1.8 }}>
                        <div>Income <b style={{ color: "var(--color-text-primary)" }}>{fmtMoney(expIncome, true)}</b></div>
                        <div>− Planned outgoings <b style={{ color: "var(--color-text-primary)" }}>{fmtMoney(stats.plannedTotal - stats.commitments, true)}</b></div>
                        {stats.commitments > 0 && <div>− Savings/debt/pension <b style={{ color: "var(--color-text-primary)" }}>{fmtMoney(stats.commitments, true)}</b></div>}
                        {buffer > 0 && <div>− Safety buffer <b style={{ color: "var(--color-text-primary)" }}>{fmtMoney(buffer, true)}</b></div>}
                      </div>
                    </div>
                  </div>
                );
              })()}
              <div style={{ marginBottom: 16 }}><NetWorth state={state} up={up} accentColor={ac} /></div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10, marginBottom: 16 }}>
                <StatCard label="Spent" value={fmtMoney(stats.spend)} color="#E24B4A" sub={`of ${fmtMoney(stats.plannedTotal)} planned`} />
                <StatCard label="Remaining in plan" value={fmtMoney(stats.plannedTotal - stats.spend)} color={stats.plannedTotal - stats.spend >= 0 ? "#639922" : "#E24B4A"} sub={stats.plannedTotal ? `${Math.round(stats.spend / stats.plannedTotal * 100)}% used` : "no plan set"} />
                <StatCard label="Income" value={fmtMoney(stats.income)} color="#1D9E75" />
                <StatCard label="Balance" value={fmtMoney(net)} color={net >= 0 ? "#639922" : "#E24B4A"} sub={`projected ${fmtMoney(stats.incomeProjected - stats.plannedTotal, true)}`} />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: donutSegs.length ? "1fr 200px" : "1fr", gap: 14 }}>
                <div style={{ background: "var(--color-background-primary)", borderRadius: 12, padding: 18, border: "0.5px solid var(--color-border-tertiary)" }}>
                  <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 14 }}>Spending vs plan by category</div>
                  {cats.map(c => {
                    const s = stats.byCat[c.id] || { spent: 0, planned: 0 };
                    const pct = s.planned ? Math.round(s.spent / s.planned * 100) : (s.spent ? 100 : 0);
                    const over = s.planned && s.spent > s.planned;
                    return (
                      <div key={c.id} style={{ marginBottom: 13 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 5 }}>
                          <span>{c.emoji} {c.name}</span>
                          <span style={{ color: over ? "#E24B4A" : "var(--color-text-secondary)", fontWeight: over ? 500 : 400 }}>{fmtMoney(s.spent)}{s.planned ? ` / ${fmtMoney(s.planned)}` : ""}{over ? " ⚠" : ""}</span>
                        </div>
                        <div style={{ height: 8, background: "var(--color-background-secondary)", borderRadius: 5, overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${Math.min(100, pct)}%`, background: over ? "#E24B4A" : c.color, borderRadius: 5, transition: "width 0.4s" }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
                {donutSegs.length > 0 && (
                  <div style={{ background: "var(--color-background-primary)", borderRadius: 12, padding: 18, border: "0.5px solid var(--color-border-tertiary)", display: "flex", flexDirection: "column", alignItems: "center" }}>
                    <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 14, alignSelf: "flex-start" }}>Where it went</div>
                    <Donut segments={donutSegs} center={<><div style={{ fontSize: 16, fontWeight: 600 }}>{fmtMoney(stats.spend, true)}</div><div style={{ fontSize: 10, color: "var(--color-text-secondary)" }}>spent</div></>} />
                    <div style={{ marginTop: 14, width: "100%" }}>
                      {donutSegs.sort((a, b) => b.value - a.value).map((s, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, marginBottom: 4 }}>
                          <span style={{ width: 10, height: 10, borderRadius: 3, background: s.color, flexShrink: 0 }} />
                          <span style={{ flex: 1 }}>{s.label}</span>
                          <span style={{ color: "var(--color-text-secondary)" }}>{fmtMoney(s.value, true)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Plan ── */}
      {tab === "plan" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
            <MonthNav />
            <button onClick={copyLastMonth} style={{ fontSize: 12, padding: "6px 12px", borderRadius: 8, cursor: "pointer" }}>⧉ Copy last month</button>
          </div>

          {/* Safety buffer — kept at the top so it's visible without scrolling */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, background: hex2rgba(ac, 0.06), border: `1px solid ${hex2rgba(ac, 0.2)}`, borderRadius: 12, padding: "12px 16px", marginBottom: 14, flexWrap: "wrap" }}>
            <span style={{ fontSize: 13, fontWeight: 600, flex: 1, minWidth: 160 }} title="A cushion held back from your plan in case you overspend">🛟 Safety buffer</span>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ color: "var(--color-text-secondary)" }}>£</span>
              <input type="number" step="1" value={state.safetyBuffer || ""} onFocus={e => e.target.select()} onChange={e => up({ safetyBuffer: parseFloat(e.target.value) || 0 })} placeholder="0" style={{ width: 100, textAlign: "right" }} />
            </div>
          </div>

          {/* Income */}
          <div style={{ background: "var(--color-background-primary)", borderRadius: 12, padding: 18, border: "0.5px solid var(--color-border-tertiary)", marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", marginBottom: 12 }}>
              <div style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>💰 Monthly income</div>
              <div style={{ width: 96, fontSize: 11, color: "var(--color-text-secondary)", textAlign: "right" }}>Projected</div>
              <div style={{ width: 96, fontSize: 11, color: "var(--color-text-secondary)", textAlign: "right" }}>Actual</div>
              <div style={{ width: 94 }} />
            </div>
            {[["income", "Main income / salary"], ["income2", "Second income"], ["extra", "Other (benefits, etc.)"]].map(([f, label]) => (
              <div key={f} style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
                <div style={{ flex: 1, fontSize: 13 }}>{label}</div>
                <MoneyCell value={(stats.plan[f] || {}).projected} onChange={v => setIncomeField(f, "projected", v)} />
                <MoneyCell value={(stats.plan[f] || {}).actual} onChange={v => setIncomeField(f, "actual", v)} />
                <div style={{ width: 94 }} />
              </div>
            ))}
            <div style={{ display: "flex", alignItems: "center", marginTop: 10, paddingTop: 10, borderTop: "0.5px solid var(--color-border-tertiary)", fontWeight: 600, fontSize: 13 }}>
              <div style={{ flex: 1 }}>Total monthly income</div>
              <div style={{ width: 96, textAlign: "right", color: "#1D9E75" }}>{fmtMoney(stats.incomeProjected)}</div>
              <div style={{ width: 96, textAlign: "right", color: "#1D9E75" }}>{fmtMoney(stats.incomeManualActual)}</div>
              <div style={{ width: 94 }} />
            </div>
          </div>

          {/* Commitments pulled automatically from the other tabs — projected vs actual */}
          {(() => {
            const monthTxns = (state.transactions || []).filter(t => t.type !== "income" && (t.date || "").slice(0, 7) === month);
            const matchActual = kw => { kw = (kw || "").toLowerCase().trim(); if (!kw) return null; const ms = monthTxns.filter(t => (t.description || "").toLowerCase().includes(kw)); return ms.length ? ms.reduce((s, t) => s + (Number(t.amount) || 0), 0) : null; };
            const items = [
              ...savings.filter(a => Number(a.contribution) > 0).map(a => ({ icon: "🐖", label: a.name, projected: Number(a.contribution) || 0, kw: a.name })),
              ...debts.map(d => { const pl = debtPlan(d); return { icon: "💳", label: d.name, projected: pl.hasTerm ? pl.monthly : (Number(d.minPayment) || 0), kw: d.name }; }).filter(x => x.projected > 0),
              ...insurance.map(p => ({ icon: insIcon(p.type), label: `${p.type}${p.provider ? " · " + p.provider : ""}`, projected: insMonthly(p), kw: p.provider || p.type })).filter(x => x.projected > 0),
              ...subs.map(s => ({ icon: "🔁", label: s.name, projected: Number(s.amount) || 0, kw: s.name })).filter(x => x.projected > 0),
            ];
            if (!items.length) return null;
            return (
              <div style={{ background: "var(--color-background-primary)", borderRadius: 12, padding: 18, border: "0.5px solid var(--color-border-tertiary)", marginBottom: 14 }}>
                <div style={{ display: "flex", alignItems: "center", marginBottom: 4 }}>
                  <div style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>🔗 Commitments <span style={{ fontSize: 11, fontWeight: 400, color: "var(--color-text-secondary)" }}>auto</span></div>
                  <div style={{ width: 90, fontSize: 11, color: "var(--color-text-secondary)", textAlign: "right" }}>Projected</div>
                  <div style={{ width: 90, fontSize: 11, color: "var(--color-text-secondary)", textAlign: "right" }}>Actual</div>
                </div>
                <div style={{ fontSize: 11.5, color: "var(--color-text-secondary)", marginBottom: 10 }}>From your Savings &amp; Debts, Insurance and Subscriptions. Actual fills in when a matching transaction appears — “pending” until then.</div>
                {items.map((it, i) => { const actual = matchActual(it.kw); return (
                  <div key={i} style={{ display: "flex", alignItems: "center", fontSize: 13, padding: "4px 0" }}>
                    <span style={{ flex: 1, color: "var(--color-text-secondary)" }}>{it.icon} {it.label}</span>
                    <span style={{ width: 90, textAlign: "right", fontWeight: 500 }}>{fmtMoney(it.projected, true)}</span>
                    <span style={{ width: 90, textAlign: "right", color: actual == null ? "var(--color-text-secondary)" : "#639922", fontWeight: actual == null ? 400 : 500, fontStyle: actual == null ? "italic" : "normal" }}>{actual == null ? "pending" : fmtMoney(actual, true)}</span>
                  </div>
                ); })}
                <div style={{ display: "flex", alignItems: "center", fontSize: 13, fontWeight: 600, marginTop: 8, paddingTop: 8, borderTop: "0.5px solid var(--color-border-tertiary)" }}>
                  <span style={{ flex: 1 }}>Total commitments</span>
                  <span style={{ width: 90, textAlign: "right", color: ac }}>{fmtMoney(items.reduce((s, x) => s + x.projected, 0), true)}</span>
                  <span style={{ width: 90, textAlign: "right", color: "#639922" }}>{fmtMoney(items.reduce((s, x) => s + (matchActual(x.kw) || 0), 0), true)}</span>
                </div>
              </div>
            );
          })()}

          {/* Expense groups → line items */}
          {cats.map(c => {
            const items = c.items || [];
            let pj = 0, av = 0;
            items.forEach(it => { const v = (stats.byItem || {})[it.id] || {}; pj += Number(v.projected) || 0; av += Number(v.actual) || 0; });
            const auto = stats.byCat[c.id]?.auto || [];
            const autoSum = stats.byCat[c.id]?.autoSum || 0;
            return (
              <div key={c.id} style={{ background: "var(--color-background-primary)", borderRadius: 12, padding: 18, border: "0.5px solid var(--color-border-tertiary)", marginBottom: 14 }}>
                <div style={{ display: "flex", alignItems: "center", marginBottom: 12 }}>
                  <div style={{ flex: 1, fontSize: 14, fontWeight: 600, color: c.color }}>{c.emoji} {c.name}</div>
                  <div style={{ width: 96, fontSize: 11, color: "var(--color-text-secondary)", textAlign: "right" }}>Projected</div>
                  <div style={{ width: 96, fontSize: 11, color: "var(--color-text-secondary)", textAlign: "right" }}>Actual</div>
                  <div style={{ width: 70, fontSize: 11, color: "var(--color-text-secondary)", textAlign: "right" }}>Diff</div>
                  <div style={{ width: 24 }} />
                </div>
                {items.length === 0 && <div style={{ fontSize: 12, color: "var(--color-text-secondary)", fontStyle: "italic", marginBottom: 4 }}>No line items yet — add one below.</div>}
                {items.map(it => {
                  const v = (stats.byItem || {})[it.id] || {};
                  const diff = (Number(v.projected) || 0) - (Number(v.actual) || 0);
                  return (
                    <div key={it.id} style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
                      <input value={it.name} onChange={e => renameItem(c.id, it.id, e.target.value)} title="Rename line item" style={{ flex: 1, fontSize: 13, border: "1px solid transparent", background: "transparent", padding: "5px 4px", marginRight: 6 }} />
                      <MoneyCell value={v.projected} onChange={x => setItemAmount(it.id, "projected", x)} />
                      <MoneyCell value={v.actual} onChange={x => setItemAmount(it.id, "actual", x)} />
                      <div style={{ width: 70, textAlign: "right", fontSize: 12, color: diff >= 0 ? "#639922" : "#E24B4A" }}>{fmtMoney(diff, true)}</div>
                      <button onClick={() => removeItem(c.id, it.id)} title="Remove" style={{ width: 24, background: "none", border: "none", cursor: "pointer", color: "var(--color-text-secondary)", fontSize: 15 }}>×</button>
                    </div>
                  );
                })}
                {auto.map((a, i) => (
                  <div key={"auto" + i} style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
                    <div style={{ flex: 1, fontSize: 13, display: "flex", alignItems: "center", gap: 6, color: "var(--color-text-secondary)" }}>
                      <span>{a.source === "date" ? "🎂" : a.source === "insurance" ? "🛡" : "📋"}</span>
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.label}</span>
                      <span style={{ fontSize: 10, background: hex2rgba(ac, 0.12), color: ac, padding: "1px 7px", borderRadius: 10, flexShrink: 0 }}>auto</span>
                    </div>
                    <div style={{ width: 96, textAlign: "right", fontSize: 13, color: "var(--color-text-secondary)" }}>{fmtMoney(a.amount)}</div>
                    <div style={{ width: 96 }} />
                    <div style={{ width: 70 }} />
                    <div style={{ width: 24 }} />
                  </div>
                ))}
                <AddItemRow accentColor={ac} onAdd={name => addItem(c.id, name)} />
                <div style={{ display: "flex", alignItems: "center", marginTop: 10, paddingTop: 10, borderTop: "0.5px solid var(--color-border-tertiary)", fontWeight: 600, fontSize: 13 }}>
                  <div style={{ flex: 1 }}>Subtotal{autoSum > 0 ? <span style={{ fontWeight: 400, fontSize: 11, color: "var(--color-text-secondary)", marginLeft: 6 }}>incl. {fmtMoney(autoSum, true)} from tasks/dates</span> : ""}</div>
                  <div style={{ width: 96, textAlign: "right" }}>{fmtMoney(pj + autoSum)}</div>
                  <div style={{ width: 96, textAlign: "right" }}>{fmtMoney(av)}</div>
                  <div style={{ width: 70, textAlign: "right", color: (pj + autoSum - av) >= 0 ? "#639922" : "#E24B4A" }}>{fmtMoney(pj + autoSum - av, true)}</div>
                  <div style={{ width: 24 }} />
                </div>
              </div>
            );
          })}

          {/* Totals + balance */}
          <div style={{ background: hex2rgba(ac, 0.06), borderRadius: 12, padding: 18, border: `1px solid ${hex2rgba(ac, 0.25)}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 8 }}><span>Total projected cost</span><b>{fmtMoney(stats.plannedTotal)}</b></div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 8 }}><span>Total actual cost</span><b>{fmtMoney(stats.manualActualTotal)}</b></div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13, marginBottom: 8 }}>
              <span title="Set at the top of this page">🛟 Safety buffer</span>
              <b>{fmtMoney(Number(state.safetyBuffer) || 0)}</b>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, paddingTop: 10, borderTop: `0.5px solid ${hex2rgba(ac, 0.25)}` }}><span style={{ fontWeight: 600 }}>Projected balance <span style={{ fontWeight: 400, fontSize: 11, color: "var(--color-text-secondary)" }}>after buffer</span></span><b style={{ color: (stats.incomeProjected - stats.plannedTotal - (Number(state.safetyBuffer) || 0)) >= 0 ? "#639922" : "#E24B4A" }}>{fmtMoney(stats.incomeProjected - stats.plannedTotal - (Number(state.safetyBuffer) || 0))}</b></div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, marginTop: 8 }}><span style={{ fontWeight: 600 }}>Actual balance</span><b style={{ color: (stats.incomeManualActual - stats.manualActualTotal) >= 0 ? "#639922" : "#E24B4A" }}>{fmtMoney(stats.incomeManualActual - stats.manualActualTotal)}</b></div>
          </div>
        </div>
      )}

      {/* ── Savings ── */}
      {tab === "savings" && (() => {
        const totalBal = savings.reduce((s, a) => s + (Number(a.balance) || 0), 0);
        const totalContrib = savings.reduce((s, a) => s + (Number(a.contribution) || 0), 0);
        const proj = [0, 6, 12, 18, 24].map(m => ({ label: m === 0 ? "Now" : "+" + m + "m", value: savings.reduce((s, a) => s + projectBalance(a.balance, a.contribution, a.rate, m), 0), color: "#1D9E75" }));
        return (
          <div>
            {/* Current / Debit accounts — top */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, gap: 10, flexWrap: "wrap" }}>
                <div style={{ fontSize: 15, fontWeight: 600 }}>🏦 Current / Debit accounts</div>
                <button onClick={() => setCaModal("new")} style={{ fontSize: 13, padding: "6px 14px", background: ac, color: "#fff", border: "none", borderRadius: 9, cursor: "pointer", fontWeight: 500 }}>+ Account</button>
              </div>
              {currentAccounts.length === 0 && <div style={{ fontSize: 13, color: "var(--color-text-secondary)", padding: "2px 0 6px" }}>Add your everyday current/debit accounts to see your spending money separate from savings. Link them to your bank in Phase B to auto-update.</div>}
              {currentAccounts.length > 0 && (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10, marginBottom: 12 }}>
                    <StatCard label="In current accounts" value={fmtMoney(currentAccounts.reduce((s, c) => s + (Number(c.balance) || 0), 0))} color={ac} sub="available to spend" />
                  </div>
                  {currentAccounts.map(c => (
                    <div key={c.id} style={{ background: "var(--color-background-primary)", borderRadius: 12, padding: 16, border: "0.5px solid var(--color-border-tertiary)", marginBottom: 10, display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 22 }}>🏦</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                          <span style={{ fontWeight: 600, fontSize: 15 }}>{c.name}</span>
                          {c.linked && <span style={{ fontSize: 10, background: hex2rgba(ac, 0.14), color: ac, padding: "1px 7px", borderRadius: 10, fontWeight: 500 }}>🔗 Bank link (Phase B)</span>}
                        </div>
                        <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>{c.institution || "Current account"}</div>
                      </div>
                      <div style={{ fontSize: 17, fontWeight: 600, color: ac }}>{fmtMoney(c.balance)}</div>
                      <button onClick={() => setCaModal(c)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, padding: "4px 6px" }}>✏️</button>
                      <button onClick={() => deleteCA(c.id)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, padding: "4px 6px" }}>🗑</button>
                    </div>
                  ))}
                </>
              )}
            </div>

            {/* Savings — middle */}
            <div style={{ marginTop: 26, paddingTop: 20, borderTop: "0.5px solid var(--color-border-tertiary)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4, gap: 10, flexWrap: "wrap" }}>
                <div style={{ fontSize: 15, fontWeight: 600 }}>🐖 Savings</div>
                <button onClick={() => setSavModal("new")} style={{ fontSize: 13, padding: "7px 16px", background: ac, color: "#fff", border: "none", borderRadius: 9, cursor: "pointer", fontWeight: 500 }}>+ Account</button>
              </div>
              <div style={{ fontSize: 13, color: "var(--color-text-secondary)", marginBottom: 14 }}>Track balances, goals and how long until you reach them. Balances sync once your bank is linked.</div>

            {savings.length === 0 && (
              <div style={{ textAlign: "center", padding: 50, color: "var(--color-text-secondary)" }}>
                <div style={{ fontSize: 38, marginBottom: 12 }}>🐖</div>
                <div style={{ fontSize: 15, marginBottom: 6 }}>No savings accounts yet</div>
                <div style={{ fontSize: 13, marginBottom: 18 }}>Add one to set goals and forecast when you'll hit them.</div>
                <button onClick={() => setSavModal("new")} style={{ fontSize: 13, padding: "8px 18px", background: ac, color: "#fff", border: "none", borderRadius: 9, cursor: "pointer" }}>+ Add a savings account</button>
              </div>
            )}

            {savings.length > 0 && (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10, marginBottom: 14 }}>
                  <StatCard label="Total saved" value={fmtMoney(totalBal)} color="#1D9E75" />
                  <StatCard label="Saving / month" value={fmtMoney(totalContrib)} color={ac} />
                  {(() => { const eoyM = Math.max(0, 11 - new Date().getMonth()); const v = savings.reduce((s, a) => s + projectBalance(a.balance, a.contribution, a.rate, eoyM), 0); return <StatCard label={`By end of ${new Date().getFullYear()}`} value={fmtMoney(v)} color="#1D9E75" sub={`${eoyM} month${eoyM !== 1 ? "s" : ""} away`} />; })()}
                  <StatCard label="In 12 months" value={fmtMoney(proj[2].value)} color="#1D9E75" sub="at current pace" />
                </div>
                <div style={{ background: "var(--color-background-primary)", borderRadius: 12, padding: 18, border: "0.5px solid var(--color-border-tertiary)", marginBottom: 14 }}>
                  <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 16 }}>Projected total savings</div>
                  <BarsChart data={proj} money />
                </div>
                <div style={{ background: "var(--color-background-primary)", borderRadius: 12, padding: 18, border: "0.5px solid var(--color-border-tertiary)", marginBottom: 14 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>🔮 How much will I have saved by…</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginTop: 8 }}>
                    <input type="date" value={savDate} onChange={e => setSavDate(e.target.value)} style={{ fontSize: 13 }} />
                    {savDate && (() => {
                      const m = monthsBetweenToday(savDate);
                      if (m == null || m < 0) return <span style={{ fontSize: 13, color: "#E24B4A" }}>Pick a future date.</span>;
                      const v = savings.reduce((s, a) => s + projectBalance(a.balance, a.contribution, a.rate, m), 0);
                      return <span style={{ fontSize: 14 }}>By {fmtDate(savDate)} you'll have about <b style={{ color: "#1D9E75" }}>{fmtMoney(v)}</b> <span style={{ color: "var(--color-text-secondary)" }}>({m} month{m !== 1 ? "s" : ""} at your current pace)</span></span>;
                    })()}
                    {!savDate && <span style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>Pick a date to forecast your total savings.</span>}
                  </div>
                </div>
                {savings.map(a => {
                  const bal = Number(a.balance) || 0, target = Number(a.target) || 0;
                  const pct = target ? Math.min(100, Math.round(bal / target * 100)) : 0;
                  let forecast = null;
                  if (target && bal >= target) forecast = { txt: "🎉 Goal reached!", color: "#639922" };
                  else if (target && a.targetDate) {
                    const m = monthsBetweenToday(a.targetDate);
                    if (m != null && m > 0) { const need = requiredMonthly(bal, a.rate, target, m); const ok = (Number(a.contribution) || 0) >= need; forecast = { txt: `${ok ? "On track" : "Behind"} — need ${fmtMoney(need, true)}/mo to hit ${fmtMoney(target, true)} by ${fmtDate(a.targetDate)} (you save ${fmtMoney(a.contribution, true)}/mo)`, color: ok ? "#639922" : "#E24B4A" }; }
                    else forecast = { txt: "Target date is in the past", color: "#E24B4A" };
                  } else if (target) {
                    const m = monthsToGoal(bal, a.contribution, a.rate, target);
                    forecast = m == null ? { txt: "Add a monthly contribution to forecast a date", color: "var(--color-text-secondary)" } : { txt: `Reach ${fmtMoney(target, true)} in ${m} month${m !== 1 ? "s" : ""} (~${monthsFromNowLabel(m)})`, color: ac };
                  }
                  return (
                    <div key={a.id} style={{ background: "var(--color-background-primary)", borderRadius: 12, padding: 18, border: "0.5px solid var(--color-border-tertiary)", marginBottom: 10 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                        <span style={{ fontSize: 22 }}>{savTypeLabel(a.type).split(" ")[0]}</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                            <span style={{ fontWeight: 600, fontSize: 15 }}>{a.name}</span>
                            {a.type === "emergency" && <span style={{ fontSize: 10, background: hex2rgba("#E24B4A", 0.14), color: "#E24B4A", padding: "1px 7px", borderRadius: 10, fontWeight: 500 }}>Emergency fund</span>}
                          </div>
                          <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>{savTypeLabel(a.type).replace(/^\S+\s/, "")}{a.institution ? ` · ${a.institution}` : ""}{a.rate ? ` · ${a.rate}% AER` : ""}{a.contribution ? ` · ${fmtMoney(a.contribution, true)}/mo` : ""}</div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontSize: 17, fontWeight: 600, color: "#1D9E75" }}>{fmtMoney(bal)}</div>
                          {target > 0 && <div style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>of {fmtMoney(target, true)}</div>}
                        </div>
                        <button onClick={() => setSavModal(a)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, padding: "4px 6px" }}>✏️</button>
                        <button onClick={() => deleteSav(a.id)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, padding: "4px 6px" }}>🗑</button>
                      </div>
                      {target > 0 && (
                        <div style={{ height: 8, background: "var(--color-background-secondary)", borderRadius: 5, overflow: "hidden", marginBottom: 8 }}>
                          <div style={{ height: "100%", width: `${pct}%`, background: "#1D9E75", borderRadius: 5, transition: "width 0.4s" }} />
                        </div>
                      )}
                      {forecast && <div style={{ fontSize: 12.5, color: forecast.color, fontWeight: 500 }}>{forecast.txt}</div>}
                      {(a.pots && a.pots.length > 0) && (
                        <div style={{ marginTop: 10, paddingTop: 10, borderTop: "0.5px solid var(--color-border-tertiary)" }}>
                          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-secondary)", marginBottom: 6 }}>SINKING FUNDS / POTS</div>
                          {a.pots.map(pot => {
                            const m = pot.dueDate ? monthsBetweenToday(pot.dueDate) : null;
                            const needed = (m && m > 0) ? (Number(pot.target) || 0) / m : null;
                            return (
                              <div key={pot.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, marginBottom: 5 }}>
                                <span style={{ flex: 1 }}>🎯 {pot.label}{pot.dueDate ? ` · by ${fmtShort(pot.dueDate)}` : ""}</span>
                                <span style={{ color: "var(--color-text-secondary)" }}>{fmtMoney(pot.target, true)}{needed != null ? ` · ${fmtMoney(needed, true)}/mo` : " · set due date"}</span>
                                <button onClick={() => setPotModal({ accId: a.id, pot })} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12 }}>✏️</button>
                                <button onClick={() => deletePot(a.id, pot.id)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, color: "var(--color-text-secondary)" }}>×</button>
                              </div>
                            );
                          })}
                          {(() => { const totalNeed = a.pots.reduce((s, pot) => { const m = pot.dueDate ? monthsBetweenToday(pot.dueDate) : null; return s + ((m && m > 0) ? (Number(pot.target) || 0) / m : 0); }, 0); if (totalNeed <= 0) return null; const ok = (Number(a.contribution) || 0) >= totalNeed; return <div style={{ fontSize: 11, color: ok ? "#639922" : "#E24B4A", marginTop: 4 }}>Pots need {fmtMoney(totalNeed, true)}/mo {ok ? "— covered by your contribution" : `— more than your ${fmtMoney(a.contribution, true)}/mo`}</div>; })()}
                        </div>
                      )}
                      <button onClick={() => setPotModal({ accId: a.id, pot: null })} style={{ marginTop: 8, fontSize: 12, padding: "5px 12px", borderRadius: 8, cursor: "pointer", color: ac }}>+ Add a pot / sinking fund</button>
                    </div>
                  );
                })}
              </>
            )}
            </div>

            {/* Debts — bottom */}
            <div style={{ marginTop: 26, paddingTop: 20, borderTop: "0.5px solid var(--color-border-tertiary)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, gap: 10, flexWrap: "wrap" }}>
                <div style={{ fontSize: 15, fontWeight: 600 }}>💳 Debts</div>
                <button onClick={() => setDebtModal("new")} style={{ fontSize: 13, padding: "6px 14px", background: ac, color: "#fff", border: "none", borderRadius: 9, cursor: "pointer", fontWeight: 500 }}>+ Debt</button>
              </div>
              {debts.length === 0 && <div style={{ fontSize: 13, color: "var(--color-text-secondary)", padding: "2px 0 6px" }}>No debts tracked. Add credit cards, loans or car finance to see payoff order and what interest is costing you.</div>}
              {debts.length > 0 && (() => {
                const totalOwed = debts.reduce((s, d) => s + (Number(d.balance) || 0), 0);
                const totalMin = debts.reduce((s, d) => s + (Number(d.minPayment) || 0), 0);
                const monthlyInterest = debts.reduce((s, d) => s + (Number(d.balance) || 0) * (Number(d.rate) || 0) / 100 / 12, 0);
                const ordered = [...debts].sort((a, b) => debtStrategy === "avalanche" ? (Number(b.rate) || 0) - (Number(a.rate) || 0) : (Number(a.balance) || 0) - (Number(b.balance) || 0));
                return (
                  <>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10, marginBottom: 12 }}>
                      <StatCard label="Total owed" value={fmtMoney(totalOwed)} color="#E24B4A" />
                      <StatCard label="Min payments / mo" value={fmtMoney(totalMin)} />
                      <StatCard label="Interest / mo" value={fmtMoney(monthlyInterest)} color="#E24B4A" sub="at current balances" />
                    </div>
                    <div style={{ background: "var(--color-background-primary)", borderRadius: 12, padding: 16, border: "0.5px solid var(--color-border-tertiary)", marginBottom: 10 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                        <div style={{ fontSize: 14, fontWeight: 600, flex: 1 }}>🎯 Payoff order</div>
                        {[["avalanche", "Avalanche"], ["snowball", "Snowball"]].map(([v, l]) => (
                          <button key={v} onClick={() => setDebtStrategy(v)} style={{ fontSize: 12, padding: "5px 12px", borderRadius: 20, border: "none", cursor: "pointer", background: debtStrategy === v ? ac : "var(--color-background-secondary)", color: debtStrategy === v ? "#fff" : "var(--color-text-secondary)", fontWeight: debtStrategy === v ? 500 : 400 }}>{l}</button>
                        ))}
                      </div>
                      <div style={{ fontSize: 11.5, color: "var(--color-text-secondary)", marginBottom: 10 }}>{debtStrategy === "avalanche" ? "Highest interest rate first — costs you the least overall." : "Smallest balance first — quick wins to keep you motivated."} Pay the minimum on all, then put any spare money on #1.</div>
                      {ordered.map((d, i) => (
                        <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, padding: "6px 0", borderBottom: i < ordered.length - 1 ? "0.5px solid var(--color-border-tertiary)" : "none" }}>
                          <span style={{ width: 22, height: 22, borderRadius: "50%", background: i === 0 ? ac : "var(--color-background-secondary)", color: i === 0 ? "#fff" : "var(--color-text-secondary)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 600, flexShrink: 0 }}>{i + 1}</span>
                          <span style={{ flex: 1 }}>{d.name}{i === 0 && <span style={{ fontSize: 10.5, color: ac, marginLeft: 6 }}>pay this first</span>}</span>
                          <span style={{ color: "var(--color-text-secondary)" }}>{Number(d.rate) || 0}% APR</span>
                          <span style={{ color: "#E24B4A", fontWeight: 500, minWidth: 64, textAlign: "right" }}>{fmtMoney(d.balance, true)}</span>
                        </div>
                      ))}
                    </div>
                    {debts.map(d => {
                      const mi = (Number(d.balance) || 0) * (Number(d.rate) || 0) / 100 / 12;
                      const term = Number(d.termMonths) || 0;
                      const plan = debtPlan(d);
                      const pctPaid = term > 0 ? Math.min(100, Math.round((plan.paid / term) * 100)) : 0;
                      return (
                        <div key={d.id} style={{ background: "var(--color-background-primary)", borderRadius: 12, padding: 16, border: "0.5px solid var(--color-border-tertiary)", marginBottom: 10 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <span style={{ fontSize: 22 }}>💳</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 600, fontSize: 15 }}>{d.name}</div>
                            <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>{Number(d.rate) || 0}% APR{term > 0 ? ` · ${term}-month term` : ""}{d.minPayment ? ` · min ${fmtMoney(d.minPayment, true)}/mo` : ""}{mi > 0 ? ` · ~${fmtMoney(mi, true)}/mo interest` : ""}</div>
                            {plan.hasTerm && <div style={{ fontSize: 11.5, color: "var(--color-text-secondary)", marginTop: 2 }}>{plan.paid}/{term} months paid · {plan.monthsToEnd} left · ≈ {fmtMoney(plan.monthly, true)}/mo · still payable <b style={{ color: "var(--color-text-primary)" }}>{fmtMoney(plan.remainingPayable, true)}</b></div>}
                          </div>
                          <div style={{ fontSize: 17, fontWeight: 600, color: "#E24B4A" }}>{fmtMoney(d.balance)}</div>
                          <button onClick={() => setDebtModal(d)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, padding: "4px 6px" }}>✏️</button>
                          <button onClick={() => deleteDebt(d.id)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, padding: "4px 6px" }}>🗑</button>
                          </div>
                          {plan.hasTerm && term > 0 && (
                            <div style={{ height: 6, background: "var(--color-background-secondary)", borderRadius: 4, overflow: "hidden", marginTop: 10 }}>
                              <div style={{ height: "100%", width: `${pctPaid}%`, background: "#1D9E75", borderRadius: 4 }} />
                            </div>
                          )}
                          {(d.adjustments || []).length > 0 && <div style={{ fontSize: 11, color: "var(--color-text-secondary)", marginTop: 6 }}>{(d.adjustments || []).map(a => a.kind === "extra" ? `+${fmtMoney(a.value, true)} extra` : `${a.value}mo break (${a.mode === "extend" ? "pushed back" : "pay more"})`).join(" · ")}</div>}
                        </div>
                      );
                    })}
                  </>
                );
              })()}
            </div>
          </div>
        );
      })()}

      {/* ── Investments ── */}
      {tab === "investments" && (() => {
        const t = investmentTotals(investments);
        const monthlyInv = investments.reduce((s, h) => s + (Number(h.contribution) || 0), 0);
        const segs = investments.map((h, i) => ({ value: holdingValue(h), color: TAG_COLORS[i % TAG_COLORS.length], label: h.name }))
          .filter(s => s.value > 0).sort((a, b) => b.value - a.value);
        return (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, gap: 10, flexWrap: "wrap" }}>
              <div style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>Track holdings, performance and diversification. Prices update manually until Trading 212 is linked.</div>
              <button onClick={() => setInvModal("new")} style={{ fontSize: 13, padding: "7px 16px", background: ac, color: "#fff", border: "none", borderRadius: 9, cursor: "pointer", fontWeight: 500 }}>+ Holding</button>
            </div>

            {investments.length === 0 && (
              <div style={{ textAlign: "center", padding: 50, color: "var(--color-text-secondary)" }}>
                <div style={{ fontSize: 38, marginBottom: 12 }}>💹</div>
                <div style={{ fontSize: 15, marginBottom: 6 }}>No investments yet</div>
                <div style={{ fontSize: 13, marginBottom: 18 }}>Add a holding to track its value, gain/loss and how it diversifies your portfolio.</div>
                <button onClick={() => setInvModal("new")} style={{ fontSize: 13, padding: "8px 18px", background: ac, color: "#fff", border: "none", borderRadius: 9, cursor: "pointer" }}>+ Add a holding</button>
              </div>
            )}

            {investments.length > 0 && (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10, marginBottom: 14 }}>
                  <StatCard label="Portfolio value" value={fmtMoney(t.value)} color={ac} />
                  <StatCard label="Invested" value={fmtMoney(t.cost)} />
                  <StatCard label="Gain / loss" value={`${t.gain >= 0 ? "+" : "−"}${fmtMoney(Math.abs(t.gain))}`} color={t.gain >= 0 ? "#1D9E75" : "#E24B4A"} sub={t.cost > 0 ? `${t.gain >= 0 ? "+" : "−"}${Math.abs(t.gainPct).toFixed(1)}%` : null} />
                  {monthlyInv > 0 && <StatCard label="Investing / month" value={fmtMoney(monthlyInv)} />}
                </div>

                {segs.length > 0 && (
                  <div style={{ background: "var(--color-background-primary)", borderRadius: 12, padding: 18, border: "0.5px solid var(--color-border-tertiary)", marginBottom: 14, display: "flex", gap: 22, alignItems: "center", flexWrap: "wrap" }}>
                    <Donut segments={segs} center={<div><div style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>Total</div><div style={{ fontSize: 15, fontWeight: 700 }}>{fmtMoney(t.value, true)}</div></div>} />
                    <div style={{ flex: 1, minWidth: 200 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-secondary)", marginBottom: 8 }}>DIVERSIFICATION</div>
                      {segs.map(s => (
                        <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, marginBottom: 5 }}>
                          <span style={{ width: 10, height: 10, borderRadius: 3, background: s.color, flexShrink: 0 }} />
                          <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.label}</span>
                          <span style={{ color: "var(--color-text-secondary)" }}>{t.value > 0 ? (s.value / t.value * 100).toFixed(0) : 0}%</span>
                          <span style={{ fontWeight: 500, minWidth: 64, textAlign: "right" }}>{fmtMoney(s.value, true)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {investments.map(h => {
                  const val = holdingValue(h), cost = (Number(h.units) || 0) * (Number(h.avgCost) || 0), gain = val - cost;
                  const pct = cost > 0 ? gain / cost * 100 : 0;
                  return (
                    <div key={h.id} style={{ background: "var(--color-background-primary)", borderRadius: 12, padding: 16, border: "0.5px solid var(--color-border-tertiary)", marginBottom: 10, display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 15 }}>{h.name}{h.ticker ? <span style={{ fontSize: 12, color: "var(--color-text-secondary)", fontWeight: 400 }}> · {h.ticker}</span> : null}</div>
                        <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>{(Number(h.units) || 0)} units{h.account ? ` · ${h.account}` : ""}{h.contribution ? ` · ${fmtMoney(h.contribution, true)}/mo` : ""}</div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 16, fontWeight: 600 }}>{fmtMoney(val)}</div>
                        <div style={{ fontSize: 12, color: gain >= 0 ? "#1D9E75" : "#E24B4A", fontWeight: 500 }}>{gain >= 0 ? "+" : "−"}{fmtMoney(Math.abs(gain), true)}{cost > 0 ? ` (${gain >= 0 ? "+" : "−"}${Math.abs(pct).toFixed(1)}%)` : ""}</div>
                      </div>
                      <button onClick={() => setInvModal(h)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, padding: "4px 6px" }}>✏️</button>
                      <button onClick={() => deleteInvestment(h.id)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, padding: "4px 6px" }}>🗑</button>
                    </div>
                  );
                })}
              </>
            )}

            <div style={{ background: "var(--color-background-primary)", borderRadius: 14, padding: 20, border: "0.5px solid var(--color-border-tertiary)", marginTop: 14, textAlign: "center" }}>
              <div style={{ fontSize: 30, marginBottom: 8 }}>🔗</div>
              <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>Auto-sync from Trading 212</div>
              <div style={{ fontSize: 12.5, color: "var(--color-text-secondary)", lineHeight: 1.6, marginBottom: 14, maxWidth: 460, marginInline: "auto" }}>Pull live balances, holdings and prices straight from Trading 212 via its API (read-only). Needs your personal API key and a small server endpoint — arriving in Phase B alongside bank linking.</div>
              <button disabled style={{ fontSize: 13, padding: "9px 20px", background: "var(--color-background-secondary)", color: "var(--color-text-secondary)", border: "none", borderRadius: 10, cursor: "not-allowed", fontWeight: 500 }}>🔒 Connect Trading 212 — coming in Phase B</button>
            </div>
          </div>
        );
      })()}

      {/* ── Insurance ── */}
      {/* ── Pension ── */}
      {tab === "pension" && (() => {
        const privates = pensions.filter(p => p.type !== "state");
        const states = pensions.filter(p => p.type === "state");
        const forecasts = privates.map(p => ({ p, f: pensionForecast(p) }));
        const totalNowPot = pensionPotsTotal(state);
        const totalFinal = forecasts.reduce((s, x) => s + x.f.finalPot, 0);
        const privateIncomeReal = forecasts.reduce((s, x) => s + x.f.annualIncome4Real, 0);
        const stateIncome = states.reduce((s, p) => s + statePensionAnnual(p), 0);
        const combinedIncome = privateIncomeReal + stateIncome;
        const monthlyContrib = pensionMonthlyContribution(state);
        // Combined projected pot across all private pensions, by age.
        let combinedBars = [];
        if (forecasts.length) {
          const allAges = forecasts.flatMap(x => x.f.series.map(s => s.age));
          const minA = Math.min(...allAges), maxA = Math.max(...allAges);
          const rows = [];
          for (let a = minA; a <= maxA; a++) {
            let pot = 0;
            forecasts.forEach(x => { const ser = x.f.series; if (a < ser[0].age) return; const e = ser.find(s => s.age === a); pot += e ? e.pot : ser[ser.length - 1].pot; });
            rows.push({ age: a, pot });
          }
          const step = Math.max(1, Math.round((rows.length - 1) / 7) || 1);
          combinedBars = rows.filter((r, i) => i % step === 0 || i === rows.length - 1).map(r => ({ label: String(r.age), value: Math.max(0, r.pot), color: "#7F77DD" }));
        }
        const pfld = (p, label, key, opts) => (
          <Field label={label}>
            <input type="number" step={opts?.step || "any"} placeholder={opts?.ph || ""} value={p[key] ? p[key] : ""} onFocus={e => e.target.select()} onChange={e => setPensionById(p.id, key, e.target.value === "" ? "" : (parseFloat(e.target.value) || 0))} style={{ width: "100%", boxSizing: "border-box" }} />
          </Field>
        );
        return (
          <div>
            {/* Summary dashboard */}
            <SectionHead sub="Your whole retirement picture across every pension, plus the State Pension.">🏖 Pension dashboard</SectionHead>
            {pensions.length === 0 ? (
              <div style={{ textAlign: "center", padding: 36, color: "var(--color-text-secondary)" }}>
                <div style={{ fontSize: 38, marginBottom: 10 }}>🏖</div>
                <div style={{ fontSize: 14, marginBottom: 14 }}>No pensions yet — add a workplace/private pension and your State Pension.</div>
              </div>
            ) : (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10, marginBottom: 14 }}>
                  <StatCard label="Pots now" value={fmtMoney(totalNowPot, true)} />
                  <StatCard label="Projected pot" value={fmtMoney(totalFinal, true)} color={ac} sub="at retirement" />
                  <StatCard label="Retirement income" value={`${fmtMoney(combinedIncome, true)}/yr`} color="#1D9E75" sub="today's money" />
                  <StatCard label="Paying in" value={`${fmtMoney(monthlyContrib, true)}/mo`} sub="auto-added to your plan" />
                </div>
                {combinedBars.length > 0 && (
                  <div style={{ background: "var(--color-background-primary)", borderRadius: 12, padding: 18, border: "0.5px solid var(--color-border-tertiary)", marginBottom: 14 }}>
                    <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 16 }}>Combined pot by age (all private pensions)</div>
                    <BarsChart data={combinedBars} money />
                  </div>
                )}
                <div style={{ background: "var(--color-background-primary)", borderRadius: 12, padding: 18, border: "0.5px solid var(--color-border-tertiary)", marginBottom: 6 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Estimated retirement income (today's money)</div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "3px 0" }}><span style={{ color: "var(--color-text-secondary)" }}>Private pensions (≈4% drawdown)</span><span style={{ fontWeight: 500 }}>{fmtMoney(privateIncomeReal, true)}/yr</span></div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "3px 0" }}><span style={{ color: "var(--color-text-secondary)" }}>State Pension</span><span style={{ fontWeight: 500 }}>{fmtMoney(stateIncome, true)}/yr</span></div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, padding: "8px 0 0", marginTop: 6, borderTop: "0.5px solid var(--color-border-tertiary)", fontWeight: 700 }}><span>Combined</span><span style={{ color: ac }}>{fmtMoney(combinedIncome, true)}/yr · {fmtMoney(combinedIncome / 12, true)}/mo</span></div>
                </div>
              </>
            )}

            <div style={{ display: "flex", gap: 8, margin: "18px 0 14px", flexWrap: "wrap" }}>
              {states.length === 0 && <button onClick={() => addPension("state")} style={{ fontSize: 13, padding: "8px 16px", background: "#1D9E75", color: "#fff", border: "none", borderRadius: 9, cursor: "pointer", fontWeight: 500 }}>🇬🇧 + State Pension</button>}
              <button onClick={() => addPension("private")} style={{ fontSize: 13, padding: "8px 16px", background: ac, color: "#fff", border: "none", borderRadius: 9, cursor: "pointer", fontWeight: 500 }}>+ Private / workplace / SIPP</button>
            </div>
            {states.length === 0 && <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginBottom: 14 }}>Most people get the State Pension too — add it first, then any private, workplace or SIPP pensions.</div>}

            {/* Per-pension calculators — State Pension first */}
            {[...states, ...privates].map(p => {
              if (p.type === "state") {
                return (
                  <div key={p.id} style={{ background: "var(--color-background-primary)", borderRadius: 12, padding: 18, border: "0.5px solid var(--color-border-tertiary)", marginBottom: 14 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                      <div style={{ fontSize: 15, fontWeight: 600, flex: 1 }}>🇬🇧 State Pension</div>
                      <button onClick={() => deletePension(p.id)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14 }}>🗑</button>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      {pfld(p, "Weekly amount (£)", "weekly", { ph: String(STATE_PENSION_WEEKLY) })}
                      {pfld(p, "From age", "startAge", { step: "1", ph: "67" })}
                    </div>
                    <div style={{ fontSize: 12.5, color: "var(--color-text-secondary)", marginTop: 8 }}>≈ <b style={{ color: "var(--color-text-primary)" }}>{fmtMoney(statePensionAnnual(p), true)}/yr</b> ({fmtMoney(statePensionAnnual(p) / 12, true)}/mo) from age {p.startAge || 67}. Full new State Pension is ~£{STATE_PENSION_WEEKLY}/week — check your forecast at gov.uk.</div>
                  </div>
                );
              }
              const f = pensionForecast(p);
              const ready = (Number(p.retireAge) || 0) > (Number(p.currentAge) || 0) && (Number(p.salary) || 0) > 0;
              return (
                <div key={p.id} style={{ background: "var(--color-background-primary)", borderRadius: 12, padding: 18, border: "0.5px solid var(--color-border-tertiary)", marginBottom: 14 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                    <input value={p.name || ""} onChange={e => setPensionById(p.id, "name", e.target.value)} placeholder="Pension name" style={{ flex: 1, fontSize: 15, fontWeight: 600, border: "1px solid transparent", background: "transparent", padding: "4px 2px" }} />
                    <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "var(--color-text-secondary)", cursor: "pointer" }}>
                      <input type="checkbox" checked={p.contributing !== false} onChange={e => setPensionById(p.id, "contributing", e.target.checked)} /> Still paying in
                    </label>
                    <button onClick={() => deletePension(p.id)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14 }}>🗑</button>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    {pfld(p, "Current age", "currentAge", { step: "1", ph: "e.g. 30" })}
                    {pfld(p, "Retirement age", "retireAge", { step: "1", ph: "e.g. 67" })}
                    {pfld(p, "Current pot (£)", "currentPot", { ph: "0" })}
                    {pfld(p, "Annual salary (£)", "salary", { ph: "e.g. 35000" })}
                    {p.contributing !== false && pfld(p, "Your contribution (%)", "employeePct", { ph: "e.g. 5" })}
                    {p.contributing !== false && pfld(p, "Employer match (%)", "employerPct", { ph: "e.g. 3" })}
                    {pfld(p, "Growth (%/yr)", "growthPct", { ph: "e.g. 5" })}
                    {pfld(p, "Inflation (%/yr)", "inflationPct", { ph: "e.g. 2.5" })}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 4 }}>
                    <Field label="Employment started"><input type="date" value={p.employmentStart || ""} onChange={e => setPensionById(p.id, "employmentStart", e.target.value)} style={{ width: "100%", boxSizing: "border-box" }} /></Field>
                    <Field label="Paying in since"><input type="date" value={p.payingSince || ""} onChange={e => setPensionById(p.id, "payingSince", e.target.value)} style={{ width: "100%", boxSizing: "border-box" }} /></Field>
                    {p.contributing === false && <Field label="Stopped paying in"><input type="date" value={p.stoppedPaying || ""} onChange={e => setPensionById(p.id, "stoppedPaying", e.target.value)} style={{ width: "100%", boxSizing: "border-box" }} /></Field>}
                  </div>
                  {p.contributing === false && <div style={{ fontSize: 12, color: "#BA7517", marginTop: 8 }}>⏸ Paid-up{p.stoppedPaying ? ` since ${fmtShort(p.stoppedPaying)}` : ""} — no new contributions, just growth.</div>}
                  {ready ? (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 10, marginTop: 14 }}>
                      <StatCard label={`Pot at ${p.retireAge}`} value={fmtMoney(f.finalPot, true)} color={ac} />
                      <StatCard label="Today's money" value={fmtMoney(f.finalPotReal, true)} />
                      <StatCard label="Income ≈4%" value={`${fmtMoney(f.annualIncome4Real, true)}/yr`} color="#1D9E75" />
                    </div>
                  ) : <div style={{ fontSize: 12.5, color: "var(--color-text-secondary)", marginTop: 10 }}>Add age, retirement age and salary to forecast this pension.</div>}
                </div>
              );
            })}
          </div>
        );
      })()}

      {/* ── Subscriptions ── */}
      {tab === "subs" && (() => {
        const ymd = d => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
        const nextFromDay = day => { const t = new Date(); t.setHours(0, 0, 0, 0); const mk2 = (yy, mm) => { const dim = new Date(yy, mm + 1, 0).getDate(); return new Date(yy, mm, Math.min(day || 1, dim)); }; let d = mk2(t.getFullYear(), t.getMonth()); if (d < t) d = mk2(t.getFullYear(), t.getMonth() + 1); return ymd(d); };
        const manual = subs.map(s => ({ id: s.id, name: s.name, amount: Number(s.amount) || 0, next: nextFromDay(Number(s.day) || 1), categoryId: s.categoryId, auto: false }));
        const dismissed = state.dismissedSubs || [];
        const auto = detectSubscriptions(state).filter(a => !manual.some(m => m.name.toLowerCase() === a.name.toLowerCase()) && !dismissed.includes(a.name.toLowerCase())).map(a => ({ id: "auto_" + a.name, name: a.name, amount: a.amount, next: a.lastDate ? (() => { const d = new Date(a.lastDate + "T00:00:00"); d.setMonth(d.getMonth() + 1); return ymd(d); })() : "", categoryId: a.categoryId, auto: true }));
        const items = [...manual, ...auto].sort((x, y) => (x.next || "z").localeCompare(y.next || "z"));
        const totalM = items.reduce((s, i) => s + i.amount, 0);
        return (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, gap: 10, flexWrap: "wrap" }}>
              <div style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>Recurring payments — auto-detected from transactions plus any you add.</div>
              <button onClick={() => setSubModal("new")} style={{ fontSize: 13, padding: "7px 16px", background: ac, color: "#fff", border: "none", borderRadius: 9, cursor: "pointer", fontWeight: 500 }}>+ Subscription</button>
            </div>
            {items.length === 0 ? (
              <div style={{ textAlign: "center", padding: 50, color: "var(--color-text-secondary)" }}>
                <div style={{ fontSize: 38, marginBottom: 12 }}>🔁</div>
                <div style={{ fontSize: 14, marginBottom: 6 }}>No subscriptions found yet</div>
                <div style={{ fontSize: 12, marginBottom: 16 }}>Add one, or import transactions so we can spot recurring payments.</div>
                <button onClick={() => setSubModal("new")} style={{ fontSize: 13, padding: "8px 18px", background: ac, color: "#fff", border: "none", borderRadius: 9, cursor: "pointer" }}>+ Add a subscription</button>
              </div>
            ) : (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10, marginBottom: 14 }}>
                  <StatCard label="Per month" value={fmtMoney(totalM)} color={ac} />
                  <StatCard label="Per year" value={fmtMoney(totalM * 12)} color="#E24B4A" sub="potential saving if cancelled" />
                  <StatCard label="Active" value={String(items.length)} color="var(--color-text-primary)" sub="recurring payments" />
                </div>
                {items.map(it => {
                  const c = cats.find(x => x.id === it.categoryId);
                  return (
                    <div key={it.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 14px", background: "var(--color-background-primary)", borderRadius: 10, border: "0.5px solid var(--color-border-tertiary)", marginBottom: 7 }}>
                      <span style={{ fontSize: 20, width: 26, textAlign: "center" }}>{c?.emoji || "🔁"}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 500 }}>{it.name} {it.auto && <span style={{ fontSize: 10, background: hex2rgba(ac, 0.12), color: ac, padding: "1px 7px", borderRadius: 10 }}>auto</span>}</div>
                        <div style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>{it.next ? `next ~${fmtShort(it.next)}` : "—"} · {fmtMoney(it.amount * 12, true)}/yr</div>
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 600, width: 90, textAlign: "right" }}>{fmtMoney(it.amount)}<span style={{ fontSize: 11, color: "var(--color-text-secondary)", fontWeight: 400 }}>/mo</span></div>
                      {!it.auto && <button onClick={() => setSubModal(subs.find(s => s.id === it.id))} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13 }}>✏️</button>}
                      {!it.auto && <button onClick={() => deleteSub(it.id)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13 }}>🗑</button>}
                      {it.auto && <button onClick={() => setSubModal({ name: it.name, amount: it.amount, day: 1, categoryId: it.categoryId })} title="Save as tracked subscription" style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13 }}>＋</button>}
                      {it.auto && <button onClick={() => { if (confirm(`Dismiss "${it.name}"? It won't show as a detected subscription anymore.`)) up({ dismissedSubs: [...(state.dismissedSubs || []), it.name.toLowerCase()] }); }} title="Dismiss this detected subscription" style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13 }}>🗑</button>}
                    </div>
                  );
                })}
              </>
            )}
          </div>
        );
      })()}

      {/* ── Trends ── */}
      {tab === "trends" && (() => {
        const months = Array.from({ length: 6 }, (_, i) => shiftMonth(curMonthKey(), -(5 - i)));
        const series = months.map(mk => ({ mk, st: monthStats(state, mk) }));
        const spendBars = series.map(s => ({ label: monthShort(s.mk), value: s.st.spend, color: ac }));
        const savCat = cats.find(c => c.kind === "savings");
        let cumSav = 0;
        const savBars = series.map(s => { cumSav += (savCat ? (s.st.byCat[savCat.id]?.spent || 0) : 0); return { label: monthShort(s.mk), value: cumSav, color: "#1D9E75" }; });
        const hasData = series.some(s => s.st.spend > 0 || s.st.income > 0);
        return (
          <div style={{ display: "grid", gap: 14 }}>
            <SectionHead sub="A saved snapshot of every month — kept up to 2 years, even after transactions roll off.">📅 Monthly reports</SectionHead>
            <MonthlyReports state={state} />
            <SectionHead sub="The last 6 months at a glance." top={10}>📈 Trends</SectionHead>
            {!hasData && (
              <div style={{ textAlign: "center", padding: 40, color: "var(--color-text-secondary)" }}><div style={{ fontSize: 38, marginBottom: 12 }}>📈</div><div style={{ fontSize: 14, marginBottom: 16 }}>No 6-month history yet — add transactions to see the trend charts. The date-range explorer below works with any transactions.</div><button onClick={loadSample} style={{ fontSize: 13, padding: "8px 16px", borderRadius: 9, cursor: "pointer" }}>✨ Load sample data</button></div>
            )}
            {hasData && (<>
            <div style={{ background: "var(--color-background-primary)", borderRadius: 12, padding: 18, border: "0.5px solid var(--color-border-tertiary)" }}>
              <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 16 }}>Monthly spending (last 6 months)</div>
              <BarsChart data={spendBars} money />
            </div>
            <div style={{ background: "var(--color-background-primary)", borderRadius: 12, padding: 18, border: "0.5px solid var(--color-border-tertiary)" }}>
              <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 16 }}>Income vs spending</div>
              <div style={{ display: "flex", gap: 18 }}>
                <div style={{ flex: 1 }}><div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginBottom: 8 }}>Income</div><BarsChart data={series.map(s => ({ label: monthShort(s.mk), value: s.st.income, color: "#1D9E75" }))} money height={110} /></div>
                <div style={{ flex: 1 }}><div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginBottom: 8 }}>Spending</div><BarsChart data={spendBars} money height={110} /></div>
              </div>
            </div>
            {savCat && (
              <div style={{ background: "var(--color-background-primary)", borderRadius: 12, padding: 18, border: "0.5px solid var(--color-border-tertiary)" }}>
                <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 16 }}>💰 Savings building up (cumulative)</div>
                <BarsChart data={savBars} money />
              </div>
            )}
            {(() => {
              const variance = cats.map(c => { let planned = 0, spent = 0, n = 0; series.forEach(s => { const b = s.st.byCat[c.id]; if (b && (b.planned > 0 || b.spent > 0)) { planned += b.planned; spent += b.spent; n++; } }); return { c, ap: n ? planned / n : 0, asp: n ? spent / n : 0, n }; }).filter(v => v.n > 0 && (v.ap > 0 || v.asp > 0));
              if (!variance.length) return null;
              return (
                <div style={{ background: "var(--color-background-primary)", borderRadius: 12, padding: 18, border: "0.5px solid var(--color-border-tertiary)" }}>
                  <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>Budget vs actual</div>
                  <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginBottom: 12 }}>Average per month — where you consistently over/under-spend.</div>
                  {variance.sort((a, b) => (b.asp - b.ap) - (a.asp - a.ap)).map(v => { const over = v.asp > v.ap * 1.05, under = v.ap > 0 && v.asp < v.ap * 0.95; const col = over ? "#E24B4A" : under ? "#639922" : "var(--color-text-secondary)"; return (
                    <div key={v.c.id} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, padding: "6px 0", borderBottom: "0.5px solid var(--color-border-tertiary)" }}>
                      <span style={{ flex: 1 }}>{v.c.emoji} {v.c.name}</span>
                      <span style={{ color: "var(--color-text-secondary)", fontSize: 12 }}>plan {fmtMoney(v.ap, true)} · actual {fmtMoney(v.asp, true)}</span>
                      <span style={{ color: col, fontWeight: 500, width: 92, textAlign: "right" }}>{over ? `over ${fmtMoney(v.asp - v.ap, true)}` : under ? `under ${fmtMoney(v.ap - v.asp, true)}` : "on track"}</span>
                    </div>
                  ); })}
                </div>
              );
            })()}
            </>)}
            <MoneyInsights state={state} accentColor={ac} />
          </div>
        );
      })()}

      {/* ── Transactions ── */}
      {tab === "transactions" && (() => {
        const payday = state.payday || { type: "monthly", day: 1 };
        const bounds = txnMode === "range" ? { from: txnFrom || "0000-01-01", to: txnTo || "9999-12-31", label: (txnFrom && txnTo) ? `${fmtShort(txnFrom)} – ${fmtShort(txnTo)}` : "Pick a date range" }
          : txnMode === "week" ? weekBounds(todayStr(), txnOffset)
          : txnMode === "month" ? monthBoundsStr(todayStr(), txnOffset)
          : payPeriodBounds(payday, todayStr(), txnOffset);
        let list = (state.transactions || []).filter(t => (t.date || "") >= bounds.from && (t.date || "") <= bounds.to).sort((a, b) => (b.date || "").localeCompare(a.date || ""));
        if (txnFilter) list = list.filter(t => t.categoryId === txnFilter);
        if (txnSearch.trim()) { const q = txnSearch.toLowerCase(); list = list.filter(t => (t.description || "").toLowerCase().includes(q)); }
        const pSpent = list.filter(t => t.type !== "income").reduce((s, t) => s + (Number(t.amount) || 0), 0);
        const pEarnt = list.filter(t => t.type === "income").reduce((s, t) => s + (Number(t.amount) || 0), 0);
        const modeBtn = (m, l) => <button key={m} onClick={() => { setTxnMode(m); setTxnOffset(0); }} style={{ fontSize: 12.5, padding: "6px 12px", borderRadius: 20, border: "none", cursor: "pointer", background: txnMode === m ? ac : "var(--color-background-secondary)", color: txnMode === m ? "#fff" : "var(--color-text-secondary)", fontWeight: txnMode === m ? 500 : 400 }}>{l}</button>;
        return (
          <div>
            {/* Prominent period selector */}
            <div style={{ background: "var(--color-background-primary)", borderRadius: 12, border: "0.5px solid var(--color-border-tertiary)", padding: 14, marginBottom: 12 }}>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
                {modeBtn("payperiod", "Pay period")}{modeBtn("week", "Week")}{modeBtn("month", "Month")}{modeBtn("range", "Custom range")}
                <button onClick={() => setPaydayEdit(v => !v)} title="Payday settings" style={{ fontSize: 12.5, padding: "6px 10px", borderRadius: 20, cursor: "pointer", color: ac }}>⚙ Payday</button>
              </div>
              {paydayEdit && (
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 12, fontSize: 12.5, background: "var(--color-background-secondary)", borderRadius: 8, padding: "8px 10px" }}>
                  <span style={{ color: "var(--color-text-secondary)" }}>I get paid</span>
                  <select value={payday.type} onChange={e => up({ payday: { ...payday, type: e.target.value, day: e.target.value === "monthly" ? 1 : 5 } })} style={{ fontSize: 12.5 }}>
                    <option value="monthly">monthly (on a date)</option>
                    <option value="lastWeekday">monthly (last weekday)</option>
                    <option value="weekly">weekly</option>
                  </select>
                  {payday.type === "monthly" ? (
                    <><span style={{ color: "var(--color-text-secondary)" }}>on day</span><input type="number" min="1" max="28" value={payday.day} onChange={e => up({ payday: { ...payday, day: Math.min(28, Math.max(1, parseInt(e.target.value, 10) || 1)) } })} style={{ width: 60, fontSize: 12.5 }} /></>
                  ) : (
                    <><span style={{ color: "var(--color-text-secondary)" }}>{payday.type === "lastWeekday" ? "last" : "every"}</span>
                    <select value={payday.day} onChange={e => up({ payday: { ...payday, day: parseInt(e.target.value, 10) } })} style={{ fontSize: 12.5 }}>
                      {["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map((d, i) => <option key={i} value={i}>{d}</option>)}
                    </select></>
                  )}
                  <span style={{ color: "var(--color-text-secondary)" }}>· your tracker resets each new period</span>
                </div>
              )}
              {txnMode === "range" ? (
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <input type="date" value={txnFrom} onChange={e => setTxnFrom(e.target.value)} style={{ fontSize: 13 }} />
                  <span style={{ color: "var(--color-text-secondary)", fontSize: 13 }}>to</span>
                  <input type="date" value={txnTo} onChange={e => setTxnTo(e.target.value)} style={{ fontSize: 13 }} />
                </div>
              ) : (
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <button onClick={() => setTxnOffset(o => o - 1)} style={{ padding: "5px 11px", borderRadius: 8, cursor: "pointer" }}>◀</button>
                  <div style={{ flex: 1, textAlign: "center", fontSize: 14, fontWeight: 600 }}>{bounds.label}</div>
                  <button onClick={() => setTxnOffset(o => o + 1)} disabled={txnOffset >= 0} style={{ padding: "5px 11px", borderRadius: 8, cursor: txnOffset >= 0 ? "default" : "pointer", opacity: txnOffset >= 0 ? 0.4 : 1 }}>▶</button>
                  {txnOffset !== 0 && <button onClick={() => setTxnOffset(0)} style={{ fontSize: 12, padding: "5px 10px", borderRadius: 8, cursor: "pointer", color: ac }}>Now</button>}
                </div>
              )}
              <div style={{ display: "flex", gap: 16, marginTop: 12, fontSize: 13, flexWrap: "wrap" }}>
                <span>Spent <b style={{ color: "#E24B4A" }}>{fmtMoney(pSpent)}</b></span>
                <span>Earnt <b style={{ color: "#1D9E75" }}>{fmtMoney(pEarnt)}</b></span>
                <span>Net <b style={{ color: pEarnt - pSpent >= 0 ? "#639922" : "#E24B4A" }}>{pEarnt - pSpent >= 0 ? "+" : "−"}{fmtMoney(Math.abs(pEarnt - pSpent))}</b></span>
                <span style={{ color: "var(--color-text-secondary)" }}>{list.length} transaction{list.length !== 1 ? "s" : ""}</span>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, gap: 10, flexWrap: "wrap" }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <input placeholder="Search…" value={txnSearch} onChange={e => setTxnSearch(e.target.value)} style={{ fontSize: 13, width: 140 }} />
                <select value={txnFilter} onChange={e => setTxnFilter(e.target.value)} style={{ fontSize: 12, padding: "5px 8px" }}>
                  <option value="">All categories</option>
                  {cats.map(c => <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>)}
                </select>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <input ref={csvRef} type="file" accept=".csv,text/csv" style={{ display: "none" }} onChange={e => { importCSV(e.target.files[0]); e.target.value = ""; }} />
                <button onClick={() => csvRef.current && csvRef.current.click()} style={{ fontSize: 13, padding: "7px 14px", borderRadius: 9, cursor: "pointer" }}>⬆ Import CSV</button>
                <button onClick={loadSample} style={{ fontSize: 13, padding: "7px 14px", borderRadius: 9, cursor: "pointer" }}>✨ Sample</button>
                <button onClick={() => setTxnModal("new")} style={{ fontSize: 13, padding: "7px 16px", background: ac, color: "#fff", border: "none", borderRadius: 9, cursor: "pointer", fontWeight: 500 }}>+ Transaction</button>
              </div>
            </div>
            {(state.transactions || []).length > 0 && list.length === 0 && <div style={{ textAlign: "center", padding: 30, color: "var(--color-text-secondary)", fontSize: 13 }}>No transactions in this period.</div>}
            {(state.transactions || []).length === 0 && <div style={{ textAlign: "center", padding: 50, color: "var(--color-text-secondary)" }}><div style={{ fontSize: 36, marginBottom: 10 }}>💳</div><div style={{ fontSize: 14, marginBottom: 6 }}>No transactions yet</div><div style={{ fontSize: 12 }}>Import a Lloyds CSV export, add manually, or load sample data.</div></div>}
            {list.map(t => {
              const c = catById(t.categoryId);
              const income = t.type === "income";
              return (
                <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 14px", background: "var(--color-background-primary)", borderRadius: 10, border: "0.5px solid var(--color-border-tertiary)", marginBottom: 7 }}>
                  <span style={{ fontSize: 20, width: 26, textAlign: "center" }}>{income ? "💰" : (c?.emoji || "❓")}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.description || (income ? "Income" : "Transaction")}</div>
                    <div style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>{fmtDate(t.date)}{t.source === "manual" ? "" : " · 🏦"}</div>
                  </div>
                  {!income && (
                    <select value={t.categoryId || ""} onChange={e => setTxnCat(t.id, e.target.value)} style={{ fontSize: 11, padding: "3px 6px", maxWidth: 130 }}>
                      <option value="">Uncategorised</option>
                      {cats.map(sc => <option key={sc.id} value={sc.id}>{sc.emoji} {sc.name}</option>)}
                    </select>
                  )}
                  <div style={{ fontSize: 14, fontWeight: 600, color: income ? "#1D9E75" : "var(--color-text-primary)", width: 84, textAlign: "right" }}>{income ? "+" : "−"}{fmtMoney(t.amount)}</div>
                  <button onClick={() => setTxnModal(t)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, padding: "2px 4px" }}>✏️</button>
                  <button onClick={() => deleteTxn(t.id)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, padding: "2px 4px" }}>🗑</button>
                </div>
              );
            })}
            {(state.transactions || []).length > 0 && <div style={{ fontSize: 11.5, color: "var(--color-text-secondary)", textAlign: "center", marginTop: 14 }}>🗄 Tend keeps the last 6 months of transactions. Older ones roll off automatically — your monthly totals are saved in <b>Reports</b>.</div>}
          </div>
        );
      })()}

      {/* ── Reports (monthly history, up to 2 years) ── */}
      {/* ── Categories ── */}
      {tab === "categories" && (
        <div>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 14 }}>
            <button onClick={() => setCatModal("new")} style={{ fontSize: 13, padding: "7px 16px", background: ac, color: "#fff", border: "none", borderRadius: 9, cursor: "pointer", fontWeight: 500 }}>+ New category</button>
          </div>
          {cats.map(c => (
            <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 16px", background: "var(--color-background-primary)", borderRadius: 11, border: "0.5px solid var(--color-border-tertiary)", marginBottom: 8 }}>
              <span style={{ fontSize: 24 }}>{c.emoji}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 500, fontSize: 14, color: c.color }}>{c.name}</div>
                <div style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>{c.kind === "savings" ? "Savings pot" : "Spending"}</div>
              </div>
              <button onClick={() => setCatModal(c)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, padding: "4px 6px" }}>✏️</button>
              <button onClick={() => deleteCat(c.id)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, padding: "4px 6px" }}>🗑</button>
            </div>
          ))}
        </div>
      )}

      {/* ── Connect bank ── */}
      {tab === "connect" && (
        <div style={{ maxWidth: 560 }}>
          <div style={{ background: "var(--color-background-primary)", borderRadius: 14, padding: 24, border: "0.5px solid var(--color-border-tertiary)", textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>🏦</div>
            <div style={{ fontSize: 17, fontWeight: 600, marginBottom: 8 }}>Link your Lloyds account</div>
            <div style={{ fontSize: 13, color: "var(--color-text-secondary)", lineHeight: 1.6, marginBottom: 18 }}>
              Pull your real transactions in automatically via Open Banking (Enable Banking). Read-only and secure — it can never move your money. Your bank login happens on Lloyds’ own site.
            </div>
            <button disabled style={{ fontSize: 14, padding: "10px 22px", background: "var(--color-background-secondary)", color: "var(--color-text-secondary)", border: "none", borderRadius: 10, cursor: "not-allowed", fontWeight: 500 }}>🔒 Connect Lloyds — coming in Phase B</button>
          </div>
          <div style={{ background: "var(--color-background-primary)", borderRadius: 14, padding: 22, border: "0.5px solid var(--color-border-tertiary)", marginTop: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 12 }}>To switch this on, you’ll need:</div>
            {[
              ["1", "A free Enable Banking account", "Sign up at enablebanking.com → create an application → whitelist your own Lloyds account for Restricted Production (free, no contract). You get an Application ID + a private key."],
              ["2", "Supabase finished", "Fill config.js with your project URL + anon key, and add the service-role key in Vercel."],
              ["3", "Keys added to Vercel", "Set ENABLE_APPLICATION_ID and ENABLE_PRIVATE_KEY (and ANTHROPIC_API_KEY for smart auto-categorising)."]
            ].map(([n, t, d]) => (
              <div key={n} style={{ display: "flex", gap: 12, marginBottom: 12 }}>
                <span style={{ width: 24, height: 24, borderRadius: "50%", background: hex2rgba(ac, 0.12), color: ac, fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{n}</span>
                <div><div style={{ fontSize: 13, fontWeight: 500 }}>{t}</div><div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 2 }}>{d}</div></div>
              </div>
            ))}
            <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 6, lineHeight: 1.5 }}>Until then, everything here works on manual entries or sample data — your plan, trends and stats are fully usable.</div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Digital Life Audit: the view ─────────────────────────────────────────────

function AuditDot({ status }) {
  return <span style={{ width: 9, height: 9, borderRadius: "50%", background: AUDIT_STATUS_COLOR[status] || "var(--color-text-secondary)", flexShrink: 0, display: "inline-block" }} />;
}
function CheckRow({ checked, label, accentColor, onToggle, onDelete }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0" }}>
      <button onClick={onToggle} aria-pressed={checked} style={{ width: 20, height: 20, borderRadius: 6, flexShrink: 0, cursor: "pointer", border: `1.5px solid ${checked ? accentColor : "var(--color-border-tertiary)"}`, background: checked ? accentColor : "transparent", color: "#fff", fontSize: 12, lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}>{checked ? "✓" : ""}</button>
      <span style={{ flex: 1, fontSize: 13.5, color: checked ? "var(--color-text-secondary)" : "var(--color-text-primary)", textDecoration: checked ? "line-through" : "none" }}>{label}</span>
      {onDelete && <button onClick={onDelete} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, color: "var(--color-text-secondary)" }}>×</button>}
    </div>
  );
}

function AuditView({ state, up, accentColor, goFinance }) {
  const ac = accentColor;
  const audit = state.audit || {};
  const freq = Number(audit.frequencyDays) || 90;
  const checks = audit.checks || {};
  const custom = audit.customItems || {};
  const last = audit.lastCompleted || "";
  const daysSince = last ? Math.round((new Date(new Date().toDateString()) - new Date(last + "T00:00:00")) / 86400000) : null;
  const daysLeft = last ? freq - daysSince : null;
  let statusTxt, statusColor;
  if (!last) { statusTxt = "Never reviewed — run your first audit"; statusColor = ac; }
  else if (daysLeft > 0) { statusTxt = `Up to date · next due in ${daysLeft} day${daysLeft !== 1 ? "s" : ""}`; statusColor = "#1D9E75"; }
  else if (daysLeft === 0) { statusTxt = "Review due today"; statusColor = "#BA7517"; }
  else { statusTxt = `Overdue by ${-daysLeft} day${-daysLeft !== 1 ? "s" : ""}`; statusColor = "#E24B4A"; }

  const sections = AUDIT_SECTIONS.map(s => ({ ...s, items: [...s.items, ...(custom[s.id] || [])] }));
  const allItems = sections.flatMap(s => s.items);
  const doneCount = allItems.filter(it => checks[it.id]).length;
  const pct = allItems.length ? Math.round(doneCount / allItems.length * 100) : 0;

  const toggle = id => up({ audit: { ...audit, checks: { ...checks, [id]: !checks[id] } } });
  const addCustom = (sec, label) => { const id = "cust_" + genId(); up({ audit: { ...audit, customItems: { ...custom, [sec]: [...(custom[sec] || []), { id, label }] } } }); };
  const delCustom = (sec, id) => { const c = { ...checks }; delete c[id]; up({ audit: { ...audit, checks: c, customItems: { ...custom, [sec]: (custom[sec] || []).filter(i => i.id !== id) } } }); };
  const setFreq = v => up({ audit: { ...audit, frequencyDays: Number(v) || 90 } });
  const complete = () => { const today = todayStr(); up({ audit: { ...audit, lastCompleted: today, history: [...(audit.history || []), today], checks: {}, subsReviewed: {} } }); };

  const fh = financialHealth(state);
  const manual = state.subscriptions || [];
  const allSubs = [
    ...manual.map(m => ({ name: m.name, amount: Number(m.amount) || 0 })),
    ...detectSubscriptions(state).filter(a => !manual.some(m => (m.name || "").toLowerCase() === a.name.toLowerCase())).map(a => ({ name: a.name, amount: a.amount })),
  ].filter(s => s.name).sort((a, b) => b.amount - a.amount);
  const subsReviewed = audit.subsReviewed || {};
  const toggleSub = name => up({ audit: { ...audit, subsReviewed: { ...subsReviewed, [name]: !subsReviewed[name] } } });

  const card = { background: "var(--color-background-primary)", borderRadius: 14, padding: 18, border: "0.5px solid var(--color-border-tertiary)", marginBottom: 14 };
  const sectionTitle = (icon, title, right) => (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
      <span style={{ fontSize: 16 }}>{icon}</span>
      <span style={{ fontSize: 15, fontWeight: 600, flex: 1 }}>{title}</span>
      {right}
    </div>
  );

  return (
    <div style={{ maxWidth: 760 }}>
      <h1 style={{ fontSize: 22, fontWeight: 600, margin: "0 0 4px" }}>🛡️ Digital Life Audit</h1>
      <p style={{ fontSize: 13, color: "var(--color-text-secondary)", margin: "0 0 18px" }}>A periodic review of your accounts, subscriptions, security, data hygiene and financial health.</p>

      {/* Status / cadence */}
      <div style={{ ...card, background: hex2rgba(statusColor, 0.08), borderColor: hex2rgba(statusColor, 0.3) }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: statusColor }}>{statusTxt}</div>
            <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 2 }}>{last ? `Last reviewed ${fmtDate(last)} (${daysSince} day${daysSince !== 1 ? "s" : ""} ago)` : "Tick off the checks below, then mark your audit complete."}</div>
          </div>
          <button onClick={complete} style={{ fontSize: 13, padding: "9px 18px", background: ac, color: "#fff", border: "none", borderRadius: 10, cursor: "pointer", fontWeight: 500 }}>✓ Mark audit complete</button>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14 }}>
          <div style={{ flex: 1, height: 8, background: "var(--color-background-secondary)", borderRadius: 5, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${pct}%`, background: statusColor, borderRadius: 5, transition: "width 0.4s" }} />
          </div>
          <div style={{ fontSize: 12, color: "var(--color-text-secondary)", whiteSpace: "nowrap" }}>{doneCount}/{allItems.length} checks · {pct}%</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, fontSize: 12.5, color: "var(--color-text-secondary)" }}>
          <span>Review every</span>
          <select value={freq} onChange={e => setFreq(e.target.value)} style={{ fontSize: 12.5, padding: "4px 6px" }}>
            <option value={30}>month</option>
            <option value={90}>3 months</option>
            <option value={180}>6 months</option>
            <option value={365}>year</option>
          </select>
        </div>
      </div>

      {/* Financial health */}
      <div style={card}>
        {sectionTitle("🏦", "Financial health")}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 10 }}>
          {fh.indicators.map(ind => (
            <div key={ind.label} style={{ display: "flex", gap: 10, padding: "10px 12px", background: "var(--color-background-secondary)", borderRadius: 10 }}>
              <div style={{ paddingTop: 5 }}><AuditDot status={ind.status} /></div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <span style={{ fontSize: 12.5, color: "var(--color-text-secondary)" }}>{ind.label}</span>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>{ind.value}</span>
                </div>
                <div style={{ fontSize: 11, color: "var(--color-text-secondary)", marginTop: 2 }}>{ind.note}</div>
              </div>
            </div>
          ))}
        </div>
        <button onClick={goFinance} style={{ marginTop: 12, fontSize: 12.5, padding: "6px 14px", borderRadius: 8, cursor: "pointer", color: ac }}>Open Finance →</button>
      </div>

      {/* Subscriptions review */}
      <div style={card}>
        {sectionTitle("🔁", "Subscriptions review", <span style={{ fontSize: 12.5, color: "var(--color-text-secondary)" }}>{fmtMoney(auditSubsMonthly(state), true)}/mo</span>)}
        {allSubs.length === 0 && <div style={{ fontSize: 13, color: "var(--color-text-secondary)", padding: "6px 0" }}>No subscriptions found yet. Add them in Finance → Subscriptions, or import a bank CSV, and they'll appear here to review.</div>}
        {allSubs.map(s => (
          <CheckRow key={s.name} checked={!!subsReviewed[s.name]} accentColor={ac} onToggle={() => toggleSub(s.name)}
            label={<span style={{ display: "inline-flex", width: "100%", justifyContent: "space-between", gap: 8 }}><span>{s.name}</span><span style={{ color: "var(--color-text-secondary)" }}>{fmtMoney(s.amount, true)}/mo</span></span>} />
        ))}
        {allSubs.length > 0 && <div style={{ fontSize: 11.5, color: "var(--color-text-secondary)", marginTop: 8 }}>Tick each one you've confirmed you still want. Cancel the rest in Finance → Subscriptions.</div>}
      </div>

      {/* Checklists */}
      {sections.map(sec => (
        <div key={sec.id} style={card}>
          {sectionTitle(sec.icon, sec.title, <span style={{ fontSize: 12.5, color: "var(--color-text-secondary)" }}>{sec.items.filter(i => checks[i.id]).length}/{sec.items.length}</span>)}
          {sec.items.map(it => (
            <CheckRow key={it.id} checked={!!checks[it.id]} label={it.label} accentColor={ac} onToggle={() => toggle(it.id)} onDelete={it.id.startsWith("cust_") ? () => delCustom(sec.id, it.id) : null} />
          ))}
          <AddItemRow accentColor={ac} onAdd={label => addCustom(sec.id, label)} />
        </div>
      ))}
    </div>
  );
}

// ── People / Personas: helpers ───────────────────────────────────────────────

// Next upcoming occurrence (YYYY-MM-DD) of a yearly date, given "YYYY-MM-DD" or "MM-DD".
function nextOccurrence(dateStr) {
  if (!dateStr) return null;
  const mmdd = dateStr.length >= 10 ? dateStr.slice(5) : dateStr;
  const [mm, dd] = mmdd.split("-").map(Number);
  if (!mm || !dd) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  let occ = new Date(today.getFullYear(), mm - 1, dd);
  if (occ < today) occ = new Date(today.getFullYear() + 1, mm - 1, dd);
  return occ.getFullYear() + "-" + String(mm).padStart(2, "0") + "-" + String(dd).padStart(2, "0");
}
function dateMinusDays(dateStr, days) {
  const d = new Date(dateStr + "T00:00:00"); d.setDate(d.getDate() - (days || 0));
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}
// Important dates can repeat every N months (1/2/3/4/6/12). Default 12 = yearly.
function dateOccursOn(item, ds) {
  if (!item || !item.date || !ds) return false;
  const rep = Number(item.repeatMonths) || 12;
  const [by, bm, bd] = item.date.split("-").map(Number);
  const [ty, tm, td] = ds.split("-").map(Number);
  if (bd !== td) return false;
  if (rep >= 12) return bm === tm;
  const diff = (ty - by) * 12 + (tm - bm);
  return diff >= 0 && diff % rep === 0;
}
function dateOccursInMonth(item, mk) {
  if (!item || !item.date || !mk) return false;
  const rep = Number(item.repeatMonths) || 12;
  const [by, bm] = item.date.split("-").map(Number);
  const [ty, tm] = mk.split("-").map(Number);
  if (rep >= 12) return bm === tm;
  const diff = (ty - by) * 12 + (tm - bm);
  return diff >= 0 && diff % rep === 0;
}
function repeatLabel(rep) { rep = Number(rep) || 12; return rep >= 12 ? "yearly" : rep === 1 ? "monthly" : `every ${rep} months`; }
const REPEAT_MONTH_OPTS = [[1, "Monthly"], [2, "Every 2 months"], [3, "Every 3 months"], [4, "Every 4 months"], [6, "Every 6 months"], [12, "Yearly"]];
function personKeyDates(person) {
  const out = [];
  if (person.birthday) out.push({ label: "Birthday", icon: "🎂", date: nextOccurrence(person.birthday) });
  if (person.anniversary) out.push({ label: "Anniversary", icon: "💍", date: nextOccurrence(person.anniversary) });
  (person.otherDates || []).forEach(o => { if (o.date) out.push({ label: o.label || "Date", icon: "📅", date: nextOccurrence(o.date) }); });
  return out.filter(d => d.date).sort((a, b) => a.date.localeCompare(b.date));
}
function nextKeyDate(person) {
  const ks = personKeyDates(person);
  if (!ks.length) return null;
  return { ...ks[0], days: daysUntil(ks[0].date) };
}
function shopSearchUrl(q) { return "https://www.amazon.co.uk/s?k=" + encodeURIComponent(q || ""); }

// When a person has "auto-setup" on, generate their Important Date + birthday
// and reminder tasks. Deterministic ids (keyed by person.id) so re-saving
// replaces rather than duplicates. personId links items back for cleanup.
function buildPersonAuto(person) {
  const out = { tasks: [], importantDate: null };
  if (!person.autoBirthday || !person.birthday) return out;
  const occ = nextOccurrence(person.birthday);
  const name = person.name || "them";
  out.importantDate = { id: "ip_" + person.id, personId: person.id, auto: true, title: `${name}'s Birthday`, type: "birthday", date: person.birthday, notes: "", tags: [], tasks: [], cost: "", costCategory: "" };
  const base = { priority: "medium", groupId: "", notes: "", tags: [], subtasks: [], someday: false, duration: "", cost: "", costCategory: "", done: false };
  out.tasks.push({ ...base, id: "tb_" + person.id, personId: person.id, auto: "birthday", title: `🎂 Wish ${name} a happy birthday`, deadline: occ, scheduledDate: occ, repeat: "yearly" });
  // Present + lead reminders are optional — some people you just wish, no gift.
  if (person.autoPresent !== false) {
    const leads = (person.reminderLeads && person.reminderLeads.length) ? person.reminderLeads.slice() : [person.reminderLeadDays || 14];
    const maxLead = Math.max(...leads);
    out.tasks.push({ ...base, id: "tp_" + person.id, personId: person.id, auto: "birthday", title: `🎁 Get ${name} a present`, deadline: occ, scheduledDate: dateMinusDays(occ, maxLead), repeat: "none", cost: person.typicalBudget || "", costCategory: "g_gifts" });
    leads.forEach(L => out.tasks.push({ ...base, id: `tr_${person.id}_${L}`, personId: person.id, auto: "reminder", title: `🔔 ${name}'s birthday in ${L} days`, priority: "low", deadline: dateMinusDays(occ, L), scheduledDate: dateMinusDays(occ, L), repeat: "none" }));
    if (person.reminderDate) out.tasks.push({ ...base, id: `trc_${person.id}`, personId: person.id, auto: "reminder", title: `🔔 Reminder: ${name}'s birthday`, priority: "low", deadline: person.reminderDate, scheduledDate: person.reminderDate, repeat: "none" });
  }
  return out;
}

// Offline gift-idea generator (used when the Claude API key isn't set). Wishlist first.
function localGiftIdeas(person, budget) {
  const b = Number(budget) || Number(person.typicalBudget) || 30;
  const ideas = [];
  (person.wishlist || []).forEach(w => {
    const text = typeof w === "string" ? w : w.text;
    if (text) ideas.push({ title: text, description: "On their wishlist — they've mentioned wanting this.", price: (w && Number(w.price)) || b, search_query: text });
  });
  const split = s => String(s || "").split(/[,\n]/).map(x => x.trim()).filter(Boolean);
  split(person.hobbies).slice(0, 4).forEach(h => ideas.push({ title: `${h} gift`, description: `Tied to their interest in ${h}.`, price: b, search_query: `${h} gift` }));
  split(person.brands).slice(0, 2).forEach(br => ideas.push({ title: `${br} treat`, description: "A brand they love.", price: b, search_query: br }));
  split(person.experiences).slice(0, 2).forEach(ex => ideas.push({ title: ex, description: "An experience they'd enjoy.", price: b, search_query: `${ex} experience gift` }));
  if (!ideas.length) ideas.push({ title: "Gift card", description: "A safe choice when you're unsure.", price: b, search_query: "gift card" });
  return ideas.slice(0, 8);
}
// Try Claude (/api/gifts) for tailored ideas; fall back to the offline generator.
async function fetchGiftIdeas(person, occasion, budget) {
  try {
    const res = await fetch("/api/gifts", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ person, occasion, budget }) });
    const data = await res.json();
    if (data && data.ai && data.result && Array.isArray(data.result.ideas) && data.result.ideas.length) return { ideas: data.result.ideas, ai: true };
  } catch (e) { /* offline */ }
  return { ideas: localGiftIdeas(person, budget), ai: false };
}

// ── People: Person profile modal ─────────────────────────────────────────────

function PersonModal({ person, accentColor, onSave, onClose }) {
  const blank = { name: "", relationship: "Friend", birthday: "", anniversary: "", otherDates: [], location: "", timezone: "", hobbies: "", brands: "", foods: "", experiences: "", wishlist: [], dislikes: "", typicalBudget: "", reminderLeadDays: 14, reminderLeads: [], reminderDate: "", autoBirthday: false, giftHistory: [] };
  const [p, setP] = useState(() => { const base = { ...blank, ...(person || {}) }; if ((!base.reminderLeads || !base.reminderLeads.length) && base.reminderLeadDays) base.reminderLeads = [base.reminderLeadDays]; return base; });
  const up = (k, v) => setP(x => ({ ...x, [k]: v }));
  const [wl, setWl] = useState(""); const [wlPrice, setWlPrice] = useState("");
  const [odLabel, setOdLabel] = useState(""); const [odDate, setOdDate] = useState("");
  const ac = accentColor;
  const addWish = () => { if (!wl.trim()) return; up("wishlist", [...(p.wishlist || []), { id: genId(), text: wl.trim(), price: parseFloat(wlPrice) || 0 }]); setWl(""); setWlPrice(""); };
  const addOther = () => { if (!odLabel.trim() || !odDate) return; up("otherDates", [...(p.otherDates || []), { label: odLabel.trim(), date: odDate }]); setOdLabel(""); setOdDate(""); };
  const setHistRating = (id, rating) => up("giftHistory", (p.giftHistory || []).map(h => h.id === id ? { ...h, rating: h.rating === rating ? "" : rating } : h));

  return (
    <Modal onClose={onClose} width={560}>
      <ModalHeader title={person?.id ? "Edit person" : "New person"} onClose={onClose} />
      <Field label="Name">
        <input placeholder="e.g. Mum" value={p.name} onChange={e => up("name", e.target.value)} style={{ width: "100%", boxSizing: "border-box", fontSize: 15 }} autoFocus />
      </Field>
      <Field label="Relationship">
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {RELATIONSHIPS.map(r => (
            <button key={r} onClick={() => up("relationship", r)} style={{ padding: "6px 13px", borderRadius: 20, border: `1.5px solid ${p.relationship === r ? ac : "var(--color-border-tertiary)"}`, background: p.relationship === r ? hex2rgba(ac, 0.1) : "transparent", color: p.relationship === r ? ac : "var(--color-text-secondary)", fontSize: 12, fontWeight: p.relationship === r ? 500 : 400, cursor: "pointer" }}>{r}</button>
          ))}
        </div>
      </Field>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
        <Field label="Birthday"><input type="date" value={p.birthday || ""} onChange={e => up("birthday", e.target.value)} style={{ width: "100%", boxSizing: "border-box" }} /></Field>
        <Field label="Anniversary"><input type="date" value={p.anniversary || ""} onChange={e => up("anniversary", e.target.value)} style={{ width: "100%", boxSizing: "border-box" }} /></Field>
        <Field label="Location"><input placeholder="City / country" value={p.location} onChange={e => up("location", e.target.value)} style={{ width: "100%", boxSizing: "border-box" }} /></Field>
        <Field label="Timezone"><input placeholder="e.g. GMT" value={p.timezone} onChange={e => up("timezone", e.target.value)} style={{ width: "100%", boxSizing: "border-box" }} /></Field>
      </div>
      <Field label="Other key dates">
        {(p.otherDates || []).map((o, i) => (
          <div key={i} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6, fontSize: 13 }}>
            <span style={{ flex: 1 }}>📅 {o.label} — {fmtShort(o.date)}</span>
            <button onClick={() => up("otherDates", p.otherDates.filter((_, j) => j !== i))} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-text-secondary)", fontSize: 16 }}>×</button>
          </div>
        ))}
        <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
          <input placeholder="Label (e.g. Graduation)" value={odLabel} onChange={e => setOdLabel(e.target.value)} style={{ flex: 1, fontSize: 13 }} />
          <input type="date" value={odDate} onChange={e => setOdDate(e.target.value)} style={{ fontSize: 13 }} />
          <button onClick={addOther} style={{ padding: "0 12px" }}>+</button>
        </div>
      </Field>
      <Divider />
      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 10 }}>Preferences</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
        <Field label="Hobbies & interests"><input placeholder="comma separated" value={p.hobbies} onChange={e => up("hobbies", e.target.value)} style={{ width: "100%", boxSizing: "border-box" }} /></Field>
        <Field label="Favourite brands"><input placeholder="comma separated" value={p.brands} onChange={e => up("brands", e.target.value)} style={{ width: "100%", boxSizing: "border-box" }} /></Field>
        <Field label="Favourite foods"><input placeholder="comma separated" value={p.foods} onChange={e => up("foods", e.target.value)} style={{ width: "100%", boxSizing: "border-box" }} /></Field>
        <Field label="Experiences they'd love"><input placeholder="comma separated" value={p.experiences} onChange={e => up("experiences", e.target.value)} style={{ width: "100%", boxSizing: "border-box" }} /></Field>
      </div>
      <Field label="Wishlist — things they've mentioned wanting">
        {(p.wishlist || []).map((w, i) => (
          <div key={w.id || i} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6, padding: "6px 10px", background: "var(--color-background-secondary)", borderRadius: 8, fontSize: 13 }}>
            <span style={{ flex: 1 }}>⭐ {w.text}</span>
            {w.price > 0 && <span style={{ color: "var(--color-text-secondary)" }}>{fmtMoney(w.price, true)}</span>}
            <button onClick={() => up("wishlist", p.wishlist.filter((_, j) => j !== i))} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-text-secondary)", fontSize: 16 }}>×</button>
          </div>
        ))}
        <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
          <input placeholder="Add a wishlist item…" value={wl} onChange={e => setWl(e.target.value)} onKeyDown={e => e.key === "Enter" && addWish()} style={{ flex: 1, fontSize: 13 }} />
          <input type="number" placeholder="£" value={wlPrice} onChange={e => setWlPrice(e.target.value)} style={{ width: 70, fontSize: 13 }} />
          <button onClick={addWish} style={{ padding: "0 12px" }}>+</button>
        </div>
      </Field>
      <Field label="Dislikes / allergies"><textarea placeholder="Things to avoid…" value={p.dislikes} onChange={e => up("dislikes", e.target.value)} rows={2} style={{ width: "100%", boxSizing: "border-box", resize: "vertical" }} /></Field>
      <Field label="Typical budget (£)"><input type="number" step="0.01" placeholder="e.g. 40" value={p.typicalBudget} onChange={e => up("typicalBudget", e.target.value)} style={{ width: "100%", boxSizing: "border-box" }} /></Field>
      <Field label="Remind me before their key dates">
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {[7, 14, 30, 60, 90].map(n => {
            const on = (p.reminderLeads || []).includes(n);
            return <button key={n} onClick={() => up("reminderLeads", on ? (p.reminderLeads || []).filter(x => x !== n) : [...(p.reminderLeads || []), n].sort((a, b) => a - b))} style={{ padding: "6px 13px", borderRadius: 20, border: `1.5px solid ${on ? ac : "var(--color-border-tertiary)"}`, background: on ? hex2rgba(ac, 0.1) : "transparent", color: on ? ac : "var(--color-text-secondary)", fontSize: 12, fontWeight: on ? 500 : 400, cursor: "pointer" }}>{n} days</button>;
          })}
        </div>
      </Field>
      <Field label="…or remind me on a specific date">
        <input type="date" value={p.reminderDate || ""} onChange={e => up("reminderDate", e.target.value)} style={{ width: "100%", boxSizing: "border-box" }} />
      </Field>
      <label style={{ display: "flex", alignItems: "flex-start", gap: 9, fontSize: 13, cursor: "pointer", padding: "11px 13px", background: hex2rgba(ac, 0.06), borderRadius: 10, marginBottom: 4 }}>
        <input type="checkbox" checked={!!p.autoBirthday} onChange={e => up("autoBirthday", e.target.checked)} style={{ marginTop: 2 }} />
        <span>🎂 <b>Set up their birthday automatically</b> — adds it to Important Dates and a “wish happy birthday” task on the calendar.{!p.birthday && <span style={{ color: "#BA7517" }}> Add a birthday above to enable.</span>}</span>
      </label>
      {p.autoBirthday && (
        <label style={{ display: "flex", alignItems: "flex-start", gap: 9, fontSize: 13, cursor: "pointer", padding: "10px 13px", marginBottom: 4 }}>
          <input type="checkbox" checked={p.autoPresent !== false} onChange={e => up("autoPresent", e.target.checked)} style={{ marginTop: 2 }} />
          <span>🎁 Also get them a present — adds a “get a present” task and your chosen reminders. <span style={{ color: "var(--color-text-secondary)" }}>Untick to just wish them happy birthday.</span></span>
        </label>
      )}
      {(p.giftHistory || []).length > 0 && (
        <>
          <Divider />
          <Field label="Gift history">
            {(p.giftHistory || []).map(h => (
              <div key={h.id} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6, fontSize: 13 }}>
                <span style={{ flex: 1 }}>🎁 {h.item}{h.occasion ? ` · ${h.occasion}` : ""}{h.cost ? ` · ${fmtMoney(h.cost, true)}` : ""}</span>
                <button onClick={() => setHistRating(h.id, "landed")} title="Landed well" style={{ background: h.rating === "landed" ? hex2rgba("#639922", 0.15) : "transparent", border: "none", cursor: "pointer", fontSize: 14, borderRadius: 6, padding: "2px 5px" }}>👍</button>
                <button onClick={() => setHistRating(h.id, "flat")} title="Fell flat" style={{ background: h.rating === "flat" ? hex2rgba("#E24B4A", 0.15) : "transparent", border: "none", cursor: "pointer", fontSize: 14, borderRadius: 6, padding: "2px 5px" }}>👎</button>
                <button onClick={() => up("giftHistory", p.giftHistory.filter(x => x.id !== h.id))} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-text-secondary)", fontSize: 16 }}>×</button>
              </div>
            ))}
          </Field>
        </>
      )}
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 18 }}>
        <button onClick={onClose} style={{ padding: "9px 16px", fontSize: 13, borderRadius: 9 }}>Cancel</button>
        <button onClick={() => { if (p.name.trim()) onSave({ ...p, typicalBudget: parseFloat(p.typicalBudget) || 0, reminderLeads: p.reminderLeads || [], reminderLeadDays: (p.reminderLeads && p.reminderLeads.length) ? Math.max(...p.reminderLeads) : (p.reminderLeadDays || 14) }); }} style={{ padding: "9px 20px", fontSize: 13, background: ac, color: "#fff", border: "none", borderRadius: 9, cursor: "pointer", fontWeight: 500 }}>{person?.id ? "Save" : "Add person"}</button>
      </div>
    </Modal>
  );
}

// ── People: AI gift-ideas modal ──────────────────────────────────────────────

function GiftIdeasModal({ person, occasion, accentColor, onChoose, onClose }) {
  const ac = accentColor;
  const [budget, setBudget] = useState(person.typicalBudget || 30);
  const [ideas, setIdeas] = useState(null);
  const [loading, setLoading] = useState(true);
  const [ai, setAi] = useState(false);
  const [chosen, setChosen] = useState({});
  const load = async () => { setLoading(true); const r = await fetchGiftIdeas(person, occasion ? occasion.label : "gift", budget); setIdeas(r.ideas); setAi(r.ai); setLoading(false); };
  useEffect(() => { load(); }, []);
  return (
    <Modal onClose={onClose} width={520}>
      <ModalHeader title={`🎁 Gift ideas for ${person.name}`} onClose={onClose} />
      <div style={{ fontSize: 13, color: "var(--color-text-secondary)", marginBottom: 12 }}>
        {occasion ? `${occasion.icon} ${occasion.label} · ${fmtDate(occasion.date)} (${occasion.days} days away)` : "Pick something thoughtful"}
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 14 }}>
        <span style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>Budget £</span>
        <input type="number" value={budget} onChange={e => setBudget(parseFloat(e.target.value) || 0)} style={{ width: 90 }} />
        <button onClick={load} style={{ padding: "7px 14px", fontSize: 13, borderRadius: 9, cursor: "pointer" }}>↻ Refresh ideas</button>
      </div>
      {loading && <div style={{ textAlign: "center", padding: 30, color: "var(--color-text-secondary)", fontSize: 14 }}>✨ Finding ideas…</div>}
      {!loading && ideas && ideas.map((idea, i) => (
        <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "12px 14px", background: "var(--color-background-secondary)", borderRadius: 10, marginBottom: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 500 }}>{idea.title}</div>
            <div style={{ fontSize: 12, color: "var(--color-text-secondary)", margin: "2px 0 6px" }}>{idea.description}</div>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: ac }}>{fmtMoney(idea.price)}</span>
              <a href={shopSearchUrl(idea.search_query || idea.title)} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: ac }}>View options ↗</a>
            </div>
          </div>
          {chosen[i] ? (
            <span style={{ fontSize: 12, color: "#639922", fontWeight: 500, whiteSpace: "nowrap", padding: "8px 0" }}>✓ Added</span>
          ) : (
            <button onClick={() => { onChoose(idea); setChosen(c => ({ ...c, [i]: true })); }} style={{ fontSize: 12, padding: "7px 13px", background: ac, color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 500, whiteSpace: "nowrap" }}>Choose this</button>
          )}
        </div>
      ))}
      {!loading && (
        <div style={{ fontSize: 11, color: "var(--color-text-secondary)", marginTop: 8, lineHeight: 1.5 }}>
          {ai ? "✨ Tailored by Claude from their profile." : "Generated from their profile (offline). Add an Anthropic API key for smarter, tailored ideas."} Choosing adds a to-do (with the cost on your Gifts budget) and puts it on your calendar.
        </div>
      )}
    </Modal>
  );
}

// ── People: the view ─────────────────────────────────────────────────────────

function PeopleView({ state, up, accentColor, onAddTask }) {
  const ac = accentColor;
  const people = state.people || [];
  const [personModal, setPersonModal] = useState(null);
  const [giftModal, setGiftModal] = useState(null);

  function savePerson(pp) {
    const id = pp.id || genId();
    const withId = { ...pp, id };
    const newPeople = people.some(x => x.id === id) ? people.map(x => x.id === id ? withId : x) : [...people, withId];
    // Regenerate this person's auto birthday/reminder items (replacing any prior ones).
    const { tasks: autoTasks, importantDate } = buildPersonAuto(withId);
    const baseTasks = (state.tasks || []).filter(t => t.personId !== id);
    const baseDates = (state.importantDates || []).filter(d => d.personId !== id);
    up({
      people: newPeople,
      tasks: [...baseTasks, ...autoTasks],
      importantDates: importantDate ? [...baseDates, importantDate] : baseDates,
    });
    setPersonModal(null);
  }
  function deletePerson(id) {
    if (!confirm("Delete this person? Their auto birthday tasks & date will be removed too.")) return;
    up({ people: people.filter(p => p.id !== id), tasks: (state.tasks || []).filter(t => t.personId !== id), importantDates: (state.importantDates || []).filter(d => d.personId !== id) });
  }

  function chooseGift(person, idea, occasion) {
    const giftsCat = (state.financeCategories || []).find(c => c.id === "g_gifts") || (state.financeCategories || []).find(c => /gift/i.test(c.name));
    const occDate = (occasion && occasion.date) || nextOccurrence(person.birthday) || todayStr();
    const lead = person.reminderLeadDays || 14;
    const price = Number(idea.price) || Number(person.typicalBudget) || 0;
    const task = {
      id: genId(), title: `Buy ${idea.title} for ${person.name}`,
      notes: idea.search_query ? shopSearchUrl(idea.search_query) : "",
      priority: "medium", groupId: "", deadline: occDate, scheduledDate: dateMinusDays(occDate, lead),
      tags: [], subtasks: [], someday: false, repeat: "none", duration: "",
      cost: price, costCategory: giftsCat ? giftsCat.id : "", done: false
    };
    onAddTask(task);
    up({ people: people.map(p => p.id === person.id ? { ...p, giftHistory: [...(p.giftHistory || []), { id: genId(), item: idea.title, occasion: occasion ? occasion.label : "", date: occDate, cost: price, rating: "", taskId: task.id }] } : p) });
  }

  const reminders = people.map(p => ({ p, k: nextKeyDate(p) })).filter(x => x.k && x.k.days != null && x.k.days >= 0 && x.k.days <= (x.p.reminderLeadDays || 14)).sort((a, b) => a.k.days - b.k.days);

  return (
    <div style={{ maxWidth: 760 }}>
      {personModal !== null && <PersonModal person={personModal === "new" ? null : personModal} accentColor={ac} onSave={savePerson} onClose={() => setPersonModal(null)} />}
      {giftModal && <GiftIdeasModal person={giftModal.person} occasion={giftModal.occasion} accentColor={ac} onChoose={idea => chooseGift(giftModal.person, idea, giftModal.occasion)} onClose={() => setGiftModal(null)} />}

      <SectionHead sub="Important people — profiles power AI gift ideas, aligned to your dates & budget.">🎁 People</SectionHead>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 14 }}>
        <button onClick={() => setPersonModal("new")} style={{ fontSize: 13, padding: "7px 16px", background: ac, color: "#fff", border: "none", borderRadius: 9, cursor: "pointer", fontWeight: 500 }}>+ New person</button>
      </div>

      {reminders.length > 0 && (
        <div style={{ background: hex2rgba(ac, 0.07), borderRadius: 12, padding: 14, border: `1px solid ${hex2rgba(ac, 0.2)}`, marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>🎁 Coming up</div>
          {reminders.map(({ p, k }) => (
            <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", fontSize: 13 }}>
              <span style={{ flex: 1 }}>{k.icon} <b>{p.name}</b>'s {k.label.toLowerCase()} in <b>{k.days}</b> day{k.days !== 1 ? "s" : ""} · {fmtShort(k.date)}</span>
              <button onClick={() => setGiftModal({ person: p, occasion: k })} style={{ fontSize: 12, padding: "5px 12px", background: ac, color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 500 }}>See gift ideas</button>
            </div>
          ))}
        </div>
      )}

      {people.length === 0 && (
        <div style={{ textAlign: "center", padding: 56, color: "var(--color-text-secondary)" }}>
          <div style={{ fontSize: 38, marginBottom: 12 }}>🎁</div>
          <div style={{ fontSize: 15, marginBottom: 6 }}>No people yet</div>
          <div style={{ fontSize: 13, marginBottom: 18 }}>Add someone important to get AI gift ideas around their key dates.</div>
          <button onClick={() => setPersonModal("new")} style={{ fontSize: 13, padding: "8px 18px", background: ac, color: "#fff", border: "none", borderRadius: 9, cursor: "pointer" }}>+ Add your first person</button>
        </div>
      )}

      {RELATIONSHIPS.map(rel => {
        const inRel = pp => { const r = pp.relationship || "Other"; return rel === "Other" ? (r === "Other" || !RELATIONSHIPS.includes(r)) : r === rel; };
        const group = people.filter(inRel);
        if (group.length === 0) return null; // no line for empty sections
        const label = rel === "Friend" ? "Friends" : rel === "Colleague" ? "Colleagues" : rel;
        return (
          <div key={rel} style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: "0.04em", paddingBottom: 8, borderBottom: "0.5px solid var(--color-border-tertiary)", marginBottom: 14 }}>{label} <span style={{ fontWeight: 400, textTransform: "none" }}>· {group.length}</span></div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(230px,1fr))", gap: 12 }}>
              {group.map(p => {
                const k = nextKeyDate(p);
                return (
                  <div key={p.id} style={{ background: "var(--color-background-primary)", borderRadius: 13, border: "0.5px solid var(--color-border-tertiary)", padding: 16 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 10 }}>
                      <div style={{ width: 40, height: 40, borderRadius: "50%", background: hex2rgba(ac, 0.14), color: ac, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, fontWeight: 600, flexShrink: 0 }}>{(p.name || "?").slice(0, 1).toUpperCase()}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 15, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</div>
                        <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>{p.relationship}{p.typicalBudget ? ` · ~${fmtMoney(p.typicalBudget, true)}` : ""}{p.autoBirthday ? " · 🎂 auto" : ""}</div>
                      </div>
                    </div>
                    {k ? (
                      <div style={{ fontSize: 12, color: k.days <= (p.reminderLeadDays || 14) ? ac : "var(--color-text-secondary)", marginBottom: 12, fontWeight: k.days <= (p.reminderLeadDays || 14) ? 500 : 400 }}>{k.icon} {k.label} in {k.days} day{k.days !== 1 ? "s" : ""} · {fmtShort(k.date)}</div>
                    ) : <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginBottom: 12 }}>No key dates set</div>}
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => setGiftModal({ person: p, occasion: k })} style={{ flex: 1, fontSize: 12, padding: "7px 0", background: ac, color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 500 }}>🎁 Gift ideas</button>
                      <button onClick={() => setPersonModal(p)} style={{ fontSize: 13, padding: "7px 10px", borderRadius: 8, cursor: "pointer" }}>✏️</button>
                      <button onClick={() => deletePerson(p.id)} style={{ fontSize: 13, padding: "7px 10px", borderRadius: 8, cursor: "pointer" }}>🗑</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Task insights (now a tab inside the Tasks hub).
function TasksInsights({ state, allTasks, overdueTasks, accentColor, onGoFinance }) {
  const ac = accentColor;
  const total = allTasks.length;
  const done = allTasks.filter(t => t.done).length;
  const pct = total ? Math.round(done / total * 100) : 0;
  return (
    <div style={{ maxWidth: 600 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 10, marginBottom: 16 }}>
        {[["Total", total, ac], ["Done", done, "#639922"], ["Pending", total - done, "#EF9F27"], ["Overdue", overdueTasks.length, "#E24B4A"]].map(([l, v, c]) => (
          <div key={l} style={{ background: "var(--color-background-primary)", borderRadius: 12, padding: "16px 14px", border: "0.5px solid var(--color-border-tertiary)", textAlign: "center" }}>
            <div style={{ fontSize: 26, fontWeight: 500, color: c }}>{v}</div>
            <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 3 }}>{l}</div>
          </div>
        ))}
      </div>
      <div style={{ background: "var(--color-background-primary)", borderRadius: 12, padding: 18, border: "0.5px solid var(--color-border-tertiary)", marginBottom: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 10 }}>Overall progress</div>
        <div style={{ height: 14, background: "var(--color-background-secondary)", borderRadius: 7, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${pct}%`, background: ac, borderRadius: 7, transition: "width 0.5s" }} />
        </div>
        <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 6 }}>{pct}% complete · {done} of {total} tasks done</div>
      </div>
      <div style={{ background: "var(--color-background-primary)", borderRadius: 12, padding: 18, border: "0.5px solid var(--color-border-tertiary)", marginBottom: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 12 }}>By priority</div>
        {Object.keys(PRIORITY).map(p => {
          const cnt = allTasks.filter(t => t.priority === p).length;
          const dc = allTasks.filter(t => t.priority === p && t.done).length;
          return (
            <div key={p} style={{ marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13, marginBottom: 4 }}><PriBadge p={p} /><span style={{ color: "var(--color-text-secondary)" }}>{dc}/{cnt}</span></div>
              <div style={{ height: 7, background: "var(--color-background-secondary)", borderRadius: 4 }}>
                <div style={{ height: "100%", width: `${cnt ? Math.round(dc / cnt * 100) : 0}%`, background: PRIORITY[p].color, borderRadius: 4 }} />
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ background: "var(--color-background-primary)", borderRadius: 12, padding: 18, border: "0.5px solid var(--color-border-tertiary)", marginBottom: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 10 }}>By group</div>
        {state.groups.map(g => {
          const cnt = allTasks.filter(t => t.groupId === g.id).length;
          const dc = allTasks.filter(t => t.groupId === g.id && t.done).length;
          if (!cnt) return null;
          return (
            <div key={g.id} style={{ marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}><span>{g.emoji} {g.name}</span><span style={{ color: "var(--color-text-secondary)" }}>{dc}/{cnt}</span></div>
              <div style={{ height: 7, background: "var(--color-background-secondary)", borderRadius: 4 }}>
                <div style={{ height: "100%", width: `${Math.round(dc / cnt * 100)}%`, background: g.color || ac, borderRadius: 4 }} />
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>💷 Money insights live with the charts — find them under <button onClick={onGoFinance} style={{ background: "none", border: "none", padding: 0, color: ac, cursor: "pointer", font: "inherit", textDecoration: "underline" }}>Finance → Trends</button>.</div>
    </div>
  );
}

// Offline "Ask Claude" assistant: handles add-task, plan-my-day, finance and
// upcoming intents from the user's own data. Upgrades to the real Claude API
// once a backend AI endpoint is wired (Phase B).
function runAssistant(state, prompt) {
  const raw = (prompt || "").trim();
  const p = raw.toLowerCase();
  if (!raw) return { reply: "Ask me to plan your day, summarise your money, or add a task." };
  const today = todayStr();
  const tasks = (state.tasks || []).filter(t => !t.done);
  const addMatch = raw.match(/^(?:add|create|new|remind me to)\s+(?:a\s+)?(?:task\s+)?(.+)/i);
  if (addMatch) return { addText: addMatch[1] };
  if (/\b(focus|today|priorit|what.*(do|tackle)|plan my day|to ?do)\b/.test(p)) {
    const todays = tasks.filter(t => t.scheduledDate === today || t.deadline === today);
    const overdue = tasks.filter(t => t.deadline && t.deadline < today);
    const highs = tasks.filter(t => t.priority === "high");
    const seen = new Set(); const list = [...overdue, ...todays, ...highs].filter(t => !seen.has(t.id) && seen.add(t.id)).slice(0, 6)
      .map(t => ({ id: t.id, title: t.title, tag: overdue.includes(t) ? "overdue" : todays.includes(t) ? "today" : "high" }));
    return { reply: list.length ? `Here's what I'd tackle first${overdue.length ? ` — ${overdue.length} overdue to clear` : ""}:` : "You're all clear — nothing urgent right now. 🎉", list };
  }
  if (/\b(financ|money|spend|budget|saving|save|debt|net worth|bank|afford)\b/.test(p)) {
    const cur = (state.currentAccounts || []).reduce((s, a) => s + (Number(a.balance) || 0), 0);
    const sav = (state.savingsAccounts || []).reduce((s, a) => s + (Number(a.balance) || 0), 0);
    const debt = (state.debts || []).reduce((s, d) => s + (Number(d.balance) || 0), 0);
    const nw = cur + sav + investmentTotals(state.investments).value + pensionPotsTotal(state) - debt;
    const st = monthStats(state, curMonthKey());
    const safe = (st.income || st.incomeProjected) - st.plannedTotal - (Number(state.safetyBuffer) || 0);
    return { reply: `In the bank ${fmtMoney(cur, true)} · savings ${fmtMoney(sav, true)} · debt ${fmtMoney(debt, true)}. Net worth ≈ ${fmtMoney(nw, true)}. Safe to spend this month: ${fmtMoney(safe)}.` };
  }
  if (/\b(upcoming|coming up|this week|week|event|birthday|due|deadline)\b/.test(p)) {
    const list = tasks.filter(t => { const d = t.deadline || t.scheduledDate; return d && d >= today && daysUntil(d) <= 7; })
      .sort((a, b) => (a.deadline || a.scheduledDate).localeCompare(b.deadline || b.scheduledDate)).slice(0, 6)
      .map(t => ({ id: t.id, title: t.title, tag: fmtShort(t.deadline || t.scheduledDate) }));
    return { reply: list.length ? "Coming up in the next 7 days:" : "Nothing scheduled in the next week.", list };
  }
  return { reply: "I can plan your day, summarise your finances, or add tasks. Try “what should I focus on today?”, “how are my finances?”, or “add buy milk tomorrow”. Full conversational Claude arrives with the API key (Phase B)." };
}

function HomeView({ state, accentColor, setView, onAddTask, allTasks, overdueTasks, userName }) {
  const ac = accentColor;
  const today = todayStr();
  const [q, setQ] = useState("");
  const [resp, setResp] = useState(null);
  // Live clock for the long date + 24-hour time line. Ticks each minute.
  const [now, setNow] = useState(new Date());
  useEffect(() => { const id = setInterval(() => setNow(new Date()), 30000); return () => clearInterval(id); }, []);
  const ask = () => {
    if (!q.trim()) return;
    const r = runAssistant(state, q);
    if (r.addText) {
      const ctx = { tags: state.tags, groups: state.groups };
      const task = buildTask(localParse(r.addText, ctx), ctx, {});
      onAddTask(task);
      setResp({ reply: `Added “${task.title}”${task.deadline ? ` · ⚑ ${fmtShort(task.deadline)}` : ""} ✓`, list: [] });
    } else setResp(r);
    setQ("");
  };
  const open = allTasks.filter(t => !t.done);
  const todays = open.filter(t => t.scheduledDate === today || t.deadline === today);
  const upcoming = open.filter(t => { const d = t.deadline || t.scheduledDate; return d && d > today && daysUntil(d) <= 14; })
    .sort((a, b) => (a.deadline || a.scheduledDate).localeCompare(b.deadline || b.scheduledDate)).slice(0, 5);
  const dates = (state.importantDates || []).map(d => ({ d, days: d.date ? daysUntil(`${new Date().getFullYear()}-${d.date.slice(5)}`) : null }))
    .filter(x => x.days != null && x.days >= 0 && x.days <= 30).sort((a, b) => a.days - b.days).slice(0, 4);
  const cur = (state.currentAccounts || []).reduce((s, a) => s + (Number(a.balance) || 0), 0);
  const sav = (state.savingsAccounts || []).reduce((s, a) => s + (Number(a.balance) || 0), 0);
  const debt = (state.debts || []).reduce((s, d) => s + (Number(d.balance) || 0), 0);
  const nw = cur + sav + investmentTotals(state.investments).value + pensionPotsTotal(state) - debt;
  const st = monthStats(state, curMonthKey());
  const safe = (st.income || st.incomeProjected) - st.plannedTotal - (Number(state.safetyBuffer) || 0);
  // Cash-flow snippet — are we on track this month? (reuses the live clock `now`)
  const dim = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate(); const dom = now.getDate(); const daysLeft = Math.max(0, dim - dom);
  const cfIncome = st.income || st.incomeProjected; const spentSoFar = st.spend;
  const dailyRate = (spentSoFar > 0 && dom >= 3) ? spentSoFar / dom : (st.plannedTotal / dim);
  const cfProjEnd = cfIncome - (spentSoFar + dailyRate * daysLeft);
  const hasFinance = cfIncome > 0 || st.plannedTotal > 0 || cur > 0;
  const firstName = (userName || "").trim().split(/\s+/)[0] || "";
  const greeting = (() => { const h = now.getHours(); const g = h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening"; return firstName ? `${g}, ${firstName}` : g; })();
  const card = { background: "var(--color-background-primary)", borderRadius: 14, padding: 18, border: "0.5px solid var(--color-border-tertiary)", marginBottom: 14 };
  const Snap = ({ label, value, color, onClick }) => (
    <div onClick={onClick} style={{ background: "var(--color-background-secondary)", borderRadius: 10, padding: "10px 12px", cursor: onClick ? "pointer" : "default" }}>
      <div style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: color || "var(--color-text-primary)" }}>{value}</div>
    </div>
  );
  return (
    <div style={{ maxWidth: 760 }}>
      <h1 style={{ fontSize: 22, fontWeight: 600, margin: "0 0 4px" }}>{greeting} 👋</h1>
      <p style={{ fontSize: 13, color: "var(--color-text-secondary)", margin: "0 0 18px" }}>{fmtLongDate(now)} · <span style={{ fontVariantNumeric: "tabular-nums" }}>{fmtTime24(now)}</span>{overdueTasks.length > 0 ? ` · ⚠ ${overdueTasks.length} overdue` : ""}</p>

      {/* Ask Claude */}
      <div style={{ ...card, background: hex2rgba(ac, 0.06), borderColor: hex2rgba(ac, 0.25) }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 2 }}>✨ Ask Claude</div>
        <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginBottom: 10 }}>Plan your day, sort your tasks, check your money — or just say “add …”.</div>
        <div style={{ display: "flex", gap: 8 }}>
          <input value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === "Enter" && ask()} placeholder="e.g. what should I focus on today?" style={{ flex: 1, fontSize: 14, boxSizing: "border-box" }} />
          <button onClick={ask} style={{ padding: "0 18px", background: ac, color: "#fff", border: "none", borderRadius: 9, cursor: "pointer", fontWeight: 500 }}>Ask</button>
        </div>
        {!resp && <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>{["What should I focus on today?", "How are my finances?", "What's coming up?"].map(s => <button key={s} onClick={() => { setQ(s); setTimeout(() => { setResp(runAssistant(state, s)); setQ(""); }, 0); }} style={{ fontSize: 12, padding: "5px 11px", borderRadius: 20, cursor: "pointer", color: ac }}>{s}</button>)}</div>}
        {resp && (
          <div style={{ marginTop: 12, background: "var(--color-background-primary)", borderRadius: 10, padding: "12px 14px" }}>
            <div style={{ fontSize: 13.5 }}>{resp.reply}</div>
            {resp.list && resp.list.map(it => (
              <div key={it.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, marginTop: 7 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: ac, flexShrink: 0 }} />
                <span style={{ flex: 1 }}>{it.title}</span>
                <span style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>{it.tag}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Finance snapshot */}
      <div style={card}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>💷 Your money</div>
          <button onClick={() => setView("finance")} style={{ fontSize: 12, padding: "4px 10px", borderRadius: 8, cursor: "pointer", color: ac }}>Open Finance →</button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(110px,1fr))", gap: 8 }}>
          <Snap label="In the bank" value={fmtMoney(cur, true)} color={ac} />
          <Snap label="Savings" value={fmtMoney(sav, true)} color="#1D9E75" />
          <Snap label="Debt" value={fmtMoney(debt, true)} color={debt > 0 ? "#E24B4A" : undefined} />
          <Snap label="Net worth" value={fmtMoney(nw, true)} color={nw >= 0 ? "#1D9E75" : "#E24B4A"} />
          <Snap label="Safe to spend" value={fmtMoney(safe, true)} color={safe >= 0 ? "#639922" : "#E24B4A"} />
        </div>
        {hasFinance && (
          <div style={{ marginTop: 10, background: hex2rgba(cfProjEnd >= 0 ? "#1D9E75" : "#E24B4A", 0.08), borderRadius: 10, padding: "10px 12px", fontSize: 12.5 }}>
            🔮 <b>Cash flow:</b> on this month's pace you'll finish with about <b style={{ color: cfProjEnd >= 0 ? "#1D9E75" : "#E24B4A" }}>{fmtMoney(cfProjEnd, true)}</b>{daysLeft > 0 ? ` (${daysLeft} day${daysLeft !== 1 ? "s" : ""} left, ~${fmtMoney(dailyRate * 7, true)}/wk)` : ""}. {cfProjEnd >= 0 ? "On track 🎉" : "Heading over — ease off."}
          </div>
        )}
      </div>

      {/* Today + upcoming */}
      <div style={card}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 10 }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>☀️ Today &amp; upcoming</div>
          <button onClick={() => setView("today")} style={{ fontSize: 12, padding: "4px 10px", borderRadius: 8, cursor: "pointer", color: ac }}>Open Tasks →</button>
        </div>
        {todays.length === 0 && upcoming.length === 0 && <div style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>Nothing scheduled — you're all clear ✨</div>}
        {todays.map(t => <div key={t.id} style={{ display: "flex", gap: 8, fontSize: 13.5, padding: "5px 0" }}><span>○</span><span style={{ flex: 1 }}>{t.title}</span><span style={{ fontSize: 11, color: ac }}>today</span></div>)}
        {upcoming.map(t => <div key={t.id} style={{ display: "flex", gap: 8, fontSize: 13.5, padding: "5px 0", color: "var(--color-text-secondary)" }}><span>○</span><span style={{ flex: 1 }}>{t.title}</span><span style={{ fontSize: 11 }}>{fmtShort(t.deadline || t.scheduledDate)}</span></div>)}
      </div>

      {/* Important dates */}
      {dates.length > 0 && (
        <div style={card}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 10 }}>
            <div style={{ fontSize: 14, fontWeight: 600 }}>🎂 Important dates</div>
            <button onClick={() => setView("important-dates")} style={{ fontSize: 12, padding: "4px 10px", borderRadius: 8, cursor: "pointer", color: ac }}>Open →</button>
          </div>
          {dates.map(({ d, days }) => <div key={d.id} style={{ display: "flex", gap: 8, fontSize: 13.5, padding: "5px 0" }}><span style={{ flex: 1 }}>{(DATE_TYPES.find(t => t.v === d.type) || {}).icon || "📅"} {d.title}</span><span style={{ fontSize: 11.5, color: days <= 7 ? ac : "var(--color-text-secondary)", fontWeight: days <= 7 ? 500 : 400 }}>{days === 0 ? "today" : `in ${days} day${days !== 1 ? "s" : ""}`}</span></div>)}
        </div>
      )}
    </div>
  );
}

// ── Documents & Policies ─────────────────────────────────────────────────────

const WARRANTY_CATEGORIES = ["Electronics", "Appliance", "Vehicle", "Furniture", "Tools", "Jewellery", "Other"];
const WARRANTY_ICON = { Electronics: "📱", Appliance: "🧺", Vehicle: "🚗", Furniture: "🛋", Tools: "🔧", Jewellery: "💍", Other: "🧾" };
function warrantyExpiry(w) { if (!w || !w.purchaseDate || !w.coverMonths) return ""; const d = new Date(w.purchaseDate + "T00:00:00"); d.setMonth(d.getMonth() + Number(w.coverMonths)); return ymdLocal(d); }

function WarrantyModal({ warranty, accentColor, onSave, onClose }) {
  const blank = { item: "", category: "Electronics", provider: "", purchaseDate: "", coverMonths: 12, cost: "", reference: "", notes: "", remind: true };
  const [w, setW] = useState({ ...blank, ...(warranty || {}) });
  const up = (k, v) => setW(x => ({ ...x, [k]: v }));
  const ac = accentColor; const inp = { width: "100%", boxSizing: "border-box" };
  const expiry = warrantyExpiry(w);
  return (
    <Modal onClose={onClose} width={500}>
      <ModalHeader title={warranty?.id ? "Edit warranty" : "New warranty"} onClose={onClose} />
      <Field label="Item"><input placeholder="e.g. Samsung TV, Bosch dishwasher" value={w.item} onChange={e => up("item", e.target.value)} style={inp} autoFocus /></Field>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="Category"><select value={w.category} onChange={e => up("category", e.target.value)} style={inp}>{WARRANTY_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}</select></Field>
        <Field label="Retailer / brand"><input placeholder="e.g. Currys, John Lewis" value={w.provider} onChange={e => up("provider", e.target.value)} style={inp} /></Field>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
        <Field label="Bought on"><input type="date" value={w.purchaseDate} onChange={e => up("purchaseDate", e.target.value)} style={inp} /></Field>
        <Field label="Cover (months)"><input type="number" min="0" placeholder="12" value={w.coverMonths} onChange={e => up("coverMonths", e.target.value)} style={inp} /></Field>
        <Field label="Cost (£)"><input type="number" step="0.01" placeholder="0.00" value={w.cost} onChange={e => up("cost", e.target.value)} style={inp} /></Field>
      </div>
      <Field label="Reference / serial (optional)"><input placeholder="Order or serial number" value={w.reference} onChange={e => up("reference", e.target.value)} style={inp} /></Field>
      <Field label="Notes"><textarea placeholder="Where the receipt is, what's covered…" value={w.notes} onChange={e => up("notes", e.target.value)} rows={2} style={{ ...inp, resize: "vertical" }} /></Field>
      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--color-text-secondary)", cursor: "pointer", marginTop: 4 }}>
        <input type="checkbox" checked={w.remind !== false} onChange={e => up("remind", e.target.checked)} /> 🔔 Add a task two weeks before cover ends
      </label>
      {expiry && <div style={{ fontSize: 12.5, color: "var(--color-text-secondary)", marginTop: 8 }}>Cover ends <b>{fmtDate(expiry)}</b> ({daysUntil(expiry) >= 0 ? `in ${daysUntil(expiry)} days` : "expired"}).</div>}
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 18 }}>
        <button onClick={onClose} style={{ padding: "9px 16px", fontSize: 13, borderRadius: 9 }}>Cancel</button>
        <button onClick={() => { if (w.item.trim()) onSave({ id: warranty?.id || genId(), item: w.item.trim(), category: w.category, provider: (w.provider || "").trim(), purchaseDate: w.purchaseDate, coverMonths: Number(w.coverMonths) || 0, cost: parseFloat(w.cost) || 0, reference: (w.reference || "").trim(), notes: (w.notes || "").trim(), remind: w.remind !== false }); }} style={{ padding: "9px 20px", fontSize: 13, background: ac, color: "#fff", border: "none", borderRadius: 9, cursor: "pointer", fontWeight: 500 }}>{warranty?.id ? "Save" : "Add"}</button>
      </div>
    </Modal>
  );
}

const RISK_CATEGORIES = ["Financial", "Health", "Home & property", "Career / income", "Family", "Legal", "Digital / cyber", "Other"];
const RISK_STATUS = [["open", "Open"], ["monitoring", "Monitoring"], ["mitigated", "Mitigated"], ["closed", "Closed"]];
function riskScore(r) { return (Number(r.likelihood) || 0) * (Number(r.impact) || 0); }
function riskLevel(score) { return score >= 15 ? { label: "Critical", color: "#E24B4A" } : score >= 8 ? { label: "High", color: "#D85A30" } : score >= 4 ? { label: "Medium", color: "#BA7517" } : { label: "Low", color: "#1D9E75" }; }
const LIKELIHOOD_LABELS = ["", "Rare", "Unlikely", "Possible", "Likely", "Almost certain"];
const IMPACT_LABELS = ["", "Negligible", "Minor", "Moderate", "Major", "Severe"];

function RiskModal({ risk, accentColor, onSave, onClose }) {
  const blank = { title: "", category: "Financial", likelihood: 3, impact: 3, description: "", mitigation: "", crisisPlan: "", owner: "", status: "open" };
  const [r, setR] = useState({ ...blank, ...(risk || {}) });
  const up = (k, v) => setR(x => ({ ...x, [k]: v }));
  const ac = accentColor; const inp = { width: "100%", boxSizing: "border-box" };
  const lvl = riskLevel(riskScore(r));
  return (
    <Modal onClose={onClose} width={560}>
      <ModalHeader title={risk?.id ? "Edit risk" : "New risk"} onClose={onClose} />
      <Field label="Risk"><input placeholder="e.g. Loss of main income" value={r.title} onChange={e => up("title", e.target.value)} style={inp} autoFocus /></Field>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="Category"><select value={r.category} onChange={e => up("category", e.target.value)} style={inp}>{RISK_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}</select></Field>
        <Field label="Status"><select value={r.status} onChange={e => up("status", e.target.value)} style={inp}>{RISK_STATUS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="Likelihood"><select value={r.likelihood} onChange={e => up("likelihood", Number(e.target.value))} style={inp}>{[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n} · {LIKELIHOOD_LABELS[n]}</option>)}</select></Field>
        <Field label="Impact"><select value={r.impact} onChange={e => up("impact", Number(e.target.value))} style={inp}>{[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n} · {IMPACT_LABELS[n]}</option>)}</select></Field>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, margin: "2px 0 4px" }}>
        <span style={{ color: "var(--color-text-secondary)" }}>Risk rating</span>
        <span style={{ background: hex2rgba(lvl.color, 0.15), color: lvl.color, fontWeight: 600, padding: "3px 10px", borderRadius: 20 }}>{lvl.label} · {riskScore(r)}</span>
      </div>
      <Field label="Description — what could happen?"><textarea placeholder="Describe the risk and its triggers" value={r.description} onChange={e => up("description", e.target.value)} rows={2} style={{ ...inp, resize: "vertical" }} /></Field>
      <Field label="Mitigation — how do you reduce it?"><textarea placeholder="Steps to lower the likelihood or impact (e.g. emergency fund, insurance)" value={r.mitigation} onChange={e => up("mitigation", e.target.value)} rows={2} style={{ ...inp, resize: "vertical" }} /></Field>
      <Field label="🚨 Crisis management plan — what to do if it happens"><textarea placeholder="Step-by-step response if this risk kicks off: who to call, what to access, first actions" value={r.crisisPlan} onChange={e => up("crisisPlan", e.target.value)} rows={3} style={{ ...inp, resize: "vertical" }} /></Field>
      <Field label="Owner (optional)"><input placeholder="Who's responsible" value={r.owner} onChange={e => up("owner", e.target.value)} style={inp} /></Field>
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 18 }}>
        <button onClick={onClose} style={{ padding: "9px 16px", fontSize: 13, borderRadius: 9 }}>Cancel</button>
        <button onClick={() => { if (r.title.trim()) onSave({ ...r, id: risk?.id || genId(), title: r.title.trim() }); }} style={{ padding: "9px 20px", fontSize: 13, background: ac, color: "#fff", border: "none", borderRadius: 9, cursor: "pointer", fontWeight: 500 }}>{risk?.id ? "Save" : "Add"}</button>
      </div>
    </Modal>
  );
}

const DOC_TABS = [["insurance", "🛡 Insurance"], ["warranties", "🧾 Warranties"], ["risk", "⚠️ Risk register"], ["audit", "🔐 Digital Life Audit"]];

function DocsView({ state, up, accentColor, goFinance }) {
  const ac = accentColor;
  const [tab, setTab] = useState("insurance");
  const cats = state.financeCategories || [];
  const catById = id => cats.find(c => c.id === id);

  // ── Insurance (moved here from Finance, behaviour unchanged) ──
  const [insModal, setInsModal] = useState(null);
  const insurance = state.insurance || [];
  function saveInsurance(p) {
    const exists = insurance.some(x => x.id === p.id);
    const newInsurance = exists ? insurance.map(x => x.id === p.id ? p : x) : [...insurance, p];
    let tasks = (state.tasks || []).filter(t => t.insuranceId !== p.id);
    if (p.renewTask !== false && p.renewalDate) {
      const note = [p.provider && `Provider: ${p.provider}`, p.policyNumber && `Policy: ${p.policyNumber}`, `Premium: ${fmtMoney(insAnnual(p), true)}/yr`, p.contactPhone && `Tel: ${p.contactPhone}`].filter(Boolean).join(" · ");
      tasks = [{ id: "ins_" + p.id, insuranceId: p.id, title: `🔔 Renew ${p.type} insurance${p.provider ? " (" + p.provider + ")" : ""}`, priority: "medium", groupId: "", deadline: p.renewalDate, scheduledDate: p.renewalDate, notes: note, tags: [], subtasks: [], someday: false, repeat: "yearly", duration: "", cost: "", costCategory: "", done: false }, ...tasks];
    }
    up({ insurance: newInsurance, tasks });
    setInsModal(null);
  }
  function deleteInsurance(id) { if (confirm("Delete this policy?")) up({ insurance: insurance.filter(p => p.id !== id), tasks: (state.tasks || []).filter(t => t.insuranceId !== id) }); }
  function addRenewalTask(p) {
    if (!p.renewalDate) { alert("Add a renewal date to this policy first."); return; }
    const note = [p.provider && `Provider: ${p.provider}`, p.policyNumber && `Policy: ${p.policyNumber}`, `Premium: ${fmtMoney(insAnnual(p), true)}/yr`, p.contactPhone && `Tel: ${p.contactPhone}`].filter(Boolean).join(" · ");
    const task = { id: genId(), title: `Review ${p.type} insurance${p.provider ? " (" + p.provider + ")" : ""}`, priority: "medium", groupId: "", deadline: p.renewalDate, scheduledDate: "", notes: note, tags: [], subtasks: [], someday: false, repeat: "none", duration: "", cost: "", costCategory: "", done: false };
    up({ tasks: [task, ...(state.tasks || [])] });
    alert("Added a renewal reminder to your task list.");
  }

  // ── Warranties ──
  const [warModal, setWarModal] = useState(null);
  const warranties = state.warranties || [];
  function saveWarranty(w) {
    const exists = warranties.some(x => x.id === w.id);
    const list = exists ? warranties.map(x => x.id === w.id ? w : x) : [...warranties, w];
    const expiry = warrantyExpiry(w);
    let tasks = (state.tasks || []).filter(t => t.warrantyId !== w.id);
    if (w.remind !== false && expiry) {
      const remindDate = addDaysStr(expiry, -14);
      const note = [w.provider && `Retailer: ${w.provider}`, w.reference && `Ref: ${w.reference}`, `Cover ends ${fmtDate(expiry)}`, w.notes].filter(Boolean).join(" · ");
      tasks = [{ id: "war_" + w.id, warrantyId: w.id, title: `🧾 ${w.item} warranty ending soon`, priority: "medium", groupId: "", deadline: remindDate, scheduledDate: remindDate, notes: note, tags: [], subtasks: [], someday: false, repeat: "none", duration: "", cost: "", costCategory: "", done: false }, ...tasks];
    }
    up({ warranties: list, tasks });
    setWarModal(null);
  }
  function deleteWarranty(id) { if (confirm("Delete this warranty?")) up({ warranties: warranties.filter(w => w.id !== id), tasks: (state.tasks || []).filter(t => t.warrantyId !== id) }); }

  // ── Risk register ──
  const [riskModal, setRiskModal] = useState(null);
  const [riskDetail, setRiskDetail] = useState(null);
  const risks = state.risks || [];
  function saveRisk(r) { up({ risks: risks.some(x => x.id === r.id) ? risks.map(x => x.id === r.id ? r : x) : [...risks, r] }); setRiskModal(null); }
  function deleteRisk(id) { if (confirm("Delete this risk?")) { up({ risks: risks.filter(r => r.id !== id) }); setRiskDetail(null); } }

  const card = { background: "var(--color-background-primary)", borderRadius: 14, padding: 18, border: "0.5px solid var(--color-border-tertiary)", marginBottom: 14 };

  return (
    <div style={{ maxWidth: 760 }}>
      {insModal !== null && <InsuranceModal policy={insModal === "new" ? null : insModal} cats={cats} accentColor={ac} onSave={saveInsurance} onClose={() => setInsModal(null)} />}
      {warModal !== null && <WarrantyModal warranty={warModal === "new" ? null : warModal} accentColor={ac} onSave={saveWarranty} onClose={() => setWarModal(null)} />}
      {riskModal !== null && <RiskModal risk={riskModal === "new" ? null : riskModal} accentColor={ac} onSave={saveRisk} onClose={() => setRiskModal(null)} />}

      <h1 style={{ fontSize: 22, fontWeight: 600, margin: "0 0 4px" }}>🗂 Documents &amp; Policies</h1>
      <p style={{ fontSize: 13, color: "var(--color-text-secondary)", margin: "0 0 18px" }}>A central place to store and manage the essentials — policies, warranties, risks and your digital life audit.</p>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 18 }}>
        {DOC_TABS.map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} style={{ fontSize: 13, padding: "7px 13px", borderRadius: 9, cursor: "pointer", border: "none", background: tab === id ? ac : "var(--color-background-secondary)", color: tab === id ? "#fff" : "var(--color-text-secondary)", fontWeight: tab === id ? 500 : 400 }}>{label}</button>
        ))}
      </div>

      {/* ── Insurance ── */}
      {tab === "insurance" && (() => {
        const totalMonthly = insurance.reduce((s, p) => s + insMonthly(p), 0);
        const sorted = insurance.filter(p => p.renewalDate).sort((a, b) => a.renewalDate.localeCompare(b.renewalDate));
        const next = sorted.find(p => (daysUntil(p.renewalDate) ?? -1) >= 0) || sorted[0];
        return (
          <div>
            <SectionHead sub="All your policies in one place. Premiums feed your monthly budget (annual spread over 12); renewals can drop straight onto your to-do list.">🛡 Insurance policies</SectionHead>
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 14 }}>
              <button onClick={() => setInsModal("new")} style={{ fontSize: 13, padding: "7px 16px", background: ac, color: "#fff", border: "none", borderRadius: 9, cursor: "pointer", fontWeight: 500 }}>+ Policy</button>
            </div>
            {insurance.length === 0 && (
              <div style={{ textAlign: "center", padding: 50, color: "var(--color-text-secondary)" }}>
                <div style={{ fontSize: 38, marginBottom: 12 }}>🛡</div>
                <div style={{ fontSize: 15, marginBottom: 6 }}>No policies yet</div>
                <div style={{ fontSize: 13, marginBottom: 18 }}>Add car, home, phone, travel or any other insurance to track renewals, costs and cover.</div>
                <button onClick={() => setInsModal("new")} style={{ fontSize: 13, padding: "8px 18px", background: ac, color: "#fff", border: "none", borderRadius: 9, cursor: "pointer" }}>+ Add a policy</button>
              </div>
            )}
            {insurance.length > 0 && (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10, marginBottom: 14 }}>
                  <StatCard label="Total / month" value={fmtMoney(totalMonthly)} color={ac} />
                  <StatCard label="Total / year" value={fmtMoney(totalMonthly * 12)} />
                  <StatCard label="Policies" value={String(insurance.length)} />
                  {next && <StatCard label="Next renewal" value={insIcon(next.type) + " " + fmtShort(next.renewalDate)} sub={(() => { const d = daysUntil(next.renewalDate); return d == null ? null : d < 0 ? "overdue" : d === 0 ? "today" : `in ${d} day${d !== 1 ? "s" : ""}`; })()} />}
                </div>
                {insurance.map(p => {
                  const d = p.renewalDate ? daysUntil(p.renewalDate) : null;
                  const due = d != null && d <= 30;
                  const cat = catById(p.budgetCategory);
                  const info = [p.policyNumber && `#${p.policyNumber}`, (Number(p.excess) > 0) && `£${p.excess} excess`, p.coverAmount && `cover ${p.coverAmount}`, p.contactPhone && `☎ ${p.contactPhone}`, p.autoRenew && "auto-renews"].filter(Boolean).join("  ·  ");
                  return (
                    <div key={p.id} style={{ background: "var(--color-background-primary)", borderRadius: 12, padding: 16, border: "0.5px solid var(--color-border-tertiary)", marginBottom: 10 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{ fontSize: 24, width: 30, textAlign: "center" }}>{insIcon(p.type)}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: 15 }}>{p.type}{p.provider ? <span style={{ fontWeight: 400, color: "var(--color-text-secondary)" }}> · {p.provider}</span> : null}</div>
                          <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>{fmtMoney(insMonthly(p), true)}/mo · {fmtMoney(insAnnual(p), true)}/yr ({p.frequency === "annual" ? "paid yearly" : "paid monthly"})</div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          {p.renewalDate && <div style={{ fontSize: 13, fontWeight: 500, color: due ? "#BA7517" : "var(--color-text-primary)" }}>Renews {fmtShort(p.renewalDate)}</div>}
                          {d != null && <div style={{ fontSize: 11.5, color: due ? "#BA7517" : "var(--color-text-secondary)" }}>{d < 0 ? "overdue" : d === 0 ? "today" : `in ${d} day${d !== 1 ? "s" : ""}`}</div>}
                        </div>
                      </div>
                      {info && <div style={{ fontSize: 11.5, color: "var(--color-text-secondary)", marginTop: 8 }}>{info}</div>}
                      {p.notes && <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 6, fontStyle: "italic" }}>{p.notes}</div>}
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
                        {cat && <span style={{ fontSize: 10.5, background: hex2rgba(cat.color, 0.14), color: cat.color, padding: "2px 8px", borderRadius: 10 }}>{cat.emoji} {cat.name}</span>}
                        {!cat && <span style={{ fontSize: 10.5, color: "var(--color-text-secondary)" }}>not in budget</span>}
                        <div style={{ flex: 1 }} />
                        <button onClick={() => addRenewalTask(p)} title="Add a renewal reminder to your tasks" style={{ fontSize: 12, padding: "5px 10px", borderRadius: 8, cursor: "pointer", color: ac }}>🔔 Remind me</button>
                        <button onClick={() => setInsModal(p)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, padding: "4px 6px" }}>✏️</button>
                        <button onClick={() => deleteInsurance(p.id)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, padding: "4px 6px" }}>🗑</button>
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        );
      })()}

      {/* ── Warranties ── */}
      {tab === "warranties" && (() => {
        const list = [...warranties].sort((a, b) => (warrantyExpiry(a) || "9999").localeCompare(warrantyExpiry(b) || "9999"));
        const active = list.filter(w => { const e = warrantyExpiry(w); return e && daysUntil(e) >= 0; });
        const next = active[0];
        return (
          <div>
            <SectionHead sub="Track what you bought, how long cover lasts, and get a reminder before it runs out.">🧾 Warranty tracker</SectionHead>
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 14 }}>
              <button onClick={() => setWarModal("new")} style={{ fontSize: 13, padding: "7px 16px", background: ac, color: "#fff", border: "none", borderRadius: 9, cursor: "pointer", fontWeight: 500 }}>+ Warranty</button>
            </div>
            {list.length === 0 && (
              <div style={{ textAlign: "center", padding: 50, color: "var(--color-text-secondary)" }}>
                <div style={{ fontSize: 38, marginBottom: 12 }}>🧾</div>
                <div style={{ fontSize: 15, marginBottom: 6 }}>No warranties tracked yet</div>
                <div style={{ fontSize: 13, marginBottom: 18 }}>Add appliances, electronics or anything with cover — we'll remind you before it lapses.</div>
                <button onClick={() => setWarModal("new")} style={{ fontSize: 13, padding: "8px 18px", background: ac, color: "#fff", border: "none", borderRadius: 9, cursor: "pointer" }}>+ Add a warranty</button>
              </div>
            )}
            {list.length > 0 && (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10, marginBottom: 14 }}>
                  <StatCard label="Items tracked" value={String(list.length)} color={ac} />
                  <StatCard label="In cover" value={String(active.length)} color="#1D9E75" />
                  {next && <StatCard label="Next to expire" value={fmtShort(warrantyExpiry(next))} sub={next.item} />}
                </div>
                {list.map(w => {
                  const e = warrantyExpiry(w);
                  const d = e ? daysUntil(e) : null;
                  const expired = d != null && d < 0;
                  const soon = d != null && d >= 0 && d <= 30;
                  const col = expired ? "#E24B4A" : soon ? "#BA7517" : "#1D9E75";
                  return (
                    <div key={w.id} style={{ background: "var(--color-background-primary)", borderRadius: 12, padding: 16, border: "0.5px solid var(--color-border-tertiary)", marginBottom: 10 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{ fontSize: 24, width: 30, textAlign: "center" }}>{WARRANTY_ICON[w.category] || "🧾"}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: 15 }}>{w.item}{w.provider ? <span style={{ fontWeight: 400, color: "var(--color-text-secondary)" }}> · {w.provider}</span> : null}</div>
                          <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>{w.category}{w.purchaseDate ? ` · bought ${fmtShort(w.purchaseDate)}` : ""}{w.coverMonths ? ` · ${w.coverMonths}-month cover` : ""}{w.cost ? ` · ${fmtMoney(w.cost, true)}` : ""}</div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          {e && <div style={{ fontSize: 13, fontWeight: 500, color: col }}>{expired ? "Expired" : "Covered until"}</div>}
                          {e && <div style={{ fontSize: 11.5, color: col }}>{fmtShort(e)}{d != null && !expired ? ` · in ${d}d` : ""}</div>}
                        </div>
                      </div>
                      {(w.reference || w.notes) && <div style={{ fontSize: 11.5, color: "var(--color-text-secondary)", marginTop: 8 }}>{[w.reference && `Ref ${w.reference}`, w.notes].filter(Boolean).join("  ·  ")}</div>}
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
                        <div style={{ flex: 1 }} />
                        <button onClick={() => setWarModal(w)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, padding: "4px 6px" }}>✏️</button>
                        <button onClick={() => deleteWarranty(w.id)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, padding: "4px 6px" }}>🗑</button>
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        );
      })()}

      {/* ── Risk register ── */}
      {tab === "risk" && (() => {
        if (riskDetail) {
          const r = risks.find(x => x.id === riskDetail);
          if (!r) { setRiskDetail(null); return null; }
          const lvl = riskLevel(riskScore(r));
          const Block = ({ icon, title, body, empty }) => (
            <div style={{ ...card }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>{icon} {title}</div>
              <div style={{ fontSize: 13, color: body ? "var(--color-text-primary)" : "var(--color-text-secondary)", whiteSpace: "pre-wrap", lineHeight: 1.55 }}>{body || empty}</div>
            </div>
          );
          return (
            <div>
              <button onClick={() => setRiskDetail(null)} style={{ fontSize: 12.5, padding: "5px 12px", borderRadius: 8, cursor: "pointer", marginBottom: 14, color: ac }}>← Back to register</button>
              <div style={{ ...card, background: hex2rgba(lvl.color, 0.07), borderColor: hex2rgba(lvl.color, 0.3) }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ fontSize: 18, fontWeight: 700 }}>{r.title}</div>
                    <div style={{ fontSize: 12.5, color: "var(--color-text-secondary)", marginTop: 3 }}>{r.category} · {(RISK_STATUS.find(s => s[0] === r.status) || [, "Open"])[1]}{r.owner ? ` · owner ${r.owner}` : ""}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <span style={{ background: hex2rgba(lvl.color, 0.15), color: lvl.color, fontWeight: 700, padding: "4px 12px", borderRadius: 20, fontSize: 13 }}>{lvl.label} · {riskScore(r)}</span>
                    <div style={{ fontSize: 11.5, color: "var(--color-text-secondary)", marginTop: 4 }}>likelihood {r.likelihood} × impact {r.impact}</div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                  <button onClick={() => setRiskModal(r)} style={{ fontSize: 12.5, padding: "6px 14px", borderRadius: 8, cursor: "pointer" }}>✏️ Edit</button>
                  <button onClick={() => deleteRisk(r.id)} style={{ fontSize: 12.5, padding: "6px 14px", borderRadius: 8, cursor: "pointer", color: "#E24B4A" }}>🗑 Delete</button>
                </div>
              </div>
              <Block icon="📋" title="What could happen" body={r.description} empty="No description added yet." />
              <Block icon="🛡" title="Mitigation — reducing the risk" body={r.mitigation} empty="No mitigation plan yet." />
              <Block icon="🚨" title="Crisis management plan" body={r.crisisPlan} empty="No crisis plan yet — add the steps you'd take if this risk kicks off." />
            </div>
          );
        }
        const sorted = [...risks].sort((a, b) => riskScore(b) - riskScore(a));
        return (
          <div>
            <SectionHead sub="Log what could go wrong, rate it, and plan how you'd respond if it happens.">⚠️ Risk register</SectionHead>
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 14 }}>
              <button onClick={() => setRiskModal("new")} style={{ fontSize: 13, padding: "7px 16px", background: ac, color: "#fff", border: "none", borderRadius: 9, cursor: "pointer", fontWeight: 500 }}>+ Risk</button>
            </div>
            {risks.length === 0 && (
              <div style={{ textAlign: "center", padding: 50, color: "var(--color-text-secondary)" }}>
                <div style={{ fontSize: 38, marginBottom: 12 }}>⚠️</div>
                <div style={{ fontSize: 15, marginBottom: 6 }}>No risks logged yet</div>
                <div style={{ fontSize: 13, marginBottom: 18 }}>Think job loss, illness, a boiler failure — note it, rate it, and write a plan.</div>
                <button onClick={() => setRiskModal("new")} style={{ fontSize: 13, padding: "8px 18px", background: ac, color: "#fff", border: "none", borderRadius: 9, cursor: "pointer" }}>+ Add a risk</button>
              </div>
            )}
            {sorted.map(r => {
              const lvl = riskLevel(riskScore(r));
              return (
                <div key={r.id} onClick={() => setRiskDetail(r.id)} style={{ background: "var(--color-background-primary)", borderRadius: 12, padding: "13px 16px", border: "0.5px solid var(--color-border-tertiary)", marginBottom: 8, cursor: "pointer", display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 10, background: hex2rgba(lvl.color, 0.13), color: lvl.color, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <span style={{ fontSize: 16, fontWeight: 700, lineHeight: 1 }}>{riskScore(r)}</span>
                    <span style={{ fontSize: 8, textTransform: "uppercase", letterSpacing: "0.04em" }}>{lvl.label}</span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{r.title}</div>
                    <div style={{ fontSize: 11.5, color: "var(--color-text-secondary)", marginTop: 2 }}>{r.category} · L{r.likelihood}×I{r.impact} · {(RISK_STATUS.find(s => s[0] === r.status) || [, "Open"])[1]}{r.crisisPlan ? " · 🚨 plan ready" : ""}</div>
                  </div>
                  <span style={{ color: "var(--color-text-secondary)", fontSize: 16 }}>›</span>
                </div>
              );
            })}
          </div>
        );
      })()}

      {/* ── Digital Life Audit ── */}
      {tab === "audit" && <AuditView state={state} up={up} accentColor={ac} goFinance={goFinance} />}
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────

function App({ user }) {
  const [state, up, meta] = useAppState(user);
  const [view, setView] = useState("home");
  const [modal, setModal] = useState(null);
  const [groupModal, setGroupModal] = useState(null);
  const [dateModal, setDateModal] = useState(null);
  const [search, setSearch] = useState("");
  const [filterTag, setFilterTag] = useState("");
  const [filterPriority, setFilterPriority] = useState("");
  const [focusMode, setFocusMode] = useState(false);
  const [todayMode, setTodayMode] = useState("list"); // Today hub: "list" | "calendar"
  const [collapsed, setCollapsed] = useState(false);
  const [weeklyReview, setWeeklyReview] = useState(false);
  const [narrow, setNarrow] = useState(typeof window !== "undefined" && window.innerWidth < 760);
  const [drawerOpen, setDrawerOpen] = useState(false);
  useEffect(() => {
    const onR = () => setNarrow(window.innerWidth < 760);
    window.addEventListener("resize", onR);
    return () => window.removeEventListener("resize", onR);
  }, []);

  // Apply light/dark mode. "system" follows the OS (remove the override attr);
  // "light"/"dark" force it via [data-mode] on <html> (see index.html CSS).
  const mode = state.mode || "system";
  useEffect(() => {
    const root = document.documentElement;
    if (mode === "light" || mode === "dark") root.dataset.mode = mode;
    else delete root.dataset.mode;
    // Keep the iOS status-bar / PWA theme-color in step with the active scheme.
    const dark = mode === "dark" || (mode === "system" && window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches);
    const metaEl = document.querySelector('meta[name="theme-color"]');
    if (metaEl) metaEl.setAttribute("content", dark ? "#1c1c1e" : "#ffffff");
  }, [mode]);

  // Once loaded: snapshot each month's report (so history survives pruning), then
  // drop transactions older than 6 months (Tend keeps a 6-month rolling window).
  useEffect(() => {
    if (!meta.loaded) return;
    const txns = state.transactions || [];
    const reports = { ...(state.monthlyReports || {}) };
    const months = new Set(txns.map(t => (t.date || "").slice(0, 7)).filter(Boolean));
    months.add(curMonthKey());
    Object.keys(state.financePlans || {}).forEach(m => months.add(m));
    months.forEach(mk => { reports[mk] = computeMonthReport(state, mk); });
    const cutoff24 = monthsAgoKey(24);
    Object.keys(reports).forEach(mk => { if (mk < cutoff24) delete reports[mk]; });
    const sixAgo = addDaysStr(todayStr(), -183);
    const pruned = txns.filter(t => (t.date || "") >= sixAgo);
    if (pruned.length !== txns.length || JSON.stringify(reports) !== JSON.stringify(state.monthlyReports || {})) {
      up({ transactions: pruned, monthlyReports: reports });
    }
  }, [meta.loaded]);

  const ac = accent(state.theme);
  const today = todayStr();
  // Greeting name: an explicit Settings name wins, else the name from sign-up metadata.
  const displayName = ((state.name || "").trim()) || (user && user.user_metadata && (user.user_metadata.full_name || user.user_metadata.name)) || "";
  const sidebarCollapsed = narrow ? false : collapsed; // on phones the drawer always shows full labels

  // While the user's cloud data is loading for the first time, show a spinner
  // so we never flash empty lists or overwrite cloud data with defaults.
  if (!meta.loaded) {
    return <div className="boot-msg" style={{ paddingTop: 80 }}>Syncing your tasks…</div>;
  }

  function saveTask(task) {
    const exists = state.tasks.find(t => t.id === task.id);
    up({ tasks: exists ? state.tasks.map(t => t.id === task.id ? task : t) : [...state.tasks, task] });
    setModal(null);
  }

  function toggleTask(id) {
    up({ tasks: state.tasks.map(t => t.id !== id ? t : { ...t, done: !t.done, completedDate: !t.done ? today : null }) });
  }

  function deleteTask(id) { up({ tasks: state.tasks.filter(t => t.id !== id) }); }

  function toggleSubtask(taskId, subId) {
    up({ tasks: state.tasks.map(t => t.id !== taskId ? t : { ...t, subtasks: (t.subtasks || []).map(s => s.id === subId ? { ...s, done: !s.done } : s) }) });
  }

  function saveGroup(g) {
    const exists = state.groups.find(x => x.id === g.id);
    up({ groups: exists ? state.groups.map(x => x.id === g.id ? g : x) : [...state.groups, g] });
    setGroupModal(null);
  }

  function deleteGroup(id) { up({ groups: state.groups.filter(g => g.id !== id), tasks: state.tasks.map(t => t.groupId === id ? { ...t, groupId: "" } : t) }); }

  function saveDate(d) {
    const exists = state.importantDates.find(x => x.id === d.id);
    up({ importantDates: exists ? state.importantDates.map(x => x.id === d.id ? d : x) : [...state.importantDates, d] });
    setDateModal(null);
  }

  function deleteDate(id) { up({ importantDates: state.importantDates.filter(d => d.id !== id) }); }

  function filterTasks(tasks) {
    let f = tasks;
    if (search) f = f.filter(t => t.title.toLowerCase().includes(search.toLowerCase()) || t.notes?.toLowerCase().includes(search.toLowerCase()));
    if (filterTag) f = f.filter(t => t.tags?.includes(filterTag));
    if (filterPriority) f = f.filter(t => t.priority === filterPriority);
    return f;
  }

  const allTasks = state.tasks;
  // All these feed the Today hub's List mode as separate sections.
  const viewTasks = filterTasks(allTasks.filter(t => !t.done && (t.scheduledDate === today || t.deadline === today))); // Today Tasks
  // "Unsorted": ungrouped, not-someday, not-done tasks that no dated section surfaces — so nothing captured is ever lost.
  const unsortedTasks = filterTasks(allTasks.filter(t => !t.done && !t.someday && !t.groupId && t.scheduledDate !== today && t.deadline !== today && !(t.deadline && t.deadline > today)));
  // Upcoming (future-dated).
  const upcomingDate = t => t.scheduledDate && t.scheduledDate > today ? (t.deadline && t.deadline > today ? (t.scheduledDate < t.deadline ? t.scheduledDate : t.deadline) : t.scheduledDate) : (t.deadline && t.deadline > today ? t.deadline : null);
  const upcomingTasks = filterTasks(allTasks.filter(t => !t.done && !t.someday && upcomingDate(t))).sort((a, b) => upcomingDate(a).localeCompare(upcomingDate(b)));
  // Bucket upcoming tasks by horizon: this month, next month, 3 / 6 / 12 months, later.
  const lastDayOfMonthOffset = off => { const e = new Date(); const x = new Date(e.getFullYear(), e.getMonth() + off + 1, 0); return x.getFullYear() + "-" + String(x.getMonth() + 1).padStart(2, "0") + "-" + String(x.getDate()).padStart(2, "0"); };
  const monthsAheadStr = n => { const x = new Date(); x.setMonth(x.getMonth() + n); return x.getFullYear() + "-" + String(x.getMonth() + 1).padStart(2, "0") + "-" + String(x.getDate()).padStart(2, "0"); };
  const _eTM = lastDayOfMonthOffset(0), _eNM = lastDayOfMonthOffset(1), _p3 = monthsAheadStr(3), _p6 = monthsAheadStr(6), _p12 = monthsAheadStr(12);
  const bucketOf = d => d <= _eTM ? "thisMonth" : d <= _eNM ? "nextMonth" : d <= _p3 ? "m3" : d <= _p6 ? "m6" : d <= _p12 ? "y1" : "later";
  const upcomingBuckets = { thisMonth: [], nextMonth: [], m3: [], m6: [], y1: [], later: [] };
  upcomingTasks.forEach(t => { upcomingBuckets[bucketOf(upcomingDate(t))].push(t); });
  // Rainy day (someday).
  const somedayTasks = filterTasks(allTasks.filter(t => t.someday && !t.done));

  const done = allTasks.filter(t => t.done).length;
  const total = allTasks.length;
  const pct = total ? Math.round(done / total * 100) : 0;
  const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
  const weekDone = allTasks.filter(t => t.done && t.completedDate && new Date(t.completedDate) >= weekAgo).length;
  const weekMissed = allTasks.filter(t => !t.done && t.deadline && new Date(t.deadline + "T00:00:00") < new Date() && new Date(t.deadline + "T00:00:00") >= weekAgo).length;
  const overdueTasks = allTasks.filter(t => !t.done && t.deadline && t.deadline < today);

  const taskRowProps = { tags: state.tags, groups: state.groups, onToggle: toggleTask, onEdit: setModal, onDelete: deleteTask, onToggleSubtask: toggleSubtask };

  return (
    <div style={{ display: "flex", minHeight: "600px", fontFamily: "var(--font-sans)", background: "var(--color-background-tertiary)" }}>
      {modal && <TaskModal task={modal === "new" ? null : (typeof modal === "object" && modal.prefill) ? { deadline: modal.prefill } : modal} groups={state.groups} tags={state.tags} financeCats={state.financeCategories} accentColor={ac} onSave={saveTask} onClose={() => setModal(null)} />}
      {groupModal !== null && <GroupModal group={groupModal === "new" ? null : groupModal} accentColor={ac} onSave={saveGroup} onClose={() => setGroupModal(null)} />}
      {dateModal !== null && <DateModal item={dateModal === "new" ? null : dateModal} tags={state.tags} groups={state.groups} financeCats={state.financeCategories} accentColor={ac} onSave={saveDate} onClose={() => setDateModal(null)} />}

      {weeklyReview && (
        <Modal onClose={() => setWeeklyReview(false)} width={400}>
          <ModalHeader title="Weekly review" onClose={() => setWeeklyReview(false)} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 18 }}>
            {[["Completed", weekDone, "#639922"], ["Overdue", weekMissed, "#E24B4A"], ["Total", total, ac]].map(([l, v, c]) => (
              <div key={l} style={{ background: "var(--color-background-secondary)", borderRadius: 10, padding: "14px 10px", textAlign: "center" }}>
                <div style={{ fontSize: 26, fontWeight: 500, color: c }}>{v}</div>
                <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 2 }}>{l}</div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>Upcoming this week</div>
          {allTasks.filter(t => !t.done && t.deadline && daysUntil(t.deadline) >= 0 && daysUntil(t.deadline) <= 7).map(t => (
            <div key={t.id} style={{ fontSize: 13, padding: "7px 0", borderBottom: "0.5px solid var(--color-border-tertiary)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>{t.title}</span><span style={{ color: "var(--color-text-secondary)", fontSize: 12 }}>{fmtDate(t.deadline)}</span>
            </div>
          ))}
          {allTasks.filter(t => !t.done && t.deadline && daysUntil(t.deadline) >= 0 && daysUntil(t.deadline) <= 7).length === 0 && <div style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>Nothing due this week.</div>}
        </Modal>
      )}

      {/* Mobile drawer overlay */}
      {narrow && drawerOpen && <div onClick={() => setDrawerOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 1090 }} />}

      {/* Sidebar */}
      <div style={narrow
        ? { position: "fixed", top: 0, left: 0, bottom: 0, width: 230, background: "var(--color-background-primary)", borderRight: "0.5px solid var(--color-border-tertiary)", display: "flex", flexDirection: "column", zIndex: 1100, transform: drawerOpen ? "translateX(0)" : "translateX(-100%)", transition: "transform 0.22s", boxShadow: drawerOpen ? "2px 0 18px rgba(0,0,0,0.25)" : "none" }
        : { width: collapsed ? 56 : 210, background: "var(--color-background-primary)", borderRight: "0.5px solid var(--color-border-tertiary)", display: "flex", flexDirection: "column", flexShrink: 0, transition: "width 0.2s" }}>
        <div style={{ padding: sidebarCollapsed ? "14px 10px" : "16px 14px", display: "flex", alignItems: "center", justifyContent: sidebarCollapsed ? "center" : "space-between", borderBottom: "0.5px solid var(--color-border-tertiary)" }}>
          {!sidebarCollapsed && <span style={{ fontWeight: 600, fontSize: 16, color: ac, letterSpacing: "-0.01em" }}>Tend</span>}
          <button onClick={() => narrow ? setDrawerOpen(false) : setCollapsed(!collapsed)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 17, color: "var(--color-text-secondary)", padding: 2 }}>{narrow ? "✕" : "☰"}</button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "8px 6px" }}>
          {VIEWS.map(v => {
            const meta = VIEW_META[v];
            const isActive = view === v;
            return (
              <div key={v} onClick={() => { setView(v); if (narrow) setDrawerOpen(false); }} title={sidebarCollapsed ? meta.label : ""} style={{ display: "flex", alignItems: "center", gap: 9, padding: sidebarCollapsed ? "9px" : "9px 10px", cursor: "pointer", borderRadius: 9, margin: "1px 0", background: isActive ? hex2rgba(ac, 0.1) : "transparent", color: isActive ? ac : "var(--color-text-secondary)", fontWeight: isActive ? 500 : 400, fontSize: 13, justifyContent: sidebarCollapsed ? "center" : "flex-start", transition: "background 0.12s" }}>
                <span style={{ fontSize: 15, flexShrink: 0 }}>{meta.icon}</span>
                {!sidebarCollapsed && <span>{meta.label}</span>}
                {!sidebarCollapsed && v === "today" && allTasks.filter(t => !t.done && (t.scheduledDate === today || t.deadline === today)).length > 0 && (
                  <span style={{ marginLeft: "auto", background: ac, color: "#fff", borderRadius: 10, fontSize: 10, padding: "1px 6px", fontWeight: 500 }}>{allTasks.filter(t => !t.done && (t.scheduledDate === today || t.deadline === today)).length}</span>
                )}
              </div>
            );
          })}
        </div>
        {!sidebarCollapsed && (
          <div style={{ padding: "10px 12px 14px", borderTop: "0.5px solid var(--color-border-tertiary)" }}>
            <button onClick={() => setWeeklyReview(true)} style={{ width: "100%", fontSize: 12, padding: "7px 0", borderRadius: 8, cursor: "pointer", marginBottom: 5, color: "var(--color-text-secondary)" }}>📋 Weekly review</button>
          </div>
        )}
      </div>

      {/* Main content */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {/* Topbar */}
        <div style={{ padding: "12px 20px", background: "var(--color-background-primary)", borderBottom: "0.5px solid var(--color-border-tertiary)", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          {narrow && <button onClick={() => setDrawerOpen(true)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, padding: "0 4px", color: "var(--color-text-secondary)" }}>☰</button>}
          <h1 style={{ margin: 0, fontSize: 17, fontWeight: 500, flex: 1 }}>{VIEW_META[view].icon} {VIEW_META[view].label}</h1>
          {(() => {
            const isDark = mode === "dark" || (mode === "system" && typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches);
            return <button onClick={() => up({ mode: isDark ? "light" : "dark" })} title={isDark ? "Switch to light mode" : "Switch to dark mode"} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 17, padding: "2px 6px", color: "var(--color-text-secondary)" }}>{isDark ? "☀️" : "🌙"}</button>;
          })()}
          {overdueTasks.length > 0 && (
            <div style={{ fontSize: 12, background: "#FCEBEB", color: "#A32D2D", padding: "4px 10px", borderRadius: 20, fontWeight: 500 }}>⚠ {overdueTasks.length} overdue</div>
          )}
          {view === "today" && (
            <>
              <input placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} style={{ width: 150, fontSize: 13 }} />
              <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)} style={{ fontSize: 12, padding: "5px 8px" }}>
                <option value="">All priorities</option>
                {Object.keys(PRIORITY).map(p => <option key={p} value={p}>{PRIORITY[p].label}</option>)}
              </select>
              <select value={filterTag} onChange={e => setFilterTag(e.target.value)} style={{ fontSize: 12, padding: "5px 8px" }}>
                <option value="">All tags</option>
                {state.tags.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              {view === "today" && <button onClick={() => setFocusMode(!focusMode)} style={{ fontSize: 12, padding: "5px 12px", background: focusMode ? ac : "transparent", color: focusMode ? "#fff" : "var(--color-text-primary)", border: `1px solid ${ac}`, borderRadius: 7, cursor: "pointer" }}>🎯 Focus</button>}
            </>
          )}
          {!["home","insights","settings","calendar","finance","people","docs"].includes(view) && (
            <button onClick={() => setModal("new")} style={{ fontSize: 13, padding: "7px 16px", background: ac, color: "#fff", border: "none", borderRadius: 9, cursor: "pointer", fontWeight: 500 }}>+ New task</button>
          )}
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "22px 24px 44px" }}>

          {/* Central home dashboard */}
          {view === "home" && <HomeView state={state} accentColor={ac} setView={setView} onAddTask={saveTask} allTasks={allTasks} overdueTasks={overdueTasks} userName={displayName} />}

          {/* Today hub — List (Today + Unsorted + Upcoming) or Calendar */}
          {view === "today" && (
            <div>
              <SectionHead sub="Everything on your plate — schedule it, group it, or tick it off.">☀️ Your tasks</SectionHead>
              <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
                {[["list", "📋 List"], ["calendar", "🗓 Calendar"], ["groups", "📁 Groups"], ["done", "✓ Done"], ["insights", "📊 Insights"]].map(([m, l]) => (
                  <button key={m} onClick={() => setTodayMode(m)} style={{ fontSize: 13, padding: "7px 14px", borderRadius: 9, cursor: "pointer", border: "none", background: todayMode === m ? ac : "var(--color-background-secondary)", color: todayMode === m ? "#fff" : "var(--color-text-secondary)", fontWeight: todayMode === m ? 500 : 400 }}>{l}</button>
                ))}
              </div>

              {todayMode === "list" && (() => {
                const Section = ({ icon, label, hint, tasks }) => tasks.length === 0 ? null : (
                  <>
                    <Divider />
                    <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 8 }}>
                      <span style={{ fontSize: 12, color: "var(--color-text-secondary)", fontWeight: 600 }}>{icon} {label}</span>
                      {hint && <span style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>{hint}</span>}
                    </div>
                    {tasks.map(t => <TaskRow key={t.id} task={t} {...taskRowProps} />)}
                  </>
                );
                const allEmpty = viewTasks.length === 0 && upcomingTasks.length === 0 && unsortedTasks.length === 0 && somedayTasks.length === 0;
                return (
                  <div>
                    <QuickAdd ctx={{ tags: state.tags, groups: state.groups }} accentColor={ac} defaults={{ scheduledToday: true }} onAdd={saveTask} />
                    {focusMode && <div style={{ background: hex2rgba(ac, 0.08), borderRadius: 10, padding: "10px 14px", marginBottom: 14, fontSize: 13, color: ac, fontWeight: 500 }}>🎯 Focus mode — stay on today</div>}
                    {allEmpty && (
                      <div style={{ textAlign: "center", padding: 60, color: "var(--color-text-secondary)" }}>
                        <div style={{ fontSize: 36, marginBottom: 10 }}>☀️</div>
                        <div style={{ fontSize: 15, marginBottom: 14 }}>Nothing scheduled — you're all clear ✨</div>
                        <button onClick={() => setModal("new")} style={{ fontSize: 13, padding: "8px 20px", background: ac, color: "#fff", border: "none", borderRadius: 9, cursor: "pointer" }}>+ Add task</button>
                      </div>
                    )}
                    {/* Today Tasks */}
                    {viewTasks.length > 0 && <div style={{ fontSize: 12, color: "var(--color-text-secondary)", fontWeight: 600, marginBottom: 8 }}>☀️ Today Tasks</div>}
                    {!allEmpty && viewTasks.length === 0 && <div style={{ fontSize: 13, color: "var(--color-text-secondary)", marginBottom: 4 }}>Nothing scheduled for today.</div>}
                    {viewTasks.map(t => <TaskRow key={t.id} task={t} {...taskRowProps} />)}
                    {!focusMode && <Section icon="📆" label="This month" tasks={upcomingBuckets.thisMonth} />}
                    {!focusMode && <Section icon="📆" label="Next month" tasks={upcomingBuckets.nextMonth} />}
                    {!focusMode && <Section icon="🗓" label="Within 3 months" tasks={upcomingBuckets.m3} />}
                    {!focusMode && <Section icon="🗓" label="Within 6 months" tasks={upcomingBuckets.m6} />}
                    {!focusMode && <Section icon="🗓" label="Within a year" tasks={upcomingBuckets.y1} />}
                    {!focusMode && <Section icon="📌" label="Later" tasks={upcomingBuckets.later} />}
                    {!focusMode && <Section icon="📥" label="Unsorted" hint="no day set — schedule it or file into a group" tasks={unsortedTasks} />}
                    {!focusMode && <Section icon="🌂" label="Rainy Day" hint="for when you have free time" tasks={somedayTasks} />}
                    {allTasks.some(t => t.done) && <div style={{ fontSize: 11.5, color: "var(--color-text-secondary)", marginTop: 16, textAlign: "center" }}>Completed tasks now live in the <b>✓ Done</b> tab.</div>}
                  </div>
                );
              })()}

              {todayMode === "done" && (() => {
                const completed = filterTasks(allTasks.filter(t => t.done)).sort((a, b) => (b.completedDate || "").localeCompare(a.completedDate || ""));
                if (completed.length === 0) return (
                  <div style={{ textAlign: "center", padding: 60, color: "var(--color-text-secondary)" }}>
                    <div style={{ fontSize: 36, marginBottom: 10 }}>✓</div>
                    <div style={{ fontSize: 15 }}>Nothing completed yet — tick a task off and it lands here.</div>
                  </div>
                );
                // Group by completion day so the history reads like a timeline.
                const groupsByDay = {};
                completed.forEach(t => { const k = t.completedDate || "Earlier"; (groupsByDay[k] = groupsByDay[k] || []).push(t); });
                const dayKeys = Object.keys(groupsByDay).sort((a, b) => b.localeCompare(a));
                return (
                  <div>
                    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 12, gap: 10, flexWrap: "wrap" }}>
                      <div style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>Every task you've completed, newest first. Tap the circle to bring one back.</div>
                      <button onClick={() => { if (confirm(`Permanently delete all ${completed.length} completed task${completed.length !== 1 ? "s" : ""}?`)) up({ tasks: state.tasks.filter(t => !t.done) }); }} style={{ fontSize: 12.5, padding: "6px 12px", borderRadius: 8, cursor: "pointer", color: "#E24B4A" }}>🗑 Clear all</button>
                    </div>
                    {dayKeys.map(k => (
                      <div key={k}>
                        <div style={{ fontSize: 12, color: "var(--color-text-secondary)", fontWeight: 600, margin: "14px 0 8px" }}>{k === "Earlier" ? "Earlier" : fmtLongDate(k)}</div>
                        {groupsByDay[k].map(t => <TaskRow key={t.id} task={t} {...taskRowProps} />)}
                      </div>
                    ))}
                  </div>
                );
              })()}

              {todayMode === "calendar" && (
                <CalendarView tasks={allTasks} importantDates={state.importantDates} accentColor={ac} onAddTask={(date) => setModal({ prefill: date })} onEditDate={(d) => setDateModal(d)} />
              )}

              {todayMode === "groups" && (
            <div>
              <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 14 }}>
                <button onClick={() => setGroupModal("new")} style={{ fontSize: 13, padding: "7px 16px", background: ac, color: "#fff", border: "none", borderRadius: 9, cursor: "pointer" }}>+ New group</button>
              </div>
              {state.groups.map(g => {
                const gtasks = filterTasks(allTasks.filter(t => t.groupId === g.id));
                const gdone = gtasks.filter(t => t.done).length;
                return (
                  <div key={g.id} style={{ background: "var(--color-background-primary)", borderRadius: 13, border: `0.5px solid var(--color-border-tertiary)`, marginBottom: 14, overflow: "hidden" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "13px 16px", borderBottom: gtasks.length > 0 ? "0.5px solid var(--color-border-tertiary)" : "none", background: hex2rgba(g.color || ac, 0.05) }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontSize: 22 }}>{g.emoji}</span>
                        <div>
                          <div style={{ fontWeight: 500, fontSize: 15, color: g.color || ac }}>{g.name}</div>
                          <div style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>{gdone}/{gtasks.length} done</div>
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button onClick={() => setGroupModal(g)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, padding: "4px 6px" }}>✏️</button>
                        <button onClick={() => deleteGroup(g.id)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, padding: "4px 6px" }}>🗑</button>
                        <button onClick={() => setModal({ groupId: g.id })} style={{ fontSize: 12, padding: "5px 12px", background: g.color || ac, color: "#fff", border: "none", borderRadius: 7, cursor: "pointer" }}>+ Task</button>
                      </div>
                    </div>
                    {gtasks.length > 0 && (
                      <div style={{ padding: 12 }}>
                        {gtasks.map(t => <TaskRow key={t.id} task={t} {...taskRowProps} />)}
                      </div>
                    )}
                    {gtasks.length === 0 && <div style={{ padding: "14px 16px", fontSize: 13, color: "var(--color-text-secondary)", fontStyle: "italic" }}>No tasks yet — add one above</div>}
                  </div>
                );
              })}
            </div>
              )}

              {todayMode === "insights" && (
                <TasksInsights state={state} allTasks={allTasks} overdueTasks={overdueTasks} accentColor={ac} onGoFinance={() => setView("finance")} />
              )}
            </div>
          )}

          {/* Important dates */}
          {view === "important-dates" && (
            <div>
              <SectionHead sub="Birthdays, anniversaries and events — with their own to-do lists and budgets.">🎂 Important dates</SectionHead>
              <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 14 }}>
                <button onClick={() => setDateModal("new")} style={{ fontSize: 13, padding: "7px 16px", background: ac, color: "#fff", border: "none", borderRadius: 9, cursor: "pointer" }}>+ Add date</button>
              </div>
              {state.importantDates.length === 0 && (
                <div style={{ textAlign: "center", padding: 60, color: "var(--color-text-secondary)" }}>
                  <div style={{ fontSize: 36, marginBottom: 10 }}>🎂</div>
                  <div style={{ fontSize: 15, marginBottom: 4 }}>No important dates yet</div>
                  <div style={{ fontSize: 13 }}>Add birthdays, anniversaries and events</div>
                </div>
              )}
              {state.importantDates.sort((a, b) => (a.date?.slice(5) || "").localeCompare(b.date?.slice(5) || "")).map(d => {
                const ti = DATE_TYPES.find(t => t.v === d.type);
                const thisYearDate = d.date ? `${new Date().getFullYear()}-${d.date.slice(5)}` : null;
                const du = thisYearDate ? daysUntil(thisYearDate) : null;
                const upcoming = du !== null && du >= 0 && du <= 30;
                const doneTodos = (d.tasks || []).filter(t => t.done).length;
                const totalTodos = (d.tasks || []).length;
                return (
                  <div key={d.id} style={{ background: "var(--color-background-primary)", borderRadius: 12, border: `0.5px solid ${upcoming ? ac : "var(--color-border-tertiary)"}`, marginBottom: 10, overflow: "hidden" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 16px" }}>
                      <span style={{ fontSize: 26 }}>{ti?.icon || "📅"}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 500, fontSize: 14 }}>{d.title}</div>
                        <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 2 }}>{fmtShort(d.date)} · repeats {repeatLabel(d.repeatMonths)}</div>
                        {d.notes && <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 2 }}>{d.notes}</div>}
                        {upcoming && <div style={{ fontSize: 12, color: ac, marginTop: 3, fontWeight: 500 }}>Coming up in {du} day{du !== 1 ? "s" : ""}</div>}
                        {totalTodos > 0 && <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 3 }}>✓ {doneTodos}/{totalTodos} to-dos</div>}
                      </div>
                      <div style={{ display: "flex", gap: 4 }}>
                        <button onClick={() => setDateModal(d)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, padding: "4px 6px" }}>✏️</button>
                        <button onClick={() => deleteDate(d.id)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, padding: "4px 6px" }}>🗑</button>
                      </div>
                    </div>
                    {totalTodos > 0 && (
                      <div style={{ padding: "0 16px 12px", borderTop: "0.5px solid var(--color-border-tertiary)", paddingTop: 10 }}>
                        {(d.tasks || []).map(t => (
                          <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                            <div onClick={() => { const updated = { ...d, tasks: d.tasks.map(x => x.id === t.id ? { ...x, done: !x.done } : x) }; saveDate(updated); }} style={{ width: 15, height: 15, borderRadius: "50%", border: `2px solid ${t.done ? "#639922" : "var(--color-border-secondary)"}`, background: t.done ? "#639922" : "transparent", cursor: "pointer", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                              {t.done && <span style={{ color: "#fff", fontSize: 8 }}>✓</span>}
                            </div>
                            <span style={{ fontSize: 13, textDecoration: t.done ? "line-through" : "none", color: t.done ? "var(--color-text-secondary)" : "var(--color-text-primary)" }}>{t.title}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Insights */}
          {/* People / Personas */}
          {view === "people" && <PeopleView state={state} up={up} accentColor={ac} onAddTask={saveTask} />}

          {/* Finance */}
          {view === "finance" && <FinanceView state={state} up={up} accentColor={ac} />}

          {/* Documents & Policies (Insurance, Warranties, Risk register, Digital Life Audit) */}
          {view === "docs" && <DocsView state={state} up={up} accentColor={ac} goFinance={() => setView("finance")} />}

          {/* Settings */}
          {view === "settings" && <SettingsView state={state} up={up} accentColor={ac} user={user} calendarToken={meta.calendarToken} />}

        </div>
      </div>
    </div>
  );
}

// ── Mount ───────────────────────────────────────────────────────────────────
ReactDOM.createRoot(document.getElementById("root")).render(<AuthGate />);

