import { describe, expect, test } from "vitest";
import {
  canonicalizeColorInput,
  isValidColor,
  isValidColorDraft,
  shouldCommitColorDraft,
  toHex7,
} from "./ArgField";

describe("color input helpers", () => {
  test("permite escribir hex con # como borrador parcial", () => {
    expect(isValidColorDraft("#")).toBe(true);
    expect(isValidColorDraft("#1")).toBe(true);
    expect(isValidColorDraft("#12")).toBe(true);
    expect(isValidColorDraft("#12345")).toBe(true);
  });

  test("confirma hex completos en formatos corto, normal y alpha", () => {
    expect(shouldCommitColorDraft("#abc")).toBe(true);
    expect(shouldCommitColorDraft("#aabbcc")).toBe(true);
    expect(shouldCommitColorDraft("#aabbccdd")).toBe(true);
    expect(shouldCommitColorDraft("#ab")).toBe(false);
  });

  test("normaliza hex sin numeral y mantiene compatibilidad con input color nativo", () => {
    expect(canonicalizeColorInput("abc")).toBe("#abc");
    expect(canonicalizeColorInput("AABBCC")).toBe("#AABBCC");
    expect(isValidColor("#abc")).toBe(true);
    expect(toHex7("#abc")).toBe("#aabbcc");
  });
});
