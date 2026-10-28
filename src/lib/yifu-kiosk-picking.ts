import * as THREE from 'three';
import type { Stall } from '../domain';

/** B102 整间房共用一个窗口：俯视补满房间，三维只补实际地板，实际墙/家具仍由模型拾取。 */
export function createYifuKioskPickTargets(stall: Stall) {
  const group = new THREE.Group();
  group.name = 'yifu-whole-room-pick-targets';
  group.position.set(stall.position.x, 0, stall.position.z);
  group.rotation.y = stall.position.rotationY;
  const material = new THREE.MeshBasicMaterial({ visible: false });

  function horizontalSurface(name: string, width: number, depth: number, y: number) {
    // Float32 几何边界留不到一微米余量，确保恰好点在墙角时也可命中。
    const surface = new THREE.Mesh(
      new THREE.PlaneGeometry(width + 0.000001, depth + 0.000001),
      material,
    );
    surface.name = name;
    surface.rotation.x = -Math.PI / 2;
    surface.position.y = y;
    surface.userData = { kind: 'stall', id: stall.id, stallId: stall.id };
    group.add(surface);
    return surface;
  }

  // 含实体外墙厚度：x ±3.08、z ±3.58，覆盖空地、过道、门口与墙边。
  const plan = horizontalSurface(
    'yifu-plan-room-footprint',
    stall.position.width + 0.36,
    stall.position.depth + 0.36,
    4.2,
  );
  // 与房间底座 6.03 × 7.03 米一致；不以立方包围盒截获室外空中背景。
  const floor = horizontalSurface(
    'yifu-three-dimensional-floor-footprint',
    stall.position.width + 0.23,
    stall.position.depth + 0.23,
    0.008,
  );
  let active = floor;
  plan.visible = false;

  return {
    group,
    setMode(mode: 'plan' | '3d') {
      plan.visible = mode === 'plan';
      floor.visible = mode === '3d';
      active = mode === 'plan' ? plan : floor;
    },
    pick(raycaster: THREE.Raycaster): string | undefined {
      // Three.js 的 Raycaster 本身不会检查 visible；同时检查祖先避免缓存的隐藏模型误中。
      for (let object: THREE.Object3D | null = active; object; object = object.parent)
        if (!object.visible) return;
      group.updateWorldMatrix(true, true);
      return raycaster.intersectObject(active, false)[0]?.object.userData.stallId;
    },
  };
}
