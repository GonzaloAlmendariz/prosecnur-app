import { describe, expect, it } from "vitest";

import { describirMarcoCartografia } from "./marcoCartografia";

// Los números son los de acnur_acg, leídos del payload real de
// `/api/hojas-ruta/state`: 117 352 en ambas, 1 056 sólo en la oficial y 2 sólo
// en la activa, sobre una auditoría de 118 410 filas.

const NOTA =
  "Marco local completo para Lima Metropolitana y Callao urbano. El frame actual sigue siendo el default; el frame oficial INEI 2017 queda disponible para auditoria y activacion controlada.";

function frame(over: Record<string, unknown> = {}) {
  return {
    ok: true,
    pilot: false,
    note: NOTA,
    audit: {
      ok: true,
      available: true,
      status_counts: { both: 117352, current_only: 2, official_only: 1056 },
    },
    ...over,
  } as never;
}

describe("describirMarcoCartografia", () => {
  it("pone en el chip la comparación contra la cartografía oficial", () => {
    const m = describirMarcoCartografia(frame())!;
    // El número va primero: el chip elide por la derecha.
    expect(m.resumen).toBe("1,056 manzanas sólo en la cartografía oficial · 2 sólo en la activa");
    expect(m.resumen.indexOf("1,056")).toBe(0);
    // Las coincidencias van al detalle: sin ellas el 1 056 no tiene escala.
    expect(m.detalle).toContain("117,352 manzanas coinciden");
    expect(m.detalle).toContain(NOTA);
  });

  it("la nota se dice también cuando el marco NO es piloto", () => {
    // El defecto exacto: se renderizaba sólo con `pilot: true`, y en un
    // proyecto normal `pilot` es falso, así que no aparecía nunca.
    const sinAudit = describirMarcoCartografia(frame({ audit: undefined, pilot: false }))!;
    expect(sinAudit.resumen).toBe(NOTA);
    expect(sinAudit.piloto).toBe(false);
  });

  it("marca el piloto para que conserve su tono de aviso", () => {
    expect(describirMarcoCartografia(frame({ pilot: true }))!.piloto).toBe(true);
  });

  it("en el piloto manda su nota, sin la comparación delante", () => {
    // La nota del piloto dice que las manzanas están limitadas al piloto: es
    // lo más consecuente que hay que saber y no puede quedar debajo de una
    // pared de números. Y la auditoría es de la cartografía empaquetada
    // completa, no del subconjunto del piloto: describiría otro marco.
    const NOTA_PILOTO = "Marco empaquetado para el piloto funcional Lima/Callao. Las manzanas siguen limitadas al piloto hasta activar el frame oficial validado.";
    const m = describirMarcoCartografia(frame({ pilot: true, note: NOTA_PILOTO }))!;
    expect(m.resumen).toBe(NOTA_PILOTO);
    expect(m.detalle).toBe(NOTA_PILOTO);
    expect(m.detalle).not.toContain("117,352");
  });

  it("no dice nada cuando el motor no aporta nada", () => {
    // El control: sin nota y sin auditoría no hay chip. Un chip vacío en cada
    // proyecto sería ruido permanente en el chrome del módulo.
    expect(describirMarcoCartografia(null)).toBeNull();
    expect(describirMarcoCartografia(frame({ note: "  ", audit: undefined }))).toBeNull();
  });

  it("cuando sólo sobra en el marco activo lo dice al derecho", () => {
    const m = describirMarcoCartografia(frame({
      audit: { ok: true, available: true, status_counts: { both: 100, current_only: 7, official_only: 0 } },
    }))!;
    expect(m.resumen).toBe("7 manzanas sólo en el marco activo");
  });

  it("una auditoría sin diferencias no inventa una comparación", () => {
    // Si el marco activo y el oficial coincidieran del todo, «0 sólo en la
    // oficial» sería ruido: queda la nota a secas.
    const m = describirMarcoCartografia(frame({
      audit: { ok: true, available: true, status_counts: { both: 100, current_only: 0, official_only: 0 } },
    }))!;
    expect(m.resumen).toBe(NOTA);
  });

  it("una auditoría no disponible no se lee aunque traiga conteos", () => {
    // `available: false` significa que el CSV no está: los conteos que
    // quedaran en el objeto no describen nada comprobable.
    const m = describirMarcoCartografia(frame({
      audit: { ok: false, available: false, status_counts: { both: 5, current_only: 1, official_only: 9 } },
    }))!;
    expect(m.resumen).toBe(NOTA);
  });

  it("un conteo corrupto degrada a la nota en vez de escribir NaN", () => {
    // El payload cruza `serializer_unboxed_json`, donde un entero puede llegar
    // como la cadena «NA».
    const m = describirMarcoCartografia(frame({
      audit: { ok: true, available: true, status_counts: { both: "NA", current_only: "NA", official_only: "NA" } },
    }))!;
    expect(m.resumen).not.toContain("NaN");
    expect(m.resumen).toBe(NOTA);
  });
});
