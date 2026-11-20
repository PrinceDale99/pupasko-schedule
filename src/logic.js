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
