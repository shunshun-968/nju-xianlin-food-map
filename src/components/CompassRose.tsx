/** Original compass rose on desktop; preserve the existing compact mobile compass. */
export function CompassRose() {
  return (
    <div className="compass compass-rose" role="img" aria-label="指北针：上北、下南、左西、右东">
      <svg className="compass-classic-svg" viewBox="0 0 120 120" aria-hidden="true">
        <circle
          cx="60"
          cy="60"
          r="39"
          fill="var(--compass-paper, #faf5fbe0)"
          stroke="var(--compass-line, #a48ab6)"
          strokeWidth=".8"
        />
        <circle
          cx="60"
          cy="60"
          r="31"
          fill="none"
          stroke="var(--compass-line, #a48ab6)"
          strokeWidth=".65"
        />
        <circle
          cx="60"
          cy="60"
          r="46"
          fill="none"
          stroke="var(--compass-line, #9270a8)"
          strokeWidth=".8"
          strokeDasharray="7 3"
        />
        {Array.from({ length: 32 }, (_, i) => (
          <path
            key={i}
            d={`M60 ${i % 4 === 0 ? 17 : 19}V21`}
            transform={`rotate(${i * 11.25} 60 60)`}
            stroke="var(--compass-line, #9270a8)"
            strokeWidth={i % 4 === 0 ? 0.9 : 0.5}
          />
        ))}
        {[45, 135, 225, 315].map((angle) => (
          <g key={angle} transform={`rotate(${angle} 60 60)`}>
            <path
              d="M60 28L54 60H60Z"
              fill="var(--compass-soft, #d5c0e3)"
              stroke="var(--compass-line, #78518e)"
              strokeWidth=".65"
            />
            <path d="M60 28L66 60H60Z" fill="var(--compass-ink, #79518f)" />
          </g>
        ))}
        {[0, 90, 180, 270].map((angle) => (
          <g key={angle} transform={`rotate(${angle} 60 60)`}>
            <path
              d="M60 11L51 60H60Z"
              fill="var(--compass-soft, #e4d5ed)"
              stroke="var(--compass-ink, #68417e)"
              strokeWidth=".7"
            />
            <path d="M60 11L69 60H60Z" fill="var(--compass-ink, #68417e)" />
          </g>
        ))}
        <circle
          cx="60"
          cy="60"
          r="7"
          fill="var(--compass-paper, #f7f0fa)"
          stroke="var(--compass-line, #78518e)"
          strokeWidth=".8"
        />
        <g
          fill="var(--compass-ink, #68417e)"
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
      <svg className="compass-compact-svg" viewBox="0 0 56 64" aria-hidden="true">
        <text
          x="28"
          y="10"
          textAnchor="middle"
          fill="var(--compass-ink, #5B3D70)"
          fontSize="11"
          fontFamily="inherit"
          fontWeight="600"
        >
          N
        </text>
        <circle
          cx="28"
          cy="37"
          r="20"
          fill="var(--compass-paper, #fffefbbb)"
          stroke="var(--compass-line, #cec6d0)"
          strokeWidth=".8"
        />
        <path d="M8 37h40M28 17v40" stroke="var(--compass-line, #d5cdd6)" strokeWidth=".8" />
        <path
          d="m28 18-6 21 6-4 6 4Z"
          fill="var(--compass-ink, #5B3D70)"
          stroke="var(--compass-ink, #5B3D70)"
          strokeWidth=".8"
          strokeLinejoin="round"
        />
        <path
          d="m28 56-6-21 6 4 6-4Z"
          fill="var(--compass-soft, #e3d9e9)"
          stroke="var(--compass-line, #aa97b6)"
          strokeWidth=".8"
          strokeLinejoin="round"
        />
        <circle
          cx="28"
          cy="37"
          r="2"
          fill="var(--compass-paper, #FFFEFB)"
          stroke="var(--compass-ink, #5B3D70)"
          strokeWidth="1"
        />
      </svg>
    </div>
  );
}
