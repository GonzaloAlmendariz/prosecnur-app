// @vitest-environment happy-dom
// ADR 0139: una variante es una tarjeta propia (su id en el radio, el glifo de su graficador) y un tipo que no va en la
// ranura no se esconde ni se apaga: su línea dice por qué.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TarjetaTipoGrafico } from "./TarjetaTipoGrafico";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;
beforeEach(() => { host = document.createElement("div"); document.body.appendChild(host); root = createRoot(host); });
afterEach(() => { act(() => root.unmount()); host.remove(); });

const pintar = (bloqueo: string | null) => act(() => root.render(
  <TarjetaTipoGrafico
    nombreGrupo="g" entrada="p_dumbbell:contraste" tipo="p_dumbbell" nombre="Contraste de públicos"
    descripcion="La misma pregunta en dos públicos." salida="nativa" bloqueo={bloqueo}
    elegida={false} actual={false} onElegir={vi.fn()} onAplicar={vi.fn()}
  />,
));

describe("TarjetaTipoGrafico", () => {
  it("la variante lleva su id en el radio y su nombre", () => {
    pintar(null);
    const radio = host.querySelector<HTMLInputElement>("input[type=radio]");
    expect(radio?.value).toBe("p_dumbbell:contraste");
    expect(host.querySelector("[data-tipo-grafico]")?.getAttribute("data-tipo-grafico")).toBe("p_dumbbell");
    expect(host.textContent).toContain("Contraste de públicos");
    expect(host.textContent).toContain("La misma pregunta en dos públicos.");
  });

  it("bloqueada, dice por qué en su línea y sigue siendo elegible", () => {
    pintar("Esta ranura recibe solo cifras");
    const linea = host.querySelector(".pulso-f6-tarjeta-meta.is-bloqueo");
    expect(linea?.textContent).toBe("Esta ranura recibe solo cifras");
    expect(host.querySelector<HTMLInputElement>("input[type=radio]")?.disabled).toBe(false);
    expect(host.querySelector("[data-bloqueo]")).not.toBeNull();
  });
});
