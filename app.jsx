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
const DATE_TYPES = [
  { v: "birthday", l: "Birthday", icon: "🎂" },
  { v: "anniversary", l: "Anniversary", icon: "💍" },
  { v: "event", l: "Event", icon: "🎉" },
  { v: "reminder", l: "Reminder", icon: "🔔" }
];
const VIEWS = ["today","inbox","upcoming","someday","groups","calendar","important-dates","insights","settings"];
const VIEW_META = {
  today: { icon: "☀️", label: "Today" },
  inbox: { icon: "📥", label: "Inbox" },
  upcoming: { icon: "📆", label: "Upcoming" },
  someday: { icon: "🌂", label: "Rainy Day" },
  groups: { icon: "📁", label: "Groups" },
  calendar: { icon: "🗓", label: "Calendar" },
  "important-dates": { icon: "🎂", label: "Important Dates" },
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

const INIT = { tasks: [], groups: [{ id: "g1", name: "Work", emoji: "💼", color: "#378ADD" }, { id: "g2", name: "Personal", emoji: "🏠", color: "#1D9E75" }], importantDates: [], tags: DEFAULT_TAGS.map((t, i) => ({ id: genId(), name: t, color: TAG_COLORS[i % TAG_COLORS.length] })), theme: "purple", streak: 0 };

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

function TaskModal({ task, groups, tags, accentColor, onSave, onClose }) {
  const defaults = { title: "", priority: "medium", groupId: "", deadline: "", scheduledDate: "", notes: "", tags: [], subtasks: [], someday: false, repeat: "none", duration: "", done: false };
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
      </div>
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
        <button onClick={() => { if (t.title.trim()) onSave({ ...t, id: t.id || genId() }); }} style={{ padding: "9px 20px", fontSize: 13, background: accentColor, color: "#fff", border: "none", borderRadius: 9, cursor: "pointer", fontWeight: 500 }}>
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

function DateModal({ item, tags, groups, accentColor, onSave, onClose }) {
  const [d, setD] = useState(item || { title: "", date: "", type: "birthday", notes: "", tasks: [] });
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
        <button onClick={() => { if (d.title && d.date) onSave({ ...d, id: d.id || genId() }); }} style={{ padding: "9px 20px", background: accentColor, color: "#fff", border: "none", borderRadius: 9, cursor: "pointer", fontWeight: 500 }}>
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
  const httpsFeed = calendarToken ? `${origin}/api/calendar?token=${calendarToken}` : "";
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
  const [collapsed, setCollapsed] = useState(false);
  const [weeklyReview, setWeeklyReview] = useState(false);

  const ac = accent(state.theme);
  const today = todayStr();

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
  let viewTasks = [];
  if (view === "inbox") viewTasks = filterTasks(allTasks.filter(t => !t.groupId && !t.someday));
  else if (view === "today") viewTasks = filterTasks(allTasks.filter(t => !t.done && (t.scheduledDate === today || t.deadline === today)));
  else if (view === "someday") viewTasks = filterTasks(allTasks.filter(t => t.someday && !t.done));
  else if (view === "upcoming") viewTasks = filterTasks(allTasks.filter(t => !t.done && t.deadline && t.deadline > today).sort((a, b) => a.deadline.localeCompare(b.deadline)));

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
      {modal && <TaskModal task={modal === "new" ? null : (typeof modal === "object" && modal.prefill) ? { deadline: modal.prefill } : modal} groups={state.groups} tags={state.tags} accentColor={ac} onSave={saveTask} onClose={() => setModal(null)} />}
      {groupModal !== null && <GroupModal group={groupModal === "new" ? null : groupModal} accentColor={ac} onSave={saveGroup} onClose={() => setGroupModal(null)} />}
      {dateModal !== null && <DateModal item={dateModal === "new" ? null : dateModal} tags={state.tags} groups={state.groups} accentColor={ac} onSave={saveDate} onClose={() => setDateModal(null)} />}

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

      {/* Sidebar */}
      <div style={{ width: collapsed ? 56 : 210, background: "var(--color-background-primary)", borderRight: "0.5px solid var(--color-border-tertiary)", display: "flex", flexDirection: "column", flexShrink: 0, transition: "width 0.2s" }}>
        <div style={{ padding: collapsed ? "14px 10px" : "16px 14px", display: "flex", alignItems: "center", justifyContent: collapsed ? "center" : "space-between", borderBottom: "0.5px solid var(--color-border-tertiary)" }}>
          {!collapsed && <span style={{ fontWeight: 600, fontSize: 16, color: ac, letterSpacing: "-0.01em" }}>Tend</span>}
          <button onClick={() => setCollapsed(!collapsed)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 17, color: "var(--color-text-secondary)", padding: 2 }}>☰</button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "8px 6px" }}>
          {VIEWS.map(v => {
            const meta = VIEW_META[v];
            const isActive = view === v;
            return (
              <div key={v} onClick={() => setView(v)} title={collapsed ? meta.label : ""} style={{ display: "flex", alignItems: "center", gap: 9, padding: collapsed ? "9px" : "9px 10px", cursor: "pointer", borderRadius: 9, margin: "1px 0", background: isActive ? hex2rgba(ac, 0.1) : "transparent", color: isActive ? ac : "var(--color-text-secondary)", fontWeight: isActive ? 500 : 400, fontSize: 13, justifyContent: collapsed ? "center" : "flex-start", transition: "background 0.12s" }}>
                <span style={{ fontSize: 15, flexShrink: 0 }}>{meta.icon}</span>
                {!collapsed && <span>{meta.label}</span>}
                {!collapsed && v === "today" && allTasks.filter(t => !t.done && (t.scheduledDate === today || t.deadline === today)).length > 0 && (
                  <span style={{ marginLeft: "auto", background: ac, color: "#fff", borderRadius: 10, fontSize: 10, padding: "1px 6px", fontWeight: 500 }}>{allTasks.filter(t => !t.done && (t.scheduledDate === today || t.deadline === today)).length}</span>
                )}
              </div>
            );
          })}
        </div>
        {!collapsed && (
          <div style={{ padding: "10px 12px 14px", borderTop: "0.5px solid var(--color-border-tertiary)" }}>
            <button onClick={() => setWeeklyReview(true)} style={{ width: "100%", fontSize: 12, padding: "7px 0", borderRadius: 8, cursor: "pointer", marginBottom: 5, color: "var(--color-text-secondary)" }}>📋 Weekly review</button>
          </div>
        )}
      </div>

      {/* Main content */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {/* Topbar */}
        <div style={{ padding: "12px 20px", background: "var(--color-background-primary)", borderBottom: "0.5px solid var(--color-border-tertiary)", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <h1 style={{ margin: 0, fontSize: 17, fontWeight: 500, flex: 1 }}>{VIEW_META[view].icon} {VIEW_META[view].label}</h1>
          {overdueTasks.length > 0 && (
            <div style={{ fontSize: 12, background: "#FCEBEB", color: "#A32D2D", padding: "4px 10px", borderRadius: 20, fontWeight: 500 }}>⚠ {overdueTasks.length} overdue</div>
          )}
          {["inbox","today","upcoming","someday"].includes(view) && (
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
          {view !== "insights" && view !== "settings" && view !== "calendar" && (
            <button onClick={() => setModal("new")} style={{ fontSize: 13, padding: "7px 16px", background: ac, color: "#fff", border: "none", borderRadius: 9, cursor: "pointer", fontWeight: 500 }}>+ New task</button>
          )}
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>

          {/* Task list views */}
          {["inbox","today","upcoming","someday"].includes(view) && (
            <div>
              <QuickAdd
                ctx={{ tags: state.tags, groups: state.groups }}
                accentColor={ac}
                defaults={view === "today" ? { scheduledToday: true } : view === "someday" ? { someday: true } : {}}
                onAdd={saveTask}
              />
              {focusMode && view === "today" && <div style={{ background: hex2rgba(ac, 0.08), borderRadius: 10, padding: "10px 14px", marginBottom: 14, fontSize: 13, color: ac, fontWeight: 500 }}>🎯 Focus mode — stay on today</div>}
              {viewTasks.length === 0 && (
                <div style={{ textAlign: "center", padding: 60, color: "var(--color-text-secondary)" }}>
                  <div style={{ fontSize: 36, marginBottom: 10 }}>{VIEW_META[view].icon}</div>
                  <div style={{ fontSize: 15, marginBottom: 14 }}>Nothing here</div>
                  <button onClick={() => setModal("new")} style={{ fontSize: 13, padding: "8px 20px", background: ac, color: "#fff", border: "none", borderRadius: 9, cursor: "pointer" }}>+ Add task</button>
                </div>
              )}
              {viewTasks.map(t => <TaskRow key={t.id} task={t} {...taskRowProps} />)}
              {view === "today" && allTasks.filter(t => t.done && t.completedDate === today).length > 0 && (
                <>
                  <Divider />
                  <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginBottom: 8, fontWeight: 500 }}>Completed today</div>
                  {allTasks.filter(t => t.done && t.completedDate === today).map(t => <TaskRow key={t.id} task={t} {...taskRowProps} />)}
                </>
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

          {/* Calendar */}
          {view === "calendar" && (
            <CalendarView
              tasks={allTasks}
              importantDates={state.importantDates}
              accentColor={ac}
              onAddTask={(date) => setModal({ prefill: date })}
              onEditDate={(d) => setDateModal(d)}
            />
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
            </div>
          )}

          {/* Settings */}
          {view === "settings" && <SettingsView state={state} up={up} accentColor={ac} user={user} calendarToken={meta.calendarToken} />}

        </div>
      </div>
    </div>
  );
}

// ── Mount ───────────────────────────────────────────────────────────────────
ReactDOM.createRoot(document.getElementById("root")).render(<AuthGate />);

