import { describe, expect, it } from "vitest";
import {
  containerPointToLogical,
  paddedGeometryViewBox,
  uniformContainTransform,
} from "./cartographicViewport";

describe("paddedGeometryViewBox", () => {
  it("frames the projected Lima extent without changing its intrinsic proportions", () => {
    const viewBox = paddedGeometryViewBox(
      { x: 113.01, y: 18, width: 333.98, height: 524 },
      { x: 0, y: 0, width: 560, height: 560 },
    );

    expect(viewBox).not.toBeNull();
    expect(viewBox?.x).toBeCloseTo(86.2916);
    expect(viewBox?.y).toBe(0);
    expect(viewBox?.width).toBeCloseTo(387.4168);
    expect(viewBox?.height).toBe(560);
    expect((viewBox?.width ?? 0) / (viewBox?.height ?? 1)).toBeLessThan(0.7);
  });

  it("rejects invalid, outside, and zero-sized geometry", () => {
    const frame = { x: 0, y: 0, width: 560, height: 560 };
    expect(paddedGeometryViewBox({ x: 0, y: 0, width: 0, height: 10 }, frame)).toBeNull();
    expect(paddedGeometryViewBox({ x: -1, y: 0, width: 20, height: 20 }, frame)).toBeNull();
    expect(paddedGeometryViewBox({ x: 10, y: 10, width: 20, height: 20 }, frame, -1)).toBeNull();
  });
});

describe("uniformContainTransform", () => {
  const logical = { width: 1100, height: 760 };

  it.each([
    ["square", { width: 760, height: 760 }, 760 / 1100, 0, 117.454545],
    ["portrait", { width: 500, height: 900 }, 500 / 1100, 0, 277.272727],
    ["landscape", { width: 1200, height: 500 }, 500 / 760, 238.157895, 0],
  ] as const)("contains and centers a %s canvas", (_label, container, scale, offsetX, offsetY) => {
    const transform = uniformContainTransform(container, logical);
    expect(transform?.scale).toBeCloseTo(scale);
    expect(transform?.offsetX).toBeCloseTo(offsetX);
    expect(transform?.offsetY).toBeCloseTo(offsetY);
    expect(transform?.drawWidth).toBeCloseTo(logical.width * scale);
    expect(transform?.drawHeight).toBeCloseTo(logical.height * scale);
  });

  it("rejects invalid or zero sizes", () => {
    expect(uniformContainTransform({ width: 0, height: 400 }, logical)).toBeNull();
    expect(uniformContainTransform({ width: 400, height: Number.NaN }, logical)).toBeNull();
    expect(uniformContainTransform({ width: 400, height: 400 }, { width: -1, height: 760 })).toBeNull();
  });

  it("round-trips points and rejects letterbox coordinates", () => {
    const transform = uniformContainTransform({ width: 1200, height: 500 }, logical);
    expect(transform).not.toBeNull();
    if (!transform) return;

    const logicalPoint = { x: 825, y: 190 };
    const containerPoint = {
      x: transform.offsetX + logicalPoint.x * transform.scale,
      y: transform.offsetY + logicalPoint.y * transform.scale,
    };
    expect(containerPointToLogical(containerPoint, transform)).toEqual(logicalPoint);
    expect(containerPointToLogical({ x: transform.offsetX - 1, y: 250 }, transform)).toBeNull();
  });
});
