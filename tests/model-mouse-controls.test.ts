import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { OrthographicCamera } from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { attachModelMouseControls } from '../src/lib/model-mouse-controls';

function harness(t: TestContext) {
  const win = new EventTarget();
  const doc = Object.assign(new EventTarget(), { hidden: false });
  const originals = ['window', 'document'].map((key) =>
    Object.getOwnPropertyDescriptor(globalThis, key),
  );
  Object.defineProperty(globalThis, 'window', { configurable: true, value: win });
  Object.defineProperty(globalThis, 'document', { configurable: true, value: doc });
  const canvas = Object.assign(new EventTarget(), {
    dataset: {} as Record<string, string>,
    clientHeight: 600,
  });
  const camera = new OrthographicCamera(-10, 10, 10, -10, 0.1, 100);
  camera.position.set(8, 6, 10);
  const controls = new OrbitControls(camera);
  controls.maxPolarAngle = Math.PI / 2.05;
  let interactions = 0;
  const angles: number[] = [];
  const mouse = attachModelMouseControls(
    canvas as unknown as HTMLCanvasElement,
    controls,
    () => interactions++,
    undefined,
    (radians) => angles.push(radians),
  );
  t.after(() => {
    mouse.dispose();
    ['window', 'document'].forEach((key, index) => {
      if (originals[index]) Object.defineProperty(globalThis, key, originals[index]!);
      else Reflect.deleteProperty(globalThis, key);
    });
  });
  const fire = (
    type: string,
    props: Record<string, unknown> = {},
    target = canvas as EventTarget,
  ) => {
    const event = Object.assign(new Event(type, { cancelable: true }), {
      pointerType: 'mouse',
      button: 0,
      buttons: 0,
      clientX: 300,
      clientY: 300,
      ...props,
    });
    target.dispatchEvent(event);
    return event;
  };
  const right = () => {
    fire('pointerdown', { button: 2, buttons: 2 });
    fire('pointerup', { button: 2 });
  };
  return {
    canvas,
    camera,
    controls,
    mouse,
    fire,
    right,
    win,
    doc,
    interactions: () => interactions,
    angles,
  };
}

test('right click toggles hover orbit while retaining distance, target and zoom', (t) => {
  const h = harness(t);
  const initial = h.camera.position.clone();
  const distance = h.controls.getDistance();
  const target = h.controls.target.clone();
  h.fire('pointermove', { clientX: 330 });
  assert.ok(initial.equals(h.camera.position));
  h.right();
  h.fire('pointermove', { clientX: 360, clientY: 320 });
  assert.equal(h.mouse.isActive(), true);
  assert.ok(initial.distanceTo(h.camera.position) > 0.1);
  assert.ok(Math.abs(h.controls.getDistance() - distance) < 1e-10);
  assert.ok(h.controls.target.equals(target));
  assert.equal(h.camera.zoom, 1);
  h.fire('pointermove', { clientY: -10000 });
  assert.ok(h.controls.getPolarAngle() <= h.controls.maxPolarAngle + 1e-10);
  h.right();
  const stopped = h.camera.position.clone();
  h.fire('pointermove', { clientX: 400 });
  assert.ok(stopped.equals(h.camera.position));
  assert.equal(h.canvas.dataset.rotationMode, 'false');
});

test('left-drag and wheel events remain available and resume hover without a jump', (t) => {
  const h = harness(t);
  h.right();
  const initial = h.camera.position.clone();
  let leftDown = 0;
  h.canvas.addEventListener('pointerdown', () => leftDown++);
  const down = h.fire('pointerdown', { button: 0, buttons: 1 });
  h.fire('pointermove', { buttons: 1, clientX: 500 });
  assert.ok(initial.equals(h.camera.position));
  assert.equal(leftDown, 1);
  assert.equal(down.defaultPrevented, false);
  assert.equal(h.fire('wheel').defaultPrevented, false);
  h.fire('pointerup');
  h.fire('pointermove', { clientX: 510 });
  assert.ok(initial.equals(h.camera.position));
  h.fire('pointermove', { clientX: 520 });
  assert.ok(initial.distanceTo(h.camera.position) > 0.1);
  assert.equal(h.mouse.isActive(), true);
});

test('plan mode, touch, long right drags and interrupted clicks cannot enter orbit', (t) => {
  const h = harness(t);
  h.controls.enableRotate = false;
  h.right();
  assert.equal(h.mouse.isActive(), false);
  h.controls.enableRotate = true;
  h.fire('pointerdown', { pointerType: 'touch', button: 2, buttons: 2 });
  h.fire('pointerup', { pointerType: 'touch', button: 2 });
  assert.equal(h.mouse.isActive(), false);
  assert.equal(h.fire('pointerdown', { button: 2, buttons: 2 }).defaultPrevented, true);
  h.fire('pointerup', { button: 2, clientX: 400 });
  assert.equal(h.mouse.isActive(), false);
  h.fire('pointerdown', { button: 2, buttons: 2 });
  h.fire('pointerleave');
  h.fire('pointerup', { button: 2 });
  assert.equal(h.mouse.isActive(), false);
  assert.equal(h.fire('contextmenu').defaultPrevented, true);
});

test('UI boundary, Escape, blur, reset and disposal prevent stuck orbit and stale deltas', (t) => {
  const h = harness(t);
  h.right();
  h.fire('pointerleave');
  const initial = h.camera.position.clone();
  h.fire('pointermove', { clientX: 900 });
  assert.ok(initial.equals(h.camera.position));
  const escape = h.fire('keydown', { key: 'Escape' }, h.win);
  assert.equal(escape.defaultPrevented, true);
  assert.equal(h.mouse.isActive(), false);
  h.right();
  h.fire('blur', {}, h.win);
  assert.equal(h.mouse.isActive(), false);
  h.right();
  h.doc.hidden = true;
  h.fire('visibilitychange', {}, h.doc);
  assert.equal(h.mouse.isActive(), false);
  h.right();
  h.mouse.reset();
  assert.equal(h.mouse.isActive(), false);
  h.mouse.dispose();
  h.right();
  assert.equal(h.mouse.isActive(), false);
});

test('orbit progress reports actual direction changes and accumulates reverse travel positively', (t) => {
  const h = harness(t);
  h.fire('pointermove', { clientX: 330 });
  h.fire('wheel');
  assert.deepEqual(h.angles, []);
  h.right();
  assert.deepEqual(h.angles, [], 'entering rotation alone is not rotation');
  const before = h.camera.position.clone().sub(h.controls.target).normalize();
  h.fire('pointermove', { clientX: 345 });
  const after = h.camera.position.clone().sub(h.controls.target).normalize();
  assert.equal(h.angles.length, 1);
  assert.ok(Math.abs(h.angles[0] - before.angleTo(after)) < 1e-10);
  h.fire('pointermove', { clientX: 300 });
  assert.equal(h.angles.length, 2);
  assert.ok(h.angles.every((angle) => angle > 0));
  assert.ok(Math.abs(h.angles[0] - h.angles[1]) < 1e-10);
  assert.ok(h.angles.reduce((sum, angle) => sum + angle, 0) > Math.PI / 4);
  assert.ok(
    h.camera.position.clone().normalize().distanceTo(before) < 1e-10,
    'net orientation can return to the start while total travel exceeds 45 degrees',
  );
});

test('camera limits, non-orbit motion, and re-entry do not create spurious progress', (t) => {
  const h = harness(t);
  h.controls.minPolarAngle = 0.4;
  h.right();
  h.fire('pointermove', { clientY: -1000 });
  assert.equal(h.angles.length, 1);
  h.fire('pointermove', { clientY: -1100 });
  assert.equal(h.angles.length, 1, 'pushing further into the polar limit adds nothing');
  const theta = h.controls.getAzimuthalAngle();
  h.controls.minAzimuthAngle = theta;
  h.controls.maxAzimuthAngle = theta;
  h.fire('pointermove', { clientX: 600, clientY: -1100 });
  assert.equal(h.angles.length, 1, 'azimuth constraints also suppress false progress');
  h.controls.minAzimuthAngle = -Infinity;
  h.controls.maxAzimuthAngle = Infinity;
  h.fire('pointerleave');
  h.fire('pointermove', { clientX: 900, clientY: 300 });
  assert.equal(h.angles.length, 1, 're-entering sets a new cursor origin');
  h.fire('pointermove', { clientX: 910, clientY: 300 });
  assert.equal(h.angles.length, 2);
  h.fire('pointerdown', { button: 0, buttons: 1 });
  h.fire('pointermove', { buttons: 1, clientX: 950 });
  h.fire('wheel');
  assert.equal(h.angles.length, 2, 'pan and zoom add no orbit travel');
  h.fire('pointerup');
  h.fire('pointermove', { clientX: 960 });
  assert.equal(h.angles.length, 2, 'first hover after dragging also rebases');
  h.controls.autoRotate = true;
  h.controls.update();
  assert.equal(h.angles.length, 2, 'render-loop updates do not report input progress');
  h.fire('pointermove', { clientX: 960 });
  assert.equal(h.angles.length, 2, 'an input update cannot include an auto-rotation step');
  assert.equal(h.controls.autoRotate, true, 'measurement retains the existing auto-rotate setting');
});

test('crossing the azimuth wrap reports a short actual arc instead of a full revolution', (t) => {
  const h = harness(t);
  h.camera.position.set(0.1, 6, -10);
  h.controls.update();
  h.right();
  h.fire('pointermove', { clientX: 290 });
  assert.equal(h.angles.length, 1);
  assert.ok(h.angles[0] > 0 && h.angles[0] < 0.2);
});
