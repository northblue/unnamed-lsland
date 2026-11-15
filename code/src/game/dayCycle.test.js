import test from 'node:test';
import assert from 'node:assert/strict';
import { dayCycleAt, wrapHour, localHour, formatIslandTime, createDayClock } from './dayCycle.js';

test('24-hour clock wraps midnight, formats time, and reads local device time', () => {
  assert.equal(wrapHour(24), 0);
  assert.equal(wrapHour(-1), 23);
  assert.equal(formatIslandTime(1439), '23:59');
  assert.equal(formatIslandTime(1440), '00:00');
  assert.equal(localHour(new Date(2026, 10, 8, 18, 30, 0)), 18.5);
  assert.throws(() => wrapHour(NaN));
});

test('accelerated clock advances one hour per real minute at 24 minutes per day', () => {
  const clock = createDayClock(10);
  clock.setDayLength(24, 10);
  assert.equal(clock.update(60, 10).hour, 11);
  clock.setDayLength(12, 15);
  assert.equal(clock.update(60, 15).hour, 13);
  clock.setPreview(23.5);
  assert.equal(clock.update(60, 15).hour, 23.5);
  clock.setPreview(null);
  assert.equal(clock.update(0, 15).hour, 15);
  clock.setDayLength(null, 18);
  assert.equal(clock.update(60, 19).hour, 19);
  assert.throws(() => clock.setDayLength(0, 12));
});

test('sun and stars alternate with smooth dawn, dusk, and midnight boundaries', () => {
  assert.equal(dayCycleAt(12).daylight, 1);
  assert.equal(dayCycleAt(12).stars, 0);
  assert.equal(dayCycleAt(0).daylight, 0);
  assert.equal(dayCycleAt(0).stars, 1);
  assert.equal(dayCycleAt(6).phase, 'dawn');
  assert.equal(dayCycleAt(18).phase, 'dusk');
  assert.ok(dayCycleAt(5.5).daylight < dayCycleAt(6.5).daylight);
  assert.ok(dayCycleAt(18.5).daylight < dayCycleAt(17.5).daylight);
  for (const boundary of [0, 5, 6, 8, 12, 17, 18, 20, 24]) {
    const before = dayCycleAt(boundary - 0.001);
    const after = dayCycleAt(boundary + 0.001);
    assert.ok(Math.abs(before.daylight - after.daylight) < 0.01);
    assert.ok(Math.abs(before.stars - after.stars) < 0.01);
  }
});
