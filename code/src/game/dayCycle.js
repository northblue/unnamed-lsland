// Time rules only. No Three.js, DOM, database, or astronomical/location assumptions.
export function wrapHour(hour) {
  if (!Number.isFinite(hour)) throw new TypeError('Invalid hour');
  return ((hour % 24) + 24) % 24;
}

const smooth = (a, b, value) => {
  const t = Math.max(0, Math.min(1, (value - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export function localHour(date = new Date()) {
  return date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600;
}

export function dayCycleAt(hour) {
  hour = wrapHour(hour);
  const angle = (hour - 6) / 24 * Math.PI * 2;
  const altitude = Math.sin(angle);
  const daylight = smooth(-0.16, 0.32, altitude);
  return {
    hour, angle, altitude, daylight,
    stars: 1 - smooth(-0.3, 0.02, altitude),
    twilight: (1 - smooth(0, 0.5, Math.abs(altitude))),
    phase: hour >= 5 && hour < 8 ? 'dawn' : hour >= 8 && hour < 17 ? 'day' : hour >= 17 && hour < 20 ? 'dusk' : 'night',
    minutes: Math.floor(hour * 60),
  };
}

export function formatIslandTime(minutes) {
  const value = Math.floor(((minutes % 1440) + 1440) % 1440);
  return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
}

export function createDayClock(initialHour = localHour()) {
  let hour = wrapHour(initialHour);
  let dayMinutes = null;
  let preview = null;
  return {
    setDayLength(minutes, realHour) {
      if (minutes !== null && (!Number.isFinite(minutes) || minutes < 1 || minutes > 1440)) throw new RangeError('Invalid day length');
      hour = preview ?? (dayMinutes === null ? wrapHour(realHour) : hour);
      preview = null;
      dayMinutes = minutes;
    },
    setPreview(value) { preview = value === null ? null : wrapHour(value); },
    update(dt, realHour) {
      if (dayMinutes !== null) hour = wrapHour(hour + Math.max(0, dt) * 24 / (dayMinutes * 60));
      return { ...dayCycleAt(preview ?? (dayMinutes === null ? realHour : hour)), preview: preview !== null, dayMinutes };
    },
  };
}
