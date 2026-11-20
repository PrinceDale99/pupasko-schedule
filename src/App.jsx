import { memo, useCallback, useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Button, Glass, SegmentedControl, Slider, Switch, TabBar, SearchField } from "glisse";
import { PEOPLE, GROUPS } from "./data.js";
import {
  DAYS, DAY_NAME, DAY_START, DAY_END, fmt, fmtDuration, statusAt,
  commonWindows, freeCount, initials, nowInfo, toMin,
} from "./logic.js";
import { IconClock, IconCalendar, IconPeople, IconChevron, IconInfo } from "./icons.jsx";

/*
 * Performance notes
 * - glisse re-fits its refraction (and repaints the rim) every time a <Glass>
 *   renders. So live glass is used only where it matters (floating controls),
 *   and always as a memoized background layer that never re-renders when the
 *   content on top of it changes.
 * - Long lists use a cheap CSS material instead (no backdrop filter).
 * - The slider updates its own value at once; the lists follow through
 *   useDeferredValue so dragging never waits on them.
 */

/* ---------- hooks ---------- */

function useNow(tickMs = 30_000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), tickMs);
    return () => clearInterval(id);
  }, [tickMs]);
  return now;
}

/** Width of an element, so segmented controls can fill their row. */
function useWidth() {
  const ref = useRef(null);
  const [w, setW] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setW(Math.floor(el.getBoundingClientRect().width)));
    };
    setW(Math.floor(el.getBoundingClientRect().width));
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
    };
  }, []);
  return [ref, w];
}

const useMedia = (query) => {
  const [match, setMatch] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setMatch(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [query]);
  return match;
};

/* ---------- glass + surfaces ---------- */

/** Live liquid glass behind its siblings. Memoized: it renders once. */
const GlassLayer = memo(function GlassLayer() {
  return <Glass className="glass-layer" aria-hidden="true" />;
});

function GlassPanel({ className = "", children }) {
  return (
    <div className={`panel glassy ${className}`}>
      <GlassLayer />
      {children}
    </div>
  );
}

const Surface = ({ className = "", children }) => <div className={`surface ${className}`}>{children}</div>;

const FullSegmented = memo(function FullSegmented({ items, value, onValueChange, label }) {
  const [ref, w] = useWidth();
  const style = useMemo(() => ({ "--lg-tab-width": `${w / items.length}px` }), [w, items.length]);
  return (
    <div ref={ref} className="seg-wrap">
      {w > 0 && (
        <SegmentedControl aria-label={label} items={items} value={value} onValueChange={onValueChange} style={style} />
      )}
    </div>
  );
});

/* ---------- shared bits ---------- */

const GROUP_LABEL = { Directors: "Directors", Actors: "Actors", Writers: "Writers" };
const DAY_ITEMS = DAYS.map((d) => ({ value: d, label: d }));
const FILTER_ITEMS = [{ value: "All", label: "Everyone" }, ...GROUPS.map((g) => ({ value: g, label: GROUP_LABEL[g] }))];
const MEMBERS = Object.fromEntries(GROUPS.map((g) => [g, PEOPLE.filter((p) => p.group === g)]));

const Avatar = memo(function Avatar({ person }) {
  return (
    <span className="avatar" data-group={person.group} aria-hidden="true">
      {initials(person.name)}
    </span>
  );
});

function Section({ title, count, actions, footer, children }) {
  return (
    <section className="section">
      {title && (
        <h2 className="section-title">
          {title}
          {count != null && <span className="section-count">{count}</span>}
          {actions && <span className="section-actions">{actions}</span>}
        </h2>
      )}
      <Surface className="list">{children}</Surface>
      {footer && <p className="section-footer">{footer}</p>}
    </section>
  );
}

function Trailing({ top, main, sub }) {
  return (
    <div className="trailing">
      <span className="trailing-top">{top}</span>
      <span className="trailing-main">{main}</span>
      <span className="trailing-sub">{sub}</span>
    </div>
  );
}

function NextClass({ next }) {
  if (!next) return <Trailing top="Next class" main="None" sub="No classes this week" />;
  return (
    <Trailing top={`Next class · ${next.day ?? "Today"}`} main={fmt(next.start)} sub={next.what} />
  );
}

function Row({ person, dot, subtitle, note, trailing, onClick, children }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag className="row" onClick={onClick} type={onClick ? "button" : undefined}>
      <span className="avatar-wrap">
        <Avatar person={person} />
        {dot && <span className="dot" data-tone={dot} />}
      </span>
      <span className="row-body">
        <span className="row-title">{person.name}</span>
        <span className="row-sub">{subtitle ?? person.role}</span>
        {note && <span className="row-note">{note}</span>}
      </span>
      {trailing}
      {children}
    </Tag>
  );
}

/* ---------- Now ---------- */

function computeNow(day, min, filter) {
  const people = filter === "All" ? PEOPLE : MEMBERS[filter];
  const rows = people.map((p) => ({ p, s: statusAt(p, day, min) }));
  // Free the longest first: nothing later today goes to the top.
  const until = (r) => (!r.s.next ? 1e6 : r.s.next.day ? 1e5 : r.s.next.start);
  const byUntil = (a, b) => until(b) - until(a);
  const free = rows.filter((r) => r.s.state === "free").sort(byUntil);
  const heads = rows.filter((r) => r.s.state === "heads-up").sort(byUntil);
  const busy = rows.filter((r) => r.s.state === "busy").sort((a, b) => a.s.freeAt - b.s.freeAt);
  return { count: people.length, available: [...free, ...heads], heads: heads.length, busy };
}

const NowLists = memo(function NowLists({ day, min, filter, stale }) {
  const { count, available, heads, busy } = useMemo(() => computeNow(day, min, filter), [day, min, filter]);
  return (
    <div className="now-lists" data-stale={stale || undefined}>
      <div className="stats">
        <Stat n={available.length} label="Available" tone="green" />
        <Stat n={busy.length} label="In class" tone="red" />
        <Stat n={heads} label="Heads-up" tone="orange" />
      </div>

      {available.length > 0 && (
        <Section title="Available" count={available.length}>
          {available.map(({ p, s }) => (
            <Row
              key={p.name}
              person={p}
              dot={s.state === "free" ? "green" : "orange"}
              note={s.soft?.what}
              trailing={<NextClass next={s.next} />}
            />
          ))}
        </Section>
      )}

      {busy.length > 0 && (
        <Section title="In class" count={busy.length}>
          {busy.map(({ p, s }) => (
            <Row
              key={p.name}
              person={p}
              dot="red"
              subtitle={`${s.current.what} · until ${fmt(s.freeAt)}`}
              trailing={<NextClass next={s.next} />}
            />
          ))}
        </Section>
      )}

      {!count && <p className="empty">No one in this group.</p>}
    </div>
  );
});

function Stat({ n, label, tone }) {
  return (
    <Surface className="stat">
      <span className="stat-n" data-tone={tone}>{n}</span>
      <span className="stat-l">{label}</span>
    </Surface>
  );
}

function NowView({ selection, setSelection }) {
  const now = useNow();
  const live = nowInfo(now);
  const { day, min, isLive } = selection.isLive ? { day: live.day, min: live.min, isLive: true } : selection;
  const [filter, setFilter] = useState("All");

  // The header and slider follow your finger; the lists catch up.
  const deferred = useDeferredValue({ day, min, filter });
  const stale = deferred.day !== day || deferred.min !== min || deferred.filter !== filter;

  const minRef = useRef(min);
  minRef.current = min;
  const dayRef = useRef(day);
  dayRef.current = day;
  const onDay = useCallback((d) => setSelection({ isLive: false, day: d, min: minRef.current }), [setSelection]);
  const onMin = useCallback((m) => setSelection({ isLive: false, day: dayRef.current, min: m }), [setSelection]);

  return (
    <div className="split">
      <aside className="side">
        <header className="large-header">
          <p className="eyebrow">{isLive ? "Right now" : "Checking"}</p>
          <h1>
            {DAY_NAME[day]}, <span className="nowrap">{fmt(min)}</span>
          </h1>
          <div className="live-slot">
            {!isLive && (
              <Button icon={<IconClock />} onClick={() => setSelection({ isLive: true })}>
                Back to now
              </Button>
            )}
          </div>
        </header>

        <GlassPanel className="controls">
          <FullSegmented label="Day" items={DAY_ITEMS} value={day} onValueChange={onDay} />
          <div className="time-row">
            <span className="time-bound">{fmt(DAY_START)}</span>
            <Slider
              aria-label="Time of day"
              min={DAY_START}
              max={DAY_END}
              step={15}
              value={Math.min(Math.max(min, DAY_START), DAY_END)}
              onValueChange={onMin}
            />
            <span className="time-bound">{fmt(DAY_END)}</span>
          </div>
          <FullSegmented label="Filter by role" items={FILTER_ITEMS} value={filter} onValueChange={setFilter} />
        </GlassPanel>
      </aside>

      <div className="main">
        <NowLists day={deferred.day} min={deferred.min} filter={deferred.filter} stale={stale} />
      </div>
    </div>
  );
}

/* ---------- Plan ---------- */

const Windows = memo(function Windows({ selected, minLen, goTo }) {
  const windows = useMemo(() => commonWindows(selected, minLen), [selected, minLen]);
  return (
    <Section
      title="Times that work"
      count={selected.length ? windows.length : null}
      footer={selected.length ? `When all ${selected.length} people you picked are out of class. Tap a time to open it.` : null}
    >
      {!selected.length && <p className="list-empty">Turn on the people you need.</p>}
      {selected.length > 0 && !windows.length && (
        <p className="list-empty">No {fmtDuration(minLen)} window works for everyone. Try a shorter shoot or fewer people.</p>
      )}
      {windows.map((w) => (
        <button key={w.day + w.start} type="button" className="row window" onClick={() => goTo(w.day, w.start)}>
          <span className="day-badge">{w.day}</span>
          <span className="row-body">
            <span className="row-title">{fmt(w.start)} – {fmt(w.end)}</span>
            <span className="row-sub">{DAY_NAME[w.day]} · {fmtDuration(w.end - w.start)}</span>
            {w.flagged.length > 0 && (
              <span className="row-note">Heads-up: {w.flagged.map((p) => p.name.split(" ")[0]).join(", ")}</span>
            )}
          </span>
          <IconChevron className="chev" />
        </button>
      ))}
    </Section>
  );
});

const SLOTS = Array.from({ length: (DAY_END - DAY_START) / 60 }, (_, i) => DAY_START + i * 60);

const WeekGrid = memo(function WeekGrid({ selected, goTo }) {
  const n = selected.length;
  const cells = useMemo(
    () =>
      SLOTS.map((m) =>
        DAYS.map((d) => {
          const f = freeCount(selected, d, m, m + 60);
          const r = f / n;
          return { d, m, f, level: r === 1 ? 4 : r >= 0.75 ? 3 : r >= 0.45 ? 2 : 1 };
        })
      ),
    [selected, n]
  );
  if (!n) return null;
  return (
    <section className="section">
      <h2 className="section-title">Week at a glance</h2>
      <Surface className="panel grid-panel">
        <div className="week">
          <span />
          {DAYS.map((d) => <span key={d} className="week-head">{d}</span>)}
          {cells.map((row, i) => (
            <WeekRowCells key={SLOTS[i]} m={SLOTS[i]} row={row} n={n} goTo={goTo} />
          ))}
        </div>
        <div className="legend">
          <span><i data-l="4" /> Everyone</span>
          <span><i data-l="3" /> Most</span>
          <span><i data-l="2" /> Half</span>
          <span><i data-l="1" /> Few</span>
        </div>
      </Surface>
    </section>
  );
});

function WeekRowCells({ m, row, n, goTo }) {
  return (
    <>
      <span className="week-time">{fmt(m)}</span>
      {row.map(({ d, f, level }) => (
        <button
          key={d}
          type="button"
          className="cell"
          data-l={level}
          aria-label={`${DAY_NAME[d]} ${fmt(m)}: ${f} of ${n} free`}
          title={`${DAY_NAME[d]} ${fmt(m)}: ${f} of ${n} free`}
          onClick={() => goTo(d, m)}
        >
          {level === 4 ? "" : f}
        </button>
      ))}
    </>
  );
}

const PersonToggle = memo(function PersonToggle({ person, on, onToggle }) {
  return (
    <label className="row">
      <span className="avatar-wrap"><Avatar person={person} /></span>
      <span className="row-body">
        <span className="row-title">{person.name}</span>
        <span className="row-sub">{person.role}</span>
      </span>
      <Switch aria-label={`Need ${person.name}`} checked={on} onCheckedChange={(c) => onToggle(person.name, c)} />
    </label>
  );
});

function PlanView({ needed, setNeeded, goTo }) {
  const [minLen, setMinLen] = useState(120);
  const deferredLen = useDeferredValue(minLen);
  const deferredNeeded = useDeferredValue(needed);
  const selected = useMemo(() => PEOPLE.filter((p) => deferredNeeded.has(p.name)), [deferredNeeded]);

  const toggle = useCallback(
    (name, on) =>
      setNeeded((prev) => {
        const next = new Set(prev);
        on ? next.add(name) : next.delete(name);
        return next;
      }),
    [setNeeded]
  );
  const setGroup = (g, on) =>
    setNeeded((prev) => {
      const next = new Set(prev);
      MEMBERS[g].forEach((p) => (on ? next.add(p.name) : next.delete(p.name)));
      return next;
    });

  return (
    <div className="split">
      <aside className="side">
        <header className="large-header">
          <p className="eyebrow">Plan a shoot</p>
          <h1>Find a time</h1>
        </header>

        <GlassPanel>
          <div className="panel-row">
            <span className="panel-label">Shoot length</span>
            <span className="panel-value">At least {fmtDuration(minLen)}</span>
          </div>
          <Slider aria-label="Minimum shoot length" min={60} max={360} step={30} value={minLen} onValueChange={setMinLen} />
        </GlassPanel>

        <div className="people-picker">
          {GROUPS.map((g) => {
            const members = MEMBERS[g];
            const on = members.filter((p) => needed.has(p.name)).length;
            return (
              <Section
                key={g}
                title={GROUP_LABEL[g]}
                count={`${on}/${members.length}`}
                actions={
                  <>
                    <button type="button" className="text-btn" onClick={() => setGroup(g, true)}>All</button>
                    <button type="button" className="text-btn" onClick={() => setGroup(g, false)}>None</button>
                  </>
                }
              >
                {members.map((p) => (
                  <PersonToggle key={p.name} person={p} on={needed.has(p.name)} onToggle={toggle} />
                ))}
              </Section>
            );
          })}
        </div>
      </aside>

      <div className="main">
        <Windows selected={selected} minLen={deferredLen} goTo={goTo} />
        <WeekGrid selected={selected} goTo={goTo} />
      </div>
    </div>
  );
}

/* ---------- Team ---------- */

function TeamView() {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(null);
  const query = useDeferredValue(q.trim().toLowerCase());
  const match = (p) => !query || (p.name + " " + p.role + " " + (p.section || "")).toLowerCase().includes(query);
  const groups = GROUPS.map((g) => ({ g, members: MEMBERS[g].filter(match) })).filter((x) => x.members.length);

  return (
    <>
      <header className="large-header team-header">
        <div>
          <p className="eyebrow">{PEOPLE.length} people</p>
          <h1>Team</h1>
        </div>
        <div className="search">
          <SearchField value={q} onValueChange={setQ} aria-label="Search team" />
        </div>
      </header>
      <div className="team-grid">
        {groups.map(({ g, members }) => (
          <Section key={g} title={GROUP_LABEL[g]} count={members.length}>
            {members.map((p) => (
              <div key={p.name} className="person-block">
                <Row
                  person={p}
                  subtitle={[p.role, p.section].filter(Boolean).join(" · ")}
                  onClick={() => setOpen(open === p.name ? null : p.name)}
                >
                  <IconChevron className="chev" data-open={open === p.name || undefined} />
                </Row>
                {open === p.name && <Schedule person={p} />}
              </div>
            ))}
          </Section>
        ))}
        {!groups.length && <p className="empty">No one matches “{q}”.</p>}
      </div>
    </>
  );
}

function Schedule({ person }) {
  return (
    <div className="schedule">
      {person.note && (
        <p className="schedule-note">
          <IconInfo /> {person.note}
        </p>
      )}
      {DAYS.map((d) => {
        const items = (person.busy || []).filter((b) => b[0] === d).sort((a, b) => toMin(a[1]) - toMin(b[1]));
        return (
          <div key={d} className="sched-day">
            <span className="sched-d">{d}</span>
            <div className="sched-items">
              {items.length ? (
                items.map(([, s, e, what, kind]) => (
                  <span key={s + what} className="sched-item" data-soft={kind === "soft" || undefined}>
                    <span className="sched-time">{fmt(toMin(s))} – {fmt(toMin(e))}</span>
                    <span className="sched-what">{what}</span>
                  </span>
                ))
              ) : (
                <span className="sched-free">No classes</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ---------- App ---------- */

const TABS = [
  { value: "now", label: "Now", icon: <IconClock /> },
  { value: "plan", label: "Plan", icon: <IconCalendar /> },
  { value: "team", label: "Team", icon: <IconPeople /> },
];

const Tabs = memo(function Tabs({ tab, setTab }) {
  return (
    <nav className="tabbar">
      <TabBar aria-label="Sections" value={tab} onValueChange={setTab} items={TABS} />
    </nav>
  );
});

export default function App() {
  const [tab, setTab] = useState("now");
  const [selection, setSelection] = useState({ isLive: true });
  const [needed, setNeeded] = useState(() => new Set(PEOPLE.map((p) => p.name)));
  const reduceMotion = useMedia("(prefers-reduced-motion: reduce)");

  const goTo = useCallback(
    (day, min) => {
      setSelection({ isLive: false, day, min });
      setTab("now");
      window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
    },
    [reduceMotion]
  );

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [tab]);

  return (
    <>
      <div className="wallpaper" aria-hidden="true" />
      <main className="page" data-tab={tab}>
        {tab === "now" && <NowView selection={selection} setSelection={setSelection} />}
        {tab === "plan" && <PlanView needed={needed} setNeeded={setNeeded} goTo={goTo} />}
        {tab === "team" && <TeamView />}
      </main>
      <Tabs tab={tab} setTab={setTab} />
    </>
  );
}
