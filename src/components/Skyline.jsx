import { SKY_SKY, SKY_BACK, SKY_CITY, SKY_GROUND, SKYLINE_VIEWBOX } from './skylineMarkup.js'

// variant 'retro': colour poster with sunburst, hills, offset print shadow and halftone dots
// variant 'night': flat silhouette for the footer
export default function Skyline({ variant = 'retro', className = '', height }) {
  const style = height ? { height } : undefined
  if (variant === 'night')
    return (
      <svg className={`skyline skyline-night ${className}`} viewBox={SKYLINE_VIEWBOX} preserveAspectRatio="xMidYMax slice" aria-hidden="true" focusable="false" style={style}>
        <g dangerouslySetInnerHTML={{ __html: SKY_CITY + SKY_GROUND }} />
      </svg>
    )
  return (
    <svg className={`skyline skyline-retro ${className}`} viewBox={SKYLINE_VIEWBOX} preserveAspectRatio="xMidYMax slice" aria-hidden="true" focusable="false" style={style}>
      <defs>
        <pattern id="sk-dots" width="9" height="9" patternUnits="userSpaceOnUse">
          <circle cx="2.5" cy="2.5" r="1.3" fill="#C2622D" />
        </pattern>
        <linearGradient id="sk-fade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#000" />
          <stop offset=".45" stopColor="#fff" />
        </linearGradient>
        <mask id="sk-mask" maskUnits="userSpaceOnUse" x="-480" y="0" width="2400" height="392">
          <rect x="-480" y="0" width="2400" height="392" fill="url(#sk-fade)" />
        </mask>
      </defs>
      <g mask="url(#sk-mask)">
        <g className="sky" dangerouslySetInnerHTML={{ __html: SKY_SKY }} />
        <rect x="-480" y="0" width="2400" height="392" fill="url(#sk-dots)" className="dots" />
      </g>
      <g className="back" dangerouslySetInnerHTML={{ __html: SKY_BACK }} />
      <g className="shadow" transform="translate(6 5)" dangerouslySetInnerHTML={{ __html: SKY_CITY }} />
      <g className="city" dangerouslySetInnerHTML={{ __html: SKY_CITY }} />
      <g className="grnd" dangerouslySetInnerHTML={{ __html: SKY_GROUND }} />
    </svg>
  )
}
