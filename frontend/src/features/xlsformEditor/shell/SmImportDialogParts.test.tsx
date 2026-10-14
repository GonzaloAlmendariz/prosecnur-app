import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import { FinalImportReviewModal, SmFueraDelFormulario, fueraDelFormularioDe } from "./SmImportResumen";
import { normalizeXlsformFormSource } from "../../../api/xlsformEditor";
import { SmImportFlowSummary } from "./SmImportFlowSummary";
import { SmLogicaSugerencias } from "./SmLogicaSugerencias";
import { SmSurveyPicker } from "./SmSurveyPicker";
import { SmPageMapEditor } from "./SmPageMapEditor";
import { estadoConexionSm } from "./smImportModel";
import type { VisualLogicQuestion } from "./RuleWizard";

// Jerga que no debe llegar a la superficie (U6, dirección creativa v3 · Voz).
const JERGA = /required|validations|Huella|surveymonkey_api|select_one|Survey ID|XLSForm \(variables\)|variables? XLSForm/;
const SHA = "42f8a1c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f6071829304152639e0d";

const resumenBase = {
  surveyId: "423593924",
  surveyTitle: "Acreditación Arte y Diseño PUCP a Estudiantes",
  sectionCount: 17,
  questionCount: 26,
  fieldCount: 74,
  visualRuleCount: 0,
  advancedRuleCount: 0,
  overrideCount: 0,
  definitionSha256: SHA,
  translationProfile: "surveymonkey_api_xlsform/v1",
  checked: false,
  submitting: false,
  onCheckedChange: vi.fn(),
  onCancel: vi.fn(),
  onConfirm: vi.fn(),
};

describe("resumen antes de crear (C1 xlsform-import-sm-resumen)", () => {
  test("declara su geometría y usa el par preguntas · campos", () => {
    const html = renderToStaticMarkup(<FinalImportReviewModal {...resumenBase} pendingSuggestionCount={1} />);
    expect(html).toContain('data-qa-geometry-group="xlsform-import-sm-resumen"');
    expect(html).toContain('data-qa-geometry-contract="intrinsic"');
    expect(html).toContain("26 preguntas · 74 campos");
    expect(html).toContain("cada fila de una matriz es un campo propio");
    expect(html).toContain("17 secciones");
  });

  test("con cero reglas no promete saltos y apunta a la sugerencia", () => {
    const html = renderToStaticMarkup(<FinalImportReviewModal {...resumenBase} pendingSuggestionCount={1} />);
    expect(html).toContain("Sin saltos: agrégalos o aplica la sugerencia");
    expect(html).toContain("Llega sin saltos");
    expect(html).not.toMatch(/validaciones y reglas/);
  });

  test("lo técnico va plegado, truncado y con copia explícita; sin jerga en superficie", () => {
    const html = renderToStaticMarkup(<FinalImportReviewModal {...resumenBase} />);
    expect(html).toMatch(/<details class="pulso-xf-smi-tecnico"><summary>Detalles técnicos<\/summary>/);
    expect(html).toContain("42f8a1c3…9e0d");
    expect(html).not.toContain(SHA);
    expect(html).toContain("Copiar el identificador de la definición");
    expect(html).toContain("Versión 1");
    expect(html).not.toMatch(JERGA);
  });
});

describe("pasos de la cabecera (U4)", () => {
  test("el chip de conexión dice el error real antes de elegir encuesta", () => {
    const html = renderToStaticMarkup(
      <SmImportFlowSummary
        conexion={estadoConexionSm({ hasUsableToken: true, tokenStatus: { ok: false, status_code: 401, error: "x" }, encuestaConectada: false })}
        sectionCount={0}
        questionCount={0}
        fieldCount={0}
        ruleCount={0}
        encuestaCargada={false}
      />,
    );
    expect(html).toContain("Token rechazado");
    expect(html).toContain("is-error");
    expect(html).not.toContain("Pendiente");
    expect(html).toContain('data-qa-geometry-contract="equal"');
  });

  test("con la encuesta cargada y sin reglas, saltos queda en alerta y no «hecho»", () => {
    const html = renderToStaticMarkup(
      <SmImportFlowSummary
        conexion={estadoConexionSm({ hasUsableToken: true, tokenStatus: null, encuestaConectada: true })}
        sectionCount={17}
        questionCount={26}
        fieldCount={74}
        ruleCount={0}
        encuestaCargada
      />,
    );
    expect(html).toContain("26 preguntas · 74 campos");
    expect(html).toMatch(/is-alerta[^]*Sin saltos/);
  });
});

const PREGUNTAS: VisualLogicQuestion[] = [{
  ref: "Q0001",
  label: "p1: ¿Desea continuar con la encuesta?",
  choices: [{ name: "1", label: "Sí", index: 1 }, { name: "2", label: "No", index: 2 }],
}];
const SUGERENCIA = {
  tipo: "fin_de_encuesta" as const,
  variable: "p1",
  etiqueta: "¿Desea continuar con la encuesta?",
  opciones_que_cortan: [{ codigo: "2", etiqueta: "No" }],
  motivo: "Es la pregunta de consentimiento.",
};
const AVISO = "SurveyMonkey no comparte la lógica de saltos por su API: el formulario se importa sin saltos.";

describe("lógica: aviso honesto y sugerencias (H4/U7)", () => {
  test("muestra el aviso y la tarjeta con Aplicar y Descartar, sin aplicarla sola", () => {
    const html = renderToStaticMarkup(
      <SmLogicaSugerencias
        estado={{ fase: "listo", aviso: AVISO, sugerencias: [SUGERENCIA] }}
        saltos={0}
        questions={PREGUNTAS}
        visualRules={[]}
        visualPending={false}
        descartadas={new Set()}
        onAplicar={vi.fn(() => null)}
        onDescartar={vi.fn()}
      />,
    );
    expect(html).toContain(AVISO);
    expect(html).toContain("Sugerencia");
    expect(html).toContain("Si responde «No» a «¿Desea continuar con la encuesta?» → fin de encuesta");
    expect(html).toContain(">Aplicar<");
    expect(html).toContain(">Descartar<");
    expect(html).toContain('data-qa-geometry-group="xlsform-import-sm-sugerencias"');
  });

  test("ya aplicada, la tarjeta lo dice y no ofrece aplicarla otra vez", () => {
    const html = renderToStaticMarkup(
      <SmLogicaSugerencias
        estado={{ fase: "listo", aviso: AVISO, sugerencias: [SUGERENCIA] }}
        saltos={0}
        questions={PREGUNTAS}
        visualRules={[{
          id: "r",
          variableRef: "Q0001",
          variableLabel: "p1",
          choices: [
            { choiceName: "1", choiceLabel: "Sí", choiceIndex: 1, action: { kind: "none" } },
            { choiceName: "2", choiceLabel: "No", choiceIndex: 2, action: { kind: "end" } },
          ],
        }]}
        visualPending={false}
        descartadas={new Set()}
        onAplicar={vi.fn(() => null)}
        onDescartar={vi.fn()}
      />,
    );
    expect(html).toContain("Sugerencia aplicada");
    expect(html).not.toContain(">Aplicar<");
  });

  test("descartada no aparece; con un fallo del servidor queda el aviso", () => {
    const descartada = renderToStaticMarkup(
      <SmLogicaSugerencias
        estado={{ fase: "listo", aviso: AVISO, sugerencias: [SUGERENCIA] }}
        saltos={0}
        questions={PREGUNTAS}
        visualRules={[]}
        visualPending={false}
        descartadas={new Set(["fin_de_encuesta:p1"])}
        onAplicar={vi.fn(() => null)}
        onDescartar={vi.fn()}
      />,
    );
    expect(descartada).not.toContain("→ fin de encuesta");
    const error = renderToStaticMarkup(
      <SmLogicaSugerencias
        estado={{ fase: "error", aviso: AVISO }}
        saltos={0}
        questions={PREGUNTAS}
        visualRules={[]}
        visualPending={false}
        descartadas={new Set()}
        onAplicar={vi.fn(() => null)}
        onDescartar={vi.fn()}
      />,
    );
    expect(error).toContain(AVISO);
  });
});

describe("aviso de lógica con saltos ya agregados", () => {
  test("deja de decir «se importa sin saltos» y pasa a tono neutro", () => {
    const html = renderToStaticMarkup(
      <SmLogicaSugerencias
        estado={{ fase: "listo", aviso: AVISO, sugerencias: [] }}
        saltos={1}
        questions={PREGUNTAS}
        visualRules={[]}
        visualPending={false}
        descartadas={new Set()}
        onAplicar={vi.fn(() => null)}
        onDescartar={vi.fn()}
      />,
    );
    expect(html).not.toContain("se importa sin saltos");
    expect(html).toContain("revisa que los saltos agregados aquí estén completos");
    expect(html).toContain("is-neutro");
  });
});

describe("buscador de encuestas (U5)", () => {
  test("cada fila trae respuestas, preguntas y fecha; sin scroll propio", () => {
    const html = renderToStaticMarkup(
      <SmSurveyPicker
        surveys={[
          { id: "423593924", title: "Estudiantes", nickname: null, date_modified: "2026-10-12", response_count: 307, question_count: 28 },
          { id: "423600001", title: "Estudiantes", nickname: null, date_modified: "2026-10-12", response_count: 0, question_count: 27 },
        ]}
        meta={{ totalRecent: 2, months: 6, fromCache: false }}
        totalCuenta={531}
        selectedId="423593924"
        disabled={false}
        onSelect={vi.fn()}
      />,
    );
    expect(html).toContain("307 respuestas");
    expect(html).toContain("0 respuestas");
    expect(html).toContain("27 preguntas");
    expect(html).toContain("modificada 12 oct 2026");
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain("Mostrando 2 de 2 modificadas en los últimos 6 meses · 531 en la cuenta");
    expect(html).toContain('data-qa-geometry-group="xlsform-import-sm-encuestas"');
  });

  test("con muchas encuestas muestra las primeras y ofrece el resto", () => {
    const muchas = Array.from({ length: 30 }, (_, i) => ({
      id: String(400000000 + i), title: `Encuesta ${i}`, nickname: null, date_modified: null,
    }));
    const html = renderToStaticMarkup(
      <SmSurveyPicker surveys={muchas} meta={null} selectedId="" disabled={false} onSelect={vi.fn()} />,
    );
    expect(html.match(/pulso-xf-smi-encuesta"/g)?.length).toBe(12);
    expect(html).toContain("Mostrar 18 más");
  });
});

describe("secciones de la encuesta (U6/U8)", () => {
  test("una matriz se cuenta por filas y no expone tipos técnicos", () => {
    const html = renderToStaticMarkup(
      <SmPageMapEditor
        pages={[{
          id: "a",
          pageId: "3",
          title: "Satisfacción",
          questions: ["Q0013"],
          questionDetails: [{
            name: "Q0013",
            heading: "Califique",
            family: "matrix",
            subtype: "rating",
            choices: [{ code: "1", label: "Malo" }],
            children: [
              { name: "p13_1", heading: "Aulas", type: "select_one lst_p13", list_name: "lst_p13" },
              { name: "p13_2", heading: "Biblioteca", type: "select_one lst_p13", list_name: "lst_p13" },
            ],
          }],
        }]}
        onAdd={vi.fn()}
        onRemove={vi.fn()}
        onUpdate={vi.fn()}
      />,
    );
    expect(html).toContain("1 pregunta · 2 campos");
    expect(html).toContain("Matriz · 2 filas");
    expect(html).not.toMatch(JERGA);
    expect(html).not.toContain("overflow");
  });

  test("el texto de presentación vive en el desplegable, no en la tarjeta (C2)", () => {
    const bienvenida = "Estimado estudiante: le invitamos a participar en esta encuesta. ".repeat(6);
    const html = renderToStaticMarkup(
      <SmPageMapEditor
        pages={[{
          id: "a",
          pageId: "1",
          title: "Bienvenida",
          notes: [bienvenida],
          questions: ["Q0001"],
          questionDetails: [{ name: "Q0001", heading: "¿Desea continuar?", family: "single_choice", subtype: null, choices: [], children: [] }],
        }]}
        onAdd={vi.fn()}
        onRemove={vi.fn()}
        onUpdate={vi.fn()}
      />,
    );
    expect(html).toContain("Ver la pregunta y el texto de presentación");
    const desplegable = html.slice(html.indexOf("<details"), html.indexOf("</details>"));
    expect(desplegable).toContain("Estimado estudiante");
    expect(html.split("Estimado estudiante").length - 1).toBe(6);
    expect(html.replace(desplegable, "")).not.toContain("Estimado estudiante");
  });
});

describe("no entra al formulario (H9)", () => {
  const detalle = "La variable personalizada «id» no es una pregunta: llega en los datos como la columna «cv_id» (metadato).";

  test("el resumen lista cada detalle cuando viene", () => {
    const html = renderToStaticMarkup(
      <FinalImportReviewModal {...resumenBase} fueraDelFormulario={[{ tipo: "variable_personalizada", nombre: "id", detalle }]} />,
    );
    expect(html).toContain("No entra al formulario");
    expect(html).toContain("«cv_id» (metadato)");
    expect(html).not.toContain("variable_personalizada");
  });

  test("sin elementos no pinta la sección", () => {
    expect(renderToStaticMarkup(<FinalImportReviewModal {...resumenBase} />)).not.toContain("No entra al formulario");
    expect(renderToStaticMarkup(<SmFueraDelFormulario items={[]} />)).toBe("");
  });

  test("la procedencia conserva fuera_del_formulario tras el normalizador", () => {
    const source = normalizeXlsformFormSource({
      kind: "surveymonkey",
      original_name: "x",
      fuera_del_formulario: [
        { tipo: "variable_personalizada", nombre: "id", detalle },
        { tipo: "imagen", nombre: "Página 2", detalle: "" },
      ],
    });
    expect(fueraDelFormularioDe(source)).toEqual([{ tipo: "variable_personalizada", nombre: "id", detalle }]);
    // auto_unbox de R: una lista de un elemento llega como objeto suelto.
    const suelto = normalizeXlsformFormSource({ kind: "surveymonkey", original_name: "x", fuera_del_formulario: { tipo: "imagen", nombre: "Página 2", detalle: "La imagen…" } });
    expect(fueraDelFormularioDe(suelto)).toHaveLength(1);
    expect(fueraDelFormularioDe(normalizeXlsformFormSource({ kind: "xlsform", original_name: "x" }))).toEqual([]);
  });
});
