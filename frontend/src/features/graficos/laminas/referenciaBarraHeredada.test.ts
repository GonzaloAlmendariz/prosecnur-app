// Ronda 21: «Pista gris hasta el 100%» y «Referencia de las barras» no salen juntos; lo guardado en la vieja se lee en la
// nueva, la tarjeta escribe sólo `referencia_barra` y no se pierde lo que el analista guardó.
import { beforeEach, describe, expect, it } from "vitest";
import type { ArgMetadata, GraficadorRef } from "../../../api/graficos";
import { usePlanStore, type GraficosConfig } from "../store";
import { camposDeDatos } from "./argsDatosGrafico";
import { parcheDeReferencia, referenciaDePista, referenciaQueRige, sinPistaDuplicada } from "./referenciaBarraHeredada";

const PISTA = {
  name: "pista_barras", label: "Pista hasta el 100%", tipo_input: "choice", grupo: "estilo", default: "auto", via_overrides: true,
  choices: [{ value: "auto", label: "Automática" }, { value: "siempre", label: "Siempre" }, { value: "nunca", label: "Nunca" }],
} as ArgMetadata;
const REFERENCIA = {
  name: "referencia_barra", label: "Referencia de las barras", tipo_input: "choice", grupo: "estilo", via_overrides: true,
  choices: [{ value: "pista", label: "Fondo gris hasta el 100%" }, { value: "eje", label: "Eje abajo" }],
} as ArgMetadata;

describe("referencia de las barras · un solo mando", () => {
  it("en agrupadas y categóricas sale sólo «Referencia de las barras»", () => {
    for (const g of ["p_barras_agrupadas", "p_barras_categoricas"]) {
      const nombres = sinPistaDuplicada(camposDeDatos([PISTA, REFERENCIA], {}, g)).map((c) => c.arg.name);
      expect(nombres).toContain("referencia_barra");
      expect(nombres).not.toContain("pista_barras");
    }
  });
  it("si el registro aún no trae `referencia_barra`, la pista vieja sigue", () => {
    expect(sinPistaDuplicada(camposDeDatos([PISTA], {}, "p_barras_agrupadas")).map((c) => c.arg.name)).toEqual(["pista_barras"]);
  });
});

describe("referencia de las barras · lo guardado en la pista vieja", () => {
  it("siempre (o true) se lee como fondo gris; nunca (o false), como eje; auto, como el gráfico", () => {
    expect(referenciaDePista("siempre")).toBe("pista");
    expect(referenciaDePista(true)).toBe("pista");
    expect(referenciaDePista("nunca")).toBe("eje");
    expect(referenciaDePista(false)).toBe("eje");
    expect(referenciaDePista("auto")).toBeUndefined();
    expect(referenciaDePista(undefined)).toBeUndefined();
  });
  it("lo declarado en `referencia_barra` manda sobre la pista vieja, como en el motor", () => {
    const g = "p_barras_agrupadas";
    expect(referenciaQueRige({ pista_barras: "nunca", overrides: { pista_barras: "nunca" } }, g)).toBe("eje");
    expect(referenciaQueRige({ pista_barras: true }, g)).toBe("pista");
    expect(referenciaQueRige({ pista_barras: "nunca", referencia_barra: "pista", overrides: { pista_barras: "nunca", referencia_barra: "pista" } }, g)).toBe("pista");
    expect(referenciaQueRige({ pista_barras: "auto" }, g)).toBeUndefined();
  });
});

describe("referencia de las barras · qué se escribe", () => {
  const hidratar = (graf: GraficadorRef) => usePlanStore.getState().hydrate({
    version: "graficos/4",
    plan: { slides: [{ id: "a", tipo: "p_slide_1_grafico", payload: { titulo: "T", grafico: graf } }] },
    presets: {}, w_presets: {}, selected_slide_id: null, paletas: {}, iconos: [], overrides_reusables: [],
    debug_ph: { activo: false, color: "#FF00FF", lwd: 0.6 },
  } as unknown as GraficosConfig);
  const argsDelPlan = () => (usePlanStore.getState().plan.slides[0].payload.grafico as GraficadorRef).args as Record<string, unknown>;
  const g = "p_barras_agrupadas";
  beforeEach(() => hidratar({ graficador: g, args: { var: "p1", pista_barras: "nunca", overrides: { pista_barras: "nunca" } } }));

  it("elegir una referencia escribe sólo `referencia_barra` y conserva la pista guardada", () => {
    const parche = parcheDeReferencia(argsDelPlan(), "pista", g);
    expect(parche).toEqual({ referencia_barra: "pista" });
    usePlanStore.getState().updateSlotArgs("a", "grafico", parche);
    expect(argsDelPlan().pista_barras).toBe("nunca");
    expect(argsDelPlan().overrides).toEqual({ pista_barras: "nunca", referencia_barra: "pista" });
    expect(referenciaQueRige(argsDelPlan(), g)).toBe("pista");
  });
  it("«Como el gráfico» sobre una pista que se lee como eje borra las dos: el segmentado queda donde se hizo clic", () => {
    usePlanStore.getState().updateSlotArgs("a", "grafico", parcheDeReferencia(argsDelPlan(), null, g));
    expect(argsDelPlan()).not.toHaveProperty("pista_barras");
    expect(argsDelPlan()).not.toHaveProperty("referencia_barra");
    expect(referenciaQueRige(argsDelPlan(), g)).toBeUndefined();
  });
  it("«Como el gráfico» sin pista vieja que lo contradiga sólo borra `referencia_barra`", () => {
    expect(parcheDeReferencia({ pista_barras: "auto" }, null, g)).toEqual({ referencia_barra: null });
    expect(parcheDeReferencia({}, "eje", g)).toEqual({ referencia_barra: "eje" });
  });
});
