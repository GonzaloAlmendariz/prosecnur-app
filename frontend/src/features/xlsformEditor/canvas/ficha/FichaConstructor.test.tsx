// Ficha del Constructor por render estático. Mata: una ficha de cálculo con el marco de pregunta (S17), una nota con
// bloque de respuesta, reglas escritas a mano en vez de las del motor, una pregunta en repetición que no lo dice
// (S8), una lista recortada a pocas opciones (C8), la vuelta de «Formulario completo» (C3) y una sección sin su
// condición ni su «Se repite» (C14).
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { ProveedorReglas } from "../../kit";
import { alcanceDeLectura } from "../../kit/alcanceLectura";
import { buildXlsformIndex } from "../../parsing/buildIndex";
import { leerRegla } from "../../reglas/leerRegla";
import { textoDePiezas } from "../../reglas/piezas";
import type { XlsformEditorWorkbook } from "../../types";
import { FichaConstructor, type AccionesFicha } from "./FichaConstructor";

const opciones = Array.from({ length: 12 }, (_, i) => ["muchas", String(i + 1), `Opción ${i + 1}`]);
const wb: XlsformEditorWorkbook = {
  survey: {
    name: "survey",
    columns: ["type", "name", "label", "required", "relevant", "constraint", "constraint_message", "calculation", "appearance"],
    rows: [
      ["select_one sino", "acepta", "¿Acepta participar?", "yes", "", "", "", "", ""],
      ["integer", "edad", "Edad", "", "${acepta} = '1'", ". >= 18 and . <= 100", "Entre 18 y 100", "", ""],
      ["note", "aviso", "Gracias por participar", "", "", "", "", "", ""],
      ["calculate", "doble", "", "", "", "", "", "${edad} * 2", ""],
      ["begin_repeat", "miembros", "Miembros del hogar", "", "${acepta} = '1'", "", "", "", "field-list"],
      ["select_one muchas", "parentesco", "Parentesco", "", "", "", "", "", ""],
      ["end_repeat", "", "", "", "", "", "", "", ""],
    ],
  },
  choices: { name: "choices", columns: ["list_name", "name", "label"], rows: [["sino", "1", "Sí"], ["sino", "2", "No"], ...opciones] },
  settings: { name: "settings", columns: [], rows: [] },
};
const idx = buildXlsformIndex(wb);
const scope = alcanceDeLectura(idx.structure, idx.catalogs);
const nada = () => undefined;
const acciones: AccionesFicha = {
  campo: nada, tipo: nada, obligatoria: nada, asignarLista: nada, crearLista: nada, duplicar: nada, moverASeccion: nada,
  mover: nada, eliminar: nada, alternarRepeticion: nada, seleccionarFila: nada, irPestana: nada, ajuste: nada, editarFormulario: nada,
  puedeSubir: true, puedeBajar: true,
};

function ficha(name: string) {
  const node = idx.structure.outline.find((n) => n.name === name)!;
  const choices = idx.catalogs.find((c) => c.listName === node.typeInfo.listName)?.items ?? [];
  return renderToStaticMarkup(
    <ProveedorReglas structure={idx.structure} scope={scope} survey={wb.survey}>
      <FichaConstructor
        workbook={wb}
        structure={idx.structure}
        selection={{ kind: "survey", rowIndex: node.rowIndex }}
        node={node}
        settingsRecord={null}
        choices={choices}
        catalogs={idx.catalogs}
        usosPorLista={new Map([["sino", 1], ["muchas", 1]])}
        diagnostics={[{ id: "d1", level: "warn", title: "Código repetido", detail: "Otra fila usa edad", rowIndex: node.rowIndex }]}
        acciones={acciones}
      />
    </ProveedorReglas>,
  );
}

describe("FichaConstructor", () => {
  test("pregunta: bloques de la propuesta, reglas leídas por el motor y sin «Formulario completo»", () => {
    const html = ficha("edad");
    for (const t of ["Texto", "Respuesta", "Reglas", "Apariencia en la plataforma", "Así se ve"]) expect(html).toContain(t);
    const edad = idx.structure.outline.find((n) => n.name === "edad")!;
    const restriccion = textoDePiezas(leerRegla("constraint", edad.constraint, edad, scope).piezas);
    expect(restriccion.length).toBeGreaterThan(0);
    expect(html.replace(/<[^>]+>/g, "").replace(/\s+/g, " ")).toContain(restriccion);
    expect(html).not.toContain("Formulario completo");
    expect(html).not.toContain("Cuándo aparece");
    expect(html).toContain("Código repetido");
    expect(html).toContain("Pregunta 2");
  });

  test("select: la lista se ve entera y lleva a Listas de opciones", () => {
    const html = ficha("parentesco");
    expect(html).toContain("Opción 12");
    expect(html).not.toMatch(/y \d+ más/);
    expect(html).toContain("Editar en Listas de opciones");
    expect(html).toContain("Se repite");
    expect(html).toContain("Por cada fila de «Miembros del hogar»");
  });

  test("nota: sin bloque de respuesta ni restricción", () => {
    const html = ficha("aviso");
    expect(html).toContain("Texto de la nota");
    expect(html).not.toContain(">Respuesta<");
    expect(html).not.toContain("Restricción");
  });

  test("cálculo: fórmula y dónde se usa, sin el marco de pregunta", () => {
    const html = ficha("doble");
    expect(html).toContain("Fórmula");
    expect(html).toContain("Dónde se usa");
    expect(html).toContain("Editar en Cálculos");
    expect(html).not.toContain("La pregunta que verá el encuestado");
    expect(html).not.toContain("Apariencia en la plataforma");
  });

  test("sección: condición, se repite y apariencia propia", () => {
    const html = ficha("miembros");
    expect(html).toContain("Repetición");
    expect(html).toContain("Condición");
    expect(html).toContain("Las veces que elija el encuestador");
    expect(html).toContain("Toda la sección junta");
    expect(html).toMatch(/aria-checked="true"[^>]*>.*?Toda la sección junta/s);
  });
});
