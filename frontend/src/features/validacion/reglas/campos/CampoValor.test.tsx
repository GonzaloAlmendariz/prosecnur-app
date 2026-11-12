// @vitest-environment happy-dom
/**
 * A3 de la revisión del panel de regla: un selector con lista de opciones
 * mostraba en blanco la opción elegida cuando el motor manda los códigos como
 * números (la lista de Explorar sale de R así). Lo elegido tiene que verse.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ExploradorVariable } from "../../types";

vi.mock("../../../../api/validacion", () => ({
  apiV2ExplorarValores: vi.fn(async () => ({
    ok: true,
    var: "sexo",
    tipo: "so",
    // Como llega de R: códigos numéricos.
    opciones: [
      { code: 1, label: "Hombre", n: 52 },
      { code: 2, label: "Mujer", n: 68 },
    ],
    rango: null,
  })),
}));

import { CampoValor } from "./CampoValor";
import { EditorDeJerarquia } from "./EditorDeJerarquia";

const SEXO: ExploradorVariable = { name: "sexo", label: "Sexo", tipo: "so", n_validos: 120, n_nulos: 0 };

let host: HTMLDivElement;
let root: Root;

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

async function asentar() {
  for (let i = 0; i < 6; i += 1) {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
  }
}

describe("selectores con lista de opciones", () => {
  it("la opción elegida se ve aunque el código llegue como número", async () => {
    await act(async () => {
      root.render(<CampoValor variable={SEXO} op="==" valor="2" ariaLabel="Se espera que: valor" onCambio={() => undefined} />);
    });
    await asentar();
    const trigger = host.querySelector('button[aria-label="Se espera que: valor"]');
    expect(trigger?.textContent).toContain("Mujer");
  });

  it("la opción marcada de una relación se ve", async () => {
    await act(async () => {
      root.render(
        <EditorDeJerarquia params={{ hierarchy_rows: [{ trigger: "1", required: ["2"] }] }} onParams={() => undefined} variable="q7" />,
      );
    });
    await asentar();
    const trigger = host.querySelector('button[aria-label="Relación 1: opción marcada"]');
    expect(trigger?.textContent).toContain("Hombre");
  });
});
