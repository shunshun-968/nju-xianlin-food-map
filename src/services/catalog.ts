import { catalog } from '../data/catalog';
import { validateCatalog, type Catalog } from '../domain';
export interface CatalogRepository { load(signal?: AbortSignal): Promise<Catalog> }
export const catalogRepository: CatalogRepository = {
  async load(signal) {
    if ((import.meta.env.VITE_DATA_SOURCE || 'mock') === 'mock') return catalog;
    const url = import.meta.env.VITE_API_URL;
    if (!url) throw new Error('请配置 VITE_API_URL');
    const response = await fetch(`${url.replace(/\/$/, '')}/api/catalog`, { signal });
    if (!response.ok) throw new Error(`数据服务暂不可用 (${response.status})`);
    const data = await response.json() as Catalog;
    const errors = validateCatalog(data);
    if (errors.length) throw new Error('数据校验失败：' + errors.join('；'));
    return data;
  },
};
