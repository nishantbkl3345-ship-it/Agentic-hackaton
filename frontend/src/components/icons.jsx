const base = {
  width: 20,
  height: 20,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
}

export function ChatIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M4 5h16v11H8l-4 4V5z" />
    </svg>
  )
}

export function FileIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M6 3h8l4 4v14H6V3z" />
      <path d="M14 3v4h4" />
    </svg>
  )
}

export function ToolIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M14.7 6.3a4 4 0 0 1-5.4 5.4L4 17l3 3 5.3-5.3a4 4 0 0 1 5.4-5.4l-2.4 2.4-2-2 2.4-2.4z" />
    </svg>
  )
}

export function ShieldIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z" />
    </svg>
  )
}

export function WarningIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M12 4l9 16H3L12 4z" />
      <path d="M12 10v4" />
      <circle cx="12" cy="17" r="0.6" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function LockIcon(props) {
  return (
    <svg {...base} {...props}>
      <rect x="5" y="11" width="14" height="9" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  )
}

export function CheckIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M4 12l5 5L20 6" />
    </svg>
  )
}

export function ArrowIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M4 12h16" />
      <path d="M14 6l6 6-6 6" />
    </svg>
  )
}

export function BotIcon(props) {
  return (
    <svg {...base} {...props}>
      <rect x="5" y="8" width="14" height="11" />
      <path d="M12 8V4" />
      <circle cx="12" cy="3" r="1" fill="currentColor" stroke="none" />
      <circle cx="9" cy="13" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="15" cy="13" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function FlagIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M5 3v18" />
      <path d="M5 4h13l-3 4 3 4H5" />
    </svg>
  )
}

export function TargetIcon(props) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

export function SwordIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M4 20l6-6" />
      <path d="M8.5 15.5l-3-3 7-7 3 3z" />
      <path d="M20 4l-6 6" />
      <path d="M15.5 8.5l3 3-7 7-3-3z" />
    </svg>
  )
}

export function TrophyIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M7 4h10v5a5 5 0 0 1-10 0V4z" />
      <path d="M7 5H4v2a3 3 0 0 0 3 3" />
      <path d="M17 5h3v2a3 3 0 0 1-3 3" />
      <path d="M12 14v3" />
      <path d="M9 20h6" />
      <path d="M9.5 17h5l.5 3H9z" />
    </svg>
  )
}

export function UserIcon(props) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="8" r="3.2" />
      <path d="M5 20c0-3.9 3.1-7 7-7s7 3.1 7 7" />
    </svg>
  )
}

export function GridIcon(props) {
  return (
    <svg {...base} {...props}>
      <rect x="3" y="3" width="8" height="8" rx="1.5" />
      <rect x="13" y="3" width="8" height="5" rx="1.5" />
      <rect x="13" y="10" width="8" height="11" rx="1.5" />
      <rect x="3" y="13" width="8" height="8" rx="1.5" />
    </svg>
  )
}
