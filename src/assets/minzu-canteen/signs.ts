/** Original photographed lettering, cropped and perspective-corrected offline. */
export const MINZU_SIGN_TEXTURES = {
  lanzhou: new URL('./lanzhou-lamian.webp', import.meta.url).href,
  paidang: new URL('./meishi-paidang.webp', import.meta.url).href,
  minzu: new URL('./minzu-fengwei.webp', import.meta.url).href,
  bianchui: new URL('./bianchui-fengqing.webp', import.meta.url).href,
  studentSpecial: new URL('./student-special.webp', import.meta.url).href,
  breakfast: new URL('./breakfast.webp', import.meta.url).href,
} as const;

export const MINZU_SIGN_ASPECTS = {
  lanzhou: 2048 / 320,
  paidang: 2048 / 320,
  minzu: 2048 / 380,
  bianchui: 2048 / 260,
  studentSpecial: 1024 / 200,
  breakfast: 768 / 208,
} as const;
