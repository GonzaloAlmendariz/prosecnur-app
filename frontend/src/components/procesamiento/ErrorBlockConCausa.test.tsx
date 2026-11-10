// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { ErrorBlock } from "../States";

describe("ErrorBlock sin las props nuevas rinde igual que antes", () => {
  test("solo con label y detail: la franja compacta, con el código al final", () => {
    const html = renderToStaticMarkup(<ErrorBlock label="No se pudo auditar" detail="[E_TIMEOUT] El motor no respondió" />);
    expect(html.replace(/<svg[\s\S]*?<\/svg>/, "<svg/>")).toBe(
      '<div role="alert" class="pulso-error-block">' +
        '<span class="pulso-error-block-icon" aria-hidden="true"><svg/></span>' +
        '<span class="pulso-error-block-copy"><strong>No se pudo auditar</strong>' +
        '<span class="pulso-error-block-detail">El motor no respondió<code class="pulso-error-block-code">E_TIMEOUT</code></span>' +
        "</span></div>",
    );
    expect(html).toContain('width="14"');
  });

  test("sin nada: el rótulo por defecto y ninguna pieza de la forma con causa", () => {
    const html = renderToStaticMarkup(<ErrorBlock />);
    expect(html).toContain("<strong>No se pudo completar</strong>");
    expect(html).not.toContain("con-causa");
    expect(html).not.toContain("data-variante");
    expect(html).not.toContain("<button");
  });
});

describe("ErrorBlock con causa", () => {
  let contenedor: HTMLDivElement;
  let raiz: Root;
  let portapapelesOriginal: PropertyDescriptor | undefined;
  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    portapapelesOriginal = Object.getOwnPropertyDescriptor(navigator, "clipboard");
    contenedor = document.createElement("div");
    document.body.appendChild(contenedor);
    raiz = createRoot(contenedor);
  });
  afterEach(() => {
    act(() => raiz.unmount());
    contenedor.remove();
    if (portapapelesOriginal) Object.defineProperty(navigator, "clipboard", portapapelesOriginal);
    else Reflect.deleteProperty(navigator, "clipboard");
    vi.restoreAllMocks();
  });

  function conPortapapeles(writeText: (texto: string) => Promise<void>) {
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
  }

  test("la causa, lo que no cambió y las acciones pasan a la forma centrada; solo el mensaje es la alerta", () => {
    act(() =>
      raiz.render(
        <ErrorBlock
          label="No se pudo leer la encuesta"
          causa="La conexión con la plataforma venció el 8 nov. Hay que volver a autorizarla."
          queda="La base sigue como estaba: 293 respuestas, leídas el 9 nov."
          acciones={<button type="button">Volver a conectar</button>}
        />,
      ),
    );
    const bloque = contenedor.querySelector(".pulso-error-block");
    expect(bloque?.classList.contains("pulso-error-block--con-causa")).toBe(true);
    expect(bloque?.getAttribute("data-variante")).toBe("en-superficie");
    const alerta = contenedor.querySelector('[role="alert"]');
    expect(alerta?.querySelector(".pulso-error-block-titulo")?.textContent).toBe("No se pudo leer la encuesta");
    expect(alerta?.querySelector(".pulso-error-block-causa")?.textContent).toBe(
      "La conexión con la plataforma venció el 8 nov. Hay que volver a autorizarla.",
    );
    const queda = alerta?.querySelector(".pulso-error-block-queda");
    expect(queda?.textContent).toBe("La base sigue como estaba: 293 respuestas, leídas el 9 nov.");
    expect(queda?.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
    const boton = contenedor.querySelector(".pulso-error-block-acciones button");
    expect(boton?.textContent).toBe("Volver a conectar");
    expect(alerta?.contains(boton ?? null)).toBe(false);
    expect(contenedor.querySelector(".pulso-error-block-id")).toBeNull();
  });

  test("sin causa propia se usa el mensaje de detail, con el código al final", () => {
    act(() => raiz.render(<ErrorBlock label="No se pudo auditar" detail="[E_TIMEOUT] El motor no respondió" queda="Las decisiones guardadas no cambiaron." />));
    const causa = contenedor.querySelector(".pulso-error-block-causa");
    expect(causa?.textContent).toBe("El motor no respondióE_TIMEOUT");
    expect(causa?.querySelector("code.pulso-error-block-code")?.textContent).toBe("E_TIMEOUT");
  });

  test("la variante enmarcada cambia el atributo y no declara capacidad reservada", () => {
    act(() => raiz.render(<ErrorBlock label="No se pudo leer la encuesta" causa="La autorización venció." variante="enmarcado" />));
    const bloque = contenedor.querySelector(".pulso-error-block--con-causa");
    expect(bloque?.getAttribute("data-variante")).toBe("enmarcado");
    expect(bloque?.hasAttribute("data-qa-geometry-capacity")).toBe(false);
    act(() => raiz.render(<ErrorBlock label="No se pudo leer la encuesta" causa="La autorización venció." />));
    expect(contenedor.querySelector(".pulso-error-block--con-causa")?.getAttribute("data-qa-geometry-capacity")).toBe("owned");
  });

  test("el identificador se muestra y su botón, con nombre accesible, lo copia al portapapeles", async () => {
    const writeText = vi.fn<(texto: string) => Promise<void>>().mockResolvedValue(undefined);
    conPortapapeles(writeText);
    act(() => raiz.render(<ErrorBlock label="No se pudieron cargar los casos" causa="Es un error inesperado de la app." identificador="7F3A-21C4" />));
    expect(contenedor.querySelector(".pulso-error-block-id code")?.textContent).toBe("7F3A-21C4");
    const boton = contenedor.querySelector<HTMLButtonElement>(".pulso-error-block-id button");
    expect(boton?.getAttribute("aria-label")).toBe("Copiar el identificador");
    expect(contenedor.querySelector(".pulso-error-block-id-aviso")?.textContent).toBe("");
    await act(async () => {
      boton?.click();
    });
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText).toHaveBeenCalledWith("7F3A-21C4");
    expect(boton?.getAttribute("aria-label")).toBe("Identificador copiado");
    expect(contenedor.querySelector(".pulso-error-block-id-aviso")?.textContent).toBe("Copiado");
  });

  test("si no se pudo copiar, lo dice y no anuncia que copió", async () => {
    // Los dos caminos de lib/portapapeles fallan: el asíncrono rechaza y execCommand no copia.
    conPortapapeles(() => Promise.reject(new Error("denegado")));
    const sinCopia = vi.fn(() => false);
    Object.defineProperty(document, "execCommand", { configurable: true, value: sinCopia });
    act(() => raiz.render(<ErrorBlock label="No se pudieron cargar los casos" identificador="7F3A-21C4" />));
    const boton = contenedor.querySelector<HTMLButtonElement>(".pulso-error-block-id button");
    await act(async () => {
      boton?.click();
    });
    Reflect.deleteProperty(document, "execCommand");
    expect(sinCopia).toHaveBeenCalledWith("copy");
    expect(boton?.getAttribute("aria-label")).toBe("Copiar el identificador");
    expect(contenedor.querySelector(".pulso-error-block-id-aviso")?.textContent).toBe("No se pudo copiar");
  });

  test("sin identificador no hay botón de copiar", () => {
    act(() => raiz.render(<ErrorBlock label="No se pudo leer la encuesta" causa="La autorización venció." />));
    expect(contenedor.querySelector("button")).toBeNull();
  });
});
