// @vitest-environment happy-dom
// ADR 0137: la ranura de un tipo retirado dice qué era, qué lo reemplaza y, si el reemplazo es un tipo del registro,
// lo cambia con un clic. El número del ADR va sólo en el detalle del «?».
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { GraficadorRetirado } from "../../../../api/graficos";
import { RanuraRetirada } from "./RanuraRetirada";

let host: HTMLDivElement;
let root: Root;

const RADAR: GraficadorRetirado = {
  name: "p_dim_radar", titulo_humano: "Radar por dimensiones", adr: "0137",
  reemplazo: { texto: "Media y rango sobre la columna del índice", graficador: "p_media_rango" },
};

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

describe("RanuraRetirada", () => {
  it("nombra el tipo, el reemplazo y cambia por él; el ADR sólo en el detalle", () => {
    const cambios: string[] = [];
    act(() => root.render(
      <RanuraRetirada id="r" ficha={RADAR} reemplazo={{ graficador: "p_media_rango", nombre: "Media y rango" }} onCambiarPor={(g) => cambios.push(g)} />,
    ));
    const nota = host.querySelector("[data-qa='ranura-retirada']")!;
    expect(nota.getAttribute("data-qa-geometry-group")).toBe("graficos/f6-ranura-retirada");
    expect(host.querySelector("strong")?.textContent).toBe("Tipo de gráfico retirado");
    const parrafos = [...host.querySelectorAll("p")].map((p) => p.textContent);
    expect(parrafos[0]).toContain("\"Radar por dimensiones\"");
    expect(parrafos[1]).toBe("Reemplazo: Media y rango sobre la columna del índice.");
    expect(parrafos.join(" ")).not.toMatch(/ADR|0137/);
    expect(host.querySelector("[role='tooltip']")?.textContent).toMatch(/ADR 0137/);
    const boton = [...host.querySelectorAll("button")].find((b) => b.textContent === "Cambiar por Media y rango")!;
    act(() => boton.click());
    expect(cambios).toEqual(["p_media_rango"]);
  });

  it("sin reemplazo del registro no hay botón: queda el selector de tipo de la cabecera", () => {
    act(() => root.render(
      <RanuraRetirada id="r" ficha={{ ...RADAR, reemplazo: { texto: "el FODA del Dashboard", graficador: "" } }} reemplazo={null} onCambiarPor={() => {}} />,
    ));
    expect([...host.querySelectorAll("button")].some((b) => b.textContent?.startsWith("Cambiar por"))).toBe(false);
    expect(host.textContent).toContain("Reemplazo: El FODA del Dashboard.");
  });

  it("R11-3: tras «Cambiar por» el foco vuelve al «Cambiar» de la ranura (la nota se desmonta) y la maqueta marca la retirada", () => {
    const dir = path.dirname(fileURLToPath(import.meta.url));
    const inspector = readFileSync(path.join(dir, "../InspectorLamina.tsx"), "utf8");
    const cambiarPor = inspector.slice(inspector.indexOf("onCambiarPor={(graficador) => {"), inspector.indexOf("}} />", inspector.indexOf("onCambiarPor={(graficador) => {")));
    expect(cambiarPor).toMatch(/cambiarRef\.current\?\.focus\(\)/);
    expect(inspector).toMatch(/ref=\{cambiarRef\}[\s\S]{0,120}className="pulso-f6-ranura-cambiar"/);
    const maqueta = readFileSync(path.join(dir, "../MaquetaLamina.tsx"), "utf8");
    expect(maqueta).toMatch(/is-retirada/);
    expect(maqueta).toMatch(/Tipo retirado: sale en blanco/);
  });
});
