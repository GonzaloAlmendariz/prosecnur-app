import { beforeEach, describe, expect, it } from "vitest";
import { usePlanStore, type GraficosConfig } from "../store";
import type { ListaRespuestas } from "./modeloColoresRespuestas";
import {
  conRotuloCorto,
  cuantosRotulos,
  errorCorto,
  filasRotulosCortos,
  opcionesDelInstrumento,
  sinRotuloCorto,
  sugerencias,
} from "./modeloRotulosCortos";

// U3 del checklist de mandos del mazo (2026-11-05): `plan.rotulos_cortos` con superficie en Identidad › Rótulos cortos.
const BECA = "Por beca de estudios (puede ser beca 18 o alguna otra beca externa a la universidad a la que se haya accedido)";
const LISTAS: ListaRespuestas[] = [
  { list_name: "financia", choices: [{ name: "1", label: BECA }, { name: "2", label: "Recursos propios" }, { name: "3", label: "Crédito educativo" }] },
  { list_name: "financia_2", choices: [{ name: "a", label: BECA }, { name: "b", label: "  " }] },
  { list_name: "sino", choices: [{ name: "1", label: "Sí" }, { name: "2", label: "No" }] },
];

describe("modeloRotulosCortos", () => {
  const opciones = opcionesDelInstrumento(LISTAS);

  it("reúne las respuestas distintas del formulario con sus listas y descarta las vacías", () => {
    expect(opciones.map((o) => o.rotulo)).toEqual([BECA, "Recursos propios", "Crédito educativo", "Sí", "No"]);
    expect(opciones[0].listas).toEqual(["financia", "financia_2"]);
  });

  it("sugiere sin tildes ni mayúsculas, sin las que ya tienen corto; sin búsqueda, las más largas primero", () => {
    expect(sugerencias(opciones, "credito", {}).map((o) => o.rotulo)).toEqual(["Crédito educativo"]);
    expect(sugerencias(opciones, "BECA", {}).map((o) => o.rotulo)).toEqual([BECA]);
    expect(sugerencias(opciones, "beca", { [BECA]: "Beca 18" })).toEqual([]);
    expect(sugerencias(opciones, "", {}, 2).map((o) => o.rotulo)).toEqual([BECA, "Crédito educativo"]);
  });

  it("las filas dicen si la respuesta sigue en el formulario (C5) y quedan en null sin catálogo", () => {
    const mapa = { [BECA]: "Beca 18 u otra beca externa", "Respuesta retirada": "Retirada" };
    const filas = filasRotulosCortos(mapa, opciones);
    expect(filas.map((f) => [f.corto, f.enFormulario])).toEqual([["Beca 18 u otra beca externa", true], ["Retirada", false]]);
    expect(filas[0].listas).toEqual(["financia", "financia_2"]);
    expect(filasRotulosCortos(mapa, null).map((f) => f.enFormulario)).toEqual([null, null]);
    expect(filasRotulosCortos(undefined, opciones)).toEqual([]);
  });

  it("valida, agrega, cambia y quita sin tocar las demás", () => {
    expect(errorCorto(BECA, "  ")).toBe("Escribe el rótulo corto.");
    expect(errorCorto("Sí", " Sí ")).toBe("Es igual al rótulo completo.");
    expect(errorCorto(BECA, "Beca 18")).toBeNull();
    const m1 = conRotuloCorto(undefined, BECA, " Beca 18 ");
    expect(m1).toEqual({ [BECA]: "Beca 18" });
    const m2 = conRotuloCorto(m1, "Crédito educativo", "Crédito");
    expect(conRotuloCorto(m2, BECA, "Beca 18 u otra")).toEqual({ [BECA]: "Beca 18 u otra", "Crédito educativo": "Crédito" });
    expect(sinRotuloCorto(m2, BECA)).toEqual({ "Crédito educativo": "Crédito" });
    expect(cuantosRotulos(m2)).toBe(2);
    expect(cuantosRotulos(undefined)).toBe(0);
  });
});

describe("setRotulosCortos", () => {
  beforeEach(() => {
    usePlanStore.getState().hydrate({
      version: "graficos/4", plan: { slides: [{ id: "a", tipo: "p_slide_1_grafico", payload: { titulo: "T" } }] },
      presets: {}, w_presets: {}, selected_slide_id: null, paletas: {}, iconos: [], overrides_reusables: [],
      debug_ph: { activo: false, color: "#FF00FF", lwd: 0.6 },
    } as unknown as GraficosConfig);
  });

  it("escribe en el plan, es deshacible y un mapa vacío quita la clave sin tocar las láminas", () => {
    const st = usePlanStore.getState();
    st.setRotulosCortos({ [BECA]: "Beca 18" });
    expect(usePlanStore.getState().plan.rotulos_cortos).toEqual({ [BECA]: "Beca 18" });
    expect(usePlanStore.getState().dirty).toBe(true);
    st.setRotulosCortos({});
    expect("rotulos_cortos" in usePlanStore.getState().plan).toBe(false);
    expect(usePlanStore.getState().plan.slides).toHaveLength(1);
    usePlanStore.getState().undo();
    expect(usePlanStore.getState().plan.rotulos_cortos).toEqual({ [BECA]: "Beca 18" });
  });
});
