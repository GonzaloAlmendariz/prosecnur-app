import { describe, expect, it } from "vitest";
import type { SlideType } from "../../../../api/graficos";
import type { EntradaMiniatura } from "../miniaturas/loteMiniaturas";
import { SLIDE_GRAF_SLOTS } from "../../store";
import { proponerMazo, type EntradaMazo } from "./modeloMazo";
import { idMiniatura, imagenDeTarjeta, laminasConMiniatura, planMazo } from "./modeloMiniaturasMazo";

const ARGS: Record<string, string[]> = {
  p_panorama: ["vars", "corte", "regla", "referencia"],
  p_dumbbell: ["cruce", "grupos", "corte", "regla"],
  p_barras_divergentes: ["var", "vars", "regla", "orden"],
  p_fortalezas: ["vars", "corte", "n", "regla"],
  p_cobertura: ["bases"],
};
const entrada: EntradaMazo = {
  estudio: { bases: ["docentes", "estudiantes"], baseActiva: "docentes" },
  publicos: ["docentes", "estudiantes"],
  graficadores: new Set(Object.keys(ARGS)),
  laminas: new Set(["p_slide_1_grafico", "p_slide_cierre_hallazgos"]),
  tiposInsertables: new Set(Object.keys(SLIDE_GRAF_SLOTS) as SlideType[]),
  admiteArg: (g, a) => (ARGS[g] ?? []).includes(a),
  indicador: null,
  referencia: 60,
};

const e = (x: Partial<EntradaMiniatura>): EntradaMiniatura => ({ estado: "ok", clave: "k", src: null, anterior: null, error: null, ...x });

describe("miniaturas de las tarjetas del mazo", () => {
  it("dibuja las que tienen gráfico; no el cierre ni aperturas sin la pregunta que divide", () => {
    const ls = laminasConMiniatura(proponerMazo(entrada), "g");
    const ids = ls.map((l) => l.propuesta);
    expect(ids).toContain("panorama");
    expect(ids).toContain("fortalezas:docentes");
    expect(ids).not.toContain("cierre");
    expect(ids).not.toContain("aperturas");
    expect(ls.find((l) => l.propuesta === "fortalezas:docentes")?.id).toBe("mazo-fortalezas-docentes");
    expect(idMiniatura("a b:c")).toBe("mazo-a-b-c");
  });

  it("la clave cambia con el estilo global y con los args, y no con nada más", () => {
    const a = laminasConMiniatura(proponerMazo(entrada), "g1");
    const b = laminasConMiniatura(proponerMazo(entrada), "g1");
    const c = laminasConMiniatura(proponerMazo(entrada), "g2");
    const d = laminasConMiniatura(proponerMazo({ ...entrada, referencia: 70 }), "g1");
    const panorama = (ls: typeof a) => ls.find((l) => l.propuesta === "panorama")?.clave;
    expect(panorama(a)).toBe(panorama(b));
    expect(panorama(a)).not.toBe(panorama(c));
    expect(panorama(a)).not.toBe(panorama(d));
  });

  it("plan: con un lote del mazo corriendo, espera; sin lote, nuevas, cambiadas y pendientes huérfanas", () => {
    const ls = [{ id: "a", clave: "1" }, { id: "b", clave: "2" }, { id: "c", clave: "3" }, { id: "d", clave: "4" }];
    const entradas = { b: e({ clave: "viejo" }), c: e({ clave: "3", estado: "pendiente" }), d: e({ clave: "4" }) };
    expect(planMazo(ls, entradas, 1)).toBeNull();
    expect(planMazo(ls, entradas, 0)?.map((l) => l.id)).toEqual(["a", "b", "c"]);
    expect(planMazo([{ id: "d", clave: "4" }], entradas, 0)).toBeNull();
  });

  it("la imagen: la vigente, la anterior mientras se rehace, y nada (el glifo) sin entrada o con error", () => {
    expect(imagenDeTarjeta(undefined)).toBeNull();
    expect(imagenDeTarjeta(e({ src: "/x.png" }))).toBe("/x.png");
    expect(imagenDeTarjeta(e({ estado: "pendiente", anterior: "/v.png" }))).toBe("/v.png");
    expect(imagenDeTarjeta(e({ estado: "error", src: "/x.png" }))).toBeNull();
  });
});
