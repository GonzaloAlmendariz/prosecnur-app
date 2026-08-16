import { describe, expect, it } from "vitest";

import { describirDecisionesPreservadas } from "./LimpiezaTab";
import type { DecisionesPreservadas } from "../types";

const VACIO: DecisionesPreservadas = {
  n: 0, n_casos: 0, n_sin_evaluar: 0, n_sin_regla: 0, n_sin_variable: 0, n_sin_instrumento: 0,
};

describe("describirDecisionesPreservadas", () => {
  it("calla cuando no hay nada en cuarentena", () => {
    expect(describirDecisionesPreservadas(undefined)).toBeNull();
    expect(describirDecisionesPreservadas(VACIO)).toBeNull();
    // Un payload viejo sin la clave no debe inventar un aviso.
    expect(describirDecisionesPreservadas({ ...VACIO, n: NaN } as never)).toBeNull();
  });

  it("esperar la auditoría es buena noticia, no una alerta", () => {
    const r = describirDecisionesPreservadas({ ...VACIO, n: 2, n_casos: 3, n_sin_evaluar: 2 });
    expect(r?.tone).toBe("success");
    expect(r?.texto).toContain("2 decisiones");
    expect(r?.texto).toContain("3 casos");
    expect(r?.texto).toContain("auditoría");
  });

  it("quedarse sin la variable es una pérdida y se dice como tal", () => {
    const r = describirDecisionesPreservadas({
      ...VACIO, n: 3, n_casos: 5, n_sin_regla: 1, n_sin_variable: 2,
    });
    expect(r?.tone).toBe("warn");
    expect(r?.texto).toContain("1 sin su regla");
    expect(r?.texto).toContain("2 sin su variable");
    // El control: no puede sonar a que basta con esperar.
    expect(r?.texto).not.toContain("Vuelven a la cola");
    expect(r?.texto).toContain("no se aplican");
  });

  it("no enumera motivos en cero", () => {
    const r = describirDecisionesPreservadas({ ...VACIO, n: 1, n_casos: 1, n_sin_variable: 1 });
    expect(r?.texto).toContain("1 sin su variable");
    expect(r?.texto).not.toContain("sin su regla");
    expect(r?.texto).not.toContain("formulario");
  });

  it("distingue no poder leer el formulario de que la variable no esté", () => {
    const r = describirDecisionesPreservadas({ ...VACIO, n: 1, n_casos: 1, n_sin_instrumento: 1 });
    expect(r?.texto).toContain("sin poder leer el formulario");
    expect(r?.texto).not.toContain("sin su variable");
  });

  it("concuerda en singular", () => {
    const r = describirDecisionesPreservadas({ ...VACIO, n: 1, n_casos: 1, n_sin_evaluar: 1 });
    expect(r?.texto).toContain("1 decisión ");
    expect(r?.texto).toContain("(1 caso)");
    expect(r?.texto).not.toContain("decisiones");
  });
});
