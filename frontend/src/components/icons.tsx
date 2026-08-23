/** Inline SVG icons. no icon library, so nothing to load at runtime. */

type IconProps = React.SVGProps<SVGSVGElement>;

const base = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  viewBox: "0 0 24 24",
};

export function WaterDrop({ filled = false, ...props }: IconProps & { filled?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={filled ? 0 : 1.75}
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      <path d="M12 2.5c3.9 4.4 6.5 7.8 6.5 11a6.5 6.5 0 1 1-13 0c0-3.2 2.6-6.6 6.5-11Z" />
      {filled && (
        <path
          d="M9.3 13.4a3.2 3.2 0 0 0 2.5 3.9"
          fill="none"
          stroke="#fff"
          strokeWidth={1.6}
          strokeLinecap="round"
          opacity={0.85}
        />
      )}
    </svg>
  );
}

export function Cart(props: IconProps) {
  return (
    <svg {...base} aria-hidden {...props}>
      <path d="M2.5 3h2l2.2 11.2a1.8 1.8 0 0 0 1.8 1.4h8.6a1.8 1.8 0 0 0 1.8-1.4L20.5 7H6" />
      <circle cx="9.5" cy="19.5" r="1.4" />
      <circle cx="17" cy="19.5" r="1.4" />
    </svg>
  );
}

export function UserIcon(props: IconProps) {
  return (
    <svg {...base} aria-hidden {...props}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M4.5 20a7.5 7.5 0 0 1 15 0" />
    </svg>
  );
}

export function Truck(props: IconProps) {
  return (
    <svg {...base} aria-hidden {...props}>
      <path d="M2.5 6.5h10.5v9H2.5z" />
      <path d="M13 9.5h4l3 3v3h-7z" />
      <circle cx="6.5" cy="17.5" r="1.8" />
      <circle cx="17" cy="17.5" r="1.8" />
    </svg>
  );
}

export function Bottle(props: IconProps) {
  return (
    <svg {...base} aria-hidden {...props}>
      <path d="M10 2.5h4v2.2l1.6 2.4a4 4 0 0 1 .65 2.2v9.2a2.5 2.5 0 0 1-2.5 2.5h-3.5a2.5 2.5 0 0 1-2.5-2.5V9.3a4 4 0 0 1 .65-2.2L10 4.7Z" />
      <path d="M7.75 12.5h8.5" />
    </svg>
  );
}

export function Jar(props: IconProps) {
  return (
    <svg {...base} aria-hidden {...props}>
      <path d="M8 2.5h8v2.8l1.5 2v13a1.7 1.7 0 0 1-1.7 1.7H8.2a1.7 1.7 0 0 1-1.7-1.7v-13l1.5-2Z" />
      <path d="M6.5 11.5c2 1.2 3.5 1.2 5.5 0s3.5-1.2 5.5 0" />
    </svg>
  );
}

export function Camper(props: IconProps) {
  return (
    <svg {...base} aria-hidden {...props}>
      <path d="M6 4.5h12l-1.2 14a2 2 0 0 1-2 1.8H9.2a2 2 0 0 1-2-1.8Z" />
      <path d="M9.5 4.5V2.5h5v2" />
      <path d="M18 11.5h2.5v3H18" />
    </svg>
  );
}

export function MapPin(props: IconProps) {
  return (
    <svg {...base} aria-hidden {...props}>
      <path d="M12 21.5s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Z" />
      <circle cx="12" cy="10.5" r="2.6" />
    </svg>
  );
}

export function Clock(props: IconProps) {
  return (
    <svg {...base} aria-hidden {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5.2l3.2 2" />
    </svg>
  );
}

export function Shield(props: IconProps) {
  return (
    <svg {...base} aria-hidden {...props}>
      <path d="M12 2.8 4.8 5.6v5.9c0 4.6 3 8.1 7.2 9.7 4.2-1.6 7.2-5.1 7.2-9.7V5.6Z" />
      <path d="m9 12 2.2 2.2L15.4 10" />
    </svg>
  );
}

export function Star({ filled = false, ...props }: IconProps & { filled?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={filled ? 0 : 1.6}
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      <path d="m12 3.2 2.7 5.5 6.1.9-4.4 4.3 1 6-5.4-2.9-5.4 2.9 1-6L3.2 9.6l6.1-.9Z" />
    </svg>
  );
}

export function Phone(props: IconProps) {
  return (
    <svg {...base} aria-hidden {...props}>
      <path d="M5 3.5h3.2l1.6 4-2 1.4a11.5 11.5 0 0 0 5.3 5.3l1.4-2 4 1.6V17a2.5 2.5 0 0 1-2.7 2.5A15.5 15.5 0 0 1 2.5 6.2 2.5 2.5 0 0 1 5 3.5Z" />
    </svg>
  );
}

export function Building(props: IconProps) {
  return (
    <svg {...base} aria-hidden {...props}>
      <path d="M3.5 20.5h17" />
      <path d="M5.5 20.5V9.5L12 5.5l6.5 4v11" />
      <path d="M9.5 20.5v-4h5v4" />
      <path d="M9.5 12h1.5M13 12h1.5" />
    </svg>
  );
}

export function Calendar(props: IconProps) {
  return (
    <svg {...base} aria-hidden {...props}>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
      <path d="M3.5 9.5h17M8 3.5V6.5M16 3.5V6.5" />
    </svg>
  );
}

export function Chart(props: IconProps) {
  return (
    <svg {...base} aria-hidden {...props}>
      <path d="M3.5 20.5h17" />
      <path d="M7 20.5v-6M12 20.5V6M17 20.5v-9" />
    </svg>
  );
}

export function Search(props: IconProps) {
  return (
    <svg {...base} aria-hidden {...props}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4.5 4.5" />
    </svg>
  );
}

export function Check(props: IconProps) {
  return (
    <svg {...base} aria-hidden {...props}>
      <path d="m4.5 12.5 5 5 10-11" />
    </svg>
  );
}

export function ChevronRight(props: IconProps) {
  return (
    <svg {...base} aria-hidden {...props}>
      <path d="m9 5.5 6.5 6.5L9 18.5" />
    </svg>
  );
}

export function Plus(props: IconProps) {
  return (
    <svg {...base} aria-hidden {...props}>
      <path d="M12 5.5v13M5.5 12h13" />
    </svg>
  );
}

export function Minus(props: IconProps) {
  return (
    <svg {...base} aria-hidden {...props}>
      <path d="M5.5 12h13" />
    </svg>
  );
}

export function Trash(props: IconProps) {
  return (
    <svg {...base} aria-hidden {...props}>
      <path d="M4 6.5h16M9.5 6.5V4.2A1.2 1.2 0 0 1 10.7 3h2.6a1.2 1.2 0 0 1 1.2 1.2V6.5" />
      <path d="M6.5 6.5 7.4 20a1.5 1.5 0 0 0 1.5 1.4h6.2a1.5 1.5 0 0 0 1.5-1.4l.9-13.5" />
    </svg>
  );
}

export function Menu(props: IconProps) {
  return (
    <svg {...base} aria-hidden {...props}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

export function Close(props: IconProps) {
  return (
    <svg {...base} aria-hidden {...props}>
      <path d="m6 6 12 12M18 6 6 18" />
    </svg>
  );
}

export function Repeat(props: IconProps) {
  return (
    <svg {...base} aria-hidden {...props}>
      <path d="M4 9.5A4.5 4.5 0 0 1 8.5 5H19m0 0-3-3m3 3-3 3" />
      <path d="M20 14.5A4.5 4.5 0 0 1 15.5 19H5m0 0 3 3m-3-3 3-3" />
    </svg>
  );
}
