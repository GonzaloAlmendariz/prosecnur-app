// @vitest-environment happy-dom
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { Inbox } from "../../vendor/lucide-react";
import { CabeceraDePestana } from "./CabeceraDePestana";
import { repartirCifras, type CifraDePestana } from "./CifrasDePestana";

const CIFRAS: CifraDePestana[] = [
  { clave: "casos", valor: "18", base: "178", rotulo: "casos con algún hallazgo", tono: "alerta", rango: 1 },
  { clave: "reglas", valor: "97", rotulo: "reglas aplicadas" },
  { clave: "fecha", valor: "8 nov", rotulo: "última auditoría", rango: 3 },
];

describe("CabeceraDePestana", () => {
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

  function pintar(nodo: ReactNode) {
    act(() => raiz.render(<MemoryRouter>{nodo}</MemoryRouter>));
  }

  test("el h2 es solo el nombre de la pestaña; el estado va fuera, en palabra", () => {
    pintar(
      <CabeceraDePestana seccion="Validación" titulo="Hallazgos" icono={Inbox} estado={{ tono: "parcial", texto: "Por decidir" }} cifras={CIFRAS} />,
    );
    expect(contenedor.querySelector("h2")?.textContent).toBe("Hallazgos");
    const estado = contenedor.querySelector(".pulso-cabecera-pestana-estado");
    expect(estado?.textContent).toBe("Por decidir");
    expect(estado?.getAttribute("data-tono")).toBe("parcial");
    expect(contenedor.querySelector("h2")?.contains(estado ?? null)).toBe(false);
    expect(contenedor.querySelector(".pulso-tab-heading-eyebrow")?.textContent).toBe("Validación");
  });

  test("las cifras son una lista de definiciones con nombre: número con su base arriba, lo que cuenta debajo", () => {
    pintar(<CabeceraDePestana seccion="Validación" titulo="Hallazgos" icono={Inbox} cifras={CIFRAS} />);
    const dl = contenedor.querySelector("dl");
    expect(dl?.getAttribute("aria-label")).toBe("Cifras de Hallazgos");
    const primera = dl?.querySelector(".pulso-cifra-pestana");
    expect(primera?.querySelector("dt")?.textContent).toBe("casos con algún hallazgo");
    expect(primera?.querySelector("dd")?.textContent).toBe("18/178");
    expect(primera?.getAttribute("data-tono")).toBe("alerta");
    expect(primera?.querySelector(".pulso-cifra-pestana-punto")).not.toBeNull();
    // Sin tono no hay punto.
    expect(dl?.querySelectorAll(".pulso-cifra-pestana")[1].querySelector(".pulso-cifra-pestana-punto")).toBeNull();
  });

  test("C1: la cabecera, la tira de cifras y la tesela declaran su geometría", () => {
    pintar(<CabeceraDePestana seccion="Validación" titulo="Reglas" icono={Inbox} cifras={CIFRAS} acciones={<button type="button">Auditar</button>} />);
    const cabecera = contenedor.querySelector("header.pulso-tab-heading");
    expect(cabecera?.getAttribute("data-qa-geometry-group")).toBe("tab-heading");
    expect(cabecera?.getAttribute("data-qa-geometry-contract")).toBe("intrinsic");
    const dl = contenedor.querySelector("dl");
    expect(dl?.getAttribute("data-qa-geometry-group")).toBe("procesamiento/cifras-de-pestana");
    expect(dl?.getAttribute("data-qa-geometry-contract")).toBe("intrinsic");
    expect(contenedor.querySelector(".pulso-tab-heading-icon")?.getAttribute("data-qa-geometry-capacity")).toBe("owned");
  });

  test("las acciones van al final, después de las cifras, en el orden de lectura", () => {
    pintar(<CabeceraDePestana seccion="Validación" titulo="Reglas" icono={Inbox} cifras={CIFRAS} acciones={<button type="button">Auditar</button>} />);
    const orden = [...contenedor.querySelectorAll("h2, dl, .pulso-cabecera-pestana-acciones")].map((n) => n.tagName.toLowerCase());
    expect(orden).toEqual(["h2", "dl", "div"]);
    expect(contenedor.querySelector(".pulso-cabecera-pestana-acciones button")?.textContent).toBe("Auditar");
  });

  test("sin cifras ni acciones el marco sigue: la misma cabecera, con el hueco declarado y sin texto de relleno", () => {
    pintar(<CabeceraDePestana seccion="Validación" titulo="Reglas" icono={Inbox} cifrasPendientes="reglas activas: pedido M3" />);
    expect(contenedor.querySelector("header.pulso-tab-heading")).not.toBeNull();
    expect(contenedor.querySelector("dl")).toBeNull();
    expect(contenedor.querySelector(".pulso-cabecera-pestana-acciones")).toBeNull();
    const hueco = contenedor.querySelector("[data-cifras-pendientes]");
    expect(hueco?.getAttribute("data-cifras-pendientes")).toBe("reglas activas: pedido M3");
    expect(hueco?.hasAttribute("hidden")).toBe(true);
    expect(hueco?.textContent).toBe("");
  });

  test("una cifra que se decide en otra pestaña lleva a ella", () => {
    pintar(<CabeceraDePestana seccion="Validación" titulo="Cierre" icono={Inbox} cifras={[{ clave: "x", valor: "5", base: "19", rotulo: "por decidir", enlace: "/validacion?pestana=hallazgos" }]} />);
    expect(contenedor.querySelector(".pulso-cifra-pestana a")?.getAttribute("href")).toBe("/validacion?pestana=hallazgos");
  });
});

describe("cuántas cifras quedan sueltas", () => {
  test("a lo ancho caben las tres; apretado quedan dos y la de rango 3 se recoge primero", () => {
    expect(repartirCifras(CIFRAS, "normal").visibles.map((c) => c.clave)).toEqual(["casos", "reglas", "fecha"]);
    const compacta = repartirCifras(CIFRAS, "compact");
    expect(compacta.visibles.map((c) => c.clave)).toEqual(["casos", "reglas"]);
    expect(compacta.recogidas.map((c) => c.clave)).toEqual(["fecha"]);
  });

  test("muy apretado solo queda la que nunca se recoge, y las demás siguen a un clic", () => {
    const { visibles, recogidas } = repartirCifras(CIFRAS, "tight");
    expect(visibles.map((c) => c.clave)).toEqual(["casos"]);
    expect(recogidas.map((c) => c.clave)).toEqual(["reglas", "fecha"]);
  });

  test("se conserva el orden de lectura de la pestaña entre las visibles", () => {
    const desordenadas: CifraDePestana[] = [
      { clave: "a", valor: "1", rotulo: "a", rango: 3 },
      { clave: "b", valor: "2", rotulo: "b", rango: 1 },
      { clave: "c", valor: "3", rotulo: "c" },
    ];
    expect(repartirCifras(desordenadas, "normal").visibles.map((c) => c.clave)).toEqual(["a", "b", "c"]);
  });
});
