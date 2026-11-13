// @vitest-environment happy-dom
// La lista de Reglas vuelve arriba al cambiar de familia (ítem 45.2).
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ListaDeLaFamilia } from "./ListaDeLaFamilia";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLElement;
let root: Root;
beforeEach(() => {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

function lista(clave: string) {
  return (
    <ListaDeLaFamilia
      familia={{ clave, nombre: clave, n: 0 }}
      reglas={[]}
      elegida={null}
      conAviso={new Set()}
      ocupada={false}
      semillas={[]}
      preguntasExcluibles={[]}
      onElegir={() => undefined}
      onActivar={() => undefined}
      onAnadirSugerida={() => undefined}
      onNuevaRegla={() => undefined}
      onLeerFormulario={() => undefined}
      leerFormularioDeshabilitado={false}
      onExcluir={() => undefined}
    />
  );
}

describe("desplazamiento de la lista de Reglas", () => {
  it("al cambiar de familia el cuerpo vuelve arriba; con la misma familia se queda", () => {
    act(() => root.render(lista("obligatoria")));
    const cuerpo = host.querySelector<HTMLElement>(".pulso-panel-de-mesa-cuerpo");
    expect(cuerpo).not.toBeNull();
    if (!cuerpo) return;
    cuerpo.scrollTop = 900;
    act(() => root.render(lista("obligatoria")));
    expect(cuerpo.scrollTop).toBe(900);
    act(() => root.render(lista("salto")));
    expect(cuerpo.scrollTop).toBe(0);
  });
});
