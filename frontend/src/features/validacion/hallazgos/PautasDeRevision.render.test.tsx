// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { emptyEditorForm } from "../limpieza/modeloLimpieza";
import { Decision } from "./Decision";
import { PautasDeRevision } from "./PautasDeRevision";
import { opcionesDeTratamiento } from "./modeloHallazgos";
import { pautasDelHallazgo, situacionDeOpcion } from "./pautasDelHallazgo";

let host: HTMLDivElement;
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

const pautas = pautasDelHallazgo({ vista: "rango", familia: "rango_num", direccion: null, subtipo: null, tipoRegla: null, semillaOrigen: null });

describe("pautas de revisión del hallazgo (ítem 27)", () => {
  test("se listan en orden con su título, como sección nombrada", () => {
    act(() => root.render(<PautasDeRevision pautas={pautas?.revisar ?? []} />));
    const seccion = host.querySelector("section.pulso-hz-pautas");
    expect(seccion?.getAttribute("aria-labelledby")).toBe("pulso-hz-pautas-titulo");
    expect(host.querySelector("h4")?.textContent).toBe("Pautas de revisión");
    expect([...host.querySelectorAll("li")].map((li) => li.textContent)).toEqual(pautas?.revisar);
  });

  test("sin pautas no se pinta nada", () => {
    act(() => root.render(<PautasDeRevision pautas={[]} />));
    expect(host.innerHTML).toBe("");
  });

  test("cada opción de la Decisión lleva su situación debajo del efecto", () => {
    const opciones = opcionesDeTratamiento({ vista: "rango", etiquetaPregunta: "Edad", prevista: null, seleccionMultiple: false, fueraDeLista: false, especial: null })
      .map((o) => ({ ...o, situacion: situacionDeOpcion(pautas, o) ?? undefined }));
    act(() => root.render(
      <Decision
        opciones={opciones}
        elegida="dejar"
        onElegir={() => {}}
        tituloOpciones="Tratamiento"
        alcance={{ titulo: "Sobre qué casos", todos: "Los 3", marcados: "Los marcados", todosElegido: true, bloqueado: true, onCambiar: () => {}, linea: "" }}
        form={emptyEditorForm()}
        setForm={() => {}}
        variables={["edad"]}
        etiquetas={{ edad: "Edad" }}
        choiceOptions={[]}
        numerica
        avisos={{ decidida: null, noAplicable: null, casosNuevos: null, yaNoMarca: null }}
        efecto={{ texto: "" }}
        efectoOcupado={false}
        causaNoGuardar={null}
        guardando={false}
        onGuardar={() => {}}
        onOmitir={() => {}}
        hayOtro={false}
        decisionLista={null}
        onIncluirCasosNuevos={() => {}}
        onEliminar={() => {}}
        decisiones={[]}
        decisionAbierta={null}
        onAbrirDecision={() => {}}
      />,
    ));
    const situaciones = [...host.querySelectorAll(".pulso-hz-opcion-situacion")].map((s) => s.textContent);
    expect(situaciones).toEqual(opciones.map((o) => o.situacion));
    expect(situaciones[0]).toBe("Si el valor es real y el resto del caso lo respalda.");
    // La situación queda dentro del radio: su nombre accesible la incluye.
    const radio = host.querySelector(".pulso-hz-opcion");
    expect(radio?.textContent).toContain("Si el valor es real");
  });
});
