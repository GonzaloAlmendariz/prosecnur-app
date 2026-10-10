// Contrato del sistema de íconos por tipo (F6.1b, plan F6 §6). Falla si:
// - falta o sobra un ícono respecto del registro (api/inst/catalogos/graficos_tipos.json, generado desde
//   api/R/graficos_metadata.R);
// - las ranuras generadas se desviaron del estándar (api/inst/estandar/estandar_pulso.json);
// - dos íconos de la misma clase dibujan lo mismo;
// - aparece un color fuera de regla o más de un acento;
// - un rasgo mide menos de 1,5 unidades.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { normalizarRanuras, RASGO_MINIMO, TONO } from "./geometriaLamina";
import { IconoTipo, tieneIcono, type ClaseIcono } from "./IconoTipo";
import { ALIAS_GRAFICO, GRAFICOS_RETIRADOS, ICONOS_GRAFICO, PRESET_DICOTOMICA } from "./iconosGrafico";
import { ALIAS_LAMINA, ICONOS_LAMINA } from "./iconosLamina";
import { RANURAS_ESTANDAR } from "./ranurasEstandar.generated";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../..");
const leer = <T,>(rel: string): T => JSON.parse(fs.readFileSync(path.join(RAIZ, rel), "utf8")) as T;

type Catalogo = {
  slides: Array<{ name: string; estandar: string | null }>;
  graficadores: Array<{ name: string; en_selector: boolean }>;
};
type Estandar = {
  ppt: { tipos_lamina: Array<{ id: string; nombre: string; ranuras: Array<Record<string, unknown>> }> };
};

const catalogo = leer<Catalogo>("api/inst/catalogos/graficos_tipos.json");
const estandar = leer<Estandar>("api/inst/estandar/estandar_pulso.json");
const slides = catalogo.slides.map((s) => s.name);
const graficadores = catalogo.graficadores.map((g) => g.name);

const pintar = (clase: ClaseIcono, tipo: string, ranuraActiva?: number): string =>
  renderToStaticMarkup(createElement(IconoTipo, { clase, tipo, size: 24, ranuraActiva }));
const dibujo = (markup: string): string =>
  markup.replace(/^<svg[^>]*>/, "").replace(/<\/svg>$/, "");

describe("cobertura frente al registro", () => {
  it("cada tipo de lámina del registro tiene ícono (propio o derivado)", () => {
    expect(slides.filter((s) => !tieneIcono("lamina", s))).toEqual([]);
  });

  it("cada graficador del registro tiene ícono, salvo los retirados del selector", () => {
    const sinIcono = graficadores.filter((g) => !tieneIcono("grafico", g));
    expect(sinIcono).toEqual([...GRAFICOS_RETIRADOS]);
    const retiradosEnSelector = catalogo.graficadores.filter((g) => GRAFICOS_RETIRADOS.has(g.name) && g.en_selector);
    expect(retiradosEnSelector).toEqual([]);
  });

  it("no sobra ningún ícono: todo lo dibujado existe en el registro (o es el preset dicotómica)", () => {
    const laminas = [...Object.keys(ICONOS_LAMINA), ...Object.keys(ALIAS_LAMINA)];
    expect(laminas.filter((t) => !slides.includes(t))).toEqual([]);
    const graficos = [...Object.keys(ICONOS_GRAFICO), ...Object.keys(ALIAS_GRAFICO)];
    expect(graficos.filter((t) => !graficadores.includes(t) && t !== PRESET_DICOTOMICA)).toEqual([]);
    expect(Object.values(ALIAS_LAMINA).every((b) => b in ICONOS_LAMINA)).toBe(true);
    expect(Object.values(ALIAS_GRAFICO).every((b) => b in ICONOS_GRAFICO)).toBe(true);
  });

  it("55 íconos dibujados: 22 del recetario + 8 de estructura + 25 gráficos", () => {
    const delEstandar = Object.keys(ICONOS_LAMINA).filter((t) => t in RANURAS_ESTANDAR);
    expect(delEstandar).toHaveLength(22);
    expect(Object.keys(ICONOS_LAMINA).length - delEstandar.length).toBe(8);
    expect(Object.keys(ICONOS_GRAFICO)).toHaveLength(25);
    expect(Object.keys(ALIAS_LAMINA)).toHaveLength(3);
  });
});

describe("ranuras generadas frente al estándar", () => {
  it("coinciden tipo por tipo con ppt.tipos_lamina", () => {
    const esperado = Object.fromEntries(estandar.ppt.tipos_lamina.map((t) => [t.id, { nombre: t.nombre, ranuras: t.ranuras }]));
    expect(JSON.parse(JSON.stringify(RANURAS_ESTANDAR))).toEqual(esperado);
  });

  it("el archivo generado está al día (generar-ranuras-iconos.mjs --check)", () => {
    expect(() => execFileSync(process.execPath, [path.join(RAIZ, "scripts/generar-ranuras-iconos.mjs"), "--check"],
      { stdio: "pipe" })).not.toThrow();
  });

  it("toda ranura normalizada mide al menos 1,5 por lado", () => {
    for (const [id, t] of Object.entries(RANURAS_ESTANDAR)) {
      for (const r of normalizarRanuras(t.ranuras)) {
        expect(Math.min(r.w, r.h), `${id}: ranura ${r.tipo}`).toBeGreaterThanOrEqual(RASGO_MINIMO);
      }
    }
  });
});

describe("cada ícono es distinto de los de su clase", () => {
  it.each<[ClaseIcono, string[]]>([
    ["lamina", [...Object.keys(ICONOS_LAMINA), ...Object.keys(ALIAS_LAMINA)]],
    ["grafico", Object.keys(ICONOS_GRAFICO)],
  ])("%s", (clase, tipos) => {
    const vistos = new Map<string, string>();
    for (const tipo of tipos) {
      const d = dibujo(pintar(clase, tipo));
      expect(vistos.get(d), `${tipo} dibuja lo mismo que ${vistos.get(d)}`).toBeUndefined();
      vistos.set(d, tipo);
    }
  });

  it("corona y dos apilados + uno alto comparten ranuras pero no ícono", () => {
    expect(dibujo(pintar("lamina", "p_slide_3_graficos_poblacion_corona")))
      .not.toBe(dibujo(pintar("lamina", "p_slide_3_graficos_2mas1")));
  });

  it("los alias de gráfico se ven como su base", () => {
    for (const [alias, base] of Object.entries(ALIAS_GRAFICO)) {
      expect(dibujo(pintar("grafico", alias))).toBe(dibujo(pintar("grafico", base)));
    }
  });
});

const OPACIDADES = new Set([String(TONO.lleno), String(TONO.apoyo)]);
const atributos = (markup: string, nombre: string): string[] =>
  [...markup.matchAll(new RegExp(` ${nombre}="([^"]*)"`, "g"))].map((m) => m[1] ?? "");

const todos: Array<[ClaseIcono, string, number | undefined]> = [
  ...[...Object.keys(ICONOS_LAMINA), ...Object.keys(ALIAS_LAMINA)].map((t): [ClaseIcono, string, undefined] => ["lamina", t, undefined]),
  ...Object.keys(RANURAS_ESTANDAR).map((t): [ClaseIcono, string, number] => ["lamina", t, 1]),
  ...Object.keys(ICONOS_GRAFICO).map((t): [ClaseIcono, string, undefined] => ["grafico", t, undefined]),
];

describe("regla de color y de rasgo", () => {
  it.each(todos)("%s %s (ranura activa %s)", (clase, tipo, activa) => {
    const m = pintar(clase, tipo, activa);
    expect(m).not.toMatch(/#[0-9a-f]{3,8}\b|rgb|hsl|var\(/i);
    for (const v of [...atributos(m, "fill"), ...atributos(m, "stroke")]) expect(["currentColor", "none"]).toContain(v);
    for (const v of [...atributos(m, "fill-opacity"), ...atributos(m, "stroke-opacity")]) expect(OPACIDADES).toContain(v);
    expect(m.match(/pulso-icono-tipo__acento/g) ?? []).toHaveLength(1);
    for (const v of atributos(m, "stroke-width")) expect(Number(v)).toBeGreaterThanOrEqual(RASGO_MINIMO);
    for (const v of [...atributos(m, "width"), ...atributos(m, "height")]) expect(Number(v)).toBeGreaterThanOrEqual(RASGO_MINIMO);
    for (const v of atributos(m, "r")) expect(2 * Number(v)).toBeGreaterThanOrEqual(RASGO_MINIMO);
  });
});
