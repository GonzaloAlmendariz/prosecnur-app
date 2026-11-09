import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RankingBase } from "../../../api/graficosRotulos";

// ADR 0141: guardar un rótulo corto por POST lleva la respuesta al store del plan. Sin eso, el siguiente autosave (que
// guarda el plan entero) pisaba lo que el POST escribió.
const api = vi.hoisted(() => ({ guardar: vi.fn(), ranking: vi.fn() }));
vi.mock("../../../api/graficosRotulos", async (importOriginal) => {
  const real = await importOriginal<typeof import("../../../api/graficosRotulos")>();
  return { ...real, apiGraficosRotulosGuardar: api.guardar, apiGraficosRotulosRanking: api.ranking };
});

const { ErrorRotuloCorto } = await import("../../../api/graficosRotulos");
const { usePlanStore } = await import("../store");
const { buildGraficosConfigFromStore } = await import("../configSnapshot");
const { useRotulosCortosUi } = await import("./rotulosCortosStore");
const { filasRanking } = await import("./modeloRotulosCortos");
type GraficosConfig = import("../store").GraficosConfig;

const BECA = "Por beca de estudios (puede ser beca 18 o alguna otra beca externa)";
const BASE: RankingBase = {
  base: "arte",
  preguntas: [{ ref: "arte$p1", etiqueta: "¿Cuál es tu edad en años cumplidos?", largo: 35, usos: 1 }],
  opciones: [{ ref: "arte$financia", codigo: "1", etiqueta: BECA, largo: BECA.length, usos: 1 }],
};

describe("useRotulosCortosUi.guardar", () => {
  beforeEach(() => {
    api.guardar.mockReset();
    useRotulosCortosUi.setState({ borradores: {}, errores: {}, guardando: {}, avisos: [] });
    usePlanStore.getState().hydrate({
      version: "graficos/4",
      plan: { slides: [{ id: "a", tipo: "p_slide_1_grafico", payload: { titulo: "T" } }], rotulos_cortos: { [BECA]: "Beca" } },
      presets: {}, w_presets: {}, selected_slide_id: null, paletas: {}, iconos: [], overrides_reusables: [],
      debug_ph: { activo: false, color: "#FF00FF", lwd: 0.6 },
    } as unknown as GraficosConfig);
  });

  it("manda la sección de preguntas y deja la respuesta en el plan; el snapshot del autosave la lleva", async () => {
    const respuesta = { [BECA]: "Beca", preguntas: { "arte$p1": "Edad" } };
    api.guardar.mockResolvedValue({ rotulos_cortos: respuesta, avisos: [], saved_at: "t" });
    const [fila] = filasRanking(BASE, "preguntas", usePlanStore.getState().plan.rotulos_cortos);
    useRotulosCortosUi.getState().setBorrador(fila, "Edad");
    await expect(useRotulosCortosUi.getState().guardar(fila, "Edad")).resolves.toBe(true);
    expect(api.guardar).toHaveBeenCalledWith({ preguntas: { "arte$p1": "Edad" } });
    expect(usePlanStore.getState().plan.rotulos_cortos).toEqual(respuesta);
    expect(useRotulosCortosUi.getState().borradores).toEqual({});
    // Editar una lámina después no la borra, y lo que guarda el autosave la lleva.
    usePlanStore.getState().updateSlidePayload("a", { titulo: "Otro" });
    const cfg = buildGraficosConfigFromStore() as unknown as { plan: { rotulos_cortos?: unknown } };
    expect(cfg.plan.rotulos_cortos).toEqual(respuesta);
  });

  it("un corto que no acorta no llega al backend", async () => {
    const [fila] = filasRanking(BASE, "categorias", undefined);
    await expect(useRotulosCortosUi.getState().guardar(fila, BECA)).resolves.toBe(false);
    expect(api.guardar).not.toHaveBeenCalled();
    expect(useRotulosCortosUi.getState().errores[`categorias:${BECA}`]).toMatch(/más corto/);
  });

  it("sin cambio no se guarda nada; vacío quita la entrada", async () => {
    const [fila] = filasRanking(BASE, "categorias", usePlanStore.getState().plan.rotulos_cortos);
    await useRotulosCortosUi.getState().guardar(fila, "Beca");
    expect(api.guardar).not.toHaveBeenCalled();
    api.guardar.mockResolvedValue({ rotulos_cortos: {}, avisos: [], saved_at: "t" });
    await useRotulosCortosUi.getState().guardar(fila, "");
    expect(api.guardar).toHaveBeenCalledWith({ opciones: {} });
    expect("rotulos_cortos" in usePlanStore.getState().plan).toBe(false);
  });

  it("el error del backend va junto a la entrada que lo causó; el plan no cambia", async () => {
    api.guardar.mockRejectedValue(new ErrorRotuloCorto("E_ROTULO_CORTO_REF", "La pregunta no está.", "arte$p1"));
    const [fila] = filasRanking(BASE, "preguntas", undefined);
    await expect(useRotulosCortosUi.getState().guardar(fila, "Edad")).resolves.toBe(false);
    expect(useRotulosCortosUi.getState().errores["preguntas:arte$p1"]).toBe("La pregunta no está.");
    expect(usePlanStore.getState().plan.rotulos_cortos).toEqual({ [BECA]: "Beca" });
  });

  it("guarda los avisos de colisión del último guardado", async () => {
    const aviso = { tipo: "preguntas" as const, base: "arte", corto: "Edad", refs: ["arte$p1", "arte$p2"] };
    api.guardar.mockResolvedValue({ rotulos_cortos: { preguntas: { "arte$p1": "Edad" } }, avisos: [aviso], saved_at: "t" });
    const [fila] = filasRanking(BASE, "preguntas", undefined);
    await useRotulosCortosUi.getState().guardar(fila, "Edad");
    expect(useRotulosCortosUi.getState().avisos).toEqual([aviso]);
  });
});
