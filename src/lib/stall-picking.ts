import * as THREE from 'three';
import type { Stall } from '../domain';

/** Invisible interaction surfaces follow the catalog's real window coordinates.
 * Plan: the entire kitchen footprint. 3D: the entire facade, from plinth to sign.
 * Keep these outside the visual model so batching, lighting and cached models stay intact.
 */
export function createStallPickTargets(stalls: Stall[]) {
  const group = new THREE.Group();
  group.name = 'stall-pick-targets';
  const plan = new THREE.Group();
  const facades = new THREE.Group();
  group.add(plan, facades);
  const material = new THREE.MeshBasicMaterial({ visible: false });
  const serviceEdges = new Map<string, { center: THREE.Vector3; normal: THREE.Vector3 }>();
  for (const stall of stalls) {
    const p = stall.position;
    const normal = new THREE.Vector3(Math.sin(p.rotationY), 0, Math.cos(p.rotationY));
    const center = new THREE.Vector3(p.x, 0, p.z).addScaledVector(normal, p.depth / 2);
    serviceEdges.set(stall.id, { center, normal });
    const footprint = new THREE.Mesh(new THREE.PlaneGeometry(p.width, p.depth + 0.3), material);
    footprint.position.set(p.x + normal.x * 0.15, 4.2, p.z + normal.z * 0.15);
    footprint.rotation.set(-Math.PI / 2, 0, p.rotationY);
    footprint.userData = { stallId: stall.id };
    plan.add(footprint);
    const facade = new THREE.Mesh(new THREE.PlaneGeometry(p.width, 3.75), material);
    facade.position.copy(center).addScaledVector(normal, 0.3);
    facade.position.y = 3.75 / 2;
    facade.rotation.y = p.rotationY;
    facade.userData = { stallId: stall.id };
    facades.add(facade);
  }
  let mode: 'plan' | '3d' = '3d';
  return {
    group,
    setMode(next: 'plan' | '3d') {
      mode = next;
    },
    pick(raycaster: THREE.Raycaster): string | undefined {
      if (!group.visible) return;
      group.updateWorldMatrix(true, true);
      const hits = raycaster.intersectObjects(mode === 'plan' ? plan.children : facades.children);
      if (mode === 'plan') {
        // Shared corner kitchens can have two perpendicular service edges.
        // Choose the nearer edge, rather than whichever face was listed first.
        const distanceToService = (hit: THREE.Intersection) => {
          const { center, normal } = serviceEdges.get(hit.object.userData.stallId)!;
          const local = group.worldToLocal(hit.point.clone());
          return Math.abs(local.sub(center).dot(normal));
        };
        hits.sort((a, b) => distanceToService(a) - distanceToService(b) || a.distance - b.distance);
      }
      return hits[0]?.object.userData.stallId;
    },
  };
}
