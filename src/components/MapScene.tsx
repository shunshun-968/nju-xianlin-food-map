import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { tenthDumplingKiosk } from '../data/tenth-canteen';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { themes, type Catalog, type MapTheme, type View } from '../domain';
import {
  getIndoorCanteen,
  fourthCanteenSpec,
  type IndoorCanteenSpec,
} from '../data/indoor-canteens';
import type { FourthCanteenModel, FourthViewMode } from './FourthCanteenModel';
import type { InterfaceTheme } from '../lib/use-interface-theme';
import './fourth-canteen.css';
import type { NinanHutModel } from './NinanHutModel';
import { NinanMealTabs } from './NinanHutDetails';
import { ninanHutStall, type NinanMealMode } from '../data/ninan-hut';
import './ninan-hut-marker.css';
import { batchModel } from '../lib/model-batches';
import { attachModelMouseControls } from '../lib/model-mouse-controls';
import { createStallPickTargets } from '../lib/stall-picking';
import { createStallSelection } from '../lib/stall-selection';
import { createYifuKioskSelection } from '../lib/yifu-kiosk-selection';
import { createYifuKioskPickTargets } from '../lib/yifu-kiosk-picking';
import { createNinanHutPickTargets } from '../lib/ninan-hut-picking';
import { createNinanHutSelection } from '../lib/ninan-hut-selection';
import { createSouthGateCartSelection } from '../lib/south-gate-cart-selection';
import { createModelClickGesture } from '../lib/model-click-gesture';
import { YIFU_BROAD_LIGHTS } from '../data/yifu-lighting';
import { eighthDumplingKiosk } from '../data/eighth-canteen';
import { eleventhDumplingKiosk } from '../data/eleventh-canteen';
import { southGateCartStall } from '../data/south-gate-cart';
import { yifuKioskStall } from '../data/yifu-kiosk';
import { exteriorBuildings, exteriorFrame, loadExteriorModel, pickExteriorFloor } from '../data/exterior-buildings';
import type { ExteriorModel } from '../models/exteriors/types';
import { createExteriorEntranceMarkers } from '../lib/exterior-entrance-markers';
import './exterior-entrance-markers.css';
import { ModelCompass } from './ModelCompass';
import { getModelNorth } from '../data/model-orientation';
import { modelCompassPose, compassLetterPosition } from '../lib/model-compass';
import { prepareSceneModel } from '../lib/scene-loading';
import { modelAssets } from '../lib/progressive-model-assets';
import { modelPhase } from '../lib/scene-performance';
import { LoadingProgress } from './LoadingProgress';

export type SceneHandle = { zoom: (factor: number) => void; reset: () => void; rotate: () => void };
type Props = {
  data: Catalog;
  view: Exclude<View, { level: 'campus' }>;
  theme: MapTheme;
  onPick: (kind: string, id: string) => void;
  onExplore?: () => void;
  selectedStall: string | null;
  interfaceTheme?: InterfaceTheme;
  ninanMeal?: NinanMealMode;
  onNinanMealChange?: (meal: NinanMealMode) => void;
  paused?: boolean;
};
type Engine = {
  scene: THREE.Scene;
  camera: THREE.OrthographicCamera;
  renderer: THREE.WebGLRenderer;
  controls: OrbitControls;
  mouse: ReturnType<typeof attachModelMouseControls>;
  stallTargets?: ReturnType<typeof createStallPickTargets>;
  stallSelection?: ReturnType<typeof createStallSelection>;
  content: THREE.Group;
  goal: THREE.Vector3;
  focus: THREE.Vector3;
  animating: boolean;
  range: number;
  followDefault: boolean;
  frameGoal?: Engine['defaultFrame'];
  defaultFrame?: {
    range: number;
    halfWidth: number;
    left: number;
    top: number;
    width: number;
    height: number;
  };
  fourth?: FourthCanteenModel;
  exterior?: ExteriorModel;
  entranceMarkers?: ReturnType<typeof createExteriorEntranceMarkers>;
  fourthMode?: FourthViewMode;
  indoorSpec?: IndoorCanteenSpec;
  indoorEnvironment?: THREE.WebGLRenderTarget;
  keyLight: THREE.DirectionalLight;
  ambientLight: THREE.HemisphereLight;
  models: Map<string, FourthCanteenModel>;
  preparing?: boolean;
  firstModelFrame?: (renderStarted: number) => void;
};

function lightExterior(e: Engine, night: boolean) {
  e.exterior?.setNight(night);
  e.scene.background = new THREE.Color(night ? '#111b2d' : '#f4f1ec');
  e.scene.environmentIntensity = night ? 0.09 : 0.28;
  e.ambientLight.intensity = night ? 0.48 : 1.5;
  e.ambientLight.color.set(night ? '#adc7ed' : '#ffffff');
  e.ambientLight.groundColor.set(night ? '#25324a' : '#9da495');
  e.keyLight.intensity = night ? 0.65 : 1.7;
  e.keyLight.color.set(night ? '#b2cbf5' : '#ffffff');
  e.renderer.toneMappingExposure = night ? 0.95 : 1;
  e.renderer.shadowMap.needsUpdate = true;
}

/** Fit the default view to the clear area; manual views keep their own framing. */
function captureDefaultFrame(e: Engine, range: number, halfWidth: number) {
  const canvas = e.renderer.domElement;
  const map = canvas.closest<HTMLElement>('.map-area');
  const width = Math.max(1, canvas.clientWidth);
  const height = Math.max(1, canvas.clientHeight);
  let left = 16;
  let top = 32;
  let bottom = 32;
  if (map) {
    const bounds = map.getBoundingClientRect();
    const originY = bounds.top + map.clientTop;
    left = parseFloat(getComputedStyle(map).getPropertyValue('--model-overlay-left')) || 16;
    for (const selector of ['.breadcrumbs', '.fourth-view-controls', '.fourth-view-note']) {
      const overlay = map.querySelector<HTMLElement>(selector);
      if (overlay?.offsetHeight)
        top = Math.max(top, overlay.getBoundingClientRect().bottom - originY + 20);
    }
    if (window.matchMedia('(max-width: 700px)').matches) {
      const drawer = map.closest('.app')?.querySelector<HTMLElement>('.sidebar-dock');
      if (drawer) bottom = Math.max(bottom, height - (drawer.getBoundingClientRect().top - originY) + 12);
    }
  }
  left = Math.min(left, width * 0.6);
  top = Math.min(top, height * 0.45);
  bottom = Math.min(bottom, Math.max(32, height - top - Math.min(180, height * 0.35)));
  const right = 16;
  e.defaultFrame = {
    range,
    halfWidth,
    left: left / width,
    top: top / height,
    width: Math.max(1, width - left - right) / width,
    height: Math.max(1, height - top - bottom) / height,
  };
}

function updateProjection(e: Engine, width = e.renderer.domElement.clientWidth, height = e.renderer.domElement.clientHeight) {
  const aspect = Math.max(1, width) / Math.max(1, height);
  const framing = e.defaultFrame;
  let shiftX = 0;
  let shiftY = 0;
  if (framing) {
    e.range = Math.max(
      framing.range / framing.height,
      framing.halfWidth / (aspect * framing.width),
    );
    // An off-center camera projection keeps the orbit target at the model's
    // real center while placing its initial image clear of the floating bars.
    shiftX = -(framing.left + framing.width / 2 - 0.5) * 2 * e.range * aspect;
    shiftY = (framing.top + framing.height / 2 - 0.5) * 2 * e.range;
  }
  e.camera.left = -e.range * aspect + shiftX;
  e.camera.right = e.range * aspect + shiftX;
  e.camera.top = e.range + shiftY;
  e.camera.bottom = -e.range + shiftY;
  e.camera.updateProjectionMatrix();
}

function frameFourth(e: Engine, mode: FourthViewMode) {
  e.followDefault = true;
  e.frameGoal = undefined;
  e.mouse.reset();
  const framing = e.indoorSpec?.frame ?? fourthCanteenSpec.frame;
  e.fourthMode = mode;
  if (e.indoorSpec?.id === 'v-yifu') {
    e.renderer.domElement.setAttribute('aria-label', mode === 'plan'
      ? '逸夫楼 B102 俯视图，保留四面墙与南侧门，点击售卖点查看窗口信息，可拖动和缩放'
      : '逸夫楼 B102 三维模型，南侧敞开，点击售卖点查看窗口信息，可拖动平移、单击右键旋转、滚轮缩放');
  }
  e.stallTargets?.setMode(mode);
  e.stallSelection?.setMode(mode);
  if (e.stallSelection) e.stallSelection.withLightingUpdate(() => e.fourth?.setMode(mode));
  else e.fourth?.setMode(mode);
  e.animating = false;
  e.controls.enableDamping = false;
  e.controls.update();
  e.controls.enableRotate = mode === '3d';
  e.controls.zoomToCursor = true;
  e.controls.maxZoom = 14;
  e.controls.minPolarAngle = 0;
  // 餐车可降到顾客平视高度；室内保留微俯视，方便看清柜台与布局。
  e.controls.maxPolarAngle = ['v-south', 'v-yifu'].includes(e.indoorSpec?.id ?? '') ? Math.PI / 2 : Math.PI / 2.05;
  e.controls.target.set(framing.x, 0.7, framing.z);
  if (mode === 'plan') {
    e.controls.target.set(framing.x, 0, framing.z);
    e.camera.position.set(framing.x, 45, framing.z + 0.0001);
  } else if (e.indoorSpec?.id === 'v-south') {
    e.controls.target.set(0, 1.6, 0.25);
    e.camera.position.set(-8.8, 5.6, 11.7);
  } else if (e.indoorSpec?.id === 'v-yifu') {
    e.controls.target.set(0, 1, 0);
    e.camera.position.set(7, 6, 11);
  } else if (e.indoorSpec?.id === 'v-hut') {
    e.controls.target.set(1.8, 1.4, 1.2);
    e.camera.position.set(18, 13, 20);
  } else {
    const offset = framing.spatialOffset ?? { x: -25, y: 17.5, z: 36 };
    e.camera.position.set(framing.x + offset.x, offset.y, framing.z + offset.z);
  }
  e.goal.copy(e.camera.position);
  e.focus.copy(e.controls.target);
  e.camera.zoom = 1;
  captureDefaultFrame(
    e,
    mode === 'plan' ? framing.planRange : framing.spatialRange,
    framing.halfWidth,
  );
  updateProjection(e);
  e.controls.update();
  e.controls.enableDamping = true;
  e.renderer.shadowMap.needsUpdate = true;
}

function box(
  parent: THREE.Object3D,
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  d: number,
  color: string,
  pick?: { kind: string; id: string },
) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({ color, roughness: 0.9 }),
  );
  mesh.position.set(x, y + h / 2, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  if (pick) mesh.userData = { ...pick, baseColor: color };
  parent.add(mesh);
  return mesh;
}
function label(
  parent: THREE.Object3D,
  text: string,
  x: number,
  y: number,
  z: number,
  color: string,
  size = 7,
  pill = false,
) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 112;
  const c = canvas.getContext('2d')!;
  c.font = '500 56px "Microsoft YaHei", sans-serif';
  canvas.width = Math.ceil(c.measureText(text).width + 60);
  c.font = '500 56px "Microsoft YaHei", sans-serif';
  if (pill) {
    c.fillStyle = '#fffcf7';
    c.beginPath();
    c.roundRect(4, 5, canvas.width - 8, 100, 20);
    c.fill();
  }
  c.fillStyle = color;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText(text, canvas.width / 2, 56);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: texture, depthTest: false, toneMapped: false }),
  );
  sprite.position.set(x, y, z);
  sprite.scale.set((size * 2 * canvas.width) / 112, size * 2, 1);
  sprite.renderOrder = 10;
  parent.add(sprite);
  return sprite;
}
function path(parent: THREE.Object3D, points: number[][], color: string, width: number, y = 0.12) {
  for (let i = 1; i < points.length; i++) {
    const [a, b] = [points[i - 1], points[i]];
    const segment = box(
      parent,
      (a[0] + b[0]) / 2,
      y,
      (a[1] + b[1]) / 2,
      width,
      0.06,
      Math.hypot(a[0] - b[0], a[1] - b[1]),
      color,
    );
    segment.rotation.y = Math.atan2(b[0] - a[0], b[1] - a[1]);
    segment.castShadow = false;
  }
}
function dispose(group: THREE.Group) {
  modelAssets(group)?.dispose();
  group.traverse((obj) => {
    const renderable = obj as THREE.Mesh;
    renderable.geometry?.dispose();
    const materials = renderable.material
      ? Array.isArray(renderable.material)
        ? renderable.material
        : [renderable.material]
      : [];
    materials.forEach((material) => {
      (material as THREE.MeshStandardMaterial).map?.dispose();
      material.dispose();
    });
  });
  group.clear();
}

export const MapScene = forwardRef<SceneHandle, Props>(function MapScene(
  { data, view, theme, onPick, onExplore, selectedStall, interfaceTheme = 'day', ninanMeal = 'breakfast', onNinanMealChange, paused = false },
  ref,
) {
  const host = useRef<HTMLDivElement>(null),
    engine = useRef<Engine | null>(null),
    callback = useRef(onPick);
  const explore = useRef(onExplore);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const compass = useRef<HTMLDivElement>(null);
  const ninanMealRef = useRef(ninanMeal);
  ninanMealRef.current = ninanMeal;
  const north = getModelNorth(view);
  const compassNorth = useRef(north);
  compassNorth.current = north;
  explore.current = onExplore;
  const [error, setError] = useState(false);
  const [loadingModel, setLoadingModel] = useState(true);
  const [modelProgress, setModelProgress] = useState(0.12);
  const [fourthView, setFourthView] = useState<FourthViewMode>('plan');
  const [rotationMode, setRotationMode] = useState(false);
  const floorId = view.level === 'floor' ? view.floorId : undefined;
  const modeledCanteen = getIndoorCanteen(floorId);
  const isFourthFloor = !!modeledCanteen;
  const isYifuKiosk = view.venueId === 'v-yifu';
  const isNinanHut = view.venueId === 'v-hut';
  const isCart = view.venueId === 'v-south' || isYifuKiosk || isNinanHut;
  const isExterior = view.level === 'building' && !!exteriorBuildings[view.venueId];
  const interfaceThemeRef = useRef(interfaceTheme);
  const selectedStallRef = useRef(selectedStall);
  selectedStallRef.current = selectedStall;
  interfaceThemeRef.current = interfaceTheme;
  callback.current = onPick;
  useImperativeHandle(ref, () => ({
    zoom(factor) {
      explore.current?.();
      const e = engine.current;
      if (e) {
        e.followDefault = false;
        e.frameGoal = undefined;
        e.camera.zoom = THREE.MathUtils.clamp(e.camera.zoom * factor, 0.55, e.fourth ? 14 : 4);
        e.camera.updateProjectionMatrix();
      }
    },
    reset() {
      explore.current?.();
      const e = engine.current;
      if (e) {
        e.mouse.reset();
        e.controls.autoRotate = false;
        if (e.fourth) {
          frameFourth(e, e.fourthMode || 'plan');
          return;
        }
        e.camera.zoom = 1;
        e.followDefault = true;
        e.frameGoal = undefined;
        captureDefaultFrame(e, e.defaultFrame?.range ?? e.range, e.defaultFrame?.halfWidth ?? e.range);
        updateProjection(e);
        e.animating = true;
      }
    },
    rotate() {
      explore.current?.();
      const e = engine.current;
      if (e) {
        if (e.fourth && e.fourthMode === 'plan') {
          return;
        }
        e.followDefault = false;
        e.frameGoal = undefined;
        e.animating = false;
        const offset = e.camera.position
          .clone()
          .sub(e.controls.target)
          .applyAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 4);
        e.camera.position.copy(e.controls.target).add(offset);
      }
    },
  }));
  useEffect(() => {
    if (!host.current) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    } catch {
      setError(true);
      setLoadingModel(false);
      return;
    }
    const element = host.current;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.shadowMap.autoUpdate = false;
    renderer.domElement.setAttribute(
      'aria-label',
      '食堂三维示意场景；可使用左侧列表选择楼层和窗口',
    );
    element.append(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-80, 80, 80, -80, 0.1, 1200);
    camera.position.set(0, 160, 95);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.maxPolarAngle = Math.PI / 2.15;
    controls.minZoom = 0.55;
    controls.maxZoom = 4;
    controls.mouseButtons = {
      LEFT: THREE.MOUSE.PAN,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.ROTATE,
    };
    controls.touches = { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_ROTATE };
    const interact = () => {
      explore.current?.();
      if (engine.current) engine.current.animating = false;
      controls.autoRotate = false;
    };
    const mouse = attachModelMouseControls(renderer.domElement, controls, interact, setRotationMode);
    const content = new THREE.Group();
    scene.add(content);
    const ambientLight = new THREE.HemisphereLight('#ffffff', '#9da495', 1.5);
    scene.add(ambientLight);
    const light = new THREE.DirectionalLight('#ffffff', 1.7);
    light.position.set(-80, 160, 60);
    light.castShadow = true;
    light.shadow.mapSize.set(2048, 2048);
    Object.assign(light.shadow.camera, { left: -120, right: 120, top: 120, bottom: -120 });
    light.shadow.bias = -0.002;
    scene.add(light);
    const e: Engine = {
      scene,
      camera,
      renderer,
      controls,
      mouse,
      content,
      goal: camera.position.clone(),
      focus: new THREE.Vector3(),
      animating: true,
      range: 94,
      followDefault: true,
      keyLight: light,
      ambientLight,
      models: new Map(),
    };
    engine.current = e;
    const map = element.closest<HTMLElement>('.map-area');
    const followOverlays = () => {
      if (!e.followDefault || !e.defaultFrame) return;
      const current = e.defaultFrame;
      captureDefaultFrame(e, current.range, current.halfWidth);
      e.frameGoal = e.defaultFrame;
      e.defaultFrame = current;
    };
    map?.addEventListener('foodmap:model-layout', followOverlays);
    const resize = () => {
      const { width, height } = element.getBoundingClientRect();
      if (!height || !width) return;
      updateProjection(e, width, height);
      renderer.setSize(width, height);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    resize();
    controls.addEventListener('start', interact);
    const raycaster = new THREE.Raycaster(),
      pointer = new THREE.Vector2();
    const serviceClick = createModelClickGesture<THREE.Ray>();
    const snapshotClick = () => ['v-yifu', 'v-hut'].includes(e.indoorSpec?.id ?? '');
    const pointerRay = (event: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.set(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        (-(event.clientY - rect.top) / rect.height) * 2 + 1,
      );
      raycaster.setFromCamera(pointer, camera);
    };
    let start: [number, number] | null = null;
    const down = (event: PointerEvent) => {
      if (snapshotClick() && !mouse.isActive()) {
        // 顶栏收起会平移默认取景。保留按下瞬间的射线，避免松开时目标已移动而漏点。
        pointerRay(event);
        serviceClick.down(event, raycaster.ray.clone());
      }
      explore.current?.();
      start = event.button === 0 && !mouse.isActive() ? [event.clientX, event.clientY] : null;
    };
    const move = (event: PointerEvent) => {
      if (snapshotClick()) serviceClick.move(event);
    };
    const cancel = (event: PointerEvent) => {
      start = null;
      serviceClick.cancel(event);
    };
    const up = (event: PointerEvent) => {
      const origin = start;
      start = null;
      if (snapshotClick()) {
        const ray = serviceClick.up(event);
        if (!ray || mouse.isActive()) return;
        raycaster.ray.copy(ray);
      } else {
        if (
        !origin ||
        mouse.isActive() ||
        event.button !== 0 ||
        Math.hypot(event.clientX - origin[0], event.clientY - origin[1]) > 6
        ) return;
        pointerRay(event);
      }
      if (e.exterior) {
        const floorId = pickExteriorFloor(e.exterior, raycaster);
        if (floorId) callback.current('floor', floorId);
        return;
      }
      const stallId = e.stallTargets?.pick(raycaster);
      if (stallId) {
        e.stallSelection?.select(stallId, true);
        callback.current('stall', stallId);
        return;
      }
      const hit = raycaster.intersectObjects(content.children, true).find((h) => {
        if (!h.object.userData.kind) return false;
        let object: THREE.Object3D | null = h.object;
        while (object) {
          if (!object.visible) return false;
          object = object.parent;
        }
        return true;
      });
      if (hit) {
        if (hit.object.userData.kind === 'stall')
          e.stallSelection?.select(hit.object.userData.id, true);
        callback.current(hit.object.userData.kind, hit.object.userData.id);
      }
    };
    renderer.domElement.addEventListener('pointerdown', down);
    renderer.domElement.addEventListener('pointermove', move);
    renderer.domElement.addEventListener('pointerup', up);
    renderer.domElement.addEventListener('pointercancel', cancel);
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let previousFrame = 0;
    renderer.setAnimationLoop((time) => {
      const delta = previousFrame ? Math.min((time - previousFrame) / 1000, 0.08) : 0;
      previousFrame = time;
      // 信件遮罩打开时保留最后一帧，避免后台三维动画持续占用手机 GPU。
      if (document.hidden || e.preparing || pausedRef.current) return;
      if (e.animating) {
        const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        camera.position.lerp(e.goal, reduce ? 1 : 0.085);
        controls.target.lerp(e.focus, reduce ? 1 : 0.085);
        if (camera.position.distanceTo(e.goal) < 0.03) e.animating = false;
      }
      controls.update(delta);
      // Ignore clicks that leave the camera unchanged. Only actual navigation
      // releases the default framing, so opening a window card does not pin it.
      if (e.followDefault && !e.animating && (
        camera.position.distanceTo(e.goal) > 0.08 ||
        controls.target.distanceTo(e.focus) > 0.08 ||
        Math.abs(camera.zoom - 1) > 0.001 || controls.autoRotate
      )) {
        e.followDefault = false;
        e.frameGoal = undefined;
      }
      if (e.followDefault && e.defaultFrame && e.frameGoal) {
        const amount = reducedMotion.matches ? 1 : 1 - Math.exp(-delta * 14);
        let remaining = 0;
        for (const key of ['left', 'top', 'width', 'height'] as const) {
          e.defaultFrame[key] = THREE.MathUtils.lerp(e.defaultFrame[key], e.frameGoal[key], amount);
          remaining = Math.max(remaining, Math.abs(e.defaultFrame[key] - e.frameGoal[key]));
        }
        if (remaining < 0.0001) {
          e.defaultFrame = e.frameGoal;
          e.frameGoal = undefined;
        }
        updateProjection(e);
      }
      if (!reducedMotion.matches) e.fourth?.tick(time / 1000);
      e.stallSelection?.tick(delta, reducedMotion.matches);
      const renderStarted = e.firstModelFrame ? performance.now() : 0;
      renderer.render(scene, camera);
      const firstModelFrame = e.firstModelFrame;
      e.firstModelFrame = undefined;
      firstModelFrame?.(renderStarted);
      e.entranceMarkers?.update(camera);
      if (compass.current) {
        const pose = modelCompassPose(camera, compassNorth.current ?? { x: 0, z: -1 });
        const degrees = pose.bearing.toFixed(2), scale = pose.scale.toFixed(4);
        const signature = `${degrees}/${scale}/${pose.groundScale.toFixed(4)}/${!!compassNorth.current}`;
        if (compass.current.dataset.pose !== signature) {
          compass.current.style.setProperty('--model-bearing', `${degrees}deg`);
          compass.current.style.setProperty('--model-plane-scale', scale);
          compass.current.style.setProperty('--model-edge-mix', pose.edgeMix.toFixed(4));
          compass.current.dataset.bearing = degrees;
          compass.current.dataset.pose = signature;
          compass.current.dataset.groundScale = pose.groundScale.toFixed(4);
          compass.current.dataset.presentation = pose.edgeMix > 0.01 ? 'horizon' : 'roof-plane';
          for (const letter of compass.current.querySelectorAll<SVGTextElement>('[data-direction]')) {
            const point = compassLetterPosition(pose.bearing, pose.scale, Number(letter.dataset.direction));
            letter.setAttribute('x', point.x.toFixed(3));
            letter.setAttribute('y', point.y.toFixed(3));
          }
        }
      }
      if (import.meta.env.DEV)
        renderer.domElement.dataset.drawCalls = String(renderer.info.render.calls);
    });
    return () => {
      observer.disconnect();
      map?.removeEventListener('foodmap:model-layout', followOverlays);
      renderer.setAnimationLoop(null);
      renderer.domElement.removeEventListener('pointerdown', down);
      renderer.domElement.removeEventListener('pointermove', move);
      renderer.domElement.removeEventListener('pointerup', up);
      renderer.domElement.removeEventListener('pointercancel', cancel);
      serviceClick.clear();
      mouse.dispose();
      controls.dispose();
      e.stallSelection?.dispose();
      e.fourth?.group.removeFromParent();
      e.entranceMarkers?.dispose();
      e.exterior?.group.removeFromParent();
      e.exterior?.dispose();
      dispose(content);
      for (const model of e.models.values()) dispose(model.group);
      e.models.clear();
      renderer.dispose();
      e.indoorEnvironment?.dispose();
      element.removeChild(renderer.domElement);
      engine.current = null;
    };
  }, []);

  useEffect(() => {
    const e = engine.current;
    if (!e) return;
    const { content, scene, camera, controls } = e;
    e.mouse.reset();
    const t = themes[theme];
    controls.autoRotate = false;
    controls.autoRotateSpeed = 0.65;
    e.preparing = false;
    setError(false);
    setLoadingModel(true);
    setModelProgress(0.12);
    e.entranceMarkers?.dispose();
    e.entranceMarkers = undefined;
    if (e.exterior) {
      e.exterior.group.removeFromParent();
      e.exterior.dispose();
      e.exterior = undefined;
    }
    e.firstModelFrame = undefined;
    if (e.fourth) {
      modelAssets(e.fourth.group)?.pause();
      e.fourth.group.removeFromParent();
    }
    e.fourth = undefined;
    e.indoorSpec = undefined;
    e.defaultFrame = undefined;
    e.frameGoal = undefined;
    e.followDefault = true;
    e.stallTargets = undefined;
    e.stallSelection?.dispose();
    e.stallSelection = undefined;
    scene.environment = null;
    scene.environmentIntensity = 1;
    controls.zoomToCursor = false;
    controls.maxZoom = 4;
    // 建筑外观允许降至平视，便于看进第九食堂等深门廊；不绕到建筑底面。
    controls.minPolarAngle = 0;
    controls.maxPolarAngle = view.level === 'building' ? Math.PI / 2 : Math.PI / 2.15;
    e.ambientLight.intensity = 1.5;
    e.ambientLight.visible = true;
    e.keyLight.visible = true;
    e.renderer.toneMappingExposure = 1;
    e.ambientLight.color.set('#ffffff');
    e.ambientLight.groundColor.set('#9da495');
    e.keyLight.intensity = 1.7;
    e.keyLight.color.set('#ffffff');
    e.keyLight.shadow.normalBias = 0;
    e.keyLight.shadow.bias = -0.002;
    Object.assign(e.keyLight.shadow.camera, { left: -120, right: 120, top: 120, bottom: -120 });
    e.keyLight.shadow.camera.updateProjectionMatrix();
    dispose(content);
    e.renderer.shadowMap.needsUpdate = true;
    scene.background = new THREE.Color(t.ground);
    camera.zoom = 1;
    const spec = getIndoorCanteen(view.level === 'floor' ? view.floorId : undefined);
    let cancelled = false;
    let frame = 0;
    let finishPaint: (() => void) | undefined;
    const showPreparation = () => new Promise<void>((resolve) => {
      finishPaint = resolve;
      frame = requestAnimationFrame(() => {
        frame = requestAnimationFrame(() => {
          finishPaint = undefined;
          resolve();
        });
      });
    });
    if (spec || view.venueId === 'v-south' || view.venueId === 'v-yifu' || view.venueId === 'v-hut') {
      const activate = async () => {
        e.preparing = true;
        const started = performance.now();
        const id = spec?.id ?? view.venueId;
        let model = e.models.get(id);
        const cached = !!model;
        if (!model) {
          const createModel = await prepareSceneModel(view);
          if (cancelled) return;
          if (!createModel) throw new Error('未找到场所模型');
          setModelProgress(0.42);
          // 新几何体同步构建前让提示绘制一次；缓存模型不增加等待。
          await showPreparation();
          if (cancelled) return;
          const createStarted = performance.now();
          model = createModel();
          modelPhase(id, 'model-create', createStarted);
          if (spec && spec.style !== 'tenth') batchModel(model.group);
          e.models.set(id, model);
        }
        if (cancelled) return;
        setModelProgress(0.56);
        model.group.traverse((node) => {
          if (node instanceof THREE.Mesh && node.userData.baseColor)
            (node.material as THREE.MeshStandardMaterial).color.set(node.userData.baseColor);
        });
        e.renderer.domElement.setAttribute(
          'aria-label',
          spec
            ? `${spec.name}窗口模型，可切换俯视与三维、拖动缩放`
            : view.venueId === 'v-hut'
              ? '呢喃小屋外观，点击小屋或售卖棚查看窗口信息，切换早餐午餐晚餐，可拖动、旋转和缩放'
            : view.venueId === 'v-yifu'
              ? '逸夫楼 B102 休闲食坊模型，南侧敞开，点击售卖点查看窗口信息，可拖动平移、单击右键进入旋转模式、滚轮缩放'
            : '南门小餐车模型，点击餐车查看窗口信息，可拖动平移、单击右键进入旋转模式、滚轮缩放',
        );
        e.indoorSpec = spec ?? {
          ...fourthCanteenSpec,
          id: view.venueId,
          frame: view.venueId === 'v-hut'
            ? { x: 1.8, z: 1.2, planRange: 10, spatialRange: 8.8, halfWidth: 11 }
            : view.venueId === 'v-yifu'
            ? { x: 0, z: 0, planRange: 4.4, spatialRange: 4.25, halfWidth: 4.75 }
            : { x: 0, z: 0.25, planRange: 5, spatialRange: 4.7, halfWidth: 6.3 },
        };
        if (!e.indoorEnvironment) {
          const room = new RoomEnvironment();
          const pmrem = new THREE.PMREMGenerator(e.renderer);
          e.indoorEnvironment = pmrem.fromScene(room, 0.04);
          room.dispose();
          pmrem.dispose();
        }
        scene.environment = e.indoorEnvironment.texture;
        scene.environmentIntensity = view.venueId === 'v-yifu' ? YIFU_BROAD_LIGHTS.environmentIntensity : 0.28;
        e.ambientLight.intensity = 0.65;
        e.ambientLight.color.set('#fff1d9');
        e.keyLight.intensity = 1.0;
        e.keyLight.color.set('#fff1db');
        Object.assign(e.keyLight.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30 });
        e.keyLight.shadow.camera.updateProjectionMatrix();
        e.keyLight.shadow.normalBias = 0.025;
        e.fourth = model;
        content.add(model.group);
        if (view.venueId === 'v-yifu' || view.venueId === 'v-hut') {
          // 校准选中亮度前即关闭通用场景灯，夜间基准只包含售卖点自身照明。
          e.keyLight.visible = false;
          e.ambientLight.visible = false;
        }
        if (spec) {
          const stalls = data.stalls.filter((s) => s.floorId === spec.id);
          const heights = {
            ...Object.fromEntries(stalls.map((s) => [s.id, spec.facadeHeight ?? 3.75])),
            [eighthDumplingKiosk.id]: 1.3,
            [eleventhDumplingKiosk.id]: 1.3,
            [tenthDumplingKiosk.id]: 1.1,
          };
          e.stallTargets = createStallPickTargets(stalls, heights);
          e.stallSelection = createStallSelection(stalls, heights, {
            model: model.group, scene, fillLights: [e.ambientLight, e.keyLight],
          });
          e.stallSelection.select(selectedStallRef.current);
          content.add(e.stallTargets.group, e.stallSelection.group);
        } else if (view.venueId === 'v-hut') {
          (model as NinanHutModel).setMealMode(ninanMealRef.current);
          e.stallTargets = createNinanHutPickTargets(ninanHutStall, model.group);
          e.stallSelection = createNinanHutSelection(ninanHutStall, {
            model: model.group, scene, fillLights: [],
          });
          e.stallSelection.select(selectedStallRef.current);
          content.add(e.stallTargets.group, e.stallSelection.group);
        } else {
          // The whole service point has one identity from every viewing angle.
          const serviceStall = view.venueId === 'v-yifu' ? yifuKioskStall : southGateCartStall;
          if (view.venueId === 'v-yifu') {
            e.stallTargets = createYifuKioskPickTargets(serviceStall);
            content.add(e.stallTargets.group);
          }
          const serviceLighting = { model: model.group, scene, fillLights: [e.ambientLight, e.keyLight] };
          e.stallSelection = view.venueId === 'v-yifu'
            ? createYifuKioskSelection(serviceStall, serviceLighting)
            : createSouthGateCartSelection(serviceStall, { ...serviceLighting, fillLights: [] });
          e.stallSelection.select(selectedStallRef.current);
          content.add(e.stallSelection.group);
        }
        const night = interfaceThemeRef.current === 'night';
        scene.background = new THREE.Color(night ? '#252735' : '#f4f1ec');
        if (e.stallSelection) e.stallSelection.withLightingUpdate(() => model!.setInterfaceTheme(night));
        else model.setInterfaceTheme(night);
        if (view.venueId === 'v-hut') {
          (model as NinanHutModel).setMealMode(ninanMealRef.current);
          e.renderer.domElement.dataset.mealMode = ninanMealRef.current;
        }
        setFourthView(spec ? 'plan' : '3d');
        frameFourth(e, spec ? 'plan' : '3d');
        if (!spec) {
          // B102 uses the room environment for the stainless steel counter and glass.
          if (view.venueId === 'v-south') scene.environment = null;
          e.keyLight.visible = false;
          e.ambientLight.visible = false;
          e.renderer.toneMappingExposure = night ? 1.05 : 1.1;
        }
        const assets = modelAssets(model.group);
        setModelProgress(0.78);
        // 以真实首帧为完成点；高清照片继续渐进补齐，不延长加载条。
        e.firstModelFrame = (renderStarted) => {
          if (cancelled) return;
          modelPhase(id, 'first-render-gpu', renderStarted);
          modelPhase(id, 'first-visible', started, { cached });
          setLoadingModel(false);
          if (assets) {
            assets.start(texture => {
              const uploadStarted = performance.now();
              e.renderer.initTexture(texture);
              modelPhase(id, 'texture-upload', uploadStarted);
            }, failures => modelPhase(id, failures ? 'hd-settled-with-errors' : 'hd-ready', started, { failures }));
          }
        };
        // 只让当前可见场景在首帧编译，避免预编译其他餐段/视图。
        if (!assets) {
          await e.renderer.compileAsync(scene, camera);
        }
        if (!cancelled) {
          e.preparing = false;
          setModelProgress(0.94);
          if (import.meta.env.DEV) {
            e.renderer.domElement.dataset.modelCached = String(cached);
            e.renderer.domElement.dataset.modelPrepareMs = String(
              Math.round(performance.now() - started),
            );
          }
        }
      };
      frame = requestAnimationFrame(() => {
        frame = requestAnimationFrame(() => {
          void activate().catch((error: unknown) => {
            if (!cancelled) {
              console.error(error);
              setError(true);
              e.firstModelFrame = undefined;
              e.preparing = false;
              setLoadingModel(false);
            }
          });
        });
      });
      return () => {
        cancelled = true;
        cancelAnimationFrame(frame);
        finishPaint?.();
        e.firstModelFrame = undefined;
        if (e.fourth) modelAssets(e.fourth.group)?.pause();
      };
    } else if (view.level === 'building' && exteriorBuildings[view.venueId]) {
      const exteriorSpec = exteriorBuildings[view.venueId];
      const activate = async () => {
        e.preparing = true;
        // 模块下载完成后再让浏览器绘制进度；loadExteriorModel 复用浏览器的模块缓存。
        await exteriorSpec.load();
        if (cancelled) return;
        setModelProgress(0.42);
        await showPreparation();
        if (cancelled) return;
        const model = await loadExteriorModel(view.venueId, data);
        if (cancelled) {
          model?.dispose();
          return;
        }
        if (!model) throw new Error('外观模型未找到');
        setModelProgress(0.56);
        e.exterior = model;
        content.add(model.group);
        e.entranceMarkers = createExteriorEntranceMarkers(
          e.renderer.domElement.parentElement!, model, exteriorSpec.floors,
          floorId => { explore.current?.(); callback.current('floor', floorId); },
        );
        e.renderer.domElement.setAttribute('aria-label',
          `${data.venues.find(venue => venue.id === view.venueId)?.name ?? '食堂'}建筑外观，点击入口或使用左侧列表进入食堂，可拖动缩放`);
        if (!e.indoorEnvironment) {
          const room = new RoomEnvironment();
          const pmrem = new THREE.PMREMGenerator(e.renderer);
          e.indoorEnvironment = pmrem.fromScene(room, 0.04);
          room.dispose();
          pmrem.dispose();
        }
        scene.environment = e.indoorEnvironment.texture;
        scene.environmentIntensity = 0.28;
        e.keyLight.shadow.normalBias = 0.035;
        e.keyLight.shadow.bias = -0.0002;
        controls.enableRotate = true;
        controls.zoomToCursor = true;
        e.goal.fromArray(exteriorSpec.camera);
        e.focus.fromArray(exteriorSpec.target);
        const framing = exteriorFrame(model, view.venueId);
        captureDefaultFrame(e, framing.range, framing.halfWidth);
        updateProjection(e);
        lightExterior(e, interfaceThemeRef.current === 'night');
        e.animating = true;
        setModelProgress(0.78);
        await e.renderer.compileAsync(scene, camera);
        if (!cancelled) {
          e.preparing = false;
          e.renderer.shadowMap.needsUpdate = true;
          setModelProgress(0.94);
          e.firstModelFrame = () => {
            if (!cancelled) setLoadingModel(false);
          };
        }
      };
      frame = requestAnimationFrame(() => {
        frame = requestAnimationFrame(() => {
          void activate().catch((error: unknown) => {
            if (!cancelled) {
              console.error(error);
              setError(true);
              e.firstModelFrame = undefined;
              e.preparing = false;
              setLoadingModel(false);
            }
          });
        });
      });
      return () => {
        cancelled = true;
        cancelAnimationFrame(frame);
        finishPaint?.();
        e.firstModelFrame = undefined;
      };
    } else if (view.level === 'building') {
      const v = data.venues.find((v) => v.id === view.venueId)!;
      e.range = 28;
      e.goal.set(43, 35, 49);
      e.focus.set(0, 5, 0);
      box(content, 0, -0.6, 0, 46, 0.5, 33, t.park);
      const floors = data.floors.filter((f) => f.venueId === v.id);
      floors.forEach((f) => {
        const y = (f.level - 1) * 6.2;
        const pick = { kind: 'floor', id: f.id };
        box(content, 0, y, 0, 32, 0.65, 22, t.accent, pick);
        box(content, 0, y + 0.65, -10.4, 32, 4, 0.9, t.building, pick);
        box(content, -15.5, y + 0.65, 0, 1, 4, 21, t.building, pick);
        for (const x of [-14, -7, 0, 7, 14]) {
          box(content, x, y + 0.65, 10, 0.5, 4, 0.5, t.accent, pick);
          box(
            content,
            x,
            y + 1.5,
            -9.8,
            4.5,
            2,
            0.2,
            theme === 'night' ? '#819fb2' : '#b8dce0',
            pick,
          );
        }
        box(content, 0, y + 4.65, 0, 33, 0.5, 23, theme === 'night' ? '#686179' : '#f5eee4', pick);
        label(content, `${f.name}  点击进入`, 21, y + 3, 3, t.accent, 1.5, true).userData = pick;
      });
      label(content, v.name, 0, floors.length * 6.2 + 3, 0, t.text, 2);
      path(
        content,
        [
          [-25, 16],
          [25, 16],
        ],
        t.road,
        2,
      );
    } else {
      const f = data.floors.find((f) => f.id === view.floorId)!;
      const stalls = data.stalls.filter((s) => s.floorId === f.id);
      e.stallTargets = createStallPickTargets(stalls);
      e.stallSelection = createStallSelection(stalls);
      e.stallSelection.select(selectedStallRef.current);
      content.add(e.stallTargets.group, e.stallSelection.group);
      e.range = 21;
      e.goal.set(22, 40, 32);
      e.focus.set(0, 0, 0);
      box(content, 0, -0.7, 0, f.width + 0.6, 0.7, f.depth + 0.6, t.building);
      box(content, 0, 0, 0, f.width, 0.1, f.depth, theme === 'night' ? '#393847' : '#faf6ee');
      box(content, 0, 0.1, -f.depth / 2, f.width, 1.5, 0.3, t.building);
      box(content, -f.width / 2, 0.1, 0, 0.3, 1.5, f.depth, t.building);
      data.stalls
        .filter((s) => s.floorId === f.id)
        .forEach((s, i) => {
          const p = s.position;
          const g = new THREE.Group();
          g.position.set(p.x, 0, p.z);
          g.rotation.y = p.rotationY;
          content.add(g);
          const color = t.accent;
          const pick = { kind: 'stall', id: s.id };
          box(g, 0, 0.1, 0, p.width, 2.4, p.depth, t.building, pick);
          box(g, 0, 2.5, 0, p.width + 0.3, 0.35, p.depth + 0.3, color, pick);
          box(g, 0, 0.1, p.depth / 2 + 0.05, p.width, 1.1, 0.5, color, pick);
          label(
            content,
            `${String(i + 1).padStart(2, '0')} ${s.name}`,
            p.x,
            4,
            p.z,
            t.text,
            1,
            true,
          ).userData = pick;
        });
      for (const x of [-10, 0, 10]) {
        box(content, x, 0.1, 0, 3.2, 1.2, 2, theme === 'night' ? '#72667b' : '#c9b59b');
        for (const z of [-1.6, 1.6]) box(content, x, 0.1, z, 3, 0.65, 0.6, t.park);
      }
      label(content, '入 口  ↑', 0, 0.4, f.depth / 2 + 2, t.text, 1.2);
    }
    captureDefaultFrame(e, e.range, e.range);
    updateProjection(e);
    controls.enableRotate = true;
    e.animating = true;
    setModelProgress(0.94);
    e.firstModelFrame = () => setLoadingModel(false);
    // Opening/closing a detail panel changes navigation history, not the model.
    // Depend on actual route IDs so closing details preserves the 3D camera and mode.
  }, [data, view.level, view.venueId, floorId, theme]);
  useEffect(() => {
    const e = engine.current;
    if (e?.exterior) {
      lightExterior(e, interfaceTheme === 'night');
      return;
    }
    if (!e?.fourth) return;
    const night = interfaceTheme === 'night';
    e.scene.background = new THREE.Color(night ? '#252735' : '#f4f1ec');
    if (e.stallSelection) e.stallSelection.withLightingUpdate(() => e.fourth!.setInterfaceTheme(night));
    else e.fourth.setInterfaceTheme(night);
    if (['v-south', 'v-yifu', 'v-hut'].includes(e.indoorSpec?.id ?? '')) e.renderer.toneMappingExposure = night ? 1.05 : 1.1;
    e.renderer.shadowMap.needsUpdate = true;
  }, [interfaceTheme, view.level, view.venueId, floorId]);
  useEffect(() => {
    const e = engine.current;
    if (e?.fourth && e.indoorSpec?.id === 'v-hut') {
      const updateMeal = () => (e.fourth as NinanHutModel).setMealMode(ninanMeal);
      if (e.stallSelection) e.stallSelection.withLightingUpdate(updateMeal);
      else updateMeal();
      e.renderer.domElement.dataset.mealMode = ninanMeal;
      e.renderer.shadowMap.needsUpdate = true;
    }
  }, [ninanMeal]);
  useEffect(() => {
    engine.current?.stallSelection?.select(selectedStall);
    engine.current?.content.traverse((obj) => {
      if (obj.userData.kind === 'stall' && obj.userData.baseColor) {
        ((obj as THREE.Mesh).material as THREE.MeshStandardMaterial).color.set(
          obj.userData.id === selectedStall ? '#f5dba3' : obj.userData.baseColor,
        );
      }
    });
  }, [selectedStall, data, view.level, view.venueId, floorId, theme]);
  return (
    <div className={`scene${isFourthFloor || isCart ? ' fourth-canteen-scene' : ''}`} ref={host} data-loading={loadingModel || undefined}>
      <ModelCompass ref={compass} knownNorth={!!north} hidden={error || loadingModel} />
      {(isYifuKiosk || isNinanHut) && (
        <div className={`fourth-view-controls${isYifuKiosk ? ' yifu-view-controls' : ''}${isNinanHut ? ' ninan-view-controls' : ''}`} role="group" aria-label={isNinanHut ? '呢喃小屋模型控制' : isYifuKiosk ? '售卖点模型控制' : '餐车模型控制'}>
          {isNinanHut && onNinanMealChange && <NinanMealTabs meal={ninanMeal} onMealChange={onNinanMealChange} idPrefix="scene" showLabel={false} />}
          {isYifuKiosk && (['plan', '3d'] as const).map((mode) => (
            <button
              key={mode}
              disabled={loadingModel || error}
              aria-pressed={fourthView === mode}
              onClick={() => {
                const e = engine.current;
                if (!e?.fourth) return;
                explore.current?.();
                e.controls.autoRotate = false;
                frameFourth(e, mode);
                setFourthView(mode);
              }}
            >
              {mode === 'plan' ? '俯视图' : '3D 模式'}
            </button>
          ))}

        </div>
      )}
      {loadingModel && (
        <LoadingProgress kind="model" progress={modelProgress} className="loading model-loading" />
      )}
      {isExterior && (
        <div className="fourth-view-note">建筑外观 · 点击入口标记或选择楼层进入</div>
      )}
      {isFourthFloor && (
        <>
          <div className="fourth-view-controls" role="group" aria-label="食堂显示模式">
            <button
              aria-pressed={fourthView === 'plan'}
              onClick={() => {
                explore.current?.();
                if (engine.current) frameFourth(engine.current, 'plan');
                setFourthView('plan');
              }}
            >
              俯视图
            </button>
            <button
              aria-pressed={fourthView === '3d'}
              onClick={() => {
                explore.current?.();
                if (engine.current) frameFourth(engine.current, '3d');
                setFourthView('3d');
              }}
            >
              3D 模式
            </button>
          </div>
          <div className="fourth-view-note">
            {modeledCanteen?.style === 'ninth' ? (
              <>第九食堂 · 双排店面 · 11 家店铺</>
            ) : (
              <>
                {modeledCanteen?.name} · {modeledCanteen?.faces.length} 个
                {modeledCanteen?.style === 'sixth' || modeledCanteen?.style === 'faculty' ? '窗口区' : '牌坊面'} ·{' '}
                {modeledCanteen?.faces.reduce((total, face) => total + face.windowCount, 0)} 个窗口
                {['eighth','eleventh','tenth'].includes(modeledCanteen?.style ?? '') ? ' · 独立水饺超市' : ''}
                {['tenth', 'faculty'].includes(modeledCanteen?.style ?? '') ? ' · 左侧为北' : ''}
                {modeledCanteen?.style === 'twelfth' || modeledCanteen?.style === 'eleventh'
                  ? ' · 右侧为北'
                  : ''}
              </>
            )}
          </div>
        </>
      )}
      {!error && !loadingModel && (!(isFourthFloor || isYifuKiosk) || fourthView === '3d') && (
        <div className="interaction-hint" role="status" aria-live="polite">
          {rotationMode ? '旋转中·左键临时平移·右键/Esc退出' : '单击右键进入旋转模式'}
        </div>
      )}
      {error && (
        <div className="scene-error">
          <strong>当前设备未能启动 3D 地图</strong>
          <p>仍可通过左侧列表查看场所、楼层和窗口。请使用支持 WebGL 的浏览器。</p>
        </div>
      )}
    </div>
  );
});
