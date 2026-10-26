// @vitest-environment happy-dom
/**
 * Interacción real de la primitiva Dialog (L1, gate §7: «vitest de trap,
 * Escape y foco»). Este es el ÚNICO archivo con DOM: el entorno global de
 * Vitest sigue sin DOM y `Dialog.test.tsx` cubre el marcado con
 * `renderToStaticMarkup`. Sin Testing Library: `react-dom/client` + `act` y
 * eventos nativos, que es lo que Radix escucha.
 */
import { act, useState, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import type { PanelDeclarado } from "../lib/navegacion/paneles";
import { Dialog, resolverRetornoDeFoco } from "./Dialog";

const PANEL_DEMO: PanelDeclarado = { id: "demo", label: "Demo", clase: "dialogo" };

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

function render(nodo: ReactNode) {
  act(() => root.render(nodo));
}

/** Radix devuelve el foco en un `setTimeout(0)` tras desmontar el FocusScope. */
async function tick() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

function overlay(): HTMLElement | null {
  return document.querySelector<HTMLElement>(".pulso-overlay");
}

function tecla(destino: Element, key: string, shiftKey = false) {
  act(() => {
    destino.dispatchEvent(new KeyboardEvent("keydown", { key, shiftKey, bubbles: true, cancelable: true }));
  });
}

function boton(nombre: string): HTMLButtonElement {
  const encontrado = Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find(
    (b) => (b.getAttribute("aria-label") ?? b.textContent ?? "").trim() === nombre,
  );
  if (!encontrado) throw new Error(`no hay botón «${nombre}»`);
  return encontrado;
}

function click(el: HTMLElement) {
  act(() => {
    el.focus();
    el.click();
  });
}

/** Diálogo controlado con un disparador externo (no un `Radix.Trigger`). */
function Controlado() {
  const [abierto, setAbierto] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setAbierto(true)}>
        Abrir
      </button>
      <Dialog
        open={abierto}
        onOpenChange={setAbierto}
        title="Controlado"
        module={null}
        footer={
          <>
            <button type="button">Omitir</button>
            <button type="button">Guardar</button>
          </>
        }
      >
        <p>cuerpo</p>
      </Dialog>
    </>
  );
}

describe("Dialog — Escape, trap y foco (DOM real)", () => {
  test("Escape cierra el diálogo y borra ?panel= de la dirección", () => {
    const visto: { search: string } = { search: "" };
    function Sonda() {
      visto.search = useLocation().search;
      return null;
    }
    render(
      <MemoryRouter initialEntries={["/tablero?seccion=resumen&panel=demo"]}>
        <Sonda />
        <Dialog panel={PANEL_DEMO} title="Direccionable" module={null}>
          <button type="button">Dentro</button>
        </Dialog>
      </MemoryRouter>,
    );
    const dialogo = overlay();
    expect(dialogo).not.toBeNull();
    expect(dialogo?.getAttribute("data-pulso-panel")).toBe("demo");
    expect(dialogo?.contains(document.activeElement)).toBe(true);

    tecla(document.activeElement ?? document.body, "Escape");

    expect(overlay()).toBeNull();
    expect(visto.search).not.toContain("panel=");
    expect(visto.search).toContain("seccion=resumen");
  });

  test("Tab y Shift+Tab quedan dentro: el foco da la vuelta en los extremos", () => {
    render(<Controlado />);
    click(boton("Abrir"));
    const dialogo = overlay();
    expect(dialogo).not.toBeNull();

    const cerrar = boton("Cerrar");
    const guardar = boton("Guardar");
    // Último → Tab → primero.
    act(() => guardar.focus());
    tecla(guardar, "Tab");
    expect(document.activeElement).toBe(cerrar);
    // Primero → Shift+Tab → último.
    tecla(cerrar, "Tab", true);
    expect(document.activeElement).toBe(guardar);
    // Un foco que escapa al resto de la app vuelve dentro.
    act(() => boton("Abrir").focus());
    expect(dialogo?.contains(document.activeElement)).toBe(true);
  });

  test("al cerrar, el foco vuelve al disparador externo", async () => {
    render(<Controlado />);
    const abrir = boton("Abrir");
    click(abrir);
    expect(overlay()?.contains(document.activeElement)).toBe(true);

    tecla(document.activeElement ?? document.body, "Escape");
    await tick();

    expect(overlay()).toBeNull();
    expect(document.activeElement).toBe(abrir);
  });

  test("si el disparador se desmontó, el foco cae en returnFocusTo y no en body", async () => {
    // Un ítem de menú que desaparece al abrir el diálogo: el caso de Paletas
    // abierto desde «Más acciones».
    function DesdeMenu() {
      const [abierto, setAbierto] = useState(false);
      return (
        <>
          <button type="button" aria-label="Más acciones (3)">
            …
          </button>
          {!abierto ? (
            <button type="button" onClick={() => setAbierto(true)}>
              Paletas
            </button>
          ) : null}
          <Dialog
            open={abierto}
            onOpenChange={setAbierto}
            title="Paletas"
            module={null}
            returnFocusTo='button[aria-label^="Más acciones"]'
          >
            <p>cuerpo</p>
          </Dialog>
        </>
      );
    }
    render(<DesdeMenu />);
    click(boton("Paletas"));
    expect(overlay()).not.toBeNull();

    tecla(document.activeElement ?? document.body, "Escape");
    await tick();

    expect(overlay()).toBeNull();
    expect(document.activeElement).not.toBe(document.body);
    expect(document.activeElement?.getAttribute("aria-label")).toBe("Más acciones (3)");
  });

  test("si el disparador se desmonta DESPUÉS de recibir el foco, el foco pasa a returnFocusTo", async () => {
    // El caso real de «Más acciones»: el popover del menú sigue montado bajo
    // el diálogo y se cierra con el mismo Escape, con animación de salida.
    // El cierre del menú se dispara a mano, después de comprobar el primer
    // retorno, para que el orden no dependa de temporizadores.
    const cerrarMenu: { fn: () => void } = { fn: () => undefined };
    function MenuQueSeCierraTarde() {
      const [abierto, setAbierto] = useState(false);
      const [menu, setMenu] = useState(true);
      cerrarMenu.fn = () => setMenu(false);
      return (
        <>
          <button type="button" aria-label="Más acciones (3)">
            …
          </button>
          {menu ? (
            <button type="button" onClick={() => setAbierto(true)}>
              Paletas
            </button>
          ) : null}
          <Dialog
            open={abierto}
            onOpenChange={setAbierto}
            title="Paletas"
            module={null}
            returnFocusTo='button[aria-label^="Más acciones"]'
          >
            <p>cuerpo</p>
          </Dialog>
        </>
      );
    }
    render(<MenuQueSeCierraTarde />);
    click(boton("Paletas"));
    tecla(document.activeElement ?? document.body, "Escape");
    await tick();
    // Primero vuelve al ítem, que todavía existe…
    expect(document.activeElement?.textContent).toBe("Paletas");
    // …y cuando el menú termina de cerrarse, al disparador del menú.
    await act(async () => {
      cerrarMenu.fn();
    });
    await tick();
    expect(document.activeElement?.getAttribute("aria-label")).toBe("Más acciones (3)");
  });
});

describe("resolverRetornoDeFoco", () => {
  test("prefiere lo recordado si sigue conectado", () => {
    const recordado = document.createElement("button");
    const alternativa = document.createElement("button");
    alternativa.id = "alt";
    document.body.append(recordado, alternativa);
    expect(resolverRetornoDeFoco(recordado, "#alt", document)).toBe(recordado);
  });

  test("cae en la alternativa (selector o ref) si lo recordado se desmontó", () => {
    const recordado = document.createElement("button");
    const alternativa = document.createElement("button");
    alternativa.id = "alt";
    document.body.append(alternativa);
    expect(resolverRetornoDeFoco(recordado, "#alt", document)).toBe(alternativa);
    expect(resolverRetornoDeFoco(recordado, { current: alternativa }, document)).toBe(alternativa);
  });

  test("sin alternativa conectada devuelve null (Radix decide)", () => {
    const suelto = document.createElement("button");
    expect(resolverRetornoDeFoco(null, undefined, document)).toBeNull();
    expect(resolverRetornoDeFoco(null, "#no-existe", document)).toBeNull();
    expect(resolverRetornoDeFoco(null, { current: suelto }, document)).toBeNull();
  });
});
