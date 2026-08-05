/**
 * ADR 0060 · el catálogo de filtros declara lo variable y cierra la clase.
 *
 * Lo que se protege aquí es la asimetría del contrato: cuántos filtros hay y
 * cómo se llaman es del estudio, pero el efecto sobre el denominador lo decide
 * la clase y tiene que estar a la vista al elegirla.
 */
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { FiltrosCorteCard } from "../FiltrosCorteCard";
import type {
  CalcMuestraFiltroCorteDeclarado,
  CalcMuestraWorkspaceSourceBinding,
} from "../../../../../api/client";

const BINDING: CalcMuestraWorkspaceSourceBinding = {
  id: "ref-1",
  role: "referencia_asistencia",
  label: "Base histórica",
  sheet_name: "Base de control",
  sheet_diagnostics: [
    { name: "Base de control", columns_sample: ["consent_1", "consent_2", "filtro_ciclos"] },
    { name: "Otra hoja", columns_sample: ["columna_de_otra_hoja"] },
  ],
};

const filtro = (
  over: Partial<CalcMuestraFiltroCorteDeclarado> = {},
): CalcMuestraFiltroCorteDeclarado => ({
  id: "f1",
  etiqueta: "No quiso participar",
  columna: "consent_1",
  condicion: "== 2",
  clase: "rechazo",
  origen: "formulario",
  orden: 1,
  confirmado: true,
  ...over,
});

const render = (filtros: CalcMuestraFiltroCorteDeclarado[]) =>
  renderToStaticMarkup(
    <FiltrosCorteCard binding={BINDING} filtros={filtros} onChange={() => {}} />,
  );

describe("FiltrosCorteCard", () => {
  it("sin filtros declara qué supuesto queda vigente y no bloquea", () => {
    const html = render([]);
    expect(html).toContain("Sin filtros declarados");
    expect(html).toContain("toda respuesta iniciada fuera");
    // C3: el vacío vive dentro de la superficie y la deja lista igual.
    expect(html).toContain('data-audit-ready="true"');
  });

  it("ofrece solo las columnas de la hoja activa de esta base", () => {
    const html = render([filtro()]);
    expect(html).toContain("consent_1");
    expect(html).toContain("filtro_ciclos");
    expect(html).not.toContain("columna_de_otra_hoja");
  });

  it("la clase muestra su consecuencia sobre el denominador", () => {
    const perdida = render([filtro({ clase: "rechazo" })]);
    expect(perdida).toContain("cuenta como pérdida");
    expect(perdida).toContain("Podía responder y no quiso");

    const fuera = render([filtro({ clase: "no_elegible" })]);
    expect(fuera).toContain("sale del denominador");
    expect(fuera).toContain("Nunca debió contar en la meta");

    const medido = render([filtro({ clase: "ya_medido", origen: "campo" })]);
    expect(medido).toContain("sale del denominador");
    expect(medido).toContain("ya cumplió");
  });

  it("un filtro incompleto no se puede confirmar y lo declara", () => {
    const html = render([filtro({ columna: "", confirmado: false })]);
    expect(html).toContain("Falta columna, condición o nombre");
    expect(html).toContain('data-audit-ready="false"');
  });

  it("una columna que ya no está en la hoja se conserva y se señala", () => {
    const html = render([filtro({ columna: "columna_borrada" })]);
    expect(html).toContain("columna_borrada");
    expect(html).toContain("no está en la hoja");
  });

  it("el orden de la cascada se numera en pantalla", () => {
    const html = render([
      filtro({ id: "a", orden: 1, etiqueta: "Primero" }),
      filtro({ id: "b", orden: 2, etiqueta: "Segundo" }),
      filtro({ id: "c", orden: 3, etiqueta: "Tercero" }),
    ]);
    const ordenes = html.match(/cmv2-defi-filtros-orden[^>]*>(\d+)</g) ?? [];
    expect(ordenes).toHaveLength(3);
    expect(html.indexOf("Primero")).toBeLessThan(html.indexOf("Segundo"));
    expect(html.indexOf("Segundo")).toBeLessThan(html.indexOf("Tercero"));
  });

  it("los filtros se pintan por su orden declarado, no por el del arreglo", () => {
    const html = render([
      filtro({ id: "c", orden: 3, etiqueta: "Va tercero" }),
      filtro({ id: "a", orden: 1, etiqueta: "Va primero" }),
    ]);
    expect(html.indexOf("Va primero")).toBeLessThan(html.indexOf("Va tercero"));
  });
});
