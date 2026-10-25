import * as THREE from 'three';
import type { Stall } from '../domain';

/** Illuminate the selected service area without recoloring the batched model. */
export function createStallSelection(
  stalls: Stall[],
  facadeHeights: Readonly<Record<string, number>> = {},
) {
  const group = new THREE.Group();
  group.name = 'stall-selection';
  const plan = new THREE.Group();
  const spatial = new THREE.Group();
  group.add(plan, spatial);
  const byId = new Map(stalls.map((stall) => [stall.id, stall]));
  let selected: string | null = null;
  let elapsed = 1;
  const materials: THREE.MeshBasicMaterial[] = [];

  // Keep the light count stable, including when the card is closed. Adding and
  // removing lights on every click would recompile all the model's materials.
  const lightCount = Math.max(1, ...stalls.map((stall) => 1 + (stall.serviceAreas?.length ?? 0)));
  const lights = Array.from({ length: lightCount }, () => {
    const light = new THREE.SpotLight('#fff0cf', 0);
    light.penumbra = 0.85;
    light.decay = 2;
    light.castShadow = false;
    group.add(light, light.target);
    return { light, intensity: 0 };
  });

  // A feathered pool of light adds readable feedback in the overhead view and
  // on unlit materials. Its transparent edges never form a selection box.
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const context = canvas.getContext('2d')!;
  const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, 'rgba(255, 249, 228, 0.95)');
  gradient.addColorStop(0.28, 'rgba(255, 246, 214, 0.75)');
  gradient.addColorStop(0.62, 'rgba(255, 233, 183, 0.28)');
  gradient.addColorStop(1, 'rgba(255, 230, 175, 0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 128, 128);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;

  function clear() {
    for (const layer of [plan, spatial]) {
      layer.traverse((object) => {
        if (object instanceof THREE.Mesh) object.geometry.dispose();
      });
      layer.clear();
    }
    for (const material of materials) material.dispose();
    materials.length = 0;
    for (const entry of lights) {
      entry.intensity = 0;
      entry.light.intensity = 0;
    }
  }

  function glow(width: number, height: number, overhead: boolean) {
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      color: '#fff4dc',
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: !overhead,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    material.userData.strength = overhead ? 0.17 : 0.13;
    materials.push(material);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
    mesh.renderOrder = overhead ? 15 : 3;
    mesh.raycast = () => {};
    return mesh;
  }

  function tick(delta: number, reducedMotion: boolean) {
    elapsed = reducedMotion ? 1 : Math.min(1, elapsed + delta);
    const progress = Math.min(1, elapsed / 0.42);
    const reveal = progress * progress * (3 - 2 * progress);
    // One gentle arrival, then a steady spotlight rather than ongoing flashing.
    const arrival = Math.sin(Math.PI * Math.min(1, elapsed / 0.9)) ** 2;
    const strength = reveal * (1 + arrival * 0.18);
    for (const entry of lights) entry.light.intensity = entry.intensity * strength;
    for (const material of materials)
      material.opacity = material.userData.strength * strength;
  }

  function select(id: string | null, replay = false) {
    if (id === selected) {
      if (replay && id) elapsed = 0;
      return;
    }
    selected = id;
    clear();
    const stall = id ? byId.get(id) : undefined;
    if (!stall) return;
    elapsed = 0;
    const height = facadeHeights[stall.id] ?? 3.75;
    for (const [index, p] of [stall.position, ...(stall.serviceAreas ?? [])].entries()) {
      const width = Math.max(0.2, p.width - 0.12);
      const lowCounter = height < 2;
      const bottom = lowCounter ? 0.18 : 1.17;
      const top = lowCounter ? height - 0.035 : Math.min(2.72, height - 0.18);
      const normal = new THREE.Vector3(Math.sin(p.rotationY), 0, Math.cos(p.rotationY));
      const edge = new THREE.Vector3(p.x, 0, p.z).addScaledVector(normal, p.depth / 2);
      const { light } = lights[index];
      light.position.copy(edge).addScaledVector(normal, lowCounter ? 1.5 : 2.1);
      light.position.y = lowCounter ? 3.2 : Math.max(4.1, height + 0.55);
      light.target.position.copy(edge).addScaledVector(normal, -0.32);
      light.target.position.y = lowCounter ? height * 0.7 : 1.48;
      const distance = light.position.distanceTo(light.target.position);
      // Fit the cone to this window, so neighboring counters retain their light.
      light.angle = Math.atan2(Math.max(0.58, width * 0.55), distance);
      light.distance = distance * 2.1;
      lights[index].intensity = distance * distance * 4.8;

      const front = new THREE.Group();
      front.position.set(p.x, 0, p.z);
      front.rotation.y = p.rotationY;
      const opening = glow(width, (top - bottom) * 1.2, false);
      opening.position.set(0, (top + bottom) / 2, p.depth / 2 + 0.23);
      front.add(opening);
      spatial.add(front);

      const counter = new THREE.Group();
      counter.position.set(p.x, 0, p.z);
      counter.rotation.y = p.rotationY;
      const depth = Math.min(1.4, p.depth * 0.85);
      const surface = glow(width, depth, true);
      surface.rotation.x = -Math.PI / 2;
      surface.position.set(0, lowCounter ? height + 0.025 : 1.26, p.depth / 2 - depth / 2 + 0.1);
      counter.add(surface);
      plan.add(counter);
    }
    tick(0, false);
  }

  plan.visible = false;
  return {
    group,
    select,
    tick,
    setMode(mode: 'plan' | '3d') {
      plan.visible = mode === 'plan';
      spatial.visible = mode === '3d';
    },
    dispose() {
      clear();
      texture.dispose();
      group.removeFromParent();
      group.clear();
    },
  };
}
