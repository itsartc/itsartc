export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
      <circle cx="16" cy="16" r="13" />
      <path d="M16 3c-4 4-4 9 0 13s4 9 0 13M3 16c4-4 9-4 13 0s9 4 13 0M7 7c5 1 8 4 9 9s4 8 9 9M25 7c-5 1-8 4-9 9s-4 8-9 9" />
    </svg>
  );
}
