// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { Inbox } from "../../vendor/lucide-react";
import { FranjaDeTrabajo } from "./FranjaDeTrabajo";
import { MesaDePestana, PilaDeMesa } from "./MesaDePestana";
import { PanelDeMesa } from "./PanelDeMesa";

describe("MesaDePestana y PanelDeMesa", () => {
  let contenedor: HTMLDivElement;
  let raiz: Root;
  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    contenedor = document.createElement("div");
    document.body.appendChild(contenedor);
    raiz = createRoot(contenedor);
  });
  afterEach(() => {
    act(() => raiz.unmount());
    contenedor.remove();
  });

  function mesa(columnas: 2 | 3) {
    act(() => raiz.render(
      <MesaDePestana grupo="validacion/hallazgos" columnas={columnas} cabecera={<header>Cabecera</header>}>
        <PanelDeMesa zona="cola" titulo="Cola" icono={<Inbox size={15} />} conteo={1264}>
          <ul><li>Uno</li></ul>
        </PanelDeMesa>
        <PanelDeMesa zona="detalle" titulo="Año de egreso posterior a la fecha de la encuesta" conteo="7 casos" acciones={<button type="button">Casos</button>}>
          <p>Detalle</p>
        </PanelDeMesa>
        {columnas === 3 ? (
          <PilaDeMesa grupo="validacion/hallazgos">
            <PanelDeMesa zona="decision" titulo="Decisión" pie={<button type="button" className="pulso-button">Guardar y seguir</button>}>
              <p>Qué hacer</p>
            </PanelDeMesa>
          </PilaDeMesa>
        ) : null}
      </MesaDePestana>,
    ));
  }

  test("C1: la mesa declara su grupo intrínseco por pestaña y su número de columnas", () => {
    mesa(3);
    const grilla = contenedor.querySelector(".pulso-mesa-pestana");
    expect(grilla?.getAttribute("data-qa-geometry-group")).toBe("validacion/hallazgos-mesa");
    expect(grilla?.getAttribute("data-qa-geometry-contract")).toBe("intrinsic");
    expect(grilla?.getAttribute("data-columnas")).toBe("3");
    expect(grilla?.children).toHaveLength(3);
    const pila = contenedor.querySelector(".pulso-mesa-pestana-pila");
    expect(pila?.getAttribute("data-qa-geometry-group")).toBe("validacion/hallazgos-pila");
  });

  test("la mesa de dos columnas es la misma pieza con otro corte", () => {
    mesa(2);
    expect(contenedor.querySelector(".pulso-mesa-pestana")?.getAttribute("data-columnas")).toBe("2");
    expect(contenedor.querySelector(".pulso-mesa-pestana")?.children).toHaveLength(2);
  });

  test("la cabecera va antes de la mesa, dentro del mismo marco", () => {
    mesa(3);
    const marco = contenedor.querySelector(".pulso-mesa-pestana-marco");
    expect(marco?.firstElementChild?.tagName).toBe("HEADER");
    expect(marco?.lastElementChild?.classList.contains("pulso-mesa-pestana")).toBe(true);
  });

  test("cada contenedor: tesela, título, conteo y un cuerpo que es región con nombre, enfocable y dueño del vacío", () => {
    mesa(3);
    const cola = contenedor.querySelector(".pulso-panel-de-mesa--cola");
    expect(cola?.querySelector(".pulso-panel-de-mesa-tesela svg")).not.toBeNull();
    expect(cola?.querySelector("h3")?.textContent).toContain("Cola");
    expect(cola?.querySelector(".pulso-panel-de-mesa-conteo")?.textContent).toBe("1,264");
    const cuerpo = cola?.querySelector(".pulso-panel-de-mesa-cuerpo");
    expect(cuerpo?.getAttribute("role")).toBe("region");
    expect(cuerpo?.getAttribute("aria-label")).toBe("Cola");
    expect(cuerpo?.getAttribute("tabindex")).toBe("0");
    expect(cuerpo?.getAttribute("data-qa-geometry-capacity")).toBe("owned");
  });

  test("sin ícono no hay tesela, un conteo escrito se pinta tal cual y las acciones van a la cabecera", () => {
    mesa(3);
    const detalle = contenedor.querySelector(".pulso-panel-de-mesa--detalle");
    expect(detalle?.querySelector(".pulso-panel-de-mesa-tesela")).toBeNull();
    expect(detalle?.querySelector(".pulso-panel-de-mesa-conteo")?.textContent).toBe("7 casos");
    expect(detalle?.querySelector(".pulso-panel-actions button")?.textContent).toBe("Casos");
  });

  test("el pie va fuera del cuerpo, para que no se desplace con él", () => {
    mesa(3);
    const decision = contenedor.querySelector(".pulso-panel-de-mesa--decision");
    const pie = decision?.querySelector(".pulso-panel-de-mesa-pie");
    expect(pie?.textContent).toBe("Guardar y seguir");
    expect(decision?.querySelector(".pulso-panel-de-mesa-cuerpo")?.contains(pie ?? null)).toBe(false);
    // Sin pie no hay franja vacía.
    expect(contenedor.querySelector(".pulso-panel-de-mesa--cola .pulso-panel-de-mesa-pie")).toBeNull();
  });
});

describe("FranjaDeTrabajo", () => {
  let contenedor: HTMLDivElement;
  let raiz: Root;
  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    contenedor = document.createElement("div");
    document.body.appendChild(contenedor);
    raiz = createRoot(contenedor);
  });
  afterEach(() => {
    act(() => raiz.unmount());
    contenedor.remove();
  });

  test("con avance medible: título, detalle, barra con su porcentaje, nota y Cancelar", () => {
    const cancelar = vi.fn();
    act(() => raiz.render(
      <FranjaDeTrabajo titulo="Auditando la base" detalle="Empezó hace 14 s." porcentaje={61.7} nota="Abajo sigue el resultado anterior." onCancelar={cancelar} />,
    ));
    const franja = contenedor.querySelector('[role="status"]');
    expect(franja?.getAttribute("aria-live")).toBe("polite");
    expect(franja?.querySelector("b")?.textContent).toBe("Auditando la base");
    expect(contenedor.querySelector('[role="progressbar"]')?.getAttribute("aria-valuenow")).toBe("62");
    expect(contenedor.querySelector("em")?.textContent).toBe("62 %");
    expect(contenedor.querySelector(".pulso-franja-trabajo-nota")?.textContent).toBe("Abajo sigue el resultado anterior.");
    act(() => contenedor.querySelector("button")?.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(cancelar).toHaveBeenCalledTimes(1);
  });

  test("sin avance del motor la barra es indeterminada y no inventa un porcentaje; sin cancelar no hay botón", () => {
    act(() => raiz.render(<FranjaDeTrabajo titulo="Auditando la base" />));
    expect(contenedor.querySelector('[role="progressbar"]')?.getAttribute("aria-busy")).toBe("true");
    expect(contenedor.querySelector("em")).toBeNull();
    expect(contenedor.querySelector("button")).toBeNull();
  });
});
