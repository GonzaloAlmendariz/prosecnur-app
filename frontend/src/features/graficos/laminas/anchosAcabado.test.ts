// Acabado de Láminas, reglas de ancho C2–C8 (oleada W1-B, 2026-11-08). Guardas de CSS: que no vuelvan los anchos por
// control, las pistas fijas de las galerías ni la grilla de tres columnas de «Nombre corto de cada pregunta».
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dir = path.dirname(fileURLToPath(import.meta.url));
const sinComentarios = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, "");
const leer = (rel: string) => sinComentarios(fs.readFileSync(path.join(dir, rel), "utf8"));
const regla = (css: string, selector: string) => {
  const i = css.indexOf(selector);
  return i < 0 ? "" : css.slice(css.indexOf("{", i) + 1, css.indexOf("}", i));
};

const datos = leer("datosGrafico.css");
const inspector = leer("inspectorLamina.css");
const selectores = leer("selectores/selectores.css");
const clave = leer("preguntasClave/preguntasClave.css");
const avisos = leer("panelAvisos.css");

describe("C2: columna de control común", () => {
  it("la fila usa la columna de 180 px y el control la llena", () => {
    const fila = regla(datos, ".pulso-f6-dato {");
    expect(fila).toContain("--pulso-f6-col-control: 180px");
    expect(fila).toContain("minmax(0, 1fr) var(--pulso-f6-col-control)");
  });

  it("no quedan anchos por control", () => {
    expect(datos).not.toMatch(/max-width:\s*250px/);
    expect(datos).not.toMatch(/width:\s*(100|76|64)px/);
  });
});

describe("C3: nombre corto de cada pregunta", () => {
  it("el enunciado y el campo van a todo el ancho; «Clave» en el renglón del enunciado", () => {
    expect(regla(datos, ".pulso-f6-etiqueta-pregunta {")).toContain('grid-template-areas: "texto" "campo"');
    expect(regla(datos, ".pulso-f6-etiqueta-pregunta-texto {")).toContain("-webkit-line-clamp: 2");
    expect(regla(clave, ".pulso-f6-etiqueta-pregunta.is-con-clave {")).toContain('"texto clave" "campo campo"');
  });
});

describe("C4: índice y selector de gráfico", () => {
  it("el índice reparte el ancho en partes iguales", () => {
    expect(regla(datos, ".pulso-f6-indice-tarjeta {")).toContain("grid-auto-columns: minmax(0, 1fr)");
  });

  it("el selector de gráfico es una grilla de celdas iguales", () => {
    expect(regla(inspector, ".pulso-f6-selector-grafico {")).toContain("repeat(2, minmax(0, 1fr))");
  });
});

describe("C5: fichas", () => {
  it("hueco space-1 y la línea del efecto vacía no ocupa lugar", () => {
    expect(regla(datos, ".pulso-f6-cats {")).toContain("var(--pulso-space-1)");
    expect(regla(datos, ".pulso-f6-destacar {")).toContain("var(--pulso-space-1)");
    // W2-B: la línea vacía ya no se oculta con :empty: no se monta (ExcluirRespuestas.tsx).
    expect(datos).not.toMatch(/excluir-efecto:empty/);
    const excluir = fs.readFileSync(path.join(dir, "excluirConCifra/ExcluirRespuestas.tsx"), "utf8");
    expect(excluir).toMatch(/efecto=\{conEfecto \?/);
  });
});

describe("C6: galerías sin pistas fijas", () => {
  it("auto-fill con mínimo y reparto", () => {
    expect(regla(selectores, ".pulso-f6-tarjetas {")).toContain("repeat(auto-fill, minmax(196px, 1fr))");
    expect(selectores).not.toMatch(/repeat\(auto-fill,\s*\d+px\)/);
  });
});

describe("C7: cabecera del selector en angosto", () => {
  it("bajo 1180 px parte en dos renglones", () => {
    // W3: la cabecera es la rejilla de CabeceraPanel; bajo 1180 px las acciones bajan a una fila propia de todo el ancho.
    const i = selectores.indexOf("@media (max-width: 1180px) {\n  .pulso-f6-selector-cabecera {");
    expect(i).toBeGreaterThan(-1);
    const angosto = selectores.slice(i, i + 400);
    expect(angosto).toContain(".pulso-f6-selector-cabecera > .pulso-cabecera-panel__acciones {");
    expect(angosto).toContain("grid-column: 1 / -1;");
  });
});

describe("C8: «Lámina N» en el primer renglón del aviso", () => {
  it("el enlace flota al final del primer renglón", () => {
    expect(regla(avisos, ".pulso-f6-avisos-ir {")).toContain("float: inline-end");
  });
});
