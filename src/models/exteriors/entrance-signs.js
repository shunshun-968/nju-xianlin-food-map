import * as THREE from "three";

// Lettering and colour families follow the photographs. These are material
// studies, rather than photographs with their own lighting pasted onto walls.
const SONG = '"STZhongsong", "SimSun", "Songti SC", serif';
const KAI = '"KaiTi", "STKaiti", "Kaiti SC", serif';
const fourth = {
  text: "第四食堂",
  subtitle: "Dining Hall No.4",
  font: SONG,
  color: "#edf0e9",
  backing: "light-tile",
};
const fifth = {
  text: "第五食堂",
  subtitle: "Dining Hall No.5",
  font: SONG,
  color: "#f0f2eb",
  backing: "metal",
};

export const ENTRANCE_SIGNS = {
  fourthEast: { ...fourth, aspect: 3.25 },
  fourthSouth: { ...fourth, aspect: 3 },
  fourthNorth: { ...fourth, aspect: 8 / 3, backing: "gray-brick" },
  fifthEast: { ...fifth, aspect: 510 / 141 },
  fifthSouth: { ...fifth, aspect: 633 / 123 },
  sixthEast: {
    text: "第六食堂",
    font: KAI,
    color: "#d9c38f",
    backing: "dark-panel",
    aspect: 339 / 78,
  },
  verticalSixth: {
    text: "第六餐厅",
    font: KAI,
    color: "#d58caa",
    backing: "none",
    vertical: true,
    aspect: 206 / 888,
  },
  studentPanels: [..."学生餐厅"].map((text) => ({
    text,
    font: KAI,
    color: "#eff0e7",
    backing: "student-panel",
    aspect: 0.9,
  })),
};

/** Per-building cache; the model owns and disposes every returned texture. */
export function createSignFactory({ tiledBacking, registerTexture }) {
  const masks = new Map();

  function lettering(style) {
    const key = `${style.text}/${style.subtitle ?? ""}/${style.aspect}`;
    if (masks.has(key)) return masks.get(key);
    const canvas = document.createElement("canvas");
    canvas.width = style.vertical ? 512 : style.text.length === 1 ? 512 : 2048;
    canvas.height = Math.round(canvas.width / style.aspect);
    const c = canvas.getContext("2d");
    const w = canvas.width;
    const h = canvas.height;
    c.fillStyle = "#000000";
    c.fillRect(0, 0, w, h);
    c.fillStyle = "#ffffff";
    c.textAlign = "center";
    c.textBaseline = "middle";

    function spacedText(text, y, size, span, font = style.font) {
      c.font = `700 ${size}px ${font}`;
      const chars = [...text];
      chars.forEach((char, i) => {
        const x =
          chars.length === 1
            ? w / 2
            : (w - span) / 2 + (span * i) / (chars.length - 1);
        c.fillText(char, x, y);
      });
    }

    if (style.vertical) {
      c.font = `700 ${w * 0.84}px ${style.font}`;
      [...style.text].forEach((char, i) => {
        c.fillText(char, w / 2, (h * (i + 0.5)) / style.text.length);
      });
    } else if (style.subtitle) {
      const size = Math.min(h * 0.55, w * 0.2);
      spacedText(style.text, h * 0.37, size, w * 0.71);
      c.font = `600 ${h * 0.19}px Arial, sans-serif`;
      c.fillText(style.subtitle, w / 2, h * 0.8, w * 0.86);
    } else if (style.text.length === 1) {
      spacedText(style.text, h * 0.49, Math.min(w * 0.84, h * 0.81), 0);
    } else {
      spacedText(style.text, h * 0.49, Math.min(h * 0.8, w * 0.2), w * 0.72);
    }
    const texture = new THREE.CanvasTexture(canvas);
    // This is coverage data, not colour. A separate alpha mask prevents dark
    // fringes from transparent black pixels when distant lettering is minified.
    texture.colorSpace = THREE.NoColorSpace;
    texture.anisotropy = 8;
    registerTexture(texture);
    masks.set(key, texture);
    return texture;
  }

  return function createSign(style, width) {
    const sign = new THREE.Group();
    sign.name = `material-sign-${style.text}`;
    const height = width / style.aspect;
    const depth = style.backing === "student-panel" ? 0.085 : 0.12;
    const mesh = (geometry, material, z = 0) => {
      const part = new THREE.Mesh(geometry, material);
      part.position.z = z;
      part.receiveShadow = true;
      sign.add(part);
      return part;
    };
    const solid = (color, roughness = 0.6, metalness = 0.25) =>
      new THREE.MeshStandardMaterial({ color, roughness, metalness });

    if (style.backing.endsWith("tile") || style.backing === "gray-brick") {
      // Use the very same seam scale and wall material as the surrounding facade.
      tiledBacking(sign, width, height, depth, style.backing === "light-tile");
    } else if (style.backing !== "none") {
      const isDark = style.backing === "dark-panel";
      const isStudent = style.backing === "student-panel";
      mesh(
        new THREE.BoxGeometry(width, height, depth),
        solid(isDark ? "#35413d" : "#94a6a2", 0.48, 0.4),
        -depth / 2,
      ).castShadow = true;
      mesh(
        new THREE.BoxGeometry(width - 0.045, height - 0.045, 0.025),
        solid(
          isDark ? "#253b35" : isStudent ? "#aabebd" : "#a6b7b3",
          0.62,
          0.24,
        ),
        0.008,
      );
    }

    const alphaMap = lettering(style);
    // A short stack of alpha-cut letter faces gives edge thickness at oblique
    // angles. No photograph background, baked shadow, glow or unlit material.
    // alphaTest keeps the transparent margins out of the depth buffer.
    const side = new THREE.MeshStandardMaterial({
      color: style.backing === "dark-panel" ? "#8e805e" : "#74857e",
      alphaMap,
      alphaTest: 0.25,
      roughness: 0.53,
      metalness: 0.3,
    });
    const face = new THREE.MeshStandardMaterial({
      color: style.color,
      alphaMap,
      alphaTest: 0.25,
      roughness: style.backing === "none" ? 0.64 : 0.42,
      metalness: style.backing === "dark-panel" ? 0.38 : 0.25,
    });
    const shape = new THREE.PlaneGeometry(width, height);
    for (const z of [0.03, 0.043]) mesh(shape, side, z);
    const letterFace = mesh(shape, face, 0.057);
    letterFace.receiveShadow = true;
    return sign;
  };
}
