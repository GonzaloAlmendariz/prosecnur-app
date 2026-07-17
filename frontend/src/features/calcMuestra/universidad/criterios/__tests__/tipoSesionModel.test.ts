import { describe, expect, it } from "vitest";
import {
  normalizeCalcMuestraSessionTypeImpacto,
  normalizeCriteriosCatalogo,
  type CalcMuestraAulasExploracion,
  type CalcMuestraSessionTypeImpacto,
  type CriterioSeleccion,
  type CriterioVariable,
} from "../../../../../api/client";
import { UNIVERSITY_SESSION_TYPE_SUGERENCIAS } from "../../shared/constants";
import {
  aplicarSugerencia,
  avisosImpacto,
  decisionFacultad,
  exceptuarTipoEnFacultad,
  filasPorFacultad,
  heredarFacultad,
  senalAgrupamientoDti,
  sugerenciaAplicada,
  sugerenciaParaFacultad,
  textKey,
  tipoActivoEnFacultad,
  toggleTipoEnFacultad,
} from "../tipoSesionModel";

const VARIABLE: CriterioVariable = {
  id: "session_type",
  scope: "aula",
  label: "Tipo de sesión",
  kind: "flat",
  mappedColumn: "Tipo de curso",
  categories: [
    {
      key: "teorico",
      label: "TEÓRICO",
      aulas: 300,
      por_facultad: [
        { facultad: "ESTUDIOS GENERALES LETRAS", ch: 120 },
        { facultad: "PSICOLOGÍA", ch: 60 },
      ],
    },
    {
      key: "laboratorio",
      label: "LABORATORIO",
      aulas: 80,
      por_facultad: [{ facultad: "CIENCIAS E INGENIERIA", ch: 70 }],
    },
    {
      key: "taller",
      label: "TALLER",
      aulas: 90,
      por_facultad: [
        { facultad: "ARTE Y DISEÑO", ch: 55 },
        { facultad: "ESTUDIOS GENERALES LETRAS", ch: 87 },
      ],
    },
  ],
};

const FACULTADES = [
  { key: "arte_y_diseno", label: "ARTE Y DISEÑO" },
  { key: "estudios_generales_letras", label: "ESTUDIOS GENERALES LETRAS" },
  { key: "psicologia", label: "PSICOLOGÍA" },
  { key: "ciencias_e_ingenieria", label: "CIENCIAS E INGENIERIA" },
];

/** Global: teórico + laboratorio incluidos; TALLER excluido (la trampa). */
const SEL_GLOBAL: CriterioSeleccion = { mode: "include", categories: ["teorico", "laboratorio"] };

describe("textKey — join defensivo por label", () => {
  it("normaliza tildes, mayúsculas y espacios", () => {
    expect(textKey("ARTE Y DISEÑO")).toBe(textKey("arte y diseno"));
    expect(textKey("TEÓRICO")).toBe(textKey("Teorico"));
    expect(textKey("  ESTUDIOS   GENERALES  LETRAS ")).toBe("estudios generales letras");
  });
});

describe("compilación matriz → exceptions (round-trip, cero migración)", () => {
  it("toggle en una facultad que hereda compila a op replace con el set completo", () => {
    const next = toggleTipoEnFacultad(VARIABLE, SEL_GLOBAL, "arte_y_diseno", "taller");
    expect(next.exceptions?.arte_y_diseno).toEqual({
      categories: ["teorico", "laboratorio", "taller"],
      op: "replace",
    });
    // Round-trip: la decisión leída refleja exactamente lo compilado.
    const decision = decisionFacultad(VARIABLE, next, "arte_y_diseno");
    expect(decision.decision).toBe("propia");
    expect(decision.tipos).toEqual(["teorico", "laboratorio", "taller"]);
  });

  it("toggle de apagado quita el tipo del set propio (sigue siendo propia)", () => {
    const con = toggleTipoEnFacultad(VARIABLE, SEL_GLOBAL, "arte_y_diseno", "taller");
    const sin = toggleTipoEnFacultad(VARIABLE, con, "arte_y_diseno", "taller");
    const decision = decisionFacultad(VARIABLE, sin, "arte_y_diseno");
    expect(decision.decision).toBe("propia");
    expect(decision.tipos).toEqual(["teorico", "laboratorio"]);
  });

  it("volver a heredar elimina la entrada y la facultad lee el global", () => {
    const con = toggleTipoEnFacultad(VARIABLE, SEL_GLOBAL, "arte_y_diseno", "taller");
    const back = heredarFacultad(con, "arte_y_diseno");
    expect(back.exceptions).toBeUndefined();
    const decision = decisionFacultad(VARIABLE, back, "arte_y_diseno");
    expect(decision.decision).toBe("hereda");
    expect(decision.tipos).toEqual(["teorico", "laboratorio"]);
  });

  it("no toca las excepciones de otras facultades", () => {
    const conArte = toggleTipoEnFacultad(VARIABLE, SEL_GLOBAL, "arte_y_diseno", "taller");
    const conAmbas = toggleTipoEnFacultad(VARIABLE, conArte, "psicologia", "laboratorio");
    expect(conAmbas.exceptions?.arte_y_diseno?.categories).toContain("taller");
    expect(decisionFacultad(VARIABLE, conAmbas, "psicologia").tipos).toEqual(["teorico"]);
  });
});

describe("herencia vs propia (lecturas de exceptions existentes)", () => {
  it("sin entrada hereda el global", () => {
    const d = decisionFacultad(VARIABLE, SEL_GLOBAL, "psicologia");
    expect(d).toEqual({ decision: "hereda", tipos: ["teorico", "laboratorio"] });
  });

  it("entrada legacy op add = unión con el global", () => {
    const sel: CriterioSeleccion = {
      ...SEL_GLOBAL,
      exceptions: { arte_y_diseno: { categories: ["taller"], op: "add" } },
    };
    const d = decisionFacultad(VARIABLE, sel, "arte_y_diseno");
    expect(d.decision).toBe("propia");
    expect(d.tipos).toEqual(["teorico", "laboratorio", "taller"]);
  });

  it("entrada sin op se lee como add (semántica legacy)", () => {
    const sel: CriterioSeleccion = {
      ...SEL_GLOBAL,
      exceptions: { arte_y_diseno: { categories: ["taller"] } },
    };
    expect(decisionFacultad(VARIABLE, sel, "arte_y_diseno").tipos).toContain("taller");
  });

  it("op replace es el set exacto, proyectado a claves vigentes del catálogo", () => {
    const sel: CriterioSeleccion = {
      ...SEL_GLOBAL,
      exceptions: { psicologia: { categories: ["teorico", "clave_stale_vieja"], op: "replace" } },
    };
    expect(decisionFacultad(VARIABLE, sel, "psicologia").tipos).toEqual(["teorico"]);
  });

  it("categories escalar (round-trip jsonlite) no revienta", () => {
    const sel: CriterioSeleccion = {
      ...SEL_GLOBAL,
      exceptions: { arte_y_diseno: { categories: "taller" as unknown as string[], op: "replace" } },
    };
    expect(decisionFacultad(VARIABLE, sel, "arte_y_diseno").tipos).toEqual(["taller"]);
  });
});

describe("sugerencias de la reunión — matching defensivo, nunca auto-aplicadas", () => {
  it("Arte y Diseño → incluir TALLER («son sus cursos principales»)", () => {
    const sug = sugerenciaParaFacultad(VARIABLE, "ARTE Y DISEÑO", UNIVERSITY_SESSION_TYPE_SUGERENCIAS);
    expect(sug).not.toBeNull();
    expect(sug?.modo).toBe("incluir");
    expect(sug?.tipos).toEqual(["taller"]);
    expect(sug?.labels).toEqual(["TALLER"]);
    expect(sug?.porque).toContain("talleres");
  });

  it("Gastronomía matchea la misma regla del taller", () => {
    const sug = sugerenciaParaFacultad(
      VARIABLE,
      "GASTRONOMÍA, HOTELERÍA Y TURISMO",
      UNIVERSITY_SESSION_TYPE_SUGERENCIAS,
    );
    expect(sug?.tipos).toEqual(["taller"]);
  });

  it("Psicología → solo teóricos («no los ves en laboratorio»)", () => {
    const sug = sugerenciaParaFacultad(VARIABLE, "PSICOLOGÍA", UNIVERSITY_SESSION_TYPE_SUGERENCIAS);
    expect(sug?.modo).toBe("solo");
    expect(sug?.tipos).toEqual(["teorico"]);
  });

  it("Ciencias e Ingeniería cae en la regla de ingeniería (precedencia), no en la de teóricos", () => {
    const sug = sugerenciaParaFacultad(VARIABLE, "CIENCIAS E INGENIERIA", UNIVERSITY_SESSION_TYPE_SUGERENCIAS);
    expect(sug?.modo).toBe("incluir");
    expect(sug?.tipos).toEqual(["laboratorio"]);
  });

  it("facultad sin regla → null", () => {
    expect(sugerenciaParaFacultad(VARIABLE, "DERECHO", UNIVERSITY_SESSION_TYPE_SUGERENCIAS)).toBeNull();
  });

  it("si ningún tipo recomendado existe en la base, no hay sugerencia", () => {
    const sinTaller: CriterioVariable = {
      ...VARIABLE,
      categories: (VARIABLE.categories ?? []).filter((c) => c.key !== "taller"),
    };
    expect(sugerenciaParaFacultad(sinTaller, "ARTE Y DISEÑO", UNIVERSITY_SESSION_TYPE_SUGERENCIAS)).toBeNull();
  });

  it("usar (modo incluir) suma al set vigente; usar (modo solo) lo reemplaza", () => {
    const sugArte = sugerenciaParaFacultad(VARIABLE, "ARTE Y DISEÑO", UNIVERSITY_SESSION_TYPE_SUGERENCIAS)!;
    const conArte = aplicarSugerencia(VARIABLE, SEL_GLOBAL, "arte_y_diseno", sugArte);
    expect(decisionFacultad(VARIABLE, conArte, "arte_y_diseno").tipos).toEqual([
      "teorico",
      "laboratorio",
      "taller",
    ]);

    const sugPsico = sugerenciaParaFacultad(VARIABLE, "PSICOLOGÍA", UNIVERSITY_SESSION_TYPE_SUGERENCIAS)!;
    const conPsico = aplicarSugerencia(VARIABLE, SEL_GLOBAL, "psicologia", sugPsico);
    expect(decisionFacultad(VARIABLE, conPsico, "psicologia").tipos).toEqual(["teorico"]);
  });

  it("sugerenciaAplicada distingue pendiente vs al día", () => {
    const sug = sugerenciaParaFacultad(VARIABLE, "ARTE Y DISEÑO", UNIVERSITY_SESSION_TYPE_SUGERENCIAS)!;
    expect(sugerenciaAplicada(VARIABLE, SEL_GLOBAL, "arte_y_diseno", sug)).toBe(false);
    const aplicada = aplicarSugerencia(VARIABLE, SEL_GLOBAL, "arte_y_diseno", sug);
    expect(sugerenciaAplicada(VARIABLE, aplicada, "arte_y_diseno", sug)).toBe(true);
  });
});

const IMPACTO: CalcMuestraSessionTypeImpacto = {
  schema: "cm_session_type_impacto_v1",
  tipos_excluidos: [
    {
      tipo: "TALLER",
      facultades: [
        { facultad: "ARTE Y DISEÑO", ch: 55, elegibles: 900 },
        { facultad: "ESTUDIOS GENERALES LETRAS", ch: 87, elegibles: 1240 },
      ],
      exceptuado_en: ["ARTE Y DISEÑO"],
      perdido_en: [{ facultad: "ESTUDIOS GENERALES LETRAS", ch: 87, elegibles: 1240 }],
    },
    {
      tipo: "SEMINARIO",
      facultades: [],
      exceptuado_en: [],
      perdido_en: [{ facultad: "DERECHO", ch: 0, elegibles: 0 }],
    },
  ],
};

describe("avisosImpacto — gating de la trampa del taller", () => {
  it("solo emite tipos con pérdidas reales (ch > 0)", () => {
    const avisos = avisosImpacto(IMPACTO, FACULTADES);
    expect(avisos).toHaveLength(1);
    expect(avisos[0].tipo).toBe("TALLER");
    expect(avisos[0].exceptuadoEn).toEqual(["ARTE Y DISEÑO"]);
    expect(avisos[0].perdidoEn).toEqual([
      { facultad: "ESTUDIOS GENERALES LETRAS", facKey: "estudios_generales_letras", ch: 87, elegibles: 1240 },
    ]);
  });

  it("estado sin impacto ⇒ nada (payload ausente o vacío)", () => {
    expect(avisosImpacto(null, FACULTADES)).toEqual([]);
    expect(avisosImpacto(undefined, FACULTADES)).toEqual([]);
    expect(avisosImpacto({ schema: "cm_session_type_impacto_v1", tipos_excluidos: [] }, FACULTADES)).toEqual([]);
  });

  it("facultad no resoluble conserva el aviso con facKey null", () => {
    const avisos = avisosImpacto(
      {
        schema: "cm_session_type_impacto_v1",
        tipos_excluidos: [
          {
            tipo: "TALLER",
            facultades: [],
            exceptuado_en: [],
            perdido_en: [{ facultad: "FACULTAD FANTASMA", ch: 10, elegibles: 100 }],
          },
        ],
      },
      FACULTADES,
    );
    expect(avisos[0].perdidoEn[0].facKey).toBeNull();
  });

  it("«Exceptuar también en …» agrega la excepción al borrador", () => {
    const next = exceptuarTipoEnFacultad(VARIABLE, SEL_GLOBAL, "estudios_generales_letras", "TALLER");
    expect(next.exceptions?.estudios_generales_letras).toEqual({
      categories: ["teorico", "laboratorio", "taller"],
      op: "replace",
    });
    expect(tipoActivoEnFacultad(VARIABLE, next, "estudios_generales_letras", "TALLER")).toBe(true);
  });

  it("tipo no resoluble en el catálogo deja la selección intacta", () => {
    const next = exceptuarTipoEnFacultad(VARIABLE, SEL_GLOBAL, "psicologia", "SEMINARIO");
    expect(next).toBe(SEL_GLOBAL);
  });

  it("exceptuar donde ya está activo no duplica ni cambia nada", () => {
    const con = exceptuarTipoEnFacultad(VARIABLE, SEL_GLOBAL, "arte_y_diseno", "TALLER");
    const otra = exceptuarTipoEnFacultad(VARIABLE, con, "arte_y_diseno", "TALLER");
    expect(otra).toBe(con);
  });
});

describe("senalAgrupamientoDti — gating de la señal", () => {
  it("session_type_dominante de particularidades dispara la señal", () => {
    const senal = senalAgrupamientoDti(VARIABLE, { categoria: "TEORICO", share: 0.92, total_categorias: 3 });
    expect(senal).toEqual({ origen: "particularidades", categoria: "TEORICO" });
  });

  it("categoría con paréntesis de subtipos dispara la señal desde el catálogo", () => {
    const agrupada: CriterioVariable = {
      ...VARIABLE,
      categories: [
        { key: "teorico", label: "TEORICO(TEORICO-PRACTICO,TEORICO-VIRTUAL)", aulas: 500 },
        { key: "taller", label: "TALLER", aulas: 40 },
      ],
    };
    const senal = senalAgrupamientoDti(agrupada, null);
    expect(senal?.origen).toBe("catalogo");
    expect(senal?.categoria).toBe("TEORICO(TEORICO-PRACTICO,TEORICO-VIRTUAL)");
  });

  it("sin dominante ni paréntesis no hay señal", () => {
    expect(senalAgrupamientoDti(VARIABLE, null)).toBeNull();
    expect(senalAgrupamientoDti(null, null)).toBeNull();
  });
});

const EXPLORACION: CalcMuestraAulasExploracion = {
  schema: "calc_muestra_aulas_exploracion_v1",
  totales: {
    facultades: 1,
    ch_total: 145,
    ch_elegibles: 120,
    elegibles_total: 2100,
    n_local_externo: 0,
    n_multi_facultad: 0,
  },
  por_facultad: [
    {
      facultad: "Arte y Diseño",
      ch_total: 60,
      ch_elegibles: 50,
      elegibles_total: 900,
      est_aula_mediana: 20,
      est_aula_media: 21,
      por_tipo_sesion: [
        { tipo: "Taller", ch: 55, ch_elegibles: 50, elegibles: 830, media_elegibles: 18, elegibles_min: 8, elegibles_q1: 12, mediana_elegibles: 15, elegibles_q3: 22, elegibles_max: 60 },
        { tipo: "Teórico", ch: 5, ch_elegibles: 4, elegibles: 70, media_elegibles: null, elegibles_min: null, elegibles_q1: null, mediana_elegibles: null, elegibles_q3: null, elegibles_max: null },
      ],
      por_nivel: [],
      n_multi_facultad: 0,
      n_local_externo: 0,
      n_sin_condicion: 0,
      top_cursos: [],
    },
  ],
};

describe("filasPorFacultad — joins defensivos y estado de la decisión", () => {
  it("CH del catálogo por_facultad; facultad ausente en la distribución = 0", () => {
    const filas = filasPorFacultad({ variable: VARIABLE, sel: SEL_GLOBAL, facultades: FACULTADES });
    const arte = filas.find((f) => f.facKey === "arte_y_diseno")!;
    expect(arte.tipos.find((t) => t.key === "taller")?.ch).toBe(55);
    expect(arte.tipos.find((t) => t.key === "teorico")?.ch).toBe(0);
    expect(arte.chTotal).toBe(55);
  });

  it("catálogo sin por_facultad (retro-compat) deja el CH en null y chTotal 0", () => {
    const viejo: CriterioVariable = {
      ...VARIABLE,
      categories: (VARIABLE.categories ?? []).map(({ por_facultad: _pf, ...c }) => c),
    };
    const filas = filasPorFacultad({ variable: viejo, sel: SEL_GLOBAL, facultades: FACULTADES });
    expect(filas[0].tipos.every((t) => t.ch === null)).toBe(true);
    expect(filas[0].chTotal).toBe(0);
  });

  it("elegibles del Explorador con join por label (tildes/mayúsculas no importan)", () => {
    const filas = filasPorFacultad({
      variable: VARIABLE,
      sel: SEL_GLOBAL,
      facultades: FACULTADES,
      exploracion: EXPLORACION,
    });
    const arte = filas.find((f) => f.facKey === "arte_y_diseno")!;
    expect(arte.tipos.find((t) => t.key === "taller")?.elegibles).toBe(830);
    expect(arte.tipos.find((t) => t.key === "teorico")?.elegibles).toBe(70);
    // Facultad sin fila en el Explorador: elegibles desconocidos (null).
    const psico = filas.find((f) => f.facKey === "psicologia")!;
    expect(psico.tipos.every((t) => t.elegibles === null)).toBe(true);
  });

  it("activo refleja la decisión efectiva (herencia o propia)", () => {
    const conExcepcion = toggleTipoEnFacultad(VARIABLE, SEL_GLOBAL, "arte_y_diseno", "taller");
    const filas = filasPorFacultad({ variable: VARIABLE, sel: conExcepcion, facultades: FACULTADES });
    const arte = filas.find((f) => f.facKey === "arte_y_diseno")!;
    const letras = filas.find((f) => f.facKey === "estudios_generales_letras")!;
    expect(arte.decision).toBe("propia");
    expect(arte.tipos.find((t) => t.key === "taller")?.activo).toBe(true);
    expect(letras.decision).toBe("hereda");
    expect(letras.tipos.find((t) => t.key === "taller")?.activo).toBe(false);
  });
});

describe("normalizeCalcMuestraSessionTypeImpacto — contrato cm_session_type_impacto_v1", () => {
  it("payload ausente o sin forma ⇒ null (la tarjeta se comporta como hoy)", () => {
    expect(normalizeCalcMuestraSessionTypeImpacto(null)).toBeNull();
    expect(normalizeCalcMuestraSessionTypeImpacto(undefined)).toBeNull();
    expect(normalizeCalcMuestraSessionTypeImpacto({})).toBeNull();
    expect(normalizeCalcMuestraSessionTypeImpacto("basura")).toBeNull();
  });

  it("coacciona el estilo jsonlite: arrays de 1, números como string, escalares", () => {
    const raw = {
      schema: ["cm_session_type_impacto_v1"],
      tipos_excluidos: {
        tipo: ["TALLER"],
        facultades: { facultad: ["ARTE Y DISEÑO"], ch: ["55"], elegibles: "900" },
        exceptuado_en: "ARTE Y DISEÑO",
        perdido_en: { facultad: ["ESTUDIOS GENERALES LETRAS"], ch: ["87"], elegibles: "1240" },
      },
    };
    const parsed = normalizeCalcMuestraSessionTypeImpacto(raw);
    expect(parsed?.schema).toBe("cm_session_type_impacto_v1");
    expect(parsed?.tipos_excluidos).toHaveLength(1);
    expect(parsed?.tipos_excluidos[0]).toEqual({
      tipo: "TALLER",
      facultades: [{ facultad: "ARTE Y DISEÑO", ch: 55, elegibles: 900 }],
      exceptuado_en: ["ARTE Y DISEÑO"],
      perdido_en: [{ facultad: "ESTUDIOS GENERALES LETRAS", ch: 87, elegibles: 1240 }],
    });
  });

  it("filas sin tipo o sin facultad se descartan sin romper el resto", () => {
    const parsed = normalizeCalcMuestraSessionTypeImpacto({
      schema: "cm_session_type_impacto_v1",
      tipos_excluidos: [
        { tipo: "", perdido_en: [] },
        { tipo: "TALLER", perdido_en: [{ facultad: "", ch: 5, elegibles: 10 }] },
      ],
    });
    expect(parsed?.tipos_excluidos).toHaveLength(1);
    expect(parsed?.tipos_excluidos[0].perdido_en).toEqual([]);
  });
});

describe("normalizeCriteriosCatalogo — por_facultad de la categoría", () => {
  it("parsea la distribución, coacciona números y deduplica facultades", () => {
    const catalogo = normalizeCriteriosCatalogo({
      schema: "calc_muestra_criterios_catalogo_v1",
      variables: [
        {
          id: "session_type",
          scope: "aula",
          label: "Tipo de sesión",
          kind: "flat",
          categories: [
            {
              key: "taller",
              label: "TALLER",
              aulas: 90,
              por_facultad: [
                { facultad: "ARTE Y DISEÑO", ch: ["55"] },
                { facultad: "arte y diseño", ch: 3 },
                { facultad: "", ch: 9 },
                { facultad: "ESTUDIOS GENERALES LETRAS", ch: "87" },
              ],
            },
          ],
        },
      ],
    });
    const cat = catalogo.variables[0].categories?.[0];
    expect(cat?.por_facultad).toEqual([
      { facultad: "ARTE Y DISEÑO", ch: 55 },
      { facultad: "ESTUDIOS GENERALES LETRAS", ch: 87 },
    ]);
  });

  it("catálogo sin por_facultad (retro-compat) no inventa el campo", () => {
    const catalogo = normalizeCriteriosCatalogo({
      variables: [
        {
          id: "session_type",
          scope: "aula",
          label: "Tipo",
          kind: "flat",
          categories: [{ key: "taller", label: "TALLER", aulas: 90 }],
        },
      ],
    });
    expect(catalogo.variables[0].categories?.[0].por_facultad).toBeUndefined();
  });
});
