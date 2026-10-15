import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../lib/SessionContext", () => ({
  useSession: () => ({ sessionId: "sid-1", refresh: async () => {} }),
}));
vi.stubGlobal("localStorage", { getItem: () => "sid-1", setItem: () => {}, removeItem: () => {} });

const { AdaptarAplicacionVista } = await import("./AdaptarAplicacion");
const { selectAplicarEntrada, useAplicarAvisosStore } = await import("./aplicarAvisosStore");

const nada = () => undefined;
const vista = (yaCodificadaEn: string | null) =>
  renderToStaticMarkup(
    createElement(
      MemoryRouter,
      null,
      createElement(AdaptarAplicacionVista, {
        entrada: selectAplicarEntrada("sid-1::2026")(useAplicarAvisosStore.getState()),
        nPreguntas: 3,
        onBackToCodificar: nada,
        onBackToMatrices: nada,
        onAdaptar: nada,
        onJobDone: nada,
        onJobError: nada,
        onJobCancelled: nada,
        onEnfocado: nada,
        yaCodificadaEn,
      }),
    ),
  );

describe("Adaptar con la base «ya viene codificada» (ADR 0106)", () => {
  it("en vez del botón, dice por qué y lleva a cambiarlo en Carga", () => {
    const html = vista("2026");
    expect(html).not.toContain('data-testid="codificacion-adaptar-boton"');
    expect(html).toContain("«2026» ya viene codificada: aquí no se vuelve a codificar.");
    expect(html).toContain('href="/carga?pestana=fuentes&amp;panel=variables-base&amp;foco=2026"');
  });

  it("sin la marca, el botón sigue", () => {
    const html = vista(null);
    expect(html).toContain('data-testid="codificacion-adaptar-boton"');
    expect(html).not.toContain("ya viene codificada");
  });
});
