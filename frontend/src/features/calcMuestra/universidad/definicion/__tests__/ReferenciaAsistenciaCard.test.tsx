import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { CalcMuestraReferenciaAsistencia } from "../../../../../api/calcMuestra";
import { ReferenciaAsistenciaCard } from "../ReferenciaAsistenciaCard";

function referencia(): CalcMuestraReferenciaAsistencia {
  const tramo = (
    key: string,
    label: string,
    numerador: number,
    denominador: number,
    tasa: number,
  ) => ({
    key,
    label,
    k: 190,
    numerador,
    denominador,
    tasa,
    ic_low: 0.4,
    ic_high: 0.8,
    metodo_ic: "bootstrap_percentil" as const,
  });
  return {
    schema: "calc_muestra_referencia_asistencia_v2",
    owner: "estudio_historico_externo",
    momento: "post_hoc_estudio_previo",
    transferible: "modelo_por_celda",
    modelo: "marginales_independientes",
    combinable: false,
    unidad: "encuentro_en_curso_horario_aplicado",
    denominador: "matriculados_totales",
    estudio: {
      id: "estudio-sintetico",
      label: "Estudio histórico sintético",
      periodo: "2026-I",
      fuente: "fixture_sintetico",
    },
    cobertura: {
      agendados: 194, aplicados: 192, observados: 190,
      glosario_completo: false, columnas_glosario: [], columnas_criterio: [],
    },
    diseno: DISENO_VACIO,
    filtros_corte: [],
    encuentros: null,
    embudos: [],
  serie_campo: null,
  cobertura_celdas: null,
    identidad: {
      regla: "A = E + no_respondieron",
      verificada: true,
      verificables: 190,
      inconsistentes: 0,
      residuales_negativos: null,
    },
    umbrales: {
      insuficiente_max: 11,
      delgada_min: 12,
      solida_min: 30,
      bootstrap_n: 2000,
      nivel_ic: 0.95,
      quantile_type: 7,
    },
    cadena: {
      asistencia: tramo("asistencia", "Asistencia", 4792, 6861, 0.6984404605742603),
      apertura: tramo("apertura", "Apertura", 3610, 4792, 0.753338898163606),
      efectividad: tramo("efectividad", "Efectividad", 3223, 3610, 0.892797783933518),
      rendimiento: tramo("rendimiento", "Rendimiento", 3223, 6861, 0.46975659524850605),
    },
    global: {
      k: 190,
      matriculados: 6861,
      asistentes: 4792,
      enviadas: 3610,
      validas: 3223,
      no_respondieron: 1182,
      tasa: 0.6984404605742603,
      media_ch: 0.7,
      sd_ch: 0.1,
      ic_low: 0.68,
      ic_high: 0.72,
      metodo_ic: "bootstrap_percentil",
    },
    dimensiones: [
      {
        dimension_key: "tamano",
        dimension_label: "Tamaño del curso-horario",
        orden: 1,
        filas: [
          {
            celda_key: "T1", celda_label: "Menos de 15", orden: 1, k: 30,
            matriculados: 300, asistentes: 248, tasa: 0.8266666666666667,
            estimador: "razon_agregada", media_ch: 0.827, sd_ch: 0.05,
            ic_low: 0.8, ic_high: 0.85, metodo_ic: "bootstrap_percentil",
            suficiencia: "solida", tasa_publicada: 0.8266666666666667,
            k_publicada: 30, fuente_publicada: "celda",
          },
          {
            celda_key: "T2", celda_label: "15 a 24", orden: 2, k: 40,
            matriculados: 800, asistentes: 614, tasa: 0.7675,
            estimador: "razon_agregada", media_ch: 0.768, sd_ch: 0.05,
            ic_low: 0.74, ic_high: 0.79, metodo_ic: "bootstrap_percentil",
            suficiencia: "solida", tasa_publicada: 0.7675,
            k_publicada: 40, fuente_publicada: "celda",
          },
          {
            celda_key: "T3", celda_label: "25 a 39", orden: 3, k: 50,
            matriculados: 1600, asistentes: 1165, tasa: 0.728125,
            estimador: "razon_agregada", media_ch: 0.728, sd_ch: 0.05,
            ic_low: 0.7, ic_high: 0.75, metodo_ic: "bootstrap_percentil",
            suficiencia: "solida", tasa_publicada: 0.728125,
            k_publicada: 50, fuente_publicada: "celda",
          },
          {
            celda_key: "T4", celda_label: "40 a 59", orden: 4, k: 50,
            matriculados: 2500, asistentes: 1753, tasa: 0.7012,
            estimador: "razon_agregada", media_ch: 0.701, sd_ch: 0.05,
            ic_low: 0.68, ic_high: 0.72, metodo_ic: "bootstrap_percentil",
            suficiencia: "solida", tasa_publicada: 0.7012,
            k_publicada: 50, fuente_publicada: "celda",
          },
          {
            celda_key: "T5", celda_label: "60 o más", orden: 5, k: 20,
            matriculados: 1661, asistentes: 1012, tasa: 0.609271523178808,
            estimador: "razon_agregada", media_ch: 0.609, sd_ch: 0.05,
            ic_low: 0.57, ic_high: 0.65, metodo_ic: "bootstrap_percentil",
            suficiencia: "delgada", tasa_publicada: 0.609271523178808,
            k_publicada: 20, fuente_publicada: "celda",
          },
        ],
      },
      {
        dimension_key: "rango_horario",
        dimension_label: "Rango horario",
        orden: 2,
        filas: [{
          celda_key: "manana_especial", celda_label: "Mañana especial", orden: 1, k: 9,
          matriculados: 100, asistentes: 82, tasa: 0.82,
          estimador: "razon_agregada", media_ch: 0.82, sd_ch: 0.04,
          ic_low: null, ic_high: null, metodo_ic: "no_aplica",
          suficiencia: "insuficiente", tasa_publicada: 0.6984404605742603,
          k_publicada: 190, fuente_publicada: "global",
        }],
      },
      { dimension_key: "facultad", dimension_label: "Facultad", orden: 3, filas: [] },
      { dimension_key: "tipo_sesion", dimension_label: "Tipo de sesión", orden: 4, filas: [] },
    ],
    advertencias: [
      "marginales_no_combinables",
      "rango_horario:manana_especial:k_9_publica_global",
    ],
  } as CalcMuestraReferenciaAsistencia;
}

const DISENO_VACIO = {
  poblacion_objetivo: null, nivel_confianza: null, proporcion_esperada: null,
  margen_error: null, deff: null, muestra: null, ratio_sobremuestra: null,
  sobremuestra: null, aulas_marco: null, aulas_dimensionadas: null,
  aulas_aplicadas: null, tasa_respuesta_asumida: null,
  afijacion: "", metodo_seleccion: "", metodo_ajuste: "",
  ponderado: null, declarado: false,
};

describe("ReferenciaAsistenciaCard", () => {
  it("declara geometría y contiene su propio vacío", () => {
    const html = renderToStaticMarkup(<ReferenciaAsistenciaCard referencia={null} />);
    expect(html).toContain(
      'data-qa-geometry-group="calc-muestra/referencia-asistencia-fuente"',
    );
    expect(html).toContain('role="status"');
    expect(html).toContain("Sin referencia histórica de asistencia");
  });

  it("presenta dueño, cobertura, cadena e identidad verificable", () => {
    const html = renderToStaticMarkup(<ReferenciaAsistenciaCard referencia={referencia()} />);
    expect(html).toContain(
      'data-qa-geometry-group="calc-muestra/referencia-asistencia-fuente"',
    );
    expect(html).toContain("Estudio histórico externo");
    expect(html).toContain("194 agendados");
    expect(html).toContain("192 aplicados");
    expect(html).toContain("190 observados");
    for (const label of ["Asistencia", "Apertura", "Efectividad"]) {
      expect(html).toContain(label);
    }
    expect(html.match(/k=190/g)?.length).toBeGreaterThanOrEqual(3);
    expect(html).toContain("Identidad verificada");
  });

  it("publica el gradiente T1-T5 y hace visible la degradacion de k insuficiente", () => {
    const html = renderToStaticMarkup(<ReferenciaAsistenciaCard referencia={referencia()} />);
    expect(html).toContain("Gradiente observado por tamaño");
    for (const [label, k, tasa] of [
      ["Menos de 15", "k=30", "82.7%"],
      ["15 a 24", "k=40", "76.8%"],
      ["25 a 39", "k=50", "72.8%"],
      ["40 a 59", "k=50", "70.1%"],
      ["60 o más", "k=20", "60.9%"],
    ]) {
      expect(html).toContain(label);
      expect(html).toContain(k);
      expect(html).toContain(tasa);
    }
    expect(html.match(/IC 95%/g)?.length).toBeGreaterThanOrEqual(5);

    expect(html).toContain("Mañana especial");
    expect(html).toContain("k=9");
    expect(html).toContain("82.0% observada");
    expect(html).toContain("69.8% publicada");
    expect(html).toContain("Sin IC");
    expect(html).toContain("publica global");
    expect(html).toContain('role="alert"');
    expect(html).not.toContain("rango_horario:manana_especial:k_9_publica_global");
  });
});
