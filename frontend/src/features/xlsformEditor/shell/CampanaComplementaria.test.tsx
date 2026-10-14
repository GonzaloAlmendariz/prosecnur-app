import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import type { CampanaVistaPrevia } from "../../../api/xlsformCampanas";
import { CampanaComplementariaPanel } from "./CampanaComplementariaPanel";
import { CampanaVistaPreviaResumen } from "./CampanaVistaPreviaResumen";
import { CampanasDeclaradas } from "./CampanasDeclaradas";
import { FormCard } from "./FormCard";
import { CampanaSugeridaAviso } from "./ImportSurveyMonkeyDialog";

const VISTA_OK: CampanaVistaPrevia = {
  survey_id: "423593924",
  titulo: "Acreditación Arte y Diseño PUCP a Estudiantes",
  n_emparejadas: 73,
  n_preguntas_base: 74,
  cobertura: 0.986,
  cobertura_texto: "98.6 %",
  instrumento_distinto: false,
  faltan: [{ variable: "p4", etiqueta: "¿Cuál es su código PUCP?" }],
  extra: [],
  ambiguas: [],
};

describe("vista previa de la campaña", () => {
  test("calza: dice cuántas y qué quedará vacío, sin cajas vacías", () => {
    const html = renderToStaticMarkup(<CampanaVistaPreviaResumen vista={VISTA_OK} />);
    expect(html).toContain("Calzan 73 de 74 preguntas (98.6 %)");
    expect(html).toContain("Quedarán vacías para las respuestas de esta campaña (1)");
    expect(html).toContain("¿Cuál es su código PUCP?");
    expect(html).not.toContain("No entran");
    expect(html).not.toContain("Ambiguas");
    expect(html).not.toContain('role="alert"');
  });

  test("instrumento distinto: bloquea e indica importarla y relacionarla en Equivalencias", () => {
    const html = renderToStaticMarkup(
      <CampanaVistaPreviaResumen
        vista={{
          ...VISTA_OK,
          instrumento_distinto: true,
          n_emparejadas: 20,
          cobertura: 0.27,
          cobertura_texto: "27 %",
          extra: [{ variable: "q9", etiqueta: "Otra pregunta" }],
        }}
      />,
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain("formulario propio");
    expect(html).toContain("Equivalencias");
    expect(html).toContain("No entran al instrumento (1)");
  });
});

describe("panel de declaración", () => {
  const base = {
    formId: "f-1",
    formName: "Estudiantes",
    encuestaPrincipal: "528294775",
    campanasDeclaradas: [],
    onCancelar: vi.fn(),
    onDeclarada: vi.fn(),
  };

  test("desde la tarjeta: pide el ID o enlace y no deja confirmar sin vista previa", () => {
    const html = renderToStaticMarkup(<CampanaComplementariaPanel {...base} elegirEncuesta />);
    expect(html).toContain("ID o enlace de SurveyMonkey");
    expect(html).toContain("Buscar mis encuestas");
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Agregar campaña<\/button>/);
    expect(html).toContain('data-qa-geometry-group="xlsform-campana-complementaria"');
    expect(html).not.toMatch(/survey_id|required|hash/i);
  });

  test("desde la importación: la encuesta viene dada y arranca comparando", () => {
    const html = renderToStaticMarkup(
      <CampanaComplementariaPanel {...base} elegirEncuesta={false} surveyIdInicial="423593924" cancelarLabel="Volver a la importación" />,
    );
    expect(html).not.toContain("ID o enlace de SurveyMonkey");
    expect(html).toContain("Comparando las preguntas de la encuesta 423593924");
    expect(html).toContain("Volver a la importación");
  });
});

describe("campañas en la tarjeta", () => {
  const campana = {
    survey_id: "423593924",
    survey_title: "Estudiantes por correo",
    n_emparejadas: 73,
    n_preguntas_base: 74,
    cobertura: 0.986,
    sin_par_base: [],
    declarada_en: "",
    review_status: "confirmed",
  };

  test("sin campañas no pinta nada", () => {
    expect(renderToStaticMarkup(<CampanasDeclaradas formId="f-1" formName="X" campanas={[]} />)).toBe("");
  });

  test("con campañas: resumen, título, ID y acción de quitar", () => {
    const html = renderToStaticMarkup(<CampanasDeclaradas formId="f-1" formName="X" campanas={[campana]} />);
    expect(html).toContain("Principal + 1 campaña");
    expect(html).toContain("Estudiantes por correo");
    expect(html).toContain("ID 423593924 · calzan 73 de 74");
    expect(html).toContain('aria-label="Quitar la campaña Estudiantes por correo"');
  });

  test("la tarjeta lee las campañas de la procedencia", () => {
    const html = renderToStaticMarkup(
      <FormCard
        entry={{
          id: "f-1",
          name: "Estudiantes",
          savedAt: Date.now(),
          source: {
            kind: "surveymonkey",
            original_name: "Estudiantes",
            survey_id: "528294775",
            variants: [{ rol: "campana_complementaria", ...campana, sin_par_base: [] }],
          },
        }}
        metrics={{ questions: 74, sections: 5 }}
        isActive={false}
        onOpen={vi.fn()}
        onRename={vi.fn()}
        onDelete={vi.fn()}
        publication={null}
        isPublishing={false}
        isConfirmingLogic={false}
        onPublish={vi.fn()}
        onConfirmLogic={vi.fn()}
        actorOptions={[]}
        onActorChange={vi.fn()}
        onAddCampaign={vi.fn()}
      />,
    );
    expect(html).toContain("Principal + 1 campaña");
  });
});

describe("sugerencia al importar", () => {
  test("pregunta si es campaña del formulario parecido y ofrece las dos salidas", () => {
    const html = renderToStaticMarkup(
      <CampanaSugeridaAviso
        sugerencia={{
          form_id: "f-1",
          form_name: "Estudiantes",
          survey_id_principal: "528294775",
          cobertura: 0.986,
          cobertura_texto: "98.6 %",
          n_emparejadas: 73,
          n_preguntas_base: 74,
        }}
        onDeclarar={vi.fn()}
        onImportarNuevo={vi.fn()}
      />,
    );
    expect(html).toContain("Esta encuesta comparte el 98.6 % de las preguntas de «Estudiantes»");
    expect(html).toContain("¿Es una");
    expect(html).toContain("Agregar como campaña de Estudiantes");
    expect(html).toContain("Importar como formulario nuevo");
  });
});

describe("geometría del selector de encuestas (U15)", () => {
  test("el campo no lleva base flexible fuera de la fila de entrada: en la columna del catálogo era un alto", async () => {
    const { readFileSync } = await import("node:fs");
    const css = readFileSync(new URL("../styles/xf-campana.css", import.meta.url), "utf8");
    const bloqueCampo = css.match(/\n\.pulso-xf-campana-campo \{[^}]*\}/)?.[0] ?? "";
    expect(bloqueCampo).not.toMatch(/flex:/);
    expect(css).toMatch(/\.pulso-xf-campana-entrada > \.pulso-xf-campana-campo \{\s*flex: 1 1 220px;/);
  });
});
