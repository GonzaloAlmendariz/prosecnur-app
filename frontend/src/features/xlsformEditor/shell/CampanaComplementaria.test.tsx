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

const muchas = (n: number, prefijo = "p13") =>
  Array.from({ length: n }, (_, i) => ({ variable: `${prefijo}_${i + 1}`, etiqueta: `Enunciado largo número ${i + 1}` }));

describe("vista previa de la campaña", () => {
  test("calza con pocas diferencias: veredicto, medidor, contadores pares y detalle abierto", () => {
    const html = renderToStaticMarkup(<CampanaVistaPreviaResumen vista={VISTA_OK} />);
    expect(html).toContain("Es una campaña de este instrumento, con diferencias");
    expect(html).toContain("73 de 74 campos calzan");
    expect(html).toContain("98.6 %");
    expect(html).toContain('role="meter"');
    expect(html).toContain("mínimo 80 %");
    // Los tres contadores siempre, el cero como «ninguna».
    expect(html).toContain('data-qa-geometry-group="xlsform-campana-contadores"');
    expect(html).toContain('data-qa-geometry-contract="equal"');
    expect(html).toContain('data-qa-geometry-group="xlsform-campana-veredicto"');
    expect(html.match(/>ninguna</g)?.length).toBe(2);
    // Una sola pregunta: el detalle arranca abierto, código en chip.
    expect(html).toContain('aria-expanded="true"');
    expect(html).toContain('<code class="pulso-xf-campana-codigo">p4</code>');
    expect(html).toContain("¿Cuál es su código PUCP?");
    expect(html).not.toContain('role="alert"');
  });

  test("calza completa: veredicto de éxito y ningún detalle", () => {
    const html = renderToStaticMarkup(
      <CampanaVistaPreviaResumen vista={{ ...VISTA_OK, n_emparejadas: 74, cobertura: 1, cobertura_texto: "100 %", faltan: [] }} />,
    );
    expect(html).toContain("is-success");
    expect(html).toContain("Es una campaña de este instrumento<");
    expect(html.match(/>ninguna</g)?.length).toBe(3);
    expect(html).not.toContain("<ul");
  });

  test("muchas diferencias: el detalle arranca plegado con «Ver las N»", () => {
    const html = renderToStaticMarkup(<CampanaVistaPreviaResumen vista={{ ...VISTA_OK, faltan: muchas(28) }} />);
    expect(html).toContain("Ver las 28");
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain("Enunciado largo número 1<");
  });

  test("instrumento distinto: veredicto de peligro, detalle cerrado y la indicación como acción", () => {
    const html = renderToStaticMarkup(
      <CampanaVistaPreviaResumen
        vista={{
          ...VISTA_OK,
          instrumento_distinto: true,
          n_emparejadas: 46,
          cobertura: 0.621,
          cobertura_texto: "62.1 %",
          faltan: muchas(2, "p12"),
          extra: [{ variable: "q9", etiqueta: "Otra pregunta" }],
        }}
        onImportarComoFormulario={vi.fn()}
      />,
    );
    expect(html).toContain("No es una campaña de este instrumento");
    expect(html).toContain("is-danger");
    expect(html).toContain('role="alert"');
    expect(html).toContain("formulario propio");
    expect(html).toContain("Equivalencias");
    expect(html).toContain("Importar como formulario propio");
    expect(html).not.toContain('aria-expanded="true"');
    // El veredicto es un encabezado enfocable: ahí va el foco tras comparar.
    expect(html).toMatch(/<h4[^>]*tabindex="-1"[^>]*class="pulso-xf-campana-veredicto-estado"/);
    expect(html).not.toContain("Otra pregunta");
  });

  test("proyecto lleno: la acción se ve deshabilitada con la razón visible", () => {
    const html = renderToStaticMarkup(
      <CampanaVistaPreviaResumen
        vista={{ ...VISTA_OK, instrumento_distinto: true }}
        onImportarComoFormulario={vi.fn()}
        importarBloqueadoPor="Límite de 6 formularios: elimina uno para importar."
      />,
    );
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>.*Importar como formulario propio<\/button>/);
    expect(html).toContain("Límite de 6 formularios: elimina uno para importar.");
    expect(html).toMatch(/aria-describedby="[^"]*-importar-razon"/);
  });

  test("sin salida directa, la indicación queda como texto", () => {
    const html = renderToStaticMarkup(
      <CampanaVistaPreviaResumen vista={{ ...VISTA_OK, instrumento_distinto: true }} />,
    );
    expect(html).toContain("formulario propio");
    expect(html).not.toContain("Importar como formulario propio");
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
    expect(html).toContain('placeholder="Ej.: 123456789 o enlace de SurveyMonkey"');
    expect(html).toContain("Buscar mis encuestas");
    // El vacío lo posee la sección de coincidencia (C3).
    expect(html).toContain('data-qa-geometry-capacity="owned"');
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

  test("cerrado es sólo un chip: el detalle no suma alto a la tarjeta (C2)", () => {
    const html = renderToStaticMarkup(<CampanasDeclaradas formId="f-1" formName="X" campanas={[campana, { ...campana, survey_id: "2" }, { ...campana, survey_id: "3" }]} />);
    expect(html).toContain("Principal + 3 campañas");
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain("Estudiantes por correo");
  });

  test("abierto: título, calce, ID y acción de quitar", () => {
    const html = renderToStaticMarkup(<CampanasDeclaradas formId="f-1" formName="X" campanas={[campana]} abiertoInicial />);
    expect(html).toContain("Principal + 1 campaña");
    expect(html).toContain('aria-expanded="true"');
    expect(html).toContain("Estudiantes por correo");
    expect(html).toContain("73/74");
    expect(html).toContain("ID 423593924 · calzan 73 de 74 campos");
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
    // La hoja se partió en partes (revamp EM): se leen concatenadas en el orden del índice.
    const css = ["01-campana-complementaria-adr-0.css", "02-leyenda-del-umbral-junto-al.css"]
      .map((parte) => readFileSync(new URL(`../styles/xf-campana/${parte}`, import.meta.url), "utf8"))
      .join("");
    const bloqueCampo = css.match(/\n\.pulso-xf-campana-campo \{[^}]*\}/)?.[0] ?? "";
    expect(bloqueCampo).not.toMatch(/flex:/);
    expect(css).toMatch(/\.pulso-xf-campana-entrada > \.pulso-xf-campana-campo \{\s*flex: 1 1 220px;/);
  });
});
