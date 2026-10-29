import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createNinanHutModel } from '../src/components/NinanHutModel';
import { ninanHutStall } from '../src/data/ninan-hut';

test('Ninan exterior keeps spatial identity and changes only the selected meal equipment', async (t) => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'document');
  // Raster text only is stubbed; real Three.js geometry, batching and transforms are exercised.
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: {
      createElement(tag: string) {
        assert.equal(tag, 'canvas');
        const context = new Proxy({}, { get: () => () => {} });
        return { width: 0, height: 0, getContext: () => context };
      },
    },
  });
  const model = createNinanHutModel(),
    root = model.group;
  const required = (name: string) => {
    const object = root.getObjectByName(name);
    assert.ok(object, `${name} must exist`);
    return object;
  };
  const breakfast = required('ninan-breakfast'),
    lunch = required('ninan-lunch'),
    dinner = required('ninan-dinner');
  try {
    await t.test('dinner adds barbecue equipment while retaining the indoor drink machines', () => {
      assert.equal(breakfast.visible, true);
      assert.equal(lunch.visible, false);
      assert.equal(dinner.visible, false);
      assert.ok(
        new THREE.Box3().setFromObject(breakfast).getSize(new THREE.Vector3()).length() > 1,
      );
      assert.ok(new THREE.Box3().setFromObject(lunch).getSize(new THREE.Vector3()).length() > 1);
      model.setMealMode('lunch');
      assert.equal(breakfast.visible, false);
      assert.equal(lunch.visible, true);
      assert.equal(dinner.visible, false);
      const drinks = required('lunch-drinks-machines-inside-east-window');
      const drinksPose = drinks.position.clone();
      model.setMealMode('dinner');
      assert.equal(breakfast.visible, false);
      assert.equal(lunch.visible, true);
      assert.equal(dinner.visible, true);
      assert.equal(required('lunch-drinks-machines-inside-east-window'), drinks);
      assert.ok(drinks.position.equals(drinksPose));
      assert.equal(required('ninan-structure').visible, true);
      model.setMealMode('breakfast');
      assert.equal(breakfast.visible, true);
      assert.equal(lunch.visible, false);
      assert.equal(dinner.visible, false);
    });

    await t.test(
      'the fresh cabinet is outside the barbecue glazing and the grill uses the tent counter',
      () => {
        root.updateMatrixWorld(true);
        const bounds = (name: string) => new THREE.Box3().setFromObject(required(name));
        const fridge = bounds('ninan-ingredient-cabinet');
        const grill = bounds('ninan-barbecue-top');
        const counter = bounds('breakfast-stainless-counter');
        const warmer = bounds('breakfast-glass-warmer');
        const tent = bounds('ninan-breakfast-tent');
        assert.ok(fridge.min.x > 2.17, 'Cabinet stands outside the glass and timber facade');
        assert.ok(
          fridge.min.z > 1.2 && fridge.max.z < 4.8,
          'Cabinet stays east of the central doorway',
        );
        assert.ok(Math.abs(fridge.min.y - 0.33) < 0.1, 'Cabinet rests on the deck');
        assert.ok(fridge.getSize(new THREE.Vector3()).y > 2, 'Full-height upright ingredient case');
        assert.ok(grill.min.x >= tent.min.x && grill.max.x <= tent.max.x);
        assert.ok(grill.min.z >= tent.min.z && grill.max.z <= tent.max.z);
        assert.ok(grill.min.y >= 1.45, 'Only the cooking top is added above the reused steel cart');
        assert.ok(grill.min.x >= counter.min.x && grill.max.x <= counter.max.x);
        assert.ok(!grill.intersectsBox(warmer), 'Keep the existing glass warmer beside the grill');
        const area = ninanHutStall.serviceAreas!.find((area) => area.z > 1 && area.z < 4)!;
        assert.ok(area.x > fridge.max.x && area.z >= fridge.min.z && area.z <= fridge.max.z);
        model.setMealMode('dinner');
        model.setInterfaceTheme(true);
        assert.equal(dinner.visible, true);
        assert.equal(lunch.visible, true);
        assert.equal(required('ninan-night-accent-lights').visible, true);
        model.setInterfaceTheme(false);
        assert.equal(dinner.visible, true);
        assert.equal(lunch.visible, true);
        assert.equal(required('ninan-night-accent-lights').visible, false);
        model.setMealMode('breakfast');
      },
    );

    await t.test('lighting changes preserve the explicit meal selection and geometry', () => {
      model.setMealMode('lunch');
      root.updateMatrixWorld(true);
      const nodes: [THREE.Object3D, number[]][] = [];
      root.traverse((object) => nodes.push([object, object.matrixWorld.toArray()]));
      model.setInterfaceTheme(true);
      assert.equal(root.userData.mealMode, 'lunch');
      assert.equal(lunch.visible, true);
      assert.equal(breakfast.visible, false);
      model.setInterfaceTheme(false);
      assert.equal(root.userData.mealMode, 'lunch');
      model.setMode('plan');
      model.setMode('3d');
      root.updateMatrixWorld(true);
      assert.ok(
        nodes.every(([object, matrix]) =>
          object.matrixWorld.toArray().every((v, i) => v === matrix[i]),
        ),
      );
      assert.equal(
        required('closed-single-pitch-roof').visible,
        true,
        'Exterior view must never remove the roof to reveal an invented interior',
      );
    });

    await t.test('warm interior lamps illuminate the house only at night', () => {
      const lights = [1, 2, 3].map(
        (number) => required(`ninan-interior-warm-light-${number}`) as THREE.PointLight,
      );
      model.setMealMode('lunch');
      model.setInterfaceTheme(true);
      for (const light of lights) {
        assert.ok(light instanceof THREE.PointLight);
        assert.equal(light.color.getHexString(), 'ffb969');
        assert.equal(light.intensity, 13);
        assert.equal(light.distance, 4.2);
        assert.ok(light.position.x > -1 && light.position.x < 2, 'Lamp stays inside the house');
        assert.ok(Math.abs(light.position.z) < 4.8, 'Lamp stays inside the long walls');
      }
      model.setMealMode('dinner');
      assert.ok(lights.every((light) => light.intensity === 13), 'Meal switches keep the warm light');
      model.setInterfaceTheme(false);
      assert.ok(lights.every((light) => light.intensity === 0));
      assert.equal(root.userData.mealMode, 'dinner');
    });

    await t.test('all meals and themes keep one light topology without lighting inactive equipment', () => {
      const visibleLights = () => {
        const lights: THREE.Light[] = [];
        // 与 Three 编译着色器时收集灯光的方式一致。
        root.traverseVisible((object) => {
          if (object instanceof THREE.Light) lights.push(object);
        });
        return lights;
      };
      const baseline = visibleLights();
      const cabinetLight = required('ninan-ingredient-cabinet-light') as THREE.PointLight;
      const workLights = [1, 2].map(
        (index) => required(`ninan-night-work-light-${index}`) as THREE.PointLight,
      );
      root.updateMatrixWorld(true);
      const expectedCabinetPosition = new THREE.Vector3(0, 1.25, 0.51)
        .applyMatrix4(required('ninan-ingredient-cabinet').matrixWorld);
      assert.ok(cabinetLight.getWorldPosition(new THREE.Vector3()).distanceTo(expectedCabinetPosition) < 1e-9);
      for (const night of [false, true, false]) {
        for (const meal of ['breakfast', 'lunch', 'dinner'] as const) {
          model.setInterfaceTheme(night);
          model.setMealMode(meal);
          assert.deepEqual(visibleLights(), baseline, `${meal}/${night}: no new shader light variant`);
          assert.equal(cabinetLight.intensity, meal === 'dinner' ? (night ? 3.2 : 1.4) : 0);
          for (const light of workLights) assert.equal(light.intensity, night ? 9 : 0);
          assert.ok(cabinetLight.getWorldPosition(new THREE.Vector3()).distanceTo(expectedCabinetPosition) < 1e-9);
        }
      }
      model.setMealMode('breakfast');
    });

    await t.test(
      'breakfast board stands southeast of the separate tent and drink menu belongs below coffee',
      () => {
        root.updateMatrixWorld(true);
        const tent = required('ninan-breakfast-tent').getWorldPosition(new THREE.Vector3());
        const breakfastBoard = required('breakfast-board-southwest-of-tent').getWorldPosition(
          new THREE.Vector3(),
        );
        assert.ok(breakfastBoard.x < tent.x && breakfastBoard.z > tent.z);
        assert.ok(tent.x > 2 && tent.z > 4.8, 'Tent is northeast of the house, not inside it');
        const drinks = required('drinks-board-below-coffee-window').getWorldPosition(
          new THREE.Vector3(),
        );
        assert.ok(drinks.x > 2 && drinks.y < 1.25);
        assert.ok(Math.abs(drinks.z + 3.84) < 0.001);
        const { position, serviceAreas } = ninanHutStall;
        assert.ok(Math.abs(drinks.z - position.z) <= position.depth / 2);
        assert.ok(
          serviceAreas?.some((area) => Math.abs(area.x - tent.x) < 0.001 && area.z > tent.z),
        );
      },
    );

    await t.test(
      'display faces east and its west-facing letter backs are white mirrored cutouts',
      () => {
        root.updateMatrixWorld(true);
        const wall = required('ninan-photo-wall');
        const front = required('ninan-photo-wall-letters-front') as THREE.Mesh<
          THREE.PlaneGeometry,
          THREE.MeshStandardMaterial
        >;
        const rear = required('ninan-photo-wall-letters-rear') as THREE.Mesh<
          THREE.PlaneGeometry,
          THREE.MeshStandardMaterial
        >;
        const normal = (object: THREE.Object3D) =>
          new THREE.Vector3(0, 0, 1).transformDirection(object.matrixWorld);
        assert.ok(normal(front).distanceTo(new THREE.Vector3(0, 0, 1)) < 1e-6);
        assert.ok(normal(rear).distanceTo(new THREE.Vector3(0, 0, -1)) < 1e-6);
        assert.equal(front.material.side, THREE.FrontSide);
        assert.equal(rear.material.side, THREE.FrontSide);
        assert.ok(front.material.emissiveIntensity > 0);
        assert.equal(
          rear.material.emissiveIntensity,
          0,
          'The letter backs are not a second neon sign',
        );
        const frontUv = front.geometry.getAttribute('uv'),
          rearUv = rear.geometry.getAttribute('uv');
        for (let i = 0; i < frontUv.count; i++) {
          assert.equal(rearUv.getX(i), 1 - frontUv.getX(i));
          assert.equal(rearUv.getY(i), frontUv.getY(i));
        }
        const target = front.getWorldPosition(new THREE.Vector3());
        const fromEast = new THREE.Raycaster(
          target.clone().add(new THREE.Vector3(0, 0, 1)),
          new THREE.Vector3(0, 0, -1),
        );
        const fromWest = new THREE.Raycaster(
          target.clone().add(new THREE.Vector3(0, 0, -1)),
          new THREE.Vector3(0, 0, 1),
        );
        const eastHits = fromEast.intersectObjects([front, rear]),
          westHits = fromWest.intersectObjects([front, rear]);
        assert.ok(eastHits.length > 0 && eastHits.every((hit) => hit.object === front));
        assert.ok(westHits.length > 0 && westHits.every((hit) => hit.object === rear));
        for (const index of [1, 2]) {
          const poster = required(`ninan-photo-wall-poster-front-${index}`) as THREE.Mesh<
            THREE.PlaneGeometry,
            THREE.MeshStandardMaterial
          >;
          assert.equal(poster.material.side, THREE.FrontSide);
          const point = poster.getWorldPosition(new THREE.Vector3());
          const westRay = new THREE.Raycaster(
            point.clone().add(new THREE.Vector3(0, 0, -0.5)),
            new THREE.Vector3(0, 0, 1),
          );
          assert.equal(
            westRay.intersectObject(poster).length,
            0,
            'The west side must not display a mirrored color poster',
          );
        }
        assert.ok(wall.position.x > 3.4);
      },
    );

    await t.test('photo wall and seats clear the awning and stools and stay on the terrace', () => {
      root.updateMatrixWorld(true);
      const bounds = (name: string) => new THREE.Box3().setFromObject(required(name));
      const wall = bounds('ninan-photo-wall');
      const house = bounds('ninan-timber-corrugated-house');
      const terrace = bounds('ninan-raised-wood-terrace');
      const seats = bounds('colorful-nju-seats');
      // All bounds include actual solid meshes after batching, not only surviving text planes.
      assert.ok(seats.getSize(new THREE.Vector3()).y > 0.7);
      assert.ok(wall.min.x - house.max.x >= 0.5, 'Leave clear space beyond the extended awning');
      const letters = bounds('ninan-photo-wall-letters-front');
      const coffeeMenu = required('drinks-board-below-coffee-window').getWorldPosition(
        new THREE.Vector3(),
      );
      assert.ok(
        letters.max.z < coffeeMenu.z - 1,
        'Place the sign west of the coffee window, not in front of it',
      );
      assert.ok(seats.min.x >= terrace.min.x && seats.max.x < terrace.max.x);
      assert.ok(seats.min.z >= terrace.min.z && seats.max.z < terrace.max.z);
      assert.ok(Math.abs(seats.min.y - 0.32) < 0.04, 'Seats rest on the wooden deck');
      root.traverse((object) => {
        if (object.name === 'yellow-counter-stool') {
          const stool = new THREE.Box3().setFromObject(object);
          assert.ok(!wall.intersectsBox(stool), 'The display must not intersect a bar stool');
          if (object.position.x > 2)
            assert.ok(wall.min.x - stool.max.x >= 0.35, 'Keep a passage beside the bar stools');
        }
        if (object.name === 'outdoor-cafe-table') {
          const tableAndChairs = new THREE.Box3().setFromObject(object);
          assert.ok(
            tableAndChairs.min.x - terrace.max.x >= 0.2,
            'Outdoor chairs clear the deck step',
          );
        }
        if (object.name === 'slatted-planter' || object.name === 'outdoor-parasol')
          assert.ok(
            !wall.intersectsBox(new THREE.Box3().setFromObject(object)),
            'The display clears planters and parasols',
          );
      });
    });

    await t.test('plain exterior meshes leave service picking to dedicated targets', () => {
      root.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          assert.notEqual(object.userData.kind, 'stall');
          assert.equal(object.userData.id, undefined);
        }
      });
    });
  } finally {
    const geometries = new Set<THREE.BufferGeometry>(),
      materials = new Set<THREE.Material>(),
      textures = new Set<THREE.Texture>();
    root.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      geometries.add(object.geometry);
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        materials.add(material);
        for (const value of Object.values(material))
          if (value instanceof THREE.Texture) textures.add(value);
      }
    });
    geometries.forEach((value) => value.dispose());
    materials.forEach((value) => value.dispose());
    textures.forEach((value) => value.dispose());
    if (original) Object.defineProperty(globalThis, 'document', original);
    else Reflect.deleteProperty(globalThis, 'document');
  }
});
