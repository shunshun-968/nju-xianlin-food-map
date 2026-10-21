/** Vector compass rose: paired purple facets stay crisp at every display size. */
export function CompassRose() {
  return (
    <div className="compass compass-rose" role="img" aria-label="指北针：上北、下南、左西、右东">
      <svg viewBox="0 0 120 120" aria-hidden="true">
        <circle cx="60" cy="60" r="39" fill="#faf5fbe0" stroke="#a48ab6" strokeWidth=".8" />
        <circle cx="60" cy="60" r="31" fill="none" stroke="#a48ab6" strokeWidth=".65" />
        <circle
          cx="60"
          cy="60"
          r="46"
          fill="none"
          stroke="#9270a8"
          strokeWidth=".8"
          strokeDasharray="7 3"
        />
        {Array.from({ length: 32 }, (_, i) => (
          <path
            key={i}
            d={`M60 ${i % 4 === 0 ? 17 : 19}V21`}
            transform={`rotate(${i * 11.25} 60 60)`}
            stroke="#9270a8"
            strokeWidth={i % 4 === 0 ? 0.9 : 0.5}
          />
        ))}
        {[45, 135, 225, 315].map((angle) => (
          <g key={angle} transform={`rotate(${angle} 60 60)`}>
            <path d="M60 28L54 60H60Z" fill="#d5c0e3" stroke="#78518e" strokeWidth=".65" />
            <path d="M60 28L66 60H60Z" fill="#79518f" />
          </g>
        ))}
        {[0, 90, 180, 270].map((angle) => (
          <g key={angle} transform={`rotate(${angle} 60 60)`}>
            <path d="M60 11L51 60H60Z" fill="#e4d5ed" stroke="#68417e" strokeWidth=".7" />
            <path d="M60 11L69 60H60Z" fill="#68417e" />
          </g>
        ))}
        <circle cx="60" cy="60" r="7" fill="#f7f0fa" stroke="#78518e" strokeWidth=".8" />
        <g
          fill="#68417e"
          fontFamily="Georgia, serif"
          fontSize="12"
          fontWeight="600"
          textAnchor="middle"
        >
          <text x="60" y="10">
            N
          </text>
          <text x="60" y="119">
            S
          </text>
          <text x="5" y="64">
            W
          </text>
          <text x="115" y="64">
            E
          </text>
        </g>
      </svg>
    </div>
  );
}
