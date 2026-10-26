export type TenthWindow = {
  number: number;
  id: string;
  groupId: string;
  photo: number;
  title: string;
  x: number;
  z: number;
  width: number;
  rotationY: number;
  perpendicular?: boolean;
};
export const windows: TenthWindow[];
export const mainFaces: {
  photo: number;
  title: string;
  x: number;
  width: number;
  numbers: number[];
  perpendicular?: boolean;
}[];
export const columns: {
  id: string;
  x: number;
  z: number;
  width: number;
  depth: number;
  height?: number;
}[];
export const NORTH_FRONT_X: number;
export const KITCHEN_DEPTH: number;
