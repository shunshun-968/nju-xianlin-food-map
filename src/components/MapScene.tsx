import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { themes, type Catalog, type MapTheme, type View } from '../domain';
import {
  getIndoorCanteen,
  fourthCanteenSpec,
  type IndoorCanteenSpec,
} from '../data/indoor-canteens';
import {
  createCanteenModel,
  type FourthCanteenModel,
  type FourthViewMode,
} from './FourthCanteenModel';
import type { InterfaceTheme } from '../lib/use-interface-theme';
import './fourth-canteen.css';
import { createSouthGateCartModel } from './SouthGateCartModel';
import { batchModel } from '../lib/model-batches';
import { attachModelMouseControls } from '../lib/model-mouse-controls';
import { createStallPickTargets } from '../lib/stall-picking';
import { eighthDumplingKiosk } from '../data/eighth-canteen';

export type SceneHandle = { zoom: (factor: number) => void; reset: () => void; rotate: () => void };
type Props = {
  data: Catalog;
  view: Exclude<View, { level: 'campus' }>;
  theme: MapTheme;
  onPick: (kind: string, id: string) => void;
  selectedStall: string | null;
  interfaceTheme?: InterfaceTheme;
};
type Engine = {
  scene: THREE.Scene;
  camera: THREE.OrthographicCamera;
  renderer: THREE.WebGLRenderer;
  controls: OrbitControls;
  mouse: ReturnType<typeof attachModelMouseControls>;
  stallTargets?: ReturnType<typeof createStallPickTargets>;
  content: THREE.Group;
  goal: THREE.Vector3;
  focus: THREE.Vector3;
  animating: boolean;
  range: number;
  fourth?: FourthCanteenModel;
  fourthMode?: FourthViewMode;
  indoorSpec?: IndoorCanteenSpec;
  indoorEnvironment?: THREE.WebGLRenderTarget;
  keyLight: THREE.DirectionalLight;
  ambientLight: THREE.HemisphereLight;
  models: Map<string, FourthCanteenModel>;
  preparing?: boolean;
};

function frameFourth(e: Engine, mode: FourthViewMode) {
  e.mouse.reset();
  const framing = e.indoorSpec?.frame ?? fourthCanteenSpec.frame;
  e.fourthMode = mode;
  e.stallTargets?.setMode(mode);
  e.fourth?.setMode(mode);
  e.animating = false;
  e.controls.enableDamping = false;
  e.controls.update();
  e.controls.enableRotate = mode === '3d';
  e.controls.zoomToCursor = true;
  e.controls.maxZoom = 14;
  e.controls.minPolarAngle = 0;
  e.controls.maxPolarAngle = Math.PI / 2.05;
  e.controls.target.set(framing.x, 0.7, framing.z);
  if (mode === 'plan') {
    e.controls.target.set(framing.x, 0, framing.z);
    e.camera.position.set(framing.x, 45, framing.z + 0.0001);
  } else if (e.indoorSpec?.id === 'v-south') {
    e.controls.target.set(0, 1.6, 0.25);
    e.camera.position.set(-8.8, 5.6, 11.7);
  } else {
    const offset = framing.spatialOffset ?? { x: -25, y: 17.5, z: 36 };
    e.camera.position.set(framing.x + offset.x, offset.y, framing.z + offset.z);
  }
  e.goal.copy(e.camera.position);
  e.focus.copy(e.controls.target);
  e.camera.zoom = 1;
  const aspect =
    e.renderer.domElement.clientWidth / Math.max(e.renderer.domElement.clientHeight, 1);
  e.range = Math.max(
    mode === 'plan' ? framing.planRange : framing.spatialRange,
    framing.halfWidth / aspect,
  );
  e.camera.left = -e.range * aspect;
  e.camera.right = e.range * aspect;
  e.camera.top = e.range;
  e.camera.bottom = -e.range;
  e.camera.updateProjectionMatrix();
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
  { data, view, theme, onPick, selectedStall, interfaceTheme = 'day' },
  ref,
) {
  const host = useRef<HTMLDivElement>(null),
    engine = useRef<Engine | null>(null),
    callback = useRef(onPick);
  const [error, setError] = useState(false);
  const [loadingModel, setLoadingModel] = useState(false);
  const [fourthView, setFourthView] = useState<FourthViewMode>('plan');
  const [cartRotating, setCartRotating] = useState(false);
  const floorId = view.level === 'floor' ? view.floorId : undefined;
  const modeledCanteen = getIndoorCanteen(floorId);
  const isFourthFloor = !!modeledCanteen;
  const isCart = view.venueId === 'v-south';
  const interfaceThemeRef = useRef(interfaceTheme);
  interfaceThemeRef.current = interfaceTheme;
  callback.current = onPick;
  useImperativeHandle(ref, () => ({
    zoom(factor) {
      const e = engine.current;
      if (e) {
        e.camera.zoom = THREE.MathUtils.clamp(e.camera.zoom * factor, 0.55, e.fourth ? 14 : 4);
        e.camera.updateProjectionMatrix();
      }
    },
    reset() {
      const e = engine.current;
      if (e) {
        e.mouse.reset();
        e.controls.autoRotate = false;
        setCartRotating(false);
        if (e.fourth) {
          frameFourth(e, e.fourthMode || 'plan');
          return;
        }
        e.camera.zoom = 1;
        e.camera.updateProjectionMatrix();
        e.animating = true;
      }
    },
    rotate() {
      const e = engine.current;
      if (e) {
        if (e.fourth && e.fourthMode === 'plan') {
          return;
        }
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
      if (engine.current) engine.current.animating = false;
      controls.autoRotate = false;
      setCartRotating(false);
    };
    const mouse = attachModelMouseControls(renderer.domElement, controls, interact);
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
      keyLight: light,
      ambientLight,
      models: new Map(),
    };
    engine.current = e;
    const resize = () => {
      const { width, height } = element.getBoundingClientRect();
      if (!height || !width) return;
      const aspect = width / height;
      if (e.fourth) {
        const framing = e.indoorSpec?.frame ?? fourthCanteenSpec.frame;
        e.range = Math.max(
          e.fourthMode === 'plan' ? framing.planRange : framing.spatialRange,
          framing.halfWidth / aspect,
        );
      }
      camera.left = -e.range * aspect;
      camera.right = e.range * aspect;
      camera.top = e.range;
      camera.bottom = -e.range;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    resize();
    controls.addEventListener('start', interact);
    const raycaster = new THREE.Raycaster(),
      pointer = new THREE.Vector2();
    let start: [number, number] | null = null;
    const down = (event: PointerEvent) => {
      start = event.button === 0 && !mouse.isActive() ? [event.clientX, event.clientY] : null;
    };
    const up = (event: PointerEvent) => {
      const origin = start;
      start = null;
      if (
        !origin ||
        mouse.isActive() ||
        event.button !== 0 ||
        Math.hypot(event.clientX - origin[0], event.clientY - origin[1]) > 6
      )
        return;
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.set(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        (-(event.clientY - rect.top) / rect.height) * 2 + 1,
      );
      raycaster.setFromCamera(pointer, camera);
      const stallId = e.stallTargets?.pick(raycaster);
      if (stallId) {
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
      if (hit) callback.current(hit.object.userData.kind, hit.object.userData.id);
    };
    renderer.domElement.addEventListener('pointerdown', down);
    renderer.domElement.addEventListener('pointerup', up);
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let previousFrame = 0;
    renderer.setAnimationLoop((time) => {
      const delta = previousFrame ? Math.min((time - previousFrame) / 1000, 0.08) : 0;
      previousFrame = time;
      if (document.hidden || e.preparing) return;
      if (e.animating) {
        const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        camera.position.lerp(e.goal, reduce ? 1 : 0.085);
        controls.target.lerp(e.focus, reduce ? 1 : 0.085);
        if (camera.position.distanceTo(e.goal) < 0.03) e.animating = false;
      }
      controls.update(delta);
      if (!reducedMotion.matches) e.fourth?.tick(time / 1000);
      renderer.render(scene, camera);
      if (import.meta.env.DEV)
        renderer.domElement.dataset.drawCalls = String(renderer.info.render.calls);
    });
    return () => {
      observer.disconnect();
      renderer.setAnimationLoop(null);
      renderer.domElement.removeEventListener('pointerdown', down);
      renderer.domElement.removeEventListener('pointerup', up);
      mouse.dispose();
      controls.dispose();
      e.fourth?.group.removeFromParent();
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
    setCartRotating(false);
    e.preparing = false;
    if (e.fourth) e.fourth.group.removeFromParent();
    e.fourth = undefined;
    e.indoorSpec = undefined;
    e.stallTargets = undefined;
    scene.environment = null;
    scene.environmentIntensity = 1;
    controls.zoomToCursor = false;
    controls.maxZoom = 4;
    controls.maxPolarAngle = Math.PI / 2.15;
    e.ambientLight.intensity = 1.5;
    e.ambientLight.visible = true;
    e.keyLight.visible = true;
    e.renderer.toneMappingExposure = 1;
    e.ambientLight.color.set('#ffffff');
    e.keyLight.intensity = 1.7;
    e.keyLight.color.set('#ffffff');
    e.keyLight.shadow.normalBias = 0;
    Object.assign(e.keyLight.shadow.camera, { left: -120, right: 120, top: 120, bottom: -120 });
    e.keyLight.shadow.camera.updateProjectionMatrix();
    dispose(content);
    e.renderer.shadowMap.needsUpdate = true;
    scene.background = new THREE.Color(t.ground);
    camera.zoom = 1;
    const spec = getIndoorCanteen(view.level === 'floor' ? view.floorId : undefined);
    if (spec || view.venueId === 'v-south') {
      let cancelled = false;
      let frame = 0;
      setLoadingModel(true);
      const activate = async () => {
        e.preparing = true;
        const started = performance.now();
        const id = spec?.id ?? 'v-south';
        let model = e.models.get(id);
        const cached = !!model;
        if (!model) {
          model = spec ? createCanteenModel(spec) : createSouthGateCartModel();
          if (spec) batchModel(model.group);
          e.models.set(id, model);
        }
        if (cancelled) return;
        model.group.traverse((node) => {
          if (node instanceof THREE.Mesh && node.userData.baseColor)
            (node.material as THREE.MeshStandardMaterial).color.set(node.userData.baseColor);
        });
        e.renderer.domElement.setAttribute(
          'aria-label',
          spec
            ? `${spec.name}窗口模型，可切换俯视与三维、拖动缩放`
            : '南门小餐车模型，可拖动平移、单击右键进入旋转模式、滚轮缩放',
        );
        e.indoorSpec = spec ?? {
          ...fourthCanteenSpec,
          id: 'v-south',
          frame: { x: 0, z: 0.25, planRange: 5, spatialRange: 4.7, halfWidth: 6.3 },
        };
        if (!e.indoorEnvironment) {
          const room = new RoomEnvironment();
          const pmrem = new THREE.PMREMGenerator(e.renderer);
          e.indoorEnvironment = pmrem.fromScene(room, 0.04);
          room.dispose();
          pmrem.dispose();
        }
        scene.environment = e.indoorEnvironment.texture;
        scene.environmentIntensity = 0.28;
        e.ambientLight.intensity = 0.65;
        e.ambientLight.color.set('#fff1d9');
        e.keyLight.intensity = 1.0;
        e.keyLight.color.set('#fff1db');
        Object.assign(e.keyLight.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30 });
        e.keyLight.shadow.camera.updateProjectionMatrix();
        e.keyLight.shadow.normalBias = 0.025;
        e.fourth = model;
        content.add(model.group);
        if (spec) {
          e.stallTargets = createStallPickTargets(
            data.stalls.filter((s) => s.floorId === spec.id),
            {
              ...Object.fromEntries(
                data.stalls
                  .filter((s) => s.floorId === spec.id)
                  .map((s) => [s.id, spec.facadeHeight ?? 3.75]),
              ),
              [eighthDumplingKiosk.id]: 1.3,
            },
          );
          content.add(e.stallTargets.group);
        }
        const night = interfaceThemeRef.current === 'night';
        scene.background = new THREE.Color(night ? '#252735' : '#f4f1ec');
        model.setInterfaceTheme(night);
        setFourthView(spec ? 'plan' : '3d');
        frameFourth(e, spec ? 'plan' : '3d');
        if (!spec) {
          scene.environment = null;
          e.keyLight.visible = false;
          e.ambientLight.visible = false;
          e.renderer.toneMappingExposure = night ? 1.05 : 1.1;
        }
        await e.renderer.compileAsync(scene, camera);
        if (!cancelled) {
          e.preparing = false;
          setLoadingModel(false);
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
              e.preparing = false;
              setLoadingModel(false);
            }
          });
        });
      });
      return () => {
        cancelled = true;
        cancelAnimationFrame(frame);
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
      e.stallTargets = createStallPickTargets(data.stalls.filter((s) => s.floorId === f.id));
      content.add(e.stallTargets.group);
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
    const aspect =
      e.renderer.domElement.clientWidth / Math.max(e.renderer.domElement.clientHeight, 1);
    camera.left = -e.range * aspect;
    camera.right = e.range * aspect;
    camera.top = e.range;
    camera.bottom = -e.range;
    camera.updateProjectionMatrix();
    controls.enableRotate = true;
    e.animating = true;
    setLoadingModel(false);
    // Opening/closing a detail panel changes navigation history, not the model.
    // Depend on actual route IDs so closing details preserves the 3D camera and mode.
  }, [data, view.level, view.venueId, floorId, theme]);
  useEffect(() => {
    const e = engine.current;
    if (!e?.fourth) return;
    const night = interfaceTheme === 'night';
    e.scene.background = new THREE.Color(night ? '#252735' : '#f4f1ec');
    e.fourth.setInterfaceTheme(night);
    if (e.indoorSpec?.id === 'v-south') e.renderer.toneMappingExposure = night ? 1.05 : 1.1;
    e.renderer.shadowMap.needsUpdate = true;
  }, [interfaceTheme, view]);
  useEffect(() => {
    engine.current?.content.traverse((obj) => {
      if (obj.userData.kind === 'stall' && obj.userData.baseColor) {
        ((obj as THREE.Mesh).material as THREE.MeshStandardMaterial).color.set(
          obj.userData.id === selectedStall ? '#d99c46' : obj.userData.baseColor,
        );
      }
    });
  }, [selectedStall, data, view, theme]);
  return (
    <div className={`scene${isFourthFloor || isCart ? ' fourth-canteen-scene' : ''}`} ref={host}>
      {isCart && (
        <div className="fourth-view-controls" role="group" aria-label="餐车模型控制">
          <button
            disabled={loadingModel || error}
            aria-label="自动旋转"
            aria-pressed={cartRotating}
            onClick={() => {
              const e = engine.current;
              if (!e?.fourth) return;
              e.animating = false;
              e.controls.autoRotate = !e.controls.autoRotate;
              setCartRotating(e.controls.autoRotate);
            }}
          >
            {cartRotating ? '暂停旋转' : '自动旋转'}
          </button>
        </div>
      )}
      {loadingModel && (
        <div className="loading" role="status">
          正在展开模型…
        </div>
      )}
      {isFourthFloor && (
        <>
          <div className="fourth-view-controls" role="group" aria-label="食堂显示模式">
            <button
              aria-pressed={fourthView === 'plan'}
              onClick={() => {
                if (engine.current) frameFourth(engine.current, 'plan');
                setFourthView('plan');
              }}
            >
              俯视图
            </button>
            <button
              aria-pressed={fourthView === '3d'}
              onClick={() => {
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
                {modeledCanteen?.style === 'sixth' ? '窗口区' : '牌坊面'} ·{' '}
                {modeledCanteen?.faces.reduce((total, face) => total + face.windowCount, 0)} 个窗口
                {modeledCanteen?.style === 'eighth' ? ' · 独立水饺超市' : ''}
              </>
            )}
          </div>
        </>
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
