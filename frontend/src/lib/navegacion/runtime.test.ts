import { afterEach, describe, expect, it, vi } from "vitest";

import { MANIFIESTO_NAVEGACION, nodoPorClave } from "./manifiesto";
import { instalarPuenteNavegacion } from "./runtime";

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
