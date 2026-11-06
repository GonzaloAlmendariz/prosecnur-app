// H10: deshacer por campo. Las ediciones seguidas del mismo control van en un paso; otro control, la pausa, el blur o
// deshacer abren paso nuevo. Y en el store: escribir una palabra en un campo se deshace de una vez, sin perder estado.
import { afterEach, describe, expect, test } from "vitest";
import { crearAgrupador, agrupadorDelPlan, VENTANA_AGRUPAR_MS } from "./historialAgrupado";
import { usePlanStore } from "./store";

describe("crearAgrupador", () => {
  test("mismo control dentro de la ventana agrupa; la pausa, otro control o el blur cortan", () => {
    const a = crearAgrupador(600);
    const campo = {};
    const otro = {};
    a.fijarCampo(campo);
    expect(a.agrupa(0)).toBe(false);     // el primer cambio abre paso
    expect(a.agrupa(200)).toBe(true);
    expect(a.agrupa(700)).toBe(true);    // la ventana se cuenta desde el último cambio
    expect(a.agrupa(1400)).toBe(false);  // pausa de 700 ms: paso nuevo
    a.fijarCampo(otro);
    expect(a.agrupa(1500)).toBe(false);
    a.fijarCampo(null);
    expect(a.agrupa(1600)).toBe(false);  // sin control con foco no se agrupa nunca
    expect(a.agrupa(1650)).toBe(false);
  });

  test("cortar() deja la próxima edición en paso propio", () => {
    const a = crearAgrupador(600);
    const campo = {};
    a.fijarCampo(campo);
    a.agrupa(0);
    a.cortar();
    expect(a.agrupa(100)).toBe(false);
    expect(a.agrupa(200)).toBe(true);
  });

  test("volver al mismo control tras salir abre paso nuevo", () => {
    const a = crearAgrupador(600);
    const campo = {};
    a.fijarCampo(campo);
    a.agrupa(0);
    a.fijarCampo(null);
    a.fijarCampo(campo);
    expect(a.agrupa(100)).toBe(false);
  });
});

describe("store del plan: un paso por campo", () => {
  afterEach(() => {
    agrupadorDelPlan.fijarCampo(null);
    usePlanStore.getState().reset();
  });

  test("escribir letra por letra en un campo se deshace de una vez y se rehace entero", () => {
    const s = usePlanStore.getState();
    s.reset();
    s.addSlide("p_slide_portada");
    const id = usePlanStore.getState().plan.slides[0].id;
    const pasosAntes = usePlanStore.getState().past.length;
    const campo = {};
    agrupadorDelPlan.fijarCampo(campo);
    for (const t of ["E", "Ec", "Eco", "Econ"]) usePlanStore.getState().updateSlidePayload(id, { titulo: t });
    agrupadorDelPlan.fijarCampo(null);
    expect(usePlanStore.getState().past.length).toBe(pasosAntes + 1);
    expect(usePlanStore.getState().plan.slides[0].payload.titulo).toBe("Econ");
    usePlanStore.getState().undo();
    expect(usePlanStore.getState().plan.slides[0].payload.titulo).not.toBe("Econ");
    expect(usePlanStore.getState().plan.slides[0].payload.titulo).not.toBe("E");
    usePlanStore.getState().redo();
    expect(usePlanStore.getState().plan.slides[0].payload.titulo).toBe("Econ");
  });

  test("sin control con foco (acciones de botones fuera de un campo) cada edición es su paso", () => {
    const s = usePlanStore.getState();
    s.reset();
    s.addSlide("p_slide_portada");
    const id = usePlanStore.getState().plan.slides[0].id;
    const pasosAntes = usePlanStore.getState().past.length;
    usePlanStore.getState().updateSlidePayload(id, { titulo: "A" });
    usePlanStore.getState().updateSlidePayload(id, { titulo: "B" });
    expect(usePlanStore.getState().past.length).toBe(pasosAntes + 2);
  });

  test("la ventana es de 600 ms", () => {
    expect(VENTANA_AGRUPAR_MS).toBe(600);
  });
});
