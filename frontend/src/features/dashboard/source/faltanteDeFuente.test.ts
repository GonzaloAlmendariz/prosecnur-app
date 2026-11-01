import { describe, expect, it } from "vitest";

import { avisoDeOrigenInactivo, faltanteDeOrigen } from "./faltanteDeFuente";

describe("faltanteDeOrigen", () => {
  it("dice cuál de las dos piezas falta", () => {
    expect(faltanteDeOrigen({ xlsforms: [], data: ["d"] })).toBe("XLSForm");
    expect(faltanteDeOrigen({ xlsforms: ["x"], data: [] })).toBe("base de datos");
    expect(faltanteDeOrigen({ xlsforms: [], data: [] })).toBe("XLSForm ni base de datos");
  });

  it("calla cuando el origen tiene las dos", () => {
    expect(faltanteDeOrigen({ xlsforms: ["x"], data: ["d"] })).toBeNull();
  });
});

describe("avisoDeOrigenInactivo", () => {
  it("nombra el origen y la pieza que le falta", () => {
    expect(avisoDeOrigenInactivo("project", { xlsforms: [], data: ["d"] }))
      .toBe("El proyecto no tiene XLSForm.");
    expect(avisoDeOrigenInactivo("session", { xlsforms: ["x"], data: [] }))
      .toBe("La sesión no tiene base de datos.");
  });

  it("desaparece si el origen está completo", () => {
    expect(avisoDeOrigenInactivo("project", { xlsforms: ["x"], data: ["d"] })).toBeNull();
  });
});
