import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createMarineLife } from './marineLife.js';
import { OCEAN_RADIUS } from './world.js';
import { FISH_KINDS } from './fishing.js';

test('catching consumes an actual visible small fish once, until its school leaves', () => {
  const marine = createMarineLife(new THREE.Group(), OCEAN_RADIUS);
  try {
    let time = 0;
    let fish;
    for (; time < 60; time += 0.5) {
      marine.update(time); fish = marine.getFish()[0]; if (fish) break;
    }
    assert.ok(fish, 'A school must eventually pass through the displayed sea');
    assert.ok(FISH_KINDS.includes(fish.kind));
    assert.ok(Math.hypot(fish.x, fish.z) < OCEAN_RADIUS - 0.5);
    assert.deepEqual(marine.takeFish(fish.id), { id: fish.id, kind: fish.kind });
    assert.equal(marine.takeFish(fish.id), null);
    marine.update(time + 0.1);
    assert.ok(marine.getFish().every((member) => member.id !== fish.id));
    assert.equal(marine.takeFish('whale'), null);
  } finally { marine.dispose(); }
});
