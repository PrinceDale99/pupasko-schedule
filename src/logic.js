export const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const DAY_NAME = {
  Mon: "Monday", Tue: "Tuesday", Wed: "Wednesday", Thu: "Thursday",
  Fri: "Friday", Sat: "Saturday", Sun: "Sunday",
};
export const DAY_START = 7 * 60;
export const DAY_END = 22 * 60;

export const toMin = (s) => {
  const [h, m] = s.split(":").map(Number);
  return h * 60 + m;
};

export const fmt = (min) => {
  let h = Math.floor(min / 60);
  const m = min % 60;
  const ap = h >= 12 && h < 24 ? "PM" : "AM";
  h = h % 12 || 12;
  return m ? `${h}:${String(m).padStart(2, "0")} ${ap}` : `${h} ${ap}`;
};

export const fmtDuration = (min) => {
  const h = Math.floor(min / 60), m = min % 60;
  if (!h) return `${m} min`;
  return m ? `${h} hr ${m} min` : `${h} hr${h > 1 ? "s" : ""}`;
};

const blocks = (p, day) =>
  (p.busy || [])
    .filter((b) => b[0] === day)
    .map(([, s, e, what, kind]) => ({ start: toMin(s), end: toMin(e), what, soft: kind === "soft" }))
    .sort((a, b) => a.start - b.start);

/** Merge touching hard blocks so "busy until" covers back-to-back classes. */
const busyUntil = (hard, from) => {
  let end = from;
  for (const b of hard) if (b.start <= end && b.end > end) end = b.end;
  return end;
};

/**
 * Where someone is at a moment.
 * state: "free" | "heads-up" | "busy"
 */
export function statusAt(p, day, min) {
  const all = blocks(p, day);
  const hard = all.filter((b) => !b.soft);
  const now = hard.find((b) => b.start <= min && b.end > min);
  const soft = all.find((b) => b.soft && b.start <= min && b.end > min);

  if (now) {
    const freeAt = busyUntil(hard, now.end);
    const next = hard.find((b) => b.start > freeAt) || laterDay(p, day);
    return { state: "busy", current: now, freeAt, next };
  }
  const next = hard.find((b) => b.start > min) || laterDay(p, day);
  return { state: soft ? "heads-up" : "free", soft, next };
}

/** First class on a following day, tagged with that day. */
function laterDay(p, day) {
  const i = DAYS.indexOf(day);
  for (let k = 1; k <= 7; k++) {
    const d = DAYS[(i + k) % 7];
    const first = blocks(p, d).find((b) => !b.soft);
    if (first) return { ...first, day: d };
  }
  return null;
}

/** Is someone free for the whole range [a, b)? */
export function freeFor(p, day, a, b) {
  return !blocks(p, day).some((x) => !x.soft && x.start < b && x.end > a);
}
export function softIn(p, day, a, b) {
  return blocks(p, day).find((x) => x.soft && x.start < b && x.end > a);
}

/** Windows of at least `minLen` minutes when everyone in `people` is free. */
export function commonWindows(people, minLen = 120, step = 30) {
  const out = [];
  if (!people.length) return out;
  for (const day of DAYS) {
    let start = null;
    for (let m = DAY_START; m <= DAY_END; m += step) {
      const ok = m < DAY_END && people.every((p) => freeFor(p, day, m, m + step));
      if (ok && start === null) start = m;
      if (!ok && start !== null) {
        if (m - start >= minLen) {
          const flagged = people.filter((p) => softIn(p, day, start, m));
          out.push({ day, start, end: m, flagged });
        }
        start = null;
      }
    }
  }
  return out;
}

export function freeCount(people, day, a, b) {
  return people.filter((p) => freeFor(p, day, a, b)).length;
}

export const initials = (name) =>
  name.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();

export function nowInfo(date = new Date()) {
  const day = DAYS[(date.getDay() + 6) % 7];
  const raw = date.getHours() * 60 + date.getMinutes();
  return { day, min: raw };
}

/* ---------- Auditions ----------
 * An hour is an audition hour when at least `minDirectors` directors are out
 * of class. On each day we pick the one continuous block of such hours that
 * the most actors can attend (shorter blocks win ties, so directors sit for
 * less time), then place every actor in an hour inside it when they're free.
 */
export const MIN_DIRECTORS = 3;
export const PER_HOUR = 6; // about 10 minutes per actor
export const AUDITION_START = 8 * 60;
export const AUDITION_END = 20 * 60;

function hourSlots(day, directors, actors, minDirectors) {
  const out = [];
  for (let start = AUDITION_START; start + 60 <= AUDITION_END; start += 60) {
    const end = start + 60;
    const dirs = directors.filter((p) => freeFor(p, day, start, end));
    out.push({
      day, start, end,
      directors: dirs,
      ok: dirs.length >= minDirectors,
      free: actors.filter((p) => freeFor(p, day, start, end)),
      flagged: [...dirs, ...actors].filter((p) => freeFor(p, day, start, end) && softIn(p, day, start, end)),
    });
  }
  return out;
}

/** Place actors in hours: fewest choices first, each into the emptiest hour with room. */
function place(window, actors) {
  const sessions = window.map((s) => ({ ...s, actors: [] }));
  const options = actors
    .map((p) => ({ p, hours: sessions.filter((s) => s.free.includes(p)) }))
    .filter((o) => o.hours.length)
    .sort((a, b) => a.hours.length - b.hours.length);
  const placed = new Set();
  for (const { p, hours } of options) {
    const room = hours.filter((s) => s.actors.length < PER_HOUR);
    if (!room.length) continue;
    room.reduce((a, b) => (b.actors.length < a.actors.length ? b : a)).actors.push(p);
    placed.add(p.name);
  }
  return { sessions, placed };
}

const flagCount = (sessions) => new Set(sessions.flatMap((s) => s.flagged.map((p) => p.name))).size;

export function auditionDay(day, directors, actors, minDirectors = MIN_DIRECTORS) {
  const slots = hourSlots(day, directors, actors, minDirectors);
  const okHours = slots.filter((s) => s.ok).length;

  // Every continuous block of audition hours; keep the one that seats the
  // most actors, then the shortest, then the fewest heads-ups, then the most directors.
  let best = null;
  for (let i = 0; i < slots.length; i++) {
    if (!slots[i].ok) continue;
    for (let j = i; j < slots.length && slots[j].ok; j++) {
      const window = slots.slice(i, j + 1);
      const { sessions, placed } = place(window, actors);
      const cand = {
        sessions, placed,
        len: j - i + 1,
        flags: flagCount(sessions),
        minDirs: Math.min(...window.map((s) => s.directors.length)),
      };
      const better =
        !best ||
        placed.size - best.placed.size ||
        best.len - cand.len ||
        best.flags - cand.flags ||
        cand.minDirs - best.minDirs;
      if (!best || better > 0) best = cand;
    }
  }
  if (!best) return { day, okHours, window: null, sessions: [], scheduled: 0, flags: 0, missing: actors };

  return {
    day,
    okHours,
    window: { start: best.sessions[0].start, end: best.sessions[best.sessions.length - 1].end },
    minDirectors: best.minDirs,
    sessions: best.sessions,
    scheduled: best.placed.size,
    flags: best.flags,
    missing: actors.filter((p) => !best.placed.has(p.name)),
  };
}

export function planAuditions(directors, actors, minDirectors = MIN_DIRECTORS) {
  const days = DAYS.map((d) => auditionDay(d, directors, actors, minDirectors));
  const len = (d) => (d.window ? d.window.end - d.window.start : 1e9);
  const ranked = [...days].sort(
    (a, b) =>
      b.scheduled - a.scheduled ||
      len(a) - len(b) ||
      a.flags - b.flags ||
      (b.minDirectors ?? 0) - (a.minDirectors ?? 0)
  );
  return { days, ranked, best: ranked[0]?.window ? ranked[0] : null };
}

/** Other days whose audition block this person could attend. */
export function otherDaysFor(person, plan, exceptDay) {
  return plan.days
    .filter((d) => d.day !== exceptDay && d.sessions.some((s) => s.free.includes(person)))
    .map((d) => d.day);
}
