// B3 (ADR 0060, punto 11) — la forma que emite la migración de un .pulso viejo
// pasa el normalizador.
//
// Un .pulso guardado antes del saneo puede traer tasas > 1 persistidas («tasa
// diagnóstica» del contrato viejo). Al cargar, el backend las migra
// (`.pulso_migrate_asistencia_tasas_imposibles` en api/R/project_pulso.R):
// tasa -> null + `residual_negativo = true`, IC -> null + `metodo_ic =
// "no_aplica"`, conteos INTACTOS; y la publicación de las celdas afectadas
// degrada (global válido -> "global"; global también inválido ->
// "sin_publicacion").
//
// La diferencia con la salida sancionada del motor (cubierta en
// categorias.referencia-asistencia.test.ts) es que aquí los conteos NO
// desbordan: la tasa persistida era el defecto (1.3 junto a 90/120), así que
// la marca residual viaja con un numerador/denominador cuya razón sería
// válida. El normalizador debe aceptar exactamente esa forma — si la
// rechazara, el Histórico de todo .pulso migrado reabriría vacío.

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

// La referencia legada (v1, sin glosario) TAL COMO SALE de la migración cuando
// el estado persistido traía tasa 1.3 en asistencia, en el global y en la
// primera celda de la dimensión de tamaño.
function payloadMigrado(): Record<string, unknown> {
  const saneado = {
    tasa: null,
    ic_low: null,
    ic_high: null,
    metodo_ic: "no_aplica",
    residual_negativo: true,
  };
  const tramo = (
    key: string,
    label: string,
    numerador: number,
    denominador: number,
  ) => ({
    key,
    label,
    k: 12,
    numerador,
    denominador,
    tasa: denominador === 0 ? null : numerador / denominador,
    ic_low: denominador === 0 ? null : Math.max(0, numerador / denominador - 0.05),
    ic_high: denominador === 0 ? null : Math.min(1, numerador / denominador + 0.05),
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
      id: "estudio-migrado",
      label: "Estudio histórico migrado",
      periodo: "2025-II",
      fuente: "pulso_v1",
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
      // Migrado: la tasa persistida (1.3) se saneó; los conteos 90/120 quedan
      // intactos para el diagnóstico aunque su razón (0.75) sería válida.
      asistencia: {
        key: "asistencia",
        label: "Asistencia",
        k: 12,
        numerador: 90,
        denominador: 120,
        ...saneado,
      },
      apertura: tramo("apertura", "Apertura", 60, 90),
      efectividad: tramo("efectividad", "Efectividad", 40, 60),
      rendimiento: tramo("rendimiento", "Rendimiento", 40, 120),
    },
    // Migrado igual que la cadena: tasa null + marca, conteos intactos.
    global: {
      k: 12,
      matriculados: 120,
      asistentes: 90,
      enviadas: 60,
      validas: 40,
      no_respondieron: 30,
      media_ch: 0.75,
      sd_ch: 0.05,
      ...saneado,
    },
    dimensiones: [
      {
        dimension_key: "tamano",
        dimension_label: "Tamaño",
        orden: 1,
        filas: [
          // La celda que publicaba su propia tasa imposible: saneada y, con el
          // global migrado (inválido), republicada a sin_publicacion.
          celda({
            matriculados: 120,
            asistentes: 90,
            ...saneado,
            tasa_publicada: null,
            k_publicada: null,
            fuente_publicada: "sin_publicacion",
          }),
        ],
      },
      // Las celdas sanas del mismo estado no se tocan: siguen publicando su
      // propia tasa.
      { dimension_key: "rango_horario", dimension_label: "Rango horario", orden: 2, filas: [celda()] },
      { dimension_key: "facultad", dimension_label: "Facultad", orden: 3, filas: [celda()] },
      { dimension_key: "tipo_sesion", dimension_label: "Tipo de sesión", orden: 4, filas: [celda()] },
    ],
    advertencias: ["marginales_no_combinables"],
  };
}

describe("B3 — la forma migrada de un .pulso viejo pasa el normalizador", () => {
  it("acepta cadena, global y celda migrados: tasa null + residual_negativo + conteos intactos", async () => {
    const api = await import("../calcMuestra");
    const normalizado = api.normalizeCalcMuestraReferenciaAsistencia(payloadMigrado());
    expect(
      normalizado,
      "El Histórico de un .pulso migrado no puede reabrir vacío",
    ).not.toBeNull();
    expect(normalizado?.cadena.asistencia).toMatchObject({
      numerador: 90,
      denominador: 120,
      tasa: null,
      residual_negativo: true,
      metodo_ic: "no_aplica",
      ic_low: null,
      ic_high: null,
    });
    expect(normalizado?.global).toMatchObject({
      matriculados: 120,
      asistentes: 90,
      tasa: null,
      residual_negativo: true,
      metodo_ic: "no_aplica",
    });
    expect(normalizado?.dimensiones[0]?.filas[0]).toMatchObject({
      matriculados: 120,
      asistentes: 90,
      tasa: null,
      residual_negativo: true,
      tasa_publicada: null,
      k_publicada: null,
      fuente_publicada: "sin_publicacion",
    });
    // La celda sana del mismo estado conserva su publicación propia.
    expect(normalizado?.dimensiones[1]?.filas[0]).toMatchObject({
      tasa: 0,
      fuente_publicada: "celda",
    });
  });

  it("sin la marca residual, la misma forma sigue siendo payload defectuoso (fail-closed intacto)", async () => {
    const api = await import("../calcMuestra");
    const payload = payloadMigrado();
    const cadena = payload.cadena as Record<string, Record<string, unknown>>;
    cadena.asistencia!.residual_negativo = false;
    expect(
      api.normalizeCalcMuestraReferenciaAsistencia(payload),
      "Tasa null con conteos poblados y sin marca no es una migración: es un defecto",
    ).toBeNull();
  });
});
