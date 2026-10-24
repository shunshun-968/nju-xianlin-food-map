import { MathUtils, Spherical, Vector3 } from 'three';
import type { OrbitControls } from 'three/addons/controls/OrbitControls.js';

/** Add click-to-orbit without synthetic drags or private OrbitControls APIs.
 * OrbitControls still owns left-drag pan, wheel zoom and touch gestures.
 * All model cameras in this project use +Y as up.
 */
export function attachModelMouseControls(
  canvas: HTMLCanvasElement,
  controls: OrbitControls,
  onInteract: () => void,
) {
  let active = false;
  let previous: [number, number] | null = null;
  let rightDown: [number, number] | null = null;
  const offset = new Vector3();
  const spherical = new Spherical();
  const reset = () => {
    active = false;
    previous = null;
    rightDown = null;
    canvas.dataset.rotationMode = 'false';
  };
  reset();

  const down = (event: PointerEvent) => {
    if (event.pointerType !== 'mouse') return;
    previous = null;
    if (event.button !== 2) return;
    // Never start OrbitControls' right-button drag (or its pointer capture).
    event.preventDefault();
    event.stopImmediatePropagation();
    rightDown = event.buttons === 2 ? [event.clientX, event.clientY] : null;
  };
  const up = (event: PointerEvent) => {
    if (event.pointerType !== 'mouse' || event.button !== 2) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const start = rightDown;
    rightDown = null;
    if (!start || Math.hypot(event.clientX - start[0], event.clientY - start[1]) > 6) return;
    if (!controls.enabled || !controls.enableRotate) return;
    active = !active;
    previous = active ? [event.clientX, event.clientY] : null;
    canvas.dataset.rotationMode = String(active);
    onInteract();
  };
  const move = (event: PointerEvent) => {
    if (event.pointerType !== 'mouse') return;
    // Captured left drags may leave the canvas: keep pan in OrbitControls.
    if (!active || !controls.enabled || !controls.enableRotate || event.buttons !== 0) {
      previous = null;
      return;
    }
    const next: [number, number] = [event.clientX, event.clientY];
    if (previous) {
      const scale = (2 * Math.PI * controls.rotateSpeed) / Math.max(canvas.clientHeight, 1);
      offset.copy(controls.object.position).sub(controls.target);
      spherical.setFromVector3(offset);
      spherical.theta = MathUtils.clamp(
        spherical.theta - (next[0] - previous[0]) * scale,
        controls.minAzimuthAngle,
        controls.maxAzimuthAngle,
      );
      spherical.phi = MathUtils.clamp(
        spherical.phi - (next[1] - previous[1]) * scale,
        controls.minPolarAngle,
        controls.maxPolarAngle,
      );
      spherical.makeSafe();
      controls.object.position.copy(controls.target).add(offset.setFromSpherical(spherical));
      controls.update();
      onInteract();
    }
    previous = next;
  };
  const leave = () => {
    previous = null;
    rightDown = null;
  };
  const context = (event: MouseEvent) => event.preventDefault();
  const escape = (event: KeyboardEvent) => {
    if (event.key !== 'Escape' || !active) return;
    // First Escape exits orbit; a subsequent Escape can navigate back.
    event.preventDefault();
    event.stopImmediatePropagation();
    reset();
  };
  const visibility = () => {
    if (document.hidden) reset();
  };
  canvas.addEventListener('pointerdown', down, true);
  canvas.addEventListener('pointerup', up, true);
  canvas.addEventListener('pointermove', move);
  canvas.addEventListener('pointerleave', leave);
  canvas.addEventListener('pointercancel', reset);
  canvas.addEventListener('contextmenu', context);
  window.addEventListener('blur', reset);
  window.addEventListener('keydown', escape, true);
  document.addEventListener('visibilitychange', visibility);
  return {
    reset,
    isActive: () => active,
    dispose() {
      reset();
      canvas.removeEventListener('pointerdown', down, { capture: true });
      canvas.removeEventListener('pointerup', up, { capture: true });
      canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerleave', leave);
      canvas.removeEventListener('pointercancel', reset);
      canvas.removeEventListener('contextmenu', context);
      window.removeEventListener('blur', reset);
      window.removeEventListener('keydown', escape, { capture: true });
      document.removeEventListener('visibilitychange', visibility);
    },
  };
}
