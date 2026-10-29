import type { ExteriorGeometryModel } from '../models/exteriors/types';

type ExteriorSpec = {
  camera: [number, number, number];
  target: [number, number, number];
  range: number;
  halfWidth: number;
  floors: Readonly<Record<string, string>>;
  load: () => Promise<{ createBuilding(): ExteriorGeometryModel }>;
};

// These are navigation IDs in the current catalog, not physical storey numbers.
// Several exterior doors can enter the same dining space, at its actual elevation.
export const exteriorBuildings: Readonly<Record<string, ExteriorSpec>> = {
  'v-456': {
    camera: [89, 63, 99],
    target: [3, 6, 0],
    range: 43,
    halfWidth: 44,
    floors: {
      'fourth-east': 'v-456-f1',
      'fourth-south': 'v-456-f1',
      'fourth-north': 'v-456-f1',
      'fifth-east-south': 'v-456-f2',
      'fifth-east-north': 'v-456-f2',
      'fifth-south': 'v-456-f2',
      'sixth-east': 'v-456-f3',
    },
    load: () => import('../models/exteriors/fourth-fifth-sixth.js'),
  },
  'v-10': {
    camera: [-94, 62, -96],
    target: [0, 5, 0],
    range: 43,
    halfWidth: 47,
    floors: {
      'tenth-south': 'v-10-f1',
      'tenth-west': 'v-10-f1',
      'tenth-north': 'v-10-f1',
      'faculty-north': 'v-10-f2',
    },
    load: () => import('../models/exteriors/tenth-building.js'),
  },
  'v-891': {
    camera: [-90, 60, 112],
    target: [0, 5, 0],
    range: 44,
    halfWidth: 47,
    floors: {
      'minzu-south': 'v-891-f1',
      'minzu-west': 'v-891-f1',
      'eighth-south': 'v-891-f2',
      'eighth-east': 'v-891-f2',
      'ninth-south': 'v-891-f3',
    },
    load: () => import('../models/exteriors/minzu89-building.js'),
  },
  'v-1112': {
    camera: [100, 68, -112],
    target: [3, 7, 0],
    range: 48,
    halfWidth: 54,
    floors: {
      'eleventh-north': 'v-1112-f1',
      'eleventh-east': 'v-1112-f1',
      'eleventh-south': 'v-1112-f1',
      'twelfth-north': 'v-1112-f2',
      'twelfth-east': 'v-1112-f2',
    },
    load: () => import('../models/exteriors/eleven-twelve-building.js'),
  },
};
