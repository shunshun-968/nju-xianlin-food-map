import * as THREE from 'three';
import type { FourthCanteenModel } from '../../components/FourthCanteenModel';

/** 仅用于校园地图的简洁白色小屋图标；详细 B102 室内模型保持独立。南门为 +Z。 */
export function createYifuMapHouse(): FourthCanteenModel {
  const group = new THREE.Group();
  group.name = 'yifu-map-white-house';
  const wall = new THREE.MeshStandardMaterial({ color: '#f1f3ef', roughness: 0.86 });
  const roof = new THREE.MeshStandardMaterial({ color: '#f8f9f5', roughness: 0.82 });
  const roofInset = new THREE.MeshStandardMaterial({ color: '#e8ebe5', roughness: 0.88 });
  const stone = new THREE.MeshStandardMaterial({ color: '#bfc5bd', roughness: 0.9 });
  const frame = new THREE.MeshStandardMaterial({
    color: '#526b63',
    roughness: 0.61,
    metalness: 0.06,
  });
  const recess = new THREE.MeshStandardMaterial({ color: '#253b35', roughness: 0.95 });
  const door = new THREE.MeshStandardMaterial({ color: '#657b70', roughness: 0.66 });
  const doorGlass = new THREE.MeshStandardMaterial({
    color: '#6d8981',
    roughness: 0.38,
    metalness: 0.1,
  });
  const sideGlass = new THREE.MeshStandardMaterial({
    color: '#69847f',
    roughness: 0.4,
    metalness: 0.1,
  });
  const handle = new THREE.MeshStandardMaterial({
    color: '#c3cbc3',
    roughness: 0.36,
    metalness: 0.65,
  });

  function box(
    name: string,
    x: number,
    y: number,
    z: number,
    width: number,
    height: number,
    depth: number,
    material: THREE.Material,
  ) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
    mesh.name = name;
    mesh.position.set(x, y, z);
    mesh.castShadow = mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  }

  // 墙体完整封闭，南门以真实凹口与分段墙表现，不使用室内剖面或立面贴图。
  box('house-plinth', 0, 0.025, 0, 6.36, 0.15, 4.56, stone);
  box('west-white-wall', -3, 1.5, 0, 0.2, 2.8, 4.4, wall);
  box('east-white-wall', 3, 1.5, 0, 0.2, 2.8, 4.4, wall);
  box('north-white-wall', 0, 1.5, -2.1, 5.8, 2.8, 0.2, wall);
  box('south-white-wall-left', -1.485, 1.5, 2.1, 3.23, 2.8, 0.2, wall);
  box('south-white-wall-right', 2.285, 1.5, 2.1, 1.63, 2.8, 0.2, wall);
  box('south-white-wall-over-door', 0.8, 2.615, 2.1, 1.34, 0.57, 0.2, wall);

  // 完整平顶、薄屋檐与低矮女儿墙，使地图尺度下仍能读出屋顶和墙身。
  box('complete-flat-roof', 0, 2.96, 0, 6.44, 0.14, 4.64, roof);
  box('flat-roof-inset', 0, 3.032, 0, 6.26, 0.004, 4.46, roofInset);
  box('roof-front-edge', 0, 3.075, 2.2875, 6.44, 0.09, 0.065, roof);
  box('roof-rear-edge', 0, 3.075, -2.2875, 6.44, 0.09, 0.065, roof);
  box('roof-west-edge', -3.1875, 3.075, 0, 0.065, 0.09, 4.51, roof);
  box('roof-east-edge', 3.1875, 3.075, 0, 0.065, 0.09, 4.51, roof);

  // 灰绿门扇后退于白墙，白天能辨认门框、上半部玻璃及短门把。
  box('south-door-recess', 0.8, 1.215, 1.96, 1.34, 2.23, 0.06, recess);
  box('south-door-leaf', 0.8, 1.205, 2.025, 1.22, 2.17, 0.045, door);
  box('south-door-upper-glass', 0.8, 1.68, 2.051, 0.98, 0.99, 0.012, doorGlass);
  box('south-door-lower-panel', 0.8, 0.63, 2.052, 0.98, 0.77, 0.014, frame);
  box('south-door-frame-left', 0.105, 1.23, 2.195, 0.09, 2.28, 0.09, frame);
  box('south-door-frame-right', 1.495, 1.23, 2.195, 0.09, 2.28, 0.09, frame);
  box('south-door-frame-top', 0.8, 2.345, 2.195, 1.48, 0.09, 0.09, frame);
  box('south-door-handle', 1.27, 1.18, 2.098, 0.04, 0.24, 0.052, handle);
  box('south-door-threshold', 0.8, 0.13, 2.205, 1.5, 0.06, 0.47, stone);
  box('south-entry-step', 0.8, 0.025, 2.46, 1.82, 0.15, 0.75, stone);

  // 一扇小侧窗足以辨认房屋体量，不增加菜单、招牌或室内装饰。
  box('east-window-recess', 3.105, 1.72, -0.3, 0.016, 1.02, 1.32, recess);
  box('east-window-glass', 3.12, 1.72, -0.3, 0.018, 0.85, 1.15, sideGlass);
  for (const z of [-0.955, 0.355])
    box('east-window-side-frame', 3.14, 1.72, z, 0.07, 1.06, 0.07, roof);
  for (const y of [1.21, 2.23])
    box('east-window-horizontal-frame', 3.14, y, -0.3, 0.07, 0.07, 1.38, roof);
  box('east-window-mullion', 3.15, 1.72, -0.3, 0.06, 0.9, 0.04, frame);
  box('east-window-sill', 3.19, 1.18, -0.3, 0.22, 0.07, 1.46, roof);

  const hemi = new THREE.HemisphereLight('#f9fbff', '#a5aaa5', 2.1);
  const key = new THREE.DirectionalLight('#fffaf0', 2.5);
  key.position.set(-4.5, 8.5, 6);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  Object.assign(key.shadow.camera, { left: -5, right: 5, top: 5, bottom: -5, near: 0.5, far: 22 });
  key.shadow.normalBias = 0.025;
  key.shadow.bias = -0.0002;
  key.shadow.radius = 3;
  const fill = new THREE.DirectionalLight('#dce6ee', 0.8);
  fill.position.set(5, 4, -3);
  const doorwayLight = new THREE.PointLight('#ffd096', 0, 2.6, 2);
  doorwayLight.name = 'south-door-warm-night-light';
  doorwayLight.position.set(0.8, 1.25, 2.42);
  group.add(hemi, key, fill, doorwayLight);

  return {
    group,
    setMode() {},
    tick() {},
    setInterfaceTheme(night) {
      hemi.color.set(night ? '#d5e0f3' : '#f9fbff');
      hemi.groundColor.set(night ? '#818b9b' : '#a5aaa5');
      hemi.intensity = night ? 1.35 : 2.1;
      key.color.set(night ? '#d7e1f1' : '#fffaf0');
      key.intensity = night ? 1.5 : 2.5;
      fill.color.set(night ? '#c5d5ee' : '#dce6ee');
      fill.intensity = night ? 0.65 : 0.8;
      doorGlass.color.set(night ? '#d5bb92' : '#6d8981');
      doorGlass.emissive.set(night ? '#ffce83' : '#000000');
      doorGlass.emissiveIntensity = night ? 0.48 : 0;
      doorwayLight.intensity = night ? 1.8 : 0;
    },
  };
}
