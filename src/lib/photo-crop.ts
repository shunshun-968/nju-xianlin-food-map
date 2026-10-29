export type PhotoCrop = {
  source: readonly [width: number, height: number];
  rectangle: readonly [left: number, top: number, width: number, height: number];
};

// 裁切只移除模型从未取样的照片外围，原始像素分辨率不变。
export const yifuBoardCrop: PhotoCrop = {
  source: [3072, 4096],
  rectangle: [0, 224, 3072, 3656],
};
export const ninanPostersCrop: PhotoCrop = {
  source: [1600, 1200],
  rectangle: [1180, 465, 340, 342],
};

/** 输入照片左上角为原点的归一化取样位置；透视计算后再转换，保留原取景。 */
export function croppedPhotoPoint(x: number, y: number, crop: PhotoCrop): [number, number] {
  const [left, top, width, height] = crop.rectangle;
  return [(x * crop.source[0] - left) / width, (y * crop.source[1] - top) / height];
}
