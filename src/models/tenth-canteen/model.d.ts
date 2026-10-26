import type { Group, Mesh } from 'three';
export function createTenthModel(): {
  group: Group;
  planTargets: Mesh[];
  spatialTargets: Mesh[];
  setMode(mode: 'plan' | '3d'): void;
  tick(time: number): void;
};
