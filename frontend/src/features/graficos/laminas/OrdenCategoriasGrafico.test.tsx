// La fila «Orden» pintada (sin DOM: markup estático). Lo que importa aquí es lo que el analista VE: la lista en el orden
// en que se dibuja (F-a), la marca de las categorías sin respuestas y que el atributo que busca el foco tras Subir/Bajar
// es el que lleva cada botón.
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { GraficosCategorias } from "../../../api/graficos";
import { OrdenCategoriasGrafico } from "./OrdenCategoriasGrafico";
import { enfocarTrasMover, NO_SE_DIBUJA, selectorAccionOrden } from "./ordenCategorias";

const base: GraficosCategorias = {
  var: "p7", base: "", pregunta: "", ordinal: false, tipo: "select_one", modo_recetario: "frecuencia",
  categorias: [
    { codigo: "1", etiqueta: "Alfa", n: 5, pct: 0.5, residual: false },
    { codigo: "2", etiqueta: "Beta", n: 3, pct: 0.3, residual: false },
    { codigo: "0", etiqueta: "Otro", n: 1, pct: 0.1, residual: true },
    { codigo: "3", etiqueta: "Gama", n: 0, pct: 0, residual: false },
  ],
  orden: { recetario: ["1", "2", "3", "0"], instrumento: ["1", "2", "0", "3"], frecuencia: ["1", "2", "3", "0"] },
  avisos: [],
};
let datos: GraficosCategorias = base;
const llamadas: unknown[][] = [];

vi.mock("./useCategoriasGrafico", () => ({
  useCategoriasGrafico: (...a: unknown[]) => { llamadas.push(a); return { fase: "lista", datos, reintentar: () => undefined }; },
}));

afterEach(() => { datos = base; llamadas.length = 0; });

const pintar = (orden: Record<string, unknown>, graficador = "p_barras_categoricas"): string => renderToStaticMarkup(
  <OrdenCategoriasGrafico variable="docentes$p7" graficador={graficador} args={{ var: "p7", orden_categorias: orden }} scope="active" onCambio={() => undefined} />,
);
const filas = (html: string): string[] => [...html.matchAll(/<li[^>]*aria-label="([^"]+)"/g)].map((m) => m[1]);

describe("OrdenCategoriasGrafico · la lista se ve como se dibuja", () => {
  it("personalizado e invertido: la lista aparece al revés, como la dibuja el motor", () => {
    const html = pintar({ modo: "personalizado", lista: ["3", "1", "2", "0"], invertir: true });
    expect(filas(html).map((f) => f.replace(/\. no se dibuja.*$/, ""))).toEqual(["1. Otro", "2. Beta", "3. Alfa", "4. Gama"]);
  });

  it("personalizado con la lista guardada vacía e invertido: orden del instrumento sin invertir (el motor no tiene parte listada)", () => {
    const html = pintar({ modo: "personalizado", lista: [], invertir: true });
    expect(filas(html).map((f) => f.replace(/\. no se dibuja.*$/, ""))).toEqual(["1. Alfa", "2. Beta", "3. Gama", "4. Otro"]);
  });

  it("la categoría sin respuestas se marca: no se dibuja", () => {
    const html = pintar({ modo: "personalizado", lista: ["1", "2", "3", "0"], invertir: false });
    expect(filas(html)).toEqual(["1. Alfa", "2. Beta", `3. Gama. ${NO_SE_DIBUJA}`, "4. Otro"]);
    expect(html.match(/is-sin-respuestas/g)).toHaveLength(1);
    expect(html).toContain(`>${NO_SE_DIBUJA}</span>`);
  });
});

describe("OrdenCategoriasGrafico · el foco tras Subir/Bajar encuentra su botón", () => {
  it("cada fila lleva los dos botones con el atributo que busca el foco", () => {
    const html = pintar({ modo: "personalizado", lista: ["1", "2", "3", "0"], invertir: false });
    for (const accion of ["subir", "bajar"] as const) {
      const m = selectorAccionOrden(accion).match(/^button\[([\w-]+)="(\w+)"\]$/);
      expect(m, selectorAccionOrden(accion)).not.toBeNull();
      const [, atributo, valor] = m ?? [];
      const botones = html.match(new RegExp(`<button[^>]*\\s${atributo}="${valor}"`, "g")) ?? [];
      expect(botones).toHaveLength(datos.categorias.length);
    }
  });

  it("enfocarTrasMover busca ese selector y enfoca el botón; sin botón habilitado, la fila", () => {
    const registro: string[] = [];
    const boton = { focus: () => registro.push("boton") };
    const fila = {
      focus: () => registro.push("fila"),
      querySelector: (sel: string) => { registro.push(sel); return boton; },
    };
    expect(enfocarTrasMover(fila, "subir", 0, 4)).toBe(boton);
    expect(registro).toEqual([selectorAccionOrden("bajar"), "boton"]);
    registro.length = 0;
    expect(enfocarTrasMover(fila, "bajar", 0, 1)).toBe(fila);
    expect(registro).toEqual(["fila"]);
  });
});

describe("OrdenCategoriasGrafico · avisos de la pregunta (decisión 4, §7)", () => {
  const PREG = "Departamento académico al que pertenece:";
  const con = (avisos: GraficosCategorias["avisos"]) => { datos = { ...base, pregunta: PREG, avisos }; };
  const nota = (html: string, codigo: string) => html.match(new RegExp(`<span(?: id="([^"]+)")? class="([^"]+)" data-aviso="${codigo}">.*?<span>([^<]*)</span>`));
  const select = (html: string) => html.match(/<select[^>]*>/)?.[0] ?? "";
  const grupoInvertir = (html: string) => html.match(/<div class="pulso-f6-orden-invertir"[^>]*>/)?.[0] ?? "";
  const interruptor = (html: string) => html.match(/<button[^>]*role="switch"[^>]*>/)?.[0] ?? "";

  it("pide las categorías con la var calificada y el graficador del gráfico", () => {
    pintar({ modo: "recetario" }, "p_pie");
    expect(llamadas).toEqual([["docentes$p7", "active", "p_pie"]]);
  });

  it("base_por_defecto se destaca; las demás son notas sobrias, encima de la lista", () => {
    con([
      { codigo: "base_por_defecto", texto: `“${PREG}”: las categorías son de la base «docentes»: la activa no tiene datos listos.` },
      { codigo: "residuales_al_final", texto: `“${PREG}”: «Otro» va al final.` },
    ]);
    const html = pintar({ modo: "personalizado", lista: ["1", "2", "3", "0"], invertir: false });
    expect(nota(html, "base_por_defecto")?.[2]).toBe("pulso-f6-orden-aviso is-destacado");
    expect(nota(html, "residuales_al_final")?.[2]).toBe("pulso-f6-orden-aviso");
    expect(html.indexOf('data-aviso="residuales_al_final"')).toBeLessThan(html.indexOf("pulso-f6-orden-lista"));
    // El prefijo con la misma pregunta se recorta dentro de su tarjeta.
    expect(nota(html, "residuales_al_final")?.[3]).toBe("«Otro» va al final.");
  });

  it("escala_orden_ignorado deshabilita el modo e Invertir con la nota enlazada", () => {
    con([{ codigo: "escala_orden_ignorado", texto: `“${PREG}”: este gráfico sigue el orden de la escala.` }]);
    const html = pintar({ modo: "personalizado", lista: ["1"], invertir: false }, "p_barras_apiladas");
    const m = nota(html, "escala_orden_ignorado");
    const id = m?.[1] ?? "";
    expect(id).not.toBe("");
    expect(select(html)).toContain("disabled");
    expect(select(html)).toContain(`aria-describedby="${id}"`);
    expect(grupoInvertir(html)).toContain(`aria-describedby="${id}"`);
    expect(interruptor(html)).toContain("disabled");
    expect(html).not.toContain("pulso-f6-orden-lista");
  });

  it("se decide por el código, nunca por el texto", () => {
    con([
      { codigo: "residuales_al_final", texto: "el orden no aplica a las escalas; la base por defecto" },
      { codigo: "codigo_nuevo", texto: "Algo que el frontend aún no conoce." },
    ]);
    const html = pintar({ modo: "recetario" });
    expect(select(html)).not.toContain("disabled");
    expect(interruptor(html)).not.toContain("disabled");
    expect(html).not.toContain("is-destacado");
    expect(nota(html, "codigo_nuevo")?.[3]).toBe("Algo que el frontend aún no conoce.");
  });

  it("el mensaje general de categorías sin respuestas lo da el backend, no un cálculo local", () => {
    con([]);
    const sin = pintar({ modo: "personalizado", lista: ["1", "2", "3", "0"], invertir: false });
    expect(sin).not.toContain("pulso-f6-orden-aviso");
    expect(sin).toContain(NO_SE_DIBUJA); // la marca por fila (n === 0) se queda
    con([{ codigo: "categorias_sin_respuestas", texto: `“${PREG}”: una categoría del instrumento no tiene respuestas en esta base («Gama»).` }]);
    const con1 = pintar({ modo: "recetario" });
    expect(nota(con1, "categorias_sin_respuestas")?.[3]).toBe("Una categoría del instrumento no tiene respuestas en esta base («Gama»).");
  });
});
