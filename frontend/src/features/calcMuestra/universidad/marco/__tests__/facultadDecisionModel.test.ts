import { describe, expect, it } from "vitest";
import type {
  CalcMuestraAulasExploracion,
  CalcMuestraAulasExploracionFacultad,
  CriterioSeleccion,
  CriterioVariable,
  CriteriosSeleccionMarco,
} from "../../../../../api/client";
import { toggleTipoEnFacultad } from "../../criterios/tipoSesionModel";
import { setMinimoFacultad } from "../../criterios/minElegiblesModel";
import {
  facultadesBloque,
  reglaDecisionPropia,
  reglaNivelFacultad,
  resumenDecisionFacultad,
  slugFacultad,
  tieneDecisionPropia,
} from "../facultadDecisionModel";

function fac(
  facultad: string,
  elegibles_total: number,
): CalcMuestraAulasExploracionFacultad {
  return {
    facultad,
    ch_total: 100,
    ch_elegibles: 80,
    elegibles_total,
    est_aula_mediana: 25,
    est_aula_media: 27,
    por_tipo_sesion: [],
    por_nivel: [],
    por_condicion: [],
    n_multi_facultad: 0,
    n_local_externo: 0,
    n_sin_condicion: 0,
    top_cursos: [],
  };
}

const EXPLORACION = {
  schema: "calc_muestra_aulas_exploracion_v1",
  totales: {
    facultades: 3,
    ch_total: 300,
    ch_elegibles: 240,
    elegibles_total: 6000,
    n_local_externo: 0,
    n_multi_facultad: 0,
  },
  por_facultad: [
    fac("PSICOLOGÍA", 1200),
    fac("CIENCIAS E INGENIERÍA", 4000),
    fac("ARTE Y DISEÑO", 800),
  ],
} as CalcMuestraAulasExploracion;

const FAC_REFS = [
  { key: "psicologia", label: "PSICOLOGÍA" },
  { key: "ciencias_e_ingenieria", label: "CIENCIAS E INGENIERÍA" },
  { key: "arte_y_diseno", label: "ARTE Y DISEÑO" },
];

// El catálogo emite claves de facultad para el mínimo por facultad; pueden
// diferir del slug de la etiqueta pero resuelven por join de etiqueta.
const FAC_MIN = [
  { key: "fac_psico", label: "PSICOLOGÍA" },
  { key: "fac_ciencias", label: "CIENCIAS E INGENIERÍA" },
  { key: "fac_arte", label: "ARTE Y DISEÑO" },
];

const SESSION: CriterioVariable = {
  id: "session_type",
  scope: "aula",
  label: "Tipo de sesión",
  kind: "flat",
  categories: [
    { key: "teorico", label: "TEÓRICO", aulas: 200 },
    { key: "taller", label: "TALLER", aulas: 50 },
  ],
};

const CONDICION: CriterioVariable = {
  id: "condicion_curso",
  scope: "aula",
  label: "Condición del curso",
  kind: "flat",
  categories: [
    { key: "regular", label: "REGULAR", aulas: 220 },
    { key: "extraordinario", label: "EXTRAORDINARIO", aulas: 30 },
  ],
};

const SEL_GLOBAL: CriteriosSeleccionMarco = {
  byVariable: {
    session_type: { mode: "include", categories: ["teorico", "taller"] } as CriterioSeleccion,
    condicion_curso: { mode: "include", categories: ["regular", "extraordinario"] } as CriterioSeleccion,
  },
};

describe("slugFacultad", () => {
  it("normaliza tildes, mayúsculas y separadores a un slug estable", () => {
    expect(slugFacultad("CIENCIAS E INGENIERÍA")).toBe("ciencias_e_ingenieria");
    expect(slugFacultad("Arte y Diseño")).toBe("arte_y_diseno");
  });
});

describe("facultadesBloque", () => {
  it("ordena por elegibles desc y resuelve claves de excepción y de mínimo", () => {
    const bloques = facultadesBloque(EXPLORACION, FAC_REFS, FAC_MIN);
    expect(bloques.map((b) => b.facLabel)).toEqual([
      "CIENCIAS E INGENIERÍA",
      "PSICOLOGÍA",
      "ARTE Y DISEÑO",
    ]);
    const ciencias = bloques[0];
    expect(ciencias.excKey).toBe("ciencias_e_ingenieria");
    expect(ciencias.minKey).toBe("fac_ciencias");
  });

  it("cae al slug de la etiqueta cuando no hay referencia que empate", () => {
    const bloques = facultadesBloque(EXPLORACION, [], []);
    const psico = bloques.find((b) => b.facLabel === "PSICOLOGÍA");
    expect(psico?.excKey).toBe("psicologia");
    expect(psico?.minKey).toBe("psicologia");
  });

  it("sin exploración devuelve lista vacía", () => {
    expect(facultadesBloque(null, FAC_REFS, FAC_MIN)).toEqual([]);
  });
});

describe("tieneDecisionPropia / resumenDecisionFacultad", () => {
  it("sin excepciones ni mínimo propio: hereda todo (0 propias)", () => {
    const r = resumenDecisionFacultad(SEL_GLOBAL, [SESSION, CONDICION], "psicologia", "fac_psico");
    expect(r.propias).toBe(0);
    expect(r.total).toBe(3); // 2 toggle + mínimo
    expect(r.detalles.every((d) => !d.propia)).toBe(true);
    expect(r.minPropio).toBe(false);
  });

  it("la decisión por facultad compila a exceptions[facKey] y se lee como propia", () => {
    // La clave de excepción sale del propio bloque: cerramos el círculo
    // facultadesBloque → toggle → resumen.
    const [ciencias] = facultadesBloque(EXPLORACION, FAC_REFS, FAC_MIN);
    const sessionPropia = toggleTipoEnFacultad(
      SESSION,
      SEL_GLOBAL.byVariable.session_type,
      ciencias.excKey,
      "taller",
    );
    const sel: CriteriosSeleccionMarco = {
      ...SEL_GLOBAL,
      byVariable: { ...SEL_GLOBAL.byVariable, session_type: sessionPropia },
    };
    expect(sel.byVariable.session_type.exceptions?.[ciencias.excKey]).toBeTruthy();
    expect(tieneDecisionPropia(sel, "session_type", ciencias.excKey)).toBe(true);

    const r = resumenDecisionFacultad(sel, [SESSION, CONDICION], ciencias.excKey, ciencias.minKey);
    expect(r.propias).toBe(1);
    expect(r.detalles.find((d) => d.variableId === "session_type")?.propia).toBe(true);
    expect(r.detalles.find((d) => d.variableId === "condicion_curso")?.propia).toBe(false);
  });

  it("cuenta el mínimo propio de la facultad como criterio propio", () => {
    const [ciencias] = facultadesBloque(EXPLORACION, FAC_REFS, FAC_MIN);
    const conMin = setMinimoFacultad(SEL_GLOBAL, ciencias.minKey, 25, 15);
    const r = resumenDecisionFacultad(conMin, [SESSION, CONDICION], ciencias.excKey, ciencias.minKey);
    expect(r.minPropio).toBe(true);
    expect(r.propias).toBe(1);
    // La regla se dice en corto: la celda del Panorama la pinta tal cual.
    expect(r.minRegla).toBe("≥ 25");
  });
});

describe("reglas en corto para el Panorama", () => {
  // Gonzalo: «¿cómo que "propio"?» — la celda tiene que decir QUÉ decide la
  // facultad, no que decide algo.
  it("una excepción add/replace se dice con sus categorías", () => {
    const sel: CriteriosSeleccionMarco = {
      byVariable: {
        session_type: {
          mode: "include",
          categories: ["teorico"],
          exceptions: {
            derecho: { op: "add", categories: ["taller"] },
            gestion: { op: "replace", categories: ["teorico", "seminario", "laboratorio"] },
          },
        } as CriterioSeleccion,
      },
    };
    expect(reglaDecisionPropia(sel, "session_type", "derecho")).toBe("además TALLER");
    expect(reglaDecisionPropia(sel, "session_type", "gestion")).toBe("sólo TEORICO, SEMINARIO +1");
    expect(reglaDecisionPropia(sel, "session_type", "psicologia")).toBeNull();
  });

  it("el nivel dice su rango, su exención o nada, buscando por clave canónica", () => {
    const sel = {
      courseLevelRanges: {
        // Shape del motor ({min,max} + centinela) con clave de etiqueta.
        "CIENCIAS E INGENIERIA": [{ min: 0, max: 0 }, { min: 2, max: 10 }],
        "ESTUDIOS GENERALES LETRAS": [{ exenta: true }],
      },
    } as unknown as CriteriosSeleccionMarco;
    expect(reglaNivelFacultad(sel, "Ciencias e Ingeniería")).toBe("niveles 0 y 2–10");
    expect(reglaNivelFacultad(sel, "ESTUDIOS GENERALES LETRAS")).toBe("exenta");
    expect(reglaNivelFacultad(sel, "DERECHO")).toBeNull();
  });
});
