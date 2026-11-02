import { describe, expect, test } from "vitest";
import { transcurrido } from "./SorteoEnCurso";

describe("tiempo del sorteo en curso", () => {
  test("minutos y segundos, nunca negativo", () => {
    expect(transcurrido(0, 65_000)).toBe("1:05");
    expect(transcurrido(0, 5_400)).toBe("0:05");
    expect(transcurrido(10_000, 0)).toBe("0:00");
  });
});
