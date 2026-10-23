import type { MapFeature, MapFrame } from '../lib/campus-basemap';

function Court({ sport }: { sport: string }) {
  return (
    <g
      className="geo-court-markings"
      fill="none"
      stroke="var(--map-court-line, #fffcf4)"
      strokeWidth="1"
      opacity=".85"
    >
      <rect x="8" y="8" width="84" height="164" />
      <path d="M8 90H92" />
      {sport === 'basketball' ? (
        <>
          <circle cx="50" cy="90" r="12" />
          <path d="M34 8V35H66V8M34 172V145H66V172M34 35A16 16 0 0 0 66 35M34 145A16 16 0 0 1 66 145M18 8V22A32 32 0 0 0 82 22V8M18 172V158A32 32 0 0 1 82 158V172" />
          <path d="M43 15H57M43 165H57" strokeWidth="1.8" />
        </>
      ) : sport === 'tennis' ? (
        <>
          <path d="M18 8V172M82 8V172M18 52H82M18 128H82M50 52V128M4 90H96" />
        </>
      ) : (
        <path d="M8 62H92M8 118H92M4 90H96" />
      )}
    </g>
  );
}

function Football({ width: w, height: h }: { width: number; height: number }) {
  return (
    <g fill="none" stroke="var(--map-court-line, #f8f7e9)" strokeWidth=".65" opacity=".9">
      <rect x="0" y="0" width={w} height={h} />
      <path d={`M0 ${h / 2}H${w}`} />
      <circle cx={w / 2} cy={h / 2} r={w * 0.14} />
      <path
        d={`M${w * 0.2} 0V${h * 0.16}H${w * 0.8}V0M${w * 0.38} 0V${h * 0.055}H${w * 0.62}V0M${w * 0.2} ${h}V${h * 0.84}H${w * 0.8}V${h}M${w * 0.38} ${h}V${h * 0.945}H${w * 0.62}V${h}`}
      />
      <path
        d={`M${w * 0.37} ${h * 0.16}Q${w * 0.5} ${h * 0.25} ${w * 0.63} ${h * 0.16}M${w * 0.37} ${h * 0.84}Q${w * 0.5} ${h * 0.75} ${w * 0.63} ${h * 0.84}`}
      />
    </g>
  );
}

function swap(frame: MapFrame): MapFrame {
  const [a, b, c, d, e, f] = frame.matrix;
  return {
    matrix: [c, d, -a, -b, e + a * frame.width, f + b * frame.width],
    width: frame.height,
    height: frame.width,
  };
}

export function CampusSports({ features }: { features: MapFeature[] }) {
  const stadiumIds = new Set(['way/99661837', 'way/609155597']);
  return (
    <g className="geo-sports" pointerEvents="none">
      {features
        .filter((f) => f.frame && f.sport)
        .map((feature) => {
          const clip = `sport-${feature.id.replace('/', '-')}`;
          const stadium = stadiumIds.has(feature.id);
          // Football is drawn within each stadium symbol; omit the nested pitch duplicate.
          if (['way/118862373', 'way/609155596'].includes(feature.id)) return null;
          let frame = feature.frame!;
          if (feature.sport === 'volleyball' && frame.height / frame.width > 2) frame = swap(frame);
          const { width: w, height: h } = frame;
          let columns = Math.max(1, Math.round(w / 18)),
            rows = Math.max(1, Math.round(h / 30));
          if (feature.id === 'way/99661839') {
            columns = 4;
            rows = 3;
          }
          if (feature.id === 'way/118862383') {
            columns = 4;
            rows = 1;
          }
          if (feature.id === 'way/99814419') {
            columns = 4;
            rows = 2;
          }
          const isCourt = ['basketball', 'volleyball', 'tennis'].includes(feature.sport!);
          if (!stadium && !isCourt && feature.sport !== 'soccer') return null;
          return (
            <g key={feature.id} data-sport={feature.sport} data-sport-id={feature.id}>
              <defs>
                <clipPath id={clip}>
                  <path d={feature.path} />
                </clipPath>
              </defs>
              <g clipPath={`url(#${clip})`}>
                <g transform={`matrix(${frame.matrix.join(' ')})`}>
                  {stadium ? (
                    <>
                      <rect width={w} height={h} fill="var(--map-track, #cbbbbe)" />
                      {[0, 1, 2, 3, 4].map((i) => (
                        <rect
                          key={i}
                          x={5 + i * 1.7}
                          y={5 + i * 1.7}
                          width={w - 10 - i * 3.4}
                          height={h - 10 - i * 3.4}
                          rx={(w - 10 - i * 3.4) / 2}
                          fill="none"
                          stroke="var(--map-track-line, #f5eee7)"
                          strokeWidth=".65"
                          opacity=".85"
                        />
                      ))}
                      <rect
                        x={w * 0.21}
                        y={h * 0.2}
                        width={w * 0.58}
                        height={h * 0.6}
                        fill="var(--map-pitch, #bdcdb2)"
                      />
                      <g transform={`translate(${w * 0.21} ${h * 0.2})`}>
                        <Football width={w * 0.58} height={h * 0.6} />
                      </g>
                    </>
                  ) : isCourt ? (
                    <>
                      <rect
                        width={w}
                        height={h}
                        fill={
                          feature.sport === 'tennis'
                            ? 'var(--map-tennis, #b6cbbd)'
                            : feature.sport === 'basketball'
                              ? 'var(--map-court, #cbbcc5)'
                              : 'var(--map-court, #d4c9b6)'
                        }
                      />
                      {Array.from({ length: columns * rows }, (_, i) => (
                        <g
                          key={i}
                          transform={`translate(${((i % columns) * w) / columns} ${(Math.floor(i / columns) * h) / rows}) scale(${w / columns / 100} ${h / rows / 180})`}
                        >
                          <Court sport={feature.sport!} />
                        </g>
                      ))}
                    </>
                  ) : (
                    <>
                      <rect width={w} height={h} fill="var(--map-pitch, #bdcdb2)" />
                      <g transform={`translate(${w * 0.04} ${h * 0.04})`}>
                        <Football width={w * 0.92} height={h * 0.92} />
                      </g>
                    </>
                  )}
                </g>
              </g>
            </g>
          );
        })}
    </g>
  );
}

export function RadioTelescope({ point }: { point: [number, number] }) {
  return (
    <g
      transform={`translate(${point[0]} ${point[1]}) scale(.65)`}
      data-landmark="radio-telescope"
      pointerEvents="none"
    >
      <title>左涤江天文台 · 射电望远镜示意</title>
      <ellipse cx="5" cy="14" rx="14" ry="4" fill="#778374" opacity=".17" />
      <path
        d="M-6 12L-2 0H2L7 12M-8 13H9M0 1V12"
        fill="#bdc2bb"
        stroke="#89958c"
        strokeWidth="1.2"
      />
      <g transform="rotate(-24 0 -4)">
        <path d="M-14 -8Q-10 8 0 9Q10 8 14 -8Z" fill="#dfe3dc" stroke="#94a198" strokeWidth=".8" />
        <ellipse cy="-8" rx="14" ry="4.4" fill="#fffefa" stroke="#94a198" strokeWidth=".8" />
        <path
          d="M-13 -8L0 -21L13 -8M0 -21V-7M-8 -6Q-4 5 0 8Q4 5 8 -6"
          fill="none"
          stroke="#8a9990"
          strokeWidth=".65"
        />
        <rect x="-1.8" y="-23" width="3.6" height="4" rx="1" fill="#78897f" />
      </g>
    </g>
  );
}
