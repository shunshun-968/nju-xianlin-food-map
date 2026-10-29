import type { IndoorCanteenSpec } from '../data/indoor-canteens';
import type { FourthCanteenModel } from '../components/FourthFifthCanteenModel';

type ModelCreator = (spec: IndoorCanteenSpec) => FourthCanteenModel;
type ModelLoaders = Record<IndoorCanteenSpec['style'], () => Promise<ModelCreator>>;

/** 只缓存模块及图片准备任务，不缓存可变模型或 GPU 资源。失败的准备任务允许重试。 */
export function createIndoorModelLoader(loaders: ModelLoaders) {
  const pending = new Map<IndoorCanteenSpec['style'], Promise<ModelCreator>>();
  return async (spec: IndoorCanteenSpec): Promise<() => FourthCanteenModel> => {
    let preparation = pending.get(spec.style);
    if (!preparation) {
      preparation = Promise.resolve()
        .then(loaders[spec.style])
        .catch((error: unknown) => {
          pending.delete(spec.style);
          throw error;
        });
      pending.set(spec.style, preparation);
    }
    const create = await preparation;
    // 取消导航时可以直接丢弃工厂；没有提前创建几何体或需要释放的 GPU 对象。
    return () => create(spec);
  };
}

const loaders: ModelLoaders = {
  fourth: async () => {
    const [model] = await Promise.all([
      import('../components/FourthFifthCanteenModel'),
      import('./fourth-signage-textures').then((assets) => assets.prepareFourthSignageAssets()),
    ]);
    return model.createFourthFifthCanteenModel;
  },
  fifth: async () =>
    (await import('../components/FourthFifthCanteenModel')).createFourthFifthCanteenModel,
  sixth: async () => (await import('../components/SixthCanteenModel')).createSixthCanteenModel,
  eighth: async () => (await import('../components/EighthCanteenModel')).createEighthCanteenModel,
  minzu: async () => {
    const model = await import('../components/MinzuCanteenModel');
    // 这些照片原本渐进显示，提前请求即可，不新增“等完图片才展示模型”的门槛。
    void model.prepareMinzuCanteenAssets().catch(() => {});
    return model.createMinzuCanteenModel;
  },
  ninth: async () => {
    const [model, assets] = await Promise.all([
      import('../components/NinthCanteenModel'),
      import('../components/ninth-canteen-freezers'),
    ]);
    void assets.prepareNinthFreezerAssets().catch(() => {});
    return model.createNinthCanteenModel;
  },
  tenth: async () => {
    const model = await import('../components/TenthCanteenModel');
    await model.prepareTenthCanteenModel();
    return model.createTenthCanteenModel;
  },
  eleventh: async () => {
    const [model, assets] = await Promise.all([
      import('../components/EleventhCanteenModel'),
      import('../components/eleventh-canteen-fixtures'),
    ]);
    void assets.prepareEleventhFixtureAssets().catch(() => {});
    return model.createEleventhCanteenModel;
  },
  twelfth: async () =>
    (await import('../components/TwelfthCanteenModel')).createTwelfthCanteenModel,
  faculty: async () => {
    const [model, assets] = await Promise.all([
      import('../components/FacultyCanteenModel'),
      import('../components/faculty-canteen-signage'),
    ]);
    void assets.prepareFacultySignageAssets().catch(() => {});
    return model.createFacultyCanteenModel;
  },
};

/** 网页统一入口：第四／第五共用实现，其余食堂各自按需下载。 */
export const prepareIndoorModel = createIndoorModelLoader(loaders);
