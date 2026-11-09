// Ficha «Datos»: el cruce del `usa` de cada gráfico con el inventario del estudio (alcanza o qué falta, por tipo).
import { describe, expect, it } from "vitest";
import type { InventarioPublico } from "../../../../api/graficosInventario";
import {
  cruzarConEstudio, filasQueDifieren, fraseTipos, informeParaCierre, laminasDeResumen, usaDeGrafico, usaDeTarjeta,
} from "./fichaDatos";
import { tarjetaContar } from "./intencionesContar";

const publico = (base: string, n: number, p: Partial<InventarioPublico["preguntas"]>, padron?: number): InventarioPublico => ({
  base, publico: base, n,
  preguntas: { escala: 0, opcion_unica: 0, multiple: 0, numerica: 0, abierta: 0, ...p },
  padron: padron ? { declarado: true, valor: padron, origen: "Cálculo de muestra", motivo: "" } : { declarado: false, valor: null, origen: "", motivo: "" },
});

// Arte: docentes 115/73 escala, estudiantes 279/60, administrativos 85/24, sin padrón.
const ARTE = [
  publico("Docentes", 115, { escala: 73, opcion_unica: 5 }),
  publico("Estudiantes", 279, { escala: 60, multiple: 2 }),
  publico("Administrativos", 85, { escala: 24 }),
];

describe("usaDeGrafico", () => {
  it("lee el `usa` del catálogo y devuelve null sin gráfico o si no lo conoce", () => {
    expect(usaDeGrafico("p_panorama")).toEqual({ pregunta: ["escala"], publicos: "uno_o_varios", padron: false, cruce: false });
    expect(usaDeGrafico(null)).toBeNull();
    expect(usaDeGrafico("p_inexistente")).toBeNull();
  });
});

describe("cruzarConEstudio", () => {
  it("el panorama alcanza en Arte y dice cuántas preguntas de escala tiene cada público", () => {
    const c = cruzarConEstudio(usaDeGrafico("p_panorama")!, ARTE);
    expect(c.alcanza).toBe(true);
    expect(c.faltas).toEqual([]);
    expect(c.resumen).toBe("73 preguntas de escala en Docentes, 60 en Estudiantes, 24 en Administrativos");
    expect(c.publicos.map((p) => [p.base, p.n, p.preguntas])).toEqual([
      ["Docentes", 115, 73], ["Estudiantes", 279, 60], ["Administrativos", 85, 24],
    ]);
  });

  it("suma los tipos que acepta el gráfico (escala o múltiple en el radar)", () => {
    const c = cruzarConEstudio(usaDeGrafico("p_radar")!, ARTE);
    expect(c.resumen).toBe("73 preguntas de escala o de opción múltiple en Docentes, 62 en Estudiantes, 24 en Administrativos");
  });

  it("un gráfico de varios públicos con uno solo que tiene ese tipo dice qué falta", () => {
    // ADR 0137 fase 2: ningún graficador del catálogo pide «varios» por sí solo; el `usa` va escrito.
    const c = cruzarConEstudio({ pregunta: ["opcion_unica"], publicos: "varios", padron: false, cruce: false }, ARTE);
    expect(c.alcanza).toBe(false);
    expect(c.faltas).toEqual(["Usa dos públicos o más y solo Docentes tiene preguntas de opción única."]);
    expect(c.resumen).toBe("5 preguntas de opción única en Docentes");
  });

  it("sin preguntas de ese tipo en ningún público lo dice en una línea", () => {
    const c = cruzarConEstudio(usaDeGrafico("p_nube_palabras")!, ARTE);
    expect(c.faltas).toEqual(["Ningún público tiene preguntas abiertas."]);
    expect(c.resumen).toBe("");
  });

  it("la cobertura pide padrón: sin ninguno declarado, o los públicos que faltan", () => {
    const usa = usaDeGrafico("p_cobertura")!;
    expect(cruzarConEstudio(usa, ARTE).faltas).toEqual(["Usa padrón y ningún público lo tiene declarado."]);
    const conUno = [publico("Docentes", 115, { escala: 73 }, 400), ...ARTE.slice(1)];
    expect(cruzarConEstudio(usa, conUno).faltas).toEqual(["Falta el padrón de Estudiantes y Administrativos."]);
    expect(cruzarConEstudio(usa, conUno).resumen).toBe("73 preguntas en Docentes, 62 en Estudiantes, 24 en Administrativos");
  });

  it("sin bases cargadas", () => {
    expect(cruzarConEstudio(usaDeGrafico("p_panorama")!, []).faltas).toEqual(["El estudio no tiene bases cargadas."]);
  });
});

describe("fraseTipos", () => {
  it("«cualquiera» no nombra tipo", () => {
    expect(fraseTipos(["cualquiera"])).toBe("");
    expect(fraseTipos(["numerica"])).toBe("numéricas");
  });
});

describe("usaDeTarjeta (S1)", () => {
  it("el `usa` de la tarjeta manda: el contraste pide varios públicos", () => {
    expect(usaDeGrafico("p_dumbbell")?.publicos).not.toBe("varios");
    expect(usaDeTarjeta(tarjetaContar("p_slide_1_grafico:contraste"))?.publicos).toBe("varios");
    // Sin `usa` propio, el del graficador.
    expect(usaDeTarjeta(tarjetaContar("p_slide_1_grafico:panorama"))).toEqual(usaDeGrafico("p_panorama"));
    expect(usaDeTarjeta(tarjetaContar("p_slide_cierre_hallazgos:cierre"))).toBeNull();
  });

  it("con un solo público lo dice en una línea; no bloquea (la tarjeta sigue ofrecida)", () => {
    const usa = usaDeTarjeta(tarjetaContar("p_slide_1_grafico:contraste"))!;
    const c = cruzarConEstudio(usa, [publico("contadores", 300, { escala: 40 })]);
    expect(c.faltas).toEqual(["El estudio tiene un solo público."]);
    expect(c.resumen).toBe("40 preguntas de escala en Contadores");
  });
});

describe("cruzarConEstudio: rótulos de públicos (S7)", () => {
  it("capitaliza el público como el motor", () => {
    const c = cruzarConEstudio(usaDeGrafico("p_panorama")!, [publico("docentes", 10, { escala: 3 }), publico("estudiantes", 20, { escala: 4 })]);
    expect(c.publicos.map((p) => p.publico)).toEqual(["Docentes", "Estudiantes"]);
    expect(c.resumen).toBe("3 preguntas de escala en Docentes, 4 en Estudiantes");
  });
});

describe("filasQueDifieren (S6)", () => {
  it("marca las filas que no dicen lo mismo en las dos fichas", () => {
    const listo = { estado: "listo" as const, publicos: ARTE };
    expect([...filasQueDifieren(usaDeGrafico("p_panorama"), usaDeGrafico("p_panorama"), listo)]).toEqual([]);
    expect([...filasQueDifieren(usaDeGrafico("p_panorama"), usaDeGrafico("p_cobertura"), listo)]).toEqual(["preguntas", "publicos", "estudio"]);
    expect([...filasQueDifieren(usaDeGrafico("p_panorama"), null, listo)]).toEqual([]);
  });
});

describe("cierre con hallazgos (S8)", () => {
  it("cuenta las láminas de resumen del informe sin los cierres", () => {
    const slides = [
      { tipo: "p_slide_1_grafico" as const, payload: { grafico: { graficador: "p_panorama", args: {} } } },
      { tipo: "p_slide_1_grafico" as const, payload: { grafico: { graficador: "p_pie", args: {} } } },
      { tipo: "p_slide_cierre_hallazgos" as const, payload: {} },
    ];
    expect(laminasDeResumen(slides)).toBe(1);
    expect(informeParaCierre(1)).toEqual({ resumen: "El informe tiene 1 lámina de resumen.", falta: null });
    expect(informeParaCierre(0)).toEqual({ resumen: "", falta: "El informe no tiene láminas de resumen." });
  });
});
