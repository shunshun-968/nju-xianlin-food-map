import * as THREE from 'three';
import type { Stall } from '../domain';
import { createWideVenueSelection } from './ninan-hut-selection';

/** 餐车沿用小屋的夜间宽光，缩放到车顶、前侧出餐台的范围。 */
export function createSouthGateCartSelection(
  stall: Stall,
  lighting: { model: THREE.Object3D; scene: THREE.Scene; fillLights: THREE.Light[] },
) {
  const samples: { position: THREE.Vector3; normal: THREE.Vector3 }[] = [];
  for (let x = -3.4; x <= 3.4; x += 0.2)
    for (let z = -1.2; z <= 2; z += 0.2)
      samples.push({ position: new THREE.Vector3(x, 3.55, z), normal: new THREE.Vector3(0, 1, 0) });
  return createWideVenueSelection(stall, lighting, {
    name: 'south-gate-cart',
    source: [-3, 11, 6],
    focus: [0, 1.3, 0.4],
    radius: 5.1,
    samples,
  });
}
