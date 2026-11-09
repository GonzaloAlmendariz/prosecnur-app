// @vitest-environment happy-dom
// El lateral de la regla dentro del diálogo del mazo: no es un diálogo (ningún rol de diálogo), Escape con el foco dentro
// lo cierra y no llega al diálogo (que escucha en document), y con el foco fuera no lo toca.
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, test, vi } from "vitest";
import type { PropuestaMazo } from "./modeloMazo";

vi.mock("../reglaPreguntas/ReglaPreguntas", () => ({
  ReglaPreguntas: ({ rotulo }: { rotulo: string }) => <button type="button">{rotulo}</button>,
}));

import { EdicionReglaMazo } from "./EdicionReglaMazo";

const P: PropuestaMazo & { graficador: string } = {
  id: "contraste", clase: "contraste", tarjeta: "p_slide_1_grafico:contraste", tipo: "p_slide_1_grafico",
  nombre: "Contraste de públicos", claseTarjeta: "grafico", publicos: ["docentes", "estudiantes"],
  graficador: "p_dumbbell", slot: "grafico", args: { regla: { tipo: "mayor_diferencia", n: 13 } },
  reglaEnPalabras: "", falta: null,
};

describe("EdicionReglaMazo", () => {
  test("aside sin rol de diálogo; Escape dentro lo cierra y no llega a document; fuera no hace nada", () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const onCerrar = vi.fn();
    const enDocumento = vi.fn();
    document.addEventListener("keydown", enDocumento, true);
    const host = document.createElement("div");
    const fuera = document.createElement("button");
    document.body.append(host, fuera);
    const root = createRoot(host);
    act(() => root.render(<EdicionReglaMazo id="lat" propuesta={P} scope="active" onRegla={() => undefined} onCerrar={onCerrar} />));

    const aside = host.querySelector("aside");
    expect(aside?.id).toBe("lat");
    expect(host.querySelector(`[role=${"dialog"}]`)).toBeNull();
    expect(host.textContent).toContain("Regla de preguntas");
    // Al abrir, el foco entra al lateral.
    expect(aside?.contains(document.activeElement)).toBe(true);

    act(() => { document.activeElement?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); });
    expect(onCerrar).toHaveBeenCalledTimes(1);
    expect(enDocumento).not.toHaveBeenCalled();

    fuera.focus();
    act(() => { fuera.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); });
    expect(onCerrar).toHaveBeenCalledTimes(1);
    expect(enDocumento).toHaveBeenCalledTimes(1);

    act(() => root.unmount());
    document.removeEventListener("keydown", enDocumento, true);
    host.remove();
    fuera.remove();
  });
});
