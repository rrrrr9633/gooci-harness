import type { IconProps } from './icons/props.ts'

/** GOOCI mark: hexagon G, optional word. `tone` follows the surface it sits on. */
export function GoociMark({
  size = 24,
  className,
  word = false,
  tone = 'ink',
}: IconProps & { word?: boolean; tone?: 'ink' | 'light' }) {
  const light = tone === 'light'
  const mark = Math.round(size * 1.05)
  return (
    <span
      data-gooci-mark=""
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        height: size,
        color: light ? '#fff' : '#2b8fb6',
        fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif',
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: mark,
          height: Math.round(mark * 1.12),
          clipPath: 'polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%)',
          background: light ? '#fff' : '#2b8fb6',
          color: light ? '#2b8fb6' : '#fff',
          display: 'grid',
          placeItems: 'center',
          fontWeight: 700,
          fontSize: Math.max(10, Math.round(size * 0.46)),
          lineHeight: 1,
        }}
      >
        G
      </span>
      {word && (
        <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 6, lineHeight: 1 }}>
          <b style={{ fontSize: Math.round(size * 0.72), letterSpacing: '0.04em' }}>GOOCI</b>
          <span style={{ fontSize: Math.round(size * 0.64) }}>谷器</span>
        </span>
      )}
    </span>
  )
}
