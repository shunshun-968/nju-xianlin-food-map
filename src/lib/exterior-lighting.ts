import * as THREE from 'three';
import type { ExteriorGeometryModel } from '../models/exteriors/types';

// 暖白餐厅灯搭配少量暗窗；沿用模型自己的玻璃分组，不改变墙体或金属材质。
const WINDOW_TONES = ['#ffdcab', '#ffd39a', '#ffe7c4', '#b6cbe4', '#ffe0b1', '#ffcd94'];
const WINDOW_INTENSITIES = [1.55, 1.05, 1.85, 0.12, 1.3, 0.75];

/** 程序纹理表现室内上亮下暗的透光，近看可见灯槽、窗边暗部和家具剪影。 */
function windowLightMap() {
  const size = 64;
  const pixels = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / (size - 1),
        v = y / (size - 1);
      const edge = Math.min(1, Math.min(u, 1 - u) * 10);
      let value = (0.44 + v * 0.48) * (0.65 + edge * 0.35);
      if (v > 0.81 && v < 0.86 && u > 0.12 && u < 0.88) value = 1;
      if (v > 0.16 && v < 0.21 && u > 0.08 && u < 0.92) value *= 0.55;
      if (v < 0.17 && (Math.abs(u - 0.24) < 0.022 || Math.abs(u - 0.76) < 0.022)) value *= 0.6;
      const offset = (y * size + x) * 4;
      pixels[offset] = pixels[offset + 1] = pixels[offset + 2] = Math.round(value * 255);
      pixels[offset + 3] = 255;
    }
  }
  const texture = new THREE.DataTexture(pixels, size, size, THREE.RGBAFormat);
  texture.name = 'exterior-interior-light-gradient';
  texture.magFilter = texture.minFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

export function createExteriorLighting(model: ExteriorGeometryModel) {
  const windows = new Set<THREE.MeshStandardMaterial>();
  model.group.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      if (
        material instanceof THREE.MeshStandardMaterial &&
        material.userData.exteriorLighting === 'window'
      )
        windows.add(material);
    }
  });
  const original = [...windows].map((material) => ({
    material,
    color: material.color.clone(),
    emissive: material.emissive.clone(),
    emissiveIntensity: material.emissiveIntensity,
    emissiveMap: material.emissiveMap,
    roughness: material.roughness,
    metalness: material.metalness,
    envMapIntensity: material.envMapIntensity,
  }));
  const texture = windowLightMap();
  const lighting = new THREE.Group();
  lighting.name = 'exterior-night-lighting';
  lighting.visible = false;
  model.group.add(lighting);
  model.group.updateMatrixWorld(true);
  const inverse = model.group.matrixWorld.clone().invert();
  const lights: THREE.PointLight[] = [];
  const geometries = new Set<THREE.BufferGeometry>();
  const fixtureMaterial = new THREE.MeshBasicMaterial({ color: '#ffe5b5', toneMapped: false });

  // 复制真实门厅的局部坐标，兼容旋转后的四五六模型、半地下门及上层平台。
  // 每门只用一盏有限照射距离的无阴影灯，避免给上千块玻璃逐一增加实时光源。
  for (const entry of model.entrances) {
    const portal = model.group.getObjectByName(`entry-${entry.id}`);
    if (!portal) continue;
    const anchor = new THREE.Group();
    anchor.name = `night-entry-${entry.id}`;
    inverse
      .clone()
      .multiply(portal.matrixWorld)
      .decompose(anchor.position, anchor.quaternion, anchor.scale);
    lighting.add(anchor);
    const light = new THREE.PointLight('#ffcf91', 0, 11, 2);
    light.position.set(0, 2.7, 1.05);
    anchor.add(light);
    lights.push(light);

    const geometry = new THREE.BoxGeometry(3.8, 0.055, 0.16);
    geometries.add(geometry);
    const fixture = new THREE.Mesh(geometry, fixtureMaterial);
    fixture.name = 'entrance-warm-soffit';
    fixture.position.set(0, 2.86, 0.35);
    // 纯照明附件不参加门口拾取，也不遮挡原来的门牌和导航。
    fixture.raycast = () => {};
    anchor.add(fixture);
  }

  let isNight = false;
  let disposed = false;
  function setNight(night: boolean) {
    if (disposed || night === isNight) return;
    isNight = night;
    lighting.visible = night;
    for (const light of lights) light.intensity = night ? 32 : 0;
    for (const state of original) {
      const { material } = state;
      const variant =
        Math.abs(Math.trunc(Number(material.userData.exteriorLightVariant) || 0)) %
        WINDOW_TONES.length;
      material.color.copy(
        night ? new THREE.Color(variant === 3 ? '#41536a' : '#b8b09e') : state.color,
      );
      material.emissive.copy(night ? new THREE.Color(WINDOW_TONES[variant]) : state.emissive);
      material.emissiveIntensity = night ? WINDOW_INTENSITIES[variant] : state.emissiveIntensity;
      material.emissiveMap = night ? texture : state.emissiveMap;
      material.roughness = night ? 0.38 : state.roughness;
      material.metalness = night ? 0.06 : state.metalness;
      material.envMapIntensity = night ? 0.18 : state.envMapIntensity;
      material.needsUpdate = true;
    }
  }
  return {
    setNight,
    dispose() {
      if (disposed) return;
      setNight(false);
      disposed = true;
      lighting.removeFromParent();
      lights.forEach((light) => light.dispose());
      geometries.forEach((geometry) => geometry.dispose());
      fixtureMaterial.dispose();
      texture.dispose();
    },
  };
}
