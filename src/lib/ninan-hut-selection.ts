import * as THREE from 'three';
import type { Stall } from '../domain';

export type NinanSelectionCalibration = {
  normalPeak: number;
  selectedPeak: number;
  spotIntensity: number;
  sampleCount: number;
  maxRoofGain: number;
};

const broadRetention = 0.62;
const localRetention = 0.2;

function visible(object: THREE.Object3D): boolean {
  for (let node: THREE.Object3D | null = object; node; node = node.parent)
    if (!node.visible) return false;
  return true;
}

function luminance(color: THREE.Color) {
  return color.r * 0.2126 + color.g * 0.7152 + color.b * 0.0722;
}

function attenuation(distance: number, decay: number, cutoff: number) {
  const falloff = cutoff > 0 ? Math.max(0, 1 - (distance / cutoff) ** 4) ** 2 : 1;
  return falloff / Math.max(distance ** decay, 0.01);
}

function surfaceSamples() {
  const samples: { position: THREE.Vector3; normal: THREE.Vector3 }[] = [];
  // 只以整座小屋最容易过曝的浅色屋顶和白棚作为宽光标尺。窗口下方、
  // 鲜食柜内部的高照度属于局部灯光，不能推广到整屋白色表面。
  for (let x = -1.35; x <= 2.35; x += 0.2)
    for (let z = -5.1; z <= 5.1; z += 0.2)
      samples.push({
        position: new THREE.Vector3(x, 3.8 + (x - 0.5) * Math.sin(0.045), z),
        normal: new THREE.Vector3(-Math.sin(0.045), Math.cos(0.045), 0),
      });
  const tentSlope = 0.66 / 1.4;
  for (let x = 2.55; x <= 6.25; x += 0.2)
    for (let z = 5; z <= 7.8; z += 0.2) {
      const offset = z - 6.4;
      samples.push({
        position: new THREE.Vector3(x, 3.46 - Math.abs(offset) * tentSlope, z),
        normal: new THREE.Vector3(0, 1, Math.sign(offset) * tentSlope).normalize(),
      });
    }
  return samples;
}

/** 小屋整体选中：白天沿用柔光，夜晚用清晰的大光束照亮建筑及白棚。 */
export function createNinanHutSelection(
  stall: Stall,
  lighting: { model: THREE.Object3D; scene: THREE.Scene; fillLights: THREE.Light[] },
) {
  return createWideVenueSelection(stall, lighting, {
    name: 'ninan-hut',
    source: [6, 17, 9],
    focus: [1.8, 1.3, 1.3],
    radius: 9,
    samples: surfaceSamples(),
  });
}

/** 共用已确认的宽暖光动画，按场所尺寸设置光源、落点与承光面。 */
export function createWideVenueSelection(
  stall: Stall,
  lighting: { model: THREE.Object3D; scene: THREE.Scene; fillLights: THREE.Light[] },
  configuration: {
    name: string;
    source: [number, number, number];
    focus: [number, number, number];
    radius: number;
    samples: { position: THREE.Vector3; normal: THREE.Vector3 }[];
  },
) {
  const group = new THREE.Group();
  group.name = `${configuration.name}-selection`;
  const spotlight = new THREE.SpotLight('#ffe4ad', 0);
  spotlight.name = `${configuration.name}-focus-light`;
  spotlight.position.set(...configuration.source);
  spotlight.target.position.set(...configuration.focus);
  spotlight.angle = 0.65;
  spotlight.penumbra = 0.45;
  spotlight.distance = 40;
  spotlight.decay = 2;
  spotlight.castShadow = false;
  group.add(spotlight, spotlight.target);

  const beamMaterial = new THREE.ShaderMaterial({
    uniforms: { opacity: { value: 0 }, tint: { value: new THREE.Color('#ffdf9c') } },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vView;
      void main() {
        vUv = uv;
        vec4 p = modelViewMatrix * vec4(position, 1.0);
        vNormal = normalize(normalMatrix * normal);
        vView = -p.xyz;
        gl_Position = projectionMatrix * p;
      }
    `,
    fragmentShader: `
      uniform float opacity;
      uniform vec3 tint;
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vView;
      void main() {
        float facing = pow(abs(dot(normalize(vNormal), normalize(vView))), 1.4);
        float ends = smoothstep(0.0, 0.25, vUv.y) * (1.0 - smoothstep(0.6, 1.0, vUv.y));
        gl_FragColor = vec4(tint, opacity * facing * ends);
      }
    `,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
  const direction = spotlight.target.position.clone().sub(spotlight.position);
  const beamGeometry = new THREE.CylinderGeometry(
    0.08,
    configuration.radius,
    direction.length(),
    48,
    12,
    true,
  );
  const beam = new THREE.Mesh(beamGeometry, beamMaterial);
  beam.name = `${configuration.name}-soft-focus-beam`;
  beam.position.copy(spotlight.position).add(spotlight.target.position).multiplyScalar(0.5);
  beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), direction.normalize());
  beam.raycast = () => {};
  beam.renderOrder = 2;
  group.add(beam);

  const sourceLights = new Map<THREE.Light, number>();
  const sourceEmissions = new Map<THREE.MeshStandardMaterial, number>();
  const samples = configuration.samples;
  let environment = lighting.scene.environmentIntensity;
  let lastEnvironment = environment;
  let peakIntensity = 0;
  let night = false;
  let visibility = '';
  let target = 0,
    amount = 0,
    start = 0,
    elapsed = 0;
  const replayDuration = 0.45;
  let replayElapsed = replayDuration;
  let mode: 'plan' | '3d' = '3d';
  let disposed = false;

  function visibilitySignature() {
    return [...sourceLights.keys()].map((light) => (visible(light) ? '1' : '0')).join('');
  }

  function calibrate() {
    night = lighting.model.userData.night === true;
    visibility = visibilitySignature();
    lighting.model.updateWorldMatrix(true, true);
    const lamps = [...sourceLights].filter(([light]) => visible(light));
    const directional = lamps.flatMap(([light, intensity]) =>
      light instanceof THREE.DirectionalLight
        ? [
            {
              intensity: intensity * luminance(light.color),
              direction: light
                .getWorldPosition(new THREE.Vector3())
                .sub(light.target.getWorldPosition(new THREE.Vector3()))
                .normalize(),
            },
          ]
        : [],
    );
    const hemispheres = lamps.flatMap(([light, intensity]) =>
      light instanceof THREE.HemisphereLight
        ? [
            {
              intensity,
              sky: luminance(light.color),
              ground: luminance(light.groundColor),
              direction: light.getWorldPosition(new THREE.Vector3()).normalize(),
            },
          ]
        : [],
    );
    const ambient = lamps.reduce(
      (sum, [light, intensity]) =>
        sum + (light instanceof THREE.AmbientLight ? intensity * luminance(light.color) : 0),
      0,
    );
    const local = lamps.flatMap(([light, intensity]) =>
      light instanceof THREE.PointLight
        ? [
            {
              light,
              intensity: intensity * luminance(light.color),
              position: light.getWorldPosition(new THREE.Vector3()),
            },
          ]
        : [],
    );
    const axis = spotlight.target.position.clone().sub(spotlight.position).normalize();
    const outer = Math.cos(spotlight.angle),
      inner = Math.cos(spotlight.angle * (1 - spotlight.penumbra));
    const readings = samples.map(({ position, normal }) => {
      // Directional 与 Hemisphere 按各屋面法线计算，不再用统一 0.38 系数低估
      // 正对屋顶的日/月光；环境贴图保留原有的近似，且选中前后使用同一标尺。
      let broad = environment * 0.38 + ambient;
      for (const lamp of directional)
        broad += lamp.intensity * Math.max(0, lamp.direction.dot(normal));
      for (const lamp of hemispheres)
        broad +=
          lamp.intensity *
          THREE.MathUtils.lerp(lamp.ground, lamp.sky, lamp.direction.dot(normal) * 0.5 + 0.5);
      let localLight = 0;
      for (const lamp of local) {
        const toLight = lamp.position.clone().sub(position);
        const distance = Math.max(0.01, toLight.length());
        localLight +=
          lamp.intensity *
          Math.max(0, toLight.multiplyScalar(1 / distance).dot(normal)) *
          attenuation(distance, lamp.light.decay, lamp.light.distance);
      }
      const toSpot = spotlight.position.clone().sub(position);
      const distance = Math.max(0.01, toSpot.length());
      toSpot.multiplyScalar(1 / distance);
      const cone = THREE.MathUtils.smoothstep(-toSpot.dot(axis), outer, inner);
      return {
        normal: broad + localLight,
        retained: broad * broadRetention + localLight * (night ? 0.55 : localRetention),
        unit:
          cone *
          Math.max(0, toSpot.dot(normal)) *
          luminance(spotlight.color) *
          attenuation(distance, spotlight.decay, spotlight.distance),
      };
    });
    const normalPeak = Math.max(...readings.map((reading) => reading.normal));
    // 夜间明确提亮屋面，但仍逐点限制增益，避免把柜内灯的峰值铺满白屋顶。
    // 白天保留原来的照度；可见光束独立加强，不靠无限提高聚光灯功率显形。
    const roofGain = night ? 1.6 : 1;
    peakIntensity = Math.min(
      ...readings
        .filter((reading) => reading.unit > 0)
        .map((reading) => Math.max(0, reading.normal * roofGain - reading.retained) / reading.unit),
    );
    if (!Number.isFinite(peakIntensity)) peakIntensity = 0;
    const calibration: NinanSelectionCalibration = {
      normalPeak,
      selectedPeak: Math.max(
        ...readings.map((reading) => reading.retained + peakIntensity * reading.unit),
      ),
      spotIntensity: peakIntensity,
      sampleCount: samples.length,
      maxRoofGain: Math.max(
        ...readings.map((reading) =>
          reading.normal > 0
            ? (reading.retained + peakIntensity * reading.unit) / reading.normal
            : 0,
        ),
      ),
    };
    group.userData.lightingCalibration = calibration;
  }

  function capture() {
    sourceLights.clear();
    sourceEmissions.clear();
    for (const light of lighting.fillLights) sourceLights.set(light, light.intensity);
    lighting.model.traverse((object) => {
      if (object instanceof THREE.Light && object !== spotlight)
        sourceLights.set(object, object.intensity);
      if (object instanceof THREE.Mesh)
        for (const material of Array.isArray(object.material) ? object.material : [object.material])
          if (material instanceof THREE.MeshStandardMaterial)
            sourceEmissions.set(material, material.emissiveIntensity);
    });
    environment = lighting.scene.environmentIntensity;
    calibrate();
  }

  function apply(strength: number) {
    for (const [light, intensity] of sourceLights) {
      const local = light instanceof THREE.PointLight || light instanceof THREE.SpotLight;
      light.intensity =
        intensity *
        (1 - strength * (1 - (local ? (night ? 0.55 : localRetention) : broadRetention)));
    }
    // 仍保留少量室内暖灯，让夜间点击后玻璃内的灯光不会突然熄灭。
    for (const [material, intensity] of sourceEmissions)
      material.emissiveIntensity =
        intensity * (1 - strength * (1 - (night ? 0.55 : localRetention)));
    lighting.scene.environmentIntensity = environment * (1 - strength * (1 - broadRetention));
    lastEnvironment = lighting.scene.environmentIntensity;
  }

  function render() {
    // 重复点击只做一次轻微收拢再恢复；不叠加更亮的闪光，也不突然熄灯。
    const pulse = 1 - 0.28 * Math.sin((Math.PI * replayElapsed) / replayDuration) ** 2;
    const strength = amount * pulse;
    apply(strength);
    spotlight.intensity = peakIntensity * strength;
    beamMaterial.uniforms.opacity.value = strength * (night ? 0.24 : 0.025);
    beam.scale.set(night ? 1.15 : 1, 1, night ? 1.15 : 1);
    beam.visible = strength > 0 && mode === '3d';
  }

  capture();
  render();

  return {
    group,
    select(id: string | null, replay = false) {
      if (disposed) return;
      const next = id === stall.id ? 1 : 0;
      if (next === target) {
        if (replay && next && amount === 1) replayElapsed = 0;
        return;
      }
      target = next;
      start = amount;
      elapsed = 0;
      replayElapsed = replayDuration;
    },
    tick(delta: number, reducedMotion: boolean) {
      if (disposed) return;
      if (visibilitySignature() !== visibility) calibrate();
      elapsed = reducedMotion ? 0.35 : Math.min(0.35, elapsed + Math.max(0, delta));
      const progress = elapsed / 0.35;
      amount = THREE.MathUtils.lerp(start, target, progress * progress * (3 - 2 * progress));
      replayElapsed = reducedMotion
        ? replayDuration
        : Math.min(replayDuration, replayElapsed + Math.max(0, delta));
      render();
    },
    setMode(nextMode: 'plan' | '3d') {
      mode = nextMode;
      beam.visible = amount > 0 && mode === '3d';
    },
    withLightingUpdate(update: () => void) {
      if (disposed) return;
      const incomingEnvironment =
        lighting.scene.environmentIntensity !== lastEnvironment
          ? lighting.scene.environmentIntensity
          : null;
      apply(0);
      if (incomingEnvironment !== null) lighting.scene.environmentIntensity = incomingEnvironment;
      try {
        update();
      } finally {
        capture();
        render();
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      apply(0);
      spotlight.intensity = 0;
      spotlight.dispose();
      beamGeometry.dispose();
      beamMaterial.dispose();
      group.removeFromParent();
      group.clear();
    },
  };
}
