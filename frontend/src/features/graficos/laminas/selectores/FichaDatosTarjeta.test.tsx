// @vitest-environment happy-dom
// Ficha «Datos»: las tres filas fijas, el principal destacado, los públicos con su n y lo que falta, en carga, listo y error.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { InventarioPublico } from "../../../../api/graficosInventario";
import type { EstadoInventario } from "./fichaDatos";
import { FichaDatosTarjeta } from "./FichaDatosTarjeta";
import { usaDeGrafico } from "./fichaDatos";
import { ControlModoLamina } from "./ControlModoLamina";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;
beforeEach(() => { host = document.createElement("div"); document.body.appendChild(host); root = createRoot(host); });
afterEach(() => { act(() => root.unmount()); host.remove(); });

const pub = (base: string, n: number, escala: number): InventarioPublico => ({
  base, publico: base, n,
  preguntas: { escala, opcion_unica: 0, multiple: 0, numerica: 0, abierta: 0 },
  padron: { declarado: false, valor: null, origen: "", motivo: "" },
});
const LISTO: EstadoInventario = { estado: "listo", publicos: [pub("Docentes", 115, 73), pub("Estudiantes", 279, 60)] };

const fila = (clave: string) => host.querySelector<HTMLElement>(`[data-fila-datos="${clave}"]`);

describe("FichaDatosTarjeta", () => {
  it("pinta las tres filas con rótulo directo, el tipo principal destacado y cada público con su n", () => {
    act(() => root.render(<FichaDatosTarjeta usa={usaDeGrafico("p_radar")!} inventario={LISTO} />));
    expect([...host.querySelectorAll("dt")].map((d) => d.textContent)).toEqual(["Preguntas", "Públicos", "Tu estudio"]);
    const chips = [...fila("preguntas")!.querySelectorAll("li")];
    expect(chips[0].dataset.pregunta).toBe("escala");
    expect(chips[0].hasAttribute("data-principal")).toBe(true);
    expect(chips[1].hasAttribute("data-principal")).toBe(false);
    expect(fila("preguntas")!.querySelector("[data-cruce]")?.textContent).toBe("Admite cruce");
    expect(fila("publicos")!.querySelector("[data-publicos]")?.textContent).toBe("Uno o varios");
    expect([...fila("publicos")!.querySelectorAll("[data-base]")].map((c) => c.textContent)).toEqual(["Docentesn = 115", "Estudiantesn = 279"]);
    expect(fila("estudio")!.textContent).toContain("73 preguntas de escala o de opción múltiple en Docentes, 60 en Estudiantes");
    expect(host.querySelector("[data-falta]")).toBeNull();
    const seccion = host.querySelector("[data-ficha-datos]")!;
    expect(seccion.getAttribute("data-qa-geometry-group")).toBe("graficos/f6-ficha-datos");
    expect(seccion.getAttribute("data-qa-geometry-contract")).toBe("intrinsic");
  });

  it("dice qué falta en una línea sin bloquear nada", () => {
    act(() => root.render(<FichaDatosTarjeta usa={usaDeGrafico("p_cobertura")!} inventario={LISTO} />));
    expect([...host.querySelectorAll("[data-falta]")].map((p) => p.textContent)).toEqual(["Usa padrón y ningún público lo tiene declarado."]);
    expect(fila("publicos")!.querySelector("[data-padron]")?.textContent).toBe("Usa padrón");
  });

  it("en carga muestra el bloque del kit y en error el aviso con el detalle", () => {
    act(() => root.render(<FichaDatosTarjeta usa={usaDeGrafico("p_panorama")!} inventario={{ estado: "cargando" }} />));
    expect(fila("estudio")!.querySelector('[data-audit-ready="false"]')).not.toBeNull();
    act(() => root.render(<FichaDatosTarjeta usa={usaDeGrafico("p_panorama")!} inventario={{ estado: "error", mensaje: "Sin conexión" }} />));
    expect(fila("estudio")!.querySelector('[role="alert"]')?.textContent).toContain("No se pudo leer el estudio");
    expect(host.querySelector('[data-audit-ready="false"]')).toBeNull();
  });
});

describe("ControlModoLamina", () => {
  it("marca el modo con que se abrió y deja «Cambiar esta lámina» inactivo sin lámina", () => {
    act(() => root.render(<ControlModoLamina modo="insertar" hayLamina={false} onModo={() => {}} />));
    const radios = [...host.querySelectorAll<HTMLButtonElement>('[role="radio"]')];
    expect(radios.map((r) => r.textContent)).toEqual(["Insertar detrás", "Cambiar esta lámina"]);
    expect(radios[0].getAttribute("aria-checked")).toBe("true");
    expect(radios[1].disabled).toBe(true);
    expect(host.querySelector('[role="radiogroup"]')?.getAttribute("data-qa-geometry-group")).toBe("graficos/f6-selector-modo");
  });

  it("con lámina, las flechas pasan de un modo al otro", () => {
    const elegidos: string[] = [];
    act(() => root.render(<ControlModoLamina modo="cambiar" hayLamina onModo={(m) => elegidos.push(m)} />));
    const radios = [...host.querySelectorAll<HTMLButtonElement>('[role="radio"]')];
    expect(radios[1].getAttribute("aria-checked")).toBe("true");
    radios[1].focus();
    act(() => { radios[1].dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true })); });
    expect(elegidos).toEqual(["insertar"]);
  });
});
