import type { View } from '../domain';

export type ModelNorth = Readonly<{ x: number; z: number }>;
const northZ: ModelNorth = { x: 0, z: -1 };
const right: ModelNorth = { x: 1, z: 0 };
const left: ModelNorth = { x: -1, z: 0 };

/** World coordinates after each model's root transform, not camera/screen directions. */
export const exteriorNorth: Readonly<Record<string, ModelNorth>> = {
  'v-456': northZ,
  'v-10': northZ,
  'v-891': northZ,
  'v-1112': northZ,
};
export const indoorNorth: Readonly<Record<string, ModelNorth>> = {
  // Fourth reference says south points left; user confirmed fifth/sixth rightward north on 2026-10-26.
  'v-456-f1': right,
  'v-456-f2': right,
  'v-456-f3': right,
  'v-891-f1': northZ,
  'v-891-f2': northZ,
  'v-891-f3': northZ,
  // Tenth layout and the faculty sketch put north on the left of their default plan.
  'v-10-f1': left,
  'v-10-f2': left,
  'v-1112-f1': right,
  'v-1112-f2': right,
  // User confirmed the cart's service front (+Z) faces south on 2026-10-26.
  'v-south-f1': northZ,
};

export function getModelNorth(view: Exclude<View, { level: 'campus' }>): ModelNorth | undefined {
  // The cart has the same model on its building and floor routes.
  if (view.venueId === 'v-south') return northZ;
  return view.level === 'floor' ? indoorNorth[view.floorId] : exteriorNorth[view.venueId];
}
