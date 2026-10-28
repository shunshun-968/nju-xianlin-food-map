/** B102 正常营业照明的统一配置，模型与选中聚光校准共同引用，避免日夜参数漂移。 */
export type YifuPointLightReference = Readonly<{
  position: readonly [number, number, number];
  intensity: number;
  distance: number;
  decay: number;
  color: string;
}>;

export const YIFU_FIXTURE_LIGHTS = [
  { position: [-1.75, 2.89, -0.9], dayIntensity: 1.3, nightIntensity: 5.2, distance: 6.4, decay: 2 },
  { position: [1.58, 2.89, -0.55], dayIntensity: 1.3, nightIntensity: 5.2, distance: 6.4, decay: 2 },
  { position: [0.45, 2.89, -2.62], dayIntensity: 1.3, nightIntensity: 5.2, distance: 6.4, decay: 2 },
] as const;

export const YIFU_FIXTURE_COLORS = { day: '#fff5df', night: '#ffbe65' } as const;

export const YIFU_INTERIOR_LIGHT = {
  position: [0.1, 2.76, -0.8],
  dayIntensity: 3,
  nightIntensity: 2,
  distance: 9,
  decay: 2,
  color: '#ffefca',
} as const;

export const YIFU_BROAD_LIGHTS = {
  hemisphere: { day: 2.05, night: 0.9 },
  key: { day: 2.3, night: 0.95 },
  fill: { day: 1.1, night: 0.32 },
  environmentIntensity: 0.28,
} as const;

export type YifuNightLightingReference = Readonly<{
  pointLights: readonly YifuPointLightReference[];
  broadIntensity: number;
  environmentIntensity: number;
}>;

export const yifuNightLightingReference: YifuNightLightingReference = {
  pointLights: [
    ...YIFU_FIXTURE_LIGHTS.map(light => ({
      position: light.position,
      intensity: light.nightIntensity,
      distance: light.distance,
      decay: light.decay,
      color: YIFU_FIXTURE_COLORS.night,
    })),
    {
      position: YIFU_INTERIOR_LIGHT.position,
      intensity: YIFU_INTERIOR_LIGHT.nightIntensity,
      distance: YIFU_INTERIOR_LIGHT.distance,
      decay: YIFU_INTERIOR_LIGHT.decay,
      color: YIFU_INTERIOR_LIGHT.color,
    },
  ],
  broadIntensity: YIFU_BROAD_LIGHTS.hemisphere.night + YIFU_BROAD_LIGHTS.key.night + YIFU_BROAD_LIGHTS.fill.night,
  environmentIntensity: YIFU_BROAD_LIGHTS.environmentIntensity,
};
