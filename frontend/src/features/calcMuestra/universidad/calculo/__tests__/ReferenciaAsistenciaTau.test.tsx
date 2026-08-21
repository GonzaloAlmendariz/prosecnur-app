import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { CalcMuestraReferenciaAsistencia } from "../../../../../api/calcMuestra";
import { ReferenciaAsistenciaTau } from "../ReferenciaAsistenciaTau";

function referencia(): CalcMuestraReferenciaAsistencia {
  const tramo = (key: string, label: string, numerador: number, denominador: number) => ({
    key,
    label,
    k: 190,
    numerador,
    denominador,
    tasa: numerador / denominador,
    ic_low: 0.4,
    ic_high: 0.8,
    metodo_ic: "bootstrap_percentil" as const,
  });
  const degradada = {
    celda_key: "manana_especial",
    celda_label: "Mañana especial",
    orden: 1,
    k: 9,
    matriculados: 94,
    asistentes: 76,
    // La ventana de campo de la celda: esta fixture describe un estudio sin
    // columna de semana, que es el caso en que los cuatro campos van a null.
    semana_min: null,
    semana_max: null,
    semana_media: null,
    k_con_semana: null,
    tasa: 76 / 94,
    estimador: "razon_agregada",
    media_ch: 0.8,
    sd_ch: 0.1,
    ic_low: null,
    ic_high: null,
    metodo_ic: "no_aplica",
    suficiencia: "insuficiente",
    tasa_publicada: 4792 / 6861,
    k_publicada: 190,
    fuente_publicada: "global",
  };
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
  composicion: [],
  serie_campo: null,
  cuotas: null,
  cadenas_reemplazo: null,
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
      asistencia: tramo("asistencia", "Asistencia", 4792, 6861),
      apertura: tramo("apertura", "Apertura", 3610, 4792),
      efectividad: tramo("efectividad", "Efectividad", 3223, 3610),
      rendimiento: tramo("rendimiento", "Rendimiento", 3223, 6861),
    },
    global: {
      k: 190,
      matriculados: 6861,
      asistentes: 4792,
      enviadas: 3610,
      validas: 3223,
      no_respondieron: 1182,
      tasa: 4792 / 6861,
      media_ch: 0.7,
      sd_ch: 0.1,
      ic_low: 0.68,
      ic_high: 0.72,
      metodo_ic: "bootstrap_percentil",
    },
    dimensiones: [{
      dimension_key: "rango_horario",
      dimension_label: "Rango horario",
      orden: 1,
      filas: [degradada],
    }],
    advertencias: ["marginales_no_combinables", "celda_degradada_a_global"],
  } as CalcMuestraReferenciaAsistencia;
}

const DISENO_VACIO = {
  poblacion_objetivo: null, nivel_confianza: null, proporcion_esperada: null,
  margen_error: null, deff: null, muestra: null, ratio_sobremuestra: null,
  sobremuestra: null, aulas_marco: null, aulas_dimensionadas: null,
  aulas_aplicadas: null, tasa_respuesta_asumida: null,
  efectivas_logradas: null, base_analitica: null, casos_recortados: null,
  ponderacion_alcance: "",
  afijacion: "", metodo_seleccion: "", metodo_ajuste: "",
  ponderado: null, declarado: false,
};

describe("ReferenciaAsistenciaTau", () => {
  it("declara geometría y contiene su propio vacío", () => {
    const html = renderToStaticMarkup(
      <ReferenciaAsistenciaTau tauActual={0.72} referencia={null} />,
    );
    expect(html).toContain(
      'data-qa-geometry-group="calc-muestra/referencia-asistencia-tau"',
    );
    expect(html).toContain('role="status"');
    expect(html).toContain("Sin referencia histórica para calibrar τ");
  });

  it("contrasta τ con producto, cadena e IC y hace visible la degradación", () => {
    const html = renderToStaticMarkup(
      <ReferenciaAsistenciaTau tauActual={0.72} referencia={referencia()} />,
    );
    expect(html).toContain(
      'data-qa-geometry-group="calc-muestra/referencia-asistencia-tau"',
    );
    // Un chip con «τ» a secas obliga a buscar la definición en otro punto de la
    // página. Renombrado al vocabulario nuevo (serie P, 2026-08-20): el
    // griego murió en superficies; el compendio metodológico— junto a
    // su nombre.
    expect(html).toContain("Tasa de efectividad actual");
    expect(html).toContain("72.0%");
    expect(html).toContain("Producto de referencia");
    expect(html).toContain("47.0%");
    expect(html).toContain("Estudio histórico externo");
    for (const label of ["Asistencia", "Apertura", "Efectividad"]) {
      expect(html).toContain(label);
    }
    expect(html.match(/k=190/g)?.length).toBeGreaterThanOrEqual(3);
    expect(html.match(/IC 95%/g)?.length).toBeGreaterThanOrEqual(3);
    expect(html).toContain('role="alert"');
    expect(html).toContain("Referencia degradada al global");
  });

  it("no presenta una celda vacía sin publicación como degradada al global", () => {
    const soloVacia = referencia();
    const base = soloVacia.dimensiones[0]!.filas[0]!;
    soloVacia.dimensiones[0]!.filas = [{
      ...base,
      celda_key: "sin_dato",
      celda_label: "Sin dato",
      k: 0,
      matriculados: null,
      asistentes: null,
      tasa: null,
      media_ch: null,
      sd_ch: null,
      ic_low: null,
      ic_high: null,
      metodo_ic: "no_aplica",
      suficiencia: "vacia",
      tasa_publicada: null,
      k_publicada: null,
      fuente_publicada: "sin_publicacion",
    }];

    const html = renderToStaticMarkup(
      <ReferenciaAsistenciaTau tauActual={0.72} referencia={soloVacia} />,
    );
    expect(html).not.toContain('role="alert"');
    expect(html).not.toContain("Referencia degradada al global");
  });
});
