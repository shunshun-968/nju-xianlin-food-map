import {
  featureName,
  geometryPath,
  type OsmCollection,
  type OsmFeature,
  type Position,
} from '../lib/osm-geometry';

export const reviewLines = (feature: OsmFeature) =>
  feature.properties.venue_id === 'v-hut'
    ? ['四五六食堂东侧', '美食小&小餐车']
    : feature.properties.indoor === true
      ? [featureName(feature), '室内售卖点']
      : [featureName(feature)];

export function VenueReviewPanel({
  venues,
  onFocus,
}: {
  venues: OsmCollection;
  onFocus: (venue: OsmFeature) => void;
}) {
  return (
    <section className="osm-review-panel" aria-label="补充点位审查">
      <h2>
        补充点位 ·{' '}
        {venues.features.every((f) => f.properties.review_status === 'approved')
          ? '已审核'
          : '待审查'}
      </h2>
      <p className="osm-muted">蓝色 × 对应截图标记，橙色轮廓是对齐参照。点击下面的地点查看局部。</p>
      <ol>
        {venues.features.map((venue) => (
          <li key={venue.id}>
            <button onClick={() => onFocus(venue)}>
              {featureName(venue)}
              {venue.properties.indoor === true ? '（室内）' : ''}
            </button>
          </li>
        ))}
      </ol>
      <p className="osm-muted">位置为视觉估定。虚线圈为 5 米目视检查范围，不代表测量精度。</p>
      <a href={`${import.meta.env.BASE_URL}osm/food-venues.geojson`} download>
        下载这 3 个地点的 GeoJSON
      </a>
    </section>
  );
}

export function VenueReviewOverlay({
  venues,
  references,
  project,
  scale,
  onFocus,
}: {
  venues: OsmCollection;
  references: OsmCollection;
  project: (point: Position) => Position;
  scale: number;
  onFocus: (venue: OsmFeature) => void;
}) {
  return (
    <g className="osm-venue-review" data-layer="food-venues">
      <g fill="none" stroke="#e77436" strokeWidth="2.5" pointerEvents="none">
        {references.features.map((reference) => (
          <path
            key={reference.id}
            d={geometryPath(reference.geometry, project)}
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </g>
      {venues.features.map((venue, index) => {
        if (venue.geometry.type !== 'Point') return null;
        const [x, y] = project(venue.geometry.coordinates);
        const lines = reviewLines(venue);
        const width = Math.max(...lines.map((line) => line.length)) * 12 + 38;
        const height = lines.length * 17 + 12;
        return (
          <g key={venue.id} transform={`translate(${x} ${y})`} data-osm={venue.id}>
            <circle
              r={Number(venue.properties.visual_review_radius_m)}
              fill="#078dbe"
              fillOpacity=".08"
              stroke="#078dbe"
              strokeDasharray="4 3"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
              pointerEvents="none"
            />
            <g
              transform={`scale(${1 / scale})`}
              role="button"
              tabIndex={0}
              aria-label={`查看${featureName(venue)}`}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  event.stopPropagation();
                  onFocus(venue);
                }
              }}
            >
              <title>
                {featureName(venue)} · 视觉对齐，
                {venue.properties.review_status === 'approved' ? '已审核' : '待审查'}
              </title>
              <rect x="-12" y="-12" width="24" height="24" fill="transparent" />
              <path d="M-6 -6L6 6M-6 6L6 -6" stroke="#fff" strokeWidth="6" strokeLinecap="round" />
              <path
                d="M-6 -6L6 6M-6 6L6 -6"
                stroke="#009bce"
                strokeWidth="3"
                strokeLinecap="round"
              />
              <path d="M8 -8L19 -22" stroke="#078dbe" fill="none" />
              <g transform={`translate(17 ${-height - 18})`}>
                <rect width={width} height={height} rx="5" fill="#fffefb" stroke="#86c7d9" />
                <text x="10" y="20" fill="#0782ad" fontSize="12" fontWeight="700">
                  {index + 1}
                </text>
                {lines.map((line, i) => (
                  <text key={line} x="27" y={20 + i * 17} fill="#254a54" fontSize="12">
                    {line}
                  </text>
                ))}
              </g>
            </g>
          </g>
        );
      })}
    </g>
  );
}
