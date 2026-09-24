/**
 * E11 · W1 — paridad de Muestra general y Acreditación con aulas: cabecera
 * con estado y siguiente condición (V2), banda «Diseño vigente» (V1), reparto
 * dibujado (V5), memoria con fórmulas y glosario (V6), avisos en región viva
 * (V4), secciones sin `tabpanel` huérfano (V3), encabezados sin saltos (V12),
 * readiness (V13) y CSS con foco visible y movimiento reducido (V14/V17).
 */
import fs from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import type { CalcMuestraComponente, CalcMuestraEstudio, CalcMuestraWorkspace } from "../../../../api/calcMuestra";
import type { CalcMuestraGeneralCorrida, CalcMuestraGeneralMarco } from "../../../../api/calcMuestraGeneral";
import { defaultComponente } from "../../sharedCore";
import {
  accionVisible,
  cifrasDisenoAcreditacion,
  cifrasDisenoGeneral,
  estadoMesaAcreditacion,
  estadoMesaGeneral,
  requisitosReporteAcreditacion,
} from "../bandaDisenoModelo";
import { FichaCorrida } from "../FichaCorrida";
import { latexDeFormula, terminosDeMemoria } from "../memoriaLatex";
import { MesaAcreditacion } from "../MesaAcreditacion";
import { MesaGeneral } from "../MesaGeneral";
import { dibujarReparto, filasDesdeCorrida, filasDesdeResultado, resumenReparto, tooltipDeFila } from "../repartoEstratos";

type Resultado = NonNullable<CalcMuestraComponente["resultado"]>;

function comp(patch: Partial<CalcMuestraComponente> = {}): CalcMuestraComponente {
  return { ...defaultComponente({ id: "c1", actor: "Usuarios" }), ...patch };
}

const DISTRIBUCION = [
  { estrato: "Cayma", N: 1225, n: 132, n_campo: 175, precision_e: null },
  { estrato: "Cercado", N: 1752, n: 188, n_campo: 251, precision_e: null },
  { estrato: "Yanahuara", N: 744, n: 80, n_campo: 107, precision_e: null },
];

const CALCULADO = comp({
  tecnica: "prob_estratificado",
  naturaleza: "prob",
  marco: { ...defaultComponente().marco, marco_validado: 3721 },
  parametros: { ...defaultComponente().parametros, e: 0.05, tasa_respuesta: 0.75 },
  resultado: {
    n_objetivo: 400,
    n_operativo: 533,
    precision_alcanzada: 0.047,
    distribucion_estratos: DISTRIBUCION,
    memoria_calculo: [
      { paso: "Tamaño base", formula: "n0 = z² · p · (1 − p) · deff / e²", sustitucion: "1.96² · 0.5 · 0.5 / 0.05²", resultado: "384.2" },
    ],
  } as unknown as Resultado,
});

const MARCO: CalcMuestraGeneralMarco = {
  file_id: "f1",
  hoja: "padron",
  columnas: { id: "dni", estrato: "distrito", tamano: "" },
  marco_hash: "abcdef0123456789",
  N: 3721,
  estratos: [{ clave: "Cayma", N_h: 1225 }, { clave: "Cercado", N_h: 1752 }, { clave: "Yanahuara", N_h: 744 }],
  declarado_at: "2026-09-24T06:00:00Z",
};

function corrida(nFuente = 533): CalcMuestraGeneralCorrida {
  return {
    corrida: {
      run_id: "r1", semilla: 20260924, rng_kind: "Mersenne-Twister/Inversion/Rejection", r_version: "R 4.5.1",
      metodo: "mas", modalidad: "probabilistica", marco_hash: "abcdef0123456789", config_hash: "c0ffee",
      N: 3721, n_titulares: 533, n_reservas: 15, piso_incumplible: false, reservas_omitidas_pps: false,
    },
    estratos: [
      { clave: "Cayma", N_h: 1225, n_h: 175, n_reservas: 5, arranque: null, pi: 0.1429 },
      { clave: "Cercado", N_h: 1752, n_h: 251, n_reservas: 5, arranque: null, pi: 0.1433 },
      { clave: "Yanahuara", N_h: 744, n_h: 107, n_reservas: 5, arranque: null, pi: 0.1438 },
    ],
    unidades: null,
    n_fuente: nFuente,
    componente_id: "c1",
    sorteado_at: "2026-09-24T06:51:00Z",
  };
}

/** Niveles de encabezado en orden de documento. */
function niveles(html: string): number[] {
  return Array.from(html.matchAll(/<h([1-6])[\s>]/g)).map((m) => Number(m[1]));
}

function sinSaltos(html: string): boolean {
  const n = niveles(html);
  return n.every((nivel, i) => i === 0 || nivel <= n[i - 1] + 1);
}

describe("V2 · estado de la mesa y siguiente condición", () => {
  it("general recorre marco → cálculo → sorteo → listo", () => {
    expect(estadoMesaGeneral({ comp: comp(), marco: null, corrida: null, cargado: true }).clave).toBe("sin-marco");
    const sinCalculo = estadoMesaGeneral({ comp: comp({ marco: { ...comp().marco, marco_validado: 10 } }), marco: null, corrida: null, cargado: true });
    expect(sinCalculo).toMatchObject({ clave: "sin-calculo", accion: { tipo: "calcular" } });
    expect(estadoMesaGeneral({ comp: CALCULADO, marco: MARCO, corrida: null, cargado: true }))
      .toMatchObject({ clave: "sin-sorteo", accion: { tipo: "seccion", seccion: "seleccion" } });
    expect(estadoMesaGeneral({ comp: CALCULADO, marco: MARCO, corrida: corrida(), cargado: true }).clave).toBe("listo");
  });

  it("un sorteo con otro n a campo queda desactualizado y lo dice con cifras", () => {
    const e = estadoMesaGeneral({ comp: CALCULADO, marco: MARCO, corrida: corrida(500), cargado: true });
    expect(e).toMatchObject({ clave: "desactualizado", tono: "alerta" });
    expect(e.siguiente).toContain("533");
    expect(e.siguiente).toContain("500");
  });

  it("antes de leer /state no afirma que falte sortear", () => {
    expect(estadoMesaGeneral({ comp: CALCULADO, marco: null, corrida: null, cargado: false }).clave).toBe("leyendo");
  });

  it("la acción no lleva a la sección donde ya se está", () => {
    const e = estadoMesaGeneral({ comp: CALCULADO, marco: MARCO, corrida: null, cargado: true });
    expect(accionVisible(e, "seleccion")).toBeNull();
    expect(accionVisible(e, "resultados")).not.toBeNull();
  });

  it("acreditación: el eslabón más atrasado de los actores", () => {
    const sinN = comp({ id: "a", actor: "Docentes" });
    const conN = comp({ id: "b", actor: "Egresados", marco: { ...comp().marco, marco_validado: 300 } });
    expect(estadoMesaAcreditacion({ componentes: [sinN], corridas: {}, cargado: true }).clave).toBe("sin-marco");
    expect(estadoMesaAcreditacion({ componentes: [sinN, conN], corridas: {}, cargado: true }).clave).toBe("sin-calculo");
    const calculado = { ...CALCULADO, id: "b" };
    expect(estadoMesaAcreditacion({ componentes: [sinN, calculado], corridas: {}, cargado: true }).clave).toBe("sin-sorteo");
    expect(estadoMesaAcreditacion({ componentes: [sinN, calculado], corridas: { b: corrida() }, cargado: true }).clave).toBe("parcial");
    expect(estadoMesaAcreditacion({ componentes: [calculado], corridas: { b: corrida() }, cargado: true }).clave).toBe("listo");
  });
});

describe("V1 · banda «Diseño vigente»", () => {
  it("publica N, estratos, n, n a campo, margen y técnica; en Selección suma la corrida", () => {
    const base = cifrasDisenoGeneral({ comp: CALCULADO, marco: MARCO, corrida: corrida(), seccion: "resultados" });
    expect(base.map((c) => c.clave)).toEqual(["N", "estratos", "n", "campo", "margen", "tecnica"]);
    expect(base.find((c) => c.clave === "N")?.value).toBe("3,721");
    expect(base.find((c) => c.clave === "estratos")?.value).toBe("3");
    expect(base.find((c) => c.clave === "margen")).toMatchObject({ value: "±4.7%", tono: "ok" });
    const sel = cifrasDisenoGeneral({ comp: CALCULADO, marco: MARCO, corrida: corrida(), seccion: "seleccion" });
    expect(sel.find((c) => c.clave === "semilla")?.value).toBe("20260924");
    expect(sel.find((c) => c.clave === "sorteo")?.value).toBe("533 + 15");
  });

  it("sin cálculo no inventa cifras: dice «—» y por qué", () => {
    const vacio = cifrasDisenoGeneral({ comp: comp(), marco: null, corrida: null, seccion: "marco" });
    expect(vacio.find((c) => c.clave === "n")).toMatchObject({ value: "—", detalle: "sin calcular" });
    expect(vacio.find((c) => c.clave === "N")).toMatchObject({ value: "—", detalle: "sin declarar" });
  });

  it("acreditación suma los actores y trae una ficha por actor", () => {
    const { totales, actores } = cifrasDisenoAcreditacion({
      componentes: [{ ...CALCULADO, id: "b", actor: "Egresados" }, comp({ id: "a", actor: "Docentes" })],
      corridas: {},
    });
    expect(totales.find((c) => c.clave === "n")?.value).toBe("400");
    expect(actores.map((a) => a.fase)).toEqual(["calculado", "sin-n"]);
  });
});

describe("V5 · reparto por estrato", () => {
  it("las dos escalas: tamaño contra el mayor, fracción contra el propio N", () => {
    const filas = filasDesdeResultado(DISTRIBUCION);
    const tamano = dibujarReparto(filas, "tamano");
    expect(tamano.find((f) => f.clave === "Cercado")?.anchoN).toBe(100);
    expect(tamano.find((f) => f.clave === "Yanahuara")?.anchoN).toBeCloseTo((744 / 1752) * 100, 5);
    const fraccion = dibujarReparto(filas, "fraccion");
    expect(fraccion.every((f) => f.anchoN === 100)).toBe(true);
    expect(fraccion.find((f) => f.clave === "Cayma")?.anchoCampo).toBeCloseTo((175 / 1225) * 100, 5);
  });

  it("resumen accesible y tooltip con π y peso", () => {
    const filas = filasDesdeCorrida(corrida());
    expect(resumenReparto(filas, "corrida")).toContain("533 sorteados entre 3 estratos");
    const tipCayma = tooltipDeFila(dibujarReparto(filas, "tamano")[0], "corrida");
    expect(tipCayma.filas?.map((f) => f.label)).toEqual(["N del estrato", "n sorteado", "π", "Peso base (1/π)", "Del marco"]);
  });
});

describe("V6 · memoria con fórmulas", () => {
  it("traduce las fórmulas del motor y no inventa las desconocidas", () => {
    expect(latexDeFormula("n0 = z² · p · (1 − p) · deff / e²")).toContain(String.raw`\frac`);
    expect(latexDeFormula("n = n0 / (1 + (n0 - 1) / N)")).not.toBeNull();
    expect(latexDeFormula("algo que el motor no publica")).toBeNull();
  });

  it("un MAS no lleva deff en el glosario; un estratificado sí", () => {
    expect(terminosDeMemoria(comp()).map((t) => t.symbol)).not.toContain("deff");
    expect(terminosDeMemoria(CALCULADO).map((t) => t.symbol)).toContain("deff");
  });
});

describe("V3/V12/V13 · secciones, encabezados y readiness", () => {
  const workspace = {
    notas_diseno: "", fuente_marco: "", marco_disponible: "", unidad_observacion: "", unidad_muestreo: "",
    variables_control: [], escenarios: [],
  } as unknown as CalcMuestraWorkspace;
  const estudio = {
    titulo: "Estudio", modo_trabajo: "estimacion_preliminar",
    contexto: { cliente: "", tipo_cliente: "", descripcion_libre: "" },
    componentes: [CALCULADO],
  } as unknown as CalcMuestraEstudio;
  const noop = () => {};

  function general(seccion: string) {
    return renderToStaticMarkup(
      <MemoryRouter initialEntries={[`/calc-muestra?modo=marco-disponible&seccion=${seccion}`]}>
        <MesaGeneral
          estudio={estudio} workspace={workspace} activeSection={seccion}
          onTitulo={noop} onContexto={noop} onPatchEstudio={noop} onWorkspace={noop} onComponente={noop}
          onReplaceComponente={noop} onEnsureKind={noop} onCalcular={noop} onMonitoreo={noop}
          calculando={false} reporteListo={false} reporte={{ resultados: 0, enCurso: false, disponible: false, verUrl: null, onGenerar: noop }} onCambiarTipo={noop}
        />
      </MemoryRouter>,
    );
  }

  function acreditacion(seccion: string, componentes = [CALCULADO]) {
    return renderToStaticMarkup(
      <MemoryRouter initialEntries={[`/calc-muestra?modo=acreditacion&seccion=${seccion}`]}>
        <MesaAcreditacion
          estudio={{ ...estudio, componentes }} workspace={workspace} activeSection={seccion}
          onTitulo={noop} onContexto={noop} onWorkspace={noop} onComponente={noop} onCalcular={noop} calculando={false} reporte={{ resultados: 0, enCurso: false, disponible: false, verUrl: null, onGenerar: noop }} onCambiarTipo={noop}
        />
      </MemoryRouter>,
    );
  }

  it("Resultados: región con nombre, readiness, banda declarada y gráfico accesible", () => {
    const html = general("resultados");
    expect(html).not.toContain('role="tabpanel"');
    expect(html).toMatch(/<section id="cmv2-section-general-resultados"[^>]*aria-labelledby="cmg-seccion-titulo"[^>]*data-audit-ready="true"/);
    expect(html).toContain('data-qa-geometry-group="calc-muestra/general-diseno-vigente"');
    expect(html).toContain('data-status="');
    expect(html).toMatch(/role="group" aria-label="Reparto de 533 a campo entre 3 estratos/);
    expect(html).toMatch(/class="cmg-reparto-fila"[^>]*role="img" aria-label="Cayma\. N del estrato: 1,225[^"]*" tabindex="0"/);
    expect(html).toContain("Ver como tabla");
    expect(html).toContain('<label for="cmg-propuesta-notas">Notas de la propuesta</label>');
    expect(sinSaltos(html)).toBe(true);
    expect(niveles(html)[0]).toBe(2);
  });

  it("Marco usa un tabpanel sólo con la pestaña que lo controla (E15 · P3)", () => {
    const html = general("marco");
    expect(html).toMatch(/<section id="cmv2-section-general-marco"[^>]*aria-labelledby="cmg-seccion-titulo"/);
    expect(html.match(/role="tabpanel"/g)).toHaveLength(1);
    expect(html).toMatch(/role="tabpanel" aria-labelledby="(cmg-tab-marco-marco-[a-z]+)"/);
    const labelledby = html.match(/role="tabpanel" aria-labelledby="(cmg-tab-marco-marco-[a-z]+)"/)?.[1];
    expect(html).toMatch(new RegExp(`id="${labelledby}"[^>]*role="tab"[^>]*aria-selected="true"`));
  });

  it("Acreditación: Contexto con readiness y lo que falta para el reporte; Resultados con actores dibujados", () => {
    const contexto = acreditacion("contexto");
    expect(contexto).toMatch(/id="cmv2-section-acreditacion-contexto"[^>]*data-audit-ready="true"/);
    expect(contexto).toContain("Lo que el reporte necesita");
    expect(contexto).not.toContain('role="tabpanel"');
    expect(sinSaltos(contexto)).toBe(true);
    const resultados = acreditacion("resultados", [{ ...CALCULADO, id: "b", actor: "Egresados" }]);
    expect(resultados).toMatch(/id="cmv2-section-acreditacion-resultados"[^>]*data-audit-ready="true"/);
    expect(resultados).toContain("Meta y marco por actor");
    expect(sinSaltos(resultados)).toBe(true);
  });

  it("Resultados vacío conserva su vacío dentro del panel", () => {
    const html = acreditacion("resultados", [comp()]);
    expect(html).toContain('data-vacio="true"');
    expect(html).toContain("Ningún actor tiene marco");
  });

  it("requisitos del reporte", () => {
    const req = requisitosReporteAcreditacion({ titulo: "Estudio sin título", institucion: "UNSA", fuente: "", alcance: "", componentes: [CALCULADO] });
    expect(req.filter((r) => r.listo).map((r) => r.clave)).toEqual(["institucion", "marcos", "calculo"]);
  });
});

describe("V4 · avisos en región viva", () => {
  it("la ficha anuncia el sorteo desactualizado sin robar el foco y dibuja el reparto", () => {
    const html = renderToStaticMarkup(<FichaCorrida corrida={corrida(500)} componente={CALCULADO} />);
    expect(html).toMatch(/aria-live="polite"><div class="cmv2-aviso"[^>]*role="note"/);
    expect(html).toContain("El sorteo quedó desactualizado");
    expect(html).toContain("Reparto del sorteo por estrato");
    expect(html).toContain("Peso base");
  });
});

describe("V14/V17 · CSS de la mesa", () => {
  const css = fs.readFileSync(path.join(__dirname, "..", "mesa.css"), "utf8");

  it("sin hex, con foco visible y movimiento reducido", () => {
    expect(css.replace(/\/\*[\s\S]*?\*\//g, "")).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(css).toContain(":focus-visible");
    expect(css).toContain("prefers-reduced-motion: reduce");
    expect(css).toContain("color-mix(in srgb, var(--pulso-text-soft) 78%, var(--pulso-text))");
  });
});
