import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type {
  CalcMuestraAulasState,
  CalcMuestraEstudio,
  CalcMuestraWorkspace,
} from "../../../../../api/client";
import { ResumenDiseno } from "../../../motor/ResumenDiseno";
import type { MotorEfectivo } from "../../../motor/usePerfilEfectivo";
import { CursosHorarioMarcoTab } from "../../marco/CursosHorarioMarcoTab";
import { frameIntegrity } from "../../shared/frameIntegrity";
import { CriteriosMarcoTab } from "../CriteriosMarcoTab";

const workspace = {
  version: 2,
  frame_mode: "sin_definir",
  marco_disponible: "",
  fuente_marco: "",
  unidad_observacion: "estudiante",
  unidad_muestreo: "curso-horario",
  variables_control: [],
  escenarios: [],
  notas_diseno: "",
  aulas_config: { criterios_seleccion: { byVariable: {} } },
} as unknown as CalcMuestraWorkspace;

/** Payload legacy contradictorio: el frame ejecutado y su auditoría dicen 95,
 * pero la radiografía serializada afirma 96. La UI no debe mezclar snapshots. */
const aulasState = {
  frame: {
    schema: "calc_muestra_aulas_frame_v1",
    generated_at: "2026-08-01T00:00:00Z",
    input_mode: "base_madre",
    config: {},
    frame_hash: "legacy-contradictorio-95-vs-96",
    aula_frame: Array.from({ length: 95 }, (_, index) => ({
      classroom_id: `CH-${index + 1}`,
      included: true,
      eligible_n: 30,
    })),
    audit: [{ metric: "classroom_included_n", value: 95 }],
    warnings: [],
    criterios_seleccion: { byVariable: {} },
    criterios_catalogo: { variables: [] },
    perfil: {
      schema: "calc_muestra_aulas_perfil_v1",
      universo: 3_000,
      poblacion_n: 2_850,
      aulas_totales: 120,
      marco_aulas: 95,
      sexo_labels: [],
      embudo_alumno: [],
      embudo_aula: [],
      facultades: [],
      cobertura: { elegibles: 2_850, alcanzables: 2_850, pct: 1 },
    },
    exploracion: {
      schema: "calc_muestra_aulas_exploracion_v1",
      totales: {
        facultades: 1,
        ch_total: 120,
        ch_elegibles: 96,
        elegibles_total: 2_880,
        n_local_externo: 0,
        n_multi_facultad: 0,
      },
      por_facultad: [],
    },
  },
} as unknown as CalcMuestraAulasState;

function renderCriterios(state: CalcMuestraAulasState = aulasState) {
  return renderToStaticMarkup(
    <CriteriosMarcoTab
      workspace={workspace}
      aulasState={state}
      facultades={[]}
      onWorkspace={() => {}}
      onReconstruir={() => {}}
      puedeReconstruir
      scope="alumno"
    />,
  );
}

const estudio = {
  version: 1,
  id: "legacy-contradictorio",
  titulo: "Marco legacy contradictorio",
  fecha_creacion: "2026-08-01T00:00:00Z",
  modo_trabajo: "estimacion_preliminar",
  macro_familia: "estudio_propio",
  modo_sensible: false,
  contexto: { cliente: "", tipo_cliente: "", descripcion_libre: "" },
  componentes: [],
} as unknown as CalcMuestraEstudio;

const motor = {
  perfil: { nombre: "Marco legacy contradictorio", esEjemplo: false },
  usaProyecto: true,
  hayDatosProyecto: true,
  marcaFuente: "Proyecto activo",
  tocado: false,
} as unknown as MotorEfectivo;

function cursosHorarioMetric(html: string): string {
  const label = "<small>Cursos-horario elegibles</small>";
  const labelIndex = html.indexOf(label);
  if (labelIndex < 0) return "";
  const start = html.lastIndexOf('<div class="rec-resumen-item"', labelIndex);
  const end = html.indexOf("</div>", labelIndex);
  return start >= 0 && end >= 0 ? html.slice(start, end + "</div>".length) : "";
}

describe("consistencia del marco ejecutado frente a radiografía legacy", () => {
  it("pide reconstruir cuando la radiografía no corresponde al frame", () => {
    expect(renderCriterios()).toMatch(
      /La radiografía no corresponde al marco ejecutado[\s\S]*[Rr]econstruye/,
    );
  });

  it("no calcula un promedio con el denominador contradictorio", () => {
    expect(renderCriterios()).not.toContain("Promedio por curso-horario");
  });

  it("el resumen no acredita el conteo contradictorio como marco vigente", () => {
    const html = renderToStaticMarkup(
      <ResumenDiseno
        motor={motor}
        estudio={estudio}
        workspace={workspace}
        aulasState={aulasState}
      />,
    );
    const metric = cursosHorarioMetric(html);

    expect(metric).toContain("Cursos-horario elegibles");
    expect(metric).toMatch(/reconstruye|>—</);
    expect(metric).not.toContain("marco vigente");
  });
});

type AulasFrame = NonNullable<CalcMuestraAulasState["frame"]>;

const criteriosCatalogoIntegrado = {
  schema: "calc_muestra_criterios_catalogo_v1",
  variables: [
    {
      id: "session_type",
      scope: "aula",
      label: "Tipo de sesión",
      kind: "flat",
      mappedColumn: "Tipo de curso",
      categories: [
        {
          key: "teorico",
          label: "Teórico",
          aulas: 2,
          por_facultad: [{ facultad: "PSICOLOGÍA", ch: 2 }],
        },
      ],
    },
  ],
};

const exploracionCoherente = {
  schema: "calc_muestra_aulas_exploracion_v1",
  totales: {
    facultades: 1,
    ch_total: 3,
    ch_elegibles: 2,
    elegibles_total: 150,
    n_local_externo: 0,
    n_multi_facultad: 0,
  },
  por_facultad: [
    {
      facultad: "PSICOLOGÍA",
      ch_total: 3,
      ch_elegibles: 2,
      elegibles_total: 150,
      est_aula_mediana: 75,
      est_aula_media: 75,
      por_tipo_sesion: [
        {
          tipo: "Teórico",
          ch: 3,
          ch_elegibles: 2,
          elegibles: 150,
          media_elegibles: 75,
          elegibles_min: 70,
          elegibles_q1: 72.5,
          mediana_elegibles: 75,
          elegibles_q3: 77.5,
          elegibles_max: 80,
        },
      ],
      por_nivel: [],
      por_condicion: [],
      n_multi_facultad: 0,
      n_local_externo: 0,
      n_sin_condicion: 0,
      top_cursos: [
        {
          id: "CH-1",
          curso: "Psicología General",
          nivel: "3",
          tipo: "Teórico",
          elegibles: 80,
          faculty_match_share: 1,
          local_externo: false,
          multi_facultad: false,
        },
      ],
    },
  ],
};

const perfilCoherente = {
  schema: "calc_muestra_aulas_perfil_v1",
  universo: 180,
  poblacion_n: 150,
  aulas_totales: 3,
  marco_aulas: 2,
  sexo_labels: [],
  embudo_alumno: [],
  embudo_aula: [],
  facultades: [],
  cobertura: { elegibles: 150, alcanzables: 150, pct: 1 },
};

function integrityFrame(overrides: Record<string, unknown> = {}): AulasFrame {
  return {
    schema: "calc_muestra_aulas_frame_v1",
    generated_at: "2026-08-01T00:00:00Z",
    input_mode: "base_madre",
    config: {},
    frame_hash: "integridad-frame",
    aula_frame: [
      {
        classroom_id: "CH-1",
        course_name: "Psicología General",
        faculty: "PSICOLOGÍA",
        session_type: "Teórico",
        eligible_n: 80,
        included: true,
      },
      {
        classroom_id: "CH-2",
        course_name: "Psicometría",
        faculty: "PSICOLOGÍA",
        session_type: "Teórico",
        eligible_n: 70,
        included: true,
      },
      {
        classroom_id: "CH-3",
        course_name: "Práctica",
        faculty: "PSICOLOGÍA",
        session_type: "Teórico",
        eligible_n: 5,
        included: false,
      },
    ],
    audit: [{ metric: "classroom_included_n", value: 2 }],
    warnings: [],
    criterios_catalogo: criteriosCatalogoIntegrado,
    perfil: perfilCoherente,
    exploracion: exploracionCoherente,
    ...overrides,
  } as unknown as AulasFrame;
}

function integrityState(overrides: Record<string, unknown> = {}): CalcMuestraAulasState {
  return { frame: integrityFrame(overrides) } as unknown as CalcMuestraAulasState;
}

const auditShapes: Array<[string, unknown]> = [
  [
    "array de filas",
    [
      { metric: "classroom_n", value: 3 },
      { metric: "classroom_included_n", value: 2 },
    ],
  ],
  [
    "objeto de arrays",
    {
      metric: ["classroom_n", "classroom_included_n"],
      value: [3, 2],
    },
  ],
  ["singleton", { metric: "classroom_included_n", value: "2" }],
];

describe("frameIntegrity — owner y proyecciones serializadas", () => {
  it.each(auditShapes)("normaliza audit como %s", (_shape, audit) => {
    const result = frameIntegrity(integrityFrame({ audit }));

    expect(result.projections.audit).toBe(2);
    expect(result.status).toBe("consistent");
    expect(result.marcoAulas).toBe(2);
  });

  it("conserva un cero presente como conteo acreditable", () => {
    const result = frameIntegrity(integrityFrame({
      aula_frame: [],
      audit: { metric: ["classroom_included_n"], value: [0] },
      perfil: { ...perfilCoherente, marco_aulas: 0 },
      exploracion: {
        ...exploracionCoherente,
        totales: { ...exploracionCoherente.totales, ch_elegibles: 0 },
        por_facultad: [],
      },
    }));

    expect(result.projections.audit).toBe(0);
    expect(result.status).toBe("consistent");
    expect(result.marcoAulas).toBe(0);
  });

  it("queda unverifiable y no acredita conteo sin aula_frame.included", () => {
    const result = frameIntegrity(integrityFrame({
      aula_frame: [{ classroom_id: "CH-sin-flag" }],
    }));

    expect(result.status).toBe("unverifiable");
    expect(result.marcoAulas).toBeNull();
  });

  it("queda unverifiable y no acredita conteo sin exploración", () => {
    const result = frameIntegrity(integrityFrame({ exploracion: undefined }));

    expect(result.projections.exploracion).toBeNull();
    expect(result.status).toBe("unverifiable");
    expect(result.marcoAulas).toBeNull();
  });

  it("rechaza tres proyecciones iguales si contradicen al owner", () => {
    const result = frameIntegrity(integrityFrame({
      audit: [{ metric: "classroom_included_n", value: 3 }],
      perfil: { ...perfilCoherente, marco_aulas: 3 },
      exploracion: {
        ...exploracionCoherente,
        totales: { ...exploracionCoherente.totales, ch_elegibles: 3 },
      },
    }));

    expect(result.status).toBe("inconsistent");
    expect(result.marcoAulas).toBeNull();
  });

  it.each([
    ["perfil", { perfil: undefined }],
    ["audit", { audit: undefined }],
    ["perfil y audit", { perfil: undefined, audit: undefined }],
  ])("valida contra el owner cuando falta %s", (_missing, overrides) => {
    const result = frameIntegrity(integrityFrame(overrides));

    expect(result.status).toBe("consistent");
    expect(result.marcoAulas).toBe(2);
  });

  it("invalida si perfil y audit difieren aunque owner y exploración coincidan", () => {
    const result = frameIntegrity(integrityFrame({
      audit: [{ metric: "classroom_included_n", value: 3 }],
    }));

    expect(result.status).toBe("inconsistent");
    expect(result.marcoAulas).toBeNull();
  });
});

function renderCursosHorario(state: CalcMuestraAulasState): string {
  return renderToStaticMarkup(
    <CursosHorarioMarcoTab
      workspace={workspace}
      aulasState={state}
      facultades={["PSICOLOGÍA"]}
      onWorkspace={() => {}}
      onReconstruir={() => {}}
      puedeReconstruir
    />,
  );
}

describe("publicación de la radiografía según integridad", () => {
  it("un frame coherente conserva la radiografía integrada", () => {
    const state = integrityState();
    const integrada = renderCursosHorario(state);

    expect(frameIntegrity(state.frame).status).toBe("consistent");
    /*
     * G39 · La marca de «la radiografía integrada se montó» era la frase «aulas
     * candidatas», que vivía en la barra única del recorrido. Esa barra se
     * sustituyó por una por criterio con otro texto, así que la marca desapareció
     * y este caso empezó a fallar sin que nada del producto estuviera roto.
     *
     * Se cambia por el rótulo del bloque de decisión, que es lo que el caso
     * quiere comprobar de verdad. Marcar una presencia por una frase de copy la
     * ata a decisiones de redacción; el rótulo de la sección es más estable, y
     * cuando cambie será porque cambió la sección.
     */
    expect(integrada).toContain("Decisión para esta facultad");
    expect(integrada).toContain("PSICOLOGÍA");
  });

  it("un mismatch bloquea la radiografía integrada pero conserva reconstrucción", () => {
    const state = integrityState({
      exploracion: {
        ...exploracionCoherente,
        totales: { ...exploracionCoherente.totales, ch_elegibles: 3 },
      },
    });
    const html = renderCursosHorario(state);

    expect(html).toContain("Calcular población y cursos-horario elegibles");
    expect(html).not.toContain("Decisión para esta facultad");
  });

  it("la vista integrada explica el mismatch y pide reconstruir", () => {
    const state = integrityState({
      exploracion: {
        ...exploracionCoherente,
        totales: { ...exploracionCoherente.totales, ch_elegibles: 3 },
      },
    });

    expect(renderCursosHorario(state)).toMatch(
      /La radiografía no corresponde al marco ejecutado[\s\S]*[Rr]econstruye/,
    );
  });

  it("sin owner ninguna superficie publica la radiografía como canónica", () => {
    const state = integrityState({ aula_frame: [{ classroom_id: "CH-sin-flag" }] });
    const criterios = renderCriterios(state);

    expect(criterios).toMatch(/[Rr]econstruye|S\/D/);
    expect(criterios).not.toContain("Suma de matrículas elegibles");
  });
});

describe("la tarjeta de facultades excluidas, montada en la pestaña", () => {
  /**
   * Tercera vez que el montaje se escapa de la cobertura. La tarjeta se
   * alimentaba del catálogo de la variable `faculty`, que tiene
   * `scope: "alumno"`: su campo `aulas` cuenta pares alumno-aula por la
   * facultad DEL ALUMNO —sumaba 29.090 sobre un marco de 5.263 aulas— y traía
   * CONSORCIO DE UNIVERSIDADES, alumnos de otras casas que llevan cursos aquí y
   * que no es una facultad del marco. En pantalla se leía «ESTUDIOS GENERALES
   * LETRAS · 4.869 aulas» donde hay 482, y salían 18 filas para 17 facultades.
   *
   * Los tests de la tarjeta suelta no podían verlo: el mutante que devuelve
   * `facultades={facRefs}` a `facultades={facultadesMin}` COMPILA, porque
   * `FacultadMinRef` es asignable a `FacultadRef`. Sólo montando la pestaña se
   * distingue una fuente de la otra.
   */
  const CATALOGO_ENVENENADO = {
    ...aulasState,
    frame: {
      ...(aulasState as unknown as { frame: Record<string, unknown> }).frame,
      criterios_catalogo: {
        variables: [
          {
            id: "faculty",
            label: "Facultad",
            scope: "alumno",
            categories: [
              { key: "EG_LETRAS", label: "ESTUDIOS GENERALES LETRAS", aulas: 4869 },
              { key: "CONSORCIO", label: "CONSORCIO DE UNIVERSIDADES", aulas: 40 },
            ],
          },
        ],
      },
    },
  } as unknown as CalcMuestraAulasState;

  /**
   * Sólo la sección de la tarjeta. La pestaña monta ADEMÁS la tarjeta de
   * criterios de la variable `faculty`, que sí sale del catálogo de alumno y
   * etiqueta su cifra como «estudiantes en la base» —correcto ahí—. Asertar
   * sobre el HTML entero confundiría una tarjeta con la otra.
   */
  function seccionTarjeta(html: string): string {
    const i = html.indexOf('data-criterio="facultades-excluidas"');
    return i < 0 ? "" : html.slice(i, html.indexOf("</section>", i));
  }

  function pintarConMarco(): string {
    return renderToStaticMarkup(
      <CriteriosMarcoTab
        workspace={workspace}
        aulasState={CATALOGO_ENVENENADO}
        facultades={["DERECHO", "PSICOLOGÍA"]}
        onWorkspace={() => {}}
        onReconstruir={() => {}}
        puedeReconstruir
        scope="alumno"
      />,
    );
  }

  it("se monta en la pestaña que el usuario abre", () => {
    // Control imprescindible: si la tarjeta no se montara, los dos tests de
    // abajo pasarían sin medir nada. Ya ocurrió: estaba dentro del bloque de
    // criterios de aula y con `scope="alumno"` no llegaba a pintarse.
    expect(pintarConMarco()).toContain('data-criterio="facultades-excluidas"');
  });

  it("lista las facultades DEL MARCO, no las del catálogo de alumno", () => {
    const html = seccionTarjeta(pintarConMarco());
    expect(html).toContain("DERECHO");
    expect(html).toContain("PSICOLOGÍA");
    // La categoría que sólo existe en el catálogo de alumno no es una facultad
    // del marco y no debe aparecer.
    expect(html).not.toContain("CONSORCIO DE UNIVERSIDADES");
  });

  it("no publica una cifra de aulas que no puede garantizar", () => {
    // El 4.869 del catálogo no son aulas. Ninguna cifra seguida de «aulas».
    expect(pintarConMarco()).not.toMatch(/[0-9][0-9.,  ]*\s*aulas/);
  });
});
