// @vitest-environment happy-dom
// Al cambiar de pregunta en Codificar la mesa se vuelve a montar; la lista de preguntas tiene que volver a
// la misma posición y dejar a la vista la pregunta elegida (antes volvía al principio cada vez).
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { pregunta } from "../preguntas/unidadesDePrueba";
import { ListaDePreguntas } from "./ListaDePreguntas";

const PREGUNTAS = Array.from({ length: 18 }, (_, i) => pregunta(`p${i}`, "text", { marcada: true, n_unicas: 10, n_codificadas: i % 10 }));

let host: HTMLDivElement;
let root: Root;
const posicion = { current: 0 };

function Mesa({ activa }: { activa: string }) {
  return (
    <div className="pulso-panel-de-mesa-cuerpo" style={{ height: "200px", overflow: "auto" }}>
      <ListaDePreguntas preguntas={PREGUNTAS} activa={activa} etiquetaDe={(p) => p.parent} onElegir={() => undefined} avanceDe={() => null} posicion={posicion} />
    </div>
  );
}

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

describe("la lista de preguntas de Codificar", () => {
  test("al volver a montarse recupera el desplazamiento que tenía", () => {
    posicion.current = 0;
    act(() => root.render(<Mesa activa="p12" key="a" />));
    const cuerpo = host.querySelector<HTMLElement>(".pulso-panel-de-mesa-cuerpo");
    if (!cuerpo) throw new Error("sin cuerpo");
    cuerpo.scrollTop = 240;
    act(() => {
      cuerpo.dispatchEvent(new Event("scroll"));
    });
    expect(posicion.current).toBe(240);
    // Otra pregunta: la mesa se monta de nuevo (otra clave) y la lista vuelve a 240.
    act(() => root.render(<Mesa activa="p13" key="b" />));
    expect(host.querySelector<HTMLElement>(".pulso-panel-de-mesa-cuerpo")?.scrollTop).toBe(240);
  });
});
