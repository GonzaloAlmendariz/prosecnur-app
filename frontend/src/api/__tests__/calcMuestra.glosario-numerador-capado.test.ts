// B1/H1 (ADR 0060) — cruce global↔cadena en modo glosario.
//
// Con el glosario completo, el numerador de la cadena de asistencia es
// `asistentes_elegibles` CAPADO a elegibles (un derivado), mientras que
// `global.asistentes` sigue siendo el conteo CRUDO de presentes. El derivado
// solo puede REDUCIR al crudo, nunca superarlo. La igualdad estricta que el
// normalizador exige en la lectura heredada rechazaba el payload legítimo del
// backend reparado (numerador capado < crudo); el fix en calcMuestra.ts
// (rama `glosarioCompleto` del cruce global) acepta `numerador <= asistentes`
// y sigue rechazando `numerador > asistentes`, que no tiene lectura válida.

import { describe, expect, it } from "vitest";

function celda(overrides: Record<string, unknown> = {}) {
  return {
    celda_key: "base",
    celda_label: "Base sintética",
    orden: 1,
    k: 12,
    matriculados: 120,
    asistentes: 0,
    tasa: 0,
    estimador: "razon_agregada",
    media_ch: 0,
    sd_ch: 0,
    ic_low: 0,
    ic_high: 0,
    metodo_ic: "bootstrap_percentil",
    suficiencia: "delgada",
    tasa_publicada: 0,
    k_publicada: 12,
    fuente_publicada: "celda",
    ...overrides,
  };
}

// Payload v2 con glosario completo: asistencia sobre ELEGIBLES (100),
// apertura y efectividad sobre elegibles presentes (88), global con el crudo.
function payloadGlosario(): Record<string, unknown> {
  const tramo = (
    key: string,
    label: string,
    numerador: number,
    denominador: number,
    icLow: number,
    icHigh: number,
  ) => ({
    key,
    label,
    k: 12,
    numerador,
    denominador,
    tasa: numerador / denominador,
    ic_low: icLow,
    ic_high: icHigh,
    metodo_ic: "bootstrap_percentil",
  });
  return {
    schema: "calc_muestra_referencia_asistencia_v2",
    owner: "estudio_historico_externo",
    momento: "post_hoc_estudio_previo",
    transferible: "modelo_por_celda",
    modelo: "marginales_independientes",
    combinable: false,
    unidad: "encuentro_en_curso_horario_aplicado",
    denominador: "elegibles_presentes",
    estudio: {
      id: "estudio-glosario",
      label: "Estudio histórico con glosario",
      periodo: "2026-I",
      fuente: "fixture_sintetico",
    },
    cobertura: {
      agendados: 12,
      aplicados: 12,
      observados: 12,
      glosario_completo: true,
      columnas_glosario: ["elegibles", "ya_medidas", "no_elegibles", "no_efectivas"],
      columnas_criterio: [],
    },
    identidad: {
      regla:
        "elegibles_presentes + presentes_no_contados = efectivas + no_efectivas + no_realizadas",
      verificada: true,
      verificables: 12,
      inconsistentes: 0,
      residuales_negativos: 0,
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
      // asistentes_elegibles capado (85) sobre elegibles (100): MENOR que el
      // crudo del global (90) porque descuenta a los no elegibles presentes.
      asistencia: tramo("asistencia", "Asistencia", 85, 100, 0.8, 0.9),
      apertura: tramo("apertura", "Apertura", 80, 88, 0.85, 0.95),
      efectividad: tramo("efectividad", "Efectividad", 70, 88, 0.72, 0.85),
      rendimiento: tramo("rendimiento", "Rendimiento", 70, 100, 0.62, 0.78),
    },
    global: {
      k: 12,
      matriculados: 120,
      asistentes: 90,
      enviadas: 80,
      validas: 70,
      no_respondieron: 10,
      tasa: 90 / 120,
      media_ch: 0.75,
      sd_ch: 0.05,
      ic_low: 0.7,
      ic_high: 0.8,
      metodo_ic: "bootstrap_percentil",
    },
    dimensiones: [
      { dimension_key: "tamano", dimension_label: "Tamaño", orden: 1, filas: [celda()] },
      { dimension_key: "rango_horario", dimension_label: "Rango horario", orden: 2, filas: [celda()] },
      { dimension_key: "facultad", dimension_label: "Facultad", orden: 3, filas: [celda()] },
      { dimension_key: "tipo_sesion", dimension_label: "Tipo de sesión", orden: 4, filas: [celda()] },
    ],
    // El bloque de encuentros existe exactamente cuando el glosario se leyó
    // (el normalizador exige la coherencia glosario_completo <-> encuentros).
    encuentros: {
      elegibles: 100,
      asistentes: 90,
      ya_medidas: 1,
      no_elegibles: 1,
      elegibles_presentes: 88,
      efectivas: 70,
      no_efectivas: 10,
      no_realizadas: 8,
      presentes_no_contados: 0,
      unidades_publicables: 12,
      unidades_con_residual_negativo: 0,
    },
    advertencias: ["marginales_no_combinables"],
  };
}

function conNumeradorAsistencia(numerador: number): Record<string, unknown> {
  const payload = payloadGlosario();
  const cadena = payload.cadena as Record<string, Record<string, unknown>>;
  Object.assign(cadena.asistencia!, {
    numerador,
    tasa: numerador / 100,
    ic_low: Math.max(0, numerador / 100 - 0.05),
    ic_high: Math.min(1, numerador / 100 + 0.05),
  });
  return payload;
}

describe("B1 — numerador capado de la cadena vs crudo del global (glosario completo)", () => {
  it("acepta numerador capado MENOR que global.asistentes (85 < 90)", async () => {
    const api = await import("../calcMuestra");
    const normalizado = api.normalizeCalcMuestraReferenciaAsistencia(payloadGlosario());
    expect(
      normalizado,
      "El derivado capado por debajo del crudo es la salida legítima del backend",
    ).not.toBeNull();
    expect(normalizado?.cadena.asistencia).toMatchObject({
      numerador: 85,
      denominador: 100,
    });
    expect(normalizado?.global.asistentes).toBe(90);
    expect(normalizado?.cobertura.glosario_completo).toBe(true);
  });

  it("acepta el borde: numerador igual al crudo (90 = 90, sin no elegibles detectados)", async () => {
    const api = await import("../calcMuestra");
    expect(
      api.normalizeCalcMuestraReferenciaAsistencia(conNumeradorAsistencia(90)),
    ).not.toBeNull();
  });

  it("rechaza numerador MAYOR que global.asistentes (95 > 90): no hay lectura válida", async () => {
    const api = await import("../calcMuestra");
    // Un derivado que descuenta no elegibles no puede superar al conteo crudo:
    // el payload es incoherente consigo mismo y falla cerrado.
    expect(
      api.normalizeCalcMuestraReferenciaAsistencia(conNumeradorAsistencia(95)),
    ).toBeNull();
  });
});
