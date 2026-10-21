import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { themes, type Catalog, type MapTheme, type View } from '../domain';

export type SceneHandle = { zoom: (factor: number) => void; reset: () => void; rotate: () => void };
type Props = {
  data: Catalog;
  view: View;
  theme: MapTheme;
  onPick: (kind: string, id: string) => void;
  selectedStall: string | null;
};
type Engine = {
  scene: THREE.Scene;
  camera: THREE.OrthographicCamera;
  renderer: THREE.WebGLRenderer;
  controls: OrbitControls;
  content: THREE.Group;
  goal: THREE.Vector3;
  focus: THREE.Vector3;
  animating: boolean;
  range: number;
};

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
function region(parent: THREE.Object3D, points: number[][], color: string, y = 0.02) {
  const shape = new THREE.Shape();
  points.forEach(([x, z], i) => (i ? shape.lineTo(x, -z) : shape.moveTo(x, -z)));
  shape.closePath();
  const mesh = new THREE.Mesh(
    new THREE.ShapeGeometry(shape),
    new THREE.MeshStandardMaterial({ color, side: THREE.DoubleSide }),
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = y;
  mesh.receiveShadow = true;
  parent.add(mesh);
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
  { data, view, theme, onPick, selectedStall },
  ref,
) {
  const host = useRef<HTMLDivElement>(null),
    engine = useRef<Engine | null>(null),
    callback = useRef(onPick);
  const [error, setError] = useState(false);
  callback.current = onPick;
  useImperativeHandle(ref, () => ({
    zoom(factor) {
      const e = engine.current;
      if (e) {
        e.camera.zoom = THREE.MathUtils.clamp(e.camera.zoom * factor, 0.55, 4);
        e.camera.updateProjectionMatrix();
      }
    },
    reset() {
      const e = engine.current;
      if (e) {
        e.camera.zoom = 1;
        e.camera.updateProjectionMatrix();
        e.animating = true;
      }
    },
    rotate() {
      const e = engine.current;
      if (e) {
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
    renderer.domElement.setAttribute('aria-label', '校园三维示意地图；可使用左侧列表选择场所');
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
    const content = new THREE.Group();
    scene.add(content);
    scene.add(new THREE.HemisphereLight('#ffffff', '#9da495', 1.5));
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
      content,
      goal: camera.position.clone(),
      focus: new THREE.Vector3(),
      animating: true,
      range: 94,
    };
    engine.current = e;
    const resize = () => {
      const { width, height } = element.getBoundingClientRect();
      if (!height || !width) return;
      const aspect = width / height;
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
    controls.addEventListener('start', () => {
      e.animating = false;
    });
    const raycaster = new THREE.Raycaster(),
      pointer = new THREE.Vector2();
    let start = [0, 0];
    const down = (event: PointerEvent) => {
      start = [event.clientX, event.clientY];
    };
    const up = (event: PointerEvent) => {
      if (event.button !== 0 || Math.hypot(event.clientX - start[0], event.clientY - start[1]) > 6)
        return;
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.set(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        (-(event.clientY - rect.top) / rect.height) * 2 + 1,
      );
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster
        .intersectObjects(content.children, true)
        .find((h) => h.object.userData.kind);
      if (hit) callback.current(hit.object.userData.kind, hit.object.userData.id);
    };
    renderer.domElement.addEventListener('pointerdown', down);
    renderer.domElement.addEventListener('pointerup', up);
    renderer.setAnimationLoop(() => {
      if (e.animating) {
        const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        camera.position.lerp(e.goal, reduce ? 1 : 0.085);
        controls.target.lerp(e.focus, reduce ? 1 : 0.085);
        if (camera.position.distanceTo(e.goal) < 0.03) e.animating = false;
      }
      controls.update();
      renderer.render(scene, camera);
    });
    return () => {
      observer.disconnect();
      renderer.setAnimationLoop(null);
      renderer.domElement.removeEventListener('pointerdown', down);
      renderer.domElement.removeEventListener('pointerup', up);
      controls.dispose();
      dispose(content);
      renderer.dispose();
      element.removeChild(renderer.domElement);
      engine.current = null;
    };
  }, []);

  useEffect(() => {
    const e = engine.current;
    if (!e) return;
    const { content, scene, camera, controls } = e;
    const t = themes[theme];
    dispose(content);
    scene.background = new THREE.Color(t.ground);
    camera.zoom = 1;
    if (view.level === 'campus') {
      e.range = 94;
      e.goal.set(0, 180, 85);
      e.focus.set(0, 0, 0);
      const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(600, 600),
        new THREE.MeshBasicMaterial({ color: t.ground, toneMapped: false }),
      );
      ground.rotation.x = -Math.PI / 2;
      ground.position.y = -0.1;
      content.add(ground);
      region(
        content,
        [
          [-5, -85],
          [37, -82],
          [51, -50],
          [46, 10],
          [27, 17],
          [14, 0],
          [10, -29],
          [-4, -37],
          [-16, -32],
          [-19, -48],
        ],
        t.park,
      );
      region(
        content,
        [
          [-7, -10],
          [15, -17],
          [29, 4],
          [19, 24],
          [3, 28],
          [-10, 15],
        ],
        t.park,
      );
      region(
        content,
        [
          [2, -83],
          [9, -94],
          [30, -91],
          [36, -82],
          [27, -74],
          [13, -75],
        ],
        t.water,
        0.08,
      );
      path(
        content,
        [
          [-13, -65],
          [-16, -32],
          [-17, -3],
          [-9, 24],
          [3, 51],
          [18, 72],
        ],
        t.water,
        3,
      );
      path(
        content,
        [
          [-49, -75],
          [-47, -25],
          [-43, 23],
          [-30, 65],
          [-23, 85],
          [46, 81],
          [52, 30],
          [54, -25],
          [44, -86],
          [-17, -91],
          [-49, -75],
        ],
        t.road,
        3.5,
      );
      path(
        content,
        [
          [-16, -83],
          [-17, -43],
          [-17, -18],
          [-12, 10],
          [1, 36],
          [16, 60],
          [19, 81],
        ],
        t.road,
        2.2,
      );
      for (const z of [-64, -36, -11, 24, 49, 68])
        path(
          content,
          [
            [-47, z],
            [-16, z + 2],
            [9, z - 5],
            [48, z - 4],
          ],
          t.road,
          2,
        );
      path(
        content,
        [
          [-14, -30],
          [-3, -46],
          [22, -49],
          [48, -47],
        ],
        t.road,
        2.5,
      );
      const blocks = [
        [-37, -70],
        [-27, -70],
        [-36, -61],
        [-26, -60],
        [-37, -37],
        [-28, -35],
        [-36, -25],
        [-26, -24],
        [-34, 0],
        [-26, -1],
        [-33, 25],
        [-28, 55],
        [-24, 70],
        [-12, 72],
        [27, 68],
        [36, 68],
        [29, 57],
        [40, 54],
        [27, 25],
        [37, 22],
        [28, 13],
        [14, 44],
        [36, 43],
        [24, -36],
        [33, -36],
        [-7, -22],
        [1, -22],
      ];
      blocks.forEach(([x, z], i) => {
        const w = 6 + (i % 3);
        box(content, x, 0, z, w, 1.5 + (i % 3) * 0.5, 4, t.building);
        box(content, x, 0.1, z + 3, w, 0.5, 1.4, t.building);
      });
      // 示意运动场和教学区，形状只用于表达空间层次。
      box(content, -34, 0.01, -12, 13, 0.15, 15, theme === 'night' ? '#4b4657' : '#d5b7aa');
      box(content, -34, 0.17, -12, 8, 0.1, 10, t.park);
      box(content, 9, 0.01, 61, 12, 0.15, 15, theme === 'night' ? '#4b4657' : '#d5b7aa');
      box(content, 9, 0.17, 61, 7, 0.1, 10, t.park);
      for (let i = 0; i < 72; i++) {
        const x = 12 + Math.sin(i * 2.399) * Math.sqrt(i) * 3.8,
          z = -48 + Math.cos(i * 2.399) * Math.sqrt(i) * 4;
        const tree = new THREE.Mesh(
          new THREE.IcosahedronGeometry(1.6 + (i % 3) * 0.25, 0),
          new THREE.MeshStandardMaterial({
            color: i % 2 ? t.park : theme === 'night' ? '#3b504a' : '#b6cfa7',
          }),
        );
        tree.position.set(x, 1.5, z);
        tree.castShadow = true;
        content.add(tree);
      }
      label(content, '仙 林 校 区', 18, 2, -63, t.text, 5);
      label(content, '山 林 与 湖', 28, 2, -21, t.text, 3);
      label(content, '教学区', 34, 2, 52, t.text, 3);
      label(content, '仙 林 大 道', 4, 1, 91, t.text, 4);
      data.venues.forEach((v) => {
        const [x, z] = v.campusPosition,
          [w, d] = v.footprint;
        const h = v.kind === 'cart' ? 2.5 : 5;
        box(content, x, 0, z, w, h, d, t.accent, { kind: 'venue', id: v.id });
        box(content, x, h, z, w + 0.6, 0.5, d + 0.6, theme === 'night' ? '#dbc4ef' : '#f7eef8', {
          kind: 'venue',
          id: v.id,
        });
        for (let j = 0; j < 3; j++)
          box(content, x - w / 3 + (j * w) / 3, 1.7, z + d / 2 + 0.03, 1.2, 1.6, 0.1, '#f9e4a8');
        label(content, v.shortName, x, h + 3.7, z, t.accent, 3.2, true).userData = {
          kind: 'venue',
          id: v.id,
        };
      });
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
    controls.enableRotate = view.level !== 'campus';
    e.animating = true;
  }, [data, view, theme]);
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
    <div className="scene" ref={host}>
      {error && (
        <div className="scene-error">
          <strong>当前设备未能启动 3D 地图</strong>
          <p>仍可通过左侧列表查看场所、楼层和窗口。请使用支持 WebGL 的浏览器。</p>
        </div>
      )}
    </div>
  );
});
