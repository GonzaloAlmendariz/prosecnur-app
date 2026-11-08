import { beforeEach, describe, expect, it } from "vitest";
import type { Slide, SlideType } from "../../../api/graficos";
import { agrupadorDelPlan } from "../historialAgrupado";
import { usePlanStore, type GraficosConfig } from "../store";
import { construirEstructura } from "./modeloEstructura";
import { aplicarArrastre, destinoArrastre, idsVisiblesEstructura, moverLamina } from "./ordenArrastre";

const s = (id: string, tipo: SlideType, payload: Record<string, unknown> = {}): Slide => ({ id, tipo, payload });
const graf = { graficador: "p_barras_apiladas", args: { var: "P1" } };

// Apertura (a), capítulo «Perfil» (d: e, f) y capítulo «Docentes» (g: h), y cierre (z).
const plan: Slide[] = [
  s("a", "p_slide_portada", { titulo: "Estudio" }),
  s("d", "p_slide_seccion", { titulo: "Perfil" }),
  s("e", "p_slide_1_grafico", { titulo: "Edad", grafico: graf }),
  s("f", "p_slide_1_grafico", { titulo: "Sexo", grafico: graf }),
  s("g", "p_slide_seccion", { titulo: "Docentes" }),
  s("h", "p_slide_1_grafico", { titulo: "Trato", grafico: graf }),
  s("z", "p_slide_cierre"),
];
const ids = plan.map((x) => x.id);
const ordenar = (orden: string[]) => orden.map((id) => plan.find((x) => x.id === id) as Slide);

describe("destinoArrastre y moverLamina", () => {
  it("bajando, la lámina queda después de la fila donde se suelta; subiendo, antes", () => {
    expect(destinoArrastre(ids, "e", "h")).toBe(5);
    expect(moverLamina(ids, "e", "h")).toEqual(["a", "d", "f", "g", "h", "e", "z"]);
    expect(moverLamina(ids, "h", "e")).toEqual(["a", "d", "h", "e", "f", "g", "z"]);
  });

  it("extremos: a la primera y a la última posición", () => {
    expect(moverLamina(ids, "z", "a")).toEqual(["z", "a", "d", "e", "f", "g", "h"]);
    expect(moverLamina(ids, "a", "z")).toEqual(["d", "e", "f", "g", "h", "z", "a"]);
  });

  it("soltar sobre sí misma, fuera de la lista o con un id que no está no cambia nada", () => {
    expect(destinoArrastre(ids, "e", "e")).toBeNull();
    expect(destinoArrastre(ids, "e", null)).toBeNull();
    expect(destinoArrastre(ids, "x", "e")).toBeNull();
    expect(destinoArrastre(ids, "e", "x")).toBeNull();
    expect(moverLamina(ids, "e", null)).toEqual(ids);
  });

  it("entre capítulos: la lámina pasa al capítulo donde cae (el capítulo es un tramo del plan)", () => {
    // «Edad» soltada sobre «Trato» (bajando) queda en «Docentes».
    const tras = construirEstructura(ordenar(moverLamina(ids, "e", "h")));
    const docentes = tras.nodos.find((n) => n.clase === "capitulo" && n.titulo === "Docentes");
    expect(docentes?.clase === "capitulo" && docentes.laminas.map((l) => l.id)).toEqual(["h", "e"]);
    // «Trato» soltada sobre el separador «Docentes» (subiendo) queda al final de «Perfil».
    const sube = construirEstructura(ordenar(moverLamina(ids, "h", "g")));
    const perfil = sube.nodos.find((n) => n.clase === "capitulo" && n.titulo === "Perfil");
    expect(perfil?.clase === "capitulo" && perfil.laminas.map((l) => l.id)).toEqual(["e", "f", "h"]);
  });

  it("mover un separador mueve sólo el separador: el capítulo se reabre donde cae", () => {
    // El separador «Docentes» soltado sobre «Sexo» (subiendo): «Sexo» pasa a ser de «Docentes».
    const e = construirEstructura(ordenar(moverLamina(ids, "g", "f")));
    const docentes = e.nodos.find((n) => n.clase === "capitulo" && n.titulo === "Docentes");
    expect(docentes?.clase === "capitulo" && docentes.laminas.map((l) => l.id)).toEqual(["f", "h"]);
  });
});

describe("idsVisiblesEstructura", () => {
  const e = construirEstructura(plan);
  it("sin plegar, son todas las láminas en el orden del plan", () => {
    expect(idsVisiblesEstructura(e.nodos, () => true)).toEqual(ids);
  });
  it("un capítulo plegado no aporta filas", () => {
    const perfil = e.nodos.find((n) => n.clase === "capitulo" && n.titulo === "Perfil");
    expect(idsVisiblesEstructura(e.nodos, (id) => id !== perfil?.id)).toEqual(["a", "g", "h", "z"]);
  });
});

describe("aplicarArrastre", () => {
  beforeEach(() => {
    usePlanStore.getState().hydrate({
      version: "graficos/4", plan: { slides: plan }, presets: {}, w_presets: {}, selected_slide_id: null,
      paletas: {}, iconos: [], overrides_reusables: [], debug_ph: { activo: false, color: "#FF00FF", lwd: 0.6 },
    } as unknown as GraficosConfig);
  });

  it("un arrastre es un solo paso de deshacer, aunque cruce varios lugares", () => {
    const orden = () => usePlanStore.getState().plan.slides.map((x) => x.id);
    expect(usePlanStore.getState().past).toHaveLength(0);
    expect(aplicarArrastre(usePlanStore.getState(), orden(), "a", "h", agrupadorDelPlan.cortar)).toBe(true);
    expect(orden()).toEqual(["d", "e", "f", "g", "h", "a", "z"]);
    expect(usePlanStore.getState().past).toHaveLength(1);
    usePlanStore.getState().undo();
    expect(orden()).toEqual(ids);
    expect(usePlanStore.getState().past).toHaveLength(0);
  });

  it("soltar sin cambio no escribe ni deja paso de deshacer", () => {
    const st = usePlanStore.getState();
    expect(aplicarArrastre(st, ids, "e", "e", agrupadorDelPlan.cortar)).toBe(false);
    expect(usePlanStore.getState().past).toHaveLength(0);
    expect(usePlanStore.getState().dirty).toBe(false);
  });

  it("abre paso propio aunque la edición anterior estuviera agrupándose", () => {
    let cortes = 0;
    const plano = { moveSlideTo: () => undefined };
    aplicarArrastre(plano, ids, "e", "h", () => { cortes += 1; });
    expect(cortes).toBe(1);
  });
});
