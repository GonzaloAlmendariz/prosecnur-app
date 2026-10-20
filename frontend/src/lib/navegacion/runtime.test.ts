import { afterEach, describe, expect, it, vi } from "vitest";

import { MANIFIESTO_NAVEGACION, nodoPorClave } from "./manifiesto";
import { campanaQueSigue, instalarPuenteNavegacion } from "./runtime";

function instalar() {
  vi.stubGlobal("window", {
    location: { pathname: "/procesamiento", search: "" },
  });
  const navegar = vi.fn();
  const limpiar = instalarPuenteNavegacion(navegar);
  return { navegar, limpiar, puente: window.__pulsoNav! };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("puente de navegación y direcciones no publicadas", () => {
  it("ya no queda ninguna pestaña que el puente tenga que rechazar", () => {
    const { limpiar, puente } = instalar();
    const noPublicados = MANIFIESTO_NAVEGACION.filter(
      (nodo) => nodo.nivel === "pestana" && !nodo.direccionPublicada,
    );

    // Eran ocho —las de Validación y las del Dashboard—, y el puente las
    // rechazaba: el recorrido del QA visual no podía entrar a ninguna.
    expect(noPublicados).toHaveLength(0);
    // El rechazo sigue siendo la conducta correcta si alguna vuelve a
    // aparecer; se comprueba con una clave que no existe en el manifiesto.
    expect(puente.ir("dashboard/dashboard/inexistente")).toBe(false);
    limpiar();
  });

  it("entra a una pestaña del Dashboard, que antes no publicaba dirección", () => {
    const { navegar, limpiar, puente } = instalar();
    const nodo = nodoPorClave("dashboard/dashboard/relaciones");

    expect(nodo?.direccionPublicada).toBe(true);
    expect(puente.ir(nodo!.clave)).toBe(true);
    expect(navegar).toHaveBeenCalledWith("/tablero?pestana=relaciones");
    limpiar();
  });

  it("conserva la navegación de una pestaña que sí publica dirección", () => {
    const { navegar, limpiar, puente } = instalar();
    const publicado = nodoPorClave("procesamiento/codificacion/codificar");

    expect(publicado?.direccionPublicada).toBe(true);
    expect(puente.ir(publicado!.clave)).toBe(true);
    expect(navegar).toHaveBeenCalledWith("/codificacion?pestana=codificar");
    limpiar();
  });
});

describe("el puente conserva la campaña abierta (ADR 0111 §4)", () => {
  const actual = { modulo: "material-campo", modo: "aulas", campana: "aulas.principal", seccion: "unidades" } as const;

  it("dentro de la misma campaña la conserva", () => {
    expect(campanaQueSigue({ modulo: "material-campo", modo: "aulas", seccion: "accesos" }, actual)).toBe("aulas.principal");
    expect(campanaQueSigue({ modulo: "material-campo", seccion: "accesos" }, actual)).toBe("aulas.principal");
  });

  it("no la arrastra a otro modo ni a otro módulo", () => {
    expect(campanaQueSigue({ modulo: "material-campo", modo: "correo", seccion: "correo" }, actual)).toBeUndefined();
    expect(campanaQueSigue({ modulo: "monitoreo", seccion: "avance" }, actual)).toBeUndefined();
    expect(campanaQueSigue({ modulo: "material-campo" }, null)).toBeUndefined();
  });

  it("`ir` navega con la campaña del alcance actual", () => {
    vi.stubGlobal("window", { location: { pathname: "/material-campo", search: "?modo=aulas&campana=aulas.principal&seccion=unidades" } });
    const navegar = vi.fn();
    const limpiar = instalarPuenteNavegacion(navegar);
    expect(window.__pulsoNav!.ir("material-campo/aulas/accesos/vinculacion")).toBe(true);
    expect(navegar).toHaveBeenCalledWith("/material-campo?modo=aulas&campana=aulas.principal&seccion=accesos&pestana=vinculacion");
    limpiar();
  });
});
