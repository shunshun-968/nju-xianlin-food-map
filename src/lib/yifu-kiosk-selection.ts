import * as THREE from 'three';
import type { Stall } from '../domain';
import { yifuNightLightingReference, type YifuNightLightingReference } from '../data/yifu-lighting';

/** 水平台面照度的相对标尺；不把颜色、粗糙度不同的物体像素当作同一测光表。 */
export type YifuSelectionCalibration = {
  referenceNightPeak: number;
  retainedBroadFill: number;
  spotUnitPeak: number;
  spotIntensity: number;
  achievedPeak: number;
  sampleCount: number;
};

function attenuation(distance: number, decay: number, cutoff: number) {
  const falloff = cutoff > 0 ? Math.max(0, 1 - (distance / cutoff) ** 4) ** 2 : 1;
  return falloff / Math.max(distance ** decay, 0.01);
}

function luminance(color: THREE.Color) {
  return color.r * 0.2126 + color.g * 0.7152 + color.b * 0.0722;
}

function tableSamples() {
  const samples: THREE.Vector3[] = [];
  // x/z 边界来自真实柜台、北展示架、东侧两张桌及北窗餐桌；按约12cm网格采样。
  for (const [x0, x1, z0, z1, y] of [
    [-2.2, -1.23, -2.25, 0.55, 1.26],
    [-1.42, 0.26, -2.91, -2.23, 1.12],
    [1.23, 2.13, -0.925, 0.525, 0.78],
    [1.23, 2.13, 0.925, 2.375, 0.78],
    [0.665, 2.615, -3.085, -2.515, 0.78],
  ]) {
    const nx = Math.ceil((x1 - x0) / 0.12), nz = Math.ceil((z1 - z0) / 0.12);
    for (let x = 0; x <= nx; x++) for (let z = 0; z <= nz; z++)
      samples.push(new THREE.Vector3(THREE.MathUtils.lerp(x0, x1, x / nx), y, THREE.MathUtils.lerp(z0, z1, z / nz)));
  }
  return samples;
}

/** B102 沿用食堂选中照明：关闭营业灯，保留 62% 环境补光，一束暖光照向售餐台。 */
export function createYifuKioskSelection(
  stall: Stall,
  lighting: { model: THREE.Object3D; scene: THREE.Scene; fillLights: THREE.Light[] },
  nightReference: YifuNightLightingReference = yifuNightLightingReference,
) {
  const group = new THREE.Group();
  group.name = 'yifu-service-selection';
  const spatial = new THREE.Group();
  spatial.name = 'yifu-selection-spatial';
  const plan = new THREE.Group();
  plan.name = 'yifu-selection-plan';
  plan.visible = false;
  group.add(spatial, plan);

  const source = new THREE.Vector3(-0.1, 4.5, 2);
  const focus = new THREE.Vector3(-1.5, 1.1, -0.8);
  const spotlight = new THREE.SpotLight('#ffd593', 0);
  spotlight.name = 'yifu-counter-focus-light';
  spotlight.position.copy(source);
  spotlight.target.position.copy(focus);
  spotlight.angle = 0.56;
  spotlight.penumbra = 0.65;
  spotlight.decay = 2;
  spotlight.distance = 11;
  spotlight.castShadow = false;
  group.add(spotlight, spotlight.target);

  // 只有一层轻微体积提示；轮廓与两端均渐隐，不遮挡柜台和陈设。
  const beamMaterial = new THREE.ShaderMaterial({
    uniforms: { opacity: { value: 0 }, tint: { value: new THREE.Color('#ffcf80') } },
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
        float ends = smoothstep(0.0, 0.18, vUv.y) * (1.0 - smoothstep(0.74, 1.0, vUv.y));
        gl_FragColor = vec4(tint, opacity * facing * ends);
      }
    `,
    side: THREE.DoubleSide,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
  const direction = focus.clone().sub(source);
  const beamGeometry = new THREE.CylinderGeometry(0.06, 2, direction.length(), 40, 12, true);
  const beam = new THREE.Mesh(beamGeometry, beamMaterial);
  beam.name = 'yifu-soft-service-beam';
  beam.position.copy(source).add(focus).multiplyScalar(0.5);
  beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), direction.normalize());
  beam.raycast = () => {};
  beam.renderOrder = 2;
  spatial.add(beam);

  // 用像素径向渐变形成光晕，无 Canvas/DOM 依赖，切换俯视时不会出现方形选框。
  const pixels = new Uint8Array(64 * 64 * 4);
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
    const radius = Math.hypot((x - 31.5) / 31.5, (y - 31.5) / 31.5);
    const i = (y * 64 + x) * 4;
    pixels[i] = pixels[i + 1] = pixels[i + 2] = 255;
    pixels[i + 3] = Math.round(255 * Math.pow(Math.max(0, 1 - radius * radius), 2));
  }
  const glowTexture = new THREE.DataTexture(pixels, 64, 64, THREE.RGBAFormat);
  glowTexture.minFilter = THREE.LinearFilter;
  glowTexture.magFilter = THREE.LinearFilter;
  glowTexture.needsUpdate = true;
  const glowMaterial = new THREE.MeshBasicMaterial({
    map: glowTexture,
    color: '#ffc86e',
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
  const glowGeometries: THREE.PlaneGeometry[] = [];
  for (const [x, y, z, width, depth] of [
    [-1.72, 1.285, -0.85, 1.6, 3.2],
    [-0.58, 1.16, -2.57, 1.8, 0.85],
  ]) {
    const geometry = new THREE.PlaneGeometry(width, depth);
    glowGeometries.push(geometry);
    const glow = new THREE.Mesh(geometry, glowMaterial);
    glow.name = 'yifu-service-plan-glow';
    glow.rotation.x = -Math.PI / 2;
    glow.position.set(x, y, z);
    glow.raycast = () => {};
    glow.renderOrder = 3;
    plan.add(glow);
  }

  let target = 0;
  let amount = 0;
  let startAmount = 0;
  let elapsed = 0;
  let peakIntensity = 0;
  const samples = tableSamples();
  let environmentIntensity = lighting.scene.environmentIntensity;
  const sourceLights = new Map<THREE.Light, number>();
  const sourceEmissions = new Map<THREE.MeshStandardMaterial, number>();
  const paintedBackground = new THREE.Color();
  const backgroundCopy = (background: THREE.Scene['background']) =>
    background instanceof THREE.Color ? background.clone() : background;
  let background = backgroundCopy(lighting.scene.background);
  let lastAppliedBackground = lighting.scene.background;
  let lastBackgroundColor = lighting.scene.background instanceof THREE.Color
    ? lighting.scene.background.clone() : null;
  let lastAppliedEnvironment = environmentIntensity;
  let calibratedVisibility = '';
  let disposed = false;

  function broadVisibility() {
    let signature = '';
    for (const light of sourceLights.keys())
      if (light instanceof THREE.DirectionalLight || light instanceof THREE.HemisphereLight || light instanceof THREE.AmbientLight)
        signature += light.visible ? '1' : '0';
    return signature;
  }

  function calibrateSpotlight() {
    calibratedVisibility = broadVisibility();
    const lamps = nightReference.pointLights.map(light => ({
      ...light,
      position: new THREE.Vector3(...light.position),
      brightness: luminance(new THREE.Color(light.color)),
    }));
    // 广域补光沿用其他食堂的 0.38 相对照度近似；距离灯采用 Three 的
    // inverse-power + cutoff 衰减、水平面余弦入射及线性色彩亮度。
    const nightBroadFill = (nightReference.broadIntensity + nightReference.environmentIntensity) * 0.38;
    const currentBroadFill = [...sourceLights].reduce((sum, [light, intensity]) => {
      const broad = light instanceof THREE.DirectionalLight || light instanceof THREE.HemisphereLight || light instanceof THREE.AmbientLight;
      return sum + (broad && light.visible ? intensity : 0);
    }, 0);
    const retainedBroadFill = (currentBroadFill + environmentIntensity) * 0.38 * 0.62;
    const axis = spotlight.target.position.clone().sub(spotlight.position).normalize();
    const outerCos = Math.cos(spotlight.angle);
    const innerCos = Math.cos(spotlight.angle * (1 - spotlight.penumbra));
    let referenceNightPeak = 0, spotUnitPeak = 0;
    for (const sample of samples) {
      let illumination = nightBroadFill;
      for (const lamp of lamps) {
        const distance = Math.max(0.01, sample.distanceTo(lamp.position));
        const incidence = Math.max(0, (lamp.position.y - sample.y) / distance);
        illumination += lamp.intensity * lamp.brightness * incidence * attenuation(distance, lamp.decay, lamp.distance);
      }
      referenceNightPeak = Math.max(referenceNightPeak, illumination);
      const fromLight = sample.clone().sub(spotlight.position);
      const distance = Math.max(0.01, fromLight.length());
      const angleCos = fromLight.multiplyScalar(1 / distance).dot(axis);
      const cone = THREE.MathUtils.smoothstep(angleCos, outerCos, innerCos);
      const incidence = Math.max(0, (spotlight.position.y - sample.y) / distance);
      spotUnitPeak = Math.max(spotUnitPeak, cone * incidence * luminance(spotlight.color) * attenuation(distance, spotlight.decay, spotlight.distance));
    }
    // 选中时保留的环境补光也计入总照度，所以只补齐到“正常夜间最亮处”。
    // 白天和夜晚引用相同的 referenceNightPeak，而非复用同一灯具 intensity。
    peakIntensity = spotUnitPeak > 0 ? Math.max(0, referenceNightPeak - retainedBroadFill) / spotUnitPeak : 0;
    const calibration: YifuSelectionCalibration = {
      referenceNightPeak, retainedBroadFill, spotUnitPeak, spotIntensity: peakIntensity,
      achievedPeak: retainedBroadFill + peakIntensity * spotUnitPeak,
      sampleCount: samples.length,
    };
    group.userData.lightingCalibration = calibration;
    spotlight.userData.lightingCalibration = calibration;
  }

  function captureLighting() {
    sourceLights.clear();
    sourceEmissions.clear();
    const remember = (light: THREE.Light) => {
      if (light !== spotlight) sourceLights.set(light, light.intensity);
    };
    lighting.fillLights.forEach(remember);
    lighting.model.traverse((object) => {
      if (object instanceof THREE.Light) remember(object);
      if (object instanceof THREE.Mesh) {
        for (const material of Array.isArray(object.material) ? object.material : [object.material])
          if (material instanceof THREE.MeshStandardMaterial)
            sourceEmissions.set(material, material.emissiveIntensity);
      }
    });
    environmentIntensity = lighting.scene.environmentIntensity;
    background = backgroundCopy(lighting.scene.background);
    calibrateSpotlight();
  }

  function applyLighting(strength: number) {
    const localRetain = 1 - strength;
    const broadRetain = 1 - strength * 0.38;
    for (const [light, original] of sourceLights) {
      const local = light instanceof THREE.PointLight || light instanceof THREE.SpotLight;
      light.intensity = original * (local ? localRetain : broadRetain);
    }
    for (const [material, original] of sourceEmissions) material.emissiveIntensity = original * localRetain;
    lighting.scene.environmentIntensity = environmentIntensity * broadRetain;
    lastAppliedEnvironment = lighting.scene.environmentIntensity;
    if (background instanceof THREE.Color) {
      // 在线性色彩中降低 38%，白天仍保留浅色背景与清晰的房间轮廓。
      paintedBackground.copy(background).multiplyScalar(broadRetain);
      lighting.scene.background = paintedBackground;
      (lastBackgroundColor ??= new THREE.Color()).copy(paintedBackground);
    } else {
      // 当前网站采用纯色背景；未来纹理背景保留原始引用。
      lighting.scene.background = background;
      if (lighting.scene.background instanceof THREE.Color)
        (lastBackgroundColor ??= new THREE.Color()).copy(lighting.scene.background);
      else lastBackgroundColor = null;
    }
    lastAppliedBackground = lighting.scene.background;
  }

  function renderStrength() {
    applyLighting(amount);
    spotlight.intensity = peakIntensity * amount;
    beamMaterial.uniforms.opacity.value = amount * 0.055;
    glowMaterial.opacity = amount * 0.15;
    beam.visible = amount > 0;
  }

  captureLighting();
  renderStrength();

  return {
    group,
    select(id: string | null, replay = false) {
      if (disposed) return;
      const next = id === stall.id ? 1 : 0;
      if (next === target) {
        // 对已选中的唯一窗口重复点击不闪烁，也不让柜台忽暗忽亮。
        if (replay && next && amount === 0) elapsed = 0;
        return;
      }
      target = next;
      startAmount = amount;
      elapsed = 0;
    },
    tick(delta: number, reducedMotion: boolean) {
      if (disposed) return;
      // MapScene 在挂载模型后关闭通用补光，首次绘制需按最终可见灯具重校准。
      if (broadVisibility() !== calibratedVisibility) calibrateSpotlight();
      elapsed = reducedMotion ? 0.35 : Math.min(0.35, elapsed + Math.max(0, delta));
      const progress = elapsed / 0.35;
      const smooth = progress * progress * (3 - 2 * progress);
      amount = THREE.MathUtils.lerp(startAmount, target, smooth);
      renderStrength();
    },
    setMode(mode: 'plan' | '3d') {
      plan.visible = mode === 'plan';
      spatial.visible = mode === '3d';
    },
    withLightingUpdate(update: () => void) {
      if (disposed) return;
      // MapScene 会先写入新主题背景再调用此接口。保留外部的新值，不能让
      // applyLighting(0) 把它覆盖成上个主题；同一 Color 原地改色也可识别。
      const currentBackground = lighting.scene.background;
      const changedBackground = currentBackground !== lastAppliedBackground ||
        (currentBackground instanceof THREE.Color && lastBackgroundColor !== null &&
          !currentBackground.equals(lastBackgroundColor));
      const incomingBackground = changedBackground ? backgroundCopy(currentBackground) : null;
      const incomingEnvironment = lighting.scene.environmentIntensity !== lastAppliedEnvironment
        ? lighting.scene.environmentIntensity : null;
      applyLighting(0);
      if (changedBackground) lighting.scene.background = incomingBackground;
      if (incomingEnvironment !== null) lighting.scene.environmentIntensity = incomingEnvironment;
      try { update(); }
      finally {
        captureLighting();
        renderStrength();
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      applyLighting(0);
      spotlight.intensity = 0;
      spotlight.dispose();
      beamGeometry.dispose();
      beamMaterial.dispose();
      glowGeometries.forEach((geometry) => geometry.dispose());
      glowMaterial.dispose();
      glowTexture.dispose();
      group.removeFromParent();
      group.clear();
    },
  };
}
