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
  it("rechaza los cuatro nodos documentales tanto por clave como por objeto", () => {
    const { navegar, limpiar, puente } = instalar();
    const noPublicados = MANIFIESTO_NAVEGACION.filter(
      (nodo) => nodo.nivel === "pestana" && !nodo.direccionPublicada,
    );

    expect(noPublicados).toHaveLength(4);
    for (const nodo of noPublicados) {
      expect(puente.ir(nodo.clave), nodo.clave).toBe(false);
      expect(puente.ir(nodo.direccion), nodo.clave).toBe(false);
    }
    expect(navegar).not.toHaveBeenCalled();
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
