import * as THREE from 'three';
import type { Stall } from '../domain';

/** Illuminate the selected service area without recoloring the batched model. */
export function createStallSelection(
  stalls: Stall[],
  facadeHeights: Readonly<Record<string, number>> = {},
  lighting?: { model: THREE.Object3D; scene: THREE.Scene; fillLights: THREE.Light[] },
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
  let focusAmount = 0;
  const sourceLights = new Map<THREE.Light, number>();
  const sourceEmissions = new Map<THREE.MeshStandardMaterial, number>();
  let environmentIntensity = lighting?.scene.environmentIntensity ?? 1;
  let normalPeak = 4.8;

  function attenuation(distance: number, decay: number, cutoff: number) {
    const falloff = cutoff > 0 ? Math.max(0, 1 - (distance / cutoff) ** 4) ** 2 : 1;
    return falloff / Math.max(distance ** decay, 0.01);
  }

  /** Compare illumination on counter surfaces, not raw lamp intensities:
   * a spotlight farther away needs more power to match a nearby serving lamp. */
  function measureNormalPeak() {
    const lamps: { position: THREE.Vector3; light: THREE.PointLight; intensity: number }[] = [];
    lighting?.model.updateWorldMatrix(true, true);
    for (const [light, intensity] of sourceLights)
      if (light instanceof THREE.PointLight && intensity > 0)
        lamps.push({ position: light.getWorldPosition(new THREE.Vector3()), light, intensity });
    let peak = 0;
    for (const stall of stalls) {
      const height = facadeHeights[stall.id] ?? 3.75;
      const counterY = height < 2 ? height : stall.id === 'v-south-f1-cart' ? 1.7 : 1.26;
      for (const p of [stall.position, ...(stall.serviceAreas ?? [])]) {
        const cosine = Math.cos(p.rotationY), sine = Math.sin(p.rotationY);
        for (const xFraction of [-0.4, -0.2, 0, 0.2, 0.4]) {
          for (const inset of [0.2, 0.6, 1]) {
            const x = p.width * xFraction, z = p.depth / 2 - Math.min(inset, p.depth * 0.8);
            const sample = new THREE.Vector3(p.x + x * cosine + z * sine, counterY, p.z - x * sine + z * cosine);
            let brightness = 0;
            for (const lamp of lamps) {
              const distance = Math.max(0.01, sample.distanceTo(lamp.position));
              const incidence = Math.max(0, (lamp.position.y - sample.y) / distance);
              brightness += lamp.intensity * incidence * attenuation(distance, lamp.light.decay, lamp.light.distance);
            }
            peak = Math.max(peak, brightness);
          }
        }
      }
    }
    // Compensate for the ambient fill removed by selection. No arbitrary 2x boost.
    const fill = [...sourceLights].reduce((sum, [light, intensity]) =>
      sum + (light instanceof THREE.DirectionalLight || light instanceof THREE.HemisphereLight ? intensity : 0), 0);
    normalPeak = (peak || 4.8) + (fill + environmentIntensity) * 0.38;
  }

  function captureLighting() {
    if (!lighting) return;
    sourceLights.clear();
    sourceEmissions.clear();
    environmentIntensity = lighting.scene.environmentIntensity;
    for (const light of lighting.fillLights) sourceLights.set(light, light.intensity);
    lighting.model.traverse((object) => {
      if (object instanceof THREE.Light) sourceLights.set(object, object.intensity);
      if (object instanceof THREE.Mesh) {
        const list = Array.isArray(object.material) ? object.material : [object.material];
        for (const material of list)
          if (material instanceof THREE.MeshStandardMaterial && material.emissiveIntensity > 0)
            sourceEmissions.set(material, material.emissiveIntensity);
      }
    });
    measureNormalPeak();
  }

  function applyLighting(amount: number) {
    for (const [light, original] of sourceLights) {
      // Turn off serving lamps; keep broad fill so unselected food and signs
      // remain readable. The independent selection spotlight stays on.
      const local = light instanceof THREE.PointLight || light instanceof THREE.SpotLight;
      light.intensity = original * (1 - amount * (local ? 1 : 0.38));
    }
    for (const [material, original] of sourceEmissions)
      material.emissiveIntensity = original * (1 - amount);
    if (lighting) lighting.scene.environmentIntensity = environmentIntensity * (1 - amount * 0.38);
  }

  captureLighting();

  // Keep the light count stable, including when the card is closed. Adding and
  // removing lights on every click would recompile all the model's materials.
  const lightCount = Math.max(1, ...stalls.map((stall) => 1 + (stall.serviceAreas?.length ?? 0)));
  const lights = Array.from({ length: lightCount }, () => {
    const light = new THREE.SpotLight('#fff0cf', 0);
    light.penumbra = 0.85;
    light.decay = 2;
    light.castShadow = false;
    group.add(light, light.target);
    return { light, intensity: 0, referenceGain: 0 };
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
      entry.referenceGain = 0;
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
    material.userData.strength = overhead ? 0.035 : 0.025;
    materials.push(material);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
    mesh.renderOrder = overhead ? 15 : 3;
    mesh.raycast = () => {};
    return mesh;
  }

  function tick(delta: number, reducedMotion: boolean) {
    const target = selected && byId.has(selected) ? 1 : 0;
    focusAmount = THREE.MathUtils.lerp(focusAmount, target, reducedMotion ? 1 : 1 - Math.exp(-delta * 12));
    if (Math.abs(focusAmount - target) < 0.001) focusAmount = target;
    applyLighting(focusAmount);
    elapsed = reducedMotion ? 1 : Math.min(1, elapsed + delta);
    const progress = Math.min(1, elapsed / 0.42);
    const reveal = progress * progress * (3 - 2 * progress);
    // One gentle arrival, then a steady spotlight rather than ongoing flashing.
    const strength = reveal;
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
      const incidence = Math.max(0.1, (light.position.y - light.target.position.y) / distance);
      lights[index].referenceGain = 1 / (incidence * attenuation(distance, light.decay, light.distance));
      lights[index].intensity = normalPeak * lights[index].referenceGain;

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
    withLightingUpdate(update: () => void) {
      // Mode/theme functions write their own lamp strengths. Restore first so
      // those functions never capture an already-dimmed value as the baseline.
      applyLighting(0);
      try {
        update();
      } finally {
        captureLighting();
        for (const entry of lights) entry.intensity = normalPeak * entry.referenceGain;
        applyLighting(focusAmount);
      }
    },
    dispose() {
      applyLighting(0);
      clear();
      texture.dispose();
      group.removeFromParent();
      group.clear();
    },
  };
}
