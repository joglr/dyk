import { clamp } from "./util";

let cases = [
  // min, max, value, expected
  [0, 1000, 100, 100],
  [0, 1000, 1001, 1000],
  [0, 1000, -100, 0],
];

test("clamp", () => {
  for (const [min, max, value, expected] of cases) {
    expect(clamp(min, max, value)).toBe(expected);
  }
});
