import type { ReactNode } from 'react';

function Svg({ children, size = 18 }: { children: ReactNode; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

export const FilterIcon = ({ size }: { size?: number }) => (
  <Svg size={size}>
    <path d="M3 5h18M6 12h12M10 19h4" />
  </Svg>
);
export const MinusIcon = ({ size }: { size?: number }) => (
  <Svg size={size}>
    <path d="M5 12h14" />
  </Svg>
);
export const PlusIcon = ({ size }: { size?: number }) => (
  <Svg size={size}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
);
export const PlayIcon = ({ size }: { size?: number }) => (
  <Svg size={size}>
    <path d="M8 5v14l11-7z" fill="currentColor" />
  </Svg>
);
