import test from 'node:test';
import assert from 'node:assert/strict';
import { Group } from 'three';
import { createIndoorModelLoader } from '../src/lib/indoor-model-loading';
import { fourthCanteenSpec, type IndoorCanteenSpec } from '../src/data/indoor-canteens';

const styles = [
  'fourth',
  'fifth',
  'sixth',
  'eighth',
  'minzu',
  'ninth',
  'tenth',
  'eleventh',
  'twelfth',
  'faculty',
] as const;
function model(spec: IndoorCanteenSpec) {
  const group = new Group();
  group.name = spec.id;
  return { group, setMode() {}, setInterfaceTheme() {}, tick() {} };
}

test('only the selected indoor module prepares; concurrent visits share work but never mutable geometry', async () => {
  const requested: string[] = [];
  let constructions = 0;
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const create = createIndoorModelLoader(
    Object.fromEntries(
      styles.map((style) => [
        style,
        async () => {
          requested.push(style);
          await gate;
          return (spec: IndoorCanteenSpec) => {
            constructions++;
            return model(spec);
          };
        },
      ]),
    ) as Parameters<typeof createIndoorModelLoader>[0],
  );
  const a = create(fourthCanteenSpec);
  const b = create({ ...fourthCanteenSpec, id: 'other-layout' });
  await Promise.resolve();
  assert.deepEqual(requested, ['fourth']);
  assert.equal(constructions, 0);
  release();
  const [first, second] = await Promise.all([a, b]);
  assert.equal(
    constructions,
    0,
    'cancelled navigation can discard the factory without creating a model',
  );
  const firstModel = first(),
    secondModel = second();
  assert.notEqual(firstModel.group, secondModel.group);
  assert.equal(firstModel.group.name, fourthCanteenSpec.id);
  assert.equal(secondModel.group.name, 'other-layout');
  assert.notEqual(first().group, firstModel.group, 'each factory invocation owns fresh geometry');
  await create(fourthCanteenSpec);
  assert.deepEqual(requested, ['fourth'], 'prepared modules stay reusable');
  await create({ ...fourthCanteenSpec, style: 'sixth' });
  assert.deepEqual(requested, ['fourth', 'sixth']);
});

test('failed indoor preparation is retried without poisoning other canteen modules', async () => {
  let attempts = 0;
  const create = createIndoorModelLoader(
    Object.fromEntries(
      styles.map((style) => [
        style,
        async () => {
          if (style === 'fourth' && attempts++ === 0) throw new Error('temporary asset failure');
          return model;
        },
      ]),
    ) as Parameters<typeof createIndoorModelLoader>[0],
  );
  await assert.rejects(create(fourthCanteenSpec), /temporary asset failure/);
  const sixth = await create({ ...fourthCanteenSpec, style: 'sixth' });
  assert.equal(sixth().group.name, fourthCanteenSpec.id);
  const retry = await create(fourthCanteenSpec);
  assert.equal(retry().group.name, fourthCanteenSpec.id);
  assert.equal(attempts, 2);
});
