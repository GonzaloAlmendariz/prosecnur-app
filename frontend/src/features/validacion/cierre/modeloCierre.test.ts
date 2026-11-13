import { describe, expect, it } from "vitest";
import { normalizarCierre, type CierreDeLimpieza } from "../../../api/validacionCierre";
import type { AuditoriaEstado } from "../../../api/validacionAuditoria";
import type { LimpiezaQueueItem, LimpiezaSummary } from "../types";
import { decision } from "../caracterizacion/escenarios";
import { elementosDeCola } from "../hallazgos/modeloHallazgos";
import {
  avisoDeCifrasPorDecision,
  cabeceraDeCierre,
  causaDeNoCerrar,
  filasDeRegistro,
  franjaDeCasos,
  gruposDeDecisiones,
  hallazgosConDecision,
  lineaDeArchivo,
  puntosDeLista,
  sePuedeReabrir,
  selloDeLaBase,
  situacionDeLaBase,
} from "./modeloCierre";

// Cifras reales de audit_reference, base auditoria (motor M5): 72 recibidos, 2 excluidos, 70 cuentan.
const COLA = [
  { source_id: "VR_constraint_cbe6c3cc", nombre_regla: "\"Edad\" entre 18 y 80", hallazgo_kind: "inconsistencia_xlsform", pending: false, n_casos: 2, variables: ["edad"], tipo_regla: "constraint" },
  { source_id: "VR_constraint_26fdf9b2", nombre_regla: "\"Puntaje de experiencia\" entre 0 y 100", hallazgo_kind: "inconsistencia_xlsform", pending: false, n_casos: 1, variables: ["puntaje"], tipo_regla: "constraint" },
] as unknown as LimpiezaQueueItem[];

const DECISIONES = [
  { decision_id: "PD_001", source_id: "VR_constraint_cbe6c3cc", action_type: "exclude_cases", target_variable: null, rationale: "Edad fuera del rango del estudio", decidida_en: "2026-11-12T10:53:13Z", efecto: "excluye", n_filas_excluidas: 2, n_filas_ya_excluidas: 0, n_celdas_cambiadas: 0, n_casos_revisados: null, aplicable: true, motivo_no_aplicable: null },
  { decision_id: "PD_002", source_id: "VR_constraint_26fdf9b2", action_type: "nullify_fields", target_variable: "puntaje", rationale: "Puntaje imposible", decidida_en: "2026-11-12T10:53:14Z", efecto: "cambia_valores", n_filas_excluidas: 0, n_filas_ya_excluidas: 0, n_celdas_cambiadas: 1, n_casos_revisados: null, aplicable: true, motivo_no_aplicable: null },
];

function cierre(cambios: { cadena?: Record<string, unknown>; decisiones?: unknown[]; grupos?: unknown[]; totales?: Record<string, unknown>; estado?: string } = {}): CierreDeLimpieza {
  const c = normalizarCierre({
    estado: cambios.estado ?? "cerrada",
    cerrada_en: "2026-11-12T10:53:15Z",
    cadena_casos: {
      momento: "al_cerrar", recibidos: 72, n_fuentes: null,
      fuera: { retirados_fuera_de_la_app: 0, pruebas: 0, sin_clasificar: 0, por_reglas_de_carga: 0, fuera_de_la_auditoria: 0 },
      excluidos_en_limpieza: 2, cuentan: 70, proporcion: 0.9722, cuadra: true, filtro_de_pruebas: false, depuracion_externa: false, base_promovida: true, avisos: [],
      ...cambios.cadena,
    },
    decisiones_aplicadas: {
      decisiones: cambios.decisiones ?? DECISIONES,
      grupos: cambios.grupos ?? [
        { efecto: "excluye", n_decisiones: 1, cifra: 2, unidad: "casos excluidos" },
        { efecto: "cambia_valores", n_decisiones: 1, cifra: 1, unidad: "valores cambiados" },
        { efecto: "sin_cambios", n_decisiones: 0, cifra: 0, unidad: "revisiones de casos" },
        { efecto: "no_se_aplica", n_decisiones: 0, cifra: null, unidad: null },
      ],
      totales: { n_casos_excluidos: 2, n_celdas_cambiadas: 1, cuadra_con_motor: true, ...cambios.totales },
    },
    archivos: [],
  });
  if (!c) throw new Error("cierre inválido");
  return c;
}

function resumen(cambios: Partial<LimpiezaSummary> & { promocion?: Record<string, unknown>; finalizada?: boolean } = {}): LimpiezaSummary {
  const { promocion, finalizada, ...resto } = cambios;
  return {
    ok: true,
    base_nombre: "auditoria",
    progreso: { plan_construido: true, auditoria_corrida: true, n_reglas_custom: 0 },
    summary: { pendientes: 0, ready_to_finalize: true, total_casos_excluidos: 0, total_celdas_corregidas: 0 } as LimpiezaSummary["summary"],
    kpis: [], top_reglas: null, top_variables: null,
    decision_queue: COLA,
    decision_draft: [],
    module_stats: {} as LimpiezaSummary["module_stats"],
    before_after_preview: null,
    artifacts: (promocion || finalizada
      ? { finalized_at: finalizada ? "2026-11-12T10:53:15Z" : undefined, promocion, files: [] }
      : {}) as LimpiezaSummary["artifacts"],
    actions: [],
    ...resto,
  };
}

const RIGE = { enabled: true, source_data_file_id: "a", effective_data_file_id: "b", applied_at: "2026-11-12T10:53:15Z", n_casos_antes: 72, n_casos_despues: 70 };
const AUDITORIA: AuditoriaEstado = { estado: "vigente", base_nombre: "auditoria", auditada_en: "2026-11-06T15:00:00Z", n_reglas_vigentes: 20, n_reglas_auditadas: 20, cambios: { agregadas: [], quitadas: [], modificadas: [] } };

describe("situación de la base", () => {
  it("cerrada con la base limpia vigente: se reabre y no se vuelve a cerrar", () => {
    const s = situacionDeLaBase(resumen({ promocion: RIGE, finalizada: true }), cierre());
    expect(s.tipo).toBe("cerrada");
    expect(sePuedeReabrir(s)).toBe(true);
    expect(selloDeLaBase(s)).toMatchObject({ tono: "ok", detalle: "Codificación y Analítica parten de la base limpia." });
  });

  it("revertida la promoción es reabierta aunque el motor diga cerrada, y el sello dice que rige la cargada", () => {
    const d = resumen({ promocion: { ...RIGE, enabled: false, reverted_at: "2026-11-12T11:16:31Z" }, finalizada: true });
    const s = situacionDeLaBase(d, cierre());
    expect(s).toMatchObject({ tipo: "reabierta", casosCargados: 72 });
    expect(sePuedeReabrir(s)).toBe(false);
    expect(selloDeLaBase(s).detalle).toMatch(/parten de la base cargada/);
  });

  it("con bloqueo de la promoción no se ofrece reabrir y el sello dice la causa", () => {
    const bloqueo = "La base tiene grupos repetibles: excluir casos de la madre exige podar sus filas hijas.";
    const s = situacionDeLaBase(resumen({ promocion: { ...RIGE, enabled: false, bloqueo }, finalizada: true }), cierre());
    expect(s).toMatchObject({ tipo: "cerrada", bloqueo });
    expect(sePuedeReabrir(s)).toBe(false);
    expect(selloDeLaBase(s)).toMatchObject({ tono: "aviso" });
    expect(selloDeLaBase(s).detalle).toContain(bloqueo);
  });

  it("abierta con la promoción vigente: cambios sin cerrar, se puede cerrar y reabrir", () => {
    const s = situacionDeLaBase(resumen({ promocion: RIGE }), cierre({ estado: "abierta" }));
    expect(s.tipo).toBe("cambios-sin-cerrar");
    expect(sePuedeReabrir(s)).toBe(true);
  });

  it("con hallazgos por decidir no se cierra y dice cuántos quedan", () => {
    const d = resumen({ summary: { pendientes: 1, ready_to_finalize: false } as LimpiezaSummary["summary"] });
    const s = situacionDeLaBase(d, cierre({ estado: "abierta" }));
    expect(s).toEqual({ tipo: "por-decidir", pendientes: 1 });
    expect(causaDeNoCerrar(s, d)).toBe("Queda 1 hallazgo por decidir.");
  });

  it("sin auditoría no se cierra", () => {
    const d = resumen({ progreso: { plan_construido: true, auditoria_corrida: false, n_reglas_custom: 0 } });
    const s = situacionDeLaBase(d, null);
    expect(s.tipo).toBe("sin-auditar");
    expect(causaDeNoCerrar(s, d)).toBe("La base no se ha auditado.");
  });
});

describe("cifras", () => {
  it("cabecera: hallazgos decididos de la cola, valores cambiados del cierre (no de summary) y la fecha de la auditoría", () => {
    const d = resumen({ promocion: RIGE, finalizada: true });
    const c = cierre();
    const cab = cabeceraDeCierre({ data: d, cierre: c, situacion: situacionDeLaBase(d, c), auditoria: AUDITORIA });
    expect(cab.estado).toEqual({ tono: "listo", texto: "Cerrada el 12 nov" });
    expect(cab.cifras.map((x) => [x.valor, x.base ?? null, x.rotulo])).toEqual([
      ["2", "2", "hallazgos decididos"],
      ["1", null, "valor cambiado"],
      ["6 nov", null, "última auditoría"],
    ]);
  });

  it("segundo cierre: la cadena cuenta 2 excluidos y las decisiones 0; se avisa la causa y la cabecera no publica valores cambiados", () => {
    const sin = { efecto: "sin_cambios", n_filas_excluidas: 0, n_celdas_cambiadas: 0, n_casos_revisados: 2 };
    const c = cierre({
      decisiones: DECISIONES.map((x) => ({ ...x, ...sin })),
      grupos: [{ efecto: "sin_cambios", n_decisiones: 2, cifra: 3, unidad: "revisiones de casos" }],
      totales: { n_casos_excluidos: 0, n_celdas_cambiadas: 0 },
    });
    expect(avisoDeCifrasPorDecision(c)).toBe("Las cifras por decisión se midieron sobre la base ya limpia de un cierre anterior: no incluyen 2 casos excluidos que la cadena sí cuenta.");
    const d = resumen({ promocion: RIGE, finalizada: true });
    const cab = cabeceraDeCierre({ data: d, cierre: c, situacion: situacionDeLaBase(d, c), auditoria: AUDITORIA });
    expect(cab.cifras.map((x) => x.clave)).toEqual(["decididos", "auditoria"]);
    expect(cab.pendientes).toMatch(/valores cambiados: las cifras por decisión se midieron sobre la base ya limpia/);
  });

  it("con las cifras cuadradas no hay aviso", () => {
    expect(avisoDeCifrasPorDecision(cierre())).toBeNull();
  });

  it("vista previa sobre la base limpia de un cierre anterior: aviso aunque las cifras cuadren", () => {
    const c = cierre({ estado: "abierta", cadena: { momento: "prevista", excluidos_en_limpieza: 0, avisos: [{ codigo: "base_vigente_ya_limpia", texto: "La base vigente es la limpia del cierre anterior." }] }, totales: { n_casos_excluidos: 0 } });
    expect(avisoDeCifrasPorDecision(c)).toMatch(/se miden sobre la base limpia del cierre anterior/);
  });

  it("franja: recibidos, lo que queda fuera por causa, los excluidos con punto y cuentan con su porcentaje; sin fuentes", () => {
    const f = franjaDeCasos(cierre().cadena_casos, { tipo: "cerrada", cerradaEn: null, bloqueo: null, sinRespaldo: false });
    expect(f?.grupos[0].cifras).toEqual([{ id: "recibidos", cifra: 72, texto: "casos" }]);
    expect(f?.grupos[1].cifras.map((x) => [x.cifra, x.texto, x.tono ?? null])).toEqual([
      [0, "fuera de la auditoría", null],
      [2, "excluidos en limpieza", "aviso"],
    ]);
    expect([f?.cuentan, f?.nota, f?.proporcion]).toEqual([70, "97.2 %", 0.9722]);
  });

  it("franja con filtro de pruebas (acnur_pdm): 1 prueba y 3 por reglas de Carga; sin filtro no nombra pruebas", () => {
    const cadena = cierre({ cadena: { recibidos: 430, cuentan: 426, excluidos_en_limpieza: 0, filtro_de_pruebas: true, fuera: { retirados_fuera_de_la_app: 0, pruebas: 1, sin_clasificar: 0, por_reglas_de_carga: 3, fuera_de_la_auditoria: 0 } } }).cadena_casos;
    const f = franjaDeCasos(cadena, { tipo: "cerrada", cerradaEn: null, bloqueo: null, sinRespaldo: false });
    expect(f?.grupos[1].cifras.map((x) => `${x.cifra} ${x.texto}`)).toEqual(["1 prueba", "3 por reglas de Carga", "0 fuera de la auditoría", "0 excluidos en limpieza"]);
  });

  it("reabierta: la franja avisa que son las cifras del cierre y cuántos casos cuentan hoy", () => {
    const f = franjaDeCasos(cierre().cadena_casos, { tipo: "reabierta", reabiertaEn: "2026-11-12T11:16:31Z", casosCargados: 72 });
    expect(f?.avisos[0].texto).toBe("Son las cifras del cierre. La base se reabrió el 12 nov: hoy cuentan los 72 casos cargados.");
  });

  it("grupos: exclusiones primero con la cifra de la cadena, cruzados con la cola por id", () => {
    const c = cierre();
    const grupos = gruposDeDecisiones({ aplicadas: c.decisiones_aplicadas!, cadena: c.cadena_casos, elementos: [] });
    expect(grupos.map((g) => [g.titulo, g.resumen, g.filas.length])).toEqual([["Casos excluidos", "2 casos", 1], ["Valores cambiados", "1 valor", 1]]);
    expect(grupos[0].filas[0]).toMatchObject({ hallazgo: "VR_constraint_cbe6c3cc", enCola: false, tratamiento: "Excluir los casos", cifra: 2 });
  });

  // Ítem 49 (QA30b): una corrección de lugar guarda una decisión por columna y Cierre la mostraba
  // como 3 filas idénticas, sin decir qué caso ni qué columnas.
  describe("una corrección por caso y regla", () => {
    const porColumna = (id: string, columna: string) => ({
      ...DECISIONES[1], decision_id: id, source_id: "RC_007", action_type: "set_value", target_variable: columna,
      rationale: "Corregido con la propuesta del catálogo de ubigeos.", n_celdas_cambiadas: 1,
    });
    const guardada = (id: string, columna: string, casos: string[]) => ({
      id, source_type: "custom_rule", source_id: "RC_007", scope: "cell_subset", target_case_ids: casos, target_variable: columna,
      action_type: "set_value", action_params: { value: "x" }, rationale: "", status: "ready", created_at: "", updated_at: "",
    }) as never;
    const cola = [{ source_id: "RC_007", nombre_regla: "Combinación fuera de catálogo", hallazgo_kind: "caso_validar", pending: true, n_casos: 5, variables: [], tipo_regla: "catalog" }] as unknown as LimpiezaQueueItem[];
    const tres = [porColumna("D1", "p1_1"), porColumna("D2", "p1_2"), porColumna("D3", "p1_3")];
    const c = () => cierre({
      decisiones: tres,
      grupos: [{ efecto: "cambia_valores", n_decisiones: 3, cifra: 3, unidad: "valores cambiados" }],
      totales: { n_casos_excluidos: 0, n_celdas_cambiadas: 3 },
    });
    const decisiones = [guardada("D1", "p1_1", ["principal::idx::208"]), guardada("D2", "p1_2", ["principal::idx::208"]), guardada("D3", "p1_3", ["principal::idx::208"])];

    it("las decisiones de un mismo caso y regla son una fila con la suma de sus valores", () => {
      const g = gruposDeDecisiones({ aplicadas: c().decisiones_aplicadas!, cadena: c().cadena_casos, elementos: elementosDeCola(resumen({ decision_queue: cola })), decisiones });
      expect(g).toHaveLength(1);
      expect(g[0].filas).toHaveLength(1);
      expect(g[0].filas[0]).toMatchObject({ hallazgo: "Combinación fuera de catálogo", tratamiento: "Asignar un valor", cifra: 3 });
      expect(g[0].filas[0].detalle).toBe("1 caso en 3 columnas. Cubre 1 de los 5 casos del hallazgo.");
    });

    it("dos casos distintos con la misma regla son dos filas", () => {
      const otras = [guardada("D1", "p1_1", ["principal::idx::208"]), guardada("D2", "p1_2", ["principal::idx::300"]), guardada("D3", "p1_3", ["principal::idx::300"])];
      const g = gruposDeDecisiones({ aplicadas: c().decisiones_aplicadas!, cadena: c().cadena_casos, elementos: [], decisiones: otras });
      expect(g[0].filas.map((f) => f.cifra)).toEqual([1, 2]);
    });

    it("sin las decisiones guardadas no se agrupa por caso: cada decisión sigue siendo una fila", () => {
      const g = gruposDeDecisiones({ aplicadas: c().decisiones_aplicadas!, cadena: c().cadena_casos, elementos: [] });
      expect(g[0].filas).toHaveLength(3);
    });

    it("el conteo del panel son los hallazgos con decisión, no las decisiones", () => {
      const g = gruposDeDecisiones({ aplicadas: c().decisiones_aplicadas!, cadena: c().cadena_casos, elementos: [], decisiones });
      expect(hallazgosConDecision(g)).toBe(1);
    });
  });

  it("una decisión que excluye casos ya excluidos lo dice en su fila", () => {
    const c = cierre({
      decisiones: [DECISIONES[0], { ...DECISIONES[0], decision_id: "PD_B", n_filas_excluidas: 0, n_filas_ya_excluidas: 2 }],
      grupos: [{ efecto: "excluye", n_decisiones: 2, cifra: 2, unidad: "casos excluidos" }],
    });
    const g = gruposDeDecisiones({ aplicadas: c.decisiones_aplicadas!, cadena: c.cadena_casos, elementos: [] });
    expect(g[0].filas[1].nota).toBe("2 casos que también excluye ya los excluyó una decisión anterior.");
  });
});

describe("lista y archivos", () => {
  it("puntos: auditoría al día con fecha y casos, y sin hallazgos por decidir", () => {
    const p = puntosDeLista({ data: resumen(), auditoria: AUDITORIA, casosAuditados: 72 });
    expect(p.map((x) => [x.titulo, x.detalle, x.tono])).toEqual([
      ["Auditoría al día", "6 nov, sobre 72 casos", "ok"],
      ["Sin hallazgos por decidir", "2 de 2", "ok"],
    ]);
  });

  it("puntos: auditoría desactualizada y hallazgos por decidir llevan a Hallazgos", () => {
    const cola = COLA.map((x, i) => ({ ...x, pending: i === 0 }));
    const p = puntosDeLista({ data: resumen({ decision_queue: cola }), auditoria: { ...AUDITORIA, estado: "desactualizada" }, casosAuditados: 72 });
    expect(p.map((x) => [x.titulo, x.irAHallazgos])).toEqual([["Auditoría desactualizada", true], ["1 hallazgo por decidir", true]]);
  });

  it("puntos: los casos para la ficha física llevan a su lista, y sin casos marcados no hay punto", () => {
    const conFicha = (ficha: Parameters<typeof puntosDeLista>[0]["ficha"]) => puntosDeLista({ data: resumen(), auditoria: AUDITORIA, casosAuditados: 72, ficha }).find((x) => x.clave === "ficha");
    expect(conFicha(null)).toBeUndefined();
    expect(conFicha({ casos: 0, hallazgos: 0, fuera: 0 })).toBeUndefined();
    expect(conFicha({ casos: 1, hallazgos: 1, fuera: 0 })).toMatchObject({ titulo: "1 caso para la ficha física", detalle: "En 1 hallazgo.", tono: "aviso", verFicha: true });
    expect(conFicha({ casos: 12, hallazgos: 3, fuera: 0 })).toMatchObject({ titulo: "12 casos para la ficha física", detalle: "En 3 hallazgos." });
  });

  it("puntos: un caso marcado que la regla ya no marca se avisa y no se pierde en silencio", () => {
    const p = puntosDeLista({ data: resumen(), auditoria: AUDITORIA, casosAuditados: 72, ficha: { casos: 4, hallazgos: 2, fuera: 1 } }).find((x) => x.clave === "ficha");
    expect(p?.detalle).toBe("En 2 hallazgos. 1 caso marcado ya no aparece en la última auditoría y no entra en la lista.");
    // Todos los marcados fuera: no hay lista que abrir, pero el aviso queda.
    const solo = puntosDeLista({ data: resumen(), auditoria: AUDITORIA, casosAuditados: 72, ficha: { casos: 0, hallazgos: 1, fuera: 3 } }).find((x) => x.clave === "ficha");
    expect(solo).toMatchObject({ titulo: "0 casos para la ficha física", verFicha: false });
    expect(solo?.detalle).toBe("3 casos marcados ya no aparecen en la última auditoría y no entran en la lista.");
  });

  it("puntos: si la lista no se pudo leer lo dice, con la causa", () => {
    const p = puntosDeLista({ data: resumen(), auditoria: AUDITORIA, casosAuditados: 72, ficha: { error: "El detalle no llegó" } }).find((x) => x.clave === "ficha");
    expect(p).toMatchObject({ titulo: "No se pudo leer la lista para la ficha física", detalle: "El detalle no llegó", tono: "aviso" });
  });

  it("el registro de decisiones nombra la marca por lo que es", () => {
    const data = resumen({ decision_draft: [decision("D_F", { source_id: COLA[0]!.source_id, status: "draft", action_params: { pendiente_ficha_fisica: true }, target_case_ids: ["a"] })] });
    const fila = filasDeRegistro(data).find((f) => f.id === "D_F");
    expect(fila).toMatchObject({ tratamiento: "Revisar con la ficha física", estado: "Pendiente" });
  });

  it("estado de cada archivo en una línea", () => {
    const base = { clave: "base_limpia" as const, nombre: "Base limpia", archivo: "b.xlsx", formato: "xlsx", causas: [], causa_estado: null, generado_en: "2026-11-12T10:53:15Z", file_id: "f", disponible: true, guardado_en: null, contenido: [] };
    expect(lineaDeArchivo({ ...base, estado: "al_dia" }).tono).toBe("ok");
    expect(lineaDeArchivo({ ...base, estado: "al_dia" }).texto).toMatch(/^Al día, 12 nov \d\d:\d\d$/);
    expect(lineaDeArchivo({ ...base, estado: "desactualizado", causas: ["cambiaron_las_decisiones"] })).toEqual({ texto: "Desactualizado: cambiaron las decisiones", tono: "aviso" });
    expect(lineaDeArchivo({ ...base, estado: "al_dia", disponible: false }).texto).toMatch(/; no se guardó con el proyecto$/);
    expect(lineaDeArchivo({ ...base, estado: "no_generado" }).texto).toBe("Se genera al cerrar la base");
    expect(lineaDeArchivo({ ...base, clave: "paquete_metodologico", estado: "no_generado" }).texto).toBe("Sin generar");
    expect(lineaDeArchivo({ ...base, estado: null, causa_estado: "La base se cerró antes de que se anotara el estado." }).texto).toBe("La base se cerró antes de que se anotara el estado.");
  });
});
