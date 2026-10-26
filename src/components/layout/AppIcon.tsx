/** The app icon (same artwork as public/favicon.svg). */
export function AppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 512 512" className={className} aria-hidden focusable="false">
      <rect width="512" height="512" rx="112" fill="#1f4d42" />
      <rect x="104" y="124" width="304" height="280" rx="44" fill="#f7f5f0" />
      <path d="M104 168a44 44 0 0 1 44-44h216a44 44 0 0 1 44 44v28H104z" fill="#c2703d" />
      <rect x="166" y="92" width="32" height="74" rx="16" fill="#f7f5f0" stroke="#1f4d42" strokeWidth="12" />
      <rect x="314" y="92" width="32" height="74" rx="16" fill="#f7f5f0" stroke="#1f4d42" strokeWidth="12" />
      <path
        d="M256.0 230.0 L274.2 274.9 L322.6 278.4 L285.5 309.6 L297.1 356.6 L256.0 331.0 L214.9 356.6 L226.5 309.6 L189.4 278.4 L237.8 274.9Z"
        fill="#c2703d"
        stroke="#c2703d"
        strokeWidth="14"
        strokeLinejoin="round"
      />
    </svg>
  );
}
