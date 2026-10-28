import * as THREE from 'three';
import type { Stall } from '../domain';

/** 只拾取小屋和售卖设备的实际可见表面；草地、空中背景与隐藏餐段不响应。 */
export function createNinanHutPickTargets(stall: Stall, model: THREE.Group) {
  const group = new THREE.Group();
  group.name = 'ninan-hut-pick-targets';
  const owners = ['ninan-structure', 'ninan-breakfast', 'ninan-lunch', 'ninan-dinner']
    .map((name) => model.getObjectByName(name))
    .filter((object): object is THREE.Object3D => !!object);

  return {
    group,
    setMode() {},
    pick(raycaster: THREE.Raycaster): string | undefined {
      if (!group.visible) return;
      model.updateWorldMatrix(true, true);
      const hit = raycaster.intersectObjects(owners, true).find(({ object }) => {
        for (let node: THREE.Object3D | null = object; node; node = node.parent)
          if (!node.visible) return false;
        return true;
      });
      return hit ? stall.id : undefined;
    },
  };
}
