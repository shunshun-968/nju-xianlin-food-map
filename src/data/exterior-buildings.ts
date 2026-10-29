import * as THREE from 'three';
import type { Catalog } from '../domain';
import type { ExteriorModel } from '../models/exteriors/types';
import { createExteriorLighting } from '../lib/exterior-lighting';

import { exteriorBuildings } from './exterior-specs';
export { exteriorBuildings } from './exterior-specs';

/** Bind to the live catalog; no copies of indoor data or standalone UI are imported. */
export async function loadExteriorModel(venueId: string, data: Catalog) {
  const spec = exteriorBuildings[venueId];
  if (!spec) return null;
  const factory = await spec.load();
  const model = factory.createBuilding();
  for (const mesh of model.entryMeshes) {
    const floorId = spec.floors[mesh.userData.entryId];
    if (data.floors.some((floor) => floor.id === floorId && floor.venueId === venueId)) {
      mesh.userData.kind = 'floor';
      mesh.userData.id = floorId;
    }
  }
  const lighting = createExteriorLighting(model);
  return {
    ...model,
    setNight: lighting.setNight,
    dispose() {
      lighting.dispose();
      model.dispose();
    },
  } satisfies ExteriorModel;
}

/** Fit the architecture and its access routes to the site's available viewport. */
export function exteriorFrame(model: ExteriorModel, venueId: string) {
  const spec = exteriorBuildings[venueId];
  const target = new THREE.Vector3(...spec.target);
  const view = new THREE.Matrix4()
    .lookAt(new THREE.Vector3(...spec.camera), target, new THREE.Vector3(0, 1, 0))
    .invert();
  view.multiply(new THREE.Matrix4().makeTranslation(-target.x, -target.y, -target.z));
  const bounds = new THREE.Box3();
  model.group.updateMatrixWorld(true);
  model.group.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    for (let node: THREE.Object3D | null = object; node; node = node.parent)
      if (!node.visible || node === model.layers.context || node === model.layers.labels) return;
    object.geometry.computeBoundingBox();
    if (object.geometry.boundingBox)
      bounds.union(
        object.geometry.boundingBox.clone().applyMatrix4(view.clone().multiply(object.matrixWorld)),
      );
  });
  return {
    range: Math.max(Math.abs(bounds.min.y), Math.abs(bounds.max.y)) * 1.08,
    halfWidth: Math.max(Math.abs(bounds.min.x), Math.abs(bounds.max.x)) * 1.08,
  };
}

/** An opaque facade must occlude the doorway behind it, even if it isn't clickable. */
export function pickExteriorFloor(model: ExteriorModel, raycaster: THREE.Raycaster): string | null {
  const hit = raycaster.intersectObject(model.group, true).find(({ object }) => {
    for (let node: THREE.Object3D | null = object; node; node = node.parent)
      if (!node.visible) return false;
    return true;
  });
  return hit?.object.userData.kind === 'floor' ? (hit.object.userData.id as string) : null;
}
