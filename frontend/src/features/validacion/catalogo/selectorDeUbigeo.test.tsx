// @vitest-environment happy-dom
// Selector de un lugar del catálogo de ubigeos (ítem 43): busca mientras se
// escribe, baja en cascada y devuelve el distrito con sus tres niveles y su
// ubigeo. Las llamadas al motor van inyectadas.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { LugarDelCatalogo } from "../../../api/catalogoUbigeo";
import { normalizarLugar } from "../../../api/catalogoUbigeo";
import { SelectorDeUbigeo, type ApiDelSelector } from "./SelectorDeUbigeo";

const lugar = (nivel: LugarDelCatalogo["nivel"], d: string, p: string | null, t: string | null, codigo: string): LugarDelCatalogo => ({
  nivel,
  codigo,
  ubigeo: nivel === "distrito" ? codigo : null,
  departamento: d,
  provincia: p,
  distrito: t,
  ruta: nivel === "distrito" ? `${t} (${p}, ${d})` : nivel === "provincia" ? `${p} (${d})` : d,
});

const COMAS = lugar("distrito", "Lima", "Lima", "Comas", "150110");
const COMAS_JUNIN = lugar("distrito", "Junin", "Concepcion", "Comas", "120206");
const LIMA_DEP = lugar("departamento", "Lima", null, null, "15");
const LIMA_PROV = lugar("provincia", "Lima", "Lima", null, "1501");
const RIMAC = lugar("distrito", "Lima", "Lima", "Rimac", "150128");

function apiFalsa(): ApiDelSelector & { buscar: ReturnType<typeof vi.fn>; cascada: ReturnType<typeof vi.fn> } {
  return {
    buscar: vi.fn(async (q: string) => (q.toLowerCase().startsWith("com") ? [COMAS, COMAS_JUNIN] : q === "lima" ? [LIMA_PROV] : [])),
    cascada: vi.fn(async (dep?: string | null, prov?: string | null) => {
      if (!dep) return { nivel: "departamento" as const, lugares: [LIMA_DEP] };
      if (!prov) return { nivel: "provincia" as const, lugares: [LIMA_PROV] };
      return { nivel: "distrito" as const, lugares: [COMAS, RIMAC] };
    }),
  };
}

describe("SelectorDeUbigeo", () => {
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
  });

  const esperar = async () => {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 5));
    });
  };
  const botones = () => Array.from(host.querySelectorAll<HTMLButtonElement>(".pulso-selector-ubigeo-lista button"));
  const escribir = async (texto: string) => {
    const input = host.querySelector<HTMLInputElement>("input")!;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    act(() => {
      setter.call(input, texto);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await esperar();
  };

  test("busca mientras se escribe y devuelve el distrito con sus tres niveles; un empate muestra los dos", async () => {
    const api = apiFalsa();
    const alElegir = vi.fn();
    act(() => root.render(<SelectorDeUbigeo alElegir={alElegir} api={api} esperaMs={0} />));
    await esperar();
    await escribir("coma");
    expect(api.buscar).toHaveBeenCalledWith("coma", expect.objectContaining({ nivel: "todos" }));
    expect(botones().map((b) => b.textContent)).toEqual(["Comas (Lima, Lima)Distrito, 150110", "Comas (Concepcion, Junin)Distrito, 120206"]);
    act(() => botones()[0].click());
    expect(alElegir).toHaveBeenCalledWith(COMAS);
    expect(alElegir.mock.calls[0][0]).toMatchObject({ departamento: "Lima", provincia: "Lima", distrito: "Comas", ubigeo: "150110" });
  });

  test("sin coincidencias lo dice", async () => {
    act(() => root.render(<SelectorDeUbigeo alElegir={vi.fn()} api={apiFalsa()} esperaMs={0} />));
    await esperar();
    await escribir("narnia");
    expect(host.textContent).toContain('Ningún lugar del catálogo coincide con "narnia".');
  });

  test("baja en cascada de departamento a distrito, y una provincia buscada lleva a sus distritos", async () => {
    const api = apiFalsa();
    const alElegir = vi.fn();
    act(() => root.render(<SelectorDeUbigeo alElegir={alElegir} api={api} esperaMs={0} />));
    await esperar();
    expect(botones().map((b) => b.textContent)).toEqual(["Lima15"]);
    act(() => botones()[0].click());
    await esperar();
    expect(api.cascada).toHaveBeenLastCalledWith("Lima", null, expect.anything());
    act(() => botones()[0].click());
    await esperar();
    expect(api.cascada).toHaveBeenLastCalledWith("Lima", "Lima", expect.anything());
    expect(botones().map((b) => b.textContent)).toEqual(["Comas150110", "Rimac150128"]);
    act(() => botones()[1].click());
    expect(alElegir).toHaveBeenCalledWith(RIMAC);
    // Volver a "Perú" desde la ruta.
    act(() => host.querySelector<HTMLButtonElement>(".pulso-selector-ubigeo-ruta button")!.click());
    await esperar();
    expect(botones().map((b) => b.textContent)).toEqual(["Lima15"]);
    // Buscar una provincia no la elige: baja a sus distritos.
    await escribir("lima");
    act(() => botones()[0].click());
    await esperar();
    expect(alElegir).toHaveBeenCalledTimes(1);
    expect(botones().map((b) => b.textContent)).toEqual(["Comas150110", "Rimac150128"]);
  });

  test("el normalizador descarta un lugar sin nivel y deja null lo ausente", () => {
    expect(normalizarLugar({ nivel: "pais" })).toBeNull();
    expect(normalizarLugar({ nivel: "provincia", codigo: "1501", departamento: "Lima", provincia: "Lima", distrito: "NA", ruta: "Lima (Lima)" })).toEqual({
      nivel: "provincia",
      codigo: "1501",
      ubigeo: null,
      departamento: "Lima",
      provincia: "Lima",
      distrito: null,
      ruta: "Lima (Lima)",
    });
  });
});
