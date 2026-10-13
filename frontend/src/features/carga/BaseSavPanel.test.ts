import { describe, expect, test } from "vitest";
import { nombreDesdeArchivo } from "./BaseSavPanel";

describe("nombreDesdeArchivo", () => {
  test("propone un nombre de base limpio desde el archivo", () => {
    expect(nombreDesdeArchivo("HSyVBG Medición 2024.sav")).toBe("hsyvbg_medicion_2024");
    expect(nombreDesdeArchivo("__base__.sav")).toBe("base");
  });
});
