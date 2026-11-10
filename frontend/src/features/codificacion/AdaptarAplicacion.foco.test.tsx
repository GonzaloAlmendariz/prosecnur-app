// @vitest-environment happy-dom
/**
 * Codificación › Adaptar con teclado (QA fase 5b): al pulsar Enter en "Confirmar y adaptar respuestas" el foco
 * caía en `span#codificacion-adaptar-estado.pulso-sr-only`, un elemento invisible de 1×1 sin contorno, y se
 * quedaba ahí. Ahora va al contenedor del kit que aparece debajo, que se ve y lleva el anillo del kit.
 */
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../lib/SessionContext", () => ({
  useSession: () => ({ sessionId: "sid-1", refresh: async () => {} }),
}));

const { AdaptarAplicacionVista, ID_ESTADO_ADAPTAR } = await import("./AdaptarAplicacion");
const { APLICAR_ENTRADA_VACIA } = await import("./aplicarAvisosStore");
type Entrada = typeof APLICAR_ENTRADA_VACIA;

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  document.body.innerHTML = "";
});

/** La vista con su entrada en estado local: "Adaptar" la pasa a `aplicando`, como hace el store. */
function Banco({ inicial }: { inicial: Entrada }) {
  const [entrada, setEntrada] = useState<Entrada>(inicial);
  return (
    <AdaptarAplicacionVista
      entrada={entrada}
      nPreguntas={3}
      onBackToCodificar={() => undefined}
      onBackToMatrices={() => undefined}
      onAdaptar={() => setEntrada({ ...APLICAR_ENTRADA_VACIA, aplicando: true })}
      onCerrarEntrega={() => undefined}
      onEnfocado={() => undefined}
    />
  );
}

const botonAdaptar = () => host.querySelector<HTMLButtonElement>("[data-testid='codificacion-adaptar-boton']");

describe('el foco al pulsar "Adaptar"', () => {
  it("va al contenedor visible que aparece debajo, no a la región invisible", async () => {
    await act(async () => { root.render(<Banco inicial={APLICAR_ENTRADA_VACIA} />); });
    botonAdaptar()?.focus();
    await act(async () => { botonAdaptar()?.click(); });
    const contenedor = host.querySelector<HTMLElement>("[data-entregable-forma='bloque']");
    expect(contenedor?.dataset.entregableFase).toBe("en_curso");
    expect(document.activeElement).toBe(contenedor);
    expect(contenedor?.getAttribute("tabindex")).toBe("-1");
    expect(document.activeElement?.id).not.toBe(ID_ESTADO_ADAPTAR);
    // La región sigue anunciando, sin poder recibir el foco.
    const region = document.getElementById(ID_ESTADO_ADAPTAR);
    expect(region?.getAttribute("aria-live")).toBe("polite");
    expect(region?.hasAttribute("tabindex")).toBe(false);
    expect(region?.textContent).toContain("Revisando el catálogo");
  });

  it('"Reintentar" en el fallo vuelve a dejar el foco en el contenedor al correr de nuevo', async () => {
    const fallo: Entrada = { ...APLICAR_ENTRADA_VACIA, error: "La base cambió mientras se adaptaba." };
    await act(async () => { root.render(<Banco inicial={fallo} />); });
    const contenedor = () => host.querySelector<HTMLElement>("[data-entregable-forma='bloque']");
    expect(contenedor()?.dataset.entregableFase).toBe("fallo");
    // Montar con un fallo no roba el foco.
    expect(document.activeElement).not.toBe(contenedor());
    const reintentar = Array.from(host.querySelectorAll<HTMLButtonElement>("button")).find((b) => b.textContent?.trim() === "Reintentar");
    reintentar?.focus();
    await act(async () => { reintentar?.click(); });
    expect(contenedor()?.dataset.entregableFase).toBe("en_curso");
    expect(document.activeElement).toBe(contenedor());
  });
});
