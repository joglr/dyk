import { IPositioned } from "./App";

export function clamp(min: number, max: number, value: number) {
  return Math.min(Math.max(value, min), max);
}

export function pick(items: any[]) {
  return items[Math.floor(Math.random() * items.length)];
}

export function dist(e1: IPositioned, e2: IPositioned) {
  return Math.sqrt(Math.pow(e2.x - e1.x, 2) + Math.pow(e2.y - e1.y, 2));
}
