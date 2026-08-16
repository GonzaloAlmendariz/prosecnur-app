import { describe, expect, it } from "vitest";

import { coberturaGraficos } from "./coberturaBases";
import type { SessionState } from "../../api/core";

// El caso real es `acrconta_mazo`: tres bases, `egresados` sin PPT ni Word, y
// el escalar `graficos_ppt_ok` en TRUE porque la base activa es otra.

function estado(over: Partial<SessionState> = {}): SessionState {
  return {
    graficos_ppt_ok: true,
    graficos_word_ok: false,
    bases_nombres: ["docentes", "estudiantes", "egresados"],
    graficos_bases_sin_mazo: ["egresados"],
    ...over,
  } as SessionState;
}

describe("coberturaGraficos", () => {
  it("una base sin mazo impide dar la etapa por hecha", () => {
    const c = coberturaGraficos(estado());
    expect(c.hecho).toBe(false);
    expect(c.pendientes).toEqual(["egresados"]);
    expect(c.motivo).toBe("Falta el mazo de egresados.");
  });

  it("nombra las bases, no las cuenta", () => {
    // «Faltan 2 bases» obliga a ir a buscar cuáles. El motor manda los
    // nombres; decir el número sería tirar la mitad del dato.
    const c = coberturaGraficos(estado({ graficos_bases_sin_mazo: ["egresados", "docentes"] }));
    expect(c.motivo).toBe("Faltan los mazos de egresados, docentes.");
  });

  it("con todas las bases pendientes no hay motivo que dar", () => {
    // Es el estado inicial de cualquier estudio. Un motivo ahí se leería como
    // una incidencia y no como «todavía no empezaste».
    const c = coberturaGraficos(estado({
      graficos_ppt_ok: false,
      graficos_bases_sin_mazo: ["docentes", "estudiantes", "egresados"],
    }));
    expect(c.hecho).toBe(false);
    expect(c.motivo).toBeNull();
  });

  it("sin bases pendientes manda el escalar de siempre", () => {
    expect(coberturaGraficos(estado({ graficos_bases_sin_mazo: [] })).hecho).toBe(true);
    expect(coberturaGraficos(estado({
      graficos_bases_sin_mazo: [], graficos_ppt_ok: false, graficos_word_ok: false,
    })).hecho).toBe(false);
    // Word solo también cuenta: es el criterio del riel.
    expect(coberturaGraficos(estado({
      graficos_bases_sin_mazo: [], graficos_ppt_ok: false, graficos_word_ok: true,
    })).hecho).toBe(true);
  });

  it("un .pulso sin el campo se comporta como antes", () => {
    // El control de compatibilidad: si la ausencia del campo se leyera como
    // «no falta ninguna», daría lo mismo; pero si se leyera como «faltan
    // todas», un proyecto viejo mostraría Gráficos sin hacer para siempre.
    const c = coberturaGraficos(estado({ graficos_bases_sin_mazo: undefined }));
    expect(c.hecho).toBe(true);
    expect(c.motivo).toBeNull();
  });

  it("no se cae con un payload que no es lista", () => {
    const c = coberturaGraficos(estado({ graficos_bases_sin_mazo: "egresados" as never }));
    expect(c.pendientes).toEqual([]);
    expect(c.hecho).toBe(true);
  });

  it("sin sesión no afirma nada", () => {
    expect(coberturaGraficos(null).hecho).toBe(false);
    expect(coberturaGraficos(undefined).motivo).toBeNull();
  });
});
