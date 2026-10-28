import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createNinanHutModel } from '../src/components/NinanHutModel';
import { ninanHutStall } from '../src/data/ninan-hut';
import { createNinanHutPickTargets } from '../src/lib/ninan-hut-picking';

test('Ninan clicks hit real house and tent surfaces, excluding scenery and hidden meal equipment', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: {
      createElement: () => ({
        width: 0,
        height: 0,
        getContext: () => new Proxy({}, { get: () => () => {} }),
      }),
    },
  });
  const model = createNinanHutModel();
  const targets = createNinanHutPickTargets(ninanHutStall, model.group);
  const pickDown = (x: number, z: number) =>
    targets.pick(new THREE.Raycaster(new THREE.Vector3(x, 10, z), new THREE.Vector3(0, -1, 0)));
  try {
    assert.equal(pickDown(0, 0), ninanHutStall.id, 'Roof is directly clickable');
    assert.equal(pickDown(4.4, 6.4), ninanHutStall.id, 'Tent roof is directly clickable');
    assert.equal(pickDown(-7, -7), undefined, 'Paving and background do not select the hut');
    model.group.visible = false;
    assert.equal(pickDown(0, 0), undefined, 'Cached hidden models never intercept clicks');
    model.group.visible = true;
    targets.group.visible = false;
    assert.equal(pickDown(0, 0), undefined);
    targets.group.visible = true;

    // 独立移出屋檐下以验证隐藏餐段，不让固定屋顶遮挡这一行为断言。
    const dinner = model.group.getObjectByName('ninan-dinner')!;
    const marker = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
    marker.position.set(30, 1, 30);
    dinner.add(marker);
    model.setMealMode('breakfast');
    assert.equal(pickDown(30, 30), undefined);
    model.setMealMode('dinner');
    assert.equal(pickDown(30, 30), ninanHutStall.id);
  } finally {
    model.group.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      object.geometry.dispose();
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        for (const value of Object.values(material))
          if (value instanceof THREE.Texture) value.dispose();
        material.dispose();
      }
    });
    if (original) Object.defineProperty(globalThis, 'document', original);
    else Reflect.deleteProperty(globalThis, 'document');
  }
});
