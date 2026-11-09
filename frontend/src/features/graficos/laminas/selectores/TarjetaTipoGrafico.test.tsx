// @vitest-environment happy-dom
// ADR 0139 y su enmienda (2026-11-09): una tarjeta por tipo; si el tipo tiene variantes, la tarjeta ofrece sus versiones
// en un segmentado hermano del radio (no dentro de su etiqueta). Un tipo que no va en la ranura no se esconde ni se
// apaga: su línea dice por qué.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TarjetaTipoGrafico } from "./TarjetaTipoGrafico";
import type { VersionGrafico } from "./versionesGrafico";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;
beforeEach(() => { host = document.createElement("div"); document.body.appendChild(host); root = createRoot(host); });
afterEach(() => { act(() => root.unmount()); host.remove(); });

const VERSIONES: VersionGrafico[] = [
  { id: "p_barras_divergentes", nombre: "Clásica", variante: null },
  { id: "p_barras_divergentes:escala_sin_informacion", nombre: "Con columna de Sin información", variante: null },
];

const pintar = (extra: Partial<Parameters<typeof TarjetaTipoGrafico>[0]> = {}) => act(() => root.render(
  <TarjetaTipoGrafico
    nombreGrupo="g" tipo="p_barras_divergentes" nombre="Multiapilada divergente"
    descripcion="Desacuerdo y acuerdo a cada lado." salida="nativa" bloqueo={null}
    elegida={false} actual={false} onElegir={vi.fn()} onAplicar={vi.fn()}
    {...extra}
  />,
));

describe("TarjetaTipoGrafico", () => {
  it("el radio lleva el tipo y la tarjeta su nombre; sin versiones no hay segmentado", () => {
    pintar();
    expect(host.querySelector<HTMLInputElement>("input[type=radio]")?.value).toBe("p_barras_divergentes");
    expect(host.textContent).toContain("Multiapilada divergente");
    expect(host.querySelector(".pulso-f6-tarjeta-versiones")).toBeNull();
  });

  it("con versiones, el segmentado es hermano de la etiqueta y marca la versión mostrada", () => {
    const onElegirVersion = vi.fn();
    pintar({ versiones: VERSIONES, version: VERSIONES[1].id, versionActual: VERSIONES[1].id, actual: true, onElegirVersion });
    const grupo = host.querySelector("[role=radiogroup]");
    expect(grupo?.getAttribute("aria-label")).toBe('Versión de "Multiapilada divergente"');
    expect(grupo?.closest("label")).toBeNull();
    const opciones = [...host.querySelectorAll<HTMLButtonElement>("[role=radio]")];
    expect(opciones.map((o) => o.textContent)).toEqual(["Clásica", "Con columna de Sin información"]);
    expect(opciones[1].getAttribute("aria-checked")).toBe("true");
    expect(opciones[1].title).toBe("Con columna de Sin información (versión actual)");
    expect(host.querySelector(".pulso-f6-chip.is-actual")?.textContent).toBe("Actual");
    expect(host.querySelector("[data-entrada-catalogo]")?.getAttribute("data-entrada-catalogo")).toBe(VERSIONES[1].id);
    act(() => opciones[0].click());
    expect(onElegirVersion).toHaveBeenCalledWith("p_barras_divergentes");
  });

  it("bloqueada, dice por qué en su línea y sigue siendo elegible", () => {
    pintar({ bloqueo: "Esta ranura recibe solo cifras" });
    const linea = host.querySelector(".pulso-f6-tarjeta-meta.is-bloqueo");
    expect(linea?.textContent).toBe("Esta ranura recibe solo cifras");
    expect(host.querySelector<HTMLInputElement>("input[type=radio]")?.disabled).toBe(false);
    expect(host.querySelector("[data-bloqueo]")).not.toBeNull();
  });
});
