// D5 — Una tasa mayor que 1 no es un dato: es un defecto de fórmula (ADR 0060).
//
// Hoy `isAllowedDiagnosticRate` (src/api/calcMuestra.ts) acepta tasas > 1 en
// celdas y tramos de la referencia de asistencia siempre que el payload traiga
// la advertencia dinámica del backend (`asistentes_mayor_matriculados:N`). El
// ADR 0060 prohíbe publicar esas tasas —«un valor mayor es un defecto de
// fórmula, no un dato»— y el contrato congelado exige fallo cerrado: un tramo
// o celda con tasa > 1 invalida el payload (el normalizador devuelve null),
// con el mismo patrón fail-closed que este normalizador ya aplica a las demás
// identidades (conteos negativos, suficiencia incompatible, clamp).
//
// HOY ROJO: el caso "tasa 1.3 + advertencia + degradación a global" se acepta
// (es exactamente el camino que el test histórico
// categorias.referencia-asistencia.test.ts fijaba como válido).

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

function payloadValido(): Record<string, unknown> {
  const tramo = (key: string, label: string, numerador: number, denominador: number) => ({
    key,
    label,
    k: 12,
    numerador,
    denominador,
    tasa: denominador === 0 ? null : numerador / denominador,
    ic_low: denominador === 0 ? null : 0,
    ic_high: denominador === 0 ? null : 0,
    metodo_ic: denominador === 0 ? "no_aplica" : "bootstrap_percentil",
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
      agendados: 12,
      aplicados: 12,
      observados: 12,
      glosario_completo: false,
      columnas_glosario: [],
      columnas_criterio: [],
    },
    identidad: {
      regla: "A = E + no_respondieron",
      verificada: true,
      verificables: 12,
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
      asistencia: tramo("asistencia", "Asistencia", 0, 120),
      apertura: tramo("apertura", "Apertura", 0, 0),
      efectividad: tramo("efectividad", "Efectividad", 0, 0),
      rendimiento: tramo("rendimiento", "Rendimiento", 0, 120),
    },
    global: {
      k: 12,
      matriculados: 120,
      asistentes: 0,
      enviadas: 0,
      validas: 0,
      no_respondieron: 0,
      tasa: 0,
      media_ch: 0,
      sd_ch: 0,
      ic_low: 0,
      ic_high: 0,
      metodo_ic: "bootstrap_percentil",
    },
    dimensiones: [
      { dimension_key: "tamano", dimension_label: "Tamaño", orden: 1, filas: [celda()] },
      { dimension_key: "rango_horario", dimension_label: "Rango horario", orden: 2, filas: [celda()] },
      { dimension_key: "facultad", dimension_label: "Facultad", orden: 3, filas: [celda()] },
      { dimension_key: "tipo_sesion", dimension_label: "Tipo de sesión", orden: 4, filas: [celda()] },
    ],
    advertencias: ["marginales_no_combinables"],
  };
}

function primeraCelda(payload: Record<string, unknown>): Record<string, unknown> {
  const dimensiones = payload.dimensiones as Array<{
    filas: Array<Record<string, unknown>>;
  }>;
  return dimensiones[0]!.filas[0]!;
}

describe("D5 — normalizador de referencia de asistencia con tasa imposible", () => {
  it("sanidad del arnés: el payload base sigue siendo válido", async () => {
    const api = await import("../calcMuestra");
    expect(api.normalizeCalcMuestraReferenciaAsistencia(payloadValido())).not.toBeNull();
  });

  it("rechaza una celda con tasa 1.3 aunque venga la advertencia del backend (fail-closed)", async () => {
    const api = await import("../calcMuestra");
    const payload = payloadValido();
    // 156 asistentes sobre 120 matriculados: la tasa imposible del ADR 0060,
    // acompañada de la advertencia dinámica que hoy la deja pasar y de la
    // degradación a global que hoy se considera "segura".
    Object.assign(primeraCelda(payload), {
      matriculados: 120,
      asistentes: 156,
      tasa: 1.3,
      tasa_publicada: 0,
      k_publicada: 12,
      fuente_publicada: "global",
    });
    payload.advertencias = [
      ...(payload.advertencias as string[]),
      "asistentes_mayor_matriculados:1",
    ];

    // HOY ROJO: isAllowedDiagnosticRate acepta tasa > 1 con advertencia y el
    // normalizador devuelve el payload entero. Verde: tramo inválido =>
    // fallo cerrado (null), como el resto de identidades del normalizador.
    expect(api.normalizeCalcMuestraReferenciaAsistencia(payload)).toBeNull();
  });

  it("rechaza un tramo de la cadena con tasa 1.3 aunque venga la advertencia del backend (fail-closed)", async () => {
    const api = await import("../calcMuestra");
    const payload = payloadValido();
    // Cadena y global COHERENTES entre sí (156 asistentes sobre 120
    // matriculados en todos los cruces): el único motivo para rechazar el
    // payload es la tasa imposible.
    const cadena = payload.cadena as Record<string, Record<string, unknown>>;
    Object.assign(cadena.asistencia!, {
      numerador: 156,
      denominador: 120,
      tasa: 1.3,
      ic_low: 1.3,
      ic_high: 1.3,
    });
    Object.assign(cadena.apertura!, {
      numerador: 0,
      denominador: 156,
      tasa: 0,
      ic_low: 0,
      ic_high: 0,
      metodo_ic: "bootstrap_percentil",
    });
    Object.assign(payload.global as Record<string, unknown>, {
      asistentes: 156,
      tasa: 1.3,
      ic_low: 1.3,
      ic_high: 1.3,
    });
    payload.advertencias = [
      ...(payload.advertencias as string[]),
      "asistentes_mayor_matriculados:1",
    ];

    // HOY ROJO: el tramo diagnóstico > 1 pasa con la advertencia. Verde:
    // fallo cerrado.
    expect(api.normalizeCalcMuestraReferenciaAsistencia(payload)).toBeNull();
  });
});
