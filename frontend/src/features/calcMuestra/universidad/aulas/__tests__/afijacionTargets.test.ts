import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { conAfijacionDelEstudio, targetsDesdeEstratos } from "../afijacionTargets";
import type { CalcMuestraAulasEstrato, CalcMuestraWorkspaceAulasConfig } from "../../../../../api/calcMuestra";

// El motor respeta faculty_targets (calc_muestra_aulas_afijacion.R); este
// módulo es su consumidor UI: arma los targets desde los estratos del estudio
// e inyecta la afijación en el config del seleccionar. Sin este cableado el
// sorteo reparte por masa (medido: desvío 68/202 en HSVG2026).

function estrato(nombre: string, base: number, requeridas?: number): CalcMuestraAulasEstrato {
  return {
    estrato: nombre,
    N: 100,
    cuota: 10,
    avg_conglomerado: 20,
    tau: 1,
    aulas_base: base,
    aulas_reemplazo: 0,
    aulas_total: base,
    tipo_aula: "teorico",
    precision_e: null,
    ...(requeridas != null ? { margen: { aulas_requeridas: requeridas } } : {}),
  } as CalcMuestraAulasEstrato;
}

describe("targetsDesdeEstratos", () => {
  it("usa aulas_requeridas del margen y cae a aulas_base", {}, () => {
    const t = targetsDesdeEstratos([estrato("DERECHO", 18), estrato("ARQUITECTURA Y URBANISMO", 12, 15)]);
    expect(t).toEqual({ DERECHO: 18, "ARQUITECTURA Y URBANISMO": 15 });
  });

  it("un valor no finito NO degrada a 0: la fila se salta", () => {
    const roto = estrato("SIN DATO", Number.NaN);
    (roto as { margen?: unknown }).margen = { aulas_requeridas: null };
    const t = targetsDesdeEstratos([roto, estrato("DERECHO", 18)]);
    expect(t).toEqual({ DERECHO: 18 });
  });

  it("sin filas devuelve mapa vacío", () => {
    expect(targetsDesdeEstratos(null)).toEqual({});
  });
});

describe("conAfijacionDelEstudio", () => {
  const config = { schema: "calc_muestra_workspace_aulas_v1", selector: "cube_balanceado" } as CalcMuestraWorkspaceAulasConfig;

  it("inyecta los targets y el n total del diseño", () => {
    const out = conAfijacionDelEstudio(config, [estrato("DERECHO", 18), estrato("PSICOLOGÍA", 7)]);
    expect(out.faculty_targets).toEqual({ DERECHO: 18, "PSICOLOGÍA": 7 });
    expect(out.n_aulas).toBe(25);
  });

  it("sin estratos utilizables devuelve el MISMO config, no una copia", () => {
    expect(conAfijacionDelEstudio(config, [])).toBe(config);
    expect(conAfijacionDelEstudio(config, [estrato("X", Number.NaN)])).toBe(config);
  });
});

describe("cableado en el Desk", () => {
  const src = readFileSync(
    join(__dirname, "..", "..", "UniversidadDesk.tsx"),
    "utf8",
  );

  it("los DOS onSelectMethod pasan por la afijación y ninguno queda directo", () => {
    expect(src).toContain('from "./aulas/afijacionTargets"');
    expect(src.match(/onSelectMethod=\{onSeleccionarAulasConAfijacion\}/g)?.length).toBe(2);
    expect(src).not.toMatch(/onSelectMethod=\{onSeleccionarAulas\}/);
    expect(src).toMatch(/conAfijacionDelEstudio\(config, margenFilas\)/);
  });

  it("el wrapper no está apagado con un guard constante", () => {
    expect(src).not.toMatch(/\{\s*false\s*&&/);
  });
});
