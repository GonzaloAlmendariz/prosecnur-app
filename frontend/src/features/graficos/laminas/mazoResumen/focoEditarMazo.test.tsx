// @vitest-environment happy-dom
// M7: cerrar la Regla devuelve el foco al «Editar» de su tarjeta, y la tarjeta en edición se marca con aria-current.
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { PropuestaMazo } from "./modeloMazo";

vi.mock("../reglaPreguntas/useConteoRegla", () => ({
  useConteoRegla: () => ({ conteo: null, cargando: false, error: null, codigo: null }),
}));

import { botonEditarDe, volverAlEditar } from "./focoEditarMazo";
import { TarjetaMazo } from "./TarjetaMazo";

const CONTRASTE: PropuestaMazo = {
  id: "contraste", clase: "contraste", tarjeta: "p_slide_1_grafico:contraste", tipo: "p_slide_1_grafico",
  nombre: "Contraste de públicos", claseTarjeta: "resumen", publicos: ["docentes", "estudiantes"],
  graficador: "p_dumbbell", slot: "grafico", args: { estilo: "resumen", regla: { tipo: "mayor_diferencia", n: 13 } },
  reglaEnPalabras: "Las 13 de mayor diferencia", falta: null,
};

const pintar = (editando: boolean) => renderToStaticMarkup(
  <TarjetaMazo numero={1} propuesta={CONTRASTE} elegida={false} editando={editando} scope="active" idLateral="lat"
    onAlternar={() => undefined} onEditar={() => undefined} />,
);

describe("M7: la tarjeta en edición y el foco al cerrar la regla", () => {
  it("aria-current sólo en la tarjeta cuya regla está abierta", () => {
    expect(pintar(true)).toContain('aria-current="true"');
    expect(pintar(false)).not.toContain("aria-current");
  });

  it("al cerrar, el foco vuelve al «Editar» de su tarjeta", () => {
    const raiz = document.createElement("div");
    raiz.innerHTML = pintar(false) + pintar(false).replace(/data-editar-mazo="contraste"/, 'data-editar-mazo="panorama"');
    document.body.appendChild(raiz);
    volverAlEditar(() => raiz, "contraste", (f) => f());
    expect(document.activeElement).toBe(botonEditarDe(raiz, "contraste"));
    expect((document.activeElement as HTMLElement).textContent).toBe("Editar");
    expect(botonEditarDe(raiz, "otra")).toBeNull();
    expect(botonEditarDe(null, "contraste")).toBeNull();
    raiz.remove();
  });
});
