import { access, readFile } from 'node:fs/promises';
import { join } from 'node:path';

/** 只抢先下载校园首屏必需的一块几何数据；直达食堂时不占用模型带宽。 */
export function campusCorePreloadScript(base, file) {
  if (typeof file !== 'string' || !/^campus-core\.[a-f0-9]{16}\.json$/.test(file)) return undefined;
  const href = JSON.stringify(`${base}osm/runtime/${file}`).replace(/</g, '\\u003c');
  return `(()=>{const q=new URLSearchParams(location.search);if(q.has('venue')||q.has('floor')||q.get('basemap')==='osm')return;const l=document.createElement('link');l.rel='preload';l.as='fetch';l.crossOrigin='anonymous';l.fetchPriority='high';l.href=${href};document.head.appendChild(l)})()`;
}

export function campusCorePreload() {
  let publicDir = '';
  let base = '/';
  return {
    name: 'campus-core-preload',
    configResolved(config) {
      publicDir = config.publicDir;
      base = config.base;
    },
    async transformIndexHtml() {
      try {
        const folder = join(publicDir, 'osm/runtime');
        const manifest = JSON.parse(await readFile(join(folder, 'index.json'), 'utf8'));
        if (manifest.version !== 1) return;
        const children = campusCorePreloadScript(base, manifest.core?.file);
        if (!children) return;
        await access(join(folder, manifest.core.file));
        return [{ tag: 'script', children, injectTo: 'head-prepend' }];
      } catch {
        // 开发时生成文件尚未就绪仍可正常启动，既有加载器负责展示错误与重试。
      }
    },
  };
}
