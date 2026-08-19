import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { estratosConAjusteAula, estratosConAulaExtra, fijasPendientes } from "../certificacionAcciones";
import { presupuestoVisitas } from "../PresupuestoVisitasCard";
import type { CalcMuestraEstrato } from "../../../../../api/calcMuestra";

// La decisión «darle un aula más» debe estar disponible en la UI y quedar
// REGISTRADA (Gonzalo: «nada puede ser manual»). El helper fija
// aulas_base_fijas = actuales + 1 en el estrato de la facultad, y el flujo
// existente (recalcular → seleccionar) la aplica.

const estrato = (label: string, extra: Partial<CalcMuestraEstrato> = {}) =>
  ({ id: label, label, N: 100, N_a: 50, N_b: 50, sub_a_label: "F", sub_b_label: "M", promedio_conglomerado: 20, tau: 0.5, ...extra }) as CalcMuestraEstrato;

describe("estratosConAulaExtra", () => {
  const estratos = [estrato("PSICOLOGÍA"), estrato("DERECHO", { aulas_base_fijas: 18 })];

  it("fija actuales+1 en la facultad objetivo y no toca las demás", () => {
    const out = estratosConAulaExtra(estratos, "PSICOLOGÍA", 7);
    expect(out?.[0].aulas_base_fijas).toBe(8);
    expect(out?.[1].aulas_base_fijas).toBe(18);
    // Inmutable: el arreglo original queda intacto.
    expect(estratos[0].aulas_base_fijas).toBeUndefined();
  });

  it("encuentra la facultad aunque la etiqueta venga con otra grafía", () => {
    const out = estratosConAulaExtra(estratos, "psicologia", 7);
    expect(out?.[0].aulas_base_fijas).toBe(8);
  });

  it("sin blanco no parchea a medias: facultad ausente o datos rotos → null", () => {
    expect(estratosConAulaExtra(estratos, "GESTIÓN", 5)).toBeNull();
    expect(estratosConAulaExtra(estratos, "PSICOLOGÍA", Number.NaN)).toBeNull();
    expect(estratosConAulaExtra([], "PSICOLOGÍA", 7)).toBeNull();
  });
});

describe("cableado de la acción", () => {
  const card = readFileSync(join(__dirname, "..", "CertificacionFacultadCard.tsx"), "utf8");
  const desk = readFileSync(join(__dirname, "..", "..", "UniversidadDesk.tsx"), "utf8");

  it("la tarjeta ofrece +1 aula en filas comprometidas y el Desk la registra", () => {
    expect(card).toMatch(/filaComprometida\(f\)/);
    expect(card).toMatch(/onAgregarAula\(f\.facultad, f\.aulas_titulares\)/);
    expect(desk).toMatch(/estratosConAulaExtra\(compActivo\.marco\?\.estratos/);
    expect(desk).toMatch(/onComponente\(compActivo\.id, \{ marco: \{ estratos: nuevos \} \}\)/);
    expect(desk).toMatch(/onAgregarAula=\{onAgregarAulaFacultad\}/);
  });

  it("nada queda apagado con un guard constante", () => {
    expect(card).not.toMatch(/\{\s*false\s*&&/);
  });
});

describe("estratosConAjusteAula (el par ±1)", () => {
  const estratos = [
    { label: "DERECHO", aulas_base_fijas: undefined },
    { label: "PSICOLOGÍA", aulas_base_fijas: undefined },
  ] as never;

  it("baja fija actuales−1 y sube fija actuales+1, solo en la facultad tocada", () => {
    const menos = estratosConAjusteAula(estratos, "DERECHO", 18, -1);
    expect(menos?.[0].aulas_base_fijas).toBe(17);
    expect(menos?.[1].aulas_base_fijas).toBeUndefined();
    const mas = estratosConAjusteAula(estratos, "DERECHO", 18, 1);
    expect(mas?.[0].aulas_base_fijas).toBe(19);
  });

  it("no baja de 1: excluir una facultad del sorteo es otra decisión con otra puerta", () => {
    expect(estratosConAjusteAula(estratos, "DERECHO", 1, -1)).toBeNull();
  });

  it("la tarjeta ofrece el stepper con onAjustarAula y la leyenda explica el ×N", () => {
    const card = readFileSync(
      new URL("../CertificacionFacultadCard.tsx", import.meta.url),
      "utf8",
    );
    expect(card).toMatch(/onAjustarAula\(f\.facultad, f\.aulas_titulares, -1\)/);
    expect(card).toMatch(/onAjustarAula\(f\.facultad, f\.aulas_titulares, 1\)/);
    expect(card).toMatch(/cmv2-cert-leyenda/);
    expect(card).toMatch(/por cada alumno de cuota/);
  });
});

describe("fijasPendientes (el letrero del click-test)", () => {
  it("lista la fija que el resultado aun no refleja, con ambos numeros", () => {
    const pendientes = fijasPendientes(
      [{ label: "PSICOLOGÍA", aulas_base_fijas: 8 }, { label: "DERECHO" }] as never,
      [{ estrato: "PSICOLOGÍA", aulas_base: 7 }, { estrato: "DERECHO", aulas_base: 18 }],
    );
    expect(pendientes).toEqual([{ facultad: "PSICOLOGÍA", fijada: 8, calculada: 7 }]);
  });

  it("la fija ya aplicada (resultado coincide) NO es pendiente", () => {
    const pendientes = fijasPendientes(
      [{ label: "PSICOLOGÍA", aulas_base_fijas: 8 }] as never,
      [{ estrato: "PSICOLOGÍA", aulas_base: 8 }],
    );
    expect(pendientes).toEqual([]);
  });

  it("sin fijas o sin estratos devuelve vacio", () => {
    expect(fijasPendientes([{ label: "X" }] as never, [])).toEqual([]);
    expect(fijasPendientes(null, null)).toEqual([]);
  });
});

describe("presupuestoVisitas (opción B: el techo manda)", () => {
  const tit = (n: number, p: number) => Array.from({ length: n }, () => ({ p_aplicada_ref: p }));

  it("plan = titulares + activaciones esperadas, con estado contra el techo", () => {
    const p = presupuestoVisitas(200, tit(190, 0.935));
    expect(p?.plan).toBe(202);
    // 202 sobre techo 200: EXCEDIDO aunque sea por poco — decirlo claro es
    // el punto del presupuesto. Rozando = dentro pero a ≤5 del techo.
    expect(p?.estado).toBe("excedido");
    expect(presupuestoVisitas(205, tit(190, 0.935))?.estado).toBe("rozando");
    expect(presupuestoVisitas(240, tit(190, 0.935))?.estado).toBe("dentro");
  });

  it("sin techo declarado (0) o sin titulares no pinta presupuesto", () => {
    expect(presupuestoVisitas(0, tit(190, 0.9))).toBeNull();
    expect(presupuestoVisitas(200, [])).toBeNull();
  });

  it("sin calibración declara que no puede estimar, sin inventar activaciones", () => {
    const p = presupuestoVisitas(200, [{ otra: 1 }, { otra: 2 }] as never);
    expect(p?.activacionesEsperadas).toBeNull();
    expect(p?.plan).toBeNull();
  });
});
