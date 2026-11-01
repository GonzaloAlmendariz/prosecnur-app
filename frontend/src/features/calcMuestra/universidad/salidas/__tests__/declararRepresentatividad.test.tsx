import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { normalizarVistaPreviaDeRepresentatividad } from "../../../../../api/calcMuestraRepresentatividad";
import { construirDeclaracion } from "../declaracionRepresentatividadModelo";
import { DeclararRepresentatividad } from "../DeclararRepresentatividad";

// ADR 0121 y 0123 Q1: el escenario guarda en Cálculo su universo y sus
// variables; las cuotas no viajan. El botón sólo aparece cuando hay qué guardar.

const vistaHsvg = normalizarVistaPreviaDeRepresentatividad({
  ok: true,
  disponible: true,
  representatividad: {
    schema: "representatividad_v1",
    universo: { nivel: "universidad", valor: null, etiqueta: "Universidad", inferido: false },
    variables: [
      { clave: "facultad", etiqueta: "Facultad", atribucion: "aula", categorias: [{ valor: "DERECHO" }, { valor: "LETRAS" }] },
      { clave: "sexo", etiqueta: "Sexo", atribucion: "respuesta", categorias: [{ valor: "F" }, { valor: "M" }] },
    ],
  },
});

const conGuardada = (claves: string[] | null) => ({
  ...vistaHsvg,
  declarada: claves ? { universo: { nivel: "universidad", valor: "", etiqueta: "" }, variables: claves.map((clave) => ({ clave, etiqueta: clave, atribucion: "", categorias: 0 })) } : null,
});

describe("construirDeclaracion", () => {
  it("sin metas en el escenario no hay botón ni nada que guardar", () => {
    const m = construirDeclaracion(normalizarVistaPreviaDeRepresentatividad({ ok: true, disponible: false }));
    expect(m).toMatchObject({ estado: "sin-diseno", boton: null });
  });

  it("sin nada guardado ofrece guardar en Cálculo", () => {
    const m = construirDeclaracion(conGuardada(null));
    expect(m).toMatchObject({ estado: "sin-declarar", boton: "Guardar en Cálculo", universo: "Toda la universidad" });
    expect(m.variables).toEqual(["Facultad", "Sexo"]);
  });

  it("al día cuando lo guardado reparte igual; si no, dice la diferencia", () => {
    expect(construirDeclaracion(conGuardada(["facultad", "sexo"]))).toMatchObject({ estado: "al-dia", boton: null, reimportar: true });
    expect(construirDeclaracion({ ...conGuardada(["facultad", "sexo"]), enLaFoto: true }).reimportar).toBe(false);
    expect(construirDeclaracion({ ...conGuardada(["facultad", "sexo"]), sorteoVigente: false })).toMatchObject({ estado: "distinto", boton: "Actualizar lo guardado", reimportar: false });
    const distinto = construirDeclaracion(conGuardada(["facultad"]));
    expect(distinto).toMatchObject({ estado: "distinto", boton: "Actualizar lo guardado" });
    expect(distinto.diferencia).toBe("Lo guardado reparte por facultad; el escenario usa facultad × sexo.");
  });

  it("el normalizador lee lo guardado del GET", () => {
    const v = normalizarVistaPreviaDeRepresentatividad({ disponible: true, representatividad: { universo: {}, variables: [{ clave: "facultad" }] }, declarada: { universo: {}, variables: [{ clave: "facultad" }] } });
    expect(v.declarada?.variables.map((x) => x.clave)).toEqual(["facultad"]);
  });
});

describe("DeclararRepresentatividad", () => {
  it("pinta universo, variables y el botón; declara su superficie", () => {
    const html = renderToStaticMarkup(<DeclararRepresentatividad inicial={{ vista: conGuardada(null) }} />);
    expect(html).toContain("Representatividad del estudio");
    expect(html).toContain("Toda la universidad");
    expect(html).toContain("Facultad × Sexo");
    expect(html).toContain(">Guardar en Cálculo</button>");
    expect(html).toContain('data-qa-geometry-member="representatividad"');
  });

  it("sin metas publica su vacío legítimo y ningún botón", () => {
    const html = renderToStaticMarkup(
      <DeclararRepresentatividad inicial={{ vista: { disponible: false, representatividad: null } }} />,
    );
    expect(html).toContain('data-qa-geometry-empty="legitimo"');
    expect(html).not.toContain("<button");
  });
});
