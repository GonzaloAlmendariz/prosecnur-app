/**
 * Persistencia del Motor/Recorrido muestral en el workspace del estudio.
 *
 * El backend trata `motor_recorrido` como passthrough opaco: la semántica de
 * `perfil`/`decisiones` vive aquí. Este módulo es el normalizador defensivo
 * del feature (patrón `normalizeGraficosShareInspect`): todo lo que vuelve del
 * `.pulso` se valida campo a campo sobre una base sana antes de tocar el store.
 */
import type { CalcMuestraWorkspaceMotorRecorrido } from "../../../api/client";
import { jsonIgual } from "../corridas";
import {
  decisionesPorDefecto,
  perfilPorId,
  PLANTILLA_UNIVERSIDAD,
  type CapaCriterio,
  type ConfigEscenario2,
  type CriterioAlumno,
  type CriterioAula,
  type DecisionesRecorrido,
  type EmbudoPaso,
  type EscalonE2,
  type EtapaEstudio,
  type FacultadDatos,
  type ModeloDatos,
  type ParametrosMuestra,
  type PerfilInstitucional,
  type RangoNivel,
  type ResumenEstAula,
  type SelloCifra,
} from "../dominio";
import type { FuenteDatos } from "./store";

export const MOTOR_RECORRIDO_SCHEMA = "calc_muestra_workspace_motor_v1";

/** Slice persistible del store del motor (lo que viaja al workspace). */
export type MotorRecorridoSlice = {
  fuente: FuenteDatos;
  perfil: PerfilInstitucional;
  decisiones: DecisionesRecorrido;
  tocado: boolean;
};

// ---------------------------------------------------------------------------
// Serialización (store → workspace)
// ---------------------------------------------------------------------------

export function serializarMotorRecorrido(state: MotorRecorridoSlice): CalcMuestraWorkspaceMotorRecorrido {
  return {
    schema: MOTOR_RECORRIDO_SCHEMA,
    fuente: state.fuente,
    perfil: structuredClone(state.perfil) as unknown as Record<string, unknown>,
    decisiones: structuredClone(state.decisiones) as unknown as Record<string, unknown>,
    tocado: state.tocado,
    actualizado_at: new Date().toISOString(),
  };
}

/**
 * Igualdad semántica de dos payloads persistidos, ignorando `actualizado_at`.
 * Es la guardia anti-bucle del hook de persistencia: hidratar y write-back
 * solo actúan cuando ESTO devuelve false.
 */
export function motorRecorridoIgual(
  a: CalcMuestraWorkspaceMotorRecorrido | null | undefined,
  b: CalcMuestraWorkspaceMotorRecorrido | null | undefined,
): boolean {
  if (a == null || b == null) return a == null && b == null;
  return jsonIgual(sinTimestamp(a), sinTimestamp(b));
}

function sinTimestamp(mr: CalcMuestraWorkspaceMotorRecorrido): Omit<CalcMuestraWorkspaceMotorRecorrido, "actualizado_at"> {
  const { actualizado_at: _ignorado, ...resto } = mr;
  return resto;
}

// ---------------------------------------------------------------------------
// Normalización (workspace → store), defensiva de verdad
// ---------------------------------------------------------------------------

/**
 * Valida un `motor_recorrido` crudo del workspace y lo convierte en el slice
 * tipado del store. Devuelve null si no hay nada utilizable (proyecto viejo,
 * payload corrupto sin perfil): en ese caso el motor no se toca.
 */
export function normalizarMotorRecorrido(raw: unknown): MotorRecorridoSlice | null {
  if (!esRegistro(raw)) return null;
  const perfil = normalizarPerfil(raw.perfil);
  if (!perfil) return null;
  return {
    fuente: raw.fuente === "manual" ? "manual" : "proyecto",
    perfil,
    decisiones: normalizarDecisiones(raw.decisiones, perfil),
    tocado: raw.tocado === true,
  };
}

// --- helpers primitivos -----------------------------------------------------

function esRegistro(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === "object" && valor !== null && !Array.isArray(valor);
}

function textoO(valor: unknown, fallback: string): string {
  return typeof valor === "string" ? valor : fallback;
}

function esNumeroFinito(valor: unknown): valor is number {
  return typeof valor === "number" && Number.isFinite(valor);
}

/** Número finito o fallback (nunca deja pasar NaN/Infinity/strings). */
function numeroO(valor: unknown, fallback: number): number {
  return esNumeroFinito(valor) ? valor : fallback;
}

/** Número finito, null explícito, o fallback si viene corrupto. */
function numeroONuloO(valor: unknown, fallback: number | null): number | null {
  if (valor === null) return null;
  return esNumeroFinito(valor) ? valor : fallback;
}

function booleanO(valor: unknown, fallback: boolean): boolean {
  return typeof valor === "boolean" ? valor : fallback;
}

function listaTextos(valor: unknown, fallback: string[]): string[] {
  if (!Array.isArray(valor)) return fallback;
  return valor.filter((item): item is string => typeof item === "string");
}

// --- perfil ------------------------------------------------------------------

/**
 * Merge validado sobre una base sana: si el id serializado matchea un preset,
 * ese preset (clonado) es la base; si no, la plantilla genérica. Cada campo
 * del payload solo pisa la base si pasa la validación de tipo.
 */
function normalizarPerfil(raw: unknown): PerfilInstitucional | null {
  if (!esRegistro(raw)) return null;
  const id = typeof raw.id === "string" && raw.id ? raw.id : null;
  const base = structuredClone((id ? perfilPorId(id) : null) ?? PLANTILLA_UNIVERSIDAD);
  return {
    ...base,
    id: id ?? base.id,
    nombre: textoO(raw.nombre, base.nombre),
    siglas: textoO(raw.siglas, base.siglas),
    esEjemplo: booleanO(raw.esEjemplo, base.esEjemplo),
    etiquetaUnidad: textoO(raw.etiquetaUnidad, base.etiquetaUnidad),
    etiquetasSexo: normalizarEtiquetasSexo(raw.etiquetasSexo, base.etiquetasSexo),
    anio: numeroO(raw.anio, base.anio),
    etapa: esEtapa(raw.etapa) ? raw.etapa : base.etapa,
    fuenteData: textoO(raw.fuenteData, base.fuenteData),
    modeloDatos: normalizarModeloDatos(raw.modeloDatos, base.modeloDatos),
    facultades: normalizarFacultades(raw.facultades, base.facultades),
    universo: numeroONuloO(raw.universo, base.universo),
    embudoAlumno: normalizarEmbudo(raw.embudoAlumno, base.embudoAlumno),
    aulasTotales: numeroONuloO(raw.aulasTotales, base.aulasTotales),
    embudoAula: normalizarEmbudo(raw.embudoAula, base.embudoAula),
    marcoAulas: numeroONuloO(raw.marcoAulas, base.marcoAulas),
    criteriosAlumno: normalizarCriteriosAlumno(raw.criteriosAlumno, base.criteriosAlumno),
    criteriosAula: normalizarCriteriosAula(raw.criteriosAula, base.criteriosAula),
    mapaNivelPorFacultad: normalizarMapaNivel(raw.mapaNivelPorFacultad, base.mapaNivelPorFacultad),
    parametros: normalizarParametros(raw.parametros, base.parametros),
    escenario2: normalizarEscenario2(raw.escenario2, base.escenario2),
    resumenEstAula: esResumenEstAula(raw.resumenEstAula) ? raw.resumenEstAula : base.resumenEstAula,
    bolsaOpciones: normalizarBolsaOpciones(raw.bolsaOpciones, base.bolsaOpciones),
    bolsaSugerida: numeroO(raw.bolsaSugerida, base.bolsaSugerida),
    notas: listaTextos(raw.notas, base.notas),
  };
}

function esEtapa(valor: unknown): valor is EtapaEstudio {
  return valor === "propuesta" || valor === "campo";
}

function esResumenEstAula(valor: unknown): valor is ResumenEstAula {
  return valor === "min_mediana_media" || valor === "media" || valor === "mediana";
}

function normalizarEtiquetasSexo(valor: unknown, fallback: [string, string]): [string, string] {
  if (!Array.isArray(valor)) return fallback;
  const [a, b] = valor;
  if (typeof a !== "string" || typeof b !== "string") return fallback;
  return [a, b];
}

function normalizarModeloDatos(valor: unknown, fallback: ModeloDatos): ModeloDatos {
  if (!esRegistro(valor)) return fallback;
  const llave = valor.llaveCruce;
  return {
    bases: valor.bases === 1 || valor.bases === 2 ? valor.bases : fallback.bases,
    descripcion: textoO(valor.descripcion, fallback.descripcion),
    llaveCruce: llave === null ? null : typeof llave === "string" ? llave : fallback.llaveCruce,
    riesgo: textoO(valor.riesgo, fallback.riesgo),
  };
}

/** Facultades: exige id string y N numérico finito; filtra entradas corruptas. */
function normalizarFacultades(valor: unknown, fallback: FacultadDatos[]): FacultadDatos[] {
  if (!Array.isArray(valor)) return fallback;
  const filas: FacultadDatos[] = [];
  for (const item of valor) {
    if (!esRegistro(item)) continue;
    if (typeof item.id !== "string" || !item.id) continue;
    if (!esNumeroFinito(item.N)) continue;
    filas.push({
      id: item.id,
      nombre: textoO(item.nombre, item.id),
      N: item.N,
      mujeres: numeroO(item.mujeres, 0),
      hombres: numeroO(item.hombres, 0),
      estAulaMediana: numeroONuloO(item.estAulaMediana, null),
      estAulaMedia: numeroONuloO(item.estAulaMedia, null),
      alcanzables: numeroONuloO(item.alcanzables, null),
      pExito: numeroONuloO(item.pExito, null),
    });
  }
  return filas;
}

function esSello(valor: unknown): valor is SelloCifra {
  return valor === "oficial" || valor === "verificado" || valor === "resumen" || valor === "corregido";
}

function normalizarEmbudo(valor: unknown, fallback: EmbudoPaso[] | null): EmbudoPaso[] | null {
  if (valor === null) return null;
  if (!Array.isArray(valor)) return fallback;
  const pasos: EmbudoPaso[] = [];
  for (const item of valor) {
    if (!esRegistro(item)) continue;
    if (typeof item.id !== "string" || !item.id) continue;
    if (!esNumeroFinito(item.conteo)) continue;
    const paso: EmbudoPaso = {
      id: item.id,
      label: textoO(item.label, ""),
      conteo: item.conteo,
      porQue: textoO(item.porQue, ""),
    };
    if (esSello(item.sello)) paso.sello = item.sello;
    pasos.push(paso);
  }
  return pasos;
}

function esCapa(valor: unknown): valor is CapaCriterio {
  return valor === "marco" || valor === "instrumento" || valor === "procesamiento";
}

function normalizarCriteriosAlumno(valor: unknown, fallback: CriterioAlumno[]): CriterioAlumno[] {
  if (!Array.isArray(valor)) return fallback;
  const criterios: CriterioAlumno[] = [];
  for (const item of valor) {
    if (!esRegistro(item)) continue;
    if (typeof item.id !== "string" || !item.id) continue;
    criterios.push({
      id: item.id,
      etiqueta: textoO(item.etiqueta, ""),
      incluye: textoO(item.incluye, ""),
      excluye: textoO(item.excluye, ""),
      variable: textoO(item.variable, ""),
      capa: esCapa(item.capa) ? item.capa : "marco",
      rol: item.rol === "estratifica" || item.rol === "confirmacion" ? item.rol : "filtro",
      porQue: textoO(item.porQue, ""),
    });
  }
  return criterios;
}

function normalizarCriteriosAula(valor: unknown, fallback: CriterioAula[]): CriterioAula[] {
  if (!Array.isArray(valor)) return fallback;
  const criterios: CriterioAula[] = [];
  for (const item of valor) {
    if (!esRegistro(item)) continue;
    if (typeof item.id !== "string" || !item.id) continue;
    const criterio: CriterioAula = {
      id: item.id,
      etiqueta: textoO(item.etiqueta, ""),
      regla: textoO(item.regla, ""),
      variable: textoO(item.variable, ""),
      tipo: item.tipo === "opcional" ? "opcional" : "base",
      porQue: textoO(item.porQue, ""),
    };
    if (typeof item.excepciones === "string") criterio.excepciones = item.excepciones;
    if (esRegistro(item.impactoActivar) && esNumeroFinito(item.impactoActivar.aulas) && esNumeroFinito(item.impactoActivar.coberturaPct)) {
      criterio.impactoActivar = {
        aulas: item.impactoActivar.aulas,
        coberturaPct: item.impactoActivar.coberturaPct,
        facultadesRotas: listaTextos(item.impactoActivar.facultadesRotas, []),
      };
    }
    criterios.push(criterio);
  }
  return criterios;
}

function normalizarMapaNivel(
  valor: unknown,
  fallback: Record<string, RangoNivel[]> | null,
): Record<string, RangoNivel[]> | null {
  if (valor === null) return null;
  if (!esRegistro(valor)) return fallback;
  const mapa: Record<string, RangoNivel[]> = {};
  for (const [clave, rangos] of Object.entries(valor)) {
    if (!Array.isArray(rangos)) continue;
    const limpios: RangoNivel[] = [];
    for (const rango of rangos) {
      if (!esRegistro(rango)) continue;
      if (!esNumeroFinito(rango.min) || !esNumeroFinito(rango.max)) continue;
      limpios.push({ min: rango.min, max: rango.max });
    }
    mapa[clave] = limpios;
  }
  return mapa;
}

function normalizarParametros(valor: unknown, fallback: ParametrosMuestra): ParametrosMuestra {
  if (!esRegistro(valor)) return fallback;
  return {
    confianza: numeroO(valor.confianza, fallback.confianza),
    margenError: numeroO(valor.margenError, fallback.margenError),
    proporcion: numeroO(valor.proporcion, fallback.proporcion),
    deff: numeroO(valor.deff, fallback.deff),
    factorSobremuestra: numeroO(valor.factorSobremuestra, fallback.factorSobremuestra),
    nDiseno: numeroONuloO(valor.nDiseno, fallback.nDiseno),
  };
}

function normalizarEscenario2(valor: unknown, fallback: ConfigEscenario2 | null): ConfigEscenario2 | null {
  if (valor === null) return null;
  if (!esRegistro(valor)) return fallback;
  const base: ConfigEscenario2 = fallback ?? {
    escalones: [],
    deff: 1.5,
    factorSobremuestra: 1.2,
    proporcionFallback: 0.5,
    totalDiseno: null,
    sobremuestraOficial: null,
    tablaOficial: null,
  };
  return {
    escalones: normalizarEscalones(valor.escalones, base.escalones),
    deff: numeroO(valor.deff, base.deff),
    factorSobremuestra: numeroO(valor.factorSobremuestra, base.factorSobremuestra),
    proporcionFallback: numeroO(valor.proporcionFallback, base.proporcionFallback),
    totalDiseno: numeroONuloO(valor.totalDiseno, base.totalDiseno),
    sobremuestraOficial: numeroONuloO(valor.sobremuestraOficial, base.sobremuestraOficial),
    tablaOficial: normalizarTablaOficial(valor.tablaOficial, base.tablaOficial),
  };
}

function normalizarEscalones(valor: unknown, fallback: EscalonE2[]): EscalonE2[] {
  if (!Array.isArray(valor)) return fallback;
  const escalones: EscalonE2[] = [];
  for (const item of valor) {
    if (!esRegistro(item)) continue;
    if (!esNumeroFinito(item.nDesde) || !esNumeroFinito(item.confianza) || !esNumeroFinito(item.margenError)) continue;
    escalones.push({ nDesde: item.nDesde, confianza: item.confianza, margenError: item.margenError });
  }
  return escalones;
}

function normalizarTablaOficial(
  valor: unknown,
  fallback: ConfigEscenario2["tablaOficial"],
): ConfigEscenario2["tablaOficial"] {
  if (valor === null) return null;
  if (!esRegistro(valor)) return fallback;
  const tabla: NonNullable<ConfigEscenario2["tablaOficial"]> = {};
  for (const [clave, fila] of Object.entries(valor)) {
    if (!esRegistro(fila) || !esNumeroFinito(fila.n)) continue;
    tabla[clave] = {
      n: fila.n,
      W: numeroONuloO(fila.W, null),
      aulas: numeroONuloO(fila.aulas, null),
    };
  }
  return tabla;
}

function normalizarBolsaOpciones(valor: unknown, fallback: number[]): number[] {
  if (!Array.isArray(valor)) return fallback;
  const opciones = valor.filter(esNumeroFinito);
  return opciones.length ? opciones : fallback;
}

// --- decisiones ---------------------------------------------------------------

function normalizarDecisiones(raw: unknown, perfil: PerfilInstitucional): DecisionesRecorrido {
  const base = decisionesPorDefecto(perfil);
  if (!esRegistro(raw)) return base;
  const bolsa = raw.bolsaExtraPorFacultad;
  return {
    parametros: normalizarParametros(raw.parametros, base.parametros),
    opcionalesActivos: listaTextos(raw.opcionalesActivos, base.opcionalesActivos),
    bolsaExtraPorFacultad: esNumeroFinito(bolsa) && bolsa >= 0 ? bolsa : base.bolsaExtraPorFacultad,
    escenario: raw.escenario === "e1" || raw.escenario === "e2" ? raw.escenario : base.escenario,
  };
}
