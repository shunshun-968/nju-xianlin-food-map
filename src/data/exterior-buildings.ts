import * as THREE from 'three';
import type { Catalog } from '../domain';
import type { ExteriorGeometryModel, ExteriorModel } from '../models/exteriors/types';
import { createExteriorLighting } from '../lib/exterior-lighting';

type ExteriorSpec = {
  camera: [number, number, number];
  target: [number, number, number];
  range: number;
  halfWidth: number;
  floors: Readonly<Record<string, string>>;
  load: () => Promise<{ createBuilding(): ExteriorGeometryModel }>;
};

// These are navigation IDs in the current catalog, not physical storey numbers.
// Several exterior doors can enter the same dining space, at its actual elevation.
export const exteriorBuildings: Readonly<Record<string, ExteriorSpec>> = {
  'v-456': {
    camera: [89, 63, 99],
    target: [3, 6, 0],
    range: 43,
    halfWidth: 44,
    floors: {
      'fourth-east': 'v-456-f1',
      'fourth-south': 'v-456-f1',
      'fourth-north': 'v-456-f1',
      'fifth-east-south': 'v-456-f2',
      'fifth-east-north': 'v-456-f2',
      'fifth-south': 'v-456-f2',
      'sixth-east': 'v-456-f3',
    },
    load: () => import('../models/exteriors/fourth-fifth-sixth.js'),
  },
  'v-10': {
    camera: [-94, 62, -96],
    target: [0, 5, 0],
    range: 43,
    halfWidth: 47,
    floors: {
      'tenth-south': 'v-10-f1',
      'tenth-west': 'v-10-f1',
      'tenth-north': 'v-10-f1',
      'faculty-north': 'v-10-f2',
    },
    load: () => import('../models/exteriors/tenth-building.js'),
  },
  'v-891': {
    camera: [-90, 60, 112],
    target: [0, 5, 0],
    range: 44,
    halfWidth: 47,
    floors: {
      'minzu-south': 'v-891-f1',
      'minzu-west': 'v-891-f1',
      'eighth-south': 'v-891-f2',
      'eighth-east': 'v-891-f2',
      'ninth-south': 'v-891-f3',
    },
    load: () => import('../models/exteriors/minzu89-building.js'),
  },
  'v-1112': {
    camera: [100, 68, -112],
    target: [3, 7, 0],
    range: 48,
    halfWidth: 54,
    floors: {
      'eleventh-north': 'v-1112-f1',
      'eleventh-east': 'v-1112-f1',
      'eleventh-south': 'v-1112-f1',
      'twelfth-north': 'v-1112-f2',
      'twelfth-east': 'v-1112-f2',
    },
    load: () => import('../models/exteriors/eleven-twelve-building.js'),
  },
};

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
