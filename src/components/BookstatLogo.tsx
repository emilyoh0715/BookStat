interface Props {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

export default function BookstatLogo({ size = 64, className, style }: Props) {
  return (
    <img
      src="/logo-icon.png"
      width={size}
      alt="북스탯"
      className={className}
      style={{ display: 'block', height: 'auto', ...style }}
    />
  );
}
