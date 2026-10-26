import * as THREE from 'three';
import type { ModelNorth } from '../data/model-orientation';

/** A horizontal compass disc: stable at top/eye-level views and independent of viewport aspect. */
export function modelCompassBearing(camera: THREE.Camera, north: ModelNorth): number {
  camera.updateWorldMatrix(true, false);
  // Camera's world-right basis, flattened onto the ground. No projected point can collapse at eye level.
  const m = camera.matrixWorld.elements;
  const length = Math.hypot(m[0], m[2]);
  if (length < 1e-8) return 0;
  const rightX = m[0] / length,
    rightZ = m[2] / length;
  const screenRight = north.x * rightX + north.z * rightZ;
  const screenUp = north.x * rightZ - north.z * rightX;
  return (THREE.MathUtils.radToDeg(Math.atan2(screenRight, screenUp)) + 360) % 360;
}

/** Match the roof plane except near the horizon, where a readable face-on disc takes over. */
export function modelCompassPose(camera: THREE.Camera, north: ModelNorth) {
  const bearing = modelCompassBearing(camera, north);
  // The horizontal plane normal is +Y. Its dot with the camera's back axis is sin(elevation).
  const groundScale = THREE.MathUtils.clamp(Math.abs(camera.matrixWorld.elements[9]), 0, 1);
  const edgeMix =
    1 -
    THREE.MathUtils.smoothstep(
      groundScale,
      Math.sin(THREE.MathUtils.degToRad(8)),
      Math.sin(THREE.MathUtils.degToRad(18)),
    );
  return {
    bearing,
    groundScale,
    edgeMix,
    scale: THREE.MathUtils.lerp(groundScale, 1, edgeMix),
  };
}

/** Billboard letters follow their points on the tilted disc, while retaining readable glyphs. */
export function compassLetterPosition(bearing: number, scale: number, direction: number) {
  const angle = THREE.MathUtils.degToRad(bearing + direction);
  return { x: 50 + 37 * Math.sin(angle), y: 50 - 37 * scale * Math.cos(angle) };
}
