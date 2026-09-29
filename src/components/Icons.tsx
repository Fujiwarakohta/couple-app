import type { ReactNode } from 'react'

/** 装飾用のアイコン。意味は隣の文字か aria-label で伝えるので aria-hidden にしている。 */
function Svg({ children, size = 24 }: { children: ReactNode; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  )
}

interface IconProps {
  size?: number
}

export const HomeIcon = ({ size }: IconProps) => (
  <Svg size={size}>
    <path d="M3 11l9-8 9 8" />
    <path d="M5 10v10h14V10" />
  </Svg>
)

export const CalendarIcon = ({ size }: IconProps) => (
  <Svg size={size}>
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <path d="M3 10h18M8 3v4M16 3v4" />
  </Svg>
)

export const CheckListIcon = ({ size }: IconProps) => (
  <Svg size={size}>
    <path d="M4 6l2 2 3-3M4 13l2 2 3-3M4 20l2 2 3-3" transform="translate(0 -2)" />
    <path d="M13 6h8M13 12h8M13 18h8" />
  </Svg>
)

export const BulbIcon = ({ size }: IconProps) => (
  <Svg size={size}>
    <path d="M9 18h6M10 21h4" />
    <path d="M12 3a6 6 0 0 0-4 10.5c.8.8 1 1.5 1 2.5h6c0-1 .2-1.7 1-2.5A6 6 0 0 0 12 3z" />
  </Svg>
)

export const ChartIcon = ({ size }: IconProps) => (
  <Svg size={size}>
    <path d="M4 20V4M4 20h16" />
    <path d="M7 15l4-4 3 3 5-6" />
  </Svg>
)

export const GearIcon = ({ size }: IconProps) => (
  <Svg size={size}>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" />
  </Svg>
)

export const PlusIcon = ({ size }: IconProps) => (
  <Svg size={size}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
)

export const CheckIcon = ({ size }: IconProps) => (
  <Svg size={size}>
    <path d="M5 12l5 5 9-10" />
  </Svg>
)

export const CloseIcon = ({ size }: IconProps) => (
  <Svg size={size}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Svg>
)

export const ChevronLeftIcon = ({ size }: IconProps) => (
  <Svg size={size}>
    <path d="M15 5l-7 7 7 7" />
  </Svg>
)

export const ChevronRightIcon = ({ size }: IconProps) => (
  <Svg size={size}>
    <path d="M9 5l7 7-7 7" />
  </Svg>
)

export const PhoneIcon = ({ size }: IconProps) => (
  <Svg size={size}>
    <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" />
  </Svg>
)

export const PinIcon = ({ size }: IconProps) => (
  <Svg size={size}>
    <path d="M12 17v5M8 3h8l-1 6 3 4H6l3-4-1-6z" />
  </Svg>
)

export const PartnerIcon = ({ size }: IconProps) => (
  <Svg size={size}>
    <circle cx="8" cy="8" r="3" />
    <circle cx="17" cy="9" r="2.5" />
    <path d="M2 20c0-3.5 2.7-6 6-6s6 2.5 6 6M15 14.5c3.5-.5 7 1.5 7 5.5" />
  </Svg>
)

export const ClockIcon = ({ size }: IconProps) => (
  <Svg size={size}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </Svg>
)

export const AlertIcon = ({ size }: IconProps) => (
  <Svg size={size}>
    <path d="M12 3l10 18H2L12 3z" />
    <path d="M12 10v5M12 18v.5" />
  </Svg>
)
