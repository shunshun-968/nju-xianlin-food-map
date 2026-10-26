import * as THREE from 'three';
import type { ExteriorModel } from '../models/exteriors/types';

const badges: Record<string, string> = {
  第四食堂: '04',
  第五食堂: '05',
  第六食堂: '06',
  民族食堂: '民',
  第八食堂: '08',
  第九食堂: '09',
  第十食堂: '10',
  教工餐厅: '教',
  第十一食堂: '11',
  第十二食堂: '12',
};

/** DOM buttons follow world-space doors without rerendering React on each frame. */
export function createExteriorEntranceMarkers(
  host: HTMLElement,
  model: ExteriorModel,
  floorIds: Readonly<Record<string, string>>,
  onPick: (floorId: string) => void,
) {
  const layer = document.createElement('div');
  layer.className = 'exterior-entrance-markers';
  layer.setAttribute('role', 'group');
  layer.setAttribute('aria-label', '建筑入口');
  const markers = model.entrances.flatMap((entry) => {
    const floorId = floorIds[entry.id];
    if (
      !model.entryMeshes.some(
        (mesh) => mesh.userData.entryId === entry.id && mesh.userData.id === floorId,
      )
    )
      return [];
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'exterior-entrance-marker';
    button.dataset.entrance = entry.id;
    button.setAttribute('aria-label', `${entry.name} · ${entry.side}，点击进入`);
    button.title = `${entry.name} · ${entry.side}`;
    const badge = document.createElement('span');
    badge.className = 'exterior-entrance-badge';
    badge.textContent = badges[entry.name] ?? entry.name;
    const caption = document.createElement('span');
    caption.className = 'exterior-entrance-caption';
    caption.textContent = `${entry.name} · ${entry.side}`;
    caption.setAttribute('aria-hidden', 'true');
    button.append(badge, caption);
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      onPick(floorId);
    });
    for (const event of ['mouseenter', 'focus'])
      button.addEventListener(event, () => model.setSelected(entry.id));
    for (const event of ['mouseleave', 'blur'])
      button.addEventListener(event, () => model.setSelected(null));
    button.hidden = true;
    layer.append(button);
    // The 456 study returns world-space doors after rotating its construction axes.
    const normal = entry.normal
      ? new THREE.Vector3(...entry.normal)
      : ['fourth-south', 'fifth-south'].includes(entry.id)
        ? new THREE.Vector3(0, 0, 1)
        : entry.id === 'fourth-north'
          ? new THREE.Vector3(0, 0, -1)
          : new THREE.Vector3(1, 0, 0);
    return [{ entry, button, normal }];
  });
  host.append(layer);
  const projected = new THREE.Vector3();
  const direction = new THREE.Vector3();
  return {
    update(camera: THREE.Camera) {
      const width = host.clientWidth,
        height = host.clientHeight;
      for (const { entry, button, normal } of markers) {
        projected.copy(entry.position);
        projected.y += 3.7;
        projected.project(camera);
        const facing = direction.copy(camera.position).sub(entry.position).dot(normal) > 0;
        const shown =
          facing &&
          Math.abs(projected.x) < 0.97 &&
          Math.abs(projected.y) < 0.97 &&
          Math.abs(projected.z) <= 1;
        button.hidden = !shown;
        if (shown) {
          button.style.left = `${((projected.x + 1) * width) / 2}px`;
          button.style.top = `${((1 - projected.y) * height) / 2}px`;
        }
      }
    },
    dispose() {
      layer.remove();
      model.setSelected(null);
    },
  };
}
