// @vitest-environment happy-dom
// Opciones de Impreso en el .pulso (L36 · DOC.4): el proyecto manda al abrir salvo que la persona ya haya tocado
// algo, cada cambio se guarda tras una espera, una versión se guarda con nombre y «Usar» la restaura.

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { normalizeImpresoGuardado, type ImpresoGuardado } from "../../../api/xlsformImpreso";
import { ESPERA_GUARDADO_MS, useEstadoImpreso, type ControlEstadoImpreso } from "./useEstadoImpreso";
import { textoSincronia, VersionesImpreso } from "./VersionesImpreso";

vi.mock("../../../api/xlsformImpreso", async (importOriginal) => {
  const real = await importOriginal<typeof import("../../../api/xlsformImpreso")>();
  return { ...real, apiImpresoLeer: vi.fn(), apiImpresoGuardar: vi.fn(), apiImpresoGuardarVersion: vi.fn() };
});
const api = await import("../../../api/xlsformImpreso");
const leer = vi.mocked(api.apiImpresoLeer);
const guardar = vi.mocked(api.apiImpresoGuardar);
const guardarVersion = vi.mocked(api.apiImpresoGuardarVersion);

const vacio: ImpresoGuardado = { opciones: "", guardado_en: "", versiones: [] };
const SIN_CANDIDATAS: never[] = [];

let host: HTMLDivElement;
let root: Root;
let control: ControlEstadoImpreso;

function Sonda({ formId }: { formId: string | null }) {
  control = useEstadoImpreso("pulso.test.impreso", SIN_CANDIDATAS, formId);
  return null;
}

async function montar(formId: string | null = "form-i") {
  await act(async () => { root.render(<Sonda formId={formId} />); });
  await act(async () => { await Promise.resolve(); });
}

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  // El `localStorage` de Node que ve happy-dom no es completo: uno en memoria basta.
  const memoria = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => memoria.get(k) ?? null,
    setItem: (k: string, v: string) => { memoria.set(k, v); },
  });
  vi.useFakeTimers();
  leer.mockReset().mockResolvedValue(vacio);
  guardar.mockReset().mockResolvedValue({ ...vacio, guardado_en: "2026-11-01T10:00:00Z" });
  guardarVersion.mockReset();
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("contrato del cliente", () => {
  it("normaliza lo que manda el servidor y descarta versiones sin nombre", () => {
    expect(normalizeImpresoGuardado(null)).toEqual(vacio);
    expect(normalizeImpresoGuardado({
      opciones: '{"columns":1}', guardado_en: "x",
      versiones: [{ nombre: " Piloto ", opciones: "{}", guardado_en: "y" }, { nombre: "", opciones: "{}" }, 3],
    })).toEqual({ opciones: '{"columns":1}', guardado_en: "x", versiones: [{ nombre: "Piloto", opciones: "{}", guardado_en: "y" }] });
  });
});

describe("useEstadoImpreso con el proyecto", () => {
  it("al abrir adopta las opciones del proyecto, aunque la copia local diga otra cosa", async () => {
    localStorage.setItem("pulso.test.impreso", JSON.stringify({ columns: 1 }));
    leer.mockResolvedValue({ opciones: JSON.stringify({ columns: "auto", documentTitle: "Docentes" }), guardado_en: "2026-11-01T09:00:00Z", versiones: [] });
    await montar();
    expect(leer).toHaveBeenCalledWith("form-i");
    expect(control.estado.columns).toBe("auto");
    expect(control.estado.documentTitle).toBe("Docentes");
    expect(control.sincronia.fase).toBe("guardado");
  });

  it("si la persona ya cambió algo mientras llegaba, gana lo suyo", async () => {
    let soltar: (g: ImpresoGuardado) => void = () => undefined;
    leer.mockReturnValue(new Promise((r) => { soltar = r; }));
    await act(async () => { root.render(<Sonda formId="form-i" />); });
    act(() => control.actualizar({ columns: 1 }));
    await act(async () => { soltar({ opciones: JSON.stringify({ columns: 2 }), guardado_en: "", versiones: [] }); });
    expect(control.estado.columns).toBe(1);
  });

  it("guarda en el proyecto una sola vez tras la espera, y también en la copia local", async () => {
    await montar();
    act(() => control.actualizar({ documentTitle: "E" }));
    act(() => control.actualizar({ documentTitle: "En" }));
    expect(guardar).not.toHaveBeenCalled();
    expect(JSON.parse(localStorage.getItem("pulso.test.impreso") ?? "{}").documentTitle).toBe("En");
    await act(async () => { vi.advanceTimersByTime(ESPERA_GUARDADO_MS); await Promise.resolve(); });
    expect(guardar).toHaveBeenCalledTimes(1);
    expect(JSON.parse(guardar.mock.calls[0][1]).documentTitle).toBe("En");
    expect(control.sincronia).toEqual({ fase: "guardado", en: "2026-11-01T10:00:00Z" });
  });

  it("si el proyecto no guarda, la sincronía dice la causa", async () => {
    guardar.mockRejectedValue(new Error("sin sesión"));
    await montar();
    act(() => control.actualizar({ columns: 1 }));
    await act(async () => { vi.advanceTimersByTime(ESPERA_GUARDADO_MS); await Promise.resolve(); });
    expect(control.sincronia).toEqual({ fase: "error", causa: "sin sesión" });
    expect(textoSincronia(control.sincronia)).toContain("sin sesión");
  });

  it("sin formulario no habla con el servidor", async () => {
    await montar(null);
    act(() => control.actualizar({ columns: 1 }));
    await act(async () => { vi.advanceTimersByTime(ESPERA_GUARDADO_MS); });
    expect(leer).not.toHaveBeenCalled();
    expect(guardar).not.toHaveBeenCalled();
  });

  it("guarda una versión con nombre y «Usar» la restaura", async () => {
    const piloto = { nombre: "Piloto", opciones: JSON.stringify({ columns: 1 }), guardado_en: "2026-11-01T10:00:00Z" };
    guardarVersion.mockResolvedValue({ opciones: piloto.opciones, guardado_en: piloto.guardado_en, versiones: [piloto] });
    await montar();
    let ok = false;
    await act(async () => { ok = await control.guardarVersion("  Piloto "); });
    expect(ok).toBe(true);
    expect(guardarVersion.mock.calls[0][1]).toBe("Piloto");
    expect(control.versiones.map((v) => v.nombre)).toEqual(["Piloto"]);
    act(() => control.actualizar({ columns: 2 }));
    act(() => control.usarVersion(piloto));
    expect(control.estado.columns).toBe(1);
  });
});

describe("VersionesImpreso", () => {
  it("lista las versiones con su botón «Usar» y avisa cuando no hay", () => {
    const con = renderToStaticMarkup(
      <VersionesImpreso sincronia={{ fase: "local" }} puedeGuardar onGuardar={async () => true} onUsar={() => undefined}
        versiones={[{ nombre: "Campo", opciones: "{}", guardado_en: "2026-11-01T10:00:00Z" }]} />,
    );
    expect(con).toContain("Campo");
    expect(con).toContain("Usar");
    const sin = renderToStaticMarkup(
      <VersionesImpreso sincronia={{ fase: "local" }} puedeGuardar={false} onGuardar={async () => true} onUsar={() => undefined} versiones={[]} />,
    );
    expect(sin).toContain("Aún no hay versiones guardadas.");
  });
});
