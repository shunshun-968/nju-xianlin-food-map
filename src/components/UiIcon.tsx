import type { ReactNode } from 'react';

export type UiIconName =
  | 'map'
  | 'pin'
  | 'search'
  | 'arrow-right'
  | 'arrow-up-right'
  | 'arrow-left'
  | 'building'
  | 'cart'
  | 'layers'
  | 'plus'
  | 'minus'
  | 'reset'
  | 'rotate'
  | 'close'
  | 'info'
  | 'sparkles'
  | 'image'
  | 'star'
  | 'eye'
  | 'eye-off'
  | 'chevron-right';

const paths: Record<UiIconName, ReactNode> = {
  map: (
    <>
      <path d="m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2Z" />
      <path d="M9 3v16M15 5v16" />
    </>
  ),
  pin: (
    <>
      <path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z" />
      <circle cx="12" cy="10" r="2.5" />
    </>
  ),
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m16 16 4.5 4.5" />
    </>
  ),
  'arrow-right': <path d="M4 12h16m-6-6 6 6-6 6" />,
  'arrow-up-right': <path d="M6 18 18 6M6 6h12v12" />,
  'arrow-left': <path d="M20 12H4m6-6-6 6 6 6" />,
  building: (
    <>
      <path d="M4 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16M16 9h3a1 1 0 0 1 1 1v11M3 21h18M8 21v-5h4v5" />
      <path d="M8 7h.01M12 7h.01M8 11h.01M12 11h.01" strokeWidth="2.6" />
    </>
  ),
  cart: (
    <>
      <path d="M4 10h16l-2-6H6Zm1 0v9h14v-9M9 10v5h10M3 19h18" />
      <path d="M8 4v6M12 4v6M16 4v6" />
      <circle cx="7" cy="21" r="1" />
      <circle cx="17" cy="21" r="1" />
    </>
  ),
  layers: (
    <>
      <path d="m12 3 9 5-9 5-9-5Z" />
      <path d="m3 12 9 5 9-5M3 16l9 5 9-5" />
    </>
  ),
  plus: <path d="M5 12h14M12 5v14" />,
  minus: <path d="M5 12h14" />,
  reset: (
    <>
      <path d="M3 10a9 9 0 1 1 1.7 7.5M3 4v6h6" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  rotate: (
    <>
      <path d="M20 7a8.5 8.5 0 0 0-14-2L3 8m0-5v5h5M4 17a8.5 8.5 0 0 0 14 2l3-3m0 5v-5h-5" />
    </>
  ),
  close: <path d="m6 6 12 12M18 6 6 18" />,
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v6M12 7h.01" />
    </>
  ),
  sparkles: (
    <>
      <path d="m10 3 2.3 6.7L19 12l-6.7 2.3L10 21l-2.3-6.7L1 12l6.7-2.3Z" />
      <path d="M19 2v6M16 5h6M21 16v4M19 18h4" />
    </>
  ),
  image: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <circle cx="8" cy="8" r="1.5" />
      <path d="m3 17 5-5 4 4 4-6 5 7" />
    </>
  ),
  star: <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-2.9-5.6 2.9 1.1-6.2L3 9.6l6.2-.9Z" />,
  eye: (
    <>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  'eye-off': (
    <>
      <path d="m3 3 18 18M10.6 5.1A10.7 10.7 0 0 1 12 5c6.5 0 10 7 10 7a18.3 18.3 0 0 1-3.1 4M6.1 6.1A19 19 0 0 0 2 12s3.5 7 10 7a11.9 11.9 0 0 0 5.1-1.2M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    </>
  ),
  'chevron-right': <path d="m9 5 7 7-7 7" />,
};

export function UiIcon({
  name,
  size = 20,
  className,
}: {
  name: UiIconName;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className ? `ui-icon ${className}` : 'ui-icon'}
    >
      {paths[name]}
    </svg>
  );
}
