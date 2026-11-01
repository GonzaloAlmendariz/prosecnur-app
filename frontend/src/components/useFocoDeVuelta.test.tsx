// @vitest-environment happy-dom
/**
 * L7 — un overlay propio devuelve el foco a quien lo abrió, aunque tome el
 * foco para sí al montar.
 */
import { act, useEffect, useRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, test } from "vitest";
import { useFocoDeVuelta } from "./useFocoDeVuelta";

let host: HTMLDivElement;
let root: Root;

function Overlay() {
  useFocoDeVuelta(true);
  const cerrar = useRef<HTMLButtonElement | null>(null);
  // Como GlobalSettingsDialog: el overlay se lleva el foco a su botón cerrar.
  useEffect(() => cerrar.current?.focus(), []);
  return <button ref={cerrar} type="button">Cerrar</button>;
}

function Pantalla({ abierto }: { abierto: boolean }) {
  return (
    <>
      <button type="button" id="disparador">Configurar credenciales</button>
      {abierto ? <Overlay /> : null}
    </>
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

test("al cerrar, el foco vuelve al disparador y no cae en body", () => {
  act(() => root.render(<Pantalla abierto={false} />));
  const disparador = document.getElementById("disparador") as HTMLButtonElement;
  disparador.focus();

  act(() => root.render(<Pantalla abierto />));
  expect(document.activeElement?.textContent).toBe("Cerrar");

  act(() => root.render(<Pantalla abierto={false} />));
  expect(document.activeElement).toBe(disparador);
});

test("si quien abrió ya no existe, no fuerza el foco a ningún lado", () => {
  act(() => root.render(<Pantalla abierto={false} />));
  (document.getElementById("disparador") as HTMLButtonElement).focus();
  act(() => root.render(<Pantalla abierto />));

  act(() => root.render(<Overlay key="otro" />));
  act(() => root.render(<></>));
  expect(document.activeElement).toBe(document.body);
});
