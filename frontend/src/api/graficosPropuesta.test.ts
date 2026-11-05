// La propuesta del motor (H13): el normalizador acepta la respuesta real de /api/graficos/resumenes/propuesta y no se
// rompe con lo que R manda en caja, suelto o vacío.
import { describe, expect, it } from "vitest";
import { normalizarPropuestaResumen } from "./graficosPropuesta";

// Recortes de la respuesta real del proyecto CCSS (láminas ccss-hallazgos-1 y ccss-resumen).
const HALLAZGOS = {
  ok: true, tipo: "p_slide_hallazgos", slide_id: "ccss-hallazgos-1", modo: "resumen", base: "default",
  capitulos: [
    { titulo: "Personas responsables de la crianza", cifras: [
      { var: "educ_padre", fila: "Posgrado", comparacion: "auto", pregunta: "Nivel educativo del padre", frase: "respondió «Posgrado»",
        cifra: "23%", n: 301, diferencia: "Hombre 32% △ frente al 15% del resto", diferencia_estado: "diferencia" },
    ] },
    { titulo: "Vida universitaria", cifras: [
      { var: "B8_1_1", top2box: ["Todos los días, en momentos puntuales", "Todos los días, a lo largo del día"], comparacion: "auto",
        pregunta: "WhatsApp", frase: "respondió «Todos los días…»", cifra: "98%", n: 400,
        diferencia: "Sin diferencias por área, nivel, sexo ni estudios de padres", diferencia_estado: "sin_diferencias" },
      { var: "B3_recod", fila: "Académica", texto: "participa en una agrupación académica", comparacion: "auto", pregunta: "¿Perteneces?",
        frase: "participa en una agrupación académica", cifra: "29%", n: 400, diferencia: "Ciencias políticas y sociales 44% ▲ frente al 17% del resto",
        diferencia_estado: "diferencia" },
    ] },
  ],
  avisos: ["Hallazgos clave: la cifra de «educ_padre» no tiene texto: se usó «respondió «Posgrado»». Escribe lo que mide."],
};

const RESUMEN = {
  ok: true, tipo: "p_slide_resumen_diferencias", slide_id: "ccss-resumen", base: "default",
  capitulos: [{ titulo: "Personas responsables de la crianza", filas: [
    { var: "educ_padre", fila: "Posgrado", rotulo: "Nivel educativo del padre: Posgrado", pregunta: "Nivel educativo del padre",
      rotulo_lamina: "Nivel educativo del padre: Posgrado (base: 301)", cifra: "23%", n: 301,
      diferencia: "Hombre 32% △ frente al 15% del resto", diferencia_estado: "diferencia" },
  ] }],
  // R manda la lista vacía como objeto.
  avisos: {},
};

describe("normalizarPropuestaResumen", () => {
  it("lee el resumen ejecutivo real: capítulos, cifras, sólo lectura y avisos", () => {
    const p = normalizarPropuestaResumen(HALLAZGOS);
    expect(p.tipo).toBe("p_slide_hallazgos");
    if (p.tipo !== "p_slide_hallazgos") return;
    expect(p.slideId).toBe("ccss-hallazgos-1");
    expect(p.modo).toBe("resumen");
    expect(p.capitulos.map((c) => c.cifras.length)).toEqual([1, 2]);
    const [h] = p.capitulos[0].cifras;
    expect(h).toMatchObject({ var: "educ_padre", fila: "Posgrado", texto: "", frase: "respondió «Posgrado»", cifra: "23%", n: 301,
      diferenciaEstado: "diferencia", comparacion: "auto" });
    expect(p.capitulos[1].cifras[0].top2box).toHaveLength(2);
    expect(p.avisos).toHaveLength(1);
  });

  it("lee el resumen de diferencias real y una lista de avisos vacía como objeto", () => {
    const p = normalizarPropuestaResumen(RESUMEN);
    expect(p.tipo).toBe("p_slide_resumen_diferencias");
    if (p.tipo !== "p_slide_resumen_diferencias") return;
    expect(p.avisos).toEqual([]);
    expect(p.capitulos[0].filas[0]).toMatchObject({ rotulo: "Nivel educativo del padre: Posgrado",
      rotuloLamina: "Nivel educativo del padre: Posgrado (base: 301)", n: 301 });
  });

  it("acepta valores en caja o sueltos y descarta lo que no se puede llevar al editor", () => {
    const p = normalizarPropuestaResumen({
      tipo: ["p_slide_hallazgos"], modo: ["titulares"],
      capitulos: { titulo: "Suelto", cifras: [
        { var: ["P1"], fila: ["Sí"], n: [12], cifra: ["40%"], diferencia_estado: "rara" },
        { var: "P2" },                   // sin respuesta que contar
        { fila: "Sí" },                  // sin pregunta
        "no es un objeto",
        { var: "P3", top2box: "De acuerdo", n: "NA" },
      ] },
      avisos: "uno solo",
    });
    if (p.tipo !== "p_slide_hallazgos") throw new Error("tipo");
    expect(p.modo).toBe("titulares");
    expect(p.capitulos).toHaveLength(1);
    expect(p.capitulos[0].cifras.map((h) => h.var)).toEqual(["P1", "P3"]);
    expect(p.capitulos[0].cifras[0]).toMatchObject({ fila: "Sí", n: 12, diferenciaEstado: "sin_prueba" });
    expect(p.capitulos[0].cifras[1]).toMatchObject({ top2box: ["De acuerdo"], n: null });
    expect(p.avisos).toEqual(["uno solo"]);
  });

  it("una respuesta vacía o rota es una propuesta sin capítulos", () => {
    for (const raw of [null, undefined, "x", [], { capitulos: null }, { tipo: "p_slide_resumen_diferencias", capitulos: [{ titulo: "Vacío", filas: [] }] }]) {
      expect(normalizarPropuestaResumen(raw).capitulos).toEqual([]);
    }
  });
});
