import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** Batch opaque static parts, retaining visibility boundaries, picking and selection strips. */
export function batchModel(root: THREE.Group) {
  root.updateMatrixWorld(true);
  const owners = [root];
  root.traverse((node) => {
    if (
      node !== root &&
      (node.userData.planHide ||
        node.name === 'plan-labels' ||
        node.name === 'day-food' ||
        node.name === 'night-food')
    )
      owners.push(node as THREE.Group);
  });
  for (const owner of owners) {
    const inverse = owner.matrixWorld.clone().invert();
    const buckets = new Map<string, THREE.Mesh[]>();
    owner.traverse((node) => {
      if (
        !(node instanceof THREE.Mesh) ||
        node instanceof THREE.InstancedMesh ||
        node instanceof THREE.SkinnedMesh ||
        node.parent === root ||
        Array.isArray(node.material) ||
        node.userData.steam ||
        node.userData.baseColor ||
        node.material.transparent ||
        node.material.map
      )
        return;
      let parent = node.parent;
      while (parent && parent !== owner) {
        if (owners.includes(parent as THREE.Group)) return;
        parent = parent.parent;
      }
      const m = node.material as THREE.MeshStandardMaterial;
      const key = [
        m.type,
        m.color?.getHex(),
        m.roughness,
        m.metalness,
        m.emissive?.getHex(),
        m.emissiveIntensity,
        m.side,
        m.toneMapped,
        node.castShadow,
        node.receiveShadow,
        node.userData.kind,
        node.userData.id,
        Object.keys(node.geometry.attributes).sort().join(','),
      ].join('/');
      const bucket = buckets.get(key) ?? [];
      bucket.push(node);
      buckets.set(key, bucket);
    });
    for (const meshes of buckets.values()) {
      if (meshes.length < 2) continue;
      const parts = meshes.map((mesh) => {
        const geometry = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
        geometry.applyMatrix4(inverse.clone().multiply(mesh.matrixWorld));
        return geometry;
      });
      const geometry = mergeGeometries(parts, false);
      parts.forEach((part) => part.dispose());
      if (!geometry) continue;
      const first = meshes[0];
      const batch = new THREE.Mesh(geometry, first.material);
      batch.name = 'static-model-batch';
      batch.castShadow = first.castShadow;
      batch.receiveShadow = first.receiveShadow;
      batch.userData = { ...first.userData };
      meshes.forEach((mesh) => mesh.removeFromParent());
      owner.add(batch);
    }
  }
}
