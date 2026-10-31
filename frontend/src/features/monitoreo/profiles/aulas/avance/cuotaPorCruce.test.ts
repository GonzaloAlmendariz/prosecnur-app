import { describe, expect, it } from "vitest";

import type { MonitoreoAulasDashboard } from "../../../../../api/monitoreo";
import { construirPorFacultad } from "./porFacultadModelo";

// ADR 0121, F3: un estudio de UNA facultad cuya cuota es nivel × sexo. Antes del
// ADR el motor no podía expresarla y la pestaña mostraba sólo el nivel.
const nivelPorSexo = {
  avance_cuota: {
    eje: { clave: "nivel", columna: "level", etiqueta: "Nivel", etiqueta_plural: "Niveles", etiqueta_sin: "Sin nivel",
      atribucion: "persona", fuente_valor: "padron", motivo: "" },
    facultades: [],
    total: {},
    celdas_declaradas: {
      schema: "avance_por_celdas_v1",
      variables: ["nivel", "sexo"],
      celdas: [
        { valores: { nivel: "9", sexo: "F" }, cuota: 30, logradas: 25, brecha: 5 },
        { valores: { nivel: "9", sexo: "M" }, cuota: 32, logradas: 40, brecha: 0 },
        { valores: { nivel: "6", sexo: "F" }, cuota: 60, logradas: 61, brecha: 0 },
        { valores: { nivel: "6", sexo: "M" }, cuota: 59, logradas: 59, brecha: 0 },
      ],
      marginales: {}, total: { cuota: 181, logradas: 185, brecha: 5 }, fuera_de_celdas: 0, sin_valor: {},
    },
  },
  representatividad_declarada: {
    schema: "representatividad_v1", origen: "diseno",
    universo: { nivel: "facultad", valor: "CIENCIAS SOCIALES", etiqueta: "Ciencias Sociales" },
    variables: [
      { clave: "nivel", etiqueta: "Nivel", etiqueta_plural: "Niveles", etiqueta_sin: "Sin nivel", atribucion: "persona", fuente_valor: "padron", categorias: [] },
      { clave: "sexo", etiqueta: "Sexo", etiqueta_plural: "Sexos", etiqueta_sin: "Sin sexo", atribucion: "respuesta", fuente_valor: "respuesta", categorias: [] },
    ],
    celdas: [],
  },
} as unknown as MonitoreoAulasDashboard;

describe("Por nivel con cuota nivel × sexo (ADR 0121)", () => {
  it("cruza por la segunda variable declarada y no compensa entre celdas", () => {
    const m = construirPorFacultad(nivelPorSexo);
    expect(m.rotulo).toBe("Por nivel");
    if (m.cuota.tipo !== "sexo") throw new Error(`esperaba el cruce, llegó ${m.cuota.tipo}`);
    expect(m.cuota.titulo).toBe("Cuota por nivel y sexo");
    expect(m.cuota.segunda).toBe("Sexo");
    // Primero el nivel al que le falta algo: el 9, aunque sume más de lo pedido.
    expect(m.cuota.grupos.map((g) => g.nombre)).toEqual(["Nivel 9", "Nivel 6"]);
    const nueve = m.cuota.grupos[0].filas;
    expect(nueve.map((f) => [f.sexo, f.lectura])).toEqual([["Mujeres", "Faltan 5"], ["Hombres", "Cumplida"]]);
    expect(m.cuota.sub).toBe("4 celdas; 3 ya cumplen");
  });

  it("con el eje por persona, el lateral es el del padrón y no el operativo del plan", () => {
    expect(construirPorFacultad(nivelPorSexo).lateral.tipo).toBe("alcance");
  });
});
