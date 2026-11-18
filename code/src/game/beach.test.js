import test from 'node:test';
import assert from 'node:assert/strict';
import { beachHeight, createBeachGeometry } from './beach.js';
import { coastRadius, OCEAN_RADIUS } from './world.js';

test('sand joins the old shore continuously and slopes monotonically below water within the ocean', () => {
  for (let angle = 0; angle < Math.PI * 2; angle += 0.1) {
    const radius = coastRadius(angle), x = Math.cos(angle) * radius, z = Math.sin(angle) * radius;
    assert.ok(Math.abs(beachHeight(x, z) - 0.52) < 1e-8);
    let previous = 0.52;
    for (let i = 1; i <= 32; i++) {
      const ratio = 1 + i / 32 * 0.16, height = beachHeight(x * ratio, z * ratio);
      assert.ok(height <= previous + 1e-8); previous = height;
    }
    assert.ok(previous < -1.8); assert.ok(radius * 1.16 < OCEAN_RADIUS + 0.1);
  }
  const geometry = createBeachGeometry(); assert.ok(geometry.attributes.position.count > 1000); geometry.dispose();
});
