import { useId } from "react";

/**
 * Astraxis mark: a droplet inside the spherical flame it makes in microgravity,
 * crossed by a tilted axis ("astra" + "axis"). The axis breaks around the flame.
 */
export function LogoMark({ size = 32, className = "" }: { size?: number; className?: string }) {
  // unique gradient ids: a hidden copy of the logo (e.g. desktop sidebar on phones) would otherwise break the visible one
  const uid = useId().replace(/:/g, "");
  const glow = `ax-glow-${uid}`, ring = `ax-ring-${uid}`;
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className} aria-hidden>
      <defs>
        <radialGradient id={glow} cx="16" cy="16" r="13" gradientUnits="userSpaceOnUse">
          <stop offset="0.45" stopColor="#38bdf8" stopOpacity="0" />
          <stop offset="0.8" stopColor="#38bdf8" stopOpacity="0.22" />
          <stop offset="1" stopColor="#38bdf8" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={ring} x1="7" y1="25" x2="25" y2="7" gradientUnits="userSpaceOnUse">
          <stop stopColor="#2563eb" />
          <stop offset="1" stopColor="#7dd3fc" />
        </linearGradient>
      </defs>
      <circle cx="16" cy="16" r="13" fill={`url(#${glow})`} />
      {/* axis, broken where it meets the flame */}
      <path d="M3.5 28.5 L8.6 23.4 M23.4 8.6 L28.5 3.5" stroke="#93a3bf" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="16" cy="16" r="8.2" stroke={`url(#${ring})`} strokeWidth="2.2" />
      <circle cx="16" cy="16" r="3.1" fill="#e6ecf5" />
    </svg>
  );
}

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <LogoMark size={compact ? 26 : 32} />
      <span className="leading-tight">
        <span className="block text-[16px] font-semibold tracking-[0.01em] text-ink-100">Astraxis</span>
        {!compact && <span className="block text-xs text-ink-400">Microgravity fire safety</span>}
      </span>
    </span>
  );
}
