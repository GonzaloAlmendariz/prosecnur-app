import { describe, expect, it } from "vitest";
import {
  CALC_MUESTRA_AULAS_CRITERIOS_RADIOGRAFIA_V2_SCHEMA,
  normalizeCalcMuestraAulasCriteriosRadiografia,
} from "./calcMuestraCriteriosRadiografia";

const distribution = {
  media: 10,
  p10: 4,
  p25: 7,
  p50: 10,
  p75: 13,
  p90: 16,
};

function snapshot(nCh = 4, nWithData = nCh) {
  const complete = nWithData === nCh;
  return {
    n_ch: nCh,
    n_ch_con_dato: nWithData,
    n_estudiantes_unicos: complete ? (nCh === 0 ? 0 : 32) : null,
    n_matriculas: complete ? (nCh === 0 ? 0 : 40) : null,
    distribution: nWithData === nCh && nCh > 0
      ? distribution
      : { media: "NA", p10: "NA", p25: "NA", p50: "NA", p75: "NA", p90: "NA" },
  };
}

function row(overrides: Record<string, unknown> = {}) {
  return {
    faculty_key: "ingenieria",
    faculty_label: "Ingeniería",
    segment_key: "teorico",
    segment_label: "Teórico",
    segment_kind: "categoria",
    actual: snapshot(4),
    contraste_total: { ...snapshot(5), n_matriculas: 45 },
    signal_distribution: {
      unit: "valor_criterio",
      n_total: 4,
      n_con_dato: 4,
      ...distribution,
    },
    delta: {
      reference: "marco_ejecutado",
      action: "restringir_a_categoria",
      reconstruccion_valida: true,
      delta_ch: -1,
      delta_matriculas: -5,
      delta_estudiantes_unicos: -4,
    },
    ...overrides,
  };
}

function sessionEntry(overrides: Record<string, unknown> = {}) {
  return {
    id: "session_type",
    card_id: "session_type",
    label: "Tipo de sesión",
    scope: "aula",
    family: "classroom_flat",
    owner: "calc_muestra_aulas_frame_v1.aula_frame",
    kind: "flat",
    grain: "curso_horario_x_facultad_x_segmento",
    unit: "curso_horario_unico",
    gate: "marco",
    status: "disponible",
    effective_layer: null,
    overlap: false,
    faculty_dimension: "curso_horario_efectiva",
    rows: [row()],
    ...overrides,
  };
}

function ageEntry(overrides: Record<string, unknown> = {}) {
  return {
    id: "age",
    card_id: "age",
    label: "Edad",
    scope: "alumno",
    family: "student_numeric",
    owner: "calc_muestra_aulas_construir_v1.filas_alumno",
    kind: "numeric",
    grain: "alumno_x_curso_horario_x_facultad",
    unit: "alumno_unico_por_curso_horario",
    gate: "poblacion",
    status: "disponible",
    effective_layer: "marco",
    overlap: false,
    faculty_dimension: "alumno",
    rows: [row({
      segment_key: "cumple",
      segment_label: "Cumple ≥ 18",
      segment_kind: "cumple",
      delta: {
        reference: "marco_ejecutado",
        action: "reemplazar_regla",
        reconstruccion_valida: true,
        delta_ch: 0,
        delta_matriculas: -2,
        delta_estudiantes_unicos: -2,
      },
    })],
    ...overrides,
  };
}

function hierarchicalEntry(overrides: Record<string, unknown> = {}) {
  return {
    id: "teacher_type",
    card_id: "teacher_type",
    label: "Tipo de docente",
    scope: "aula",
    family: "classroom_hierarchical",
    owner: "calc_muestra_aulas_frame_v1.aula_frame",
    kind: "hierarchical",
    grain: "curso_horario_x_facultad_x_segmento",
    unit: "curso_horario_unico",
    gate: "marco",
    status: "disponible",
    effective_layer: null,
    overlap: true,
    faculty_dimension: "curso_horario_efectiva",
    rows: [row({ segment_key: "docente", segment_label: "Docente", segment_kind: "grupo" })],
    ...overrides,
  };
}

function v1Row(overrides: Record<string, unknown> = {}) {
  return {
    criterio: "session_type",
    facultad_key: "ingenieria",
    facultad_label: "Ingeniería",
    categoria_key: "teorico",
    categoria_label: "Teórico",
    n_ch_total: 5,
    n_ch_elegibles: 4,
    n_matriculas_elegibles: 40,
    distribucion_elegible: { n_ch_con_dato: 4, ...distribution },
    contraste_total: { n_ch_con_dato: 5, media: 10 },
    delta_marginal: {
      referencia: "marco_ejecutado",
      accion: "restringir_a_categoria",
      delta_ch: -1,
      delta_matriculas_elegibles: -5,
    },
    ...overrides,
  };
}

function root(overrides: Record<string, unknown> = {}) {
  return {
    schema: CALC_MUESTRA_AULAS_CRITERIOS_RADIOGRAFIA_V2_SCHEMA,
    owner: "calc_muestra_aulas_frame_v1.criterios_radiografia",
    frame_hash: "frame-123",
    momento: "marco_ejecutado",
    grano: "criterio_x_facultad_x_segmento",
    unidad: "curso_horario_unico",
    filas_owner: "calc_muestra_aulas_frame_v1.aula_frame",
    filas_grano: "session_type_x_facultad_efectiva",
    filas: [v1Row()],
    criterios: [sessionEntry(), ageEntry()],
    ...overrides,
  };
}

describe("normalizeCalcMuestraAulasCriteriosRadiografia — v2", () => {
  it("normaliza el root v2 y conserva el adapter I11 solo cuando las filas coinciden", () => {
    const out = normalizeCalcMuestraAulasCriteriosRadiografia(root());

    expect(out?.schema).toBe(CALC_MUESTRA_AULAS_CRITERIOS_RADIOGRAFIA_V2_SCHEMA);
    if (!out || out.schema !== CALC_MUESTRA_AULAS_CRITERIOS_RADIOGRAFIA_V2_SCHEMA) return;
    expect(out.filas).toHaveLength(1);
    expect(out.criterios.map((entry) => [entry.id, entry.status])).toEqual([
      ["session_type", "disponible"],
      ["age", "disponible"],
    ]);
  });

  it("invalida solo la tarjeta con un número corrupto y nunca lo convierte en cero", () => {
    const corruptAge = ageEntry({
      rows: [row({
        segment_key: "cumple",
        segment_label: "Cumple ≥ 18",
        segment_kind: "cumple",
        actual: { ...snapshot(4), distribution: { ...distribution, p50: "Infinity" } },
        delta: {
          reference: "marco_ejecutado",
          action: "reemplazar_regla",
          reconstruccion_valida: true,
          delta_ch: 0,
          delta_matriculas: -2,
          delta_estudiantes_unicos: -2,
        },
      })],
    });
    const out = normalizeCalcMuestraAulasCriteriosRadiografia(root({
      criterios: [sessionEntry(), corruptAge],
    }));

    if (!out || out.schema !== CALC_MUESTRA_AULAS_CRITERIOS_RADIOGRAFIA_V2_SCHEMA) {
      throw new Error("v2 esperado");
    }
    expect(out.criterios.find((entry) => entry.id === "age")).toMatchObject({
      status: "invalido",
      rows: [],
    });
    expect(out.criterios.find((entry) => entry.id === "session_type")?.status).toBe("disponible");
  });

  it("rechaza cruces family/scope/owner que no pertenecen a la misma rama", () => {
    expect(normalizeCalcMuestraAulasCriteriosRadiografia(root({
      criterios: [sessionEntry(), ageEntry({ owner: "calc_muestra_aulas_frame_v1.aula_frame" })],
    }))).toBeNull();
  });

  it("correlaciona capas de alumno informativas con no_aplica y deltas NA", () => {
    const informative = ageEntry({
      effective_layer: "instrumento",
      gate: "informativo",
      rows: [row({
        segment_key: "cumple",
        segment_label: "Cumple ≥ 18",
        segment_kind: "cumple",
        delta: {
          reference: "marco_ejecutado",
          action: "no_aplica",
          reconstruccion_valida: false,
          delta_ch: "NA",
          delta_matriculas: "NA",
          delta_estudiantes_unicos: "NA",
        },
      })],
    });
    const out = normalizeCalcMuestraAulasCriteriosRadiografia(root({
      criterios: [sessionEntry(), informative],
    }));
    if (!out || out.schema !== CALC_MUESTRA_AULAS_CRITERIOS_RADIOGRAFIA_V2_SCHEMA) {
      throw new Error("v2 esperado");
    }
    expect(out.criterios.find((entry) => entry.id === "age")).toMatchObject({
      gate: "informativo",
      effective_layer: "instrumento",
      status: "disponible",
    });

    expect(normalizeCalcMuestraAulasCriteriosRadiografia(root({
      criterios: [sessionEntry(), ageEntry({ effective_layer: "instrumento", gate: "poblacion" })],
    }))).toBeNull();
  });

  it("aplica NA estricto cuando el denominador no está completo", () => {
    const partial = ageEntry({
      rows: [row({
        segment_key: "cumple",
        segment_label: "Cumple ≥ 18",
        segment_kind: "cumple",
        actual: snapshot(4, 3),
        delta: {
          reference: "marco_ejecutado",
          action: "reemplazar_regla",
          reconstruccion_valida: true,
          delta_ch: 0,
          delta_matriculas: -2,
          delta_estudiantes_unicos: -2,
        },
      })],
    });
    const out = normalizeCalcMuestraAulasCriteriosRadiografia(root({ criterios: [sessionEntry(), partial] }));
    if (!out || out.schema !== CALC_MUESTRA_AULAS_CRITERIOS_RADIOGRAFIA_V2_SCHEMA) {
      throw new Error("v2 esperado");
    }
    expect(out.criterios.find((entry) => entry.id === "age")?.rows[0].actual.distribution.p50).toBeNull();

    const mixed = ageEntry({
      rows: [row({
        segment_key: "cumple",
        segment_label: "Cumple ≥ 18",
        segment_kind: "cumple",
        actual: { ...snapshot(4, 3), distribution },
      })],
    });
    const invalid = normalizeCalcMuestraAulasCriteriosRadiografia(root({ criterios: [sessionEntry(), mixed] }));
    if (!invalid || invalid.schema !== CALC_MUESTRA_AULAS_CRITERIOS_RADIOGRAFIA_V2_SCHEMA) {
      throw new Error("v2 esperado");
    }
    expect(invalid.criterios.find((entry) => entry.id === "age")?.status).toBe("invalido");
  });

  it("liga signal_distribution a su n_total explícito", () => {
    const partialSignal = ageEntry({
      rows: [row({
        segment_key: "cumple",
        segment_label: "Cumple ≥ 18",
        segment_kind: "cumple",
        signal_distribution: {
          unit: "valor_criterio",
          n_total: 4,
          n_con_dato: 3,
          media: "NA",
          p10: "NA",
          p25: "NA",
          p50: "NA",
          p75: "NA",
          p90: "NA",
        },
        delta: {
          reference: "marco_ejecutado",
          action: "reemplazar_regla",
          reconstruccion_valida: true,
          delta_ch: 0,
          delta_matriculas: -2,
          delta_estudiantes_unicos: -2,
        },
      })],
    });
    const valid = normalizeCalcMuestraAulasCriteriosRadiografia(root({
      criterios: [sessionEntry(), partialSignal],
    }));
    if (!valid || valid.schema !== CALC_MUESTRA_AULAS_CRITERIOS_RADIOGRAFIA_V2_SCHEMA) {
      throw new Error("v2 esperado");
    }
    expect(valid.criterios.find((entry) => entry.id === "age")?.rows[0].signal_distribution).toMatchObject({
      n_total: 4,
      n_con_dato: 3,
      media: null,
    });

    const falsePrecision = ageEntry({
      rows: [row({
        segment_key: "cumple",
        segment_label: "Cumple ≥ 18",
        segment_kind: "cumple",
        signal_distribution: {
          unit: "valor_criterio",
          n_total: 4,
          n_con_dato: 3,
          ...distribution,
        },
      })],
    });
    const invalid = normalizeCalcMuestraAulasCriteriosRadiografia(root({
      criterios: [sessionEntry(), falsePrecision],
    }));
    if (!invalid || invalid.schema !== CALC_MUESTRA_AULAS_CRITERIOS_RADIOGRAFIA_V2_SCHEMA) {
      throw new Error("v2 esperado");
    }
    expect(invalid.criterios.find((entry) => entry.id === "age")?.status).toBe("invalido");
  });

  it("exige deltas nulos cuando la reconstrucción no es válida", () => {
    const invalidDelta = ageEntry({
      rows: [row({
        segment_key: "cumple",
        segment_label: "Cumple ≥ 18",
        segment_kind: "cumple",
        delta: {
          reference: "marco_ejecutado",
          action: "reemplazar_regla",
          reconstruccion_valida: false,
          delta_ch: 0,
          delta_matriculas: null,
          delta_estudiantes_unicos: null,
        },
      })],
    });
    const out = normalizeCalcMuestraAulasCriteriosRadiografia(root({
      criterios: [sessionEntry(), invalidDelta],
    }));
    if (!out || out.schema !== CALC_MUESTRA_AULAS_CRITERIOS_RADIOGRAFIA_V2_SCHEMA) {
      throw new Error("v2 esperado");
    }
    expect(out.criterios.find((entry) => entry.id === "age")?.status).toBe("invalido");
  });

  it("exige los tres deltas firmados cuando la reconstrucción es válida", () => {
    const partialDelta = ageEntry({
      rows: [row({
        segment_key: "cumple",
        segment_label: "Cumple ≥ 18",
        segment_kind: "cumple",
        delta: {
          reference: "marco_ejecutado",
          action: "reemplazar_regla",
          reconstruccion_valida: true,
          delta_ch: 0,
          delta_matriculas: -2,
          delta_estudiantes_unicos: "NA",
        },
      })],
    });
    const out = normalizeCalcMuestraAulasCriteriosRadiografia(root({
      criterios: [sessionEntry(), partialDelta],
    }));
    if (!out || out.schema !== CALC_MUESTRA_AULAS_CRITERIOS_RADIOGRAFIA_V2_SCHEMA) {
      throw new Error("v2 esperado");
    }
    expect(out.criterios.find((entry) => entry.id === "age")?.status).toBe("invalido");
  });

  it("invalida session_type y retira el adapter I11 si ambas representaciones divergen", () => {
    const out = normalizeCalcMuestraAulasCriteriosRadiografia(root({
      filas: [v1Row({ n_matriculas_elegibles: 999 })],
    }));
    if (!out || out.schema !== CALC_MUESTRA_AULAS_CRITERIOS_RADIOGRAFIA_V2_SCHEMA) {
      throw new Error("v2 esperado");
    }
    expect(out.filas).toEqual([]);
    expect(out.criterios.find((entry) => entry.id === "session_type")?.status).toBe("invalido");
  });

  it("preserva el delta_ch parcial de I11 cuando v2 declara reconstrucción atómica no válida", () => {
    const partialSession = sessionEntry({
      rows: [row({
        actual: {
          ...snapshot(4, 3),
          n_matriculas: null,
        },
        delta: {
          reference: "marco_ejecutado",
          action: "restringir_a_categoria",
          reconstruccion_valida: false,
          delta_ch: "NA",
          delta_matriculas: "NA",
          delta_estudiantes_unicos: "NA",
        },
      })],
    });
    const partialV1 = v1Row({
      n_matriculas_elegibles: "NA",
      distribucion_elegible: {
        n_ch_con_dato: 3,
        media: "NA",
        p10: "NA",
        p25: "NA",
        p50: "NA",
        p75: "NA",
        p90: "NA",
      },
      delta_marginal: {
        referencia: "marco_ejecutado",
        accion: "restringir_a_categoria",
        delta_ch: -1,
        delta_matriculas_elegibles: "NA",
      },
    });
    const out = normalizeCalcMuestraAulasCriteriosRadiografia(root({
      filas: [partialV1],
      criterios: [partialSession, ageEntry()],
    }));
    if (!out || out.schema !== CALC_MUESTRA_AULAS_CRITERIOS_RADIOGRAFIA_V2_SCHEMA) {
      throw new Error("v2 esperado");
    }
    expect(out.filas[0].delta_marginal).toEqual({
      referencia: "marco_ejecutado",
      accion: "restringir_a_categoria",
      delta_ch: -1,
      delta_matriculas_elegibles: null,
    });
    expect(out.criterios.find((entry) => entry.id === "session_type")?.status).toBe("disponible");
  });

  it("rechaza procedencia o grano root que no sean los literales v2", () => {
    expect(normalizeCalcMuestraAulasCriteriosRadiografia(root({
      owner: "calc_muestra_aulas_frame_v1.aula_frame",
    }))).toBeNull();
    expect(normalizeCalcMuestraAulasCriteriosRadiografia(root({
      grano: "session_type_x_facultad_efectiva",
    }))).toBeNull();
  });

  it("exige estudiantes únicos <= matrículas en snapshots completos", () => {
    const out = normalizeCalcMuestraAulasCriteriosRadiografia(root({
      criterios: [sessionEntry(), ageEntry({
        rows: [row({
          segment_key: "cumple",
          segment_label: "Cumple ≥ 18",
          segment_kind: "cumple",
          actual: { ...snapshot(4), n_estudiantes_unicos: 41, n_matriculas: 40 },
        })],
      })],
    }));
    if (!out || out.schema !== CALC_MUESTRA_AULAS_CRITERIOS_RADIOGRAFIA_V2_SCHEMA) throw new Error("v2 esperado");
    expect(out.criterios.find((entry) => entry.id === "age")?.status).toBe("invalido");
  });

  it.each([
    ["n_ch", snapshot(6), { ...snapshot(5), n_matriculas: 45 }],
    ["matrículas", { ...snapshot(4), n_matriculas: 50 }, { ...snapshot(5), n_matriculas: 45 }],
    ["estudiantes únicos", { ...snapshot(4), n_estudiantes_unicos: 35 }, { ...snapshot(5), n_estudiantes_unicos: 32, n_matriculas: 45 }],
  ])("exige actual⊆contraste_total para %s", (_metric, actual, contraste_total) => {
    const out = normalizeCalcMuestraAulasCriteriosRadiografia(root({
      criterios: [sessionEntry(), ageEntry({
        rows: [row({
          segment_key: "cumple",
          segment_label: "Cumple ≥ 18",
          segment_kind: "cumple",
          actual,
          contraste_total,
        })],
      })],
    }));
    if (!out || out.schema !== CALC_MUESTRA_AULAS_CRITERIOS_RADIOGRAFIA_V2_SCHEMA) throw new Error("v2 esperado");
    expect(out.criterios.find((entry) => entry.id === "age")?.status).toBe("invalido");
  });

  it("no acepta el alias v1 `distribucion` dentro de un snapshot v2", () => {
    const { distribution: rawDistribution, ...counts } = snapshot(4);
    const out = normalizeCalcMuestraAulasCriteriosRadiografia(root({
      criterios: [sessionEntry(), ageEntry({
        rows: [row({
          segment_key: "cumple",
          segment_label: "Cumple ≥ 18",
          segment_kind: "cumple",
          actual: { ...counts, distribucion: rawDistribution },
        })],
      })],
    }));
    if (!out || out.schema !== CALC_MUESTRA_AULAS_CRITERIOS_RADIOGRAFIA_V2_SCHEMA) throw new Error("v2 esperado");
    expect(out.criterios.find((entry) => entry.id === "age")?.status).toBe("invalido");
  });

  it("trata como atómicos los conteos de un snapshot parcial", () => {
    const out = normalizeCalcMuestraAulasCriteriosRadiografia(root({
      criterios: [sessionEntry(), ageEntry({
        rows: [row({
          segment_key: "cumple",
          segment_label: "Cumple ≥ 18",
          segment_kind: "cumple",
          actual: { ...snapshot(4, 3), n_estudiantes_unicos: 20, n_matriculas: 25 },
        })],
      })],
    }));
    if (!out || out.schema !== CALC_MUESTRA_AULAS_CRITERIOS_RADIOGRAFIA_V2_SCHEMA) throw new Error("v2 esperado");
    expect(out.criterios.find((entry) => entry.id === "age")?.status).toBe("invalido");
  });

  it("exige signal_distribution en familias numéricas", () => {
    const { signal_distribution: _signal, ...withoutSignal } = row({
      segment_key: "cumple",
      segment_label: "Cumple ≥ 18",
      segment_kind: "cumple",
    });
    const out = normalizeCalcMuestraAulasCriteriosRadiografia(root({
      criterios: [sessionEntry(), ageEntry({ rows: [withoutSignal] })],
    }));
    if (!out || out.schema !== CALC_MUESTRA_AULAS_CRITERIOS_RADIOGRAFIA_V2_SCHEMA) throw new Error("v2 esperado");
    expect(out.criterios.find((entry) => entry.id === "age")?.status).toBe("invalido");
  });

  it("identifica una fila por facultad+segmento aunque cambie segment_kind", () => {
    const duplicate = hierarchicalEntry({
      rows: [
        row({ segment_key: "docente", segment_label: "Docente", segment_kind: "grupo" }),
        row({ segment_key: "docente", segment_label: "Docente", segment_kind: "categoria" }),
      ],
    });
    const out = normalizeCalcMuestraAulasCriteriosRadiografia(root({
      criterios: [sessionEntry(), duplicate],
    }));
    if (!out || out.schema !== CALC_MUESTRA_AULAS_CRITERIOS_RADIOGRAFIA_V2_SCHEMA) throw new Error("v2 esperado");
    expect(out.criterios.find((entry) => entry.id === "teacher_type")?.status).toBe("invalido");
  });

  it("admite grupo solo para la familia jerárquica", () => {
    const out = normalizeCalcMuestraAulasCriteriosRadiografia(root({
      criterios: [sessionEntry(), hierarchicalEntry()],
    }));
    if (!out || out.schema !== CALC_MUESTRA_AULAS_CRITERIOS_RADIOGRAFIA_V2_SCHEMA) throw new Error("v2 esperado");
    expect(out.criterios.find((entry) => entry.id === "teacher_type")?.status).toBe("disponible");

    const flat = normalizeCalcMuestraAulasCriteriosRadiografia(root({
      criterios: [sessionEntry({ rows: [row({ segment_kind: "grupo" })] }), ageEntry()],
    }));
    if (!flat || flat.schema !== CALC_MUESTRA_AULAS_CRITERIOS_RADIOGRAFIA_V2_SCHEMA) throw new Error("v2 esperado");
    expect(flat.criterios.find((entry) => entry.id === "session_type")?.status).toBe("invalido");
  });

  it("conserva no_aplica de marco con reconstrucción válida y deltas cero", () => {
    const noAplica = {
      referencia: "marco_ejecutado",
      accion: "no_aplica",
      delta_ch: 0,
      delta_matriculas_elegibles: 0,
    };
    const out = normalizeCalcMuestraAulasCriteriosRadiografia(root({
      filas: [v1Row({ delta_marginal: noAplica })],
      criterios: [sessionEntry({
        rows: [row({
          delta: {
            reference: "marco_ejecutado",
            action: "no_aplica",
            reconstruccion_valida: true,
            delta_ch: 0,
            delta_matriculas: 0,
            delta_estudiantes_unicos: 0,
          },
        })],
      }), ageEntry()],
    }));
    if (!out || out.schema !== CALC_MUESTRA_AULAS_CRITERIOS_RADIOGRAFIA_V2_SCHEMA) throw new Error("v2 esperado");
    expect(out.filas).toHaveLength(1);
    expect(out.criterios.find((entry) => entry.id === "session_type")?.status).toBe("disponible");
  });
});
