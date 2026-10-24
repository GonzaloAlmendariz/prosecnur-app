// La maqueta de un radar entre públicos dibuja la forma que dibuja el motor (formaRadar.ts), no siempre la telaraña.
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { Slide } from "../../../../api/graficos";
import { ranurasDeMaqueta } from "../modeloMaqueta";
import { FichaRanura } from "./FichaRanura";
import { fichaDeRanura, type FichaInfo } from "./fichaModelo";

const ACUERDO = ["En desacuerdo", "De acuerdo"];
const v = (source: string, name: string) =>
  ({ name, source, label: name, list_name: "l", tipo: "select_one", seccion: "", choices: ACUERDO.map((l, i) => ({ name: String(i + 1), label: l })), n_non_empty: 100 });
const VARS = ["docentes", "estudiantes"].flatMap((s) => ["a", "b", "c", "d", "e", "f"].map((n) => v(s, n))) as never[];
const criterios = (n: number) => Object.fromEntries(["a", "b", "c", "d", "e", "f"].slice(0, n).map((c) => [`Tema ${c}`, [`docentes$${c}`, `estudiantes$${c}`]]));
const radar = (n: number, extra: Record<string, unknown> = {}): FichaInfo => {
  const s = { id: "s", tipo: "p_slide_1_grafico", payload: { titulo: "T", grafico: { graficador: "p_radar", args: { modo: "publicos", vars: criterios(n), ...extra } } } } as unknown as Slide;
  return fichaDeRanura(ranurasDeMaqueta(s, VARS, {})[0], "Radar");
};
const glifo = (f: FichaInfo) => renderToStaticMarkup(<FichaRanura info={f} w={4} h={3} clave="k" />).match(/<svg class="pulso-glifo pulso-ficha-glifo[^>]*>([\s\S]*?)<\/svg>/)?.[1] ?? "";

describe("maqueta del radar entre públicos", () => {
  it("5 criterios: telaraña con su tabla", () => {
    const f = radar(5);
    expect(f.glifo).toMatchObject({ formaRadar: "radar", tabla: true });
    expect(glifo(f)).toContain("pulso-glifo__rejilla");
  });
  it("4 criterios en automático: líneas y puntos sin tabla (no la telaraña)", () => {
    const f = radar(4);
    expect(f.glifo).toMatchObject({ formaRadar: "puntos", tabla: false });
    const g = glifo(f);
    expect(g).not.toContain("pulso-glifo__rejilla");
    expect(g).toContain("<circle");
    expect(f.ajustes).toEqual(expect.arrayContaining(["Líneas y puntos", "Sin tabla de datos"]));
  });
  it("fallback barras: barras comparativas, dos por fila", () => {
    const f = radar(4, { fallback_pocos: "barras" });
    expect(f.glifo.formaRadar).toBe("barras");
    expect(glifo(f)).not.toContain("<circle");
    expect(f.ajustes).toContain("Barras comparativas");
  });
  it("forma radar con 4 criterios fuerza la telaraña; tabla «si» pone la tabla con líneas y puntos", () => {
    expect(radar(4, { forma: "radar" }).glifo).toMatchObject({ formaRadar: "radar", tabla: true });
    const conTabla = radar(4, { tabla: "si" });
    expect(conTabla.glifo).toMatchObject({ formaRadar: "puntos", tabla: true });
    expect(glifo(conTabla)).not.toBe(glifo(radar(4)));
  });
  it("mostrar_tabla: false (proyectos viejos) equivale a tabla «no»", () => {
    expect(radar(6, { mostrar_tabla: false }).glifo.tabla).toBe(false);
  });
});
