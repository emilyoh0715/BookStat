interface Props {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

export default function BookstatLogo({ size = 64, className, style }: Props) {
  return (
    <svg
      width={size}
      height={Math.round(size * (116 / 130))}
      viewBox="0 0 130 116"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={style}
    >
      {/* Left page — outer top corner sits slightly above the spine, giving the classic open-book spread */}
      <path
        d="M 65 74 L 10 70 L 5 96 C 28 107 48 106 65 103 Z"
        className="logo-page"
      />

      {/* Right page — mirror */}
      <path
        d="M 65 74 L 120 70 L 125 96 C 102 107 82 106 65 103 Z"
        className="logo-page"
      />

      {/* Bottom spine U-curve */}
      <path d="M 5 96 Q 65 114 125 96" className="logo-spine" />

      {/* Center spine fold */}
      <line x1="65" y1="74" x2="65" y2="103" className="logo-center" />

      {/* Left page lines — slope matches the page top edge */}
      <line x1="12" y1="81" x2="58" y2="85" className="logo-lines" />
      <line x1="10" y1="89" x2="58" y2="93" className="logo-lines" />

      {/* Right page lines */}
      <line x1="72" y1="85" x2="118" y2="81" className="logo-lines" />
      <line x1="72" y1="93" x2="120" y2="89" className="logo-lines" />

      {/* Bars — all bottom at y=74 (book top), colours left→right: teal, yellow, coral, blue */}
      <rect x="33" y="56" width="13" height="18" rx="3.5" fill="#7CCEB4" />
      <rect x="50" y="46" width="13" height="28" rx="3.5" fill="#FFC857" />
      <rect x="67" y="32" width="13" height="42" rx="3.5" fill="#FF7D7D" />
      <rect x="84" y="12" width="13" height="62" rx="3.5" fill="#7AA7FF" />
    </svg>
  );
}
