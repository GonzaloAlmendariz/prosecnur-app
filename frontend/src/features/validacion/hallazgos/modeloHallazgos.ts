/**
 * Modelo puro de la pestaña Hallazgos (plan de fidelidad, rebanada V3;
 * prototipo `validacion-hallazgos*`, `vistas.js:140-241` y `1147-1216`).
 *
 * Unidad (D-F1): un "hallazgo" es cada regla con casos de la cola, como en el
 * prototipo ("5/19 hallazgos por decidir"). Los pares fila por regla del
 * motor (`n_hallazgos`) no se muestran aquí.
 *
 * A qué casos llega una decisión (D-F2): "Dejar como está" sigue a la última
 * auditoría; excluir, vaciar, corregir o asignar se congelan en los casos que
 * la regla marca al dejarla lista, y los que marque una auditoría posterior
 * quedan por decidir, con "Incluir casos nuevos". Una regla de un grupo
 * repetido decide sobre el encuestado entero (D-F3), y la pantalla lo dice
 * antes de guardar.
 *
 * Nada aquí pide al motor ni guarda: arma lo que la pantalla escribe con lo
 * que el motor publicó. Lo que el motor no dio queda en `null` y la pantalla
 * no lo inventa.
 */
import {
  normalizarCaseIds,
  normalizarCoincideCon,
  normalizarContextoPorCaso,
  normalizarColumnasDeContexto,
  normalizarEsperado,
  normalizarNarrativa,
  normalizarSeguimiento,
  normalizarAplicabilidad,
  textoDeMotivoNoAplicable,
  type ClaseDeHallazgo,
  type ColumnasDeContexto,
  type CifrasHallazgos,
  type ContextoDeCaso,
  type EfectoDeDecision,
  type EnunciadoEsperado,
  type LimitesDeRegla,
  type NarrativaDeRegla,
  type SeccionDelCaso,
  type SeguimientoDeDecision,
  type VariableDelCaso,
} from "../../../api/validacionAuditoria";
import type { CatalogoCompleto, ReglaDelCatalogo } from "../../../api/validacionCatalogo";
import type { InstrumentoDrillResult } from "../../../api/validacion";
import type { CifraDePestana } from "../../../components/procesamiento/CifrasDePestana";
import type { EstadoDePestana } from "../../../components/procesamiento/CabeceraDePestana";
import { registro } from "../../../api/normalizarR";
import { conNivel } from "../../../lib/navegacion/direccion";
import { formatoConteo, formatoDecimal } from "../../../lib/formatoNumero";
import type { LimpiezaDecision, LimpiezaDecisionActionType, LimpiezaQueueItem, LimpiezaSummary } from "../types";
import { PANEL_CASO_VALIDACION } from "../panelesValidacion";
import { filtroFueraDeLista, traeValorFueraDeLista } from "./filtroFueraDeLista";
import { CLAVE_RESPONDIDAS_DE_SECCION, esReglaDeSeccion } from "./seccionDelSalto";

// ---------------------------------------------------------------------------
// Palabras
// ---------------------------------------------------------------------------

/** "1 caso", "2 casos": el número va con `formatoConteo`. */
export function conteo(n: number, singular: string, plural: string): string {
  return `${formatoConteo(n)} ${n === 1 ? singular : plural}`;
}

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "set", "oct", "nov", "dic"] as const;

/** "8 nov" de una fecha ISO, en la hora local; con `conAnio`, "8 nov 2026". `null` si no se puede leer. */
export function fechaCorta(valor: string | null | undefined, conAnio = false): string | null {
  if (!valor) return null;
  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) return null;
  const base = `${fecha.getDate()} ${MESES[fecha.getMonth()]}`;
  return conAnio ? `${base} ${fecha.getFullYear()}` : base;
}

/** El mismo día en la hora local. */
export function mismoDia(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function rotuloDeClase(clase: ClaseDeHallazgo | null): string {
  return clase === "caso_a_revisar" ? "Caso a revisar" : "Inconsistencia";
}

// ---------------------------------------------------------------------------
// Origen de la regla, en palabras ("Regla propia", "Salto del formulario")
// ---------------------------------------------------------------------------

const FAMILIA_EN_SINGULAR: Record<string, string> = {
  obligatoria: "Obligatoria del formulario",
  salto: "Salto del formulario",
  restriccion: "Restricción del formulario",
  filtro_opciones: "Filtro de opciones del formulario",
  calculo: "Cálculo del formulario",
  grupo_repetido: "Grupo repetido del formulario",
};

const TIPO_DEL_MOTOR_EN_SINGULAR: Record<string, string> = {
  required: "Obligatoria del formulario",
  skip: "Salto del formulario",
  constraint: "Restricción del formulario",
  calculate_check: "Cálculo del formulario",
  catalog: "Opciones del formulario",
  repeat_length: "Grupo repetido del formulario",
};

/** El origen de la regla como lo escribe la cola: el del catálogo o, con un motor anterior, el de la cola. */
export function rotuloDeOrigen(narrativa: NarrativaDeRegla, item: Pick<LimpiezaQueueItem, "fuente" | "tipo_regla" | "source_type">): string {
  if (narrativa.origen_regla === "propia") return "Regla propia";
  if (narrativa.origen_regla === "operativo") return "Del operativo";
  if (narrativa.origen_regla === "formulario") {
    return (narrativa.familia && FAMILIA_EN_SINGULAR[narrativa.familia]) || "Del formulario";
  }
  if (item.fuente === "custom" || item.source_type === "custom_rule") return "Regla propia";
  return TIPO_DEL_MOTOR_EN_SINGULAR[item.tipo_regla] ?? "Del formulario";
}

// ---------------------------------------------------------------------------
// La cola
// ---------------------------------------------------------------------------

/** Lo que se hizo con una regla decidida, como etiqueta de la cola. */
const TRATAMIENTO_HECHO: Record<string, string> = {
  ignore_rule: "Se dejó como está",
  exclude_cases: "Se excluyeron los casos",
  nullify_fields: "Se vació la respuesta",
  replace_value: "Se corrigió el valor",
  set_value: "Se asignó un valor",
  recode_map: "Se recodificó",
  complete_select_multiple_hierarchy: "Se completaron opciones",
  adjust_select_multiple: "Se ajustaron opciones",
  normalize_value: "Se normalizó el valor",
  impute_value: "Se imputó el valor",
};

export function tratamientoHecho(accion: string | null | undefined): string {
  return (accion && TRATAMIENTO_HECHO[accion]) || "Decidido";
}

export type ElementoDeCola = {
  id: string;
  nombre: string;
  narrativa: NarrativaDeRegla;
  /** Casos que la regla marca en la última auditoría. */
  n: number;
  /** "casos" o, en respuestas casi iguales, "respuestas". */
  unidad: "casos" | "respuestas";
  clase: ClaseDeHallazgo;
  origen: string;
  pendiente: boolean;
  /** La decisión lista más reciente de la regla (si la hay). */
  decision: LimpiezaDecision | null;
  /** Hay un borrador guardado sin dejarlo listo. */
  conBorrador: boolean;
  /** La decisión más reciente es de hoy. */
  decididoHoy: boolean;
  /** "Se dejó como está"; `null` si no hay decisión lista. */
  tratamiento: string | null;
  /** La decisión lista no llega a ninguna fila (`aplicable = false`). */
  noAplicable: boolean;
  /** Casos que la regla marca hoy y no cubre la decisión congelada. */
  nCasosNuevos: number;
};

function esCasiIguales(narrativa: NarrativaDeRegla, item: LimpiezaQueueItem): boolean {
  return narrativa.familia === "casi_iguales" || item.tipo_regla === "duplicate";
}

function decisionesDe(data: LimpiezaSummary, id: string): LimpiezaDecision[] {
  return data.decision_draft
    .filter((d) => d.source_id === id)
    .sort((a, b) => new Date(b.updated_at ?? 0).getTime() - new Date(a.updated_at ?? 0).getTime());
}

/** Las reglas de la cola con lo que la pantalla escribe de cada una. `ahora` fija el "hoy" (pruebas). */
export function elementosDeCola(data: LimpiezaSummary | null, ahora: Date = new Date()): ElementoDeCola[] {
  if (!data) return [];
  return data.decision_queue.map((item) => {
    const narrativa = normalizarNarrativa(item, "nombre_regla");
    const decisiones = decisionesDe(data, item.source_id);
    const lista = decisiones.find((d) => d.status === "ready") ?? null;
    const reciente = decisiones[0] ?? null;
    const fecha = reciente?.updated_at ? new Date(reciente.updated_at) : null;
    const seguimiento = lista ? normalizarSeguimiento(lista) : null;
    return {
      id: item.source_id,
      nombre: narrativa.nombre ?? item.nombre_regla ?? item.source_id,
      narrativa,
      n: item.n_casos ?? 0,
      unidad: esCasiIguales(narrativa, item) ? "respuestas" : "casos",
      clase: narrativa.clase ?? "inconsistencia",
      origen: rotuloDeOrigen(narrativa, item),
      pendiente: !!item.pending,
      decision: lista,
      conBorrador: decisiones.some((d) => d.status === "draft"),
      decididoHoy: !!fecha && !Number.isNaN(fecha.getTime()) && mismoDia(fecha, ahora),
      tratamiento: lista ? tratamientoHecho(lista.action_type) : null,
      noAplicable: lista ? normalizarAplicabilidad(lista).aplicable === false : false,
      nCasosNuevos: seguimiento?.casos_nuevos?.length ?? 0,
    };
  });
}

export type PestanaDeCola = "por-decidir" | "decididos";

export type GrupoDeCola = { clave: string; titulo: string | null; elementos: ElementoDeCola[] };

export type VistaDeCola = {
  nPorDecidir: number;
  nDecididos: number;
  /** Clases de la pestaña elegida, para el filtro. */
  inconsistencias: number;
  casosARevisar: number;
  grupos: GrupoDeCola[];
};

/** Pendientes primero, de más a menos casos; desempata el nombre. */
function porCasos(a: ElementoDeCola, b: ElementoDeCola): number {
  return b.n - a.n || a.nombre.localeCompare(b.nombre, "es");
}

/**
 * Lo que la columna "Cola" lista. "Por decidir" lleva al final los decididos
 * hoy, como el prototipo; "Decididos" separa los de hoy de los anteriores
 * (estado no dibujado). El filtro por clase (D-F7e) deja solo esa clase.
 */
export function vistaDeCola(
  elementos: readonly ElementoDeCola[],
  pestana: PestanaDeCola,
  clase: ClaseDeHallazgo | null,
): VistaDeCola {
  const pendientes = elementos.filter((e) => e.pendiente).sort(porCasos);
  const decididos = elementos.filter((e) => !e.pendiente).sort(porCasos);
  const dePestana = pestana === "por-decidir" ? pendientes : decididos;
  const filtrar = (lista: ElementoDeCola[]) => (clase ? lista.filter((e) => e.clase === clase) : lista);
  const hoy = decididos.filter((e) => e.decididoHoy);
  const grupos: GrupoDeCola[] = pestana === "por-decidir"
    ? [
        { clave: "pendientes", titulo: null, elementos: filtrar(pendientes) },
        { clave: "hoy", titulo: "Decididos hoy", elementos: filtrar(hoy) },
      ]
    : [
        { clave: "hoy", titulo: "Decididos hoy", elementos: filtrar(hoy) },
        { clave: "antes", titulo: hoy.length ? "Decididos antes" : null, elementos: filtrar(decididos.filter((e) => !e.decididoHoy)) },
      ];
  return {
    nPorDecidir: pendientes.length,
    nDecididos: decididos.length,
    inconsistencias: dePestana.filter((e) => e.clase === "inconsistencia").length,
    casosARevisar: dePestana.filter((e) => e.clase === "caso_a_revisar").length,
    grupos: grupos.filter((g) => g.elementos.length > 0),
  };
}

/** El hallazgo abierto: el del foco si está en la cola; si no, el primero por decidir; si no, el primero. */
export function hallazgoElegido(elementos: readonly ElementoDeCola[], foco: string | null): ElementoDeCola | null {
  if (foco) {
    const delFoco = elementos.find((e) => e.id === foco);
    if (delFoco) return delFoco;
  }
  const pendientes = elementos.filter((e) => e.pendiente).sort(porCasos);
  return pendientes[0] ?? [...elementos].sort(porCasos)[0] ?? null;
}

/** El siguiente por decidir después de `actual`, en el orden de la cola; `null` si no queda otro. */
export function siguientePorDecidir(elementos: readonly ElementoDeCola[], actual: string | null): ElementoDeCola | null {
  const pendientes = elementos.filter((e) => e.pendiente).sort(porCasos);
  const i = pendientes.findIndex((e) => e.id === actual);
  const resto = i < 0 ? pendientes : [...pendientes.slice(i + 1), ...pendientes.slice(0, i)];
  return resto.find((e) => e.id !== actual) ?? null;
}

// ---------------------------------------------------------------------------
// La cabecera
// ---------------------------------------------------------------------------

export type FaseDeHallazgos =
  | { tipo: "cargando" }
  | { tipo: "error"; mensaje: string }
  | { tipo: "sin-plan" }
  | { tipo: "sin-auditar" }
  | { tipo: "sin-reglas-evaluadas" }
  | { tipo: "sin-hallazgos" }
  | { tipo: "con-hallazgos" };

export function faseDeHallazgos(data: LimpiezaSummary | null, cifras: CifrasHallazgos | null): FaseDeHallazgos {
  if (!data) return { tipo: "cargando" };
  if (!data.progreso?.plan_construido) return { tipo: "sin-plan" };
  if (!data.progreso?.auditoria_corrida) return { tipo: "sin-auditar" };
  if (cifras && cifras.n_reglas_evaluadas === 0) return { tipo: "sin-reglas-evaluadas" };
  if (data.decision_queue.length === 0) return { tipo: "sin-hallazgos" };
  return { tipo: "con-hallazgos" };
}

export type CabeceraDeHallazgos = { estado: EstadoDePestana | null; cifras: CifraDePestana[]; pendientes?: string };

/** Lo que la cabecera no puede decir con lo que publica el motor, con su causa. */
export const PENDIENTE_CASOS_POR_AUDITAR = "casos por auditar: el motor no publica cuántos casos entran a una auditoría que no se corrió";
export const PENDIENTE_AVANCE = "reglas evaluadas durante la auditoría: el motor no publica el avance por regla (M6)";

export function cabeceraDeHallazgos(opciones: {
  data: LimpiezaSummary | null;
  cifras: CifrasHallazgos | null;
  elementos: readonly ElementoDeCola[];
  catalogo: CatalogoCompleto | null;
  auditando: boolean;
}): CabeceraDeHallazgos {
  const { data, cifras, elementos, catalogo, auditando } = opciones;
  const fase = faseDeHallazgos(data, cifras);
  const aplicadas = (n: number): CifraDePestana => ({
    clave: "reglas-aplicadas", valor: formatoConteo(n), rotulo: n === 1 ? "regla aplicada" : "reglas aplicadas", rango: 3,
  });
  if (auditando) {
    const cifrasAuditando: CifraDePestana[] = [];
    if (catalogo?.n_activas !== null && catalogo?.n_activas !== undefined) {
      cifrasAuditando.push({ clave: "reglas", valor: formatoConteo(catalogo.n_activas), rotulo: catalogo.n_activas === 1 ? "regla activa" : "reglas activas", rango: 1 });
    }
    if (cifras?.n_casos_evaluados !== null && cifras?.n_casos_evaluados !== undefined) {
      cifrasAuditando.push({ clave: "casos", valor: formatoConteo(cifras.n_casos_evaluados), rotulo: cifras.n_casos_evaluados === 1 ? "caso" : "casos", rango: 2 });
    }
    return { estado: { tono: "parcial", texto: "Auditando" }, cifras: cifrasAuditando, pendientes: PENDIENTE_AVANCE };
  }
  switch (fase.tipo) {
    case "cargando":
    case "error":
      return { estado: null, cifras: [] };
    case "sin-plan":
      return { estado: { tono: "neutro", texto: "Sin plan de reglas" }, cifras: [] };
    case "sin-auditar": {
      const listas: CifraDePestana[] = catalogo?.n_activas !== null && catalogo?.n_activas !== undefined
        ? [{ clave: "reglas-listas", valor: formatoConteo(catalogo.n_activas), rotulo: catalogo.n_activas === 1 ? "regla lista" : "reglas listas", rango: 1 }]
        : [];
      return { estado: { tono: "parcial", texto: "Sin auditar" }, cifras: listas, pendientes: PENDIENTE_CASOS_POR_AUDITAR };
    }
    case "sin-reglas-evaluadas":
      return { estado: { tono: "atencion", texto: "No hay reglas evaluadas" }, cifras: [] };
    case "sin-hallazgos": {
      const auditados: CifraDePestana[] = cifras?.n_casos_evaluados !== null && cifras?.n_casos_evaluados !== undefined
        ? [{
            clave: "casos-auditados",
            valor: formatoConteo(cifras.n_casos_evaluados),
            base: formatoConteo(cifras.n_casos_evaluados),
            rotulo: "casos auditados",
            tono: "ok",
            rango: 1,
          }]
        : [];
      return {
        estado: { tono: "listo", texto: "Sin hallazgos" },
        cifras: [
          { clave: "hallazgos", valor: "0", rotulo: "hallazgos", rango: 1 },
          ...auditados,
          ...(cifras ? [aplicadas(cifras.n_reglas_evaluadas)] : []),
        ],
      };
    }
    case "con-hallazgos": {
      const porDecidir = elementos.filter((e) => e.pendiente).length;
      const total = elementos.length;
      const casos: CifraDePestana[] =
        cifras?.n_encuestados_con_hallazgos !== null && cifras?.n_encuestados_con_hallazgos !== undefined
          && cifras.n_casos_evaluados !== null
          ? [{
              clave: "casos-con-hallazgo",
              valor: formatoConteo(cifras.n_encuestados_con_hallazgos),
              base: formatoConteo(cifras.n_casos_evaluados),
              rotulo: "casos con algún hallazgo",
              titulo: "Casos de la tabla principal con al menos un hallazgo, sobre los casos de la última auditoría.",
              rango: 2,
            }]
          : [];
      return {
        estado: porDecidir > 0 ? { tono: "parcial", texto: "Por decidir" } : { tono: "listo", texto: "Todo decidido" },
        cifras: [
          {
            clave: "por-decidir",
            valor: formatoConteo(porDecidir),
            base: formatoConteo(total),
            rotulo: "hallazgos por decidir",
            tono: porDecidir > 0 ? "alerta" : "ok",
            rango: 1,
          },
          ...casos,
          ...(cifras ? [aplicadas(cifras.n_reglas_evaluadas)] : []),
        ],
      };
    }
  }
}

// ---------------------------------------------------------------------------
// Las líneas de grupos repetidos (franja de avisos; REVISION, pantalla 1)
// ---------------------------------------------------------------------------

/** "Servicios (grupo repetido): 40 de 667 registros con hallazgos, en 35 casos". Solo hijas con hallazgos. */
export function lineasDeGruposRepetidos(cifras: CifrasHallazgos | null): string[] {
  if (!cifras) return [];
  return cifras.por_tabla
    .filter((t) => t.nivel === "registro" && (t.n_registros_con_hallazgos ?? 0) > 0)
    .map((t) => {
      const conHallazgos = t.n_registros_con_hallazgos ?? 0;
      const de = t.n_registros !== null ? ` de ${formatoConteo(t.n_registros)}` : "";
      const en = t.n_encuestados_con_hallazgos !== null
        ? `, en ${conteo(t.n_encuestados_con_hallazgos, "caso", "casos")}`
        : "";
      return `${t.tabla} (grupo repetido): ${formatoConteo(conHallazgos)}${de} registros con hallazgos${en}`;
    });
}

// ---------------------------------------------------------------------------
// Qué se va a revisar / qué se revisó (estados sin auditar y sin hallazgos)
// ---------------------------------------------------------------------------

export type FilaDeRevision = { clave: string; origen: string; familia: string; reglas: number; segunda: number | null };

const ORIGEN_EN_PALABRAS: Record<string, string> = { formulario: "Del formulario", operativo: "Del operativo", propia: "Propias" };

/** Una fila por familia del catálogo: reglas y activas (sin auditar) o casos (auditada), con su total. */
export function filasDeRevision(catalogo: CatalogoCompleto, segunda: "activas" | "casos"): { filas: FilaDeRevision[]; total: FilaDeRevision } {
  const filas = catalogo.familias.map((f): FilaDeRevision => {
    const casos = catalogo.reglas
      .filter((r) => r.familia === f.familia && r.origen === f.origen)
      .reduce((t, r) => t + (r.ultima_auditoria?.n_casos ?? 0), 0);
    return {
      clave: `${f.origen}-${f.familia}`,
      origen: ORIGEN_EN_PALABRAS[f.origen] ?? f.origen,
      familia: f.nombre,
      reglas: f.n,
      segunda: segunda === "activas" ? f.n_activas : casos,
    };
  });
  const sumaSegunda = filas.every((f) => f.segunda !== null) ? filas.reduce((t, f) => t + (f.segunda ?? 0), 0) : null;
  return {
    filas,
    total: { clave: "total", origen: "Total", familia: "", reglas: filas.reduce((t, f) => t + f.reglas, 0), segunda: sumaSegunda },
  };
}

// ---------------------------------------------------------------------------
// El hallazgo abierto: su vista, su cifra y sus casos
// ---------------------------------------------------------------------------

export type VistaDelHallazgo = "general" | "salto" | "rango" | "casi-iguales";

/** Los casos de una regla, como los lee la pestaña; `id` es la regla a la que pertenecen. */
export type LecturaDeCasos =
  | { fase: "inactiva" }
  | { fase: "cargando" }
  | { fase: "error"; id: string; mensaje: string }
  | { fase: "lista"; id: string; drill: InstrumentoDrillResult };

/**
 * Lo que el centro puede mostrar del hallazgo elegido: los casos solo si son
 * de esa regla. Al cambiar de hallazgo, mientras llegan los del nuevo, se lee
 * "cargando" y no los del anterior (que con los límites del nuevo pintaban
 * tramos falsos).
 */
export function casosDelElegido(lectura: LecturaDeCasos, elegidoId: string | null): LecturaDeCasos {
  if (!elegidoId) return { fase: "inactiva" };
  if ((lectura.fase === "lista" || lectura.fase === "error") && lectura.id !== elegidoId) return { fase: "cargando" };
  return lectura;
}

/** Qué evidencia enseña el centro: depende del tipo de regla. */
export function vistaDelHallazgo(opciones: {
  narrativa: NarrativaDeRegla;
  item: LimpiezaQueueItem | null;
  regla: ReglaDelCatalogo | null;
  limites: LimitesDeRegla | null;
  drill: InstrumentoDrillResult | null;
}): VistaDelHallazgo {
  const { narrativa, item, regla, limites, drill } = opciones;
  if (drill && normalizarCoincideCon((drill as unknown as Record<string, unknown>).coincide_con, drill.casos?.length ?? 0) !== null) {
    return "casi-iguales";
  }
  if (narrativa.familia === "casi_iguales" || regla?.familia === "casi_iguales") return "casi-iguales";
  if ((regla?.familia ?? narrativa.familia) === "salto" || item?.tipo_regla === "skip") return "salto";
  if (limites && (numeroDe(limites.min) !== null || numeroDe(limites.max) !== null)) return "rango";
  return "general";
}

/** Qué fracción del ancho de un tramo queda bajo el mínimo y sobre el máximo del límite (de 0 a 1). */
export function partesFuera(tramo: { desde: number; hasta: number }, min: number | null, max: number | null): { bajo: number; sobre: number } {
  const ancho = tramo.hasta - tramo.desde;
  if (!(ancho > 0)) return { bajo: 0, sobre: 0 };
  const bajo = min === null ? 0 : Math.min(Math.max((min - tramo.desde) / ancho, 0), 1);
  const sobre = max === null ? 0 : Math.min(Math.max((tramo.hasta - max) / ancho, 0), 1);
  return { bajo, sobre: Math.min(sobre, 1 - bajo) };
}

export function numeroDe(valor: string | number | null | undefined): number | null {
  if (valor === null || valor === undefined || valor === "") return null;
  const n = typeof valor === "number" ? valor : Number(String(valor).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export type CifraDelHallazgo = { cifra: number; base: string; proporcion: number; nivel: "caso" | "registro" };

/**
 * La cifra del hallazgo con su base, la de la última auditoría de la regla
 * (catálogo M3): "7 de 178 casos", "4 de 142 a quienes les correspondía". Sin
 * base publicada no hay cifra con proporción: `null`.
 */
export function cifraDelHallazgo(regla: ReglaDelCatalogo | null, n: number, unidad: "casos" | "respuestas"): CifraDelHallazgo | null {
  const ultima = regla?.ultima_auditoria;
  if (!ultima || ultima.n_base === null || ultima.n_base <= 0) return null;
  const cifra = ultima.n_casos ?? n;
  const nivel = ultima.nivel;
  const nombre = nivel === "registro" ? (ultima.n_base === 1 ? "registro" : "registros") : unidad === "respuestas" ? (ultima.n_base === 1 ? "respuesta" : "respuestas") : (ultima.n_base === 1 ? "caso" : "casos");
  const base = ultima.base_definicion
    ? `de ${formatoConteo(ultima.n_base)} ${ultima.base_definicion}`
    : `de ${formatoConteo(ultima.n_base)} ${nombre}`;
  return { cifra, base, proporcion: ultima.porcentaje ?? cifra / ultima.n_base, nivel };
}

/** Los dos sentidos de un salto (la regla y su pareja), con sus casos de la última auditoría. */
export type SentidoDelSalto = { id: string | null; direccion: "debe" | "nodebe"; rotulo: string; n: number | null; actual: boolean };

export function sentidosDelSalto(catalogo: CatalogoCompleto | null, regla: ReglaDelCatalogo | null): SentidoDelSalto[] | null {
  if (!catalogo || !regla || !regla.direccion) return null;
  const pareja = regla.pareja ? catalogo.reglas.find((r) => r.id === regla.pareja || r.id_motor === regla.pareja) ?? null : null;
  const rotulo = (d: "debe" | "nodebe") => (d === "debe" ? "Le correspondía y está vacía" : "No le correspondía y tiene respuesta");
  const propio: SentidoDelSalto = { id: regla.id_motor, direccion: regla.direccion, rotulo: rotulo(regla.direccion), n: regla.ultima_auditoria?.n_casos ?? null, actual: true };
  const otraDireccion = regla.direccion === "debe" ? "nodebe" : "debe";
  const otro: SentidoDelSalto = {
    id: pareja?.id_motor ?? null,
    direccion: otraDireccion,
    rotulo: rotulo(otraDireccion),
    n: pareja?.ultima_auditoria?.n_casos ?? null,
    actual: false,
  };
  return regla.direccion === "debe" ? [propio, otro] : [otro, propio];
}

/** Una fila de la tabla de casos del hallazgo. */
export type FilaDeCaso = {
  /** El id de caso del motor; `null` si el motor no ubicó la fila (no se puede marcar). */
  id: string | null;
  clave: string;
  /** Valor por columna, ya escrito (etiqueta de la opción con su código como dato secundario). */
  valores: Record<string, string>;
  contexto: ContextoDeCaso | null;
  esperado: EnunciadoEsperado | null;
  /** Las columnas cuyo valor no está entre las opciones de su pregunta (pregunta filtro de un salto, ítem 41). */
  fueraDeLista?: string[];
};

/** La columna de lo medido en una batería; no es una pregunta de la base. */
const CLAVE_PATRON_DE_BATERIA = "bateria:patron";
/** La columna de lo leído en una regla de fechas (el enunciado del motor). */
const CLAVE_LECTURA_DE_FECHAS = "fechas:lectura";
/** La columna de por qué no pasa una respuesta en una regla de formato (el enunciado del motor). */
const CLAVE_MOTIVO_DE_FORMATO = "formato:motivo";

export type ColumnaDeCaso = {
  clave: string;
  rotulo: string;
  tipo: "contexto" | "pregunta" | "falla";
  numerica: boolean;
  /**
   * La columna revisada no lleva el tono del error: en "respondida cuando no le
   * correspondía" la respuesta puede estar bien y el error en la pregunta
   * filtro (ítem 41).
   */
  neutra?: boolean;
};

function listaDeRol(valor: string | Array<string | null> | null | undefined): string[] {
  if (!valor) return [];
  return (Array.isArray(valor) ? valor : [valor]).filter((v): v is string => typeof v === "string" && v.trim() !== "");
}

/** Lo que se escribe de un valor crudo de la base: la etiqueta de su opción si la hay, o el valor; vacío es "Vacía". */
export function valorEscrito(crudo: unknown, etiquetas: Record<string, string | null> | null | undefined): string {
  if (crudo === null || crudo === undefined || crudo === "" || crudo === "NA") return "Vacía";
  const texto = typeof crudo === "number" ? (Number.isInteger(crudo) ? formatoConteo(crudo) : formatoDecimal(crudo, 2)) : String(crudo);
  const etiqueta = etiquetas?.[String(crudo)];
  return etiqueta ? `${etiqueta} (${String(crudo)})` : texto;
}

/**
 * Las columnas y filas de la tabla de casos: el caso, las columnas de contexto
 * que el estudio declaró (número de encuesta, recopilador, digitador, fecha de
 * respuesta), las preguntas de la
 * regla que deciden (la condición, la comparada) y, al final, la que falla.
 * En una batería ("Patrón en una batería") van todas sus preguntas, en el
 * orden de la regla, y al final lo que el motor midió en el caso (su
 * enunciado, "respondió "Mucho" (4) en las 14 preguntas de la batería").
 * En una regla de fechas van sus preguntas con el texto original y al final
 * lo leído por el motor ("registró "15.10.28" (15/10/2028) en Fecha,
 * posterior al cierre del operativo (31/10/2026)").
 * En una regla de formato va la respuesta tal cual, sin separador de miles, y
 * al final el enunciado del motor ("respondió "80105" en Ubigeo (5 dígitos),
 * que no es un número de 6 dígitos").
 * Las filas se cruzan con los ids por posición dentro de la misma respuesta
 * del motor (`casos`, `case_ids`, `esperado` y `contexto_por_caso` son
 * paralelos por contrato).
 */
export function tablaDeCasos(drill: InstrumentoDrillResult | null, item: LimpiezaQueueItem | null): {
  columnas: ColumnaDeCaso[];
  filas: FilaDeCaso[];
  contexto: ColumnasDeContexto;
} {
  const vacia = { columnas: [], filas: [], contexto: normalizarColumnasDeContexto(null) };
  if (!drill) return vacia;
  const crudo = drill as unknown as Record<string, unknown>;
  const casos = drill.casos ?? [];
  const ids = normalizarCaseIds(drill.case_ids);
  const esperado = normalizarEsperado(crudo.esperado, casos.length);
  const contextoPorCaso = normalizarContextoPorCaso(crudo.contexto_por_caso, casos.length);
  const contexto = normalizarColumnasDeContexto(crudo.contexto);
  const roles = drill.regla?.variable_roles ?? null;
  const etiquetas = roles?.labels ?? {};
  const valueLabels = drill.regla?.value_labels ?? {};
  const objetivo = roles?.target || item?.variables?.[0] || drill.regla?.variables?.[0] || null;
  const otras = [...new Set([...listaDeRol(roles?.gate), ...listaDeRol(roles?.drivers), ...listaDeRol(roles?.compare)])]
    .filter((v) => v !== objetivo);
  const enLaFila = (v: string) => casos.some((fila) => Object.prototype.hasOwnProperty.call(fila, v));
  const numerica = (v: string) => casos.every((fila) => {
    const x = fila[v];
    return x === null || x === undefined || x === "" || typeof x === "number" || numeroDe(String(x)) !== null;
  });

  const columnas: ColumnaDeCaso[] = [];
  if (contexto.numero_encuesta) columnas.push({ clave: "ctx:numero_encuesta", rotulo: "N.º de encuesta", tipo: "contexto", numerica: false });
  if (contexto.recopilador) columnas.push({ clave: "ctx:recopilador", rotulo: "Recopilador", tipo: "contexto", numerica: false });
  if (contexto.digitador) columnas.push({ clave: "ctx:digitador", rotulo: "Digitador", tipo: "contexto", numerica: false });
  if (contexto.fecha_respuesta) columnas.push({ clave: "ctx:fecha_respuesta", rotulo: "Fecha de respuesta", tipo: "contexto", numerica: false });
  const familia = registro(crudo.regla).familia;
  const seccion = esReglaDeSeccion(esperado);
  const sobra = seccion || esperado.some((e) => e?.subtipo === "salto_nodebe");
  if (seccion) {
    // La sección: la respuesta que la abre y cuántas de sus preguntas respondió (ítem 42).
    for (const v of listaDeRol(roles?.gate).filter(enLaFila)) columnas.push({ clave: v, rotulo: etiquetas[v] || v, tipo: "pregunta", numerica: false });
    columnas.push({ clave: CLAVE_RESPONDIDAS_DE_SECCION, rotulo: "Preguntas respondidas", tipo: "falla", numerica: false, neutra: true });
  } else if (familia === "bateria") {
    const items = [...new Set([objetivo ?? "", ...listaDeRol(roles?.compare)])].filter((v) => v && enLaFila(v));
    for (const v of items) columnas.push({ clave: v, rotulo: etiquetas[v] || v, tipo: "pregunta", numerica: false });
    columnas.push({ clave: CLAVE_PATRON_DE_BATERIA, rotulo: "En la batería", tipo: "falla", numerica: false });
  } else if (familia === "rango_fecha" || familia === "comparar_fechas") {
    const items = [...new Set([objetivo ?? "", ...listaDeRol(roles?.compare)])].filter((v) => v && enLaFila(v));
    for (const v of items) columnas.push({ clave: v, rotulo: etiquetas[v] || v, tipo: "pregunta", numerica: false });
    columnas.push({ clave: CLAVE_LECTURA_DE_FECHAS, rotulo: "Leído", tipo: "falla", numerica: false });
  } else if (familia === "formato" && objetivo) {
    // La respuesta tal cual (sin separador de miles: "80105" no es una cifra) y por qué no pasa.
    for (const v of otras.filter(enLaFila)) columnas.push({ clave: v, rotulo: etiquetas[v] || v, tipo: "pregunta", numerica: false });
    columnas.push({ clave: `formato:${objetivo}`, rotulo: etiquetas[objetivo] || objetivo, tipo: "pregunta", numerica: false });
    columnas.push({ clave: CLAVE_MOTIVO_DE_FORMATO, rotulo: "Formato", tipo: "falla", numerica: false });
  } else {
    for (const v of otras.filter(enLaFila)) {
      columnas.push({ clave: v, rotulo: etiquetas[v] || v, tipo: "pregunta", numerica: false });
    }
    if (objetivo) {
      columnas.push({ clave: objetivo, rotulo: etiquetas[objetivo] || objetivo, tipo: "falla", numerica: enLaFila(objetivo) && numerica(objetivo), ...(sobra ? { neutra: true } : {}) });
    }
  }
  const fuera = filtroFueraDeLista(drill);

  const filas = casos.map((fila, i): FilaDeCaso => {
    const valores: Record<string, string> = {};
    const ctx = contextoPorCaso[i];
    for (const c of columnas) {
      if (c.clave === "ctx:recopilador") valores[c.clave] = ctx?.recopilador ?? "Sin dato";
      else if (c.clave === "ctx:numero_encuesta") valores[c.clave] = ctx?.numero_encuesta ?? "Sin dato";
      else if (c.clave === "ctx:digitador") valores[c.clave] = ctx?.digitador ?? "Sin dato";
      else if (c.clave === "ctx:fecha_respuesta") valores[c.clave] = fechaCorta(ctx?.fecha_respuesta, true) ?? ctx?.fecha_respuesta ?? "Sin dato";
      else if (c.clave === CLAVE_PATRON_DE_BATERIA || c.clave === CLAVE_RESPONDIDAS_DE_SECCION) valores[c.clave] = esperado[i]?.hecho ?? "Sin dato";
      else if (c.clave === CLAVE_LECTURA_DE_FECHAS) valores[c.clave] = [esperado[i]?.hecho, esperado[i]?.choque].filter(Boolean).join(", ") || "Sin dato";
      else if (c.clave === CLAVE_MOTIVO_DE_FORMATO) valores[c.clave] = [esperado[i]?.hecho, esperado[i]?.choque].filter(Boolean).join(", ") || "Sin dato";
      else if (c.clave.startsWith("formato:")) {
        const crudo = fila[c.clave.slice("formato:".length)];
        valores[c.clave] = crudo === null || crudo === undefined || crudo === "" ? "Vacía" : String(crudo);
      }
      else valores[c.clave] = valorEscrito(fila[c.clave], valueLabels?.[c.clave] ?? null);
    }
    const id = ids[i] ?? null;
    const marcadas = fuera.filter((f) => columnas.some((c) => c.clave === f.variable) && traeValorFueraDeLista(fila[f.variable], f.valores)).map((f) => f.variable);
    return { id, clave: id ?? `fila-${i + 1}`, valores, contexto: ctx, esperado: esperado[i] ?? null, ...(marcadas.length ? { fueraDeLista: marcadas } : {}) };
  });
  return { columnas, filas, contexto };
}

/** La pregunta revisada de la regla y si su valor es numérico (para la distribución). */
export function preguntaRevisada(regla: ReglaDelCatalogo | null, drill: InstrumentoDrillResult | null, item: LimpiezaQueueItem | null): { variable: string; etiqueta: string; numerica: boolean } | null {
  const variable = regla?.variable_revisada ?? drill?.regla?.variable_roles?.target ?? item?.variables?.[0] ?? null;
  if (!variable) return null;
  const ficha = regla?.frase.find((p) => p.tipo === "pregunta" && p.codigo === variable);
  const etiqueta = (ficha && ficha.tipo === "pregunta" ? ficha.etiqueta : null)
    ?? drill?.regla?.variable_roles?.labels?.[variable]
    ?? variable;
  const numerica = ficha && ficha.tipo === "pregunta"
    ? ficha.tipoPregunta === "numerica"
    : tablaDeCasos(drill, item).columnas.find((c) => c.clave === variable)?.numerica ?? false;
  return { variable, etiqueta, numerica };
}

// ---------------------------------------------------------------------------
// Respuestas casi iguales: los pares
// ---------------------------------------------------------------------------

export type MiembroDelPar = { id: string; contexto: ContextoDeCaso | null };

export type ParCasiIgual = {
  clave: string;
  miembros: MiembroDelPar[];
  n_coincidencias: number | null;
  n_comparables: number | null;
  similitud: number | null;
};

/**
 * Los pares de la regla de casi iguales, cada uno una vez. El otro miembro de
 * una pareja se busca por su id en los ids del mismo detalle (la regla marca a
 * los dos); su contexto es el de su fila.
 */
export function paresCasiIguales(drill: InstrumentoDrillResult | null): ParCasiIgual[] {
  if (!drill) return [];
  const crudo = drill as unknown as Record<string, unknown>;
  const n = drill.casos?.length ?? 0;
  const ids = normalizarCaseIds(drill.case_ids);
  const coincide = normalizarCoincideCon(crudo.coincide_con, n);
  if (!coincide) return [];
  const contexto = normalizarContextoPorCaso(crudo.contexto_por_caso, n);
  const contextoDe = (id: string) => {
    const i = ids.indexOf(id);
    return i >= 0 ? contexto[i] : null;
  };
  const vistos = new Set<string>();
  const pares: ParCasiIgual[] = [];
  ids.forEach((id, i) => {
    if (!id) return;
    for (const otro of coincide[i] ?? []) {
      const clave = [id, otro.id_caso].sort().join("|");
      if (vistos.has(clave)) continue;
      vistos.add(clave);
      pares.push({
        clave,
        miembros: [{ id, contexto: contexto[i] }, { id: otro.id_caso, contexto: contextoDe(otro.id_caso) }],
        n_coincidencias: otro.n_coincidencias,
        n_comparables: otro.n_comparables,
        similitud: otro.similitud,
      });
    }
  });
  return pares;
}

export type CualSeConserva = "mas-completa" | "mas-reciente" | "primera";

/**
 * El miembro que se conserva de un par según el criterio, o `null` si el dato
 * que lo decide falta o empata: entonces el par no se resuelve solo y la
 * pantalla lo dice.
 */
export function conservadoDelPar(par: ParCasiIgual, criterio: CualSeConserva): string | null {
  const [a, b] = par.miembros;
  if (!a || !b) return null;
  if (criterio === "mas-completa") {
    const na = a.contexto?.n_respondidas;
    const nb = b.contexto?.n_respondidas;
    if (na === null || na === undefined || nb === null || nb === undefined || na === nb) return null;
    return na > nb ? a.id : b.id;
  }
  const fa = Date.parse(a.contexto?.fecha_envio ?? "");
  const fb = Date.parse(b.contexto?.fecha_envio ?? "");
  if (Number.isNaN(fa) || Number.isNaN(fb) || fa === fb) return null;
  if (criterio === "mas-reciente") return fa > fb ? a.id : b.id;
  return fa < fb ? a.id : b.id;
}

/** Los casos que salen de la base al conservar uno por par; los pares sin resolver no aportan. */
export function excluidosDeLosPares(pares: readonly ParCasiIgual[], criterio: CualSeConserva): { excluidos: string[]; sinResolver: number } {
  const excluidos = new Set<string>();
  let sinResolver = 0;
  for (const par of pares) {
    const queda = conservadoDelPar(par, criterio);
    if (!queda) {
      sinResolver += 1;
      continue;
    }
    for (const m of par.miembros) if (m.id !== queda) excluidos.add(m.id);
  }
  return { excluidos: [...excluidos], sinResolver };
}

// ---------------------------------------------------------------------------
// La decisión: qué hacer, sobre qué casos y su efecto
// ---------------------------------------------------------------------------

export type OpcionDeTratamiento = {
  clave: string;
  accion: LimpiezaDecisionActionType;
  titulo: string;
  detalle: string;
  prevista: boolean;
  /** Casi iguales: el criterio con que se elige cuál se conserva. */
  conserva?: CualSeConserva;
  /** Por qué no se puede elegir; `undefined` si se puede. */
  deshabilitada?: string;
  /** En qué situación corresponde, según las pautas del tipo de hallazgo (`pautasDelHallazgo.ts`). */
  situacion?: string;
};

/**
 * Las opciones de "Qué hacer" (texto literal del prototipo) según la vista. La
 * prevista es la que trae la regla (`tratamiento_previsto` del catálogo o
 * `planned_action_type` de la cola). Selección múltiple y fuera de lista suman
 * las acciones de hoy (plan 2.3, causa 2).
 */
export function opcionesDeTratamiento(opciones: {
  vista: VistaDelHallazgo;
  etiquetaPregunta: string | null;
  prevista: string | null;
  seleccionMultiple: boolean;
  fueraDeLista: boolean;
  /** El código especial declarado por el estudio para "No responde" (D-F6), si lo hay. */
  especial: { codigo: string; etiqueta: string | null } | null;
  /** La regla marca respuestas vacías (obligatoria): como en el salto, se puede asignar un valor. */
  respuestaVacia?: boolean;
  pares?: readonly ParCasiIgual[];
  /**
   * El salto de una sección (ítem 42): la decisión cubre la encuesta, no una
   * pregunta. Se deja o se excluye; vaciar la sección entera no lo hace todavía
   * la limpieza.
   */
  seccion?: boolean;
}): OpcionDeTratamiento[] {
  const { vista, etiquetaPregunta, prevista, seleccionMultiple, fueraDeLista, especial } = opciones;
  const vacia = vista === "salto" || !!opciones.respuestaVacia;
  const pregunta = etiquetaPregunta ? `"${etiquetaPregunta}"` : "La respuesta";
  const op = (clave: string, accion: LimpiezaDecisionActionType, titulo: string, detalle: string, extra: Partial<OpcionDeTratamiento> = {}): OpcionDeTratamiento => ({
    clave, accion, titulo, detalle, prevista: prevista === accion, ...extra,
  });
  if (vista === "casi-iguales") {
    const pares = opciones.pares ?? [];
    const sinDato = (criterio: CualSeConserva) => (pares.length > 0 && pares.every((p) => conservadoDelPar(p, criterio) === null));
    return [
      op("mas-completa", "exclude_cases", "La más completa", "La que tiene más preguntas respondidas.", {
        conserva: "mas-completa",
        prevista: false,
        deshabilitada: sinDato("mas-completa") ? "Las respuestas de cada par tienen las mismas preguntas respondidas." : undefined,
      }),
      op("mas-reciente", "exclude_cases", "La más reciente", "La última que se envió.", {
        conserva: "mas-reciente",
        prevista: false,
        deshabilitada: sinDato("mas-reciente") ? "La base no declara la fecha de envío de las respuestas." : undefined,
      }),
      op("primera", "exclude_cases", "La primera", "La que llegó antes.", {
        conserva: "primera",
        prevista: false,
        deshabilitada: sinDato("primera") ? "La base no declara la fecha de envío de las respuestas." : undefined,
      }),
      op("todas", "ignore_rule", "Todas", "No se excluye ninguna y se registra que se revisó."),
    ];
  }
  if (opciones.seccion) {
    return [
      op("dejar", "ignore_rule", "Dejar como está", "Las respuestas de la sección quedan y se registra que se revisó."),
      op("excluir", "exclude_cases", "Excluir los casos", "Dejan de contar en la base."),
    ];
  }
  const dejar = op("dejar", "ignore_rule", "Dejar como está", vacia ? "Queda vacía y se registra que se revisó." : "Se registra que se revisó.");
  const vaciar = op("vaciar", "nullify_fields", "Vaciar la respuesta", `${pregunta} queda sin dato.`);
  const corregir = op("corregir", "replace_value", "Corregir el valor", "Escribes el valor que corresponde.");
  const excluir = op("excluir", "exclude_cases", "Excluir los casos", "Dejan de contar en la base.");
  const asignar = op(
    "asignar",
    "set_value",
    "Asignar un valor",
    especial ? `${especial.codigo}, ${especial.etiqueta ?? "código especial"}.` : "Escribes el valor que se asigna.",
  );
  const extra: OpcionDeTratamiento[] = [];
  if (seleccionMultiple) {
    extra.push(op("completar", "complete_select_multiple_hierarchy", "Completar opciones", "Marca las opciones que implica otra."));
    extra.push(op("ajustar", "adjust_select_multiple", "Agregar o quitar opciones", "Escribes qué opciones se agregan o se quitan."));
  }
  if (fueraDeLista) extra.push(op("recodificar", "recode_map", "Recodificar", "Pasa cada valor a una opción de la lista."));
  const base = vacia
    ? [dejar, asignar, corregir, excluir]
    : vista === "rango"
      ? [dejar, corregir, vaciar, excluir]
      : [dejar, vaciar, corregir, excluir];
  // Una acción prevista que la vista no ofrece (asignar en un rango) se suma, para no perderla.
  const ofrecidas = new Set([...base, ...extra].map((o) => o.accion));
  const sumada = prevista && !ofrecidas.has(prevista as LimpiezaDecisionActionType)
    ? [prevista === "set_value" ? asignar : prevista === "nullify_fields" ? vaciar : null].filter((o): o is OpcionDeTratamiento => o !== null)
    : [];
  return [...base, ...sumada, ...extra];
}

/** "Los 7" y "Los 3 marcados" ("El marcado", "Los marcados"); en casi iguales, "Los 2" y "Solo el marcado". */
export function rotulosDeAlcance(n: number, marcados: number, vista: VistaDelHallazgo): { titulo: string; todos: string; marcados: string } {
  if (vista === "casi-iguales") {
    return { titulo: "Sobre qué pares", todos: `Los ${formatoConteo(n)}`, marcados: marcados === 1 ? "Solo el marcado" : marcados > 1 ? `Los ${formatoConteo(marcados)} marcados` : "Los marcados" };
  }
  return {
    titulo: "Sobre qué casos",
    todos: n === 1 ? "El caso" : `Los ${formatoConteo(n)}`,
    marcados: marcados === 1 ? "El marcado" : marcados > 1 ? `Los ${formatoConteo(marcados)} marcados` : "Los marcados",
  };
}

/** Las acciones que cambian datos: se congelan al dejarlas listas (D-F2). */
export function cambiaDatos(accion: string): boolean {
  return accion !== "ignore_rule";
}

/**
 * A qué casos llega la decisión, dicho antes de guardar (D-F2 y D-F3). Con
 * casos marcados, solo a esos; sobre la regla entera, ignorar sigue a la
 * auditoría y lo demás queda en los casos de hoy.
 */
export function lineaDeAlcance(opciones: {
  accion: string;
  todos: boolean;
  n: number;
  marcados: number;
  alcance: "caso" | "encuestado" | null;
  unidad: "casos" | "respuestas";
}): string {
  const { accion, todos, n, marcados, alcance } = opciones;
  const encuestado = alcance === "encuestado"
    ? accion === "exclude_cases"
      ? " La regla es de un grupo repetido: sale el encuestado entero, con todos sus registros."
      : " La regla es de un grupo repetido: la decisión llega al encuestado entero, con todos sus registros."
    : "";
  if (!cambiaDatos(accion)) {
    return `Cubre los casos que la regla marque, también los de una auditoría nueva.${encuestado}`;
  }
  if (!todos) {
    return `Se aplica solo ${marcados === 1 ? "al caso marcado" : `a los ${formatoConteo(marcados)} casos marcados`}.${encuestado}`;
  }
  return `Se aplica ${n === 1 ? "al caso" : `a los ${formatoConteo(n)} casos`} que la regla marca hoy; los que marque una auditoría nueva quedan por decidir.${encuestado}`;
}

/**
 * Lo que falta para guardar o medir, con los nombres de esta pantalla: el
 * modelo del editor anterior (`modeloLimpieza`) habla de "justificación",
 * "variable objetivo" y "marca que aplica a todos".
 */
export function causaEnPantalla(mensaje: string, rotuloTodos: string): string {
  if (/justificaci[oó]n/i.test(mensaje)) return "Escribe el motivo para guardar la decisión.";
  if (/variable objetivo/i.test(mensaje)) return "Elige la pregunta que cambia.";
  if (/(al menos un caso|Selecciona registros|selecciona exactamente un registro|Selecciona un registro)/i.test(mensaje)) {
    return `Marca al menos un caso o elige "${rotuloTodos}".`;
  }
  return mensaje;
}

/** Respuestas casi iguales: cuántas salen y de qué pares, dicho antes de guardar. */
export function lineaDeAlcanceDePares(opciones: { conservar: boolean; nExcluidas: number; nPares: number; sinResolver: number }): string {
  if (!opciones.conservar) return "No sale ninguna respuesta; la decisión cubre los pares que la regla marque, también los de una auditoría nueva.";
  const salen = opciones.nExcluidas === 1 ? "Sale de la base 1 respuesta" : `Salen de la base ${formatoConteo(opciones.nExcluidas)} respuestas`;
  const de = opciones.nPares === 1 ? "del par" : `de ${formatoConteo(opciones.nPares)} pares`;
  const pendientes = opciones.sinResolver > 0
    ? ` ${opciones.sinResolver === 1 ? "1 par no se resuelve" : `${formatoConteo(opciones.sinResolver)} pares no se resuelven`} con este criterio: elige a mano la respuesta que se conserva.`
    : "";
  return `${salen} ${de}; los pares que marque una auditoría nueva quedan por decidir.${pendientes}`;
}

/** El aviso de una decisión congelada con casos nuevos. `null` si no los hay. */
export function avisoDeCasosNuevos(seguimiento: SeguimientoDeDecision | null): { texto: string; ids: string[] } | null {
  const nuevos = seguimiento?.casos_nuevos ?? [];
  if (seguimiento?.seguimiento !== "congelada" || nuevos.length === 0) return null;
  const n = nuevos.length;
  return {
    texto: n === 1
      ? "La última auditoría marca 1 caso que esta decisión no cubre, porque se dejó lista antes."
      : `La última auditoría marca ${formatoConteo(n)} casos que esta decisión no cubre, porque se dejó lista antes.`,
    ids: nuevos,
  };
}

/** Casos de la decisión que la regla ya no marca: siguen en ella (decisión del coordinador, ronda 2 de M4). */
export function lineaDeCasosQueYaNoMarca(seguimiento: SeguimientoDeDecision | null): string | null {
  const ids = seguimiento?.casos_que_ya_no_marca ?? [];
  if (!ids.length) return null;
  return ids.length === 1
    ? `La regla ya no marca 1 caso de esta decisión (${ids[0]}); la decisión lo conserva.`
    : `La regla ya no marca ${formatoConteo(ids.length)} casos de esta decisión; la decisión los conserva.`;
}

/** Por qué una decisión lista no se aplica, con su causa; `null` si se aplica o no se sabe. */
export function lineaNoAplicable(decision: LimpiezaDecision | null): string | null {
  if (!decision) return null;
  const a = normalizarAplicabilidad(decision);
  if (a.aplicable !== false || !a.motivo_no_aplicable) return null;
  return `Esta decisión no se aplica: ${textoDeMotivoNoAplicable(a.motivo_no_aplicable, a.motivo_crudo)}.`;
}

export type LineaDeEfecto = { cifra?: number; texto: string };

/**
 * El pie de la decisión: qué pasa si se guarda, con la cifra del motor (efecto
 * previsto, M4). "3 valores quedan vacíos en "Año de egreso". Siguen contando
 * 178 casos."
 */
export function lineaDeEfecto(efecto: EfectoDeDecision, opciones: { etiquetaPregunta: string | null; valorAsignado?: string | null }): LineaDeEfecto {
  if (efecto.aplicable === false) {
    return { texto: `No se aplica: ${efecto.texto_no_aplicable ?? "el motor no dijo por qué"}.` };
  }
  const en = opciones.etiquetaPregunta ? ` en "${opciones.etiquetaPregunta}"` : "";
  const despues = efecto.n_casos_cuentan_despues;
  const antes = efecto.n_casos_cuentan_antes;
  const siguen = despues !== null ? ` Siguen contando ${conteo(despues, "caso", "casos")}.` : "";
  const celdas = efecto.n_celdas ?? 0;
  switch (efecto.accion) {
    case "ignore_rule": {
      const n = efecto.n_casos_aplicados ?? 0;
      return { cifra: n, texto: `${n === 1 ? "caso queda revisado" : "casos quedan revisados"}. No cambia ningún valor.` };
    }
    case "exclude_cases": {
      const n = efecto.n_filas ?? 0;
      const quedan = despues !== null && antes !== null ? ` Quedan ${formatoConteo(despues)} de ${formatoConteo(antes)}.` : "";
      return { cifra: n, texto: `${n === 1 ? "caso deja de contar" : "casos dejan de contar"}.${quedan}` };
    }
    case "nullify_fields":
      return { cifra: celdas, texto: `${celdas === 1 ? "valor queda vacío" : "valores quedan vacíos"}${en}.${siguen}` };
    case "set_value":
      return {
        cifra: celdas,
        texto: opciones.valorAsignado
          ? `${celdas === 1 ? "respuesta pasa" : "respuestas pasan"} a "${opciones.valorAsignado}"${en}.${siguen}`
          : `${celdas === 1 ? "valor cambia" : "valores cambian"}${en}.${siguen}`,
      };
    default:
      return { cifra: celdas, texto: `${celdas === 1 ? "valor cambia" : "valores cambian"}${en}.${siguen}` };
  }
}

// ---------------------------------------------------------------------------
// El caso completo
// ---------------------------------------------------------------------------

/** "Correo, 1.ª invitación. Respondió el 3 nov 2026 en 14 minutos": solo lo que el motor publicó. */
export function antetituloDelCaso(metadatos: ContextoDeCaso | null): string | null {
  if (!metadatos) return null;
  const partes: string[] = [];
  if (metadatos.numero_encuesta) partes.push(`Encuesta ${metadatos.numero_encuesta}.`);
  if (metadatos.recopilador) partes.push(`${metadatos.recopilador}.`);
  if (metadatos.digitador) partes.push(`Digitó ${metadatos.digitador}.`);
  const fecha = fechaCorta(metadatos.fecha_respuesta ?? metadatos.fecha_envio, true);
  const duracion = metadatos.duracion_min !== null
    ? ` en ${formatoDecimal(metadatos.duracion_min, metadatos.duracion_min % 1 === 0 ? 0 : 1)} ${metadatos.duracion_min === 1 ? "minuto" : "minutos"}`
    : "";
  if (fecha) partes.push(`Respondió el ${fecha}${duracion}.`);
  else if (duracion) partes.push(`Respondió${duracion}.`);
  const texto = partes.join(" ").replace(/\.$/, "");
  return texto || null;
}

/** "16 de 17 respondidas"; con el motor anterior (sin conteo) se cuenta lo que tiene valor. */
export function respondidasDeSeccion(seccion: SeccionDelCaso): string {
  const preguntas = seccion.n_preguntas ?? seccion.variables.filter((v) => (v.origen ?? "respuesta") === "respuesta").length;
  const respondidas = seccion.n_respondidas ?? seccion.variables.filter((v) => (v.origen ?? "respuesta") === "respuesta" && (v.valor !== null || v.opciones.length > 0)).length;
  return `${formatoConteo(respondidas)} de ${formatoConteo(preguntas)} ${respondidas === 1 && preguntas === 1 ? "respondida" : "respondidas"}`;
}

/** El valor de una respuesta del caso como se lee, con su estado cuando está vacía. */
export function valorDeRespuesta(v: VariableDelCaso): string {
  if (v.opciones.length) {
    return v.opciones.map((o) => (o.etiqueta && o.etiqueta.toLowerCase() !== o.codigo.toLowerCase() ? `${o.etiqueta} (${o.codigo})` : o.etiqueta ?? o.codigo)).join(", ");
  }
  if (v.valor === null) {
    if (v.estado === "vacia_por_salto") return "No le correspondía";
    if (v.estado === "relevancia_indeterminada") return "Vacía, sin saber si le correspondía";
    return "Vacía";
  }
  if (v.especial) return `${v.especial_etiqueta ?? "Código especial"} (${v.valor})`;
  // La etiqueta lleva el código detrás, salvo que diga lo mismo ("Sur" y "sur").
  if (!v.valor_etiqueta || v.valor_etiqueta.toLowerCase() === v.valor.toLowerCase()) return v.valor_etiqueta ?? v.valor;
  return `${v.valor_etiqueta} (${v.valor})`;
}

/** Las secciones con alguna pregunta de los hallazgos del caso: las que el panel enseña primero. */
export function seccionesDelHallazgo(secciones: readonly SeccionDelCaso[], variables: ReadonlySet<string>): SeccionDelCaso[] {
  return secciones.filter((s) => s.variables.some((v) => variables.has(v.variable)));
}

// ---------------------------------------------------------------------------
// Dirección: el panel del caso usa el foco para el caso
// ---------------------------------------------------------------------------

/** Abre el caso: `panel=caso&foco=<id_caso>`. El hallazgo abierto lo recuerda la pestaña. */
export function searchConCaso(search: string, idCaso: string): string {
  return conNivel(conNivel(search, "panel", PANEL_CASO_VALIDACION.id), "foco", idCaso);
}

/** Cierra el caso y devuelve el foco al hallazgo. */
export function searchSinCaso(search: string, idHallazgo: string | null): string {
  return conNivel(conNivel(search, "panel", null), "foco", idHallazgo);
}

/** El enlace viejo al detalle de una regla en Hallazgos (`panel=regla&foco=<id>`) abre ese hallazgo, sin panel. */
export function searchSinPanelDeRegla(search: string): string {
  return conNivel(search, "panel", null);
}
