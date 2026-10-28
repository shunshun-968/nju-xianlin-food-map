/** Development-only asset exporter. Existing reviewed geometry is the sole source of each sprite. */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import type { MapVenue } from '../src/lib/campus-basemap';
import type { ExteriorGeometryModel } from '../src/models/exteriors/types';
import { createBuilding as create456 } from '../src/models/exteriors/fourth-fifth-sixth.js';
import { createBuilding as createTenth } from '../src/models/exteriors/tenth-building.js';
import { createBuilding as createMinzu } from '../src/models/exteriors/minzu89-building.js';
import { createBuilding as createEleven } from '../src/models/exteriors/eleven-twelve-building.js';
import { createExteriorLighting } from '../src/lib/exterior-lighting';
import { createSouthGateCartModel } from '../src/components/SouthGateCartModel';
import { createYifuMapHouse } from '../src/models/exteriors/yifu-map-house';

type VenueId = 'v-456' | 'v-10' | 'v-891' | 'v-1112' | 'v-south' | 'v-yifu';
type Source = {
  core: [number, number];
  turn: number;
  swap: boolean;
  factory?: () => ExteriorGeometryModel;
};
const sources: Record<VenueId, Source> = {
  'v-456': { core: [54, 60], turn: -90, swap: true, factory: create456 },
  'v-10': { core: [72, 50], turn: -90, swap: true, factory: createTenth },
  'v-891': { core: [50, 72], turn: 0, swap: false, factory: createMinzu },
  'v-1112': { core: [68, 58], turn: 90, swap: true, factory: createEleven },
  'v-south': { core: [6.6, 2.7], turn: 0, swap: false },
  'v-yifu': { core: [6.2, 4.4], turn: 0, swap: false },
};
type SpriteMetadata = {
  width: number;
  height: number;
  offsetX: number;
  offsetY: number;
  referenceWidth: number;
  referenceDepth: number;
  /** Actual THREE world yaw in degrees. The finished image must not rotate again in SVG. */
  angle: number;
  alignmentAngle: number;
  modelScale: number;
  pixelWidth: number;
  pixelHeight: number;
};

const canvas = document.querySelector<HTMLCanvasElement>('#sprite')!;
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: true,
  preserveDrawingBuffer: true,
});
renderer.setPixelRatio(1);
renderer.setClearColor(0x000000, 0);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
let busy = false;
const venues = fetch(`${import.meta.env.BASE_URL}osm/campus-render.json`)
  .then((response) => {
    if (!response.ok) throw Error(`Campus snapshot: ${response.status}`);
    return response.json();
  })
  .then((data: { venues: MapVenue[] }) => data.venues);

function disposeTree(root: THREE.Object3D) {
  const geometry = new Set<THREE.BufferGeometry>(),
    materials = new Set<THREE.Material>(),
    textures = new Set<THREE.Texture>();
  root.traverse((node) => {
    if (node instanceof THREE.Mesh) {
      geometry.add(node.geometry);
      for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
        materials.add(material);
        for (const value of Object.values(material))
          if (value instanceof THREE.Texture) textures.add(value);
      }
    }
    if (node instanceof THREE.PointLight || node instanceof THREE.DirectionalLight) node.dispose();
  });
  geometry.forEach((g) => g.dispose());
  materials.forEach((m) => m.dispose());
  textures.forEach((t) => t.dispose());
}

/** Map-plane coordinates are x/right and z/down; a metre of model elevation rises one map metre. */
function projectedBounds(root: THREE.Object3D, excluded: Set<THREE.Object3D>) {
  root.updateWorldMatrix(true, true);
  const result = { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity };
  const point = new THREE.Vector3();
  root.traverse((node) => {
    if (!(node instanceof THREE.Mesh)) return;
    for (let p: THREE.Object3D | null = node; p; p = p.parent) if (excluded.has(p)) return;
    // Include both food/light variants in the bounds so day/night use exactly the same frame.
    node.geometry.computeBoundingBox();
    const bounds = node.geometry.boundingBox;
    if (!bounds) return;
    for (const x of [bounds.min.x, bounds.max.x])
      for (const y of [bounds.min.y, bounds.max.y])
        for (const z of [bounds.min.z, bounds.max.z]) {
          point.set(x, y, z).applyMatrix4(node.matrixWorld);
          const screenY = point.z - point.y;
          result.left = Math.min(result.left, point.x);
          result.right = Math.max(result.right, point.x);
          result.top = Math.min(result.top, screenY);
          result.bottom = Math.max(result.bottom, screenY);
        }
  });
  if (!Number.isFinite(result.left)) throw Error('No renderable architecture');
  return result;
}

/** Invoke sequentially from the browser automation; no UI or production runtime depends on this page. */
export async function renderCampusSprite(
  id: VenueId,
  night = false,
): Promise<{ dataUrl: string; metadata: SpriteMetadata }> {
  if (busy) throw Error('Sprite renderer is busy; await the previous image');
  const source = sources[id];
  if (!source) throw Error(`Unsupported model ${id}`);
  busy = true;
  const manager = THREE.DefaultLoadingManager;
  const saved = { onStart: manager.onStart, onLoad: manager.onLoad, onError: manager.onError };
  let loadingStarted = false;
  let resolveAssets: () => void = () => {},
    rejectAssets: (error: Error) => void = () => {};
  const assets = new Promise<void>((resolve, reject) => {
    resolveAssets = resolve;
    rejectAssets = reject;
  });
  manager.onStart = () => {
    loadingStarted = true;
  };
  manager.onLoad = () => resolveAssets();
  manager.onError = (url) => rejectAssets(Error(`Could not load model artwork ${url}`));
  const scene = new THREE.Scene();
  scene.background = null;
  const wrapper = new THREE.Group();
  scene.add(wrapper);
  let model: ExteriorGeometryModel | undefined;
  let lighting: ReturnType<typeof createExteriorLighting> | undefined;
  let environment: THREE.WebGLRenderTarget | undefined;
  let cart: ReturnType<typeof createSouthGateCartModel> | undefined;
  try {
    const venue = (await venues).find((v) => v.id === id);
    if (!venue) throw Error(`Missing current map venue ${id}`);
    const target = source.swap ? [venue.depth, venue.width] : [venue.width, venue.depth];
    const scale = Math.min(target[0] / source.core[0], target[1] / source.core[1]);
    // B102 uses a compact white-house symbol, separate from its detailed indoor
    // model and the footprint of the whole Yifu building.
    const alignmentAngle = id === 'v-yifu' ? 28 : id === 'v-south' ? 0 : venue.angle + source.turn;
    // SVG positive rotation is clockwise in (x,z); THREE yaw has the opposite sign.
    wrapper.rotation.y = -THREE.MathUtils.degToRad(alignmentAngle);
    wrapper.scale.set(scale, scale * 1.2, scale);
    const excluded = new Set<THREE.Object3D>();
    const exclude = (object?: THREE.Object3D) => {
      if (object) {
        object.visible = false;
        excluded.add(object);
      }
    };
    if (source.factory) {
      model = source.factory();
      wrapper.add(model.group);
      exclude(model.layers.context);
      exclude(model.layers.labels);
      // The distant ramp/road has its own geometry in this preserved leaf group.
      if (id === 'v-1112') exclude(model.group.getObjectByName('eleventh-east-ramp-access'));
      model.setSelected(null);
      lighting = createExteriorLighting(model);
      lighting.setNight(night);
    } else if (id === 'v-yifu') {
      cart = createYifuMapHouse();
      wrapper.add(cart.group);
      cart.setInterfaceTheme(night);
    } else {
      cart = createSouthGateCartModel();
      wrapper.add(cart.group);
      exclude(cart.group.getObjectByName('display-ground'));
      cart.setInterfaceTheme(night);
    }
    if (loadingStarted) await assets;
    const room = new RoomEnvironment();
    const pmrem = new THREE.PMREMGenerator(renderer);
    environment = pmrem.fromScene(room, 0.04);
    room.dispose();
    pmrem.dispose();
    scene.environment = environment.texture;
    scene.environmentIntensity = night ? 0.16 : 0.32;
    if (!cart) {
      const ambient = new THREE.HemisphereLight(
        night ? '#c2d1ef' : '#fff9ed',
        night ? '#4c5363' : '#a1a99a',
        night ? 0.85 : 1.8,
      );
      const sun = new THREE.DirectionalLight(night ? '#c0d2f1' : '#fff3da', night ? 1.0 : 2.1);
      sun.position.set(-120, 220, 110);
      sun.castShadow = true;
      sun.shadow.mapSize.set(2048, 2048);
      Object.assign(sun.shadow.camera, {
        left: -110,
        right: 110,
        top: 110,
        bottom: -110,
        near: 1,
        far: 600,
      });
      sun.shadow.normalBias = 0.04;
      sun.shadow.bias = -0.0002;
      scene.add(ambient, sun);
    }
    const projected = projectedBounds(wrapper, excluded);
    const margin = id === 'v-south' || id === 'v-yifu' ? 0.5 : 2;
    const left = projected.left - margin,
      right = projected.right + margin;
    const top = projected.top - margin,
      bottom = projected.bottom + margin;
    const width = right - left,
      height = bottom - top;
    const pixelScale = 1024 / Math.max(width, height);
    const pixelWidth = Math.max(1, Math.round(width * pixelScale));
    const pixelHeight = Math.max(1, Math.round(height * pixelScale));
    renderer.setSize(pixelWidth, pixelHeight, false);
    renderer.toneMappingExposure = night ? 1.05 : 1.08;
    // At a 45-degree view, compensating the vertical frustum by sin(45°) preserves
    // the true ground footprint while heights project straight up: screen=(x,z-y).
    const camera = new THREE.OrthographicCamera(
      left,
      right,
      -top / Math.SQRT2,
      -bottom / Math.SQRT2,
      1,
      10000,
    );
    camera.position.set(0, 1000, 1000);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();
    await renderer.compileAsync(scene, camera);
    renderer.shadowMap.needsUpdate = true;
    renderer.clear();
    renderer.render(scene, camera);
    const dataUrl = renderer.domElement.toDataURL('image/webp', 0.93);
    const metadata: SpriteMetadata = {
      width,
      height,
      offsetX: left,
      offsetY: top,
      referenceWidth: venue.width,
      referenceDepth: venue.depth,
      angle: -alignmentAngle,
      alignmentAngle,
      modelScale: scale,
      pixelWidth,
      pixelHeight,
    };
    return { dataUrl, metadata };
  } finally {
    Object.assign(manager, saved);
    lighting?.dispose();
    // Factory disposal includes hidden reference context; cart resources have no factory disposer.
    if (model) {
      model.dispose();
      model.group.removeFromParent();
    }
    if (cart) {
      disposeTree(cart.group);
      cart.group.removeFromParent();
    }
    scene.traverse((node) => {
      if (node instanceof THREE.PointLight || node instanceof THREE.DirectionalLight)
        node.dispose();
    });
    environment?.dispose();
    scene.clear();
    renderer.renderLists.dispose();
    busy = false;
  }
}

declare global {
  interface Window {
    renderCampusSprite: typeof renderCampusSprite;
    campusSpriteReady: boolean;
  }
}
window.renderCampusSprite = renderCampusSprite;
window.campusSpriteReady = true;

// Visible export controls keep image generation reproducible without depending
// on a particular automation runtime or evaluating private browser state.
const exportButton = document.querySelector<HTMLButtonElement>('#render-sprite');
const modelSelect = document.querySelector<HTMLSelectElement>('#model-id');
const themeSelect = document.querySelector<HTMLSelectElement>('#model-theme');
const status = document.querySelector<HTMLOutputElement>('#export-status');
const download = document.querySelector<HTMLAnchorElement>('#download-sprite');
const metadataOutput = document.querySelector<HTMLPreElement>('#sprite-metadata');
async function exportSelected() {
  if (!exportButton || !modelSelect || !themeSelect || !status || !download || !metadataOutput) return;
  exportButton.disabled = true;
  status.textContent = '正在渲染…';
  download.hidden = true;
  try {
    const id = modelSelect.value as VenueId;
    const night = themeSelect.value === 'night';
    const result = await renderCampusSprite(id, night);
    download.href = result.dataUrl;
    download.download = `${id}-${night ? 'night' : 'day'}.webp`;
    download.hidden = false;
    metadataOutput.textContent = JSON.stringify(result.metadata, null, 2);
    status.textContent = '渲染完成';
  } catch (error) {
    status.textContent = `渲染失败：${error instanceof Error ? error.message : String(error)}`;
  } finally {
    exportButton.disabled = false;
  }
}
exportButton?.addEventListener('click', () => { void exportSelected(); });
const exportQuery = new URLSearchParams(window.location.search);
if (modelSelect && exportQuery.has('venue') && exportQuery.get('venue')! in sources) {
  modelSelect.value = exportQuery.get('venue')!;
  if (themeSelect) themeSelect.value = exportQuery.get('theme') === 'night' ? 'night' : 'day';
  void exportSelected();
}
