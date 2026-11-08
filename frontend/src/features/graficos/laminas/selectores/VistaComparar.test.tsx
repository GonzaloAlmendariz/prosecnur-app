// @vitest-environment happy-dom
// «Comparar»: el botón de la tarjeta respeta el tope de dos y la vista partida pinta dos columnas con su ficha y «Usar esta».
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { usaDeGrafico } from "./fichaDatos";
import { TarjetaTipoLamina } from "./TarjetaTipoLamina";
import { VistaComparar, type ColumnaComparar } from "./VistaComparar";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;
beforeEach(() => { host = document.createElement("div"); document.body.appendChild(host); root = createRoot(host); });
afterEach(() => { act(() => root.unmount()); host.remove(); });

describe("Comparar en la tarjeta", () => {
  it("con el tope lleno, el botón de una tarjeta nueva queda inactivo y no agrega", () => {
    let alternadas = 0;
    act(() => root.render(
      <TarjetaTipoLamina nombreGrupo="g" opcion="p_slide_2_graficos" tipo="p_slide_2_graficos" nombre="Dos gráficos" clase="lamina"
        meta="" uso="" graficos={{}} variante={null} elegida={false} actual={false} sobrantes={0} onElegir={() => {}} onAplicar={() => {}}
        comparar={{ marcada: false, puede: false, onAlternar: () => { alternadas += 1; } }} />,
    ));
    const boton = host.querySelector<HTMLButtonElement>("[data-comparar-tarjeta]")!;
    expect(boton.getAttribute("aria-label")).toBe("Comparar “Dos gráficos”");
    expect(boton.getAttribute("aria-disabled")).toBe("true");
    expect(boton.closest("label")).toBeNull();
    act(() => boton.click());
    expect(alternadas).toBe(0);
  });
});

describe("VistaComparar", () => {
  const columnas: ColumnaComparar[] = [
    { opcion: "p_slide_1_grafico:panorama", tipo: "p_slide_1_grafico", nombre: "Panorama de públicos", clase: "resumen",
      glifo: "p_panorama", usa: usaDeGrafico("p_panorama"), admite: "1 gráfico", actual: false, sobrantes: 0 },
    { opcion: "p_slide_2_graficos", tipo: "p_slide_2_graficos", nombre: "Dos gráficos", clase: "lamina",
      usa: null, admite: "2 gráficos", actual: false, sobrantes: 1 },
  ];

  it("dos columnas pares con hueco 16:9, ficha o «Admite», y «Usar esta» por columna; el foco entra al título", () => {
    const usadas: string[] = [];
    act(() => root.render(
      <VistaComparar columnas={columnas} inventario={{ estado: "cargando" }} modo="cambiar"
        onUsar={(op) => usadas.push(op)} onQuitar={() => {}} onVolver={() => {}} />,
    ));
    const grupo = host.querySelector("[data-qa-geometry-group='graficos/f6-selector-comparar']")!;
    expect(grupo.getAttribute("data-qa-geometry-contract")).toBe("equal");
    expect(grupo.querySelectorAll(":scope > [data-qa-geometry-member]")).toHaveLength(2);
    expect(host.querySelectorAll("[data-hueco-miniatura]")).toHaveLength(2);
    expect(host.querySelectorAll("[data-ficha-datos]")).toHaveLength(1);
    expect(host.textContent).toContain("Quita 1 gráfico");
    expect(document.activeElement?.textContent).toBe("Comparar");
    const usar = [...host.querySelectorAll<HTMLButtonElement>("[data-usar-comparada]")];
    expect(usar.map((b) => b.textContent)).toEqual(["Usar esta", "Usar esta"]);
    act(() => usar[1].click());
    expect(usadas).toEqual(["p_slide_2_graficos"]);
  });
});
