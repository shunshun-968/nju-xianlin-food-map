import { useCallback, useEffect, useRef, useState } from 'react';
import { MapScene, type SceneHandle } from './components/MapScene';
import { catalogRepository } from './services/catalog';
import { mediaUrl, themes, type Catalog, type MapTheme, type View } from './domain';

function ThemePreview({ theme }: { theme: MapTheme }) {
  const t = themes[theme];
  return (
    <svg viewBox="0 0 160 78" aria-hidden="true">
      <rect width="160" height="78" fill={t.ground} />
      <path d="M87 -5L155 0 153 44 111 50 84 29Z" fill={t.park} />
      <path d="M111 -5Q86 20 98 39T89 85" fill="none" stroke={t.water} strokeWidth="5" />
      <path d="M24 -4L48 84M-5 27L165 67M-5 54L152 15" stroke={t.road} strokeWidth="5" />
      <g fill={t.building}>
        <rect x="10" y="8" width="15" height="10" />
        <rect x="41" y="9" width="20" height="11" />
        <rect x="60" y="38" width="19" height="12" />
        <rect x="53" y="59" width="26" height="12" />
        <rect x="118" y="55" width="22" height="13" />
      </g>
      <path d="M39 34L60 29 72 36 51 42Z" fill={t.accent} />
      <path d="M39 34L51 42 51 50 39 42ZM51 42L72 36 72 44 51 50Z" fill={t.accent} opacity=".7" />
    </svg>
  );
}
export default function App() {
  const [data, setData] = useState<Catalog | null>(null),
    [error, setError] = useState('');
  const [view, setView] = useState<View>({ level: 'campus' }),
    [theme, setTheme] = useState<MapTheme>('garden');
  const [query, setQuery] = useState(''),
    [filter, setFilter] = useState('all'),
    [stallId, setStallId] = useState<string | null>(null);
  const [showThemes, setShowThemes] = useState(false),
    [showInfo, setShowInfo] = useState(false);
  const scene = useRef<SceneHandle>(null);
  const search = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowThemes(false);
        setShowInfo(false);
        setStallId(null);
      }
      if (event.key === '/' && !(event.target instanceof HTMLInputElement) && search.current) {
        event.preventDefault();
        search.current.focus();
      }
    };
    window.addEventListener('keydown', keydown);
    return () => window.removeEventListener('keydown', keydown);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    catalogRepository
      .load(controller.signal)
      .then(setData)
      .catch((e) => {
        if (e.name !== 'AbortError') setError(e.message);
      });
    return () => controller.abort();
  }, []);
  const navigate = useCallback((next: View) => {
    setView(next);
    setStallId(null);
  }, []);
  const pick = useCallback(
    (kind: string, id: string) => {
      if (kind === 'venue') navigate({ level: 'building', venueId: id });
      if (kind === 'floor' && data) {
        const floor = data.floors.find((f) => f.id === id);
        if (floor) navigate({ level: 'floor', venueId: floor.venueId, floorId: id });
      }
      if (kind === 'stall') setStallId(id);
    },
    [data, navigate],
  );
  const venue = data?.venues.find((v) => view.level !== 'campus' && v.id === view.venueId);
  const floor = data?.floors.find((f) => view.level === 'floor' && f.id === view.floorId);
  const stall = data?.stalls.find((s) => s.id === stallId);
  const visible = data?.venues.filter(
    (v) => (filter === 'all' || v.kind === filter) && v.name.includes(query),
  );
  return (
    <div className={`app theme-${theme}`}>
      <header className="header">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            navigate({ level: 'campus' });
          }}
        >
          <span className="brand-mark">仙</span>
          <span>
            <strong>仙林食光</strong>
            <small>NJU FOOD ATLAS</small>
          </span>
        </a>
        <div className="header-center">
          <span className="location-dot" />
          南京大学 · 仙林校区 <span className="divider">/</span> 在校园，找到好好吃饭的地方
        </div>
        <button className="plain-button about" onClick={() => setShowInfo(true)}>
          关于这个计划 <span>↗</span>
        </button>
        <span className="phase">PHASE 0 · 探索原型</span>
      </header>
      <main className="workspace">
        <aside className="sidebar">
          <div className="sidebar-top">
            <div className="eyebrow">A LITTLE WALK, A GOOD MEAL.</div>
            <h1>
              {view.level === 'campus' ? (
                <>
                  每一餐，
                  <br />
                  都值得<span>好好发现。</span>
                </>
              ) : (
                venue?.name
              )}
            </h1>
            <p>
              {view.level === 'campus'
                ? '沿着熟悉的校园，寻找下一顿心动。'
                : view.level === 'building'
                  ? '转一转这栋建筑，选一层开始探索。'
                  : '走近窗口，看看今天想吃些什么。'}
            </p>
          </div>
          {view.level === 'campus' ? (
            <>
              <label className="search">
                <span>⌕</span>
                <input
                  aria-label="搜索食堂或餐车"
                  ref={search}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="搜索食堂、小餐车…"
                />
                <kbd>/</kbd>
              </label>
              <div className="filters" aria-label="场所分类">
                {[
                  ['all', '全部'],
                  ['canteen', '食堂'],
                  ['cart', '小屋与餐车'],
                ].map(([key, name]) => (
                  <button
                    key={key}
                    aria-pressed={filter === key}
                    className={filter === key ? 'active' : ''}
                    onClick={() => setFilter(key)}
                  >
                    {name}
                  </button>
                ))}
              </div>
              <div className="list-heading">
                <strong>校园味道</strong>
                <span>{visible?.length || 0} 个探索地点</span>
              </div>
              <div className="venue-list">
                {visible?.map((v, i) => (
                  <button
                    className="venue-card"
                    key={v.id}
                    onClick={() => navigate({ level: 'building', venueId: v.id })}
                  >
                    <span className={`venue-icon ${v.kind}`}>{v.kind === 'cart' ? '♧' : '▤'}</span>
                    <span className="venue-copy">
                      <strong>{v.name}</strong>
                      <small>
                        {v.area} <span>·</span> 待实地核实
                      </small>
                    </span>
                    <span className="venue-arrow">↗</span>
                    <span className="venue-number">{String(i + 1).padStart(2, '0')}</span>
                  </button>
                ))}
                {visible?.length === 0 && (
                  <p className="empty-state">没有找到这个地点，试试“食堂”或“餐车”。</p>
                )}
              </div>
            </>
          ) : (
            <>
              <button
                className="back-button"
                onClick={() =>
                  navigate(
                    view.level === 'floor'
                      ? { level: 'building', venueId: view.venueId }
                      : { level: 'campus' },
                  )
                }
              >
                ← {view.level === 'floor' ? '返回建筑' : '返回校园地图'}
              </button>
              <div className="venue-description">
                <span className="tiny-tag">空间示意 · 未经测量</span>
                <p>{venue?.description}</p>
              </div>
              <div className="list-heading">
                <strong>{view.level === 'building' ? '选择楼层' : '本层窗口'}</strong>
                <span>
                  {view.level === 'building' ? '点击楼层进入' : `${floor?.name} · 示例布局`}
                </span>
              </div>
              <div className="venue-list">
                {view.level === 'building'
                  ? data?.floors
                      .filter((f) => f.venueId === venue?.id)
                      .map((f) => (
                        <button
                          className="floor-card"
                          key={f.id}
                          onClick={() =>
                            navigate({ level: 'floor', venueId: f.venueId, floorId: f.id })
                          }
                        >
                          <b>{f.name}</b>
                          <span>
                            示例餐饮空间<small>查看窗口与布局</small>
                          </span>
                          <span>→</span>
                        </button>
                      ))
                  : data?.stalls
                      .filter((s) => s.floorId === floor?.id)
                      .map((s, i) => (
                        <button
                          key={s.id}
                          className={`stall-card ${stallId === s.id ? 'selected' : ''}`}
                          onClick={() => setStallId(s.id)}
                        >
                          <span className="stall-number">{String(i + 1).padStart(2, '0')}</span>
                          <span>
                            <strong>{s.name}</strong>
                            <small>{s.category} · 示例窗口</small>
                          </span>
                          <span>→</span>
                        </button>
                      ))}
              </div>
            </>
          )}
          <div className="sidebar-bottom">
            <span className="mini-spark">✳</span>
            <p>
              地图正在生长，味道等你来补全。<small>当前为交互演示，尚未接入真实评价。</small>
            </p>
          </div>
        </aside>
        <section className="map-area" aria-label="交互地图">
          {data ? (
            <MapScene
              ref={scene}
              data={data}
              view={view}
              theme={theme}
              selectedStall={stallId}
              onPick={pick}
            />
          ) : (
            <div className="loading" role="status">
              {error || '正在展开校园地图…'}
            </div>
          )}
          <nav className="breadcrumbs" aria-label="当前层级">
            <button onClick={() => navigate({ level: 'campus' })}>⌂ 校园地图</button>
            {venue && (
              <>
                <span>／</span>
                <button onClick={() => navigate({ level: 'building', venueId: venue.id })}>
                  {venue.shortName}
                </button>
              </>
            )}
            {floor && (
              <>
                <span>／</span>
                <strong>{floor.name}</strong>
              </>
            )}
          </nav>
          <div className="map-status">
            <span />{' '}
            {view.level === 'campus'
              ? 'CAMPUS EXPLORER'
              : view.level === 'building'
                ? 'BUILDING EXPLORER'
                : 'FLOOR EXPLORER'}
            <small>示意空间 · 非导航地图</small>
          </div>
          <div className="compass" aria-label="示意北向">
            N<span>↑</span>
          </div>
          <div className="map-tools">
            <button title="放大" aria-label="放大" onClick={() => scene.current?.zoom(1.25)}>
              +
            </button>
            <button title="缩小" aria-label="缩小" onClick={() => scene.current?.zoom(0.8)}>
              −
            </button>
            {view.level !== 'campus' && (
              <button
                title="旋转视角"
                aria-label="旋转视角"
                onClick={() => scene.current?.rotate()}
              >
                ↻
              </button>
            )}
            <button
              title="回到初始视角"
              aria-label="回到初始视角"
              onClick={() => scene.current?.reset()}
            >
              ⌖
            </button>
          </div>
          <div className="map-bottom">
            <div className="legend">
              <span className="legend-square" style={{ background: themes[theme].accent }} />
              可探索地点 <span className="legend-line" />
              校园道路
            </div>
            <button
              className={`style-toggle ${showThemes ? 'active' : ''}`}
              onClick={() => setShowThemes(!showThemes)}
              aria-expanded={showThemes}
            >
              ▧ <span>底图风格</span>
              <span>{showThemes ? '⌄' : '⌃'}</span>
            </button>
          </div>
          {showThemes && (
            <div className="theme-panel">
              <div className="list-heading">
                <strong>选一种校园的样子</strong>
                <span>3 款示意底图</span>
              </div>
              <div className="theme-options">
                {(Object.keys(themes) as MapTheme[]).map((key) => (
                  <button
                    key={key}
                    className={theme === key ? 'chosen' : ''}
                    aria-pressed={theme === key}
                    onClick={() => setTheme(key)}
                  >
                    <ThemePreview theme={key} />
                    <strong>
                      {themes[key].name} {theme === key ? '✓' : ''}
                    </strong>
                    <small>{themes[key].subtitle}</small>
                  </button>
                ))}
              </div>
              <p>当前风格预览不使用在线瓦片，真实地理底图后续接入。</p>
            </div>
          )}
          <div className="interaction-hint">
            {view.level === 'campus'
              ? '拖动浏览 · 滚轮缩放 · 点击高亮建筑'
              : '拖动平移 · 右键旋转 · 滚轮缩放 · 双指旋转'}
          </div>
          {stall && (
            <aside className="detail-panel" aria-label="窗口详情">
              <div className="detail-top">
                <span className="tiny-tag">示例窗口</span>
                <button aria-label="关闭窗口详情" onClick={() => setStallId(null)}>
                  ×
                </button>
              </div>
              <div className="photo-placeholder">
                {mediaUrl(stall.photoKey, import.meta.env.VITE_MEDIA_BASE_URL || '') ? (
                  <img
                    src={mediaUrl(stall.photoKey, import.meta.env.VITE_MEDIA_BASE_URL || '')!}
                    alt={stall.name}
                  />
                ) : (
                  <>
                    <span>▧</span>
                    <p>把真实的味道，留在这里</p>
                    <small>窗口实拍照片待采集</small>
                  </>
                )}
              </div>
              <h2>{stall.name}</h2>
              <p className="detail-location">
                {venue?.name} · {floor?.name}
              </p>
              <div className="detail-rating">
                ☆ <strong>暂无评分</strong>
                <span>尚未开放评价</span>
              </div>
              <h3>
                菜单预览 <small>演示数据</small>
              </h3>
              {stall.dishes.map((d) => (
                <div className="dish" key={d.name}>
                  <span>
                    <strong>{d.name}</strong>
                    <small>{d.description}</small>
                  </span>
                  <b>{d.price === null ? '待核实' : `¥${d.price}`}</b>
                </div>
              ))}
              <div className="review-placeholder">
                <strong>第一条真实评价，留给你。</strong>
                <p>评论、评分和照片上传将在账号与审核功能完成后开放。</p>
              </div>
              <div className="read-only">◉ 当前为只读原型</div>
            </aside>
          )}
        </section>
      </main>
      <footer className="footer">
        <span>
          南京大学仙林校区美食地图 <i>·</i> 与校园的日常相遇
        </span>
        <span>
          建筑位置 / 楼层 / 菜单均为示例，待现场核实 <i>·</i> v0.1
        </span>
      </footer>
      {showInfo && (
        <div className="modal-backdrop" onClick={() => setShowInfo(false)}>
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="about-title"
            className="about-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="modal-close"
              onClick={() => setShowInfo(false)}
              aria-label="关闭说明"
            >
              ×
            </button>
            <span className="eyebrow">FROM CAMPUS, FOR CAMPUS</span>
            <h2 id="about-title">
              让好好吃饭，
              <br />
              成为校园里的小确幸。
            </h2>
            <p>
              「仙林食光」是由同学共同建设的交互式美食地图。目前处于 Phase
              0，正在打磨从校园、食堂建筑到楼层窗口的探索体验。
            </p>
            <p>
              现在的地点名称来自采集计划；建筑位置、楼层布局和菜单为示例，不用于导航、营业判断或消费参考。我们不会展示虚构的用户评分。
            </p>
            <p>下一步：现场采集 → 校准空间 → 接入照片与菜单 → 开放真实评价。</p>
            <button className="primary-button" onClick={() => setShowInfo(false)}>
              开始探索 →
            </button>
          </section>
        </div>
      )}
    </div>
  );
}
