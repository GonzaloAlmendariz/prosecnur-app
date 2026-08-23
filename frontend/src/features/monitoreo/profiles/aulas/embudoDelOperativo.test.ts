// «Enorme diferencia si la comparamos con Cálculo de cursos-horario» —Gonzalo.
//
// Cálculo tiene un mapa del recorrido que va de las filas leídas a los titulares
// con la merma en cada arista, y contesta «¿de dónde salió este número?» sin
// salir de la pantalla. Monitoreo enseñaba KPIs sueltos sin decir cómo se
// encadenan.
import { describe, expect, it } from "vitest";
import { embudoDelOperativo } from "./embudoDelOperativo";

describe("embudoDelOperativo", () => {
  it("encadena el plan con lo aplicado y declara lo que falta", () => {
    const e = embudoDelOperativo({ aulas_titulares: 193, aulas_aplicadas: 40 });
    expect(e.map((x) => x.id)).toEqual(["plan", "aplicadas"]);
    expect(e[0].valor).toBe("193");
    // La merma es lo que separa un paso del siguiente, dicho sin acusar.
    expect(e[0].merma).toEqual({ n: 153, label: "sin aplicar todavía" });
  });

  it("sin plan no dibuja un embudo de ceros", () => {
    // Un embudo vacío ocupa el sitio de un vacío que sí podría decir qué falta.
    expect(embudoDelOperativo({ aulas_aplicadas: 0 })).toEqual([]);
    expect(embudoDelOperativo(null)).toEqual([]);
  });

  it("las respuestas sólo entran cuando la plataforma trajo algo", () => {
    // Sin fuentes conectadas, dos escalones en cero dirían que se perdió todo.
    const sin = embudoDelOperativo({ aulas_titulares: 193, aulas_aplicadas: 40 });
    expect(sin.map((x) => x.id)).not.toContain("recibidas");

    const con = embudoDelOperativo({
      aulas_titulares: 193, aulas_aplicadas: 40,
      respuestas_total: 900, respuestas_validas: 860, filter_rejected: 40,
    });
    expect(con.map((x) => x.id)).toEqual(["plan", "aplicadas", "recibidas", "validas"]);
    expect(con[2].merma).toEqual({ n: 40, label: "descartadas por el filtro" });
  });

  it("los reemplazos activados se declaran en la procedencia del plan", () => {
    // Es la cifra que explica por qué el plan de hoy no es el sorteo de ayer.
    const e = embudoDelOperativo({
      aulas_titulares: 193, aulas_aplicadas: 12, reemplazos_usados: 7,
    });
    expect(e[0].detalle).toContain("7 con reemplazo activado");
  });

  it("sin reemplazos no inventa la frase", () => {
    const e = embudoDelOperativo({ aulas_titulares: 193, aulas_aplicadas: 12 });
    expect(e[0].detalle).toBe("titulares sorteados");
  });

  it("un plan cerrado no declara merma", () => {
    const e = embudoDelOperativo({ aulas_titulares: 50, aulas_aplicadas: 50 });
    expect(e[0].merma).toBeUndefined();
  });

  it("las cifras rotas no ensucian el embudo", () => {
    const e = embudoDelOperativo({
      aulas_titulares: 10, aulas_aplicadas: -3 as unknown as number,
      respuestas_total: Number.NaN as unknown as number,
    });
    expect(e[1].valor).toBe("0");
    expect(e.map((x) => x.id)).not.toContain("recibidas");
  });
});
