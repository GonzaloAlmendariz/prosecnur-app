// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { FranjaRecorrido, type GrupoDeFranja } from "./FranjaRecorrido";

const GRUPOS: GrupoDeFranja[] = [
  {
    id: "reglas",
    rotulo: "Reglas",
    cifras: [
      { id: "formulario", cifra: 94, texto: "del formulario" },
      { id: "propias", cifra: 5, texto: "propias" },
    ],
  },
  { id: "auditoria", rotulo: "Auditoría", cifras: [{ id: "casos", cifra: 17124, texto: "casos, el 8 nov" }] },
  {
    id: "hallazgos",
    rotulo: "Hallazgos",
    cifras: [
      { id: "inc", cifra: 12, texto: "inconsistencias", tono: "inconsistencia" },
      { id: "rev", cifra: 7, texto: "casos a revisar", tono: "aviso" },
    ],
  },
];

describe("FranjaRecorrido", () => {
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

  test("es un grupo con nombre y pinta cada grupo con su rótulo y sus cifras", () => {
    act(() => raiz.render(<FranjaRecorrido etiqueta="De las reglas a los hallazgos" grupos={GRUPOS} />));
    const franja = contenedor.querySelector('[role="group"]');
    expect(franja?.getAttribute("aria-label")).toBe("De las reglas a los hallazgos");
    const grupos = [...contenedor.querySelectorAll(".pulso-franja-grupo")];
    expect(grupos.map((g) => g.querySelector(".pulso-franja-rotulo")?.textContent)).toEqual(["Reglas", "Auditoría", "Hallazgos"]);
    expect([...grupos[0].querySelectorAll(".pulso-franja-cifra")].map((c) => c.textContent)).toEqual(["94del formulario", "5propias"]);
  });

  test("una cifra numérica sale con separador de millares y una escrita se pinta tal cual", () => {
    const grupos: GrupoDeFranja[] = [
      { id: "a", rotulo: "Auditoría", cifras: [{ id: "n", cifra: 17124, texto: "casos" }, { id: "f", cifra: "8 nov", texto: "última auditoría" }] },
    ];
    act(() => raiz.render(<FranjaRecorrido etiqueta="Auditoría" grupos={grupos} />));
    expect([...contenedor.querySelectorAll(".pulso-franja-cifra > b")].map((b) => b.textContent)).toEqual(["17,124", "8 nov"]);
  });

  test("el punto de estado solo aparece en la cifra con tono, y el tono cambia el atributo", () => {
    act(() => raiz.render(<FranjaRecorrido etiqueta="De las reglas a los hallazgos" grupos={GRUPOS} />));
    const cifras = [...contenedor.querySelectorAll(".pulso-franja-cifra")];
    expect(cifras.map((c) => c.getAttribute("data-tono"))).toEqual([null, null, null, "inconsistencia", "aviso"]);
    expect(cifras.map((c) => c.querySelectorAll(".pulso-franja-punto").length)).toEqual([0, 0, 0, 1, 1]);
  });

  test("entre grupos va un conector, salvo delante de un grupo aparte", () => {
    act(() => raiz.render(<FranjaRecorrido etiqueta="De las reglas a los hallazgos" grupos={GRUPOS} />));
    expect(contenedor.querySelectorAll(".pulso-franja-conector")).toHaveLength(2);
    const conAparte = [GRUPOS[0], GRUPOS[1], { ...GRUPOS[2], aparte: true }];
    act(() => raiz.render(<FranjaRecorrido etiqueta="De las reglas a los hallazgos" grupos={conAparte} />));
    expect(contenedor.querySelectorAll(".pulso-franja-conector")).toHaveLength(1);
    expect(contenedor.querySelectorAll(".pulso-franja-grupo[data-aparte]")).toHaveLength(1);
  });

  test("sin destino no hay botón ni enlace", () => {
    act(() => raiz.render(<FranjaRecorrido etiqueta="Qué se agrega a la base" grupos={GRUPOS} />));
    expect(contenedor.querySelector("button, a")).toBeNull();
    expect(contenedor.querySelector(".pulso-franja-destino")).toBeNull();
    expect(contenedor.querySelector(".pulso-franja-recorrido")?.hasAttribute("data-destino")).toBe(false);
  });

  test("con onClick el destino es un botón con rótulo, cifra y flecha, y responde al clic", () => {
    const alIr = vi.fn();
    act(() =>
      raiz.render(
        <FranjaRecorrido etiqueta="De las reglas a los hallazgos" grupos={GRUPOS} destino={{ rotulo: "Por decidir", cifra: 5, onClick: alIr }} />,
      ),
    );
    const boton = contenedor.querySelector("button.pulso-franja-destino");
    expect(boton?.getAttribute("type")).toBe("button");
    expect(boton?.textContent).toBe("Por decidir5");
    expect(boton?.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
    act(() => boton?.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(alIr).toHaveBeenCalledTimes(1);
  });

  test("con href el destino es un enlace de verdad", () => {
    act(() =>
      raiz.render(
        <FranjaRecorrido
          etiqueta="De las reglas a los hallazgos"
          grupos={GRUPOS}
          destino={{ rotulo: "Por decidir", cifra: 5, href: "/procesamiento?seccion=validacion&pestana=hallazgos" }}
        />,
      ),
    );
    const enlace = contenedor.querySelector("a.pulso-franja-destino");
    expect(enlace?.getAttribute("href")).toBe("/procesamiento?seccion=validacion&pestana=hallazgos");
    expect(contenedor.querySelector("button")).toBeNull();
  });

  test("sin href ni onClick el destino es un dato: ni control ni flecha", () => {
    act(() =>
      raiz.render(
        <FranjaRecorrido etiqueta="De los casos recibidos a los que cuentan" grupos={GRUPOS} destino={{ rotulo: "Cuentan", cifra: 112, nota: "97.4 %" }} />,
      ),
    );
    const dato = contenedor.querySelector(".pulso-franja-destino");
    expect(dato?.tagName).toBe("DIV");
    expect(dato?.textContent).toBe("Cuentan11297.4 %");
    expect(dato?.querySelector("svg")).toBeNull();
    expect(contenedor.querySelector("button, a")).toBeNull();
  });

  test("los avisos van en una lista bajo la fila, con su tono y la acción al extremo", () => {
    act(() =>
      raiz.render(
        <FranjaRecorrido
          etiqueta="Qué se agrega a la base"
          grupos={GRUPOS}
          avisos={[
            { id: "reemplaza", texto: "Reemplaza la codificación del 6 nov", tono: "aviso" },
            { id: "conserva", texto: "Las respuestas originales se conservan" },
          ]}
          accionDeAvisos={<button type="button">Ver qué cambia</button>}
        />,
      ),
    );
    const avisos = [...contenedor.querySelectorAll("ul.pulso-franja-avisos > li")];
    expect(avisos.map((a) => a.textContent)).toEqual(["Reemplaza la codificación del 6 nov", "Las respuestas originales se conservan"]);
    expect(avisos.map((a) => a.getAttribute("data-tono"))).toEqual(["aviso", "conforme"]);
    expect(contenedor.querySelector(".pulso-franja-pie-accion button")?.textContent).toBe("Ver qué cambia");
  });

  test("sin avisos ni acción no se dibuja el pie", () => {
    const html = renderToStaticMarkup(<FranjaRecorrido etiqueta="Qué se agrega a la base" grupos={GRUPOS} avisos={[]} />);
    expect(html).not.toContain("pulso-franja-pie");
    expect(html).not.toContain("data-audit-ready");
  });

  test("declara la geometría de sus grupos y de sus avisos (C1), con el nombre que se le pase", () => {
    const avisos = [{ id: "a", texto: "Uno" }, { id: "b", texto: "Dos" }];
    const porDefecto = renderToStaticMarkup(<FranjaRecorrido etiqueta="Recorrido" grupos={GRUPOS} avisos={avisos} />);
    expect(porDefecto).toContain(
      'class="pulso-franja-fila" data-qa-geometry-group="procesamiento/franja-recorrido" data-qa-geometry-contract="intrinsic"',
    );
    expect(porDefecto).toContain(
      'class="pulso-franja-avisos" data-qa-geometry-group="procesamiento/franja-recorrido-avisos" data-qa-geometry-contract="intrinsic"',
    );
    const conNombre = renderToStaticMarkup(
      <FranjaRecorrido etiqueta="Recorrido" grupos={GRUPOS} avisos={avisos} grupoDeGeometria="codificacion/aplicar-franja" />,
    );
    expect(conNombre).toContain('data-qa-geometry-group="codificacion/aplicar-franja"');
    expect(conNombre).toContain('data-qa-geometry-group="codificacion/aplicar-franja-avisos"');
    expect(conNombre).not.toContain("procesamiento/franja-recorrido");
  });
});
