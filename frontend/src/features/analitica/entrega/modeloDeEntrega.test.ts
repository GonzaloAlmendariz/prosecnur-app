import { describe, expect, it } from "vitest";

import type { SessionState } from "../../../api/core";
import {
  causaDeLaFicha,
  cifrasDeEntrega,
  entregablesDelEstudio,
  estadoDeEntregable,
  gruposDeEntrega,
} from "./modeloDeEntrega";

const sesion = (marcas: Partial<SessionState>) => marcas as SessionState;

describe("entregables de Analítica › Entrega", () => {
  it("siguen el orden del prototipo en tres grupos y el comparativo solo con serie", () => {
    const conSerie = entregablesDelEstudio({ conComparativo: true });
    expect(conSerie.map((e) => e.id)).toEqual(["base-final", "script", "libro", "formulario", "ficha", "frecuencias", "cruces", "comparativo"]);
    expect(gruposDeEntrega(conSerie).map((g) => [g.grupo, g.entregables.length])).toEqual([["base", 2], ["documentacion", 3], ["tablas", 3]]);
    expect(entregablesDelEstudio({ conComparativo: false }).some((e) => e.id === "comparativo")).toBe(false);
  });

  it("dicen su estado solo cuando el motor publica un indicador que se apaga", () => {
    const s = sesion({ analitica_codebook_ok: true, analitica_frecuencias_ok: false });
    expect(estadoDeEntregable("libro", s)).toBe("generado");
    expect(estadoDeEntregable("frecuencias", s)).toBe("por-generar");
    // La base final y el script no tienen indicador que se apague: sin estado, no "por generar".
    expect(estadoDeEntregable("base-final", s)).toBeNull();
    expect(estadoDeEntregable("script", s)).toBeNull();
    expect(estadoDeEntregable("libro", null)).toBeNull();
  });

  it("cuentan generados y por generar sobre los que tienen estado", () => {
    const todos = entregablesDelEstudio({ conComparativo: true });
    const s = sesion({ analitica_codebook_ok: true, analitica_cruces_ok: true, analitica_ficha_tecnica_ok: false, analitica_frecuencias_ok: false });
    expect(cifrasDeEntrega(todos, s)).toEqual({ conEstado: 4, generados: 2, porGenerar: 2 });
    expect(cifrasDeEntrega(todos, null)).toEqual({ conEstado: 0, generados: 0, porGenerar: 0 });
  });

  it("la ficha dice cuántos campos faltan, con su número", () => {
    expect(causaDeLaFicha(12, 9)).toBe("Faltan 3 campos por completar");
    expect(causaDeLaFicha(12, 11)).toBe("Falta 1 campo por completar");
    expect(causaDeLaFicha(12, 12)).toBeNull();
    expect(causaDeLaFicha(null, null)).toBeNull();
  });
});
