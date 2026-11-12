// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import type { SessionState } from "../../../api/core";

const api = vi.hoisted(() => ({ apiV2Limpieza: vi.fn() }));
const sesion = vi.hoisted(() => ({ state: null as SessionState | null }));

vi.mock("../../../api/validacion", () => api);
vi.mock("../../../lib/SessionContext", () => ({ useSession: () => ({ state: sesion.state }) }));

const { CasosQueCuentanEnBanda, EstadoDelEstudioEnBanda } = await import("./BandaDeProcesamiento");

let host: HTMLDivElement;
let root: Root;

async function pintar(nodo: React.ReactNode, ruta = "/validacion") {
  await act(async () => {
    root.render(<MemoryRouter key={ruta} initialEntries={[ruta]}>{nodo}</MemoryRouter>);
  });
  await act(async () => { await Promise.resolve(); });
}

const cierre = (cuentan: number | null, recibidos: number | null) => ({
  cierre: { estado: "cerrada", cadena_casos: { momento: "al_cerrar", recibidos, cuentan, fuera: {}, avisos: [] } },
});

beforeEach(() => {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  sesion.state = { xlsform: { name: "f" }, data: { name: "d" }, active_base: "docentes", auditoria_run: true } as unknown as SessionState;
  api.apiV2Limpieza.mockReset();
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

describe("banda de Procesamiento", () => {
  test("pinta los casos que cuentan de la base activa, leídos de la cadena del cierre", async () => {
    api.apiV2Limpieza.mockResolvedValue(cierre(112, 115));
    await pintar(<CasosQueCuentanEnBanda visible />);
    expect(api.apiV2Limpieza).toHaveBeenCalledWith("docentes");
    const pieza = host.querySelector(".pulso-banda-casos");
    expect(pieza?.textContent).toBe("112de 115 casos cuentan");
    expect(pieza?.getAttribute("aria-label")).toMatch(/base activa/);
  });

  test("sin cadena no dibuja nada, y con el informe consolidado ni siquiera la pide", async () => {
    api.apiV2Limpieza.mockResolvedValue({ cierre: { estado: "abierta", cadena_casos: null } });
    await pintar(<CasosQueCuentanEnBanda visible />);
    expect(host.querySelector(".pulso-banda-casos")).toBeNull();

    api.apiV2Limpieza.mockClear();
    await pintar(<CasosQueCuentanEnBanda visible={false} />);
    expect(api.apiV2Limpieza).not.toHaveBeenCalled();
    expect(host.querySelector(".pulso-banda-casos")).toBeNull();
  });

  test("Estado del estudio es un enlace a /procesamiento y se marca como página actual allí", async () => {
    await pintar(<EstadoDelEstudioEnBanda />, "/procesamiento");
    const enlace = host.querySelector("a.pulso-banda-estado");
    expect(enlace?.getAttribute("href")).toBe("/procesamiento");
    expect(enlace?.getAttribute("aria-current")).toBe("page");
    await pintar(<EstadoDelEstudioEnBanda />, "/carga");
    expect(host.querySelector("a.pulso-banda-estado")?.getAttribute("aria-current")).toBeNull();
  });
});
