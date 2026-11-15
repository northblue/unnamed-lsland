export function createPassage(radius, random = Math.random, offset = null) {
  return {
    radius,
    angle: random() * Math.PI * 2,
    offset: (offset ?? (radius * 0.703 + random() * radius * 0.166)) * (random() > 0.5 ? 1 : -1),
    duration: 24 + random() * 12,
  };
}

export function passagePoint(route, progress, alongOffset = 0, acrossOffset = 0) {
  const along = (progress * 2 - 1) * (route.radius + 5) + alongOffset;
  const across = route.offset + acrossOffset;
  const cos = Math.cos(route.angle);
  const sin = Math.sin(route.angle);
  return { x: along * cos - across * sin, z: along * sin + across * cos, heading: -route.angle };
}
