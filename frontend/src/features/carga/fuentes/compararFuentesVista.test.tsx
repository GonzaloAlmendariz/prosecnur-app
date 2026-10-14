import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { normalizeArmonizacionBase, normalizeComparacionFuentes, type ComparacionFuentes } from "../../../api/cargaArmonizacion";

vi.mock("../../../api/cargaFormularioPublicado", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../api/cargaFormularioPublicado")>()),
  apiCargaFormulariosPublicados: vi.fn(async () => []),
}));

import type { EstudioPayload } from "../../../api/estudio";
import { ArmonizacionBaseVista } from "./ArmonizacionBaseVista";
import { BasesDelEstudio } from "./BasesDelEstudio";
import { CompararFuentesVista } from "./CompararFuentesVista";
import { readinessArmonizacion } from "./ArmonizacionBasePanel";
import { readinessComparacion } from "./CompararFuentesPanel";

const COMP: ComparacionFuentes = normalizeComparacionFuentes({
  base_a: { nombre: "estudiantes_sm", n_filas: 289, fuente: "surveymonkey", datos: "cruda" },
  base_b: { nombre: "estudiantes_sav", n_filas: 279, fuente: "sav", datos: "depurada" },
  revision_id: "rev-3",
  variables: [
    { variable: "p1", etiqueta: "Facultad", estado: "igual", n_validos_a: 289, n_validos_b: 279, categorias: [] },
    {
      variable: "p3_una_variable_con_nombre_muy_largo_que_no_debe_romper_el_marco",
      etiqueta: "¿Con qué género te identificas? (pregunta con un enunciado largo que envuelve)",
      estado: "distinta", n_validos_a: 289, n_validos_b: 276,
      categorias: [
        { codigo: 1, etiqueta: "Mujer", n_a: 150, n_b: 150, pct_a: 51.9, pct_b: 54.3 },
        { codigo: 3, etiqueta: "No binario", n_a: 3, pct_a: 1, fuera_de_lista: true },
        { codigo: 99, etiqueta: "SIN INF", n_a: 10, n_b: 6, pct_a: 3.5, pct_b: 2.2, especial: true },
      ],
      diferencia_max_pp: 2.4,
      categorias_solo_a: [{ codigo: 3, etiqueta: "No binario" }],
    },
  ],
  resumen: { n_iguales: 1, n_distintas: 1, n_con_categorias_exclusivas: 1, diferencia_filas: 10 },
  casos: { clave: "respondent_id", solo_a: 10, solo_b: 0, en_ambas: 279 },
  perdidas_en_carga_b: [{ variable: "p3", etiqueta: "No binario", n: 3 }],
});

describe("CompararFuentesVista", () => {
  const html = renderToStaticMarkup(<CompararFuentesVista carga={{ tipo: "listo", datos: COMP }} />);

  it("declara C1 en las dos fuentes, los contadores y la lista de variables", () => {
    expect(html).toContain('data-qa-geometry-group="carga/comparar-fuentes/fuentes" data-qa-geometry-contract="equal"');
    expect(html).toContain('data-qa-geometry-group="carga/comparar-fuentes/contadores" data-qa-geometry-contract="equal"');
    expect(html).toContain('data-qa-geometry-group="carga/comparar-fuentes/variables" data-qa-geometry-contract="intrinsic"');
  });

  it("encabeza con las dos fuentes, si vienen crudas o depuradas, y los casos cruzados", () => {
    expect(html).toContain("estudiantes_sm");
    expect(html).toContain("Base cruda");
    expect(html).toContain("Base depurada");
    expect(html).toContain("279 en ambas · 10 solo en SurveyMonkey");
    expect(html).toContain("Con categorías propias");
  });

  it("cada porcentaje lleva su frecuencia y los especiales van aparte, atenuados", () => {
    expect(html).toContain("51.9 % (150)");
    expect(html).toContain("Códigos especiales");
    expect(html).toMatch(/<tr class="is-especial">.*SIN INF/);
    expect(html).toContain("Fuera del formulario");
    expect(html).toContain("No está");
    expect(html).toContain("Difiere hasta 2.4 pp");
  });

  it("es una tabla con encabezados de fila y columna por fuente", () => {
    expect(html).toContain('<th scope="col" class="is-a">SurveyMonkey</th>');
    expect(html).toContain('<th scope="row" class="pulso-cf-categoria">');
  });

  it("avisa lo que la carga perdió y pliega las iguales", () => {
    expect(html).toContain("El .sav traía categorías que el formulario no tiene");
    expect(html).toContain("Agrégalas al formulario y vuelve a publicar");
    expect(html).toMatch(/<details class="pulso-cf-iguales">.*Variables iguales/);
    expect(html.indexOf("Variables que difieren")).toBeLessThan(html.indexOf("Variables iguales"));
  });

  it("sin variables distintas, el vacío es honesto y contenido", () => {
    const iguales = renderToStaticMarkup(
      <CompararFuentesVista carga={{ tipo: "listo", datos: { ...COMP, variables: COMP.variables.filter((v) => v.estado === "igual") } }} />,
    );
    expect(iguales).toContain("Las dos fuentes coinciden");
    expect(iguales).toContain('data-qa-geometry-capacity="owned"');
  });

  it("el error de otra revisión se muestra como alerta", () => {
    const err = renderToStaticMarkup(<CompararFuentesVista carga={{ tipo: "error", mensaje: "revisiones distintas" }} />);
    expect(err).toContain('role="alert"');
    expect(err).toContain("revisiones distintas");
  });
});

describe("ArmonizacionBaseVista", () => {
  it("reusa la vista previa con su propio grupo C1 y la cabecera de formulario, revisión y fuente", () => {
    const datos = normalizeArmonizacionBase({
      base: "sm", disponible: true, fuente: "surveymonkey", importado_at: "2026-10-12T15:04:00Z",
      formulario: { form_id: "f1", form_name: "Estudiantes Arte 2026", revision_id: "rev-3", revision_no: 3 },
      n_filas: 289, n_emparejadas: 38, n_variables_instrumento: 42,
      recodificaciones: [{ variable: "p10", etiqueta: "SIN INF", desde: 5, hacia: 99 }],
      opciones_sin_par: [{ variable: "p3", n: 3, etiquetas: [{ etiqueta: "No binario", n: 3 }] }],
    });
    const html = renderToStaticMarkup(<ArmonizacionBaseVista carga={{ tipo: "listo", datos }} />);
    expect(html).toContain('data-qa-geometry-group="carga/armonizacion-base/cabecera"');
    expect(html).toContain('data-qa-geometry-group="carga/armonizacion-base/vista-previa"');
    expect(html).toContain('data-qa-geometry-group="carga/armonizacion-base/contadores"');
    expect(html).toContain("Estudiantes Arte 2026");
    expect(html).toContain("revisión 3");
    expect(html).toContain("SurveyMonkey");
    expect(html).toContain("Código del formulario");
    expect(html).toContain("No binario");
    expect(readinessArmonizacion({ tipo: "listo", datos }, "sm")).toBe("true");
  });

  it("disponible:false: vacío honesto sin veredicto ni contadores", () => {
    const datos = normalizeArmonizacionBase({ base: "vieja", disponible: false });
    const html = renderToStaticMarkup(<ArmonizacionBaseVista carga={{ tipo: "listo", datos }} />);
    expect(html).toContain("Esta base no guarda su armonización");
    expect(html).not.toContain("pulso-bfp-veredicto");
    expect(readinessArmonizacion({ tipo: "listo", datos }, "vieja")).toBe("vacio:sin-armonizacion");
  });
});

describe("readiness de los paneles", () => {
  it("`false` sólo mientras lee; un terminal sin contenido publica vacio:<motivo>", () => {
    expect(readinessArmonizacion({ tipo: "cargando" }, "sm")).toBe("false");
    expect(readinessArmonizacion({ tipo: "cargando" }, null)).toBe("vacio:sin-base");
    expect(readinessComparacion({ tipo: "cargando" }, { a: "a", b: "b" })).toBe("false");
    expect(readinessComparacion({ tipo: "cargando" }, null)).toBe("vacio:sin-par");
    expect(readinessComparacion({ tipo: "error", mensaje: "x" }, { a: "a", b: "b" })).toBe("vacio:error");
    expect(readinessComparacion({ tipo: "listo", datos: COMP }, { a: "a", b: "b" })).toBe("true");
  });
});

describe("BasesDelEstudio", () => {
  const estudio = {
    bases: {
      sm: { nombre: "sm", n_filas: 289, n_columnas: 40, source_kind: "formulario_publicado_surveymonkey", instrument_revision_id: "rev-3" },
      sav: { nombre: "sav", n_filas: 279, n_columnas: 40, source_kind: "formulario_publicado_sav", instrument_revision_id: "rev-3" },
      manual: { nombre: "manual", n_filas: 10, n_columnas: 4, source_kind: "manual" },
    },
  } as unknown as EstudioPayload;

  it("ofrece «Ver armonización» en las bases ligadas y «Comparar fuentes» con dos de la misma revisión", () => {
    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={["/procesamiento?seccion=carga"]}>
        <BasesDelEstudio estudio={estudio} onCambio={() => undefined} renderOrigen={() => null} />
      </MemoryRouter>,
    );
    expect(html.match(/<\/svg>Ver armonización/g)).toHaveLength(2);
    expect(html).toContain("Comparar con sav");
    expect(html).toContain("Comparar con sm");
    expect(html).toContain('data-plf-abrir="comparar"');
    expect(html).toContain('aria-haspopup="dialog"');
  });

  it("sin una segunda base de la misma revisión no ofrece comparar", () => {
    const solo = { bases: { sm: estudio.bases.sm, manual: estudio.bases.manual } } as unknown as EstudioPayload;
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <BasesDelEstudio estudio={solo} onCambio={() => undefined} renderOrigen={() => null} />
      </MemoryRouter>,
    );
    expect(html).toContain("Ver armonización");
    expect(html).not.toContain("Comparar");
  });
});
