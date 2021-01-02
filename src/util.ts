export function clamp(min: number, max: number, value: number) {
  return Math.min(Math.max(value, min), max);
}

export function pick(items: any[]) {
  return items[Math.floor(Math.random() * items.length)];
}
