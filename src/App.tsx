import { useCallback, useEffect, useRef, useState } from 'react';
import { MapScene, type SceneHandle } from './components/MapScene';
import { CampusMap } from './components/CampusMap';
import { UiIcon } from './components/UiIcon';
import { CompassRose } from './components/CompassRose';
import { FloatingSidebar } from './components/FloatingSidebar';
import { DraggableDetailPanel } from './components/DraggableDetailPanel';
import { AboutLetter } from './components/AboutLetter';
import { southGateCartFoodNames, southGateCartStall } from './data/south-gate-cart';
import { yifuKioskFoodNames, yifuKioskOfferings, yifuKioskServiceNote, yifuKioskStall } from './data/yifu-kiosk';
import { defaultNinanMealMode, ninanHutStall, type NinanMealMode } from './data/ninan-hut';
import { NinanHutDetails } from './components/NinanHutDetails';
import { ThemeToggle } from './components/ThemeToggle';
import { useInterfaceTheme } from './lib/use-interface-theme';
import { useAppNavigation } from './lib/use-app-navigation';
import { useCampusGreeting } from './lib/use-campus-greeting';
import { useModelOverlayLayout } from './lib/use-model-overlay-layout';
import { catalogRepository } from './services/catalog';
import { getIndoorCanteen, getIndoorWindow } from './data/indoor-canteens';
import { eighthDumplingKiosk } from './data/eighth-canteen';
import { tenthDumplingKiosk } from './data/tenth-canteen';
import { eleventhDumplingKiosk } from './data/eleventh-canteen';
import type { Catalog, MapTheme, View } from './domain';

export default function App() {
  const [interfaceTheme, setInterfaceTheme] = useInterfaceTheme();
  const [data, setData] = useState<Catalog | null>(null),
    [error, setError] = useState('');
  const {
    view,
    stallId,
    showInfo,
    setStallId,
    setShowInfo,
    navigate: changeView,
  } = useAppNavigation();
  const alternateCampusGreeting = useCampusGreeting(view.level);
  const [theme] = useState<MapTheme>('garden');
  const [ninanMeal, setNinanMeal] = useState<NinanMealMode>(() => defaultNinanMealMode(interfaceTheme === 'night'));
  const visitingNinan = view.level !== 'campus' && view.venueId === 'v-hut';
  useEffect(() => {
    if (visitingNinan) setNinanMeal(defaultNinanMealMode(interfaceTheme === 'night'));
  }, [visitingNinan, interfaceTheme]);
  const [query, setQuery] = useState(''),
    [filter, setFilter] = useState('all');
  const [showMapLabels, setShowMapLabels] = useState(true);
  const scene = useRef<SceneHandle>(null);
  const search = useRef<HTMLInputElement>(null);
  const aboutDialog = useRef<HTMLElement>(null);
  const header = useRef<HTMLElement>(null);
  const mapArea = useRef<HTMLElement>(null);
  useModelOverlayLayout(mapArea);
  const [headerOpen, setHeaderOpen] = useState(true);
  const initialHeader = useRef(true);
  const exploreMap = useCallback(() => {
    if (window.matchMedia('(max-width: 700px)').matches) return;
    initialHeader.current = false;
    setHeaderOpen(false);
  }, []);
  const [mobile, setMobile] = useState(() => window.matchMedia('(max-width: 700px)').matches);
  useEffect(() => {
    const media = window.matchMedia('(max-width: 700px)');
    const changed = () => {
      setMobile(media.matches);
      initialHeader.current = true;
      setHeaderOpen(true);
    };
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
  }, [headerOpen, interfaceTheme]);
  const hideHeader = () => {
    if (showInfo) return;
    if (
      document.activeElement instanceof HTMLElement &&
      header.current?.contains(document.activeElement)
    )
      document.activeElement.blur();
    setHeaderOpen(false);
  };
  const leaveDesktopHeader = (event: React.PointerEvent) => {
    if (mobile || initialHeader.current) return;
    const next = event.relatedTarget;
    // The thin top-edge zone bridges the gap to the sliding header.
    if (
      next instanceof Element &&
      next.closest('.header, .header-reveal, .desktop-header-hoverzone')
    )
      return;
    hideHeader();
  };
  const navigate = useCallback(
    (next: View) => {
      changeView(next);
      setHighlightedVenueId(null);
    },
    [changeView],
  );
  useEffect(() => {
    setHighlightedVenueId(null);
  }, [view]);
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        // One press dismisses only the topmost surface; held keys must not skip levels.
        if (event.repeat || event.isComposing || event.defaultPrevented) return;
        event.preventDefault();
        if (showInfo) setShowInfo(false);
        else if (stallId) setStallId(null);
        else if (view.level === 'floor') navigate({ level: 'building', venueId: view.venueId });
        else if (view.level === 'building') navigate({ level: 'campus' });
        return;
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
  }, [showInfo, stallId, view, navigate]);
  useEffect(() => {
    if (!showInfo || !aboutDialog.current) return;
    const previous = document.activeElement;
    const dialog = aboutDialog.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.tabIndex = -1;
    // 先把焦点放在信件容器，打开时不让关闭键出现悬停或键盘焦点装饰。
    dialog.focus({ preventScroll: true });
    const trapFocus = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const buttons = [...dialog.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], [tabindex="0"]')]
        .filter((element) => element.getClientRects().length > 0);
      const first = buttons[0],
        last = buttons[buttons.length - 1];
      if (!first || document.activeElement === dialog) {
        event.preventDefault();
        (event.shiftKey ? last : first)?.focus();
      } else if (event.shiftKey && document.activeElement === first) {
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
      document.body.style.overflow = previousOverflow;
      const returnTarget = previous instanceof HTMLElement && previous !== document.body && previous.isConnected
        ? previous
        : document.querySelector<HTMLElement>('.header-nav .about');
      returnTarget?.focus({ preventScroll: true });
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
  const indoorCanteen = getIndoorCanteen(floor?.id);
  const isModeledFloor = !!indoorCanteen;
  const isEighthFloor = indoorCanteen?.style === 'eighth';
  const hasOfferings =
    isEighthFloor ||
    indoorCanteen?.style === 'minzu' ||
    indoorCanteen?.style === 'twelfth' ||
    indoorCanteen?.style === 'faculty' ||
    indoorCanteen?.style === 'eleventh' || indoorCanteen?.style === 'tenth';
  const isSouthCart = venue?.id === 'v-south';
  const isYifuKiosk = venue?.id === 'v-yifu';
  const isNinanHut = venue?.id === 'v-hut';
  const isSingleWindowVenue = isSouthCart || isYifuKiosk || isNinanHut;
  const cartFoodNames = southGateCartFoodNames[interfaceTheme === 'night' ? 'night' : 'day'];
  const modelWindowCount = indoorCanteen?.faces.reduce(
    (total, face) => total + face.windowCount,
    0,
  );
  const modelWindowNumber = (id: string) => {
    if (indoorCanteen?.showWindowNumbers === false) return undefined;
    const localNumber = Number(id.match(/-w(\d+)$/)?.[1]);
    const face = indoorCanteen?.faces.find((row) => row.faceId === id.replace(/-w\d+$/, ''));
    if (!face || !localNumber) return undefined;
    return face.windowNumbers?.[localNumber - 1] ?? localNumber;
  };
  const stallFace =
    indoorCanteen && stall
      ? indoorCanteen.faces.find((face) => face.faceId === stall.id.replace(/-w\d+$/, ''))
      : undefined;
  const offeringWindow =
    hasOfferings && stall ? getIndoorWindow(indoorCanteen, stall.id) : undefined;
  const sharedNumbers = offeringWindow
    ? [
        ...new Set(
          (data?.stalls ?? [])
            .map((row) => getIndoorWindow(indoorCanteen, row.id))
            .filter((row) => row?.shopId === offeringWindow.shopId)
            .flatMap((row) => row!.windowNumbers),
        ),
      ].sort((a, b) => a - b)
    : [];
  const visible = data?.venues.filter(
    (v) => (filter === 'all' || v.kind === filter) && v.name.includes(query),
  );
  return (
    <div
      className={`app floating-shell theme-${theme} view-${view.level} ${headerOpen ? 'header-open' : 'header-hidden'}${isModeledFloor || isSingleWindowVenue ? ' fourth-model-active' : ''}`}
      data-interface-theme={interfaceTheme}
    >
      {!mobile && (
        <div
          className="desktop-header-hoverzone"
          aria-hidden="true"
          onPointerEnter={() => setHeaderOpen(true)}
          onPointerLeave={leaveDesktopHeader}
        />
      )}
      <button
        className="header-reveal"
        aria-label="展开顶部导航"
        aria-controls="floating-header"
        aria-expanded={headerOpen}
        onPointerEnter={(e) => {
          if (e.pointerType === 'mouse') setHeaderOpen(true);
        }}
        onPointerLeave={leaveDesktopHeader}
        onFocus={() => setHeaderOpen(true)}
        onClick={() => setHeaderOpen(true)}
      >
        <span aria-hidden="true" />
      </button>
      <header
        ref={header}
        id="floating-header"
        className="header"
        inert={!headerOpen}
        onPointerEnter={() => setHeaderOpen(true)}
        onPointerLeave={leaveDesktopHeader}
        onFocusCapture={() => setHeaderOpen(true)}
        onBlurCapture={(event) => {
          if (
            !mobile &&
            !initialHeader.current &&
            !event.currentTarget.contains(event.relatedTarget) &&
            !event.currentTarget.matches(':hover')
          )
            setHeaderOpen(false);
        }}
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
          <button
            className="about"
            aria-label="关于食光"
            title="关于食光"
            onClick={() => setShowInfo(true)}
          >
            关于食光 <UiIcon name="arrow-up-right" size={15} />
          </button>
        </nav>
        <ThemeToggle theme={interfaceTheme} onChange={setInterfaceTheme} />
        <div className="header-location">
          <UiIcon name="pin" size={17} />
          <span>南大仙林校区</span>
        </div>
      </header>
      <main className="workspace">
        <FloatingSidebar campus={view.level === 'campus'}>
          <aside className="sidebar">
            <div className="sidebar-top">
              {view.level !== 'campus' && (
                <div className="eyebrow">
                  <span className="hero-dot" />{' '}
                  {isSingleWindowVenue
                    ? '校园里的烟火气'
                    : view.level === 'building'
                      ? '走进一栋楼，发现一餐饭'
                      : '慢慢挑，找到想吃的那一口'}
                </div>
              )}
              <h1>
                {view.level === 'campus' ? (
                  <>
                    {alternateCampusGreeting ? '是啊' : '今天'}
                    <br />
                    <span>{alternateCampusGreeting ? '吃什么？' : '去哪里吃？'}</span>
                  </>
                ) : indoorCanteen ? (
                  indoorCanteen.name
                ) : (
                  venue?.name
                )}
              </h1>
              {view.level !== 'campus' && (
                <p>
                  {isSouthCart
                    ? '开棚营业的小餐车，早餐与夜宵各有滋味。'
                    : isNinanHut
                      ? '树荫下的小屋，从一份早餐到一杯饮品。'
                    : isYifuKiosk
                      ? '地点：逸B102'
                    : view.level === 'building'
                      ? '转一转这栋建筑，选一层开始探索。'
                      : '走近窗口，看看本大王想吃些什么(๑•̀ㅂ•́)و✧'}
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
                {isNinanHut ? (
                  <div className="venue-description cart-description">
                    <span className="tiny-tag">呢喃小屋 · 四五六食堂东侧</span>
                    <h3>{ninanMeal === 'breakfast' ? '早餐 · 棚下早茶' : ninanMeal === 'lunch' ? '午餐 · 咖啡饮品' : '晚餐 · 烧烤时间'}</h3>
                    <button
                      className={`stall-card ${stallId === ninanHutStall.id ? 'selected' : ''}`}
                      onClick={() => setStallId(ninanHutStall.id)}
                    >
                      <span className="stall-number"><UiIcon name="cart" size={18} /></span>
                      <span className="stall-copy"><strong>打开小屋详情看板</strong></span>
                      <UiIcon name="chevron-right" size={16} />
                    </button>
                  </div>
                ) : isSouthCart ? (
                  <div className="venue-description cart-description">
                    <span className="tiny-tag">开棚营业 · 南门小餐车</span>
                    <p>南大门西侧的小餐车，打开遮阳棚，看看柜台上今天有什么。</p>
                    <h3>{interfaceTheme === 'night' ? '夜晚 · 炸串时间' : '白天 · 早餐时光'}</h3>
                    <p>
                      {interfaceTheme === 'night'
                        ? '餐台亮起暖灯，肉串、香肠、蔬菜与豆制品摆上柜台。'
                        : '汉堡、饭团与玉米，配上茶叶蛋和一杯咖啡。'}
                    </p>
                    <div className="cart-food-tags">
                      {cartFoodNames.map((name) => (
                        <span key={name}>{name}</span>
                      ))}
                    </div>
                    <button
                      className={`stall-card ${stallId === southGateCartStall.id ? 'selected' : ''}`}
                      onClick={() => setStallId(southGateCartStall.id)}
                    >
                      <span className="stall-number"><UiIcon name="cart" size={18} /></span>
                      <span className="stall-copy"><strong>查看餐车窗口</strong></span>
                      <UiIcon name="chevron-right" size={16} />
                    </button>
                    <p>点击餐车查看详情 · 单击右键进入旋转模式</p>
                  </div>
                ) : isYifuKiosk ? (
                  <div className="venue-description cart-description">
                    <span className="tiny-tag">B102 休闲食坊 · 一个售卖窗口</span>
                    <p>红灯笼下的热餐台，窗边的木椅，还有亮着灯的饮品冰柜。</p>
                    <h3>逸夫楼里的日常一餐</h3>
                    <div className="cart-food-tags">
                      {yifuKioskFoodNames.map((name) => <span key={name}>{name}</span>)}
                    </div>
                    <button
                      className={`stall-card ${stallId === yifuKioskStall.id ? 'selected' : ''}`}
                      onClick={() => setStallId(yifuKioskStall.id)}
                    >
                      <span className="stall-number"><UiIcon name="cart" size={18} /></span>
                      <span className="stall-copy"><strong>查看售卖点窗口</strong></span>
                      <UiIcon name="chevron-right" size={16} />
                    </button>
                    <p>点击售卖点查看详情 · 上方切换俯视图与 3D</p>
                  </div>
                ) : (
                  <>
                    <div className="list-heading">
                      <strong>{view.level === 'building' ? '选择楼层' : '本层窗口'}</strong>
                      <span>
                        {view.level === 'building'
                          ? '点击楼层进入'
                          : indoorCanteen?.style === 'ninth'
                            ? '双排店面 · 11 家店铺'
                            : indoorCanteen
                              ? `${indoorCanteen.faces.length} 个${indoorCanteen.style === 'sixth' ? '窗口区' : '牌坊'} · ${modelWindowCount} 个窗口${['eighth', 'eleventh', 'tenth'].includes(indoorCanteen.style) ? ' · 独立水饺超市' : ''}`
                              : `${floor?.name} · 示例布局`}
                      </span>
                    </div>
                    <div className="venue-list">
                      {view.level === 'building'
                        ? data?.floors
                            .filter((f) => f.venueId === venue?.id)
                            .map((f) => {
                              const canteen = getIndoorCanteen(f.id);
                              return (
                                <button
                                  className="floor-card"
                                  key={f.id}
                                  onClick={() =>
                                    navigate({ level: 'floor', venueId: f.venueId, floorId: f.id })
                                  }
                                >
                                  <b>{canteen ? `${f.level}F` : f.name}</b>
                                  <span>
                                    {canteen?.name || '示例餐饮空间'}
                                  </span>
                                  <UiIcon name="arrow-right" size={19} />
                                </button>
                              );
                            })
                        : data?.stalls
                            .filter((s) => s.floorId === floor?.id)
                            .map((s, i) => (
                              <button
                                key={s.id}
                                className={`stall-card ${stallId === s.id ? 'selected' : ''}`}
                                onClick={() => setStallId(s.id)}
                              >
                                <span className="stall-number">
                                  {indoorCanteen?.style === 'fourth' ? (
                                    <UiIcon name="pin" size={19} />
                                  ) : s.id === eighthDumplingKiosk.id ||
                                  s.id === eleventhDumplingKiosk.id || s.id === tenthDumplingKiosk.id ? (
                                    <UiIcon name="cart" size={19} />
                                  ) : (
                                    String(modelWindowNumber(s.id) ?? i + 1).padStart(2, '0')
                                  )}
                                </span>
                                <span>
                                  <strong>{s.name}</strong>
                                </span>
                                <UiIcon name="arrow-right" size={19} />
                              </button>
                            ))}
                    </div>
                  </>
                )}
              </>
            )}
            <div className="sidebar-bottom">
              <span className="mini-spark">
                <UiIcon name="sparkles" size={22} />
              </span>
              <p>
                一份慢慢完善的校园食记<small>菜单与真实评价，正在准备中。</small>
              </p>
            </div>
          </aside>
        </FloatingSidebar>
        <section
          ref={mapArea}
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
                nightMode={interfaceTheme === 'night'}
                highlightedVenueId={highlightedVenueId}
                onHighlightVenue={highlightVenue}
                onExplore={mobile ? undefined : exploreMap}
                legacyMobile={mobile}
              />
            ) : (
              <MapScene
                ref={scene}
                data={data}
                view={view}
                theme={theme}
                interfaceTheme={interfaceTheme}
                ninanMeal={ninanMeal}
                onNinanMealChange={setNinanMeal}
                selectedStall={stallId}
                onExplore={mobile ? undefined : exploreMap}
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
            {view.level !== 'campus' && !isModeledFloor && (
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
          {stall && (
            <DraggableDetailPanel>
            <aside key={stall.id} className="detail-panel" aria-label="窗口详情">
              <div
                className="detail-top"
                tabIndex={0}
                aria-label="窗口详情移动栏，可拖动或使用方向键移动"
                title="拖动标题栏移动卡片，也可聚焦后用方向键移动"
              >
                <span className="tiny-tag">{isModeledFloor || isSingleWindowVenue ? '窗口信息' : '示例窗口'}</span>
                <span className="detail-drag-hint" aria-hidden="true">拖动移位</span>
                <button aria-label="关闭窗口详情" onClick={() => setStallId(null)}>
                  <UiIcon name="close" size={19} />
                </button>
              </div>
              <h2>{hasOfferings ? stall.name : stallFace?.name || stall.name}</h2>
              {isNinanHut && <NinanHutDetails meal={ninanMeal} onMealChange={setNinanMeal} />}
              {isSouthCart && (
                <>
                  <p className="detail-location">南大门西侧 · 餐车售餐点</p>
                  <h3>{interfaceTheme === 'night' ? '夜晚 · 炸串时间' : '白天 · 早餐时光'}</h3>
                  <div className="cart-food-tags">
                    {cartFoodNames.map((name) => <span key={name}>{name}</span>)}
                  </div>
                </>
              )}
              {isYifuKiosk && (
                <>
                  <p className="detail-location">逸夫楼 B102 · 休闲食坊</p>
                  {yifuKioskOfferings.map((offering) => (
                    <div key={offering.category}>
                      <h3>{offering.category}</h3>
                      <div className="cart-food-tags">
                        {offering.names.map((name) => <span key={name}>{name}</span>)}
                      </div>
                    </div>
                  ))}
                  <p className="detail-location">{yifuKioskServiceNote}</p>
                  <small>餐品信息来自现场招牌，实际供应以现场为准。</small>
                </>
              )}
              {indoorCanteen && (
                <p className="detail-location">
                  {indoorCanteen.name} ·{' '}
                  {indoorCanteen.style === 'ninth'
                    ? '3F · 连续售餐区'
                    : hasOfferings
                      ? offeringWindow
                        ? `${offeringWindow.windowNumbers.join('、')}号窗口 · 牌坊：${offeringWindow.signName}`
                        : '独立水饺超市'
                      : indoorCanteen.showWindowNumbers === false
                        ? stallFace?.pickup
                          ? '侧面取餐口'
                          : stall.name.split(' · ').at(-1)
                        : `${modelWindowNumber(stall.id)}号窗口`}
                </p>
              )}
              {indoorCanteen?.style === 'ninth' && (
                <div className="ninth-stall-info">
                  <span className="tiny-tag">主营品类</span>
                  <p>{stall.category}</p>
                  {stall.id.includes('yue-qing-he') && <p>南面与西面是同一家店的连续转角柜台。</p>}
                  {stall.id.includes('roujiamo') && <p>从门面进入内凹区域，点餐柜台位于里面。</p>}
                  {stall.id.includes('pizza-hut') && (
                    <p>玻璃门面与相邻 Pizza Hut 红色装饰墙属于同一家店。</p>
                  )}
                  <small>牌坊文字依实拍保留，具体菜单与价格待补充。</small>
                </div>
              )}
              {hasOfferings && (
                <>
                  <h3>实际售卖</h3>
                  <p>
                    {stall.category === '待补充'
                      ? '餐品信息待补充'
                      : (offeringWindow?.offering ?? stall.category)}
                  </p>
                  {sharedNumbers.length > 1 && (
                    <p className="detail-location">同一档口：{sharedNumbers.join('、')} 号窗口</p>
                  )}
                  {indoorCanteen?.style === 'minzu' && (offeringWindow?.windowNumber ?? 0) >= 8 && (
                    <p className="detail-location">两组自选菜均可在 8、9、10 号窗口购买。</p>
                  )}
                  {stall.breakfast && (
                    <p className="detail-location">供应早餐 · 暖心早餐专用窗口</p>
                  )}
                </>
              )}
              {!isModeledFloor && !isSingleWindowVenue && (
                <>
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
                </>
              )}
            </aside>
            </DraggableDetailPanel>
          )}
        </section>
      </main>
      {showInfo && (
        <AboutLetter
          dialogRef={aboutDialog}
          onClose={() => setShowInfo(false)}
          night={interfaceTheme === 'night'}
        />
      )}
    </div>
  );
}
