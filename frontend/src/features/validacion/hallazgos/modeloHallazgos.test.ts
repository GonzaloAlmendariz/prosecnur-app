import { describe, expect, it } from "vitest";
import { normalizarEfecto, normalizarSeguimiento } from "../../../api/validacionAuditoria";
import type { CatalogoCompleto, ReglaDelCatalogo } from "../../../api/validacionCatalogo";
import type { InstrumentoDrillResult } from "../../../api/validacion";
import { decision, itemCola, limpieza } from "../caracterizacion/escenarios";
import {
  antetituloDelCaso,
  casosDelElegido,
  partesFuera,
  avisoDeCasosNuevos,
  cabeceraDeHallazgos,
  causaEnPantalla,
  cifraDelHallazgo,
  conservadoDelPar,
  elementosDeCola,
  excluidosDeLosPares,
  filasDeRevision,
  hallazgoElegido,
  lineaDeAlcance,
  lineaDeEfecto,
  lineasDeGruposRepetidos,
  opcionesDeTratamiento,
  paresCasiIguales,
  respondidasDeSeccion,
  rotuloDeOrigen,
  rotulosDeAlcance,
  searchConCaso,
  searchSinCaso,
  sentidosDelSalto,
  siguientePorDecidir,
  tablaDeCasos,
  valorDeRespuesta,
  vistaDeCola,
  vistaDelHallazgo,
  type ParCasiIgual,
} from "./modeloHallazgos";

// Respuestas reales del motor sobre api/inst/audit_reference (base `auditoria`),
// recortadas: la cola, el detalle de la regla de Edad y su efecto previsto.
const COLA_REAL = [
  {
    ...itemCola("VR_constraint_cbe6c3cc", { nombre_regla: "\"Edad\" entre 18 y 80", tipo_regla: "constraint", n_casos: 2 }),
    clase: "inconsistencia", familia: "restriccion", familia_nombre: "Restricciones", origen_regla: "formulario",
    frase: [{ texto: "Se marca cuando " }, { pregunta: "edad", etiqueta: "Edad", tipo: "numerica" }, { texto: " está fuera del rango de " }, { valor: "18" }, { texto: " a " }, { valor: "80" }, { texto: "." }],
  },
  {
    ...itemCola("VR_constraint_26fdf9b2", { nombre_regla: "\"Puntaje de experiencia\" entre 0 y 100", tipo_regla: "constraint", n_casos: 1, variables: ["puntaje"] }),
    clase: "inconsistencia", familia: "restriccion", origen_regla: "formulario",
  },
];

const DETALLE_REAL = {
  ok: true,
  regla: {
    id: "VR_constraint_cbe6c3cc", nombre: "\"Edad\" entre 18 y 80", objetivo: null, tipo_observacion: "constraint", seccion: "identificacion",
    categoria: "Consistencia", tabla: "principal", variables: ["edad"],
    variable_roles: { target: "edad", drivers: [], compare: [], gate: [], labels: { edad: "Edad" } },
    value_labels: {}, procesamiento: null, activa: true, n_inconsistencias: 2, porcentaje: 0.0278,
  },
  uuid_col: "response_id",
  case_ids: ["AUD-009", "AUD-041"],
  casos: [{ response_id: "AUD-009", _index: 9, edad: 17 }, { response_id: "AUD-041", _index: 41, edad: 84 }],
  esperado: [
    { anomalia_tipo: "valor_invalido", subtipo: "restriccion", sujeto: "AUD-009", hecho: "respondió \"17\" en Edad", choque: "que no cumple la restricción del formulario (Edad entre 18 y 80)" },
    null,
  ],
  contexto: { fecha_respuesta: null, recopilador: null, fecha_envio: null, inicio: null, fin: null },
  contexto_por_caso: [
    { fecha_respuesta: null, recopilador: null, fecha_envio: null, duracion_min: null, n_respondidas: 21, n_preguntas: 23 },
    { fecha_respuesta: null, recopilador: null, fecha_envio: null, duracion_min: null, n_respondidas: 22, n_preguntas: 23 },
  ],
  coincide_con: null,
} as unknown as InstrumentoDrillResult;

function reglaCat(cambios: Partial<ReglaDelCatalogo>): ReglaDelCatalogo {
  return {
    id: "R", id_motor: "R", origen: "formulario", familia: "restriccion", familia_nombre: "Restricciones", nombre: "R",
    frase: [], frase_completa: true, clase: "inconsistencia", tratamiento: { accion: null, alcance: null }, activa: true,
    motivo_desactivada: null, se_puede_desactivar: true, variable_revisada: null, variables: [], tabla: "principal",
    expresion_formulario: null, direccion: null, pareja: null, estado_evaluacion: "evaluada", causa_codigo: null, causa: null,
    ultima_auditoria: null, ...cambios,
  };
}

const HOY = new Date("2026-03-03T15:00:00Z");

describe("la cola", () => {
  const data = limpieza({
    auditoria: true,
    cola: [
      ...COLA_REAL,
      itemCola("RC_002", { source_type: "custom_rule", fuente: "custom", hallazgo_kind: "caso_validar", n_casos: 4, pending: false }),
      itemCola("RC_VIEJO", { source_type: "custom_rule", fuente: "custom", n_casos: 9, pending: false }),
    ] as never,
    decisiones: [decision("D_001"), decision("D_002", { source_id: "RC_VIEJO", action_type: "exclude_cases", updated_at: "2026-02-01T10:00:00Z" })],
  });
  const elementos = elementosDeCola(data, HOY);

  it("lee nombre, clase y origen del catálogo, por el id de la regla", () => {
    const edad = elementos.find((e) => e.id === "VR_constraint_cbe6c3cc");
    expect(edad?.nombre).toBe("\"Edad\" entre 18 y 80");
    expect(edad?.origen).toBe("Restricción del formulario");
    expect(edad?.narrativa.frase.map((p) => p.tipo)).toEqual(["texto", "pregunta", "texto", "valor", "texto", "valor", "texto"]);
    // Sin campos de catálogo (motor anterior): la clase sale del kind y el origen de la cola.
    const propia = elementos.find((e) => e.id === "RC_002");
    expect(propia?.clase).toBe("caso_a_revisar");
    expect(propia?.origen).toBe("Regla propia");
  });

  it("D-F1: un hallazgo es una regla con casos; por decidir y decididos, con los de hoy al final", () => {
    const v = vistaDeCola(elementos, "por-decidir", null);
    expect(v.nPorDecidir).toBe(2);
    expect(v.nDecididos).toBe(2);
    expect(v.grupos.map((g) => [g.titulo, g.elementos.map((e) => e.id)])).toEqual([
      [null, ["VR_constraint_cbe6c3cc", "VR_constraint_26fdf9b2"]],
      ["Decididos hoy", ["RC_002"]],
    ]);
    expect(elementos.find((e) => e.id === "RC_002")?.tratamiento).toBe("Se dejó como está");
    const d = vistaDeCola(elementos, "decididos", null);
    expect(d.grupos.map((g) => g.titulo)).toEqual(["Decididos hoy", "Decididos antes"]);
  });

  it("el filtro por clase deja solo esa clase y cuenta las de la pestaña", () => {
    const v = vistaDeCola(elementos, "por-decidir", "caso_a_revisar");
    expect(v.inconsistencias).toBe(2);
    expect(v.casosARevisar).toBe(0);
    expect(v.grupos.flatMap((g) => g.elementos.map((e) => e.id))).toEqual(["RC_002"]);
  });

  it("el hallazgo abierto es el del foco o el primero por decidir; seguir pasa al siguiente", () => {
    expect(hallazgoElegido(elementos, "RC_002")?.id).toBe("RC_002");
    expect(hallazgoElegido(elementos, "NO_ESTA")?.id).toBe("VR_constraint_cbe6c3cc");
    expect(siguientePorDecidir(elementos, "VR_constraint_cbe6c3cc")?.id).toBe("VR_constraint_26fdf9b2");
    expect(siguientePorDecidir(elementos, "VR_constraint_26fdf9b2")?.id).toBe("VR_constraint_cbe6c3cc");
  });

  it("el origen de una regla del operativo o sin familia", () => {
    const n = { nombre: null, frase: [], frase_completa: true, clase: null, familia: null, familia_nombre: null, origen_regla: null, severidad: null, en_catalogo: null, id_catalogo: null, detalle: null };
    expect(rotuloDeOrigen({ ...n, origen_regla: "operativo" }, itemCola("x"))).toBe("Del operativo");
    expect(rotuloDeOrigen(n, itemCola("x", { tipo_regla: "skip" }))).toBe("Salto del formulario");
  });
});

describe("la cabecera", () => {
  it("con hallazgos: por decidir sobre el total de la cola, casos con base y reglas aplicadas", () => {
    const data = limpieza({ auditoria: true, cola: COLA_REAL as never });
    const elementos = elementosDeCola(data, HOY);
    const c = cabeceraDeHallazgos({
      data,
      cifras: { n_hallazgos: 3, n_reglas_evaluadas: 20, n_reglas_con_casos: 2, n_casos_evaluados: 72, n_encuestados_con_hallazgos: 3, n_registros_sin_encuestado: 0, por_tabla: [] },
      elementos,
      catalogo: null,
      auditando: false,
    });
    expect(c.estado).toEqual({ tono: "parcial", texto: "Por decidir" });
    expect(c.cifras.map((x) => [x.valor, x.base ?? null, x.rotulo])).toEqual([
      ["2", "2", "hallazgos por decidir"],
      ["3", "72", "casos con algún hallazgo"],
      ["20", null, "reglas aplicadas"],
    ]);
  });

  it("sin hallazgos: cero solo con reglas evaluadas; sin reglas evaluadas no hay buena noticia", () => {
    const data = limpieza({ auditoria: true, cola: [] });
    const conReglas = cabeceraDeHallazgos({
      data, elementos: [], catalogo: null, auditando: false,
      cifras: { n_hallazgos: 0, n_reglas_evaluadas: 85, n_reglas_con_casos: 0, n_casos_evaluados: 1283, n_encuestados_con_hallazgos: 0, n_registros_sin_encuestado: 0, por_tabla: [] },
    });
    expect(conReglas.estado?.texto).toBe("Sin hallazgos");
    expect(conReglas.cifras.map((x) => x.rotulo)).toEqual(["hallazgos", "casos auditados", "reglas aplicadas"]);
    const sinReglas = cabeceraDeHallazgos({
      data, elementos: [], catalogo: null, auditando: false,
      cifras: { n_hallazgos: 0, n_reglas_evaluadas: 0, n_reglas_con_casos: 0, n_casos_evaluados: 72, n_encuestados_con_hallazgos: 0, n_registros_sin_encuestado: 0, por_tabla: [] },
    });
    expect(sinReglas.estado?.texto).toBe("No hay reglas evaluadas");
    expect(sinReglas.cifras).toEqual([]);
  });

  it("sin auditar dice el hueco de los casos por auditar con su causa", () => {
    const c = cabeceraDeHallazgos({ data: limpieza({ auditoria: false }), cifras: null, elementos: [], catalogo: null, auditando: false });
    expect(c.estado?.texto).toBe("Sin auditar");
    expect(c.pendientes).toMatch(/casos por auditar/);
  });

  it("los grupos repetidos van en una línea aparte, con registros y encuestados", () => {
    expect(lineasDeGruposRepetidos({
      n_hallazgos: 40, n_reglas_evaluadas: 10, n_reglas_con_casos: 1, n_casos_evaluados: 426, n_encuestados_con_hallazgos: 35, n_registros_sin_encuestado: 0,
      por_tabla: [{ tabla: "rep_servicios", nivel: "registro", n_registros: 667, n_hallazgos: 40, n_registros_con_hallazgos: 40, n_encuestados_con_hallazgos: 35, n_registros_sin_encuestado: 0 }],
    })).toEqual(["rep_servicios (grupo repetido): 40 de 667 registros con hallazgos, en 35 casos"]);
  });
});

describe("el hallazgo abierto", () => {
  it("la tabla de casos: el id, la columna que falla con su etiqueta y el contexto por fila", () => {
    const t = tablaDeCasos(DETALLE_REAL, COLA_REAL[0] as never);
    expect(t.columnas).toEqual([{ clave: "edad", rotulo: "Edad", tipo: "falla", numerica: true }]);
    expect(t.filas.map((f) => [f.id, f.valores.edad, f.contexto?.n_respondidas])).toEqual([["AUD-009", "17", 21], ["AUD-041", "84", 22]]);
    expect(t.filas[0].esperado?.subtipo).toBe("restriccion");
  });

  it("las columnas de contexto solo si el estudio las declaró", () => {
    const conRoles = { ...DETALLE_REAL, contexto: { recopilador: { variable: "enc", etiqueta: "Encuestador", fuente: "agente_declarado" } } } as unknown as InstrumentoDrillResult;
    expect(tablaDeCasos(conRoles, null).columnas.map((c) => c.rotulo)).toEqual(["Recopilador", "Edad"]);
    expect(tablaDeCasos(conRoles, null).filas[0].valores["ctx:recopilador"]).toBe("Sin dato");
  });

  it("la vista según la regla: rango con límites, salto por familia, casi iguales por sus parejas", () => {
    const narrativa = { nombre: null, frase: [], frase_completa: true, clase: null, familia: null, familia_nombre: null, origen_regla: null, severidad: null, en_catalogo: null, id_catalogo: null, detalle: null };
    const limites = { tipo: "numero", min: "18", max: "80", inclusive_min: true, inclusive_max: true, restriccion: null };
    expect(vistaDelHallazgo({ narrativa, item: null, regla: null, limites, drill: DETALLE_REAL })).toBe("rango");
    expect(vistaDelHallazgo({ narrativa, item: null, regla: null, limites: null, drill: DETALLE_REAL })).toBe("general");
    expect(vistaDelHallazgo({ narrativa, item: null, regla: reglaCat({ familia: "salto" }), limites: null, drill: null })).toBe("salto");
    expect(vistaDelHallazgo({ narrativa, item: null, regla: null, limites: null, drill: { ...DETALLE_REAL, coincide_con: [[], []] } as unknown as InstrumentoDrillResult })).toBe("casi-iguales");
  });

  it("la cifra lleva la base de la regla; sin base no se inventa la proporción", () => {
    const r = reglaCat({ ultima_auditoria: { n_casos: 2, n_base: 72, base_definicion: "que respondieron la pregunta", porcentaje: 0.0278, nivel: "caso", n_decididos: 0 } });
    expect(cifraDelHallazgo(r, 2, "casos")).toEqual({ cifra: 2, base: "de 72 que respondieron la pregunta", proporcion: 0.0278, nivel: "caso" });
    expect(cifraDelHallazgo(reglaCat({}), 2, "casos")).toBeNull();
    expect(cifraDelHallazgo(reglaCat({ ultima_auditoria: { n_casos: 0, n_base: 0, base_definicion: null, porcentaje: null, nivel: "caso", n_decididos: 0 } }), 0, "casos")).toBeNull();
  });

  it("los dos sentidos del salto, con la pareja del catálogo", () => {
    const debe = reglaCat({ id: "S1", id_motor: "S1", familia: "salto", direccion: "debe", pareja: "S2", ultima_auditoria: { n_casos: 4, n_base: 142, base_definicion: null, porcentaje: null, nivel: "caso", n_decididos: 0 } });
    const nodebe = reglaCat({ id: "S2", id_motor: "S2", familia: "salto", direccion: "nodebe", pareja: "S1", ultima_auditoria: { n_casos: 0, n_base: 36, base_definicion: null, porcentaje: null, nivel: "caso", n_decididos: 0 } });
    const cat = { reglas: [debe, nodebe] } as unknown as CatalogoCompleto;
    expect(sentidosDelSalto(cat, nodebe)?.map((s) => [s.rotulo, s.n, s.actual])).toEqual([
      ["Le correspondía y está vacía", 4, false],
      ["No le correspondía y tiene respuesta", 0, true],
    ]);
  });

  it("qué se va a revisar: reglas y activas por familia con su total; auditada, los casos", () => {
    const cat = {
      familias: [{ origen: "formulario", familia: "obligatoria", nombre: "Obligatorias", n: 14, n_activas: 12, n_sin_evaluar: 2 }, { origen: "formulario", familia: "restriccion", nombre: "Restricciones", n: 6, n_activas: 6, n_sin_evaluar: 0 }],
      reglas: [reglaCat({ familia: "restriccion", ultima_auditoria: { n_casos: 2, n_base: 72, base_definicion: null, porcentaje: null, nivel: "caso", n_decididos: 0 } })],
    } as unknown as CatalogoCompleto;
    expect(filasDeRevision(cat, "activas").total).toMatchObject({ reglas: 20, segunda: 18 });
    expect(filasDeRevision(cat, "casos").filas.map((f) => f.segunda)).toEqual([0, 2]);
  });
});

describe("respuestas casi iguales", () => {
  const drill = {
    ...DETALLE_REAL,
    case_ids: ["E1", "E2", "E3", "E4"],
    casos: [{}, {}, {}, {}],
    coincide_con: [
      [{ id_caso: "E2", similitud: 0.958, n_comparables: 24, n_coincidencias: 23 }],
      [{ id_caso: "E1", similitud: 0.958, n_comparables: 24, n_coincidencias: 23 }],
      [{ id_caso: "E4", similitud: 0.917, n_comparables: 24, n_coincidencias: 22 }],
      [{ id_caso: "E3", similitud: 0.917, n_comparables: 24, n_coincidencias: 22 }],
    ],
    contexto_por_caso: [
      { n_respondidas: 63, n_preguntas: 63, fecha_envio: "2026-11-03T10:00:00Z" },
      { n_respondidas: 47, n_preguntas: 63, fecha_envio: "2026-11-05T10:00:00Z" },
      { n_respondidas: 61, n_preguntas: 63, fecha_envio: null },
      { n_respondidas: 61, n_preguntas: 63, fecha_envio: null },
    ],
  } as unknown as InstrumentoDrillResult;
  const pares = paresCasiIguales(drill);

  it("cada par una vez, con el contexto de sus dos respuestas", () => {
    expect(pares.map((p) => p.miembros.map((m) => m.id))).toEqual([["E1", "E2"], ["E3", "E4"]]);
    expect(pares[0].miembros[1].contexto?.n_respondidas).toBe(47);
  });

  it("cuál se conserva: un empate o una fecha que falta no se resuelve sola", () => {
    expect(conservadoDelPar(pares[0], "mas-completa")).toBe("E1");
    expect(conservadoDelPar(pares[0], "mas-reciente")).toBe("E2");
    expect(conservadoDelPar(pares[0], "primera")).toBe("E1");
    expect(conservadoDelPar(pares[1], "mas-completa")).toBeNull();
    expect(excluidosDeLosPares(pares, "mas-completa")).toEqual({ excluidos: ["E2"], sinResolver: 1 });
  });

  it("las opciones de casi iguales: sin fecha no se ofrece la más reciente", () => {
    const sinFechas: ParCasiIgual[] = [pares[1]];
    const ops = opcionesDeTratamiento({ vista: "casi-iguales", etiquetaPregunta: null, prevista: null, seleccionMultiple: false, fueraDeLista: false, especial: null, pares: sinFechas });
    expect(ops.map((o) => [o.titulo, !!o.deshabilitada])).toEqual([["La más completa", true], ["La más reciente", true], ["La primera", true], ["Todas", false]]);
  });
});

describe("la decisión", () => {
  it("qué hacer, con el texto del prototipo y la prevista marcada", () => {
    const ops = opcionesDeTratamiento({ vista: "general", etiquetaPregunta: "Año de egreso", prevista: "nullify_fields", seleccionMultiple: false, fueraDeLista: false, especial: null });
    expect(ops.map((o) => [o.titulo, o.detalle, o.prevista])).toEqual([
      ["Dejar como está", "Se registra que se revisó.", false],
      ["Vaciar la respuesta", "\"Año de egreso\" queda sin dato.", true],
      ["Corregir el valor", "Escribes el valor que corresponde.", false],
      ["Excluir los casos", "Dejan de contar en la base.", false],
    ]);
    const salto = opcionesDeTratamiento({ vista: "salto", etiquetaPregunta: null, prevista: null, seleccionMultiple: true, fueraDeLista: false, especial: { codigo: "99", etiqueta: "No responde" } });
    expect(salto.map((o) => o.titulo)).toEqual(["Dejar como está", "Asignar un valor", "Corregir el valor", "Excluir los casos", "Completar opciones", "Agregar o quitar opciones"]);
    expect(salto[1].detalle).toBe("99, No responde.");
  });

  it("sobre qué casos, con el número y la concordancia", () => {
    expect(rotulosDeAlcance(7, 3, "general")).toEqual({ titulo: "Sobre qué casos", todos: "Los 7", marcados: "Los 3 marcados" });
    expect(rotulosDeAlcance(3, 1, "rango").marcados).toBe("El marcado");
    expect(rotulosDeAlcance(4, 0, "salto").marcados).toBe("Los marcados");
    expect(rotulosDeAlcance(2, 1, "casi-iguales")).toEqual({ titulo: "Sobre qué pares", todos: "Los 2", marcados: "Solo el marcado" });
  });

  it("D-F2 y D-F3: a qué casos llega, dicho antes de guardar", () => {
    expect(lineaDeAlcance({ accion: "ignore_rule", todos: true, n: 7, marcados: 0, alcance: "caso", unidad: "casos" }))
      .toBe("Cubre los casos que la regla marque, también los de una auditoría nueva.");
    expect(lineaDeAlcance({ accion: "nullify_fields", todos: true, n: 7, marcados: 0, alcance: "caso", unidad: "casos" }))
      .toBe("Se aplica a los 7 casos que la regla marca hoy; los que marque una auditoría nueva quedan por decidir.");
    expect(lineaDeAlcance({ accion: "exclude_cases", todos: false, n: 7, marcados: 1, alcance: "encuestado", unidad: "casos" }))
      .toBe("Se aplica solo al caso marcado. La regla es de un grupo repetido: sale el encuestado entero, con todos sus registros.");
  });

  it("el aviso de casos nuevos solo en una congelada con casos nuevos", () => {
    const congelada = normalizarSeguimiento({ seguimiento: "congelada", n_casos_al_decidir: 1, casos_nuevos: ["AUD-041"], casos_que_ya_no_marca: [], n_casos_aplicados: 1, alcance: "caso" });
    expect(avisoDeCasosNuevos(congelada)).toEqual({
      texto: "La última auditoría marca 1 caso que esta decisión no cubre, porque se dejó lista antes.",
      ids: ["AUD-041"],
    });
    expect(avisoDeCasosNuevos(normalizarSeguimiento({ seguimiento: "sigue_a_la_regla", casos_nuevos: null }))).toBeNull();
    expect(avisoDeCasosNuevos(normalizarSeguimiento({ seguimiento: "congelada", casos_nuevos: [] }))).toBeNull();
  });

  it("el efecto previsto en palabras, con la cifra del motor", () => {
    const vaciar = normalizarEfecto({ accion: "nullify_fields", variable: "edad", n_filas: 2, n_celdas: 2, n_casos_cuentan_antes: 72, n_casos_cuentan_despues: 72, aplicable: true });
    expect(lineaDeEfecto(vaciar, { etiquetaPregunta: "Edad" })).toEqual({ cifra: 2, texto: "valores quedan vacíos en \"Edad\". Siguen contando 72 casos." });
    const excluir = normalizarEfecto({ accion: "exclude_cases", n_filas: 2, n_celdas: 0, n_casos_cuentan_antes: 72, n_casos_cuentan_despues: 70, aplicable: true });
    expect(lineaDeEfecto(excluir, { etiquetaPregunta: null })).toEqual({ cifra: 2, texto: "casos dejan de contar. Quedan 70 de 72." });
    const ignorar = normalizarEfecto({ accion: "ignore_rule", n_casos_aplicados: 1, aplicable: true });
    expect(lineaDeEfecto(ignorar, { etiquetaPregunta: null })).toEqual({ cifra: 1, texto: "caso queda revisado. No cambia ningún valor." });
    const no = normalizarEfecto({ accion: "exclude_cases", aplicable: false, motivo_no_aplicable: "sin_casos_al_decidir" });
    expect(lineaDeEfecto(no, { etiquetaPregunta: null })).toEqual({ texto: "No se aplica: la regla no marcaba casos cuando se dio por lista." });
  });

  it("lo que falta para guardar, con los nombres de la pantalla", () => {
    expect(causaEnPantalla("Escribe una justificación para dejar la decisión lista.", "Los 7")).toBe("Escribe el motivo para guardar la decisión.");
    expect(causaEnPantalla("Selecciona al menos un caso o marca que aplica a todos.", "Los 7")).toBe("Marca al menos un caso o elige \"Los 7\".");
  });
});

describe("el caso completo y su dirección", () => {
  it("el antetítulo solo con lo que el motor publicó", () => {
    expect(antetituloDelCaso({ fecha_respuesta: null, recopilador: null, fecha_envio: null, duracion_min: null, n_respondidas: 21, n_preguntas: 23 })).toBeNull();
    expect(antetituloDelCaso({ fecha_respuesta: "2026-11-03T15:00:00", recopilador: "Correo, 1.ª invitación", fecha_envio: null, duracion_min: 14, n_respondidas: 6, n_preguntas: 6 }))
      .toBe("Correo, 1.ª invitación. Respondió el 3 nov 2026 en 14 minutos");
  });

  it("respondidas por sección y el estado de una vacía", () => {
    expect(respondidasDeSeccion({ seccion: "id", etiqueta: null, variables: [], n_preguntas: 17, n_respondidas: 16, n_vacias_por_salto: 1 })).toBe("16 de 17 respondidas");
    const base = { variable: "p10", etiqueta: null, tipo: null, valor: null, valor_etiqueta: null, opciones: [], origen: "respuesta" as const, especial: false, especial_etiqueta: null, fuera_de_opciones: null };
    expect(valorDeRespuesta({ ...base, estado: "vacia_por_salto" })).toBe("No le correspondía");
    expect(valorDeRespuesta({ ...base, estado: "vacia" })).toBe("Vacía");
    expect(valorDeRespuesta({ ...base, estado: "respondida", valor: "99", especial: true, especial_etiqueta: "No responde" })).toBe("No responde (99)");
    expect(valorDeRespuesta({ ...base, estado: "respondida", valor: "1", valor_etiqueta: "Lima" })).toBe("Lima (1)");
  });

  it("abrir el caso usa el foco para el caso; cerrarlo lo devuelve al hallazgo", () => {
    const abierto = searchConCaso("?pestana=hallazgos&foco=VR_1", "AUD-009");
    expect(new URLSearchParams(abierto).get("panel")).toBe("caso");
    expect(new URLSearchParams(abierto).get("foco")).toBe("AUD-009");
    const cerrado = searchSinCaso(abierto, "VR_1");
    expect(new URLSearchParams(cerrado).get("panel")).toBeNull();
    expect(new URLSearchParams(cerrado).get("foco")).toBe("VR_1");
  });
});

describe("ronda 2", () => {
  it("H2: el centro no muestra los casos ni el error de otra regla mientras llegan los del elegido", () => {
    const lista = { fase: "lista" as const, id: "VR_A", drill: DETALLE_REAL };
    expect(casosDelElegido(lista, "VR_A")).toBe(lista);
    expect(casosDelElegido(lista, "VR_B")).toEqual({ fase: "cargando" });
    expect(casosDelElegido({ fase: "error", id: "VR_A", mensaje: "x" }, "VR_B")).toEqual({ fase: "cargando" });
    expect(casosDelElegido(lista, null)).toEqual({ fase: "inactiva" });
  });

  it("el tramo que el límite corta se tiñe solo en la parte de afuera", () => {
    // Edad de audit_reference: tramos de 17 a 25.375 y de 75.625 a 84, límite 18 a 80.
    const bajo = partesFuera({ desde: 17, hasta: 25.375 }, 18, 80);
    expect(bajo.bajo).toBeCloseTo(1 / 8.375, 4);
    expect(bajo.sobre).toBe(0);
    expect(partesFuera({ desde: 75.625, hasta: 84 }, 18, 80).sobre).toBeCloseTo(4 / 8.375, 4);
    expect(partesFuera({ desde: 30, hasta: 40 }, 18, 80)).toEqual({ bajo: 0, sobre: 0 });
    expect(partesFuera({ desde: 90, hasta: 100 }, 18, 80)).toEqual({ bajo: 0, sobre: 1 });
    expect(partesFuera({ desde: 5, hasta: 5 }, 18, 80)).toEqual({ bajo: 0, sobre: 0 });
  });
});
