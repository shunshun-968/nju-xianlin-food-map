import type * as THREE from 'three';

export type ExteriorEntrance = {
  id: string;
  name: string;
  side: string;
  level: string;
  description: string;
  position: THREE.Vector3;
  camera: THREE.Vector3;
  target: THREE.Vector3;
  normal?: number[];
  access?: {
    kind: string;
    floorDelta: number;
    streetElevation: number;
    thresholdElevation: number;
    levelApproachLength: number;
  };
};

/** Geometry-only factory imported from the independently reviewed exterior study. */
export type ExteriorGeometryModel = {
  group: THREE.Group;
  entrances: ExteriorEntrance[];
  entryMeshes: THREE.Mesh[];
  layers: { roof: THREE.Group; context: THREE.Group; labels: THREE.Group };
  setSelected(id: string | null): void;
  dispose(): void;
};

/** 场景使用的外观模型：窗光和入口灯随界面主题一起切换。 */
export type ExteriorModel = ExteriorGeometryModel & {
  setNight(night: boolean): void;
};
