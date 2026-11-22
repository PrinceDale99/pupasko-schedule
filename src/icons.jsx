// Line icons drawn to sit beside SF Symbols: 24px grid, round caps.
const base = {
  width: 24, height: 24, viewBox: "0 0 24 24", fill: "none",
  stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round",
  "aria-hidden": true,
};

export const IconClock = (p) => (
  <svg {...base} {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
);

export const IconCalendar = (p) => (
  <svg {...base} {...p}>
    <rect x="3.5" y="5" width="17" height="15.5" rx="3.5" />
    <path d="M3.5 10h17M8 3v4M16 3v4" />
    <path d="M8 14h2M14 14h2M8 17h2" />
  </svg>
);

export const IconPeople = (p) => (
  <svg {...base} {...p}>
    <circle cx="9" cy="8.5" r="3.5" />
    <path d="M2.5 19.5c.8-3.3 3.4-5 6.5-5s5.7 1.7 6.5 5" />
    <path d="M16 5.2a3.3 3.3 0 0 1 0 6.6M18 14.8c1.8.7 3 2.3 3.5 4.7" />
  </svg>
);

export const IconChevron = (p) => (
  <svg {...base} strokeWidth={2.2} {...p}>
    <path d="M9.5 6l6 6-6 6" />
  </svg>
);

export const IconInfo = (p) => (
  <svg {...base} {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5.5M12 7.6v.1" />
  </svg>
);

export const IconClapper = (p) => (
  <svg {...base} {...p}>
    <path d="M4 10h16v8.5a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 18.5z" />
    <path d="M3.6 9.6l-.5-2.4a1.5 1.5 0 0 1 1.2-1.8l13.3-2.6a1.5 1.5 0 0 1 1.8 1.2l.5 2.4z" />
    <path d="M8.2 4.7l2.3 3.1M13.1 3.7l2.3 3.1" />
  </svg>
);

export const IconSparkle = (p) => (
  <svg {...base} {...p}>
    <path d="M12 3.5l1.9 4.9 4.9 1.9-4.9 1.9-1.9 4.9-1.9-4.9-4.9-1.9 4.9-1.9z" />
    <path d="M18.5 15.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z" />
  </svg>
);

export const IconCheck = (p) => (
  <svg {...base} strokeWidth={2.4} {...p}>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
);
