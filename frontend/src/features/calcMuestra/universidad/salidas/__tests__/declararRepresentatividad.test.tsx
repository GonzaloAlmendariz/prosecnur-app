import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { normalizarPlannerEstado, type PlannerEstado } from "../../../../../api/planner";
import { normalizarVistaPreviaDeRepresentatividad } from "../../../../../api/calcMuestraRepresentatividad";
import { construirDeclaracion } from "../declaracionRepresentatividadModelo";
import { DeclararRepresentatividad } from "../DeclararRepresentatividad";

// ADR 0121 F4: el escenario declara en el Planner su universo y sus variables;
// las cuotas no viajan. El botón sólo aparece cuando hay algo que declarar.

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

// Por el normalizador del Planner: el estado crece por su sesión y el fixture
// no tiene que seguirle el paso campo a campo.
function planner(claves: string[] | null, revision = 4): PlannerEstado {
  return normalizarPlannerEstado({
    revision,
    planner: {
      perfiles: [{
        tipo: "aulas", diseno: "calc-muestra", canales: [],
        poblaciones: [{
          id: "principal", etiqueta: "Estudiantes", bases: [],
          representatividad: claves ? { universo: { nivel: "universidad" }, variables: claves.map((clave) => ({ clave })) } : null,
        }],
      }],
    },
    origen: { perfiles: claves ? "declarado" : "proyectado" },
  });
}

describe("construirDeclaracion", () => {
  it("sin metas en el escenario no hay botón ni nada que declarar", () => {
    const m = construirDeclaracion(normalizarVistaPreviaDeRepresentatividad({ ok: true, disponible: false }), planner(null));
    expect(m).toMatchObject({ estado: "sin-diseno", boton: null });
  });

  it("con el Planner sin declarar ofrece declarar, con la revisión vigente", () => {
    const m = construirDeclaracion(vistaHsvg, planner(null, 7));
    expect(m).toMatchObject({ estado: "sin-declarar", boton: "Declarar en el Planner", revision: 7, universo: "Toda la universidad" });
    expect(m.variables).toEqual(["Facultad", "Sexo"]);
  });

  it("lo proyectado no cuenta como declarado", () => {
    const p = { ...planner(["facultad", "sexo"]) };
    p.origen = { ...p.origen, perfiles: "proyectado" };
    expect(construirDeclaracion(vistaHsvg, p).estado).toBe("sin-declarar");
  });

  it("al día cuando el Planner declara las mismas variables; si no, dice la diferencia", () => {
    expect(construirDeclaracion(vistaHsvg, planner(["facultad", "sexo"]))).toMatchObject({ estado: "al-dia", boton: null });
    const distinto = construirDeclaracion(vistaHsvg, planner(["facultad"]));
    expect(distinto).toMatchObject({ estado: "distinto", boton: "Actualizar la declaración" });
    expect(distinto.diferencia).toBe("El Planner declara facultad; el escenario usa facultad × sexo.");
  });
});

describe("DeclararRepresentatividad", () => {
  it("pinta universo, variables y el botón; declara su superficie", () => {
    const html = renderToStaticMarkup(<DeclararRepresentatividad inicial={{ vista: vistaHsvg, planner: planner(null) }} />);
    expect(html).toContain("Representatividad del estudio");
    expect(html).toContain("Toda la universidad");
    expect(html).toContain("Facultad × Sexo");
    expect(html).toContain(">Declarar en el Planner</button>");
    expect(html).toContain('data-qa-geometry-member="representatividad"');
  });

  it("sin metas publica su vacío legítimo y ningún botón", () => {
    const html = renderToStaticMarkup(
      <DeclararRepresentatividad inicial={{ vista: { disponible: false, representatividad: null }, planner: planner(null) }} />,
    );
    expect(html).toContain('data-qa-geometry-empty="legitimo"');
    expect(html).not.toContain("<button");
  });
});
