interface KiteMarkProps {
  className?: string;
}

/** A small paper-kite mark that matches the launcher's chunky ink outline. */
export function KiteMark({ className = 'h-11 w-11' }: KiteMarkProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      viewBox="0 0 48 48"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M24 4 42 22 24 33 6 22Z"
        fill="#f4b942"
        stroke="#173f35"
        strokeLinejoin="round"
        strokeWidth="3"
      />
      <path
        d="M24 4v29M6 22h36"
        fill="none"
        stroke="#173f35"
        strokeLinecap="round"
        strokeWidth="2"
      />
      <path
        d="M24 33c-2 5 4 6 2 11"
        fill="none"
        stroke="#173f35"
        strokeLinecap="round"
        strokeWidth="2.5"
      />
    </svg>
  );
}
