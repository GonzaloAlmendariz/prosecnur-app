// La propuesta como lista para elegir (H13): qué se ve, qué queda y qué llega al editor.
import { describe, expect, it } from "vitest";
import { normalizarPropuestaResumen } from "../../../../api/graficosPropuesta";
import { leerCapitulos, escribirCapitulos } from "../hallazgos/modeloCapitulosHallazgos";
import {
  alternar,
  avisoNadaMarcado,
  avisosPropuesta,
  capitulosDesdePropuesta,
  combinarCapitulos,
  conteoQuedan,
  cuantosQuedan,
  escritosQueSalen,
  firmaLamina,
  losElementos,
  todosMarcados,
  totalElementos,
  vistaPropuesta,
} from "./modeloPropuesta";

const hallazgos = normalizarPropuestaResumen({
  tipo: "p_slide_hallazgos", modo: "resumen",
  capitulos: [
    { titulo: "Crianza", cifras: [
      { var: "educ_padre", fila: "Posgrado", comparacion: "auto", pregunta: "Nivel educativo del padre", frase: "respondió «Posgrado»",
        cifra: "23%", n: 301, diferencia: "Hombre 32% △ frente al 15% del resto", diferencia_estado: "diferencia" },
      { var: "educ_padre", fila: "Universitaria", comparacion: "auto", pregunta: "Nivel educativo del padre", frase: "respondió «Universitaria»",
        cifra: "40%", n: 301, diferencia: "Sin diferencias por área, nivel ni sexo", diferencia_estado: "sin_diferencias" },
    ] },
    { titulo: "Vida universitaria", cifras: [
      { var: "B3_recod", fila: "Académica", texto: "participa en una agrupación académica", comparacion: "auto", pregunta: "¿Perteneces?",
        frase: "participa en una agrupación académica", cifra: "29%", n: 400, diferencia: "CC. PP. 44% ▲ frente al 17% del resto",
        diferencia_estado: "diferencia" },
      { var: "B8_1_1", top2box: ["Todos los días", "A lo largo del día"], comparacion: "auto", pregunta: "WhatsApp",
        frase: "respondió «Todos los días + A lo largo del día»", cifra: "98%", n: 400, diferencia: "Sin diferencias", diferencia_estado: "sin_diferencias" },
    ] },
  ],
  avisos: [
    "Hallazgos clave: la cifra de «educ_padre» no tiene texto: se usó «respondió «Posgrado»». Escribe lo que mide.",
    "Hallazgos clave: la cifra de «educ_padre» no tiene texto: se usó «respondió «Universitaria»». Escribe lo que mide.",
    "Hallazgos clave: el cruce «sexo» tiene grupos de menos de 30 casos.",
  ],
});

const resumen = normalizarPropuestaResumen({
  tipo: "p_slide_resumen_diferencias",
  capitulos: [{ titulo: "Crianza", filas: [
    { var: "educ_padre", fila: "Posgrado", rotulo: "Padre con posgrado", pregunta: "Nivel educativo del padre",
      rotulo_lamina: "Padre con posgrado (base: 301)", cifra: "23%", n: 301, diferencia: "Hombre 32% △ frente al 15% del resto", diferencia_estado: "diferencia" },
    { var: "B8_2_4", top2box: ["Todos los días"], rotulo: "Claude", pregunta: "Claude", rotulo_lamina: "Claude", cifra: "37%", n: 400,
      diferencia: "Economía 48% ▲ frente al 23% del resto", diferencia_estado: "diferencia" },
  ] }],
  avisos: [],
});

const SOLO_LECTURA = ["pregunta", "frase", "cifra", "n", "diferencia", "diferencia_estado", "rotulo_lamina", "diferenciaEstado", "rotuloLamina"];

describe("vista de la propuesta", () => {
  it("unifica hallazgos y filas en elementos con pregunta, cifra, frase y diferencia", () => {
    const v = vistaPropuesta(hallazgos);
    expect(v.map((c) => c.titulo)).toEqual(["Crianza", "Vida universitaria"]);
    expect(v[0].elementos[0]).toMatchObject({ clave: "c0e0", pregunta: "Nivel educativo del padre", cifra: "23%", frase: "respondió «Posgrado»",
      estado: "diferencia", sinTexto: true });
    expect(v[1].elementos[0].sinTexto).toBe(false);
    expect(vistaPropuesta(resumen)[0].elementos[0]).toMatchObject({ frase: "Padre con posgrado (base: 301)", sinTexto: false });
  });

  it("al cargar todo queda marcado; desmarcar cuenta", () => {
    const m = todosMarcados(hallazgos);
    expect(totalElementos(hallazgos)).toBe(4);
    expect(cuantosQuedan(hallazgos, m)).toBe(4);
    const menos = alternar(alternar(m, "c0e1"), "c1e1");
    expect(cuantosQuedan(hallazgos, menos)).toBe(2);
    expect(alternar(menos, "c0e1").has("c0e1")).toBe(true);
    expect(conteoQuedan(2, 4)).toBe("2 de 4 quedan");
    expect(conteoQuedan(1, 4)).toBe("1 de 4 queda");
    expect(losElementos("p_slide_resumen_diferencias")).toBe("las filas");
    expect(avisoNadaMarcado("p_slide_resumen_diferencias")).toBe("No marcaste ninguna fila. Marca al menos una para editarla.");
  });
});

describe("de la propuesta al editor", () => {
  it("lleva lo marcado sin campos de sólo lectura y con la frase como texto si no tenía", () => {
    const caps = capitulosDesdePropuesta(hallazgos, new Set(["c0e0", "c1e1"]));
    expect(caps).toEqual([
      { titulo: "Crianza", cifras: [{ var: "educ_padre", fila: "Posgrado", texto: "respondió «Posgrado»", comparacion: "auto" }] },
      { titulo: "Vida universitaria", cifras: [{ var: "B8_1_1", top2box: ["Todos los días", "A lo largo del día"],
        texto: "respondió «Todos los días + A lo largo del día»", comparacion: "auto" }] },
    ]);
    for (const c of caps) for (const h of c.cifras as Record<string, unknown>[]) for (const k of SOLO_LECTURA) expect(h).not.toHaveProperty(k);
    // Lo traído es completo para el editor: nada se cae al guardarlo.
    expect(escribirCapitulos(leerCapitulos(caps))).toEqual(caps);
  });

  it("con varias bases, la pregunta va calificada con la base de la que leyó el motor", () => {
    const conBase = normalizarPropuestaResumen({ tipo: "p_slide_resumen_diferencias", base: "default",
      capitulos: [{ titulo: "X", filas: [{ var: "P1", fila: "Sí", rotulo: "Sí" }, { var: "otra$P2", fila: "No", rotulo: "No" }] }] });
    const todos = todosMarcados(conBase);
    expect((capitulosDesdePropuesta(conBase, todos, true)[0].filas as { var: string }[]).map((f) => f.var)).toEqual(["default$P1", "otra$P2"]);
    expect((capitulosDesdePropuesta(conBase, todos)[0].filas as { var: string }[]).map((f) => f.var)).toEqual(["P1", "otra$P2"]);
  });

  it("un capítulo sin nada marcado no va; nada marcado es una lista vacía", () => {
    expect(capitulosDesdePropuesta(hallazgos, new Set(["c1e0"])).map((c) => c.titulo)).toEqual(["Vida universitaria"]);
    expect(capitulosDesdePropuesta(hallazgos, new Set())).toEqual([]);
  });

  it("las filas del resumen de diferencias llevan su rótulo, no el de la lámina", () => {
    const caps = capitulosDesdePropuesta(resumen, todosMarcados(resumen));
    expect(caps).toEqual([{ titulo: "Crianza", filas: [
      { var: "educ_padre", fila: "Posgrado", rotulo: "Padre con posgrado" },
      { var: "B8_2_4", top2box: ["Todos los días"], rotulo: "Claude" },
    ] }]);
    expect(escritosQueSalen("p_slide_resumen_diferencias", caps)).toEqual(caps);
  });

  it("reemplazar o agregar a lo escrito", () => {
    const escritos = [{ titulo: "Mío", cifras: [{ var: "P1", fila: "Sí", texto: "dice que sí", comparacion: "ninguna" }] }];
    const traidos = capitulosDesdePropuesta(hallazgos, new Set(["c0e0"]));
    expect(combinarCapitulos(escritos, traidos, "reemplazar")).toEqual(traidos);
    expect(combinarCapitulos(escritos, traidos, "agregar").map((c) => c.titulo)).toEqual(["Mío", "Crianza"]);
    expect(escritosQueSalen("p_slide_hallazgos", escritos)).toHaveLength(1);
    expect(escritosQueSalen("p_slide_hallazgos", [{ titulo: "Incompleto", cifras: [{ var: "" }] }])).toEqual([]);
  });
});

describe("avisos y firma", () => {
  it("los «no tiene texto» se dicen en uno, con cuántos; los demás sin el nombre de la lámina", () => {
    expect(avisosPropuesta(hallazgos)).toEqual([
      '3 hallazgos no tienen texto propio. La lámina dice "respondió…" hasta que los escribas.',
      "El cruce «sexo» tiene grupos de menos de 30 casos.",
    ]);
    expect(avisosPropuesta(resumen)).toEqual([]);
  });

  it("la firma cambia con lo que decide la propuesta, no con lo escrito ni los textos", () => {
    const base = { id: "s1", tipo: "p_slide_hallazgos", payload: { modo: "resumen", cruces: ["sexo"], seleccion: "auto", titulo: "A" } };
    const f = firmaLamina(base);
    expect(firmaLamina({ ...base, payload: { ...base.payload, titulo: "B", seleccion: "manual", capitulos: [{ titulo: "x" }] } })).toBe(f);
    expect(firmaLamina({ ...base, payload: { titulo: "A", seleccion: "auto", cruces: ["sexo"], modo: "resumen" } })).toBe(f);
    expect(firmaLamina({ ...base, payload: { ...base.payload, cruces: ["area"] } })).not.toBe(f);
  });
});
