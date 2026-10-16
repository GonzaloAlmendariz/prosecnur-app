// Lo que se ve del panel «Variables de la base» (ADR 0106), sin portal.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { BaseVariables } from "../../../api/baseVariables";
import { MemoryRouter } from "react-router-dom";
import { formatoConteo } from "../../../lib/formatoNumero";
import { ESTADO_INICIAL, type ControlVariablesBase, type EstadoVariablesBase } from "./useVariablesBase";
import { VariablesBaseCuerpo } from "./VariablesBasePanel";

const sinAccion = async () => true;
const datos = (extra: Partial<BaseVariables> = {}): BaseVariables => ({
  base: "2026",
  ya_codificada: false,
  extras: [],
  calculadas: [],
  retiradas: [],
  retiradas_pendientes: [],
  avisos: [],
  ...extra,
});
const control = (estado: Partial<EstadoVariablesBase>): ControlVariablesBase => ({
  estado: { ...ESTADO_INICIAL, catalogo: { tipo: "listo", variables: [] }, ...estado },
  declarar: sinAccion,
  guardarCalculada: sinAccion,
  quitarCalculada: async () => undefined,
  marcarCodificada: async () => undefined,
});
const cuerpo = (estado: Partial<EstadoVariablesBase>) =>
  renderToStaticMarkup(createElement(MemoryRouter, null, createElement(VariablesBaseCuerpo, { control: control(estado) })));

describe("Variables de la base", () => {
  it("leyendo: un solo estado que contiene su vacío", () => {
    const html = cuerpo({ carga: { tipo: "cargando" } });
    expect(html).toContain("Leyendo las columnas de la base…");
    expect(html).toContain('data-qa-geometry-capacity="owned"');
  });

  it("base sin nada propio: cada sección contiene su vacío (C3) y el grupo se declara (C1)", () => {
    const html = cuerpo({ carga: { tipo: "listo", datos: datos() } });
    expect(html).toContain('data-qa-geometry-group="carga/variables-base"');
    expect((html.match(/data-qa-geometry-member/g) ?? []).length).toBe(3);
    expect(html).toContain("La base no trae columnas fuera del formulario.");
    expect(html).toContain("Ninguna todavía. Combina varias preguntas, recodifica una o escribe una fórmula.");
    expect(html).toContain("Esta base ya viene codificada");
    expect(html).toContain("Codificación no la vuelve a codificar.");
    expect(html).toContain('role="switch"');
    expect(html).toContain('aria-checked="false"');
    expect(html).not.toContain("falta declarar por qué");
  });

  it("muchas columnas: por incorporar con casilla, incorporadas con su sello, y el aviso de retiradas", () => {
    const extras = Array.from({ length: 12 }, (_, i) => ({
      name: `c${i + 1}`,
      label: `Columna ${i + 1}`,
      tipo: i === 0 ? ("select_one" as const) : ("integer" as const),
      opciones: i === 0 ? [{ codigo: "1", etiqueta: "1" }, { codigo: "2", etiqueta: "2" }] : [],
      n_validos: 2500,
      declarada: i === 11,
    }));
    const html = cuerpo({
      carga: {
        tipo: "listo",
        datos: datos({
          extras,
          ya_codificada: true,
          retiradas_pendientes: ["P3", "P4"],
          calculadas: [{ nombre: "vbg", etiqueta: "VBG", regla: "alguna", variables: ["P1", "P2"], codigos: ["1"], mapa: {}, escala: [] }],
        }),
      },
      resumenes: { vbg: { por_codigo: [{ codigo: "1", etiqueta: "Sí", n: 120 }], n_sin_dato: 5, n_total: 125 } },
    });
    expect(html).toContain("2 preguntas del formulario no vienen en la base y falta declarar por qué.");
    expect(html).toContain("Declarar el motivo");
    expect((html.match(/type="checkbox"/g) ?? []).length).toBe(12); // 11 columnas + «Marcar todas»
    expect(html).toContain("Buscar columna");
    expect(html).toContain("Incorporada");
    expect(html).toContain(`${formatoConteo(2500)} válidos`);
    expect(html).toContain("sin etiquetas");
    expect(html).toContain("Alguna de 2 preguntas · sí = 1");
    expect(html).toContain("Sí 120 · Sin dato 5");
    expect(html).toContain('aria-checked="true"');
  });

  it("error de lectura: lo dice con el mensaje del backend", () => {
    const html = cuerpo({ carga: { tipo: "error", mensaje: "No existe la base «x». · E_BASE_NOT_FOUND" } });
    expect(html).toContain("No se pudieron leer las variables de la base.");
    expect(html).toContain("E_BASE_NOT_FOUND");
  });
});
