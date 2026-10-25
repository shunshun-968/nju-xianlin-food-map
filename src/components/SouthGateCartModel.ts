import * as THREE from 'three';
import { createCart, createGround } from '../models/south-gate/cart-model.js';
import { createFoodDisplay } from '../models/south-gate/food.js';
import type { FourthCanteenModel } from './FourthCanteenModel';
import { southGateCartStall } from '../data/south-gate-cart';

/** Same open cart and food geometry as the approved standalone model. */
export function createSouthGateCartModel(): FourthCanteenModel {
  const group = new THREE.Group();
  const cart = createCart(),
    ground = createGround(),
    food = createFoodDisplay();
  cart.group.add(food.day, food.night);
  // All visible parts share one identity; the surrounding ground is not a window.
  cart.group.traverse((object: THREE.Object3D) => {
    if (object instanceof THREE.Mesh)
      object.userData = { ...object.userData, kind: 'stall', id: southGateCartStall.id };
  });
  group.add(cart.group, ground.group);
  const hemi = new THREE.HemisphereLight('#fff9eb', '#c6cbbf', 2.3);
  const key = new THREE.DirectionalLight('#fff0d3', 3.1);
  key.position.set(-5, 9, 5);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -8, right: 8, top: 7, bottom: -7 });
  key.shadow.normalBias = 0.025;
  key.shadow.bias = -0.0002;
  key.shadow.radius = 3;
  const fill = new THREE.DirectionalLight('#d6dfed', 1.5);
  fill.position.set(4, 5, -5);
  group.add(hemi, key, fill);
  group.name = 'south-gate-cart';
  return {
    group,
    setMode() {},
    setInterfaceTheme(night) {
      cart.setNight(night);
      ground.setNight(night);
      food.day.visible = !night;
      food.night.visible = night;
      key.color.set(night ? '#c0c8f2' : '#fff0d3');
      key.intensity = night ? 1.15 : 3.1;
      hemi.color.set(night ? '#a9b5db' : '#fff9eb');
      hemi.groundColor.set(night ? '#565068' : '#c6cbbf');
      hemi.intensity = night ? 1.15 : 2.3;
      fill.intensity = night ? 0.7 : 1.5;
    },
    tick() {},
  };
}
