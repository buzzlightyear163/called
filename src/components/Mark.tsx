// The CALLED mark: a receipt with a torn edge, and a check that landed. Drawn with theme colors.
export function Mark({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg data-mark className={className} width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <rect x="2" y="2" width="60" height="60" rx="15" style={{ fill: "var(--ink)" }} />
      <path d="M17 11h30v38l-3.75-3-3.75 3-3.75-3-3.75 3-3.75-3-3.75 3-3.75-3L17 49Z" style={{ fill: "var(--paper)" }} />
      <rect x="22" y="18" width="16" height="3.4" rx="1.2" style={{ fill: "var(--ink)" }} />
      <rect x="22" y="25" width="10" height="3.4" rx="1.2" style={{ fill: "var(--ink)", opacity: 0.45 }} />
      <circle cx="44.5" cy="43.5" r="12" style={{ fill: "var(--marker)", stroke: "var(--ink)", strokeWidth: 3 }} />
      <path d="M38.6 43.8l4.1 4 7.6-8.4" style={{ fill: "none", stroke: "var(--ink)", strokeWidth: 3.6, strokeLinecap: "round", strokeLinejoin: "round" }} />
    </svg>
  );
}

export function Wordmark({ size = 28 }: { size?: number }) {
  return (
    <span className="wordmark">
      <Mark size={size} />
      <span>CALLED</span>
    </span>
  );
}
