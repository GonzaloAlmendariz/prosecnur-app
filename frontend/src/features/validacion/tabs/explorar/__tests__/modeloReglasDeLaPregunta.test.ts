import { describe, expect, it } from "vitest";
import { normalizarCatalogoCompleto } from "../../../../../api/validacionCatalogo";
import { FAMILIA_SIN_EVALUAR } from "../../../reglas/lista/modeloCatalogo";
import { estadoDeLaRegla, reglasDeLaPregunta } from "../modeloReglasDeLaPregunta";

function regla(id: string, cambios: Record<string, unknown> = {}) {
  return {
    id,
    id_motor: id,
    origen: "formulario",
    familia: "obligatoria",
    familia_nombre: "Obligatorias",
    nombre: `Regla ${id}`,
    frase: [],
    clase: "inconsistencia",
    activa: true,
    variable_revisada: "p10",
    variables: ["p10"],
    estado_evaluacion: "evaluada",
    ultima_auditoria: { n_casos: 0, n_base: 142, nivel: "caso", n_decididos: 0 },
    ...cambios,
  };
}

const CATALOGO = normalizarCatalogoCompleto({
  plan_construido: true,
  reglas: [
    regla("R_obl"),
    regla("R_salto", { familia: "salto", variable_revisada: "p10", variables: ["p10", "p8"] }),
    regla("R_otra", { variable_revisada: "p12", variables: ["p12"] }),
    regla("R_lee", { familia: "salto", variable_revisada: "p11", variables: ["p11", "p10"] }),
    regla("R_casos", { familia: "restriccion", ultima_auditoria: { n_casos: 4, n_base: 142, nivel: "caso", n_decididos: 1 } }),
  ],
});

describe("reglas sobre una pregunta", () => {
  it("entran las que leen la pregunta, por código; primero las de casos por decidir y después las que la revisan", () => {
    expect(reglasDeLaPregunta(CATALOGO, "p10").map((r) => r.id)).toEqual(["R_casos", "R_obl", "R_salto", "R_lee"]);
    expect(reglasDeLaPregunta(CATALOGO, "p99")).toEqual([]);
  });

  it("cada una dice su estado con concordancia y sin inventar ceros", () => {
    const [casos, obligatoria] = reglasDeLaPregunta(CATALOGO, "p10");
    expect(casos).toMatchObject({ estado: "3 casos por decidir", tono: "aviso", familia: "restriccion" });
    expect(obligatoria).toMatchObject({ estado: "Sin casos", tono: "listo" });
    const r = CATALOGO.reglas[0];
    expect(estadoDeLaRegla({ ...r, ultima_auditoria: null }).estado).toBe("Sin auditar");
    expect(estadoDeLaRegla({ ...r, activa: false }).estado).toBe("Desactivada");
    expect(estadoDeLaRegla({ ...r, ultima_auditoria: { ...r.ultima_auditoria!, n_casos: 1, n_decididos: 1 } }).estado).toBe("1 caso, todos decididos");
    expect(estadoDeLaRegla({ ...r, ultima_auditoria: { ...r.ultima_auditoria!, n_casos: 2, n_decididos: 0, nivel: "registro" } }).estado).toBe("2 registros por decidir");
  });

  it("una sin evaluar lleva su causa y abre en la familia Sin evaluar", () => {
    const sin = normalizarCatalogoCompleto({
      plan_construido: true,
      reglas: [regla("R_x", { estado_evaluacion: "sin_evaluar", causa: "Depende de un listado externo", ultima_auditoria: null })],
    });
    expect(reglasDeLaPregunta(sin, "p10")[0]).toMatchObject({ estado: "Depende de un listado externo", tono: "aviso", familia: FAMILIA_SIN_EVALUAR });
  });
});
