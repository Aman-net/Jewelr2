/** Jewelr gem mark — matches public/favicon.svg. */
export function GemMark({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <linearGradient id="jewelr-gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fbbf24" />
          <stop offset="0.55" stopColor="#d97706" />
          <stop offset="1" stopColor="#92400e" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="14" fill="#1c1917" />
      <g stroke="#1c1917" strokeWidth="1.5" strokeLinejoin="round">
        <path d="M20 16h24l8 10-20 24L12 26z" fill="url(#jewelr-gold)" />
        <path d="M12 26h40M20 16l6 10 6-10 6 10 6-10M26 26l6 24 6-24" fill="none" stroke="#78350f" strokeWidth="1.2" />
      </g>
    </svg>
  );
}
