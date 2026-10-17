import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import type { XlsformEditorWorkbook } from "../../../api/multiIntegrado";
import { PANELES_POR_MODULO } from "../../../lib/navegacion/manifiesto";
import { panelAbiertoEn } from "../../../lib/navegacion/paneles";
import { analizarListas } from "./listasModel";
import { ListasOpcionesPanel, TEXTO_DIDACTICO_LISTAS } from "./ListasOpcionesPanel";
import { PANEL_LISTAS_OPCIONES, estadoListasRepetidas } from "./panelListas";
import type { ControlListasOpciones } from "./useListasOpciones";
import { TEXTO_ENTRE_FORMULARIOS } from "./EntreFormulariosSeccion";
import type { EstadoHermanos } from "./useFormulariosHermanos";

const ACUERDO = [["1", "En desacuerdo"], ["2", "De acuerdo"]];

function wb(choices: string[][], survey: string[][]): XlsformEditorWorkbook {
  return {
    survey: { columns: ["type", "name", "label"], rows: survey },
    choices: { columns: ["list_name", "name", "label"], rows: choices },
    settings: { columns: [], rows: [] },
  };
}

function control(w: XlsformEditorWorkbook): ControlListasOpciones {
  const analisis = analizarListas(w);
  return { analisis, repetidas: analisis.grupos.length, aviso: null, unificar: vi.fn(() => null), renombrar: vi.fn(() => null), renombrarVarias: vi.fn(() => null) };
}

describe("ListasOpcionesPanel", () => {
  test("una tarjeta por escala repetida, con C1 equal y nombre sugerido", () => {
    const w = wb(
      [...ACUERDO.map(([c, l]) => ["p1", c, l]), ...ACUERDO.map(([c, l]) => ["p2", c, l]), ["sexo", "1", "Hombre"]],
      [["select_one p1", "p1", ""], ["select_one p2", "p2", ""], ["select_one sexo", "sexo", ""]],
    );
    const html = renderToStaticMarkup(<ListasOpcionesPanel workbook={w} control={control(w)} />);
    expect(html).toContain('data-qa-geometry-group="xlsform-listas-grupos"');
    expect(html).toContain('data-qa-geometry-contract="equal"');
    expect(html).toContain("Esta escala se repite en 2 preguntas");
    expect(html).toContain('value="acuerdo"');
    expect(html).toContain("Unificar como «acuerdo»");
    // Código y etiqueta en columnas rotuladas, no pegados en un chip.
    expect(html).toContain('<th scope="col">Código</th><th scope="col">Etiqueta</th>');
    expect(html).toContain('<code class="pulso-xf-listas-codigo">1</code></td><td class="pulso-xf-listas-etiqueta" title="En desacuerdo">En desacuerdo</td>');
    expect(html).toContain("Listas únicas");
    expect(html).toContain("Renombrar la lista sexo");
  });

  test("cada tarjeta reserva la línea de error y el nombre sugerido de otra escala no se acepta", () => {
    const SI_NO = [["1", "Sí"], ["2", "No"]];
    const w = wb(
      [
        ...ACUERDO.map(([c, l]) => ["p1", c, l]), ...ACUERDO.map(([c, l]) => ["p2", c, l]),
        ...SI_NO.map(([c, l]) => ["s1", c, l]), ...SI_NO.map(([c, l]) => ["s2", c, l]),
      ],
      [["select_one p1", "p1", ""], ["select_one p2", "p2", ""], ["select_one s1", "s1", ""], ["select_one s2", "s2", ""]],
    );
    const html = renderToStaticMarkup(<ListasOpcionesPanel workbook={w} control={control(w)} />);
    // Sin errores: dos líneas reservadas vacías, ninguna alerta.
    expect(html.match(/<p class="pulso-xf-listas-error"><\/p>/g)).toHaveLength(2);
    expect(html).not.toContain('role="alert"');
    expect(html).toContain('value="acuerdo"');
    expect(html).toContain('value="si_no"');
  });

  test("vacío legítimo sin escalas repetidas", () => {
    const w = wb([["sexo", "1", "Hombre"]], [["select_one sexo", "sexo", ""]]);
    const html = renderToStaticMarkup(<ListasOpcionesPanel workbook={w} control={control(w)} />);
    expect(html).toContain("No hay escalas repetidas.");
    expect(html).toContain('data-qa-geometry-capacity="owned"');
    expect(html).not.toContain("xlsform-listas-grupos");
  });

  test("entre formularios: no aparece sin otros formularios; con ellos, filas C1 equal y advertencia de códigos", () => {
    const w = wb(
      [["lst_p3", "1", "Masculino"], ["lst_p3", "2", "Femenino"], ["lst_p8", "1", "Sí"], ["lst_p8", "5", "SIN INF"]],
      [["select_one lst_p3", "p3", ""], ["select_one lst_p8", "p8", ""]],
    );
    const sin = renderToStaticMarkup(<ListasOpcionesPanel workbook={w} control={control(w)} />);
    expect(sin).not.toContain("Entre formularios del proyecto");
    const otro = wb(
      [["genero", "1", "Masculino"], ["genero", "2", "Femenino"], ["lst_p8", "1", "Sí"], ["lst_p8", "99", "SIN INF"]],
      [["select_one genero", "p3", ""], ["select_one lst_p8", "p8", ""]],
    );
    const hermanos: EstadoHermanos = { estado: "listo", hermanos: [{ id: "doc", nombre: "Docentes", workbook: otro }], fallidos: ["Administrativos"] };
    const html = renderToStaticMarkup(<ListasOpcionesPanel workbook={w} control={control(w)} hermanos={hermanos} />);
    expect(html).toContain("Entre formularios del proyecto");
    expect(html).toContain(TEXTO_ENTRE_FORMULARIOS);
    expect(html).toContain('data-qa-geometry-group="xlsform-listas-entre"');
    expect(html).toContain("Igual en Docentes · se llama «genero» allí");
    expect(html).toContain("Renombrar como «genero»");
    expect(html).toContain('data-qa-geometry-group="xlsform-listas-codigos"');
    expect(html).toContain("Misma escala con códigos distintos en Docentes (SIN INF: 5 aquí, 99 allá)");
    expect(html).toContain("No se pudo leer «Administrativos»");
    // Un solo renombre: la acción global no duplica la de la fila.
    expect(html).not.toContain("Aplicar los nombres comunes");
    const cargando = renderToStaticMarkup(<ListasOpcionesPanel workbook={w} control={control(w)} hermanos={{ estado: "cargando" }} />);
    expect(cargando).toContain("Leyendo los otros formularios del proyecto");
  });

  test("texto didáctico y panel direccionable declarado", () => {
    expect(TEXTO_DIDACTICO_LISTAS).toMatch(/^Las escalas repetidas se pueden unificar/);
    expect(PANELES_POR_MODULO["editor-xlsform"]).toContain(PANEL_LISTAS_OPCIONES);
    expect(panelAbiertoEn("?panel=listas-opciones", PANEL_LISTAS_OPCIONES)).toBe(true);
    expect(estadoListasRepetidas(0)).toBe("");
    expect(estadoListasRepetidas(1)).toBe("1 lista repetida");
    expect(estadoListasRepetidas(3)).toBe("3 listas repetidas");
  });
});
