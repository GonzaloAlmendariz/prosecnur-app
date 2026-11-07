// @vitest-environment happy-dom
/**
 * Bandeja «Entregables» de la barra superior: lo generado en la sesión, con un
 * punto de estado quieto, y se vacía al cambiar de sesión.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { EntradaBandeja } from "./bandejaStore";

const sesion = vi.hoisted(() => ({ id: "s1" }));
vi.mock("../../lib/SessionContext", () => ({
  useOptionalSession: () => ({ sessionId: sesion.id }),
}));

const { BandejaEntregables } = await import("./BandejaEntregables");
const { MAX_ENTRADAS_BANDEJA, resumenBandeja, useBandejaEntregables } = await import("./bandejaStore");

const GUARDADO = "C:\\Users\\ana\\Estudios\\HSVG2026\\Entregables\\Procesamiento\\HSVG2026_Frecuencias_07_11_26.xlsx";

function entrada(id: string, estado: EntradaBandeja["estado"]): EntradaBandeja {
  return { id, modulo: "Procesamiento", estado, inicio: 0 };
}

const LISTA = entrada("a", {
  fase: "lista", titulo: "Frecuencias",
  archivos: [{ fileId: "f1", nombre: "HSVG2026_Frecuencias_07_11_26.xlsx", formato: "xlsx", guardadoEn: GUARDADO }],
});
const EN_CURSO = entrada("b", { fase: "en_curso", titulo: "Cruces", paso: 1, pasos: 3, mensaje: "Leyendo la base", porcentaje: null });
const FALLO = entrada("c", { fase: "fallo", titulo: "Informe en PowerPoint", causa: "La lámina 3 no se dibuja.", codigo: null });

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  sesion.id = "s1";
  useBandejaEntregables.getState().vaciar();
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  document.body.innerHTML = "";
});

describe("bandejaStore", () => {
  it("registra la más reciente primero, actualiza en su sitio y tiene tope", () => {
    const st = useBandejaEntregables.getState();
    st.registrar(LISTA);
    st.registrar(EN_CURSO);
    expect(useBandejaEntregables.getState().entradas.map((e) => e.id)).toEqual(["b", "a"]);
    st.actualizar("b", { fase: "fallo", titulo: "Cruces", causa: "x" });
    expect(useBandejaEntregables.getState().entradas[0].estado.fase).toBe("fallo");
    st.actualizar("no-existe", { fase: "fallo", titulo: "?", causa: "x" });
    expect(useBandejaEntregables.getState().entradas).toHaveLength(2);
    st.quitar("a");
    expect(useBandejaEntregables.getState().entradas.map((e) => e.id)).toEqual(["b"]);
    for (let i = 0; i < MAX_ENTRADAS_BANDEJA + 5; i += 1) st.registrar(entrada(`n${i}`, EN_CURSO.estado));
    expect(useBandejaEntregables.getState().entradas).toHaveLength(MAX_ENTRADAS_BANDEJA);
  });

  it("el punto: lo que está en curso manda; luego, si la última falló", () => {
    expect(resumenBandeja([])).toEqual({ total: 0, punto: "inactiva" });
    expect(resumenBandeja([LISTA, EN_CURSO])).toEqual({ total: 2, punto: "en_curso" });
    expect(resumenBandeja([FALLO, LISTA])).toEqual({ total: 2, punto: "fallo" });
    expect(resumenBandeja([LISTA, FALLO])).toEqual({ total: 2, punto: "lista" });
  });
});

describe("BandejaEntregables", () => {
  it("no aparece hasta la primera generación", async () => {
    await act(async () => { root.render(<BandejaEntregables />); });
    expect(host.innerHTML).toBe("");
  });

  it("botón neutro «Entregables N» con punto de estado; el popover lista lo de la sesión", async () => {
    useBandejaEntregables.getState().registrar(LISTA);
    useBandejaEntregables.getState().registrar(FALLO);
    useBandejaEntregables.getState().registrar(EN_CURSO);
    await act(async () => { root.render(<BandejaEntregables />); });
    const boton = host.querySelector<HTMLButtonElement>(".pulso-entregable-bandeja-boton");
    expect(boton?.textContent).toBe("Entregables3");
    expect(boton?.dataset.punto).toBe("en_curso");
    expect(boton?.getAttribute("aria-label")).toBe("Entregables: 3, uno en curso");
    expect(boton?.className).not.toMatch(/primary/);
    await act(async () => { boton?.click(); });
    const lista = document.querySelector(".pulso-entregable-bandeja-lista");
    expect(lista?.getAttribute("data-qa-geometry-group")).toBe("entregables/bandeja");
    const items = Array.from(document.querySelectorAll<HTMLElement>(".pulso-entregable-bandeja-item"));
    expect(items.map((i) => i.dataset.entregableFase)).toEqual(["en_curso", "fallo", "lista"]);
    expect(items[0].textContent).toContain("Paso 1 de 3: leyendo la base");
    expect(items[1].textContent).toContain("La lámina 3 no se dibuja.");
    expect(items[2].textContent).toContain("Guardado en Entregables\\Procesamiento");
    expect(document.querySelectorAll(".pulso-entregable-bandeja a")).toHaveLength(0);
  });

  it("otra sesión (otro proyecto) vacía la bandeja", async () => {
    useBandejaEntregables.getState().registrar(LISTA);
    await act(async () => { root.render(<BandejaEntregables />); });
    expect(host.querySelector(".pulso-entregable-bandeja-boton")).not.toBeNull();
    sesion.id = "s2";
    await act(async () => { root.render(<BandejaEntregables />); });
    expect(useBandejaEntregables.getState().entradas).toEqual([]);
    expect(host.innerHTML).toBe("");
  });
});
