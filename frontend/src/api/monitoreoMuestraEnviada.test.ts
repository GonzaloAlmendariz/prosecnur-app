import { describe, expect, it } from "vitest";
import { normalizeMuestraEnviada } from "./monitoreoMuestraEnviada";

describe("normalizeMuestraEnviada (I4)", () => {
  it("lee la muestra distinta con la forma que serializa Plumber", () => {
    const m = normalizeMuestraEnviada({
      ok: [true],
      estado: ["distinta"],
      phase: ["field"],
      enviado_at: ["2026-10-20T10:00:00Z"],
      semilla_enviada: [123],
      semilla_viva: [456],
      ump_enviadas: [3],
      ump_vivas: [3],
      entran: ["M9"],
      salen: ["M2"],
      cambian_rol: "M3",
      cambian: [1],
      texto: ["La muestra se volvió a sortear después del envío (semilla 456; Material tiene la 123)."],
    });
    expect(m.estado).toBe("distinta");
    expect(m.semillaEnviada).toBe(123);
    expect(m.semillaViva).toBe(456);
    expect(m.entran).toEqual(["M9"]);
    expect(m.salen).toEqual(["M2"]);
    expect(m.cambianRol).toEqual(["M3"]);
    expect(m.cambian).toBe(1);
    expect(m.texto).toMatch(/semilla 456/);
  });

  it("una lista de uno llega como valor suelto y una vacía como objeto", () => {
    const m = normalizeMuestraEnviada({ estado: "distinta", entran: "M9", salen: {}, semilla_viva: null });
    expect(m.entran).toEqual(["M9"]);
    expect(m.salen).toEqual([]);
    expect(m.semillaViva).toBeNull();
  });

  it("un estado desconocido no se hace pasar por una diferencia", () => {
    expect(normalizeMuestraEnviada({ estado: "rara" }).estado).toBe("sin_envio");
    expect(normalizeMuestraEnviada(null).estado).toBe("sin_envio");
  });
});
