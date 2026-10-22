import { useCallback, useEffect, useRef, useState } from 'react';
import { MapScene, type SceneHandle } from './components/MapScene';
import { CampusMap } from './components/CampusMap';
import { UiIcon } from './components/UiIcon';
import { CompassRose } from './components/CompassRose';
import { FloatingSidebar } from './components/FloatingSidebar';
import { catalogRepository } from './services/catalog';
import { mediaUrl, type Catalog, type MapTheme, type View } from './domain';

export default function App() {
  const [data, setData] = useState<Catalog | null>(null),
    [error, setError] = useState('');
  const [view, setView] = useState<View>({ level: 'campus' }),
    [theme] = useState<MapTheme>('garden');
  const [query, setQuery] = useState(''),
    [filter, setFilter] = useState('all'),
    [stallId, setStallId] = useState<string | null>(null);
  const [showMapLabels, setShowMapLabels] = useState(true),
    [showInfo, setShowInfo] = useState(false);
  const scene = useRef<SceneHandle>(null);
  const search = useRef<HTMLInputElement>(null);
  const aboutDialog = useRef<HTMLElement>(null);
  const header = useRef<HTMLElement>(null);
  const [headerOpen, setHeaderOpen] = useState(true);
  const [mobile, setMobile] = useState(() => window.matchMedia('(max-width: 700px)').matches);
  useEffect(() => {
    const media = window.matchMedia('(max-width: 700px)');
    const changed = () => setMobile(media.matches);
    media.addEventListener('change', changed);
    return () => media.removeEventListener('change', changed);
  }, []);
  const [highlightedVenueId, setHighlightedVenueId] = useState<string | null>(null);
  const highlightVenue = useCallback((id: string | null) => {
    const focused = document.activeElement?.closest('[data-place-id], [data-venue]');
    setHighlightedVenueId(
      id || focused?.getAttribute('data-place-id') || focused?.getAttribute('data-venue') || null,
    );
  }, []);
  useEffect(() => {
    window.dispatchEvent(new Event('foodmap:overlays'));
  }, [headerOpen]);
  const hideHeader = () => {
    if (showInfo) return;
    if (
      document.activeElement instanceof HTMLElement &&
      header.current?.contains(document.activeElement)
    )
      document.activeElement.blur();
    setHeaderOpen(false);
  };
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (showInfo) setShowInfo(false);
        else setStallId(null);
      }
      if (
        !showInfo &&
        event.key === '/' &&
        !(event.target instanceof HTMLInputElement) &&
        search.current
      ) {
        event.preventDefault();
        window.dispatchEvent(new Event('foodmap:search'));
      }
    };
    window.addEventListener('keydown', keydown);
    return () => window.removeEventListener('keydown', keydown);
  }, [showInfo]);
  useEffect(() => {
    if (!showInfo || !aboutDialog.current) return;
    const previous = document.activeElement;
    const dialog = aboutDialog.current;
    const buttons = [...dialog.querySelectorAll<HTMLButtonElement>('button:not([disabled])')];
    buttons[0]?.focus();
    const trapFocus = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const first = buttons[0],
        last = buttons[buttons.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    dialog.addEventListener('keydown', trapFocus);
    return () => {
      dialog.removeEventListener('keydown', trapFocus);
      if (previous instanceof HTMLElement) previous.focus();
    };
  }, [showInfo]);
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
    setHighlightedVenueId(null);
    if (next.level === 'campus' && !window.matchMedia('(max-width: 700px)').matches)
      setHeaderOpen(true);
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
    <div
      className={`app floating-shell theme-${theme} view-${view.level} ${headerOpen ? 'header-open' : 'header-hidden'}`}
    >
      <button
        className="header-reveal"
        aria-label="展开顶部导航"
        aria-controls="floating-header"
        aria-expanded={headerOpen}
        onPointerEnter={(e) => {
          if (mobile && e.pointerType === 'mouse') setHeaderOpen(true);
        }}
        onFocus={() => setHeaderOpen(true)}
        onClick={() => setHeaderOpen(true)}
      >
        {!mobile ? (
          <>
            <UiIcon name="chevron-right" size={15} />
            <span>展开导航</span>
          </>
        ) : (
          <span aria-hidden="true" />
        )}
      </button>
      <header
        ref={header}
        id="floating-header"
        className="header"
        inert={!headerOpen}
        onPointerEnter={() => setHeaderOpen(true)}
        onFocusCapture={() => setHeaderOpen(true)}
        onTransitionEnd={() => window.dispatchEvent(new Event('foodmap:overlays'))}
      >
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            navigate({ level: 'campus' });
          }}
        >
          <span className="brand-mark" aria-hidden="true">
            食<span>✦</span>
          </span>
          <span>
            <strong>仙林食光</strong>
            <small>A TASTE OF XIANLIN</small>
          </span>
        </a>
        <nav className="header-nav" aria-label="主导航">
          <button
            className="nav-active"
            aria-current="page"
            onClick={() => navigate({ level: 'campus' })}
          >
            <UiIcon name="map" size={18} /> 校园探索
          </button>
          <button className="about" onClick={() => setShowInfo(true)}>
            关于食光 <UiIcon name="arrow-up-right" size={15} />
          </button>
        </nav>
        <div className="header-location">
          <UiIcon name="pin" size={17} />
          <span>南大仙林校区</span>
        </div>
        {!mobile && (
          <button
            className="header-collapse"
            aria-label="收起顶部导航"
            aria-controls="floating-header"
            aria-expanded={headerOpen}
            title="收起顶部导航"
            onClick={hideHeader}
          >
            <UiIcon name="chevron-right" size={17} />
          </button>
        )}
      </header>
      <main className="workspace">
        <FloatingSidebar campus={view.level === 'campus'}>
          <aside className="sidebar">
            <div className="sidebar-top">
              {view.level !== 'campus' && (
                <div className="eyebrow">
                  <span className="hero-dot" />{' '}
                  {view.level === 'building'
                    ? '走进一栋楼，发现一餐饭'
                    : '慢慢挑，找到想吃的那一口'}
                </div>
              )}
              <h1>
                {view.level === 'campus' ? (
                  <>
                    今天
                    <br />
                    <span>去哪里吃？</span>
                  </>
                ) : (
                  venue?.name
                )}
              </h1>
              {view.level !== 'campus' && (
                <p>
                  {view.level === 'building'
                    ? '转一转这栋建筑，选一层开始探索。'
                    : '走近窗口，看看今天想吃些什么。'}
                </p>
              )}
              {view.level === 'campus' && (
                <svg className="hero-art" viewBox="0 0 130 140" fill="none" aria-hidden="true">
                  {!mobile && (
                    <>
                      <ellipse cx="66" cy="118" rx="48" ry="7" fill="currentColor" opacity=".08" />
                      <path
                        d="M24 74h84c-3 27-18 41-42 41S27 101 24 74Z"
                        fill="currentColor"
                        opacity=".13"
                      />
                      <path
                        d="m28 24 3 8 8 3-8 3-3 8-3-8-8-3 8-3ZM112 49l2 5 5 2-5 2-2 5-2-5-5-2 5-2Z"
                        fill="currentColor"
                        opacity=".8"
                      />
                    </>
                  )}
                  <path
                    d="M24 74h84c-3 27-18 41-42 41S27 101 24 74ZM31 86h70M55 115h22M49 120h34"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                  <path
                    d="m79 74 20-53m-10 53 22-49M47 58c-12-13 10-14 0-27M63 57c-10-11 9-14 1-24"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              )}
            </div>
            {view.level === 'campus' ? (
              <>
                <label className="search">
                  <UiIcon name="search" size={18} />
                  <input
                    aria-label="搜索食堂或餐车"
                    ref={search}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="搜索食堂、小餐车…"
                  />
                  {query ? (
                    <button
                      className="search-clear"
                      aria-label="清空搜索"
                      onClick={() => {
                        setQuery('');
                        search.current?.focus();
                      }}
                    >
                      <UiIcon name="close" size={16} />
                    </button>
                  ) : null}
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
                <div className="venue-list">
                  {visible?.map((v) => (
                    <button
                      className={`venue-card ${highlightedVenueId === v.id ? 'is-highlighted' : ''}`}
                      key={v.id}
                      data-place-id={v.id}
                      onPointerEnter={(e) => {
                        if (e.pointerType === 'mouse') highlightVenue(v.id);
                      }}
                      onPointerLeave={() => highlightVenue(null)}
                      onFocus={() => highlightVenue(v.id)}
                      onBlur={() => requestAnimationFrame(() => highlightVenue(null))}
                      onClick={() => navigate({ level: 'building', venueId: v.id })}
                    >
                      <span className={`venue-icon ${v.kind}`}>
                        <UiIcon name={v.kind === 'cart' ? 'cart' : 'building'} size={23} />
                      </span>
                      <span className="venue-copy">
                        <strong>{v.name}</strong>
                      </span>
                      <span className="venue-arrow">
                        <UiIcon name="chevron-right" size={17} />
                      </span>
                      <span className="venue-number" aria-hidden="true">
                        {String(
                          (data?.venues.findIndex((venue) => venue.id === v.id) ?? -1) + 1,
                        ).padStart(2, '0')}
                      </span>
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
                  <UiIcon name="arrow-left" size={17} />{' '}
                  {view.level === 'floor' ? '返回建筑' : '返回校园地图'}
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
                            <UiIcon name="arrow-right" size={19} />
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
                            <UiIcon name="arrow-right" size={19} />
                          </button>
                        ))}
                </div>
              </>
            )}
            <div className="sidebar-bottom">
              <span className="mini-spark">
                <UiIcon name="sparkles" size={22} />
              </span>
              <p>
                一份慢慢完善的校园食记<small>照片、菜单与真实评价，正在准备中。</small>
              </p>
            </div>
          </aside>
        </FloatingSidebar>
        <section
          className="map-area"
          aria-label="交互地图"
          onPointerEnter={(e) => {
            if (mobile && e.pointerType === 'mouse') hideHeader();
          }}
          onPointerDown={() => {
            if (mobile) hideHeader();
          }}
        >
          {data ? (
            view.level === 'campus' ? (
              <CampusMap
                ref={scene}
                data={data}
                onPick={pick}
                showLabels={showMapLabels}
                highlightedVenueId={highlightedVenueId}
                onHighlightVenue={highlightVenue}
                legacyMobile={mobile}
              />
            ) : (
              <MapScene
                ref={scene}
                data={data}
                view={view}
                theme={theme}
                selectedStall={stallId}
                onPick={pick}
              />
            )
          ) : (
            <div className="loading" role="status">
              {error || '正在展开校园地图…'}
            </div>
          )}
          <nav className="breadcrumbs" aria-label="当前层级">
            <button onClick={() => navigate({ level: 'campus' })}>
              <UiIcon name="map" size={16} /> 校园地图
            </button>
            {venue && (
              <>
                <UiIcon name="chevron-right" size={13} />
                <button onClick={() => navigate({ level: 'building', venueId: venue.id })}>
                  {venue.shortName}
                </button>
              </>
            )}
            {floor && (
              <>
                <UiIcon name="chevron-right" size={13} />
                <strong>{floor.name}</strong>
              </>
            )}
          </nav>
          {view.level === 'campus' && <CompassRose />}
          <div className="map-tools">
            <button title="放大" aria-label="放大" onClick={() => scene.current?.zoom(1.25)}>
              <UiIcon name="plus" />
            </button>
            <button title="缩小" aria-label="缩小" onClick={() => scene.current?.zoom(0.8)}>
              <UiIcon name="minus" />
            </button>
            {view.level !== 'campus' && (
              <button
                title="旋转视角"
                aria-label="旋转视角"
                onClick={() => scene.current?.rotate()}
              >
                <UiIcon name="rotate" />
              </button>
            )}
            <button
              title="回到初始视角"
              aria-label="回到初始视角"
              onClick={() => scene.current?.reset()}
            >
              <UiIcon name="reset" />
            </button>
            {view.level === 'campus' && !mobile && (
              <button
                className="name-toggle"
                title={showMapLabels ? '隐藏名称' : '显示名称'}
                aria-label={showMapLabels ? '隐藏名称' : '显示名称'}
                aria-pressed={showMapLabels}
                onClick={() => setShowMapLabels(!showMapLabels)}
              >
                <UiIcon name={showMapLabels ? 'eye' : 'eye-off'} size={20} />
              </button>
            )}
          </div>
          <div className="map-bottom">
            {view.level === 'campus' && mobile && (
              <button
                className="style-toggle"
                aria-pressed={showMapLabels}
                onClick={() => setShowMapLabels(!showMapLabels)}
              >
                <UiIcon name={showMapLabels ? 'eye' : 'eye-off'} size={17} />
                <span>{showMapLabels ? '隐藏名称' : '显示名称'}</span>
              </button>
            )}
          </div>
          {view.level !== 'campus' && (
            <div className="interaction-hint">拖动平移 · 右键旋转 · 滚轮缩放 · 双指旋转</div>
          )}
          {stall && (
            <aside className="detail-panel" aria-label="窗口详情">
              <div className="detail-top">
                <span className="tiny-tag">示例窗口</span>
                <button aria-label="关闭窗口详情" onClick={() => setStallId(null)}>
                  <UiIcon name="close" size={19} />
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
                    <span>
                      <UiIcon name="image" size={35} />
                    </span>
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
                <UiIcon name="star" size={19} /> <strong>暂无评分</strong>
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
              <div className="read-only">
                <UiIcon name="info" size={13} /> 当前为探索演示，暂未开放评价
              </div>
            </aside>
          )}
        </section>
      </main>
      {showInfo && (
        <div className="modal-backdrop" onClick={() => setShowInfo(false)}>
          <section
            ref={aboutDialog}
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
              <UiIcon name="close" size={22} />
            </button>
            <div className="about-scroll">
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
                校园底图按提供的平面图重绘，地点名称以定位图片文件名为准，餐车与售卖点按蓝色 ×
                标记定位。地图只使用相对位置；楼层、窗口和菜单仍为示例。
              </p>
              <section className="zoom-guide" aria-labelledby="zoom-guide-title">
                <h3 id="zoom-guide-title">缩放规则</h3>
                <ul>
                  <li>鼠标滚轮：向上放大、向下缩小，校园地图以鼠标所在位置为缩放中心。</li>
                  <li>触屏操作：在校园地图上双指张开放大、合拢缩小，单指拖动浏览。</li>
                  <li>
                    右侧 ＋／－：以画面中心放大或缩小。校园地图的缩放范围为初始视角的 0.85—8 倍。
                  </li>
                  <li>点击右侧复位按钮，恢复当前场景的初始视角。</li>
                </ul>
                <p>进入食堂建筑或楼层后，也可通过滚轮或加减按钮缩放，右键拖动旋转视角。</p>
              </section>
              <p>下一步：现场采集 → 校准空间 → 接入照片与菜单 → 开放真实评价。</p>
              <p className="source-credits">
                比例尺校准数据：{' '}
                <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
                  © OpenStreetMap contributors
                </a>{' '}
                （ODbL）。
              </p>
              <button className="primary-button" onClick={() => setShowInfo(false)}>
                开始探索 <UiIcon name="arrow-right" size={18} />
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
