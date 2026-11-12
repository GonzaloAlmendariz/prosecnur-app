import { describe, expect, it } from "vitest";
import { normalizarCierre } from "./validacionCierre";

/** `cierre` real de audit_reference, base auditoria, cerrada (motor M5, ej-ar-cierre-cerrada.json), recortado. */
const CERRADA = {
  estado: "cerrada",
  cerrada_en: "2026-11-12T10:53:15Z",
  causa_sin_cifras: null,
  cadena_casos: {
    momento: "al_cerrar", recibidos: 72, n_fuentes: null,
    causa_n_fuentes: "El motor no registra de cuántas fuentes viene la base.",
    fuera: { retirados_fuera_de_la_app: 0, pruebas: 0, sin_clasificar: 0, por_reglas_de_carga: 0, fuera_de_la_auditoria: 0 },
    excluidos_en_limpieza: 2, cuentan: 70, proporcion: 0.9722, cuadra: true,
    filtro_de_pruebas: false, depuracion_externa: false, base_promovida: true,
    base: "casos de la tabla principal de la base; proporción sobre los recibidos", avisos: [],
  },
  decisiones_aplicadas: {
    regla_atribucion: "Un caso que excluyen varias decisiones se atribuye a la primera que lo excluye en el orden de aplicación; las demás lo cuentan como ya excluido.",
    decisiones: [
      { decision_id: "PD_001", source_id: "VR_constraint_cbe6c3cc", action_type: "exclude_cases", target_variable: null, rationale: "Edad fuera del rango del estudio", decidida_en: "2026-11-12T10:53:13Z", efecto: "excluye", n_filas_excluidas: 2, n_filas_ya_excluidas: 0, n_celdas_cambiadas: 0, n_casos_revisados: null, aplicable: true, motivo_no_aplicable: null },
      { decision_id: "PD_002", source_id: "VR_constraint_26fdf9b2", action_type: "nullify_fields", target_variable: "puntaje", rationale: "Puntaje imposible", decidida_en: "2026-11-12T10:53:14Z", efecto: "cambia_valores", n_filas_excluidas: 0, n_filas_ya_excluidas: 0, n_celdas_cambiadas: 1, n_casos_revisados: null, aplicable: true, motivo_no_aplicable: null },
    ],
    grupos: [
      { efecto: "excluye", n_decisiones: 1, cifra: 2, unidad: "casos excluidos" },
      { efecto: "cambia_valores", n_decisiones: 1, cifra: 1, unidad: "valores cambiados" },
      { efecto: "sin_cambios", n_decisiones: 0, cifra: 0, unidad: "revisiones de casos" },
      { efecto: "no_se_aplica", n_decisiones: 0, cifra: null, unidad: null },
    ],
    totales: { n_casos_excluidos: 2, n_celdas_cambiadas: 1, cuadra_con_motor: true },
  },
  archivos: [
    { clave: "base_limpia", nombre: "Base limpia", archivo: "r_Base_limpia_auditoria_12_11_26.xlsx", formato: "xlsx", estado: "al_dia", causas: [], causa_estado: null, generado_en: "2026-11-12T10:53:15Z", file_id: "3704df43", disponible: true, guardado_en: "/p/Entregables/Procesamiento/r_Base_limpia_auditoria_12_11_26.xlsx", contenido: [] },
    { clave: "registro", nombre: "Registro de limpieza", archivo: "r_Decisiones_de_limpieza_auditoria_12_11_26.xlsx", formato: "xlsx", estado: "al_dia", causas: [], causa_estado: null, generado_en: "2026-11-12T10:53:15Z", file_id: "9af6c130", disponible: true, guardado_en: null, contenido: [] },
    { clave: "revision", nombre: "Revisión de limpieza", archivo: "r_Revision_de_limpieza_auditoria_12_11_26.html", formato: "html", estado: "al_dia", causas: [], causa_estado: null, generado_en: "2026-11-12T10:53:15Z", file_id: "e5b00fbd", disponible: true, guardado_en: null, contenido: [] },
    { clave: "paquete_metodologico", nombre: "Paquete metodológico", archivo: null, formato: null, estado: "no_generado", causas: [], causa_estado: null, generado_en: null, file_id: null, disponible: false, guardado_en: null, contenido: [] },
  ],
};

describe("normalizarCierre (motor M5)", () => {
  it("lee el cierre real de audit_reference: cadena, grupos en orden y los cuatro archivos", () => {
    const c = normalizarCierre(CERRADA);
    expect(c?.estado).toBe("cerrada");
    expect(c?.cadena_casos).toMatchObject({ momento: "al_cerrar", recibidos: 72, n_fuentes: null, excluidos_en_limpieza: 2, cuentan: 70, proporcion: 0.9722, cuadra: true });
    expect(c?.decisiones_aplicadas?.grupos.map((g) => [g.efecto, g.n_decisiones, g.cifra])).toEqual([
      ["excluye", 1, 2], ["cambia_valores", 1, 1], ["sin_cambios", 0, 0], ["no_se_aplica", 0, null],
    ]);
    expect(c?.decisiones_aplicadas?.decisiones[1]).toMatchObject({ source_id: "VR_constraint_26fdf9b2", efecto: "cambia_valores", n_celdas_cambiadas: 1, n_casos_revisados: null });
    expect(c?.archivos.map((a) => [a.clave, a.estado, a.disponible])).toEqual([
      ["base_limpia", "al_dia", true], ["registro", "al_dia", true], ["revision", "al_dia", true], ["paquete_metodologico", "no_generado", false],
    ]);
  });

  it("acepta las formas de Plumber: escalares en vector, NA y una lista de uno como objeto suelto", () => {
    const c = normalizarCierre({
      estado: ["abierta"],
      cerrada_en: "NA",
      cadena_casos: { ...CERRADA.cadena_casos, recibidos: [72], cuadra: "NA", avisos: { codigo: "base_vigente_ya_limpia", texto: "La base vigente es la limpia." } },
      decisiones_aplicadas: { ...CERRADA.decisiones_aplicadas, decisiones: CERRADA.decisiones_aplicadas.decisiones[0], grupos: CERRADA.decisiones_aplicadas.grupos[0] },
      archivos: { ...CERRADA.archivos[0], estado: "desactualizado", causas: "cambiaron_las_decisiones" },
    });
    expect(c?.estado).toBe("abierta");
    expect(c?.cerrada_en).toBeNull();
    expect(c?.cadena_casos?.recibidos).toBe(72);
    expect(c?.cadena_casos?.cuadra).toBeNull();
    expect(c?.cadena_casos?.avisos).toEqual([{ codigo: "base_vigente_ya_limpia", texto: "La base vigente es la limpia." }]);
    expect(c?.decisiones_aplicadas?.decisiones).toHaveLength(1);
    // El grupo que no vino queda con 0 decisiones y sin cifra: no se inventa un 0.
    expect(c?.decisiones_aplicadas?.grupos[1]).toEqual({ efecto: "cambia_valores", n_decisiones: 0, cifra: null, unidad: null });
    expect(c?.archivos).toEqual([expect.objectContaining({ clave: "base_limpia", estado: "desactualizado", causas: ["cambiaron_las_decisiones"] })]);
  });

  it("sin cifras: cadena y decisiones nulas con su causa; una cifra ausente queda null, no 0", () => {
    const c = normalizarCierre({ estado: "cerrada", causa_sin_cifras: "La base se cerró antes de que se guardaran las cifras del cierre: vuelve a cerrarla para verlas.", cadena_casos: {}, decisiones_aplicadas: null, archivos: [] });
    expect(c?.cadena_casos).toBeNull();
    expect(c?.decisiones_aplicadas).toBeNull();
    expect(c?.causa_sin_cifras).toMatch(/vuelve a cerrarla/);
    const sinCuentan = normalizarCierre({ ...CERRADA, cadena_casos: { ...CERRADA.cadena_casos, cuentan: null } });
    expect(sinCuentan?.cadena_casos?.cuentan).toBeNull();
  });

  it("un motor anterior a M5 (sin `cierre`) o un estado desconocido dan null", () => {
    expect(normalizarCierre(undefined)).toBeNull();
    expect(normalizarCierre({})).toBeNull();
    expect(normalizarCierre({ estado: "otra" })).toBeNull();
  });

  it("descarta archivos de clave desconocida y los ordena como el motor", () => {
    const c = normalizarCierre({ ...CERRADA, archivos: [CERRADA.archivos[3], { clave: "otro" }, CERRADA.archivos[0]] });
    expect(c?.archivos.map((a) => a.clave)).toEqual(["base_limpia", "paquete_metodologico"]);
  });
});
