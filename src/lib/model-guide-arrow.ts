import * as THREE from 'three';

type ArrowProfile = {
  /** Radius relative to the shorter side of this model's visible footprint. */
  radiusRatio: number;
  lift: number;
  offsetX: number;
  offsetZ: number;
  angle: number;
};

// Each exterior entry scene gets its own roof clearance and footprint alignment. Offsets
// are fractions of its visible bounds, so no screen corner or compass is an anchor.
export const modelGuideArrowProfiles: Readonly<Record<string, ArrowProfile>> = {
  'building:v-456': { radiusRatio: 0.085, lift: 2.5, offsetX: 0, offsetZ: -0.02, angle: -0.4 },
  'building:v-891': { radiusRatio: 0.08, lift: 2.7, offsetX: -0.015, offsetZ: 0.015, angle: 0.7 },
  'building:v-10': { radiusRatio: 0.085, lift: 2.3, offsetX: 0.01, offsetZ: 0, angle: -0.8 },
  'building:v-1112': { radiusRatio: 0.085, lift: 2.8, offsetX: 0, offsetZ: 0.02, angle: 0.3 },
  'building:v-hut': { radiusRatio: 0.09, lift: 0.65, offsetX: -0.08, offsetZ: -0.08, angle: -0.45 },
  'building:v-south': { radiusRatio: 0.15, lift: 0.6, offsetX: 0, offsetZ: -0.025, angle: 0.4 },
  'building:v-yifu': { radiusRatio: 0.16, lift: 0.6, offsetX: -0.015, offsetZ: -0.06, angle: -0.2 },
};

function visibleBounds(content: THREE.Group) {
  content.updateWorldMatrix(true, true);
  const bounds = new THREE.Box3();
  content.traverseVisible((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    if (materials.every((m) => !m.visible || (m.transparent && m.opacity === 0))) return;
    if (!object.geometry.boundingBox) object.geometry.computeBoundingBox();
    if (object.geometry.boundingBox)
      bounds.union(object.geometry.boundingBox.clone().applyMatrix4(object.matrixWorld));
  });
  return bounds;
}

/** A small real 3D arrow, horizontal like the roof, owned only by the tutorial. */
export function createModelGuideArrow(content: THREE.Group, key: string, night: boolean) {
  const group = new THREE.Group();
  group.name = 'model-guide-spatial-arrow';
  const bounds = visibleBounds(content);
  if (bounds.isEmpty()) bounds.set(new THREE.Vector3(-1, 0, -1), new THREE.Vector3(1, 1, 1));
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  const profile = modelGuideArrowProfiles[key] ?? {
    radiusRatio: 0.13,
    lift: Math.max(0.5, size.y * 0.1),
    offsetX: 0,
    offsetZ: 0,
    angle: 0,
  };
  const radius = THREE.MathUtils.clamp(Math.min(size.x, size.z) * profile.radiusRatio, 0.55, 7);
  const thickness = radius * 0.045;
  const inner = radius * 0.76;
  const end = Math.PI * 1.63;
  const cos = Math.cos(end),
    sin = Math.sin(end);
  const shape = new THREE.Shape();
  shape.moveTo(radius, 0);
  shape.absarc(0, 0, radius, 0, end, false);
  shape.lineTo(cos * radius * 1.16, sin * radius * 1.16);
  shape.lineTo(
    cos * radius * 0.88 - sin * radius * 0.48,
    sin * radius * 0.88 + cos * radius * 0.48,
  );
  shape.lineTo(cos * radius * 0.59, sin * radius * 0.59);
  shape.lineTo(cos * inner, sin * inner);
  shape.absarc(0, 0, inner, end, 0, true);
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: false,
    curveSegments: 32,
    steps: 1,
  });
  // Extrusion occupies +Y. Its planar faces are parallel to the model's XZ roof.
  geometry.rotateX(-Math.PI / 2);
  const top = new THREE.MeshBasicMaterial({
    color: night ? '#d2b9e3' : '#b29bc4',
    toneMapped: false,
  });
  const side = new THREE.MeshBasicMaterial({
    color: night ? '#9675ad' : '#76548e',
    toneMapped: false,
  });
  const mesh = new THREE.Mesh(geometry, [top, side]);
  mesh.name = 'model-guide-arrow-ribbon';
  mesh.raycast = () => {};
  const outlineGeometry = new THREE.EdgesGeometry(geometry, 30);
  const outlineMaterial = new THREE.LineBasicMaterial({
    color: night ? '#e2cfed' : '#76548e',
    toneMapped: false,
  });
  const outline = new THREE.LineSegments(outlineGeometry, outlineMaterial);
  outline.raycast = () => {};
  group.add(mesh, outline);
  const baseY = bounds.max.y + profile.lift;
  group.position.set(
    center.x + size.x * profile.offsetX,
    baseY,
    center.z + size.z * profile.offsetZ,
  );
  group.rotation.y = profile.angle;
  group.userData = { tutorial: true, modelKey: key, radius, baseY, roofY: bounds.max.y, thickness };
  let disposed = false;
  return {
    group,
    tick(time: number) {
      if (!disposed) group.rotation.y = profile.angle + (time * Math.PI) / 9;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      group.removeFromParent();
      geometry.dispose();
      top.dispose();
      side.dispose();
      outlineGeometry.dispose();
      outlineMaterial.dispose();
      group.clear();
    },
  };
}
