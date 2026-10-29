import { access, readFile } from 'node:fs/promises';
import { join } from 'node:path';

/** 只抢先下载校园首屏必需的一块几何数据；直达食堂时不占用模型带宽。 */
export function campusCorePreloadScript(base, file) {
  if (typeof file !== 'string' || !/^campus-core\.[a-f0-9]{16}\.json$/.test(file)) return undefined;
  const href = JSON.stringify(`${base}osm/runtime/${file}`).replace(/</g, '\\u003c');
  return `(()=>{const q=new URLSearchParams(location.search);if(q.has('venue')||q.has('floor')||q.get('basemap')==='osm')return;const l=document.createElement('link');l.rel='preload';l.as='fetch';l.crossOrigin='anonymous';l.fetchPriority='high';l.href=${href};document.head.appendChild(l)})()`;
}

/** Discover the seven small sprites in HTML, before app evaluation and SVG construction. */
export function campusArtworkPreloadScript(base, files) {
  const themes = { day: [], night: [] };
  for (const file of files) {
    const match = /^assets\/v-(?:456|891|10|1112|south|yifu|hut)-(day|night)-[\w-]+\.webp$/.exec(
      file,
    );
    if (match) themes[match[1]].push(`${base}${file}`);
  }
  if (!themes.day.length && !themes.night.length) return undefined;
  const paths = JSON.stringify(themes).replace(/</g, '\\u003c');
  return `(()=>{const q=new URLSearchParams(location.search);if(q.has('venue')||q.has('floor')||q.get('basemap')==='osm')return;let t='day';try{if(localStorage.getItem('foodmap:interface-theme')==='night')t='night'}catch{}for(const href of ${paths}[t]){const l=document.createElement('link');l.rel='preload';l.as='image';l.crossOrigin='anonymous';l.fetchPriority='high';l.href=href;document.head.appendChild(l)}})()`;
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
    async transformIndexHtml(_html, context) {
      try {
        const folder = join(publicDir, 'osm/runtime');
        const manifest = JSON.parse(await readFile(join(folder, 'index.json'), 'utf8'));
        if (manifest.version !== 1) return;
        const children = campusCorePreloadScript(base, manifest.core?.file);
        if (!children) return;
        await access(join(folder, manifest.core.file));
        const artwork = campusArtworkPreloadScript(base, Object.keys(context?.bundle ?? {}));
        return [
          { tag: 'script', children, injectTo: 'head-prepend' },
          ...(artwork ? [{ tag: 'script', children: artwork, injectTo: 'head' }] : []),
          // 与部署页面一起交付同版本目录，首开无需等待另一趟目录请求。
          // 放在 head 末尾，确保 charset 仍在文档最前面的 1024 字节内。
          {
            tag: 'script',
            attrs: { id: 'campus-basemap-manifest', type: 'application/json' },
            children: JSON.stringify(manifest).replace(/</g, '\\u003c'),
            injectTo: 'head',
          },
        ];
      } catch {
        // 开发时生成文件尚未就绪仍可正常启动，既有加载器负责展示错误与重试。
      }
    },
  };
}
