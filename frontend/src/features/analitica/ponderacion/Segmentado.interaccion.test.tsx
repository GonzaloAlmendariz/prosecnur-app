// @vitest-environment happy-dom
/**
 * Teclado de los segmentados de Ponderación. Antes cada opción era una parada
 * de tabulador y las flechas no hacían nada; un grupo de opciones se recorre
 * con flechas y recibe el foco en la opción elegida.
 */
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Segmentado } from "./Segmentado";

const OPCIONES = [
  { valor: "ninguno", rotulo: "Ninguno" },
  { valor: "columna", rotulo: "Columna de la base", ayuda: "El peso de diseño de cada caso." },
  { valor: "estrato", rotulo: "Reequilibrio por estrato" },
] as const;
type Valor = (typeof OPCIONES)[number]["valor"];

const elegidos: Valor[] = [];
function Sonda({ inicial }: { inicial: Valor | null }) {
  const [valor, setValor] = useState<Valor | null>(inicial);
  return (
    <Segmentado<Valor>
      etiqueta="Peso base"
      valor={valor}
      opciones={OPCIONES}
      onCambio={(v) => { elegidos.push(v); setValor(v); }}
    />
  );
}

let host: HTMLDivElement;
let root: Root;
const radios = () => [...host.querySelectorAll<HTMLButtonElement>('[role="radio"]')];
const marcado = () => radios().find((r) => r.getAttribute("aria-checked") === "true")?.textContent;
const tecla = async (key: string) => {
  const foco = document.activeElement as HTMLElement;
  await act(async () => { foco.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true })); });
};
const montar = async (inicial: Valor | null) => {
  await act(async () => { root.render(<Sonda inicial={inicial} />); });
};

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  elegidos.length = 0;
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

describe("Segmentado de Ponderación: teclado", () => {
  it("es un grupo de opciones con nombre y la piel del segmentado de Analítica", async () => {
    await montar("columna");
    const grupo = host.querySelector('[role="radiogroup"]');
    expect(grupo?.getAttribute("aria-label")).toBe("Peso base");
    expect(grupo?.classList.contains("analitica-segmented")).toBe(true);
    expect(radios()).toHaveLength(3);
    expect(marcado()).toBe("Columna de la base");
    expect(radios()[1].classList.contains("is-on")).toBe(true);
    expect(radios()[1].title).toBe("El peso de diseño de cada caso.");
  });

  it("una sola parada de tabulador, en la opción elegida", async () => {
    await montar("columna");
    expect(radios().map((r) => r.tabIndex)).toEqual([-1, 0, -1]);
  });

  it("sin opción elegida, el foco entra por la primera", async () => {
    await montar(null);
    expect(marcado()).toBeUndefined();
    expect(radios().map((r) => r.tabIndex)).toEqual([0, -1, -1]);
  });

  it("las flechas recorren las opciones, eligen y llevan el foco", async () => {
    await montar("columna");
    radios()[1].focus();
    await tecla("ArrowRight");
    expect(elegidos).toEqual(["estrato"]);
    expect(marcado()).toBe("Reequilibrio por estrato");
    expect(document.activeElement).toBe(radios()[2]);
    expect(radios().map((r) => r.tabIndex)).toEqual([-1, -1, 0]);

    await tecla("ArrowLeft");
    await tecla("ArrowLeft");
    expect(elegidos).toEqual(["estrato", "columna", "ninguno"]);
    expect(marcado()).toBe("Ninguno");
    expect(document.activeElement).toBe(radios()[0]);
  });

  it("el clic sigue eligiendo", async () => {
    await montar("ninguno");
    await act(async () => { radios()[2].click(); });
    expect(elegidos).toEqual(["estrato"]);
    expect(marcado()).toBe("Reequilibrio por estrato");
  });
});
