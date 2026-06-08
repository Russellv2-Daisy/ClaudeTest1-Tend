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
// Budget groups, each holding line items — mirrors the user's spreadsheet structure.
// Streamlined to the groups/items actually in use (the rest can be added in the Plan tab).
const DEFAULT_FINANCE_CATS = [
  { id: "g_housing", name: "Housing", emoji: "🏠", color: "#7F77DD", kind: "spending", items: [
    { id: "i_rent", name: "Mortgage or rent" } ] },
  { id: "g_ent", name: "Entertainment", emoji: "🎉", color: "#D4537E", kind: "spending", items: [
    { id: "i_daysout", name: "Days Out (Inc Tradewell)" }, { id: "i_spotify", name: "Spotify" }, { id: "i_starlink", name: "Starlink" } ] },
  { id: "g_transport", name: "Transportation", emoji: "🚗", color: "#378ADD", kind: "spending", items: [
    { id: "i_fuel", name: "Fuel" } ] },
  { id: "g_loans", name: "Loans", emoji: "💳", color: "#BA7517", kind: "spending", items: [
    { id: "i_clublloyds", name: "Club Lloyds fee" } ] },
  { id: "g_food", name: "Food", emoji: "🍔", color: "#D85A30", kind: "spending", items: [
    { id: "i_groceries", name: "Groceries" }, { id: "i_dining", name: "Dining out" } ] },
  { id: "g_personal", name: "Personal Care", emoji: "🧴", color: "#1D9E75", kind: "spending", items: [
    { id: "i_hair", name: "Hair/nails" }, { id: "i_apple", name: "Apple Storage" }, { id: "i_phone", name: "Phone" }, { id: "i_liquids", name: "Liquids" } ] },
  { id: "g_gifts", name: "Gifts", emoji: "🎁", color: "#BA7517", kind: "spending", items: [
    { id: "i_gifts", name: "General gifts" } ] }
];
const RELATIONSHIPS = ["Partner", "Family", "Friend", "Colleague", "Other"];
// Current month key, computed once at load (timezone-safe). Used to pre-seed the budget.
const SEED_MONTH = (() => { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0"); })();
// Pre-filled budget values transcribed from "JR PERSONAL MONTHLY BUDGET - Jan 26".
const SEED_PLAN = {
  income: { projected: 2289, actual: 2289 },
  extra: { projected: 0, actual: 0 },
  byItem: {
    i_rent: { projected: 400, actual: 400 },
    i_daysout: { projected: 100, actual: 100 }, i_spotify: { projected: 12.99, actual: 12.99 }, i_starlink: { projected: 34, actual: 34 },
    i_fuel: { projected: 100, actual: 100 },
    i_clublloyds: { projected: 22, actual: 22 },
    i_groceries: { projected: 100, actual: 100 }, i_dining: { projected: 50, actual: 50 },
    i_hair: { projected: 20, actual: 20 }, i_apple: { projected: 2.99, actual: 2.99 }, i_phone: { projected: 7, actual: 7 }, i_liquids: { projected: 10, actual: 10 }
  }
};
const DATE_TYPES = [
  { v: "birthday", l: "Birthday", icon: "🎂" },
  { v: "anniversary", l: "Anniversary", icon: "💍" },
  { v: "event", l: "Event", icon: "🎉" },
  { v: "reminder", l: "Reminder", icon: "🔔" }
];
const VIEWS = ["today","groups","important-dates","people","finance","insights","settings"];
const VIEW_META = {
  today: { icon: "☀️", label: "Today" },
  groups: { icon: "📁", label: "Groups" },
  "important-dates": { icon: "🎂", label: "Important Dates" },
  people: { icon: "🎁", label: "People" },
  finance: { icon: "💷", label: "Finance" },
  insights: { icon: "📊", label: "Insights" },
  settings: { icon: "⚙️", label: "Settings" }
};

function genId() { return Math.random().toString(36).slice(2, 10); }
function todayStr() { return new Date().toISOString().slice(0, 10); }
function fmtDate(d) { if (!d) return ""; return new Date(d + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }); }
function fmtShort(d) { if (!d) return ""; return new Date(d + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" }); }
function daysUntil(d) { if (!d) return null; return Math.round((new Date(d + "T00:00:00") - new Date(new Date().toDateString())) / 86400000); }
function getDaysInMonth(y, m) { return new Date(y, m + 1, 0).getDate(); }
function getFirstDayOfMonth(y, m) { return new Date(y, m, 1).getDay(); }

const INIT = { tasks: [], groups: [{ id: "g1", name: "Work", emoji: "💼", color: "#378ADD" }, { id: "g2", name: "Personal", emoji: "🏠", color: "#1D9E75" }], importantDates: [], tags: DEFAULT_TAGS.map((t, i) => ({ id: genId(), name: t, color: TAG_COLORS[i % TAG_COLORS.length] })), financeCategories: DEFAULT_FINANCE_CATS, financePlans: { [SEED_MONTH]: SEED_PLAN }, transactions: [], savingsAccounts: [], subscriptions: [], debts: [], netWorthHistory: {}, safetyBuffer: 0, people: [], theme: "purple", streak: 0 };

// Cloud-backed state. Loads the signed-in user's blob from Supabase, merges over
// INIT defaults, and saves changes back (debounced). Falls back to a local cache
// so the app still opens if briefly offline.
function useAppState(user) {
  const seed = () => {
    const c = window.TendCloud && window.TendCloud.cacheGet();
    return c && c.data ? { ...INIT, ...c.data } : INIT;
  };
  const [state, setState] = useState(seed);
  const [loaded, setLoaded] = useState(false);
  const [calendarToken, setCalendarToken] = useState(
    (window.TendCloud && (window.TendCloud.cacheGet() || {}).calendarToken) || ""
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
        <Field label="Scheduled date">
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
  const [d, setD] = useState(item || { title: "", date: "", type: "birthday", notes: "", tasks: [], cost: "", costCategory: "" });
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
          <Field label="Notes">
            <textarea placeholder="Add a note…" value={d.notes} onChange={e => up("notes", e.target.value)} rows={3} style={{ width: "100%", boxSizing: "border-box", resize: "vertical" }} />
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
        <button onClick={() => { if (d.title && d.date) onSave({ ...d, id: d.id || genId(), cost: parseFloat(d.cost) || 0 }); }} style={{ padding: "9px 20px", background: accentColor, color: "#fff", border: "none", borderRadius: 9, cursor: "pointer", fontWeight: 500 }}>
          {item?.id ? "Save changes" : "Add date"}
        </button>
      </div>
    </Modal>
  );
}

// ── Task Row ──────────────────────────────────────────────────────────────────

function TaskRow({ task, tags, groups, onToggle, onEdit, onDelete }) {
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
          {task.deadline && <span style={{ fontSize: 11, color: overdue ? "#A32D2D" : "var(--color-text-secondary)" }}>⚑ {fmtDate(task.deadline)}</span>}
          {task.scheduledDate && <span style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>▷ {fmtDate(task.scheduledDate)}</span>}
          {task.duration && <span style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>⏱ {task.duration}min</span>}
          {grp && <span style={{ fontSize: 11, color: grp.color || "var(--color-text-secondary)", fontWeight: 500 }}>{grp.emoji} {grp.name}</span>}
          {task.repeat && task.repeat !== "none" && <span style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>↻ {task.repeat}</span>}
        </div>
        {task.subtasks?.length > 0 && (
          <div style={{ marginTop: 7, paddingLeft: 10, borderLeft: "2px solid var(--color-border-tertiary)" }}>
            {task.subtasks.map(s => (
              <div key={s.id} style={{ fontSize: 12, color: "var(--color-text-secondary)", display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                <span style={{ width: 13, height: 13, border: "1.5px solid var(--color-border-secondary)", borderRadius: "50%", background: s.done ? "#639922" : "transparent", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{s.done && <span style={{ color: "#fff", fontSize: 8 }}>✓</span>}</span>
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

function CalendarView({ tasks, importantDates, accentColor, onAddTask, onEditDate }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [selected, setSelected] = useState(null);

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = (getFirstDayOfMonth(year, month) + 6) % 7; // Mon start
  const todayDate = now.getDate(), todayMonth = now.getMonth(), todayYear = now.getFullYear();
  const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const DAY_NAMES = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

  function dateStr(d) { return `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`; }

  function getEventsForDay(d) {
    const ds = dateStr(d);
    const monthDay = ds.slice(5);
    const ts = tasks.filter(t => t.deadline === ds || t.scheduledDate === ds);
    const ids = importantDates.filter(id => id.date && id.date.slice(5) === monthDay);
    return { tasks: ts, dates: ids };
  }

  const selDateStr = selected ? dateStr(selected) : null;
  const selEvents = selected ? getEventsForDay(selected) : null;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 16, alignItems: "start" }}>
      <div style={{ background: "var(--color-background-primary)", borderRadius: 14, border: "0.5px solid var(--color-border-tertiary)", overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "0.5px solid var(--color-border-tertiary)" }}>
          <button onClick={() => { let m = month - 1, y = year; if (m < 0) { m = 11; y--; } setMonth(m); setYear(y); }} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "var(--color-text-secondary)", padding: "2px 8px" }}>‹</button>
          <span style={{ fontWeight: 500, fontSize: 15 }}>{MONTH_NAMES[month]} {year}</span>
          <button onClick={() => { let m = month + 1, y = year; if (m > 11) { m = 0; y++; } setMonth(m); setYear(y); }} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "var(--color-text-secondary)", padding: "2px 8px" }}>›</button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", padding: "10px 12px 0" }}>
          {DAY_NAMES.map(d => <div key={d} style={{ textAlign: "center", fontSize: 11, fontWeight: 500, color: "var(--color-text-secondary)", padding: "0 0 8px", textTransform: "uppercase", letterSpacing: "0.05em" }}>{d}</div>)}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", padding: "0 12px 14px", gap: 3 }}>
          {Array(firstDay).fill(null).map((_, i) => <div key={"e" + i} />)}
          {Array(daysInMonth).fill(null).map((_, i) => {
            const d = i + 1;
            const isToday = d === todayDate && month === todayMonth && year === todayYear;
            const isSel = d === selected;
            const ev = getEventsForDay(d);
            const hasTask = ev.tasks.length > 0;
            const hasDate = ev.dates.length > 0;
            return (
              <div key={d} onClick={() => setSelected(isSel ? null : d)} style={{ borderRadius: 9, padding: "6px 4px", textAlign: "center", cursor: "pointer", background: isSel ? accentColor : isToday ? hex2rgba(accentColor, 0.1) : "transparent", border: isToday && !isSel ? `1.5px solid ${accentColor}` : "1.5px solid transparent", transition: "background 0.15s" }}>
                <div style={{ fontSize: 13, fontWeight: isToday || isSel ? 500 : 400, color: isSel ? "#fff" : isToday ? accentColor : "var(--color-text-primary)" }}>{d}</div>
                <div style={{ display: "flex", gap: 2, justifyContent: "center", marginTop: 3 }}>
                  {hasTask && <div style={{ width: 5, height: 5, borderRadius: "50%", background: isSel ? "rgba(255,255,255,0.8)" : accentColor }} />}
                  {hasDate && <div style={{ width: 5, height: 5, borderRadius: "50%", background: isSel ? "rgba(255,255,255,0.8)" : "#E24B4A" }} />}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ background: "var(--color-background-primary)", borderRadius: 14, border: "0.5px solid var(--color-border-tertiary)", padding: 16, minHeight: 200 }}>
        {selected ? (
          <>
            <div style={{ fontWeight: 500, fontSize: 14, marginBottom: 12 }}>{selected} {MONTH_NAMES[month]}</div>
            {selEvents.tasks.length === 0 && selEvents.dates.length === 0 && (
              <div style={{ fontSize: 13, color: "var(--color-text-secondary)", marginBottom: 12 }}>Nothing scheduled.</div>
            )}
            {selEvents.dates.map(id => {
              const typeInfo = DATE_TYPES.find(t => t.v === id.type);
              return (
                <div key={id.id} onClick={() => onEditDate(id)} style={{ padding: "8px 10px", borderRadius: 9, background: "#FCEBEB", marginBottom: 6, cursor: "pointer" }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "#A32D2D" }}>{typeInfo?.icon} {id.title}</div>
                  <div style={{ fontSize: 11, color: "#E24B4A", marginTop: 2 }}>{id.type} · repeats yearly</div>
                  {id.tasks?.length > 0 && <div style={{ fontSize: 11, color: "#A32D2D", marginTop: 2 }}>{id.tasks.filter(t => t.done).length}/{id.tasks.length} to-dos</div>}
                </div>
              );
            })}
            {selEvents.tasks.map(t => (
              <div key={t.id} style={{ padding: "8px 10px", borderRadius: 9, background: hex2rgba(accentColor, 0.08), marginBottom: 6 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: accentColor }}>{t.title}</div>
                <div style={{ fontSize: 11, color: "var(--color-text-secondary)", marginTop: 2 }}><PriBadge p={t.priority} /></div>
              </div>
            ))}
            <button onClick={() => onAddTask(selDateStr)} style={{ marginTop: 8, width: "100%", padding: "8px", borderRadius: 8, border: `1px dashed ${accentColor}`, background: "transparent", color: accentColor, fontSize: 13, cursor: "pointer" }}>+ Add task</button>
          </>
        ) : (
          <div style={{ textAlign: "center", padding: "24px 0", color: "var(--color-text-secondary)", fontSize: 13 }}>Select a day to see events</div>
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

  return (
    <div style={{ maxWidth: 560 }}>
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
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const ac = THEMES.purple;

  async function emailAuth() {
    if (!email.trim() || !pw) { setMsg({ t: "err", m: "Enter your email and password." }); return; }
    setBusy(true); setMsg(null);
    try {
      const fn = mode === "signup" ? "signUpWithEmail" : "signInWithEmail";
      const { data, error } = await window.TendCloud[fn](email.trim(), pw);
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
    if (amt > 0 && d.costCategory && d.date && d.date.slice(5, 7) === mk.slice(5, 7)) pushAuto(d.costCategory, { label: d.title || "Important date", amount: amt, source: "date" });
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

  const incomeProjected = (Number((plan.income || {}).projected) || 0) + (Number((plan.extra || {}).projected) || 0);
  const incomeManualActual = (Number((plan.income || {}).actual) || 0) + (Number((plan.extra || {}).actual) || 0);
  const incomeActual = txnIncome > 0 ? txnIncome : incomeManualActual;
  const spend = cats.reduce((s, c) => s + byCat[c.id].spent, 0);

  return { txns, plan, byItem, byCat, incomeProjected, incomeManualActual, incomeActual, income: incomeActual, spend, plannedTotal, manualActualTotal };
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
  { id: "plan", icon: "🎯", label: "Plan" },
  { id: "savings", icon: "🐖", label: "Savings" },
  { id: "subs", icon: "🔁", label: "Subscriptions" },
  { id: "trends", icon: "📈", label: "Trends" },
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
      <input type="number" step="0.01" value={value === 0 || value ? value : ""} placeholder="0"
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

function SavingsModal({ account, accentColor, onSave, onClose }) {
  const blank = { name: "", institution: "", balance: "", contribution: "", rate: "", target: "", targetDate: "" };
  const [a, setA] = useState({ ...blank, ...(account || {}) });
  const up = (k, v) => setA(x => ({ ...x, [k]: v }));
  const ac = accentColor;
  return (
    <Modal onClose={onClose} width={420}>
      <ModalHeader title={account?.id ? "Edit savings account" : "New savings account"} onClose={onClose} />
      <Field label="Name"><input placeholder="e.g. Emergency fund, House deposit" value={a.name} onChange={e => up("name", e.target.value)} style={{ width: "100%", boxSizing: "border-box" }} autoFocus /></Field>
      <Field label="Provider / institution"><input placeholder="e.g. Club Lloyds Monthly Saver" value={a.institution} onChange={e => up("institution", e.target.value)} style={{ width: "100%", boxSizing: "border-box" }} /></Field>
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
        <button onClick={() => { if (a.name.trim()) onSave({ id: account?.id || genId(), name: a.name.trim(), institution: a.institution, balance: parseFloat(a.balance) || 0, contribution: parseFloat(a.contribution) || 0, rate: parseFloat(a.rate) || 0, target: parseFloat(a.target) || 0, targetDate: a.targetDate || "" }); }} style={{ padding: "9px 20px", fontSize: 13, background: ac, color: "#fff", border: "none", borderRadius: 9, cursor: "pointer", fontWeight: 500 }}>{account?.id ? "Save" : "Add"}</button>
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
    <div style={{ marginTop: 24 }}>
      <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>💷 Money</div>
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
  const assets = (state.savingsAccounts || []).reduce((s, a) => s + (Number(a.balance) || 0), 0);
  const debtTotal = debts.reduce((s, d) => s + (Number(d.balance) || 0), 0);
  const nw = assets - debtTotal;
  const [dn, setDn] = useState(""); const [db, setDb] = useState("");
  const mk = curMonthKey();
  useEffect(() => {
    const hist = state.netWorthHistory || {};
    if (hist[mk] !== nw) up({ netWorthHistory: { ...hist, [mk]: nw } });
  }, [nw]);
  const hist = state.netWorthHistory || {};
  const months = Object.keys(hist).sort().slice(-6);
  const bars = months.map(m => ({ label: monthShort(m), value: Math.max(0, hist[m]), color: "#7F77DD" }));
  const addDebt = () => { if (!dn.trim()) return; up({ debts: [...debts, { id: genId(), name: dn.trim(), balance: parseFloat(db) || 0 }] }); setDn(""); setDb(""); };
  return (
    <div style={{ background: "var(--color-background-primary)", borderRadius: 12, padding: 18, border: "0.5px solid var(--color-border-tertiary)", marginTop: 14 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 4 }}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>📈 Net worth</div>
        <div style={{ fontSize: 24, fontWeight: 700, color: nw >= 0 ? "#1D9E75" : "#E24B4A" }}>{fmtMoney(nw)}</div>
      </div>
      <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginBottom: 12 }}>Assets {fmtMoney(assets, true)} − Debts {fmtMoney(debtTotal, true)}</div>
      <div style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-secondary)", marginBottom: 6 }}>DEBTS (credit cards, loans…)</div>
      {debts.map(d => (
        <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, marginBottom: 5 }}>
          <span style={{ flex: 1 }}>💳 {d.name}</span>
          <span style={{ color: "#E24B4A" }}>−{fmtMoney(d.balance, true)}</span>
          <button onClick={() => up({ debts: debts.filter(x => x.id !== d.id) })} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, color: "var(--color-text-secondary)" }}>×</button>
        </div>
      ))}
      <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
        <input placeholder="Debt name (e.g. Visa)" value={dn} onChange={e => setDn(e.target.value)} onKeyDown={e => e.key === "Enter" && addDebt()} style={{ flex: 1, fontSize: 13 }} />
        <input type="number" placeholder="£ owed" value={db} onChange={e => setDb(e.target.value)} style={{ width: 90, fontSize: 13 }} />
        <button onClick={addDebt} style={{ padding: "0 14px", fontSize: 13 }}>+</button>
      </div>
      {bars.length >= 2 && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginBottom: 8 }}>Net worth over time</div>
          <BarsChart data={bars} money height={110} />
        </div>
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
  const [potModal, setPotModal] = useState(null);
  const [subModal, setSubModal] = useState(null);
  const [planText, setPlanText] = useState("");
  const [txnFilter, setTxnFilter] = useState("");
  const [txnSearch, setTxnSearch] = useState("");
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
  function savePot(accId, pot) {
    up({ savingsAccounts: savings.map(s => s.id === accId ? { ...s, pots: (s.pots || []).some(p => p.id === pot.id) ? (s.pots || []).map(p => p.id === pot.id ? pot : p) : [...(s.pots || []), pot] } : s) });
    setPotModal(null);
  }
  function deletePot(accId, potId) { up({ savingsAccounts: savings.map(s => s.id === accId ? { ...s, pots: (s.pots || []).filter(p => p.id !== potId) } : s) }); }
  const subs = state.subscriptions || [];
  function saveSub(s) { up({ subscriptions: subs.some(x => x.id === s.id) ? subs.map(x => x.id === s.id ? s : x) : [...subs, s] }); setSubModal(null); }
  function deleteSub(id) { up({ subscriptions: subs.filter(s => s.id !== id) }); }
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
      {potModal && <PotModal pot={potModal.pot} importantDates={state.importantDates || []} accentColor={ac} onSave={p => savePot(potModal.accId, p)} onClose={() => setPotModal(null)} />}
      {subModal !== null && <SubModal sub={subModal === "new" ? null : subModal} cats={cats} accentColor={ac} onSave={saveSub} onClose={() => setSubModal(null)} />}

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
              {(() => {
                const savContrib = savings.reduce((s, a) => s + (Number(a.contribution) || 0), 0);
                const buffer = Number(state.safetyBuffer) || 0;
                const expIncome = stats.incomeActual > 0 ? stats.incomeActual : stats.incomeProjected;
                const safe = expIncome - stats.plannedTotal - savContrib - buffer;
                const col = safe >= 0 ? "#1D9E75" : "#E24B4A";
                return (
                  <div style={{ background: hex2rgba(col, 0.08), border: `1px solid ${hex2rgba(col, 0.3)}`, borderRadius: 14, padding: "16px 18px", marginBottom: 16, display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
                    <div style={{ flex: 1, minWidth: 180 }}>
                      <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginBottom: 4 }}>💸 Safe to spend this month</div>
                      <div style={{ fontSize: 30, fontWeight: 700, color: col }}>{fmtMoney(safe)}</div>
                      <div style={{ fontSize: 11, color: "var(--color-text-secondary)", marginTop: 4 }}>after your plan, savings{buffer > 0 ? " & buffer" : ""} — {safe >= 0 ? "free to spend" : "over budget; trim the plan"}</div>
                    </div>
                    <div style={{ fontSize: 12, color: "var(--color-text-secondary)", lineHeight: 1.8 }}>
                      <div>Income <b style={{ color: "var(--color-text-primary)" }}>{fmtMoney(expIncome, true)}</b></div>
                      <div>− Planned outgoings <b style={{ color: "var(--color-text-primary)" }}>{fmtMoney(stats.plannedTotal, true)}</b></div>
                      <div>− Savings contributions <b style={{ color: "var(--color-text-primary)" }}>{fmtMoney(savContrib, true)}</b></div>
                      <div>− Safety buffer <b style={{ color: "var(--color-text-primary)" }}>{fmtMoney(buffer, true)}</b></div>
                    </div>
                  </div>
                );
              })()}
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
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
            <MonthNav />
            <button onClick={copyLastMonth} style={{ fontSize: 12, padding: "6px 12px", borderRadius: 8, cursor: "pointer" }}>⧉ Copy last month</button>
          </div>

          <div style={{ background: "var(--color-background-primary)", borderRadius: 12, padding: 18, border: "0.5px solid var(--color-border-tertiary)", marginBottom: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 8 }}>🤖 Describe your plan in words</div>
            <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginBottom: 10 }}>Fills the Projected column by line item — e.g. “groceries 100, dining 50, fuel 100, spotify 13, income 2289”. <span style={{ opacity: 0.8 }}>Or just type into the cells below. Offline parser for now — full Claude understanding arrives with the bank link (Phase B).</span></div>
            <div style={{ display: "flex", gap: 8 }}>
              <input value={planText} onChange={e => setPlanText(e.target.value)} onKeyDown={e => e.key === "Enter" && applyParsed()} placeholder="Type your plan and press Enter…" style={{ flex: 1, fontSize: 14, boxSizing: "border-box" }} />
              <button onClick={applyParsed} style={{ padding: "0 18px", background: ac, color: "#fff", border: "none", borderRadius: 9, cursor: "pointer", fontWeight: 500 }}>Apply</button>
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
            {[["income", "Income 1"], ["extra", "Extra income"]].map(([f, label]) => (
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
                      <span>{a.source === "date" ? "🎂" : "📋"}</span>
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
              <span title="A cushion held back from your plan in case you overspend">🛟 Safety buffer</span>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ color: "var(--color-text-secondary)" }}>£</span><input type="number" step="1" value={state.safetyBuffer || ""} onChange={e => up({ safetyBuffer: parseFloat(e.target.value) || 0 })} placeholder="0" style={{ width: 90, textAlign: "right" }} /></div>
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
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, gap: 10, flexWrap: "wrap" }}>
              <div style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>Track balances, goals and how long until you reach them. Balances sync once your bank is linked.</div>
              <button onClick={() => setSavModal("new")} style={{ fontSize: 13, padding: "7px 16px", background: ac, color: "#fff", border: "none", borderRadius: 9, cursor: "pointer", fontWeight: 500 }}>+ Account</button>
            </div>

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
                  <StatCard label="In 12 months" value={fmtMoney(proj[2].value)} color="#1D9E75" sub="at current pace" />
                </div>
                <div style={{ background: "var(--color-background-primary)", borderRadius: 12, padding: 18, border: "0.5px solid var(--color-border-tertiary)", marginBottom: 14 }}>
                  <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 16 }}>Projected total savings</div>
                  <BarsChart data={proj} money />
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
                        <span style={{ fontSize: 22 }}>🐖</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, fontSize: 15 }}>{a.name}</div>
                          <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>{a.institution || "Savings"}{a.rate ? ` · ${a.rate}% AER` : ""}{a.contribution ? ` · ${fmtMoney(a.contribution, true)}/mo` : ""}</div>
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
            <NetWorth state={state} up={up} accentColor={ac} />
          </div>
        );
      })()}

      {/* ── Subscriptions ── */}
      {tab === "subs" && (() => {
        const ymd = d => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
        const nextFromDay = day => { const t = new Date(); t.setHours(0, 0, 0, 0); const mk2 = (yy, mm) => { const dim = new Date(yy, mm + 1, 0).getDate(); return new Date(yy, mm, Math.min(day || 1, dim)); }; let d = mk2(t.getFullYear(), t.getMonth()); if (d < t) d = mk2(t.getFullYear(), t.getMonth() + 1); return ymd(d); };
        const manual = subs.map(s => ({ id: s.id, name: s.name, amount: Number(s.amount) || 0, next: nextFromDay(Number(s.day) || 1), categoryId: s.categoryId, auto: false }));
        const auto = detectSubscriptions(state).filter(a => !manual.some(m => m.name.toLowerCase() === a.name.toLowerCase())).map(a => ({ id: "auto_" + a.name, name: a.name, amount: a.amount, next: a.lastDate ? (() => { const d = new Date(a.lastDate + "T00:00:00"); d.setMonth(d.getMonth() + 1); return ymd(d); })() : "", categoryId: a.categoryId, auto: true }));
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
        if (!hasData) return <div style={{ textAlign: "center", padding: 50, color: "var(--color-text-secondary)" }}><div style={{ fontSize: 38, marginBottom: 12 }}>📈</div><div style={{ fontSize: 14, marginBottom: 16 }}>No history yet — add transactions to see trends.</div><button onClick={loadSample} style={{ fontSize: 13, padding: "8px 16px", borderRadius: 9, cursor: "pointer" }}>✨ Load sample data</button></div>;
        return (
          <div style={{ display: "grid", gap: 14 }}>
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
          </div>
        );
      })()}

      {/* ── Transactions ── */}
      {tab === "transactions" && (() => {
        let list = (state.transactions || []).slice().sort((a, b) => (b.date || "").localeCompare(a.date || ""));
        if (txnFilter) list = list.filter(t => t.categoryId === txnFilter);
        if (txnSearch.trim()) { const q = txnSearch.toLowerCase(); list = list.filter(t => (t.description || "").toLowerCase().includes(q)); }
        return (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, gap: 10, flexWrap: "wrap" }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <input placeholder="Search…" value={txnSearch} onChange={e => setTxnSearch(e.target.value)} style={{ fontSize: 13, width: 150 }} />
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
            {(state.transactions || []).length > 0 && list.length === 0 && <div style={{ textAlign: "center", padding: 30, color: "var(--color-text-secondary)", fontSize: 13 }}>No transactions match your search/filter.</div>}
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
          </div>
        );
      })()}

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
  const blank = { name: "", relationship: "Friend", birthday: "", anniversary: "", otherDates: [], location: "", timezone: "", hobbies: "", brands: "", foods: "", experiences: "", wishlist: [], dislikes: "", typicalBudget: "", reminderLeadDays: 14, giftHistory: [] };
  const [p, setP] = useState({ ...blank, ...(person || {}) });
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
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 4 }}>
        <Field label="Typical budget (£)"><input type="number" step="0.01" placeholder="e.g. 40" value={p.typicalBudget} onChange={e => up("typicalBudget", e.target.value)} style={{ width: "100%", boxSizing: "border-box" }} /></Field>
        <Field label="Remind me before">
          <select value={p.reminderLeadDays} onChange={e => up("reminderLeadDays", parseInt(e.target.value, 10))} style={{ width: "100%" }}>
            {[7, 14, 30, 60, 90].map(n => <option key={n} value={n}>{n} days before</option>)}
          </select>
        </Field>
      </div>
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
        <button onClick={() => { if (p.name.trim()) onSave({ ...p, typicalBudget: parseFloat(p.typicalBudget) || 0 }); }} style={{ padding: "9px 20px", fontSize: 13, background: ac, color: "#fff", border: "none", borderRadius: 9, cursor: "pointer", fontWeight: 500 }}>{person?.id ? "Save" : "Add person"}</button>
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
    up({ people: people.some(x => x.id === id) ? people.map(x => x.id === id ? withId : x) : [...people, withId] });
    setPersonModal(null);
  }
  function deletePerson(id) { if (confirm("Delete this person?")) up({ people: people.filter(p => p.id !== id) }); }

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

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>Important people — profiles power AI gift ideas, aligned to your dates & budget.</div>
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

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(230px,1fr))", gap: 12 }}>
        {people.map(p => {
          const k = nextKeyDate(p);
          return (
            <div key={p.id} style={{ background: "var(--color-background-primary)", borderRadius: 13, border: "0.5px solid var(--color-border-tertiary)", padding: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 10 }}>
                <div style={{ width: 40, height: 40, borderRadius: "50%", background: hex2rgba(ac, 0.14), color: ac, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, fontWeight: 600, flexShrink: 0 }}>{(p.name || "?").slice(0, 1).toUpperCase()}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 15, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</div>
                  <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>{p.relationship}{p.typicalBudget ? ` · ~${fmtMoney(p.typicalBudget, true)}` : ""}</div>
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
}

// ── Main App ──────────────────────────────────────────────────────────────────

function App({ user }) {
  const [state, up, meta] = useAppState(user);
  const [view, setView] = useState("today");
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

  const ac = accent(state.theme);
  const today = todayStr();
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
  // Rainy day (someday).
  const somedayTasks = filterTasks(allTasks.filter(t => t.someday && !t.done));

  const done = allTasks.filter(t => t.done).length;
  const total = allTasks.length;
  const pct = total ? Math.round(done / total * 100) : 0;
  const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
  const weekDone = allTasks.filter(t => t.done && t.completedDate && new Date(t.completedDate) >= weekAgo).length;
  const weekMissed = allTasks.filter(t => !t.done && t.deadline && new Date(t.deadline + "T00:00:00") < new Date() && new Date(t.deadline + "T00:00:00") >= weekAgo).length;
  const overdueTasks = allTasks.filter(t => !t.done && t.deadline && t.deadline < today);

  const taskRowProps = { tags: state.tags, groups: state.groups, onToggle: toggleTask, onEdit: setModal, onDelete: deleteTask };

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
          {!["insights","settings","calendar","finance","people"].includes(view) && (
            <button onClick={() => setModal("new")} style={{ fontSize: 13, padding: "7px 16px", background: ac, color: "#fff", border: "none", borderRadius: 9, cursor: "pointer", fontWeight: 500 }}>+ New task</button>
          )}
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>

          {/* Today hub — List (Today + Unsorted + Upcoming) or Calendar */}
          {view === "today" && (
            <div>
              <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
                {[["list", "📋 List"], ["calendar", "🗓 Calendar"]].map(([m, l]) => (
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
                const completed = allTasks.filter(t => t.done && t.completedDate === today);
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
                    {!focusMode && <Section icon="📆" label="Upcoming" tasks={upcomingTasks} />}
                    {!focusMode && <Section icon="📥" label="Unsorted" hint="no day set — schedule it or file into a group" tasks={unsortedTasks} />}
                    {!focusMode && <Section icon="🌂" label="Rainy Day" hint="for when you have free time" tasks={somedayTasks} />}
                    {completed.length > 0 && (
                      <>
                        <Divider />
                        <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginBottom: 8, fontWeight: 500 }}>Completed today</div>
                        {completed.map(t => <TaskRow key={t.id} task={t} {...taskRowProps} />)}
                      </>
                    )}
                  </div>
                );
              })()}

              {todayMode === "calendar" && (
                <CalendarView tasks={allTasks} importantDates={state.importantDates} accentColor={ac} onAddTask={(date) => setModal({ prefill: date })} onEditDate={(d) => setDateModal(d)} />
              )}
            </div>
          )}

          {/* Groups */}
          {view === "groups" && (
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

          {/* Important dates */}
          {view === "important-dates" && (
            <div>
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
                        <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 2 }}>{fmtShort(d.date)} · repeats yearly</div>
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
          {view === "insights" && (
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
              <MoneyInsights state={state} accentColor={ac} />
            </div>
          )}

          {/* People / Personas */}
          {view === "people" && <PeopleView state={state} up={up} accentColor={ac} onAddTask={saveTask} />}

          {/* Finance */}
          {view === "finance" && <FinanceView state={state} up={up} accentColor={ac} />}

          {/* Settings */}
          {view === "settings" && <SettingsView state={state} up={up} accentColor={ac} user={user} calendarToken={meta.calendarToken} />}

        </div>
      </div>
    </div>
  );
}

// ── Mount ───────────────────────────────────────────────────────────────────
ReactDOM.createRoot(document.getElementById("root")).render(<AuthGate />);

