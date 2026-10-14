import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { FormularioPublicado, VistaPreviaFormularioPublicado as VistaPreviaDatos } from "../../../api/cargaFormularioPublicado";
import type { EstudioPayload } from "../../../api/estudio";

vi.mock("../../../api/cargaFormularioPublicado", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../api/cargaFormularioPublicado")>()),
  apiCargaFormulariosPublicados: vi.fn(async () => []),
}));

import { AvisoFormularioPublicado } from "./AvisoFormularioPublicado";
import { NuevaBaseFormularioPublicado } from "./NuevaBaseFormularioPublicado";
import { VistaPreviaFormularioPublicado } from "./VistaPreviaFormularioPublicado";

const ARTE: FormularioPublicado = {
  form_id: "f1", form_name: "Estudiantes Arte 2026", revision_id: "rev-3", revision_no: 3, published_at: "",
  survey_id: "5001", campanas: [], logic_status: "external_declared", logic_external: true, logic_external_herramienta: "SPSS", n_campos: 42,
};

const VP: VistaPreviaDatos = {
  n_filas: 120, fuentes: [], n_emparejadas: 38, n_variables_instrumento: 42, cobertura: 38 / 42, cobertura_texto: "",
  sin_par_instrumento: [], sin_par_fuente: [{ variable: "q0099", etiqueta: "Respondent ID" }],
  recodificaciones: Array.from({ length: 8 }, (_, i) => ({ variable: `p10_${i + 1}`, etiqueta: "SIN INF", desde: "5", hacia: "99" })),
  opciones_sin_par: [], bloqueo: null,
};

describe("NuevaBaseFormularioPublicado", () => {
  it("lista los formularios con revisión, campos y lógica externa, con C1 declarado", () => {
    const html = renderToStaticMarkup(
      <NuevaBaseFormularioPublicado estudio={{ bases: {} } as unknown as EstudioPayload} formularios={[ARTE]} onCreada={() => undefined} />,
    );
    expect(html).toContain("Estudiantes Arte 2026");
    expect(html).toContain("revisión 3");
    expect(html).toContain("42 campos");
    expect(html).toContain("Lógica: fuera de Prosecnur · SPSS");
    expect(html).toContain('data-qa-geometry-group="carga/formulario-publicado/formularios"');
    expect(html).toContain('aria-live="polite"');
  });
});

describe("VistaPreviaFormularioPublicado", () => {
  it("separa código y etiqueta en columnas rotuladas y pliega el resto", () => {
    const html = renderToStaticMarkup(<VistaPreviaFormularioPublicado vistaPrevia={VP} />);
    expect(html).toContain("Código de la fuente");
    expect(html).toContain("Código del formulario");
    expect(html).toMatch(/<td class="is-etiqueta">SIN INF<\/td>/);
    expect(html).toContain('<span class="pulso-bfp-codigo">5</span>');
    expect(html).toContain('<span class="pulso-bfp-codigo is-destino">99</span>');
    expect(html).toContain("Ver las otras 2");
    expect(html).toContain('role="meter"');
    expect(html).toContain('aria-valuenow="90"');
    expect(html).toContain("Sin par en la fuente");
    expect(html).toContain("No entran");
    expect(html).toContain("Opciones sin par");
  });

  it("con bloqueo anuncia que la base no es de este formulario", () => {
    const html = renderToStaticMarkup(
      <VistaPreviaFormularioPublicado vistaPrevia={{ ...VP, cobertura: 0.3, bloqueo: { codigo: "E_FUENTE_NO_CALZA", mensaje: "Sólo calzan 12 de 42." } }} />,
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain("Esta base no es de este formulario");
    expect(html).toContain("Sólo calzan 12 de 42.");
  });
});

describe("AvisoFormularioPublicado", () => {
  it("sólo aparece si hay formularios publicados", () => {
    expect(renderToStaticMarkup(<AvisoFormularioPublicado cuantos={0} onUsar={() => undefined} />)).toBe("");
    const html = renderToStaticMarkup(<AvisoFormularioPublicado cuantos={2} onUsar={() => undefined} />);
    expect(html).toContain("¿Ya publicaste el formulario? Úsalo.");
    expect(html).toContain("2 formularios publicados");
  });
});
