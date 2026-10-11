// @vitest-environment happy-dom
/**
 * Dock del header con los ocho módulos agregados (L35). happy-dom no mide
 * layout, así que el cupo se inyecta mockeando `useCupoDelDock`; la geometría
 * real (ningún tile cruza el borde a 1440 y a 1024) se verifica en la captura.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { DOCK_GEOMETRIA_POR_DEFECTO } from "./moduleDockModel";

const medida = vi.hoisted(() => ({ cupo: null as number | null }));

vi.mock("./useCupoDelDock", () => ({
  useCupoDelDock: () => ({ cupo: medida.cupo, geometria: DOCK_GEOMETRIA_POR_DEFECTO }),
}));

vi.mock("../features/project/ProjectModulesContext", () => ({
  useProjectModules: () => ({
    addedSlugs: [
      "diseno-estudio",
      "procesamiento",
      "calc-muestra",
      "editor-xlsform",
      "hojas-ruta",
      "recopiladores",
      "monitoreo",
      "dashboard",
    ],
  }),
}));

const { ModuleSwitcher } = await import("./Layout");

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

function montar(ruta: string, cupo: number | null) {
  medida.cupo = cupo;
  act(() =>
    root.render(
      <MemoryRouter initialEntries={[ruta]}>
        <ModuleSwitcher />
      </MemoryRouter>,
    ),
  );
}

function items(): HTMLLIElement[] {
  return Array.from(host.querySelectorAll<HTMLLIElement>("nav > ul.pulso-module-dock > li"));
}

describe("dock de módulos con ocho módulos (L35)", () => {
  test("con cupo suficiente: nueve destinos, «Agregar» último y el activo con su nombre", () => {
    montar("/monitoreo", 1000);
    const lis = items();
    expect(lis).toHaveLength(9);
    const ultimo = lis[lis.length - 1].querySelector("a");
    expect(ultimo?.getAttribute("aria-label")).toBe("Agregar módulo");
    const activos = host.querySelectorAll('a[aria-current="page"]');
    expect(activos).toHaveLength(1);
    expect(activos[0].querySelector(".pulso-module-tile-name")?.textContent).toBe("Monitoreo");
    expect(host.querySelector(".pulso-module-tile-more")).toBeNull();
    // Sin `title`: la burbuja es por hover y foco, el nombre va en aria-label.
    expect(host.querySelector("[title]")).toBeNull();
    expect(host.querySelector("nav")?.getAttribute("data-dock-recogidos")).toBe("0");
  });

  test("sin cupo: recoge en «Más módulos», el activo sigue visible y los ocultos son alcanzables", async () => {
    montar("/tablero", 260);
    const lis = items();
    const ultimo = lis[lis.length - 1].querySelector("a");
    expect(ultimo?.getAttribute("aria-label")).toBe("Agregar módulo");
    const activo = host.querySelector<HTMLAnchorElement>('a[aria-current="page"]');
    expect(activo?.getAttribute("href")).toBe("/tablero");
    expect(activo?.textContent).toContain("Dashboard");

    const mas = host.querySelector<HTMLButtonElement>("button.pulso-module-tile-more");
    expect(mas).not.toBeNull();
    const enDock = Array.from(host.querySelectorAll<HTMLAnchorElement>(".pulso-module-dock a.pulso-module-tile:not(.pulso-module-tile-add)"));
    const recogidos = Number(host.querySelector("nav")?.getAttribute("data-dock-recogidos"));
    expect(recogidos).toBeGreaterThan(0);
    expect(mas?.getAttribute("aria-label")).toBe(`Más módulos (${recogidos})`);
    expect(enDock.length + recogidos).toBe(8);
    // «Más módulos» va justo antes de «Agregar».
    expect(lis[lis.length - 2].querySelector("button.pulso-module-tile-more")).not.toBeNull();

    await act(async () => {
      mas?.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, button: 0 }));
      mas?.click();
    });
    const panel = document.querySelector<HTMLElement>(".pulso-module-dock-more");
    expect(panel).not.toBeNull();
    const enMenu = Array.from(panel?.querySelectorAll<HTMLAnchorElement>("nav[aria-label='Más módulos'] a") ?? []);
    expect(enMenu).toHaveLength(recogidos);
    const todos = new Set([...enDock, ...enMenu].map((a) => a.getAttribute("href")));
    expect(todos.size).toBe(8);
    expect(todos.has("/tablero")).toBe(true);

    // Elegir un destino cierra el panel.
    await act(async () => {
      enMenu[0].click();
    });
    expect(document.querySelector(".pulso-module-dock-more")).toBeNull();
  });
});
