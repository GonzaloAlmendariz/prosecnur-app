import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { MonitoreoAulasDosTasas, MonitoreoAulasDosTasasAula } from "../../../../api/monitoreo";
import { AulasSenalesPorAula } from "./AulasSenalesPorAula";
import { ptsDeBanda, senalesPorAula, tasaEnPct } from "./senalesPorAula";

/**
 * La señal por curso-horario JUNTO a la vara de su facultad (unidad B3).
 *
 * El mandato es «señalar, no descartar»: la superficie ordena lo que pide una
 * mirada —bajo primero, luego sobre—, agrega lo conforme, y a lo que no se pudo
 * contrastar le pone su motivo en vez de esconderlo. Nada de aquí recalcula:
 * tasas, banda y señal las publica `monitoreo_aulas_dos_tasas()`.
 */

const aula = (
  codigo: string,
  senal: MonitoreoAulasDosTasasAula["senal"],
  extra: Partial<MonitoreoAulasDosTasasAula> = {},
): MonitoreoAulasDosTasasAula => ({
  codigo,
  facultad: "Ciencias",
  elegibles: 40,
  efectivas: 22,
  numerador: "plataforma",
  tasa_prevista: 0.6,
  tasa_facultad: 0.55,
  tasa_observada: 0.55,
  banda: 0.1549,
  senal,
  ...extra,
});

const bloque = (aulas: MonitoreoAulasDosTasasAula[]): MonitoreoAulasDosTasas => ({
  aulas,
  criterio: {
    numerador: "la efectiva de plataforma primero; el parte como respaldo",
    denominador: "los elegibles de la propia aula",
    banda: "2*sqrt(p*(1-p)/elegibles) con p = la prevista",
    vara_agregada: "la tasa de la facultad viaja al lado",
    senal: "conforme dentro de la banda; bajo/sobre solo fuera",
  },
});

describe("senalesPorAula agrupa sin descartar", () => {
  it("sin bloque lo declara: backend viejo no es un vacío mudo", () => {
    expect(senalesPorAula(null).estado).toBe("sin_bloque");
    expect(senalesPorAula(undefined).estado).toBe("sin_bloque");
  });

  it("con el bloque presente pero sin cursos-horario, distingue esa causa", () => {
    expect(senalesPorAula(bloque([])).estado).toBe("sin_cursos");
  });

  it("los señalados van primero: bajo, luego sobre, y el desvío mayor delante", () => {
    const res = senalesPorAula(bloque([
      aula("CH A", "conforme"),
      aula("CH B", "sobre", { tasa_observada: 0.7 }),
      aula("CH C", "bajo", { tasa_observada: 0.4 }),
      aula("CH D", "bajo", { tasa_observada: 0.55 }),
      aula("CH E", "sobre", { tasa_observada: 0.9 }),
      aula("CH F", "sin_banda", { elegibles: 3, banda: null }),
    ]));
    if (res.estado !== "medido") throw new Error(`estado inesperado: ${res.estado}`);
    // Bajo primero (el más hundido delante), después sobre (el más pasado delante).
    expect(res.senalados.map((a) => a.codigo)).toEqual(["CH C", "CH D", "CH E", "CH B"]);
    expect(res.conformes.map((a) => a.codigo)).toEqual(["CH A"]);
    expect(res.sinMedir.map((g) => g.senal)).toEqual(["sin_banda"]);
    expect(res.sinMedir[0].aulas.map((a) => a.codigo)).toEqual(["CH F"]);
  });

  it("cada grupo sin contrastar declara su motivo, y los tres motivos difieren", () => {
    const res = senalesPorAula(bloque([
      aula("CH 1", "sin_previsto", { tasa_prevista: null, banda: null }),
      aula("CH 2", "sin_datos", { efectivas: null, numerador: null, tasa_observada: null }),
      aula("CH 3", "sin_banda", { elegibles: 3, banda: null }),
    ]));
    if (res.estado !== "medido") throw new Error(`estado inesperado: ${res.estado}`);
    expect(res.senalados).toEqual([]);
    expect(res.conformes).toEqual([]);
    expect(res.sinMedir.map((g) => g.senal)).toEqual(["sin_banda", "sin_previsto", "sin_datos"]);
    const motivos = res.sinMedir.map((g) => g.motivo);
    for (const motivo of motivos) expect(motivo.length).toBeGreaterThan(10);
    expect(new Set(motivos).size).toBe(motivos.length);
  });

  it("una señal que no reconoce no se traga: viaja aparte con su nombre", () => {
    // La lista cerrada que descarta en silencio es el patrón más caro del repo.
    const res = senalesPorAula(bloque([
      aula("CH 1", "conforme"),
      aula("CH 2", "senal_futura"),
    ]));
    if (res.estado !== "medido") throw new Error(`estado inesperado: ${res.estado}`);
    expect(res.desconocidos.map((a) => a.codigo)).toEqual(["CH 2"]);
    expect(res.desconocidos[0].senal).toBe("senal_futura");
    // Y la cuenta total no pierde a nadie.
    expect(res.medidos).toBe(2);
  });
});

describe("los formatos de la superficie", () => {
  it("la banda se dice en puntos enteros, como el panel de facultad", () => {
    // 0,1549 de proporción son ±15 puntos: la misma regla que `margenError`.
    expect(ptsDeBanda(0.1549)).toBe("± 15 pts");
    expect(ptsDeBanda(null)).toBeNull();
    expect(ptsDeBanda(undefined)).toBeNull();
    // Una banda que redondea a cero no dice nada: mejor callarla que fingirla.
    expect(ptsDeBanda(0.0004)).toBeNull();
  });

  it("una tasa se enseña como porcentaje y la ausente como raya", () => {
    // Separador decimal tolerante: el runner sin ICU degrada `es-PE` a inglés.
    expect(tasaEnPct(0.55)).toMatch(/^55[.,]0 %$/);
    expect(tasaEnPct(null)).toBe("—");
    expect(tasaEnPct(Number.NaN)).toBe("—");
  });
});

describe("AulasSenalesPorAula proyecta sin veredictos", () => {
  const texto = (html: string) => html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");

  it("sin bloque pinta un vacío declarado, no revienta ni calla", () => {
    const html = renderToStaticMarkup(<AulasSenalesPorAula bloque={null} />);
    expect(html).toContain("mon-profile-muted");
    expect(html).toContain('data-qa-geometry-member="true"');
    expect(texto(html)).toContain("todavía no publica");
  });

  it("una fila señalada lleva las DOS varas: la suya y la de su facultad", () => {
    const html = renderToStaticMarkup(
      <AulasSenalesPorAula bloque={bloque([
        aula("CH C", "bajo", { tasa_observada: 0.4, tasa_facultad: 0.52 }),
        aula("CH A", "conforme"),
      ])} />,
    );
    const plano = texto(html);
    expect(plano).toContain("CH C");
    // Observada, prevista con su banda y la vara agregada, en la misma fila.
    expect(plano).toMatch(/40[.,]0 %/);
    expect(plano).toMatch(/60[.,]0 %/);
    expect(plano).toMatch(/52[.,]0 %/);
    expect(plano).toContain("± 15 pts");
    // La palabra prohibida: la señal no es un veredicto de validez.
    expect(plano.toLowerCase()).not.toContain("válida");
    expect(plano.toLowerCase()).not.toContain("no cumple");
  });

  it("el numerador de respaldo se declara en su fila, no se confunde con plataforma", () => {
    const html = renderToStaticMarkup(
      <AulasSenalesPorAula bloque={bloque([
        aula("CH P", "bajo", { numerador: "parte", tasa_observada: 0.3 }),
      ])} />,
    );
    expect(texto(html)).toContain("del parte");
  });

  it("lo conforme se agrega colapsado: es mayoría y no pide acción", () => {
    const html = renderToStaticMarkup(
      <AulasSenalesPorAula bloque={bloque([
        aula("CH A", "conforme"),
        aula("CH B", "conforme"),
        aula("CH C", "bajo", { tasa_observada: 0.4 }),
      ])} />,
    );
    expect(html).toContain("<details");
    expect(texto(html)).toContain("2 dentro de su margen");
  });

  it("con todo sin_previsto explica el hueco del diseño sin contar sobre cero", () => {
    const html = renderToStaticMarkup(
      <AulasSenalesPorAula bloque={bloque([
        aula("CH 1", "sin_previsto", { tasa_prevista: null, banda: null }),
        aula("CH 2", "sin_previsto", { tasa_prevista: null, banda: null }),
      ])} />,
    );
    const plano = texto(html);
    expect(plano).toContain("no publicó");
    // Un denominador de cero disfrazado de conteo es el vacío que diagnostica mal.
    expect(plano).not.toMatch(/\bde (los |las )?0\b/);
  });
});
