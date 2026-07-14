/**
 * Candado del adaptador frame → PerfilInstitucional: el seam entre los
 * agregados reales del marco de aulas (backend R, schema
 * "calc_muestra_aulas_perfil_v1") y el Recorrido muestral.
 *
 * Cubre el contrato completo: mapeo fiel de embudos/facultades/cobertura,
 * caída al canon (PERFIL_EJEMPLO) cuando el frame no trae perfil utilizable,
 * y tolerancia a los payloads sucios de Plumber (escalares en arrays de 1,
 * strings numéricos, "NA", campos faltantes).
 */
import { describe, expect, it } from "vitest";
import type { CalcMuestraAulasFrame, CalcMuestraAulasPerfil } from "../../../../api/client";
import {
  coberturaDesdeFrame,
  embudoAulaDesdeFrame,
  impactoOpcionalesDesdeFrame,
  perfilActivo,
  perfilDesdeFrame,
} from "../adaptador";
import { PERFIL_EJEMPLO, PLANTILLA_UNIVERSIDAD } from "../presets";

/** Perfil realista pequeño: 2 unidades, embudos completos, cobertura medida. */
const PERFIL_BACKEND: CalcMuestraAulasPerfil = {
  schema: "calc_muestra_aulas_perfil_v1",
  universo: 12400,
  poblacion_n: 9800,
  aulas_totales: 2100,
  marco_aulas: 940,
  sexo_labels: ["femenino", "masculino"],
  embudo_alumno: [
    { id: "universo", label: "Todos los matriculados", conteo: 12400, excluidos: 0 },
    { id: "pregrado", label: "+ Pregrado", conteo: 11200, excluidos: 1200 },
    { id: "regular", label: "+ Matrícula regular", conteo: 10400, excluidos: 800 },
    { id: "mayor-edad", label: "+ Edad ≥ 18", conteo: 9800, excluidos: 600 },
  ],
  embudo_aula: [
    { id: "total", label: "Curso-horario únicos", conteo: 2100, excluidos: 0 },
    { id: "presencial", label: "+ Presencial", conteo: 1800, excluidos: 300 },
    { id: "tipo", label: "+ Tipo válido", conteo: 1500, excluidos: 300 },
    { id: "elegibles", label: "+ ≥ 10 elegibles", conteo: 940, excluidos: 560 },
  ],
  facultades: [
    {
      id: "ingenieria", nombre: "Ingeniería", n: 5200, sexo_1_n: 1900, sexo_2_n: 3300,
      est_aula_mediana: 24, est_aula_media: 26.4, alcanzables: 4800, aulas_marco: 520,
    },
    {
      id: "sociales", nombre: "Ciencias Sociales", n: 4600, sexo_1_n: 2700, sexo_2_n: 1900,
      est_aula_mediana: null, est_aula_media: null, alcanzables: 4100, aulas_marco: 420,
    },
  ],
  cobertura: { elegibles: 9800, alcanzables: 8900, pct: 0.9082 },
};

function frameCon(
  perfil: CalcMuestraAulasPerfil | null | undefined,
  extra?: Partial<CalcMuestraAulasFrame>,
): CalcMuestraAulasFrame {
  return {
    schema: "calc_muestra_aulas_frame_v1",
    generated_at: "2026-07-11 10:30:00",
    input_mode: "dos_bases",
    config: {},
    frame_hash: "abc123",
    aula_frame: [],
    audit: [],
    warnings: [],
    perfil,
    ...extra,
  };
}

describe("perfilDesdeFrame — mapeo completo del contrato", () => {
  const frame = frameCon(PERFIL_BACKEND);
  const perfil = perfilDesdeFrame({ frame, titulo: "Estudio UNSA 2026" })!;

  it("produce un perfil real identificado y fechado desde el frame", () => {
    expect(perfil).not.toBeNull();
    expect(perfil.id).toBe("estudio-real");
    expect(perfil.esEjemplo).toBe(false);
    expect(perfil.nombre).toBe("Estudio UNSA 2026");
    expect(perfil.anio).toBe(2026);
    expect(perfil.etapa).toBe("propuesta");
    expect(perfil.fuenteData).toBe("marco construido 11/07/2026");
  });

  it("toma las etiquetas de sexo medidas, capitalizadas y en orden de frecuencia", () => {
    expect(perfil.etiquetasSexo).toEqual(["Femenino", "Masculino"]);
  });

  it("con una base de un solo sexo, los conteos quedan bajo su etiqueta real", () => {
    const soloHombres = perfilDesdeFrame({
      frame: frameCon({
        ...PERFIL_BACKEND,
        sexo_labels: ["masculino"],
        facultades: [{
          id: "ingenieria", nombre: "Ingeniería", n: 5200, sexo_1_n: 5200, sexo_2_n: 0,
          est_aula_mediana: 24, est_aula_media: 26.4, alcanzables: 4800, aulas_marco: 520,
        }],
      }),
    })!;
    // El slot 1 (campo `mujeres` del diseño) porta la etiqueta medida y su conteo;
    // el slot 2 conserva la etiqueta de plantilla con conteo 0.
    expect(soloHombres.etiquetasSexo).toEqual(["Masculino", "Hombres"]);
    expect(soloHombres.facultades[0].mujeres).toBe(5200);
    expect(soloHombres.facultades[0].hombres).toBe(0);
  });

  it("mapea universo, aulas y marco tal cual llegan", () => {
    expect(perfil.universo).toBe(12400);
    expect(perfil.aulasTotales).toBe(2100);
    expect(perfil.marcoAulas).toBe(940);
  });

  it("genera los embudos con porQué en español y sin sellos del canon", () => {
    const alumno = perfil.embudoAlumno!;
    expect(alumno).toHaveLength(4);
    expect(alumno[0].porQue).toBe("Base cruda leída del proyecto.");
    expect(alumno[0].sello).toBeUndefined();
    expect(alumno[1].porQue).toContain("Excluye 1,200 estudiantes");
    expect(alumno[3].porQue).toContain("menores de 18");
    expect(alumno.map((p) => p.conteo)).toEqual([12400, 11200, 10400, 9800]);

    const aula = perfil.embudoAula!;
    expect(aula).toHaveLength(4);
    expect(aula[3].porQue).toBe("Excluye 560 cursos-horario bajo el umbral de elegibles.");
    expect(aula.map((p) => p.conteo)).toEqual([2100, 1800, 1500, 940]);
  });

  it("mapea facultades a los slots del diseño (orden de sexo_labels) con nulls de est_aula", () => {
    expect(perfil.facultades).toHaveLength(2);
    const [ing, soc] = perfil.facultades;
    expect(ing).toEqual({
      id: "ingenieria", nombre: "Ingeniería", N: 5200,
      mujeres: 1900, hombres: 3300, // slots del diseño: siguen a etiquetasSexo
      estAulaMediana: 24, estAulaMedia: 26.4, alcanzables: 4800, pExito: null,
    });
    expect(soc.estAulaMediana).toBeNull();
    expect(soc.estAulaMedia).toBeNull();
  });

  it("redacta la nota de cobertura global con la proporción medida", () => {
    expect(perfil.notas).toEqual([
      "Cobertura del cruce: 8,900 de 9,800 elegibles alcanzables (90.8%).",
    ]);
  });

  it("con dos_bases hereda el modelo de 2 bases; con base_madre declara 1 base plana", () => {
    expect(perfil.modeloDatos.bases).toBe(2);
    expect(perfil.modeloDatos.llaveCruce).toBe("curso-horario");
    const madre = perfilDesdeFrame({ frame: frameCon(PERFIL_BACKEND, { input_mode: "base_madre" }) })!;
    expect(madre.modeloDatos.bases).toBe(1);
    expect(madre.modeloDatos.llaveCruce).toBeNull();
    expect(madre.nombre).toBe("Estudio del proyecto"); // sin título → fallback
  });

  it("no comparte referencias mutables con la plantilla", () => {
    expect(perfil.parametros).not.toBe(PLANTILLA_UNIVERSIDAD.parametros);
    expect(perfil.criteriosAula).not.toBe(PLANTILLA_UNIVERSIDAD.criteriosAula);
    expect(perfil.escenario2).not.toBe(PLANTILLA_UNIVERSIDAD.escenario2);
    expect(perfil.parametros).toEqual(PLANTILLA_UNIVERSIDAD.parametros);
  });
});

describe("perfilDesdeFrame — caída al canon", () => {
  it("frame ausente o sin perfil devuelve null", () => {
    expect(perfilDesdeFrame({})).toBeNull();
    expect(perfilDesdeFrame({ frame: null })).toBeNull();
    expect(perfilDesdeFrame({ frame: frameCon(null) })).toBeNull();
    expect(perfilDesdeFrame({ frame: frameCon(undefined) })).toBeNull();
  });

  it("schema desconocido devuelve null", () => {
    const otro = { ...PERFIL_BACKEND, schema: "calc_muestra_aulas_perfil_v9" };
    expect(perfilDesdeFrame({ frame: frameCon(otro) })).toBeNull();
  });

  it("población no positiva devuelve null", () => {
    expect(perfilDesdeFrame({ frame: frameCon({ ...PERFIL_BACKEND, poblacion_n: 0 }) })).toBeNull();
    expect(perfilDesdeFrame({ frame: frameCon({ ...PERFIL_BACKEND, poblacion_n: -5 }) })).toBeNull();
  });

  it("perfilActivo cae a PERFIL_EJEMPLO con esReal false", () => {
    const caido = perfilActivo({ frame: frameCon(null) });
    expect(caido.esReal).toBe(false);
    expect(caido.perfil).toBe(PERFIL_EJEMPLO);
    expect(caido.perfil.esEjemplo).toBe(true);
  });

  it("perfilActivo entrega el perfil real cuando el frame lo trae", () => {
    const activo = perfilActivo({ frame: frameCon(PERFIL_BACKEND), titulo: "Real" });
    expect(activo.esReal).toBe(true);
    expect(activo.perfil.id).toBe("estudio-real");
    expect(activo.perfil.nombre).toBe("Real");
  });
});

describe("perfilDesdeFrame — payload sucio a la Plumber", () => {
  // Escalares en arrays de 1, strings numéricos, "NA", campos faltantes,
  // objeto envuelto en array: todo lo que un serializer de R puede producir.
  const sucio = {
    schema: ["calc_muestra_aulas_perfil_v1"],
    universo: ["12400"],
    poblacion_n: [9800],
    aulas_totales: "2100",
    marco_aulas: [null],
    sexo_labels: "femenino", // un solo valor → reemplaza SU slot; el otro queda de plantilla
    embudo_alumno: [
      { id: ["universo"], label: ["Todos"], conteo: ["12400"], excluidos: [0] },
      { id: "pregrado", conteo: "11200", excluidos: "1200" }, // sin label → usa el id
      { label: "roto", conteo: "NA" }, // sin conteo → se descarta
    ],
    embudo_aula: undefined,
    facultades: [
      { nombre: ["Ingeniería"], n: "5200", sexo_1_n: null, est_aula_mediana: "NA", alcanzables: [4800] },
      {}, // sin nombre ni id → se descarta
    ],
    cobertura: [{ elegibles: ["9800"], alcanzables: "8900", pct: [0.9082] }],
  } as unknown as CalcMuestraAulasPerfil;

  const perfil = perfilDesdeFrame({ frame: frameCon(sucio) })!;

  it("no revienta y coacciona los escalares envueltos y con string", () => {
    expect(perfil).not.toBeNull();
    expect(perfil.universo).toBe(12400);
    expect(perfil.aulasTotales).toBe(2100);
    expect(perfil.marcoAulas).toBeNull();
    expect(perfil.etiquetasSexo).toEqual(["Femenino", "Hombres"]); // slot 1 medido, slot 2 de plantilla
  });

  it("descarta pasos y facultades irrecuperables sin perder el resto", () => {
    const alumno = perfil.embudoAlumno!;
    expect(alumno).toHaveLength(2);
    expect(alumno[1].id).toBe("pregrado");
    expect(alumno[1].label).toBe("pregrado");
    expect(alumno[1].porQue).toContain("1,200");
    expect(perfil.embudoAula).toBeNull();

    expect(perfil.facultades).toHaveLength(1);
    const [f] = perfil.facultades;
    expect(f.id).toBe("ingenieria"); // slug generado desde el nombre
    expect(f.N).toBe(5200);
    expect(f.mujeres).toBe(0);
    expect(f.estAulaMediana).toBeNull();
    expect(f.alcanzables).toBe(4800);
  });

  it("lee la cobertura aunque llegue envuelta en un array", () => {
    expect(perfil.notas).toEqual([
      "Cobertura del cruce: 8,900 de 9,800 elegibles alcanzables (90.8%).",
    ]);
  });
});

describe("perfilDesdeFrame — criterios opcionales medidos y pasos nuevos del embudo", () => {
  /** Extensión aditiva del perfil: embudo completo (sede/docente/nivel/c7) + opcionales medidos. */
  const PERFIL_CON_OPCIONALES: CalcMuestraAulasPerfil = {
    ...PERFIL_BACKEND,
    marco_aulas: 700,
    marco_base_aulas: 940,
    embudo_aula: [
      { id: "total", label: "Curso-horario únicos", conteo: 2100, excluidos: 0 },
      { id: "presencial", label: "+ Presencial", conteo: 1800, excluidos: 300 },
      { id: "tipo", label: "+ Tipo válido", conteo: 1500, excluidos: 300 },
      { id: "sede", label: "+ Sede", conteo: 1400, excluidos: 100 },
      { id: "elegibles", label: "+ ≥ 10 elegibles", conteo: 1000, excluidos: 400 },
      { id: "docente", label: "+ Docente estable", conteo: 960, excluidos: 40 },
      { id: "nivel", label: "+ Nivel por unidad", conteo: 940, excluidos: 20 },
      { id: "c7", label: "+ Prevalencia ≥ 80%", conteo: 700, excluidos: 240 },
    ],
    opcionales: {
      c7: { id: "c7", aplicado: true, umbral: 0.8, aulas: 700, cobertura_pct: 0.84, unidades_rotas: [] },
      c8: { id: "c8", aplicado: false, umbral: 0.8, aulas: 310, cobertura_pct: 0.42, unidades_rotas: ["Educación"] },
    },
  };

  it("puebla impactoActivar de c7/c8 desde crudo.opcionales", () => {
    const perfil = perfilDesdeFrame({ frame: frameCon(PERFIL_CON_OPCIONALES) })!;
    const c7 = perfil.criteriosAula.find((c) => c.id === "c7")!;
    const c8 = perfil.criteriosAula.find((c) => c.id === "c8")!;
    expect(c7.impactoActivar).toEqual({ aulas: 700, coberturaPct: 0.84, facultadesRotas: [] });
    expect(c8.impactoActivar).toEqual({ aulas: 310, coberturaPct: 0.42, facultadesRotas: ["Educación"] });
  });

  it("tolera la ausencia de opcionales (frames viejos): criterios sin impacto", () => {
    const perfil = perfilDesdeFrame({ frame: frameCon(PERFIL_BACKEND) })!;
    expect(perfil.criteriosAula.find((c) => c.id === "c7")!.impactoActivar).toBeUndefined();
    expect(perfil.criteriosAula.find((c) => c.id === "c8")!.impactoActivar).toBeUndefined();
  });

  it("redacta el porqué de los pasos nuevos (sede/docente/nivel/c7)", () => {
    const perfil = perfilDesdeFrame({ frame: frameCon(PERFIL_CON_OPCIONALES) })!;
    const porId = new Map(perfil.embudoAula!.map((p) => [p.id, p.porQue]));
    expect(porId.get("sede")).toBe("Excluye 100 cursos-horario fuera de las sedes definidas para el operativo.");
    expect(porId.get("docente")).toContain("docente de tipo aceptado");
    expect(porId.get("nivel")).toContain("rango de nivel");
    expect(porId.get("c7")).toContain("prevalencia");
    expect(perfil.embudoAula!.at(-1)!.conteo).toBe(700); // último paso == marco_aulas
  });

  it("coacciona un payload sucio de opcionales (escalares envueltos, strings numéricos)", () => {
    const sucio = {
      ...PERFIL_CON_OPCIONALES,
      opcionales: [{
        c7: [{ id: ["c7"], aplicado: [true], umbral: "0.8", aulas: ["700"], cobertura_pct: "0.84", unidades_rotas: "Educación" }],
        c8: { aulas: "NA", cobertura_pct: 0.42 }, // aulas irrecuperable → se descarta
      }],
    } as unknown as CalcMuestraAulasPerfil;
    const perfil = perfilDesdeFrame({ frame: frameCon(sucio) })!;
    const c7 = perfil.criteriosAula.find((c) => c.id === "c7")!;
    expect(c7.impactoActivar).toEqual({ aulas: 700, coberturaPct: 0.84, facultadesRotas: ["Educación"] });
    expect(perfil.criteriosAula.find((c) => c.id === "c8")!.impactoActivar).toBeUndefined();
  });
});

describe("helpers del frame para datosProyecto", () => {
  it("embudoAulaDesdeFrame entrega el embudo real y null sin perfil utilizable", () => {
    const pasos = embudoAulaDesdeFrame(frameCon(PERFIL_BACKEND))!;
    expect(pasos.map((p) => p.conteo)).toEqual([2100, 1800, 1500, 940]);
    expect(embudoAulaDesdeFrame(null)).toBeNull();
    expect(embudoAulaDesdeFrame(frameCon(null))).toBeNull();
    expect(embudoAulaDesdeFrame(frameCon({ ...PERFIL_BACKEND, poblacion_n: 0 }))).toBeNull();
  });

  it("impactoOpcionalesDesdeFrame indexa por id y tolera la ausencia", () => {
    const conOpcionales: CalcMuestraAulasPerfil = {
      ...PERFIL_BACKEND,
      opcionales: {
        c7: { id: "c7", aplicado: false, umbral: 0.8, aulas: 700, cobertura_pct: 0.84, unidades_rotas: [] },
      },
    };
    const impactos = impactoOpcionalesDesdeFrame(frameCon(conOpcionales))!;
    expect(Object.keys(impactos)).toEqual(["c7"]);
    expect(impactos.c7).toEqual({ aulas: 700, coberturaPct: 0.84, facultadesRotas: [] });
    expect(impactoOpcionalesDesdeFrame(frameCon(PERFIL_BACKEND))).toBeNull(); // frame viejo
    expect(impactoOpcionalesDesdeFrame(null)).toBeNull();
  });
});

describe("coberturaDesdeFrame", () => {
  it("deriva las filas por facultad con pct a 4 decimales y campos del recorrido en neutro", () => {
    const filas = coberturaDesdeFrame(frameCon(PERFIL_BACKEND));
    expect(filas).toHaveLength(2);
    expect(filas[0]).toEqual({
      facultadId: "ingenieria", nombre: "Ingeniería",
      elegibles: 5200, alcanzables: 4800, pct: 0.9231,
      sobremuestra: 0, factible: null,
    });
    expect(filas[1].pct).toBe(0.8913); // 4100 / 4600
  });

  it("devuelve [] si el frame no trae perfil utilizable", () => {
    expect(coberturaDesdeFrame(null)).toEqual([]);
    expect(coberturaDesdeFrame(undefined)).toEqual([]);
    expect(coberturaDesdeFrame(frameCon(null))).toEqual([]);
    expect(coberturaDesdeFrame(frameCon({ ...PERFIL_BACKEND, poblacion_n: 0 }))).toEqual([]);
  });
});
