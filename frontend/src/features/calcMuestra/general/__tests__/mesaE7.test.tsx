/**
 * E7 · intuitividad de Muestra general y Acreditación: Método pinta sólo lo
 * que la técnica consume (G2), los avisos del motor van junto al campo y al n
 * (F1), la memoria sustituida se lee (E6/E7), cada sección se declara (G3),
 * sin rail de pestañas falsas (G4), la pastilla de desplazamiento sólo con
 * desborde (G5), Resultados contiene su vacío (G6) y cada actor dice de dónde
 * sale su técnica y enlaza con su Selección (A1/A2).
 */
import fs from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import type { CalcMuestraComponente, CalcMuestraEstudio, CalcMuestraWorkspace } from "../../../../api/calcMuestra";
import {
  normalizeCalcMuestraAvisosParametros,
  normalizeCalcMuestraCatalogoParametros,
  normalizeCalcMuestraMemoriaCalculo,
  type CalcMuestraCatalogoParametros,
} from "../../../../api/calcMuestraGeneral";
import { defaultComponente } from "../../sharedCore";
import { ActoresAcreditacion, hrefSeleccionDeActor } from "../ActoresAcreditacion";
import { EncabezadoSeccion } from "../EncabezadoSeccion";
import { FichaEstudio } from "../FichaEstudio";
import { MemoriaCalculoGeneral } from "../MemoriaCalculoGeneral";
import { avisosVigentes, nivelDeZ, tipoDeCampo } from "../modeloParametros";
import { ParametrosTecnicaVista } from "../ParametrosTecnica";
import { ResultadosComponentes } from "../ResultadosComponentes";
import { encabezadoDeSeccion, motivoReporteDeshabilitado, origenDeTecnica, vacioDeResultados } from "../secciones";
import { desbordaHorizontal } from "../useDesbordaHorizontal";

// Forma real de `GET /tecnicas/parametros` (calc_muestra_general_parametros.R).
const CATALOGO_RAW = {
  ok: true,
  tecnicas: [
    {
      tecnica: "prob_aleatorio_simple",
      parametros: [
        { clave: "z", rotulo: "Nivel de confianza", ayuda: "Se ingresa como z: 1.645 = 90 %, 1.96 = 95 %, 2.576 = 99 %." },
        { clave: "p", rotulo: "Proporción esperada", ayuda: "Sin estimación previa, 0.5 es lo conservador." },
        { clave: "e", rotulo: "Margen de error", ayuda: "Como proporción: 0.05 = ±5 puntos." },
        { clave: "tasa_respuesta", rotulo: "Tasa de respuesta", ayuda: "El n a campo es el n de completas dividido por esta tasa." },
        { clave: "oversample_pct", rotulo: "Sobremuestra", ayuda: "Reserva adicional sobre los casos a abordar." },
        { clave: "tipo_indicador", rotulo: "Qué se estima", ayuda: "Una proporción usa p; una media, el coeficiente de variación.", tipo: "opciones", opciones: ["proporcion", "media"] },
        { clave: "cv", rotulo: "Coeficiente de variación esperado", ayuda: "Sólo para medias: desviación estándar / media.", tipo: "numero" },
      ],
    },
    {
      tecnica: "prob_estratificado",
      parametros: [
        { clave: "e", rotulo: "Margen de error", ayuda: "Como proporción: 0.05 = ±5 puntos.", tipo: "numero" },
        { clave: "asignacion", rotulo: "Asignación entre estratos", ayuda: "Proporcional, Neyman o potencia.", tipo: "opciones", opciones: ["proporcional", "neyman", "potencia"] },
      ],
    },
    {
      tecnica: "intencion_censal",
      parametros: [
        { clave: "cobertura_objetivo", rotulo: "Cobertura objetivo", ayuda: "Fracción del marco que se busca cubrir." },
        { clave: "tasa_respuesta", rotulo: "Tasa de respuesta", ayuda: "El n a campo es el n de completas dividido por esta tasa." },
      ],
    },
  ],
};
const CATALOGO = normalizeCalcMuestraCatalogoParametros(CATALOGO_RAW) as CalcMuestraCatalogoParametros;

const MEMORIA_RAW = [
  { paso: "Tamaño sin corrección (Cochran)", formula: "n0 = z² · p · (1 − p) · deff / e²", sustitucion: "1.96² · 0.5 · 0.5 · 1 / 0.05²", resultado: "384.16" },
  { paso: "Corrección por población finita", formula: "n = n0 / (1 + (n0 − 1) / N)", sustitucion: "384.16 / (1 + (384.16 − 1) / 5000)", resultado: "356.8 → 357" },
  { paso: "Encuestas completas objetivo", formula: "n objetivo = n (o la meta declarada, si la hay)", sustitucion: "357", resultado: "357" },
  { paso: "Casos a abordar por no respuesta", formula: "⌈n objetivo / tasa de respuesta⌉", sustitucion: "⌈357 / 0.7⌉", resultado: "510" },
  { paso: "n a campo", formula: "casos a abordar + ⌈casos · sobremuestra⌉, con tope en N", sustitucion: "510 + ⌈510 · 0.1⌉", resultado: "561" },
  { paso: "Margen de error alcanzado", formula: "e = z · √(p(1 − p) · deff · (N − n) / (n (N − 1)))", sustitucion: "con n = 357 y N = 5000", resultado: "0.04999" },
];

function comp(patch: Partial<CalcMuestraComponente> = {}): CalcMuestraComponente {
  return { ...defaultComponente({ id: "c1", actor: "Usuarios" }), ...patch };
}

function conRouter(node: JSX.Element, url = "/calc-muestra?modo=marco-disponible&seccion=metodo") {
  return renderToStaticMarkup(<MemoryRouter initialEntries={[url]}>{node}</MemoryRouter>);
}

describe("contrato del motor", () => {
  it("el catálogo se lee por técnica y en el orden del motor", () => {
    expect(CATALOGO.prob_aleatorio_simple.map((p) => p.clave)).toEqual(["z", "p", "e", "tasa_respuesta", "oversample_pct", "tipo_indicador", "cv"]);
    expect(normalizeCalcMuestraCatalogoParametros({ ok: true })).toBeNull();
  });

  it("la memoria llega por filas o por columnas y descarta filas sin paso", () => {
    expect(normalizeCalcMuestraMemoriaCalculo(MEMORIA_RAW)).toHaveLength(6);
    const columnas = {
      paso: ["A", "B"], formula: ["f1", "f2"], sustitucion: ["s1", "s2"], resultado: ["1", "2"],
    };
    expect(normalizeCalcMuestraMemoriaCalculo(columnas)).toEqual([
      { paso: "A", formula: "f1", sustitucion: "s1", resultado: "1" },
      { paso: "B", formula: "f2", sustitucion: "s2", resultado: "2" },
    ]);
    expect(normalizeCalcMuestraMemoriaCalculo([{ formula: "sin paso" }])).toEqual([]);
    expect(normalizeCalcMuestraMemoriaCalculo(null)).toEqual([]);
  });

  it("un aviso sin cifras no se pinta", () => {
    expect(normalizeCalcMuestraAvisosParametros([{ param: "e", recibido: 3, usado: 0.05, texto: "t" }, { param: "p", texto: "x" }]))
      .toEqual([{ param: "e", recibido: 3, usado: 0.05, texto: "t" }]);
  });
});

describe("G2 · Método pinta sólo lo que la técnica consume", () => {
  const vista = (c: CalcMuestraComponente) => conRouter(
    <ParametrosTecnicaVista comp={c} estado={{ fase: "listo", catalogo: CATALOGO }} onReintentar={() => {}} onParametro={() => {}} />,
  );

  it("un MAS no muestra deff, cobertura ni piso por celda", () => {
    const html = vista(comp());
    // Los cinco de siempre más «Qué se estima»; cv se oculta con una proporción.
    expect(html.match(/data-param="/g)).toHaveLength(6);
    expect(html).toContain("Proporción esperada");
    expect(html).not.toContain('data-param="deff"');
    expect(html).not.toContain('data-param="cobertura_objetivo"');
    expect(html).not.toContain('data-param="n_minimo_estrato"');
  });

  it("la confianza se elige como nivel y la ayuda dice el z", () => {
    const html = vista(comp());
    expect(html).toContain("Nivel de confianza");
    for (const nivel of ["90 %", "95 %", "99 %"]) expect(html).toContain(`>${nivel}</option>`);
    expect(html).toContain("z = 1.96");
    expect(html).not.toContain("Se ingresa como z");
    expect(nivelDeZ(1.645)?.etiqueta).toBe("90 %");
    expect(nivelDeZ(2.576)?.etiqueta).toBe("99 %");
    expect(nivelDeZ(1.95)).toBeNull();
  });

  it("un z fuera de los tres niveles se conserva como opción", () => {
    const html = vista(comp({ parametros: { ...comp().parametros, z: 2.2 } }));
    expect(html).toContain("Otro (z = 2.2)");
  });

  it("otra técnica, otros campos", () => {
    const html = vista(comp({ tecnica: "intencion_censal" }));
    expect(html).toContain('data-param="cobertura_objetivo"');
    expect(html).not.toContain('data-param="z"');
  });

  it("un parámetro de opciones del motor se elige de una lista", () => {
    expect(CATALOGO.prob_estratificado[1]).toMatchObject({ tipo: "opciones", opciones: ["proporcional", "neyman", "potencia"] });
    expect(CATALOGO.prob_aleatorio_simple[0]).toMatchObject({ tipo: "numero", opciones: [] });
    const html = vista(comp({ tecnica: "prob_estratificado" }));
    expect(html).toContain('<option value="neyman">Neyman</option>');
    expect(html).toContain('<option value="potencia">Potencia</option>');
    expect(html).toContain('<option value="proporcional" selected="">Proporcional</option>');
  });

  it("Neyman sin p por estrato lo dice junto al campo; con p, no", () => {
    const base = comp({ tecnica: "prob_estratificado", parametros: { ...comp().parametros, asignacion: "neyman" } });
    const sinP = vista({ ...base, marco: { ...base.marco, estratos: [{ label: "A", N: 3000 }, { label: "B", N: 2000 }] as CalcMuestraComponente["marco"]["estratos"] } });
    expect(sinP).toContain("Neyman reparte igual que proporcional");
    expect(sinP).toContain('<option value="neyman" selected="">Neyman</option>');
    const conP = vista({ ...base, marco: { ...base.marco, estratos: [{ label: "A", N: 3000, p_facultad: 0.1 }] as CalcMuestraComponente["marco"]["estratos"] } });
    expect(conP).not.toContain("reparte igual que proporcional");
  });

  it("sin catálogo lo dice y ofrece reintentar", () => {
    const html = conRouter(
      <ParametrosTecnicaVista comp={comp()} estado={{ fase: "error", mensaje: "sin red" }} onReintentar={() => {}} onParametro={() => {}} />,
    );
    expect(html).toContain("No se pudo leer qué parámetros usa la técnica");
    expect(html).toContain("Reintentar");
  });

  it("tipos de campo", () => {
    expect(tipoDeCampo("z")).toBe("confianza");
    expect(tipoDeCampo("e")).toBe("proporcion");
    expect(tipoDeCampo("n_minimo_estrato")).toBe("entero");
    expect(tipoDeCampo("deff")).toBe("numero");
  });
});

describe("F1 · avisos de parámetros", () => {
  const aviso = { param: "e", recibido: 3, usado: 0.05, texto: "Valor fuera de rango en margen de error (e): llegó 3 y se usó 0.05. Si quisiste decir 3 %, escribe 0.03." };

  it("va junto al campo mientras el parámetro valga lo que el motor usó", () => {
    const c = comp({ avisos_parametros: [aviso] });
    expect(Object.keys(avisosVigentes(c))).toEqual(["e"]);
    const html = conRouter(
      <ParametrosTecnicaVista comp={c} estado={{ fase: "listo", catalogo: CATALOGO }} onReintentar={() => {}} onParametro={() => {}} />,
    );
    expect(html).toContain("escribe 0.03");
    expect(html).toContain('aria-invalid="true"');
  });

  it("cae si el usuario cambió el valor", () => {
    const c = comp({ avisos_parametros: [aviso], parametros: { ...comp().parametros, e: 0.03 } });
    expect(avisosVigentes(c)).toEqual({});
  });

  it("y se repite en Resultados junto al n", () => {
    const c = comp({ resultado: { n_objetivo: 357, n_operativo: 561, avisos_parametros: [aviso] } as unknown as CalcMuestraComponente["resultado"] });
    const html = conRouter(<ResultadosComponentes modo="marco_disponible" componentes={[c]} calculando={false} onCalcular={() => {}} />);
    expect(html).toContain("Parámetros corregidos por el motor");
    expect(html).toContain("escribe 0.03");
  });
});

describe("memoria de cálculo visible en Método", () => {
  it("fórmula, sustitución y resultado de los 6 pasos", () => {
    const c = comp({ resultado: { n_objetivo: 357, memoria_calculo: MEMORIA_RAW } as unknown as CalcMuestraComponente["resultado"] });
    const html = conRouter(<MemoriaCalculoGeneral comp={c} calculando={false} onCalcular={() => {}} />);
    // E11: la memoria es una lista de pasos con su fórmula, no una tabla.
    expect(html.match(/data-paso="/g)).toHaveLength(6);
    expect(html).toContain("1.96² · 0.5 · 0.5 · 1 / 0.05²");
    expect(html).toContain("561");
  });

  it("un resultado sin memoria pide calcular sin afirmar cuándo se calculó; sin cálculo, calcular", () => {
    const viejo = comp({ resultado: { n_objetivo: 357 } as unknown as CalcMuestraComponente["resultado"] });
    const html = conRouter(<MemoriaCalculoGeneral comp={viejo} calculando={false} onCalcular={() => {}} />);
    expect(html).toContain("Recalcular");
    expect(html).toContain("Calcula para ver la fórmula con estos parámetros.");
    expect(html).not.toContain("Se calculó antes");
    expect(conRouter(<MemoriaCalculoGeneral comp={comp()} calculando={false} onCalcular={() => {}} />)).toContain("Aún no hay cálculo");
  });

  it("dice cómo se repartió el n cuando el motor usó la fórmula por estrato", () => {
    const c = comp({ tecnica: "prob_estratificado", resultado: { n_objetivo: 212, formula_n: "neyman", asignacion: "neyman", memoria_calculo: MEMORIA_RAW } as unknown as CalcMuestraComponente["resultado"] });
    expect(conRouter(<MemoriaCalculoGeneral comp={c} calculando={false} onCalcular={() => {}} />)).toContain("Reparto entre estratos: Neyman");
  });

  it("no se pinta para técnicas que no son de elementos", () => {
    expect(conRouter(<MemoriaCalculoGeneral comp={comp({ tecnica: "no_prob_cuotas" })} calculando={false} onCalcular={() => {}} />)).toBe("");
  });
});

describe("G3 · cada sección se declara", () => {
  it("títulos distintos por sección, con el modo como antetítulo", () => {
    const general = ["marco", "metodo", "seleccion", "resultados"].map((s) => encabezadoDeSeccion("marco_disponible", s).titulo);
    expect(new Set(general).size).toBe(4);
    const acred = ["actores", "contexto", "seleccion", "resultados"].map((s) => encabezadoDeSeccion("acreditacion", s).linea);
    expect(new Set(acred).size).toBe(4);
    const html = renderToStaticMarkup(<EncabezadoSeccion modo="marco_disponible" seccion="metodo" />);
    expect(html).toContain("Muestra general");
    expect(html).toContain(">Método</h2>");
    expect(html).not.toContain("Marco propio");
  });
});

describe("G4 · sin pestañas locales que llevan al mismo sitio", () => {
  it("fuera de aulas el rail no declara pestañas y el canvas toma el ancho", () => {
    const fuente = fs.readFileSync(path.join(__dirname, "..", "..", "CalcMuestraPage.tsx"), "utf8");
    const rail = fuente.slice(fuente.indexOf("function sidebarTabsForDeskSection"), fuente.indexOf("// --- Jobs asíncronos"));
    expect(rail).not.toContain('label: "Configuración"');
    expect(rail).toContain("return [];");
    expect(fuente).toContain('" cmg-sin-rail"');
  });
});

describe("G5 · la pastilla sólo con desborde real", () => {
  it("mide scrollWidth contra clientWidth con 1 px de tolerancia", () => {
    expect(desbordaHorizontal(900, 900)).toBe(false);
    expect(desbordaHorizontal(901, 900)).toBe(false);
    expect(desbordaHorizontal(1100, 900)).toBe(true);
  });

  it("la tabla nace sin desborde declarado", () => {
    const c = comp({ resultado: { n_objetivo: 357, n_operativo: 561 } as unknown as CalcMuestraComponente["resultado"] });
    const html = conRouter(<ResultadosComponentes modo="marco_disponible" componentes={[c]} calculando={false} onCalcular={() => {}} />);
    expect(html).toContain('data-desborda="false"');
    const css = fs.readFileSync(path.join(__dirname, "..", "general.css"), "utf8");
    expect(css).toContain('.cmv2-table-wrap.cmg-tabla-desplazable[data-desborda="true"]::after');
  });
});

describe("G6 · Resultados contiene su vacío y el motivo del reporte", () => {
  it("sin marco lleva a Marco; con marco, a calcular; siempre dice por qué no hay reporte", () => {
    const sinMarco = vacioDeResultados("marco_disponible", [comp()]);
    expect(sinMarco.accion).toEqual({ etiqueta: "Ir a Marco", seccion: "marco" });
    expect(sinMarco.pista).toContain("reporte");
    const conMarco = vacioDeResultados("marco_disponible", [comp({ marco: { ...comp().marco, marco_validado: 5000 } })]);
    expect(conMarco.accion.seccion).toBeNull();
    expect(vacioDeResultados("acreditacion", [comp()]).accion.seccion).toBe("actores");
    expect(motivoReporteDeshabilitado(0)).toContain("Calcula primero");
    expect(motivoReporteDeshabilitado(1)).toBeNull();
  });

  it("no pinta MARCO 0 ni n «—» sin explicación", () => {
    const html = conRouter(<ResultadosComponentes modo="marco_disponible" componentes={[comp()]} calculando={false} onCalcular={() => {}} />);
    expect(html).toContain("Sin marco todavía");
    expect(html).not.toContain("<table");
  });
});

describe("A1/A2 · Acreditación", () => {
  const actor = (patch: Partial<CalcMuestraComponente>) => comp({
    id: "cmp-doc", actor: "Docentes", actor_categoria: "docentes", canal_recojo: "online_email", tecnica: "intencion_censal", ...patch,
  });

  it("el origen de la técnica: sin N, cuadro maestro o pendiente de calcular", () => {
    expect(origenDeTecnica(actor({})).etiqueta).toBe("Sin N: técnica inicial");
    const inferido = actor({
      marco: { ...comp().marco, marco_validado: 300 },
      inferencia_acreditacion: { tecnica: "no_prob_cuotas", regla: "cuotas_min_150_si_N_>=_251", justificacion: "Docentes con N ≥ 251: cuotas." },
    });
    expect(origenDeTecnica(inferido)).toEqual({ etiqueta: "Cuadro maestro", detalle: "Docentes con N ≥ 251: cuotas." });
    const sinCalcular = actor({ marco: { ...comp().marco, marco_validado: 300 }, inferencia_acreditacion: { tecnica: null, regla: "manual", justificacion: "" } });
    expect(origenDeTecnica(sinCalcular).etiqueta).toBe("Se infiere al calcular");
  });

  it("la tabla explica el cuadro maestro y enlaza cada actor con su Selección", () => {
    const html = conRouter(
      <ActoresAcreditacion componentes={[actor({})]} onComponente={() => {}} />,
      "/calc-muestra?modo=acreditacion&seccion=actores",
    );
    expect(html).toContain("cuadro maestro PULSO");
    expect(html).toContain('href="/calc-muestra?modo=acreditacion&amp;seccion=seleccion&amp;foco=cmp-doc"');
    expect(html).not.toContain("Actor institucional de cobertura censal");
    expect(html).toContain('data-desborda="false"');
    expect(hrefSeleccionDeActor("/calc-muestra", "?modo=acreditacion&seccion=actores&pestana=x", "c9"))
      .toBe("/calc-muestra?modo=acreditacion&seccion=seleccion&foco=c9");
  });

  it("Contexto no finge el marco ni la unidad de acreditación", () => {
    const estudio = { titulo: "T", contexto: { cliente: "", tipo_cliente: "", descripcion_libre: "" } } as unknown as CalcMuestraEstudio;
    const workspace = { fuente_marco: "", marco_disponible: "", unidad_observacion: "", unidad_muestreo: "" } as unknown as CalcMuestraWorkspace;
    const props = { estudio, workspace, onTitulo: () => {}, onContexto: () => {}, onWorkspace: () => {} };
    const acred = renderToStaticMarkup(<FichaEstudio variante="acreditacion" {...props} />);
    expect(acred).not.toContain("Unidad de muestreo");
    expect(acred).not.toContain("Marco disponible");
    expect(acred).toContain("Institución");
    const general = renderToStaticMarkup(<FichaEstudio variante="general" {...props} />);
    expect(general).toContain("Unidad de muestreo");
  });
});
