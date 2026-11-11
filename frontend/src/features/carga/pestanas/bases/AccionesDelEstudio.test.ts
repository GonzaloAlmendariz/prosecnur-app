import { describe, expect, it } from "vitest";
import { avisoDeQuitarTodas, salidaDelEstudio } from "./AccionesDelEstudio";

describe("salidaDelEstudio", () => {
  it("cuenta las entradas como el motor: con una o ninguna se vuelve a una base; con dos o más, hija incluida, solo se quitan todas", () => {
    expect(salidaDelEstudio(0)).toBe("volver-a-una");
    expect(salidaDelEstudio(1)).toBe("volver-a-una");
    // Madre e hija: dos entradas en `estudio$bases`; el motor rechaza la vuelta (E_MULTIPLE_BASES).
    expect(salidaDelEstudio(2)).toBe("quitar-todas");
    expect(salidaDelEstudio(6)).toBe("quitar-todas");
  });
});

describe("avisoDeQuitarTodas", () => {
  it("dice cuántas bases se quitan y si va el grupo repetido", () => {
    expect(avisoDeQuitarTodas(2, 0)).toBe("Se quitan las 2 bases; sus respuestas dejan de estar en el proyecto. No se puede deshacer.");
    expect(avisoDeQuitarTodas(1, 1)).toBe("Se quita la base y su grupo repetido; sus respuestas dejan de estar en el proyecto. No se puede deshacer.");
    expect(avisoDeQuitarTodas(2, 1)).toBe("Se quitan las 2 bases y el grupo repetido; sus respuestas dejan de estar en el proyecto. No se puede deshacer.");
    expect(avisoDeQuitarTodas(1, 3)).toBe("Se quita la base y los 3 grupos repetidos; sus respuestas dejan de estar en el proyecto. No se puede deshacer.");
  });
});
