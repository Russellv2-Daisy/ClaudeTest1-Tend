// ─────────────────────────────────────────────────────────────────────────────
// Tend — iPhone home-screen widget (for the free "Scriptable" app)
//
// HOW TO USE (≈3 minutes, no App Store build needed):
//   1. Install "Scriptable" from the App Store (free).
//   2. In Tend → Settings → 📱 iPhone widget, copy your personal widget URL.
//   3. Open Scriptable → + (new script) → paste this whole file.
//   4. Paste your URL between the quotes on the WIDGET_URL line below.
//   5. Name the script "Tend" and Done.
//   6. On your home screen: long-press → + → Scriptable → add a widget →
//      long-press the widget → Edit Widget → Script: Tend. Done.
//
// It's read-only: the URL only ever READS a summary of your own Tend data
// (net worth, today's tasks, next date). It can never change anything.
// ─────────────────────────────────────────────────────────────────────────────

const WIDGET_URL = "PASTE_YOUR_TEND_WIDGET_URL_HERE";

const ACCENT = new Color("#1D9E75");   // Tend green
const RED = new Color("#E24B4A");
const MUTED = new Color("#8a8a82");

function gbp(n) {
  const v = Math.round(Number(n) || 0);
  return "£" + Math.abs(v).toLocaleString("en-GB") + (v < 0 ? "" : "");
}

async function fetchData() {
  if (!WIDGET_URL || WIDGET_URL.indexOf("http") !== 0) return null;
  try {
    const req = new Request(WIDGET_URL);
    req.timeoutInterval = 15;
    return await req.loadJSON();
  } catch (e) {
    return null;
  }
}

function headerRow(w, name) {
  const row = w.addStack();
  row.centerAlignContent();
  const dot = row.addText("●");
  dot.textColor = ACCENT;
  dot.font = Font.systemFont(11);
  row.addSpacer(5);
  const title = row.addText("Tend");
  title.textColor = Color.dynamic(new Color("#1a1a19"), new Color("#f4f3ee"));
  title.font = Font.semiboldSystemFont(13);
  row.addSpacer();
  if (name) {
    const hi = row.addText(name);
    hi.textColor = MUTED;
    hi.font = Font.systemFont(11);
  }
}

function stat(stack, label, value, color) {
  const s = stack.addStack();
  s.layoutVertically();
  const l = s.addText(label.toUpperCase());
  l.textColor = MUTED;
  l.font = Font.systemFont(8.5);
  const v = s.addText(value);
  v.textColor = color || Color.dynamic(new Color("#1a1a19"), new Color("#f4f3ee"));
  v.font = Font.boldSystemFont(16);
}

async function build() {
  const data = await fetchData();
  const w = new ListWidget();
  w.backgroundColor = Color.dynamic(new Color("#fcfbf7"), new Color("#16160f"));
  w.setPadding(14, 15, 14, 15);

  if (!data) {
    headerRow(w);
    w.addSpacer(8);
    const e = w.addText("Set your widget URL in the script (see Tend → Settings → iPhone widget).");
    e.textColor = MUTED;
    e.font = Font.systemFont(11);
    return w;
  }

  headerRow(w, data.name ? data.name : "");
  w.addSpacer(10);

  // Money row
  const money = w.addStack();
  stat(money, "Net worth", gbp(data.finance.netWorth), (data.finance.netWorth >= 0 ? ACCENT : RED));
  money.addSpacer();
  stat(money, "In the bank", gbp(data.finance.inBank));

  w.addSpacer(10);

  // Tasks
  const t = data.tasks || {};
  const taskHead = w.addStack();
  taskHead.centerAlignContent();
  const th = taskHead.addText("☀︎ Today");
  th.textColor = MUTED;
  th.font = Font.systemFont(10);
  taskHead.addSpacer();
  const cnt = taskHead.addText(`${t.todayCount || 0} task${t.todayCount === 1 ? "" : "s"}`);
  cnt.textColor = MUTED;
  cnt.font = Font.systemFont(10);
  if (t.overdueCount > 0) {
    taskHead.addSpacer(6);
    const od = taskHead.addText(`⚠ ${t.overdueCount} overdue`);
    od.textColor = RED;
    od.font = Font.semiboldSystemFont(10);
  }
  w.addSpacer(3);
  const list = (t.today || []).slice(0, 3);
  if (list.length === 0) {
    const clear = w.addText("All clear ✨");
    clear.textColor = MUTED;
    clear.font = Font.systemFont(12);
  } else {
    for (const title of list) {
      const r = w.addText("○  " + title);
      r.textColor = Color.dynamic(new Color("#34332e"), new Color("#dcdbd2"));
      r.font = Font.systemFont(12);
      r.lineLimit = 1;
      w.addSpacer(2);
    }
  }

  // Next important date
  if (data.nextDate) {
    w.addSpacer(8);
    const nd = w.addText(`🎂 ${data.nextDate.title} · ${data.nextDate.days === 0 ? "today" : "in " + data.nextDate.days + "d"}`);
    nd.textColor = MUTED;
    nd.font = Font.systemFont(11);
    nd.lineLimit = 1;
  }

  w.refreshAfterDate = new Date(Date.now() + 30 * 60 * 1000); // refresh ~every 30 min
  return w;
}

const widget = await build();
if (config.runsInWidget) {
  Script.setWidget(widget);
} else {
  await widget.presentMedium();
}
Script.complete();
