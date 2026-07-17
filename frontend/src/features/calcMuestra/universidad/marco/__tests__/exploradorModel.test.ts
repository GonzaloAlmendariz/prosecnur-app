import { describe, expect, it } from "vitest";
import {
  normalizeCalcMuestraAulasExploracion,
  type CalcMuestraAulasExploracionFacultad,
  type CalcMuestraAulasExploracionTipoSesion,
  type CalcMuestraAulasParticularidades,
} from "../../../../../api/client";
import {
  EXPLORADOR_SORT_DEFAULT,
  boxplotPosiciones,
  condicionResumen,
  contrasteSeleccion,
  cursoRowsDesdeAulaFrame,
  cursoRowsDesdeExploracion,
  elegiblesEfectivos,
  escalaMaxElegibles,
  filtrarFacultades,
  formulaEfectivos,
  nivelDistribucion,
  ordenarCursos,
  shareSinCondicion,
  tipoSesionShares,
  toggleCursoSort,
  type ExploradorCursoRow,
} from "../exploradorModel";

function facultad(overrides: Partial<CalcMuestraAulasExploracionFacultad> = {}): CalcMuestraAulasExploracionFacultad {
  return {
    facultad: "PSICOLOGÍA",
    ch_total: 120,
    ch_elegibles: 96,
    elegibles_total: 2900,
    est_aula_mediana: 28,
    est_aula_media: 30.4,
    por_tipo_sesion: [],
    por_nivel: [],
    por_condicion: [],
    n_multi_facultad: 0,
    n_local_externo: 0,
    n_sin_condicion: 0,
    top_cursos: [],
    ...overrides,
  };
}

function tipoSesion(
  overrides: Partial<CalcMuestraAulasExploracionTipoSesion> = {},
): CalcMuestraAulasExploracionTipoSesion {
  return {
    tipo: "Teórico",
    ch: 10,
    ch_elegibles: 8,
    elegibles: 100,
    media_elegibles: null,
    elegibles_min: null,
    elegibles_q1: null,
    mediana_elegibles: null,
    elegibles_q3: null,
    elegibles_max: null,
    ...overrides,
  };
}

function curso(overrides: Partial<ExploradorCursoRow> = {}): ExploradorCursoRow {
  return {
    id: "CH-1",
    curso: "Curso",
    nivel: "3",
    tipo: "Teórico",
    elegibles: 40,
    share: 0.9,
    efectivos: 36,
    localExterno: false,
    multiFacultad: false,
    ...overrides,
  };
}

describe("elegiblesEfectivos — derivación transparente", () => {
  it("redondea elegibles × share", () => {
    expect(elegiblesEfectivos(34, 0.88)).toBe(30);
    expect(elegiblesEfectivos(25, 0.5)).toBe(13);
  });

  it("sin share medido no inventa un valor: null", () => {
    expect(elegiblesEfectivos(34, null)).toBeNull();
    expect(elegiblesEfectivos(34, Number.NaN)).toBeNull();
  });

  it("acota share a 0..1 y elegibles no positivos a 0", () => {
    expect(elegiblesEfectivos(40, 1.7)).toBe(40);
    expect(elegiblesEfectivos(40, -0.2)).toBe(0);
    expect(elegiblesEfectivos(0, 0.9)).toBe(0);
  });

  it("la fórmula literal muestra los tres números", () => {
    const formula = formulaEfectivos(34, 0.88);
    expect(formula).toContain("34");
    expect(formula).toContain("88%");
    expect(formula).toContain("30");
  });

  it("la fórmula sin share lo dice en claro", () => {
    expect(formulaEfectivos(34, null)).toContain("Sin % misma facultad");
  });
});

describe("ordenarCursos — columnas ordenables, sin ranking opaco", () => {
  const rows = [
    curso({ id: "a", curso: "Álgebra", elegibles: 20, share: 0.5, efectivos: 10 }),
    curso({ id: "b", curso: "Botánica", elegibles: 45, share: null, efectivos: null }),
    curso({ id: "c", curso: "Cálculo", elegibles: 30, share: 1, efectivos: 30 }),
  ];

  it("default: elegibles desc", () => {
    expect(ordenarCursos(rows, EXPLORADOR_SORT_DEFAULT).map((r) => r.id)).toEqual(["b", "c", "a"]);
  });

  it("sin dato (null) siempre al final, en ambas direcciones", () => {
    expect(ordenarCursos(rows, { key: "efectivos", dir: "desc" }).map((r) => r.id)).toEqual(["c", "a", "b"]);
    expect(ordenarCursos(rows, { key: "efectivos", dir: "asc" }).map((r) => r.id)).toEqual(["a", "c", "b"]);
  });

  it("columnas de texto ordenan alfabético es", () => {
    expect(ordenarCursos(rows, { key: "curso", dir: "asc" }).map((r) => r.curso)).toEqual([
      "Álgebra",
      "Botánica",
      "Cálculo",
    ]);
  });

  it("toggle: misma columna invierte, columna nueva arranca desc si es numérica y asc si es texto", () => {
    expect(toggleCursoSort({ key: "elegibles", dir: "desc" }, "elegibles")).toEqual({ key: "elegibles", dir: "asc" });
    expect(toggleCursoSort({ key: "elegibles", dir: "desc" }, "share")).toEqual({ key: "share", dir: "desc" });
    expect(toggleCursoSort({ key: "elegibles", dir: "desc" }, "curso")).toEqual({ key: "curso", dir: "asc" });
  });
});

describe("filtrarFacultades — buscador y orden por elegibles", () => {
  const facs = [
    facultad({ facultad: "INGENIERÍA", elegibles_total: 4100 }),
    facultad({ facultad: "PSICOLOGÍA", elegibles_total: 2900 }),
    facultad({ facultad: "ARTE Y DISEÑO", elegibles_total: 800 }),
  ];

  it("sin query ordena por elegibles_total desc", () => {
    expect(filtrarFacultades(facs, "").map((f) => f.facultad)).toEqual([
      "INGENIERÍA",
      "PSICOLOGÍA",
      "ARTE Y DISEÑO",
    ]);
  });

  it("filtra sin tildes ni mayúsculas", () => {
    expect(filtrarFacultades(facs, "psico").map((f) => f.facultad)).toEqual(["PSICOLOGÍA"]);
    expect(filtrarFacultades(facs, "ingenieria").map((f) => f.facultad)).toEqual(["INGENIERÍA"]);
  });
});

describe("tipoSesionShares — dónde están los alumnos de la facultad", () => {
  it("calcula % por tipo sobre los elegibles y ordena desc", () => {
    const fac = facultad({
      por_tipo_sesion: [
        tipoSesion({ tipo: "Práctica", ch: 40, ch_elegibles: 26, elegibles: 600, mediana_elegibles: 14 }),
        tipoSesion({ tipo: "Teórico", ch: 80, ch_elegibles: 70, elegibles: 2300, mediana_elegibles: 32 }),
        tipoSesion({ tipo: "Laboratorio", ch: 10, ch_elegibles: 4, elegibles: 100, mediana_elegibles: null }),
      ],
    });
    const shares = tipoSesionShares(fac);
    expect(shares.map((s) => s.tipo)).toEqual(["Teórico", "Práctica", "Laboratorio"]);
    expect(shares[0].share).toBeCloseTo(2300 / 3000, 5);
    expect(shares.reduce((acc, s) => acc + s.share, 0)).toBeCloseTo(1, 5);
    // chElegibles (P2): CH que sobreviven a los criterios, por tipo.
    expect(shares[0].chElegibles).toBe(70);
  });

  it("expone la mediana por aula por tipo, con null honesto (NA del motor)", () => {
    const fac = facultad({
      por_tipo_sesion: [
        tipoSesion({ tipo: "Teórico", ch: 80, ch_elegibles: 70, elegibles: 2300, mediana_elegibles: 32 }),
        tipoSesion({ tipo: "Laboratorio", ch: 10, ch_elegibles: 4, elegibles: 100, mediana_elegibles: null }),
      ],
    });
    const shares = tipoSesionShares(fac);
    expect(shares[0].medianaElegibles).toBe(32);
    expect(shares[1].medianaElegibles).toBeNull();
  });

  it("sin maxRows trae TODAS las filas; con maxRows recorta; vacío honesto sin elegibles", () => {
    const fac = facultad({
      por_tipo_sesion: [1, 2, 3, 4, 5, 6].map((i) =>
        tipoSesion({ tipo: `T${i}`, ch: i, ch_elegibles: i, elegibles: i, mediana_elegibles: i }),
      ),
    });
    expect(tipoSesionShares(fac)).toHaveLength(6);
    expect(tipoSesionShares(fac, 4)).toHaveLength(4);
    expect(tipoSesionShares(facultad({ por_tipo_sesion: [] }))).toEqual([]);
  });

  it("nivelDistribucion: % por nivel, mediana por aula y null honesto", () => {
    const fac = facultad({
      por_nivel: [
        { nivel: "1", ch: 20, elegibles: 400, mediana_elegibles: 18 },
        { nivel: "3", ch: 30, elegibles: 600, mediana_elegibles: null },
      ],
    });
    const niveles = nivelDistribucion(fac);
    expect(niveles.map((n) => n.nivel)).toEqual(["3", "1"]);
    expect(niveles[0].share).toBeCloseTo(600 / 1000, 5);
    expect(niveles[0].medianaElegibles).toBeNull();
    expect(niveles[1].medianaElegibles).toBe(18);
    expect(nivelDistribucion(facultad({ por_nivel: [] }))).toEqual([]);
  });

  it("% sin condición sale de n_sin_condicion / ch_total", () => {
    expect(shareSinCondicion(facultad({ n_sin_condicion: 6, ch_total: 120 }))).toBeCloseTo(0.05, 5);
    expect(shareSinCondicion(facultad({ ch_total: 0 }))).toBeNull();
  });

  it("caja: construye el boxplot con los 5 números; null honesto si falta cualquiera", () => {
    const fac = facultad({
      por_tipo_sesion: [
        tipoSesion({
          tipo: "Teórico",
          elegibles: 2300,
          elegibles_min: 15,
          elegibles_q1: 20,
          mediana_elegibles: 28,
          elegibles_q3: 40,
          elegibles_max: 100,
          media_elegibles: 34.5,
        }),
        // Sin resumen (solo mediana): el motor no trae los cuartiles ⇒ caja null.
        tipoSesion({ tipo: "Laboratorio", elegibles: 100, mediana_elegibles: 12 }),
      ],
    });
    const shares = tipoSesionShares(fac);
    expect(shares[0].caja).toEqual({ min: 15, q1: 20, mediana: 28, q3: 40, max: 100, media: 34.5 });
    // Media > mediana: caso Ramiro (aulas gigantes jalan el promedio).
    expect(shares[0].caja!.media!).toBeGreaterThan(shares[0].caja!.mediana);
    expect(shares[1].caja).toBeNull();
  });
});

describe("condicionResumen — condición del curso por facultad (P1)", () => {
  it("ordena por CH desc, calcula shares y % obligatorio", () => {
    const fac = facultad({
      por_condicion: [
        { condicion: "Sin dato", ch: 5, ch_elegibles: 4, elegibles: 60 },
        { condicion: "Obligatorio", ch: 72, ch_elegibles: 60, elegibles: 1800 },
        { condicion: "Electivo", ch: 23, ch_elegibles: 10, elegibles: 200 },
      ],
    });
    const r = condicionResumen(fac);
    expect(r.segmentos.map((s) => s.condicion)).toEqual(["Obligatorio", "Electivo", "Sin dato"]);
    expect(r.obligatorioShare).toBeCloseTo(72 / 100, 5);
    expect(r.segmentos[0].share).toBeCloseTo(72 / 100, 5);
  });

  it("sin condición en el contrato ⇒ vacío honesto y obligatorioShare null", () => {
    expect(condicionResumen(facultad({ por_condicion: [] }))).toEqual({ segmentos: [], obligatorioShare: null });
  });

  it("condición presente pero sin obligatorios ⇒ share 0, no null", () => {
    const fac = facultad({ por_condicion: [{ condicion: "Electivo", ch: 10, ch_elegibles: 5, elegibles: 50 }] });
    expect(condicionResumen(fac).obligatorioShare).toBe(0);
  });
});

describe("boxplot — escala compartida y posiciones 0..1", () => {
  it("escalaMaxElegibles: máximo de los max entre tipos con caja; 0 si ninguno", () => {
    const fac = facultad({
      por_tipo_sesion: [
        tipoSesion({ tipo: "A", elegibles: 200, elegibles_min: 10, elegibles_q1: 15, mediana_elegibles: 20, elegibles_q3: 30, elegibles_max: 60 }),
        tipoSesion({ tipo: "B", elegibles: 150, elegibles_min: 12, elegibles_q1: 18, mediana_elegibles: 25, elegibles_q3: 55, elegibles_max: 120 }),
        tipoSesion({ tipo: "C", elegibles: 90, mediana_elegibles: 14 }),
      ],
    });
    expect(escalaMaxElegibles(tipoSesionShares(fac))).toBe(120);
    expect(escalaMaxElegibles(tipoSesionShares(facultad({ por_tipo_sesion: [tipoSesion({ elegibles: 5, mediana_elegibles: 3 })] })))).toBe(0);
  });

  it("boxplotPosiciones: fracciones sobre la escala, acotadas a 0..1; media null pasa como null", () => {
    const p = boxplotPosiciones({ min: 0, q1: 25, mediana: 50, q3: 75, max: 100, media: 60 }, 100);
    expect(p).toEqual({ min: 0, q1: 0.25, mediana: 0.5, q3: 0.75, max: 1, media: 0.6 });
    const sinMedia = boxplotPosiciones({ min: 10, q1: 20, mediana: 30, q3: 40, max: 50, media: null }, 100);
    expect(sinMedia.media).toBeNull();
  });
});

describe("cursoRowsDesdeAulaFrame — «ver todos» desde el marco", () => {
  const particularidades: CalcMuestraAulasParticularidades = {
    session_type_dominante: null,
    multi_facultad: [{ id: "CH-2", curso: "Generales", facultades: ["A", "B"], n_facultades: 2 }],
    codigo_z: [{ id: "CH-3", curso: "Danza", codigo: "Z-CHORRILLOS" }],
    nombre_tesis: [],
    counts: { multi_facultad: 1, codigo_z: 1, nombre_tesis: 0 },
  };
  const rows: Array<Record<string, unknown>> = [
    { classroom_id: "CH-1", course_name: "Psicología General", faculty: "PSICOLOGÍA", level: "3", session_type: "Teórico", eligible_n: 40, faculty_match_share: 0.9, included: true },
    { classroom_id: "CH-2", course_name: "Generales", faculty: "psicologia", level: "1", session_type: "Teórico", eligible_n: 60, faculty_match_share: "NA", included: true },
    { classroom_id: "CH-3", course_name: "Danza", faculty: "PSICOLOGÍA", level: "2", session_type: "Taller", eligible_n: 12, included: true },
    { classroom_id: "CH-4", course_name: "Excluido", faculty: "PSICOLOGÍA", eligible_n: 5, included: false },
    { classroom_id: "CH-5", course_name: "Otra facultad", faculty: "INGENIERÍA", eligible_n: 30, included: true },
  ];

  it("filtra por facultad (crudo o etiquetado), respeta included y cruza badges", () => {
    const out = cursoRowsDesdeAulaFrame(rows, "PSICOLOGÍA", particularidades);
    expect(out.map((r) => r.id)).toEqual(["CH-1", "CH-2", "CH-3"]);
    expect(out[0]).toMatchObject({ share: 0.9, efectivos: 36, localExterno: false, multiFacultad: false });
    // share "NA" o columna ausente ⇒ null (no se inventa 0%)
    expect(out[1]).toMatchObject({ share: null, efectivos: null, multiFacultad: true });
    expect(out[2]).toMatchObject({ share: null, localExterno: true, tipo: "Taller" });
  });

  it("usa el etiquetador cuando el marco trae códigos crudos", () => {
    const coded = [{ classroom_id: "CH-9", course_name: "X", faculty: "FAC01", eligible_n: 10 }];
    const out = cursoRowsDesdeAulaFrame(coded, "PSICOLOGÍA", null, (raw) => (raw === "FAC01" ? "PSICOLOGÍA" : raw));
    expect(out).toHaveLength(1);
    expect(cursoRowsDesdeAulaFrame(coded, "PSICOLOGÍA", null)).toHaveLength(0);
  });
});

describe("contrasteSeleccion — titulares vs CH elegibles por facultad", () => {
  const exploracion = {
    schema: "calc_muestra_aulas_exploracion_v1",
    totales: { facultades: 2, ch_total: 200, ch_elegibles: 160, elegibles_total: 7000, n_local_externo: 0, n_multi_facultad: 0 },
    por_facultad: [
      facultad({ facultad: "INGENIERÍA", elegibles_total: 4100, ch_elegibles: 64 }),
      facultad({ facultad: "PSICOLOGÍA", elegibles_total: 2900, ch_elegibles: 96 }),
    ],
  };

  it("cuenta solo titulares (sample_role o wave M1), case/tilde-insensible", () => {
    const rows: Array<Record<string, unknown>> = [
      { faculty: "psicologia", sample_role: "titular" },
      { faculty: "PSICOLOGÍA", wave: "M1" },
      { faculty: "PSICOLOGÍA", sample_role: "chain_reserve", wave: "M2" },
      { faculty: "INGENIERÍA", sample_role: "titular" },
    ];
    expect(contrasteSeleccion(rows, exploracion)).toEqual([
      { facultad: "INGENIERÍA", titulares: 1, chElegibles: 64 },
      { facultad: "PSICOLOGÍA", titulares: 2, chElegibles: 96 },
    ]);
  });

  it("sin titulares devuelve [] (la franja no se muestra)", () => {
    expect(contrasteSeleccion([], exploracion)).toEqual([]);
    expect(contrasteSeleccion([{ faculty: "PSICOLOGÍA", wave: "M2" }], exploracion)).toEqual([]);
  });
});

describe("normalizeCalcMuestraAulasExploracion — payloads jsonlite raros", () => {
  it("desempaca arrays de 1, números como string, NA como null y booleanos TRUE", () => {
    const raw = {
      schema: ["calc_muestra_aulas_exploracion_v1"],
      totales: [{ facultades: ["2"], ch_total: "320", ch_elegibles: [250], elegibles_total: "5200", n_local_externo: ["6"], n_multi_facultad: 12 }],
      por_facultad: {
        facultad: ["PSICOLOGÍA"],
        ch_total: ["120"],
        ch_elegibles: "96",
        elegibles_total: [2900],
        est_aula_mediana: ["28"],
        est_aula_media: "NA",
        por_tipo_sesion: { tipo: ["Teórico"], ch: ["80"], ch_elegibles: "70", elegibles: ["2300"], media_elegibles: ["34.5"], elegibles_min: "15", elegibles_q1: [20], mediana_elegibles: ["28"], elegibles_q3: "40", elegibles_max: [100] },
        por_nivel: [{ nivel: ["3"], ch: "40", elegibles: ["900"] }],
        n_multi_facultad: ["4"],
        n_local_externo: "0",
        n_sin_condicion: ["6"],
        top_cursos: [
          { id: ["CH-1"], curso: ["Psicología General"], nivel: ["3"], tipo: ["Teórico"], elegibles: ["80"], faculty_match_share: ["0.9"], local_externo: ["FALSE"], multi_facultad: "TRUE" },
          { id: ["CH-2"], curso: ["Danza"], nivel: "2", tipo: "Taller", elegibles: 12, faculty_match_share: "NA", local_externo: "TRUE", multi_facultad: false },
        ],
      },
    };
    const out = normalizeCalcMuestraAulasExploracion(raw);
    expect(out).not.toBeNull();
    expect(out?.totales).toEqual({ facultades: 2, ch_total: 320, ch_elegibles: 250, elegibles_total: 5200, n_local_externo: 6, n_multi_facultad: 12 });
    const fac = out?.por_facultad[0];
    expect(fac).toMatchObject({ facultad: "PSICOLOGÍA", ch_total: 120, ch_elegibles: 96, elegibles_total: 2900, est_aula_mediana: 28, est_aula_media: null, n_multi_facultad: 4 });
    expect(fac?.por_tipo_sesion).toEqual([{ tipo: "Teórico", ch: 80, ch_elegibles: 70, elegibles: 2300, media_elegibles: 34.5, elegibles_min: 15, elegibles_q1: 20, mediana_elegibles: 28, elegibles_q3: 40, elegibles_max: 100 }]);
    expect(fac?.por_nivel).toEqual([{ nivel: "3", ch: 40, elegibles: 900, mediana_elegibles: null }]);
    expect(fac?.top_cursos[0]).toMatchObject({ id: "CH-1", elegibles: 80, faculty_match_share: 0.9, local_externo: false, multi_facultad: true });
    expect(fac?.top_cursos[1]).toMatchObject({ id: "CH-2", faculty_match_share: null, local_externo: true, multi_facultad: false });
  });

  it("payload ausente o sin forma ⇒ null honesto", () => {
    expect(normalizeCalcMuestraAulasExploracion(null)).toBeNull();
    expect(normalizeCalcMuestraAulasExploracion(undefined)).toBeNull();
    expect(normalizeCalcMuestraAulasExploracion("nada")).toBeNull();
    expect(normalizeCalcMuestraAulasExploracion({})).toBeNull();
    expect(normalizeCalcMuestraAulasExploracion({ totales: { ch_total: 0 } })).toBeNull();
  });

  it("con schema pero sin facultades devuelve el objeto (marco vacío legítimo)", () => {
    const out = normalizeCalcMuestraAulasExploracion({ schema: "calc_muestra_aulas_exploracion_v1" });
    expect(out?.por_facultad).toEqual([]);
    expect(out?.totales.facultades).toBe(0);
  });

  it("clampa share fuera de rango y descarta cursos sin id ni nombre", () => {
    const out = normalizeCalcMuestraAulasExploracion({
      schema: "x",
      por_facultad: [{
        facultad: "A",
        top_cursos: [
          { id: "c1", curso: "C1", elegibles: 10, faculty_match_share: 1.4 },
          { elegibles: 99 },
        ],
      }],
    });
    expect(out?.por_facultad[0].top_cursos).toHaveLength(1);
    expect(out?.por_facultad[0].top_cursos[0].faculty_match_share).toBe(1);
  });
});

describe("cursoRowsDesdeExploracion — filas del top del contrato", () => {
  it("deriva efectivos por fila", () => {
    const fac = facultad({
      top_cursos: [
        { id: "CH-1", curso: "A", nivel: "1", tipo: "Teórico", elegibles: 34, faculty_match_share: 0.88, local_externo: false, multi_facultad: true },
      ],
    });
    expect(cursoRowsDesdeExploracion(fac)[0]).toMatchObject({ efectivos: 30, multiFacultad: true });
  });
});
