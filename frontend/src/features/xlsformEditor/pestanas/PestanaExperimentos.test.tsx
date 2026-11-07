// Pestaña Experimentos y ficha de la tabla de un par (elección por pares C8 y C9, 2026-11-07). Mata: un formulario con
// experimento que abre en «nuevo» en vez de editar el suyo, un diseño que no viene del formulario, y una tabla de par
// que en la ficha se edita como markdown crudo en vez de verse como la ve el encuestado.
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { ProveedorReglas } from "../kit";
import { alcanceDeLectura } from "../kit/alcanceLectura";
import { buildXlsformIndex } from "../parsing/buildIndex";
import { insertRecord, makeSheet } from "../parsing/sheetUtils";
import type { XlsformEditorWorkbook } from "../types";
import { FichaConstructor, type AccionesFicha } from "../canvas/ficha/FichaConstructor";
import { generarConjoint, type DisenoConjoint } from "../conjoint/modeloConjoint";
import { generarVinetas, vinetasIniciales } from "../conjoint/modeloVinetas";
import { generarVersiones } from "../conjoint/modeloVersiones";
import { generarLista, listaInicial } from "../conjoint/modeloLista";
import { generarRespaldo, respaldoInicial } from "../conjoint/modeloRespaldo";
import { PestanaExperimentos } from "./PestanaExperimentos";

const diseno: DisenoConjoint = {
  prefijo: "cj",
  tareas: 2,
  rotulosPerfil: ["Persona A", "Persona B"],
  pregunta: "¿A cuál preferiría?",
  atributos: [
    { clave: "edad", rotulo: "Edad", niveles: [{ codigo: "1", texto: "35 años" }, { codigo: "2", texto: "50 años" }] },
    { clave: "genero", rotulo: "Género", niveles: [{ codigo: "1", texto: "Hombre" }, { codigo: "2", texto: "Mujer" }] },
  ],
};

function formulario(conExperimento: boolean): XlsformEditorWorkbook {
  const wb: XlsformEditorWorkbook = {
    survey: makeSheet("survey", ["type", "name", "label", "calculation", "appearance", "required"]),
    choices: makeSheet("choices", ["list_name", "name", "label"]),
    settings: makeSheet("settings", []),
  };
  insertRecord(wb.survey, 0, { type: "integer", name: "edad_resp", label: "Edad" });
  if (conExperimento) {
    const { survey, choices } = generarConjoint(diseno);
    survey.forEach((f, i) => insertRecord(wb.survey, i + 1, { ...f }));
    choices.forEach((c, i) => insertRecord(wb.choices, i, { ...c }));
  }
  return wb;
}

const pintar = (wb: XlsformEditorWorkbook, foco: string | null = null) => {
  const idx = buildXlsformIndex(wb);
  return renderToStaticMarkup(
    <PestanaExperimentos workbook={wb} structure={idx.structure} selection={null} updateWorkbook={() => {}} seleccionada={foco} onSeleccionar={() => {}} onEditar={() => {}} />,
  );
};

describe("pestaña Experimentos", () => {
  test("con un experimento en el formulario abre el suyo, con su diseño, para aplicar cambios", () => {
    const html = pintar(formulario(true));
    expect(html).toContain("2 pares, 2 atributos");
    expect(html).toContain("Aplicar cambios");
    expect(html).toContain("35 años");
    expect(html).toContain("Ver en el Constructor");
  });

  test("con viñetas en el formulario las lista y abre su diseño; también se pueden agregar", () => {
    const wb = formulario(false);
    const { survey, choices } = generarVinetas(vinetasIniciales("vi"));
    survey.forEach((f, i) => insertRecord(wb.survey, i + 1, { ...f }));
    choices.forEach((c, i) => insertRecord(wb.choices, i, { ...c }));
    const html = pintar(wb);
    expect(html).toContain("4 viñetas, 2 atributos");
    expect(html).toContain("Escenario");
    expect(html).toContain("Aplicar cambios");
    expect(html).toContain("Un escenario con atributos sorteados; se califica");
  });

  test("una pregunta con versiones al azar se lista por su código y abre su diseño (C12)", () => {
    const wb = formulario(false);
    insertRecord(wb.choices, 0, { list_name: "acuerdo", name: "1", label: "Sí" });
    const filas = generarVersiones({ prefijo: "vs", pregunta: "P5", tipo: "select_one", lista: "acuerdo", obligatoria: true, versiones: [{ texto: "¿Apoya?" }, { texto: "¿Apoya, aunque cueste?" }] });
    filas.forEach((f, i) => insertRecord(wb.survey, i + 1, { ...f }));
    const html = pintar(wb);
    expect(html).toContain("P5: 2 versiones");
    expect(html).toContain("Versiones al azar");
    expect(html).toContain("¿Apoya, aunque cueste?");
    expect(html).toContain("Aplicar cambios");
  });

  test("un experimento de lista se lista y abre su diseño, con lo que ve cada grupo (C14)", () => {
    const wb = formulario(false);
    generarLista(listaInicial("ls")).forEach((f, i) => insertRecord(wb.survey, i + 1, { ...f }));
    const html = pintar(wb);
    expect(html).toContain("3 afirmaciones y 1 sensible");
    expect(html).toContain("Con la afirmación sensible, 50%");
    expect(html).toContain("Aplicar cambios");
  });

  test("un experimento de respaldo se lista y abre su diseño, con lo que lee cada grupo (C15)", () => {
    const wb = formulario(false);
    const { survey, choices } = generarRespaldo(respaldoInicial("rs"));
    survey.forEach((f, i) => insertRecord(wb.survey, i + 1, { ...f }));
    choices.forEach((c, i) => insertRecord(wb.choices, i, { ...c }));
    const html = pintar(wb);
    expect(html).toContain("2 políticas, 1 actor");
    expect(html).toContain("Una propuesta de las Fuerzas Armadas plantea que se amplíe el servicio militar voluntario.");
    expect(html).toContain("Aplicar cambios");
  });

  test("el orden al azar lista las preguntas de selección y avisa si «No sabe» se movería (C16)", () => {
    const wb = formulario(false);
    insertRecord(wb.survey, 1, { type: "select_one partido", name: "P1", label: "¿Por quién votaría?", parameters: "randomize=true seed=${or_semilla}" });
    insertRecord(wb.survey, 1, { type: "calculate", name: "or_semilla", calculation: "once(int(random() * 1000000))" });
    insertRecord(wb.choices, 0, { list_name: "partido", name: "1", label: "Partido A" });
    insertRecord(wb.choices, 1, { list_name: "partido", name: "88", label: "No sabe" });
    const html = pintar(wb);
    expect(html).toContain("Opciones de 1 pregunta");
    expect(html).toContain("También se movería: No sabe");
    expect(html).toContain("Aplicar cambios");
  });

  test("sin experimento abre uno nuevo para insertar", () => {
    const html = pintar(formulario(false));
    expect(html).toContain("Ninguno en el formulario");
    expect(html).toContain("Insertar en el formulario");
  });
});

describe("ficha de la tabla de un par", () => {
  test("se ve como tabla con un sorteo de ejemplo y se edita en Experimentos, no como markdown", () => {
    const wb = formulario(true);
    const idx = buildXlsformIndex(wb);
    const node = idx.structure.outline.find((n) => n.name === "cj_t1_tabla")!;
    const nada = () => undefined;
    const acciones: AccionesFicha = {
      campo: nada, tipo: nada, obligatoria: nada, asignarLista: nada, crearLista: nada, duplicar: nada, moverASeccion: nada,
      eliminar: nada, alternarRepeticion: nada, seleccionarFila: nada, irPestana: nada, ajuste: nada, editarFormulario: nada,
    };
    const html = renderToStaticMarkup(
      <ProveedorReglas structure={idx.structure} scope={alcanceDeLectura(idx.structure, idx.catalogs)} survey={wb.survey}>
        <FichaConstructor workbook={wb} structure={idx.structure} selection={{ kind: "survey", rowIndex: node.rowIndex }} node={node}
          settingsRecord={null} choices={[]} catalogs={idx.catalogs} usosPorLista={new Map()} diagnostics={[]} acciones={acciones} />
      </ProveedorReglas>,
    );
    expect(html).toContain("Tabla del par 1");
    expect(html).toContain("Editar en Experimentos");
    expect(html).toContain("<table");
    expect(html).not.toContain("Texto de la nota");
  });

  test("el escenario de una viñeta también se ve como lo ve el encuestado (C11)", () => {
    const wb = formulario(false);
    const { survey, choices } = generarVinetas(vinetasIniciales("vi"));
    survey.forEach((f, i) => insertRecord(wb.survey, i + 1, { ...f }));
    choices.forEach((c, i) => insertRecord(wb.choices, i, { ...c }));
    const idx = buildXlsformIndex(wb);
    const node = idx.structure.outline.find((n) => n.name === "vi_v2_texto")!;
    const nada = () => undefined;
    const acciones: AccionesFicha = {
      campo: nada, tipo: nada, obligatoria: nada, asignarLista: nada, crearLista: nada, duplicar: nada, moverASeccion: nada,
      eliminar: nada, alternarRepeticion: nada, seleccionarFila: nada, irPestana: nada, ajuste: nada, editarFormulario: nada,
    };
    const html = renderToStaticMarkup(
      <ProveedorReglas structure={idx.structure} scope={alcanceDeLectura(idx.structure, idx.catalogs)} survey={wb.survey}>
        <FichaConstructor workbook={wb} structure={idx.structure} selection={{ kind: "survey", rowIndex: node.rowIndex }} node={node}
          settingsRecord={null} choices={[]} catalogs={idx.catalogs} usosPorLista={new Map()} diagnostics={[]} acciones={acciones} />
      </ProveedorReglas>,
    );
    expect(html).toContain("Escenario de la viñeta 2");
    expect(html).toMatch(/Una persona de (25|60) años pide un préstamo para/);
    expect(html).not.toContain("Texto de la nota");
  });

  test("la pregunta con versiones muestra sus versiones en la ficha, no la referencia (C13)", () => {
    const wb = formulario(false);
    insertRecord(wb.choices, 0, { list_name: "acuerdo", name: "1", label: "Sí" });
    generarVersiones({ prefijo: "vs", pregunta: "P5", tipo: "select_one", lista: "acuerdo", obligatoria: true, versiones: [{ texto: "¿Apoya?", peso: 0.7 }, { texto: "¿Apoya, aunque cueste?", peso: 0.3 }] })
      .forEach((f, i) => insertRecord(wb.survey, i + 1, { ...f }));
    const idx = buildXlsformIndex(wb);
    const node = idx.structure.outline.find((n) => n.name === "P5")!;
    const nada = () => undefined;
    const acciones: AccionesFicha = {
      campo: nada, tipo: nada, obligatoria: nada, asignarLista: nada, crearLista: nada, duplicar: nada, moverASeccion: nada,
      eliminar: nada, alternarRepeticion: nada, seleccionarFila: nada, irPestana: nada, ajuste: nada, editarFormulario: nada,
    };
    const html = renderToStaticMarkup(
      <ProveedorReglas structure={idx.structure} scope={alcanceDeLectura(idx.structure, idx.catalogs)} survey={wb.survey}>
        <FichaConstructor workbook={wb} structure={idx.structure} selection={{ kind: "survey", rowIndex: node.rowIndex }} node={node}
          settingsRecord={null} choices={[]} catalogs={idx.catalogs} usosPorLista={new Map()} diagnostics={[]} acciones={acciones} />
      </ProveedorReglas>,
    );
    expect(html).toContain("Pregunta en 2 versiones");
    expect(html).toContain("¿Apoya, aunque cueste?");
    expect(html).toContain("70%");
    expect(html).not.toMatch(/>¿Qué se le pregunta al encuestado\?|value="\$\{vs_texto\}"/);
  });
});
