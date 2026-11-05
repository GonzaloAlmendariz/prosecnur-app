// U13: la composición «cifra_lateral» de la lámina de dos gráficos (api/R/lamina_cifra_y_grafico.R).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { Slide } from "../../../../api/graficos";
import {
  cifraLateralActiva, desgloseEncendido, faltaParaCifraLateral, leerCifraLateral, metaConCifra, metaConComposicion, preguntaDeLaCifra,
} from "./modeloCifraLateral";

const g = (graficador: string, args: Record<string, unknown>) => ({ graficador, args });
const lamina = (izquierda: unknown, derecha: unknown, tipo = "p_slide_2_graficos") =>
  ({ id: "s1", tipo, payload: { izquierda, derecha } }) as unknown as Slide;

describe("la cifra al lado (U13)", () => {
  it("se enciende con `composicion` y apagar conserva la cifra escrita", () => {
    const on = metaConComposicion({ antetitulo: "A" }, true);
    expect(on).toEqual({ antetitulo: "A", composicion: "cifra_lateral" });
    expect(cifraLateralActiva(on)).toBe(true);
    const off = metaConComposicion({ ...on, cifra: { fila: "Privado" } }, false);
    expect(off).toEqual({ antetitulo: "A", cifra: { fila: "Privado" } });
    expect(cifraLateralActiva(off)).toBe(false);
  });
  it("lee lo que el motor usa por defecto: franja encendida y comparación automática", () => {
    expect(leerCifraLateral({})).toEqual({ fila: "", rotulo: "", texto: "", franja: true, comparacion: "auto", comparacionTexto: "" });
    expect(leerCifraLateral({ cifra: { fila: "Privado", franja: false, comparacion: false } }))
      .toMatchObject({ fila: "Privado", franja: false, comparacion: "ninguna" });
  });
  it("escribe sólo lo que difiere del motor y conserva lo que el editor no maneja", () => {
    const meta = { composicion: "cifra_lateral", cifra: { cruces: ["e$area"], top2box: ["4", "5"] } };
    expect(metaConCifra(meta, { fila: "Privado", texto: "estudió en un colegio privado", franja: false, comparacion: "ninguna" }).cifra)
      .toEqual({ cruces: ["e$area"], top2box: ["4", "5"], fila: "Privado", texto: "estudió en un colegio privado", franja: false, comparacion: "ninguna" });
    const vuelta = metaConCifra({ cifra: { fila: "Privado", franja: false, comparacion: "ninguna" } }, { fila: "", franja: true, comparacion: "auto" });
    expect(vuelta.cifra).toBeUndefined();
    expect(metaConCifra({}, { comparacion: "escrita", comparacionTexto: "12 puntos más que en 2025" }).cifra)
      .toEqual({ comparacion: "12 puntos más que en 2025" });
  });
  it("dice qué falta: pregunta a la izquierda, barras sin dividir a la derecha", () => {
    const izq = g("p_barras_agrupadas", { var: "e$colegio" });
    expect(faltaParaCifraLateral(lamina(izq, g("p_barras_agrupadas", { var: "e$razones" })))).toBeNull();
    expect(preguntaDeLaCifra(lamina(izq, null))).toBe("e$colegio");
    expect(faltaParaCifraLateral(lamina(g("p_barras_agrupadas", {}), g("p_barras_agrupadas", { var: "e$r" })))).toMatch(/izquierda/);
    expect(faltaParaCifraLateral(lamina(izq, g("p_pie", { var: "e$r" })))).toMatch(/de barras/);
    expect(faltaParaCifraLateral(lamina(izq, g("p_barras_agrupadas", { var: "e$r", cruces: "e$sexo" })))).toMatch(/sin dividir/);
    expect(faltaParaCifraLateral(lamina(izq, null, "p_slide_1_grafico"))).toMatch(/dos gráficos/);
  });
  it("los grupos bajo cada barra dependen de las tarjetas de la derecha", () => {
    expect(desgloseEncendido({ tarjetas_diferencias: { derecha: true } })).toBe(true);
    expect(desgloseEncendido({ tarjetas_diferencias: { izquierda: true } })).toBe(false);
    expect(desgloseEncendido({})).toBe(false);
  });
  it("el motor lee las mismas claves", () => {
    const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../../..");
    const r = fs.readFileSync(path.join(raiz, "api/R/lamina_cifra_y_grafico.R"), "utf8");
    expect(r).toContain('identical(as.character(unlist((slide$meta %||% list())$composicion))[1], "cifra_lateral")');
    expect(r).toContain('c("fila", "filas", "top2box", "texto", "comparacion", "filtros")');
    expect(r).toContain("texto(cfg$rotulo)");
    expect(r).toContain("!identical(cfg$franja, FALSE)");
  });

});
