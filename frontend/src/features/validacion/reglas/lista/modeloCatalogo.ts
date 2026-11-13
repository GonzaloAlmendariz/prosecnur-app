// La pestaña Reglas leída del catálogo de reglas (contrato M3, `GET
// /api/validacion/v2/reglas/catalogo`; plan de fidelidad, rebanada V1).
//
// Aquí vive todo lo que la mesa decide sin dibujar: el catálogo entero
// normalizado (`api/validacionCatalogo.ts`), la columna "Familias", la lista
// de una familia, la regla elegida, las cifras de la cabecera, la franja "De
// las reglas a los hallazgos" y los textos de cada fila. Las vistas solo pintan.
//
// Reglas de lectura:
//   - Se cruza por identificador: una regla por `id`, una regla con la cola de
//     Hallazgos por `id_motor` (= `decision_queue[].source_id`), una familia por
//     su código. Nunca por rótulo ni por posición.
//   - Una cifra que el motor no da queda en `null`, no en 0.
//   - "Sin evaluar" no es una familia del motor: cada regla conserva la suya y
//     la pantalla la reúne por `estado_evaluacion` (contrato M3, sección 1).

import type { AvisoDelCatalogo, CatalogoCompleto, OrigenDeRegla, ReglaDelCatalogo, UltimaAuditoriaDeRegla } from "../../../../api/validacionCatalogo";
import type { CifraDePestana } from "../../../../components/procesamiento/CifrasDePestana";
import type { AvisoDeFranja, CifraDeFranja, DestinoDeFranja, GrupoDeFranja } from "../../../../components/procesamiento/FranjaRecorrido";
import { formatoConteo } from "../../../../lib/formatoNumero";
import { ROTULO_DE_TRATAMIENTO } from "../modeloRegla";
import { fechaCorta } from "../../pestanas/cabeceraDeValidacion";
import type { LimpiezaQueueItem } from "../../types";

// --- Tipos y lectura: viven en `api/validacionCatalogo.ts` ------------------

export {
  normalizarCatalogoCompleto,
  type AvisoDelCatalogo,
  type CatalogoCompleto,
  type FamiliaDelCatalogoCompleto,
  type OrigenDeRegla,
  type PiezaDelCatalogo,
  type ReglaDelCatalogo,
  type UltimaAuditoriaDeRegla,
} from "../../../../api/validacionCatalogo";

// --- Familias ----------------------------------------------------------------

/** Claves de la columna que no son una familia del motor. */
export const FAMILIA_SIN_EVALUAR = "sin-evaluar";
export const FAMILIA_PROPIAS_VACIA = "propias";
export const FAMILIA_FUERA_DE_AUDITORIA = "fuera-de-auditoria";
/** El grupo del formulario sin plan: su entrada abre el vacío con "Leer el formulario". */
export const FAMILIA_PLAN_SIN_LEER = "plan-sin-leer";

export type EntradaDeFamilia = {
  clave: string;
  nombre: string;
  n: number;
  /** Lleva el punto ámbar: algo en ella pide atención. */
  aviso?: boolean;
};

export type GrupoDeFamilias = {
  id: OrigenDeRegla | "fuera";
  rotulo: string;
  /** Cuántas reglas reúne el grupo; `null` en el grupo que no cuenta reglas. */
  n: number | null;
  entradas: EntradaDeFamilia[];
};

function familiasDe(catalogo: CatalogoCompleto, origen: OrigenDeRegla): EntradaDeFamilia[] {
  return catalogo.familias
    .filter((f) => f.origen === origen)
    .map((f) => ({ clave: f.familia, nombre: f.nombre, n: f.n }));
}

function sumaDe(entradas: readonly EntradaDeFamilia[]): number {
  return entradas.reduce((suma, e) => suma + e.n, 0);
}

/**
 * La columna "Familias", en el orden del prototipo: del formulario (con "Sin
 * evaluar" al final, si hay), del operativo, propias y, al pie, las preguntas
 * fuera de la auditoría (D-F7c). Sin reglas propias el grupo conserva una
 * entrada, para que la familia vacía (y sus sugeridas) se pueda abrir.
 */
export function columnaDeFamilias(catalogo: CatalogoCompleto, nExcluidas: number | null): GrupoDeFamilias[] {
  const formulario = familiasDe(catalogo, "formulario");
  if (!catalogo.plan_construido) formulario.push({ clave: FAMILIA_PLAN_SIN_LEER, nombre: "Plan sin leer", n: 0, aviso: true });
  const nSinEvaluar = catalogo.n_sin_evaluar ?? catalogo.reglas.filter((r) => r.estado_evaluacion === "sin_evaluar").length;
  if (nSinEvaluar > 0) formulario.push({ clave: FAMILIA_SIN_EVALUAR, nombre: "Sin evaluar", n: nSinEvaluar, aviso: true });
  const operativo = familiasDe(catalogo, "operativo");
  const propias = familiasDe(catalogo, "propia");
  return [
    { id: "formulario", rotulo: "Del formulario", n: catalogo.por_origen.formulario ?? sumaDe(familiasDe(catalogo, "formulario")), entradas: formulario },
    { id: "operativo", rotulo: "Del operativo", n: catalogo.por_origen.operativo ?? sumaDe(operativo), entradas: operativo },
    {
      id: "propia",
      rotulo: "Propias",
      n: catalogo.por_origen.propia ?? sumaDe(propias),
      entradas: propias.length ? propias : [{ clave: FAMILIA_PROPIAS_VACIA, nombre: "Reglas propias", n: 0 }],
    },
    {
      id: "fuera",
      rotulo: "Fuera de la auditoría",
      n: null,
      entradas: [{ clave: FAMILIA_FUERA_DE_AUDITORIA, nombre: "Preguntas excluidas", n: nExcluidas ?? 0 }],
    },
  ];
}

export function entradaDeFamilia(grupos: readonly GrupoDeFamilias[], clave: string): EntradaDeFamilia | null {
  for (const g of grupos) {
    const hallada = g.entradas.find((e) => e.clave === clave);
    if (hallada) return hallada;
  }
  return null;
}

export function grupoDeLaFamilia(grupos: readonly GrupoDeFamilias[], clave: string): GrupoDeFamilias | null {
  return grupos.find((g) => g.entradas.some((e) => e.clave === clave)) ?? null;
}

/**
 * La familia abierta: la que nombra la dirección si existe; si no, la de la
 * regla del foco; si no, la primera con reglas.
 */
export function familiaAbierta(
  catalogo: CatalogoCompleto,
  grupos: readonly GrupoDeFamilias[],
  pedida: string | null,
  foco: string | null,
): string {
  if (pedida && entradaDeFamilia(grupos, pedida)) return pedida;
  if (!catalogo.plan_construido && !foco) return FAMILIA_PLAN_SIN_LEER;
  if (foco) {
    const regla = catalogo.reglas.find((r) => r.id === foco || r.id_motor === foco);
    if (regla && entradaDeFamilia(grupos, regla.familia)) return regla.familia;
  }
  for (const g of grupos) {
    const conReglas = g.entradas.find((e) => e.n > 0 && e.clave !== FAMILIA_FUERA_DE_AUDITORIA);
    if (conReglas) return conReglas.clave;
  }
  return FAMILIA_PROPIAS_VACIA;
}

/** Las reglas de una familia, en el orden del catálogo. */
export function reglasDeLaFamilia(catalogo: CatalogoCompleto, clave: string): ReglaDelCatalogo[] {
  if (clave === FAMILIA_SIN_EVALUAR) return catalogo.reglas.filter((r) => r.estado_evaluacion === "sin_evaluar");
  if (clave === FAMILIA_PROPIAS_VACIA || clave === FAMILIA_FUERA_DE_AUDITORIA || clave === FAMILIA_PLAN_SIN_LEER) return [];
  return catalogo.reglas.filter((r) => r.familia === clave);
}

/** La regla de la ficha: la del foco si está en la lista; si no, la primera. */
export function reglaElegida(reglas: readonly ReglaDelCatalogo[], foco: string | null): ReglaDelCatalogo | null {
  if (foco) {
    const hallada = reglas.find((r) => r.id === foco) ?? reglas.find((r) => r.id_motor === foco);
    if (hallada) return hallada;
  }
  return reglas[0] ?? null;
}

/** Cuántas filas de una familia se muestran antes de "Ver las N". */
export const FILAS_A_LA_VISTA = 40;

// --- Textos de una regla -----------------------------------------------------

const ROTULOS_DE_TRATAMIENTO: Readonly<Record<string, string>> = ROTULO_DE_TRATAMIENTO;

export function rotuloDeClase(clase: ReglaDelCatalogo["clase"]): string {
  return clase === "caso_a_revisar" ? "Caso a revisar" : "Inconsistencia";
}

/** "Vaciar la respuesta", "Sin propuesta, uno por uno". */
export function textoDeTratamiento(tratamiento: ReglaDelCatalogo["tratamiento"]): string {
  const accion = tratamiento.accion ? ROTULOS_DE_TRATAMIENTO[tratamiento.accion] ?? "Otro tratamiento" : "Sin propuesta";
  if (tratamiento.alcance === "single") return `${accion}, uno por uno`;
  if (tratamiento.alcance === "selected") return `${accion}, sobre una selección`;
  return accion;
}

/** El alcance del tratamiento previsto; `null` si la regla no lo prevé. */
export function textoDeAlcance(alcance: string | null): string | null {
  if (alcance === "all") return "Todos los casos";
  if (alcance === "selected") return "Una selección de casos";
  if (alcance === "single") return "Uno por uno";
  return null;
}

function unidad(nivel: UltimaAuditoriaDeRegla["nivel"], n: number): string {
  if (nivel === "registro") return n === 1 ? "registro" : "registros";
  return n === 1 ? "caso" : "casos";
}

export type EstadoDeFila =
  | { tipo: "casos"; cifra: string; unidad: string; decididos: string }
  | { tipo: "sin-casos" }
  | { tipo: "sin-evaluar"; causa: string }
  | { tipo: "desactivada" }
  | { tipo: "sin-auditar" };

/** Lo que dice la fila a la derecha: casos y decididos, o por qué no los tiene. */
export function estadoDeFila(regla: ReglaDelCatalogo): EstadoDeFila {
  if (!regla.activa) return { tipo: "desactivada" };
  if (regla.estado_evaluacion === "sin_evaluar") return { tipo: "sin-evaluar", causa: regla.causa ?? "No se pudo evaluar" };
  const ultima = regla.ultima_auditoria;
  if (!ultima || ultima.n_casos === null) return { tipo: "sin-auditar" };
  if (ultima.n_casos === 0) return { tipo: "sin-casos" };
  const decididos = ultima.n_decididos ?? 0;
  return {
    tipo: "casos",
    cifra: formatoConteo(ultima.n_casos),
    unidad: unidad(ultima.nivel, ultima.n_casos),
    decididos: decididos >= ultima.n_casos ? "todos decididos" : `${formatoConteo(decididos)} ${decididos === 1 ? "decidido" : "decididos"}`,
  };
}

/** "18 a quienes les correspondía responder": la base de la regla en la última auditoría. */
export function textoDeBase(ultima: UltimaAuditoriaDeRegla): string | null {
  if (ultima.n_base === null) return null;
  return ultima.base_definicion ? `${formatoConteo(ultima.n_base)} ${ultima.base_definicion}` : formatoConteo(ultima.n_base);
}

/** La regla de la otra dirección de un salto, cruzada por id. */
export function parejaDe(catalogo: CatalogoCompleto, regla: ReglaDelCatalogo): ReglaDelCatalogo | null {
  if (!regla.pareja) return null;
  return catalogo.reglas.find((r) => r.id === regla.pareja) ?? null;
}

/** Los avisos del motor que hablan de esta regla (por su id del motor). */
export function avisosDeLaRegla(catalogo: CatalogoCompleto, regla: ReglaDelCatalogo): AvisoDelCatalogo[] {
  const id = regla.id_motor;
  if (!id) return [];
  return catalogo.avisos.filter((a) => a.id_regla === id || a.ids.includes(id));
}

/** Los ids del motor de las reglas con algún aviso propio. */
export function reglasConAviso(catalogo: CatalogoCompleto): Set<string> {
  const ids = new Set<string>();
  for (const a of catalogo.avisos) {
    if (a.id_regla) ids.add(a.id_regla);
    for (const id of a.ids) ids.add(id);
  }
  return ids;
}

// --- Fechas ------------------------------------------------------------------

/** "8 nov" de una fecha ISO, en la hora local; `null` si no se puede leer. */
export function fechaCortaDeAuditoria(valor: string | null): string | null {
  return fechaCorta(valor);
}

/** Hay una auditoría guardada: el catálogo trae su fecha o alguna regla trae su resultado. */
export function hayAuditoria(catalogo: CatalogoCompleto): boolean {
  return !!catalogo.auditada_en || catalogo.reglas.some((r) => r.ultima_auditoria !== null);
}

// --- Cabecera ----------------------------------------------------------------

/** "97/101 reglas activas", "2 sin evaluar" y "8 nov última auditoría". */
export function cifrasDeReglas(catalogo: CatalogoCompleto): CifraDePestana[] {
  const cifras: CifraDePestana[] = [];
  if (catalogo.n_activas !== null && catalogo.n_total !== null) {
    cifras.push({
      clave: "reglas-activas",
      valor: formatoConteo(catalogo.n_activas),
      base: formatoConteo(catalogo.n_total),
      rotulo: catalogo.n_total === 1 ? "regla activa" : "reglas activas",
      rango: 1,
    });
  }
  if (catalogo.n_sin_evaluar !== null) {
    cifras.push({
      clave: "sin-evaluar",
      valor: formatoConteo(catalogo.n_sin_evaluar),
      rotulo: "sin evaluar",
      tono: catalogo.n_sin_evaluar > 0 ? "alerta" : "neutral",
      rango: 2,
    });
  }
  if (hayAuditoria(catalogo)) {
    const fecha = fechaCortaDeAuditoria(catalogo.auditada_en);
    cifras.push({
      clave: "ultima-auditoria",
      valor: fecha ?? "Sin fecha",
      rotulo: "última auditoría",
      titulo: fecha ? undefined : "La última auditoría se guardó sin su fecha.",
      rango: 3,
    });
  }
  return cifras;
}

// --- Franja "De las reglas a los hallazgos" -----------------------------------

export type DatosDeLaFranja = {
  /** `cifras_hallazgos.n_casos_evaluados` de la última auditoría; `null` si no se sabe. */
  nCasosAuditados: number | null;
  /** La cola de Hallazgos; `null` mientras no se leyó. */
  cola: readonly Pick<LimpiezaQueueItem, "hallazgo_kind" | "pending">[] | null;
};

function plural(n: number, uno: string, varios: string): string {
  return n === 1 ? uno : varios;
}

/**
 * Los grupos de la franja. Cada cifra de Hallazgos cuenta reglas con casos de
 * la cola (decisión D-F1), no casos: "12 reglas con inconsistencias" son 12
 * reglas de esa clase, y entre todas pueden sumar muchos más casos.
 */
export function gruposDeLaFranja(catalogo: CatalogoCompleto, datos: DatosDeLaFranja): GrupoDeFranja[] {
  const origen = catalogo.por_origen;
  const reglas: CifraDeFranja[] = [
    { id: "formulario", cifra: origen.formulario ?? 0, texto: "del formulario" },
    { id: "operativo", cifra: origen.operativo ?? 0, texto: "del operativo" },
    { id: "propias", cifra: origen.propia ?? 0, texto: plural(origen.propia ?? 0, "propia", "propias") },
  ];
  const grupos: GrupoDeFranja[] = [{ id: "reglas", rotulo: "Reglas", cifras: reglas }];
  if (!hayAuditoria(catalogo) || datos.nCasosAuditados === null) return grupos;
  const fecha = fechaCortaDeAuditoria(catalogo.auditada_en);
  grupos.push({
    id: "auditoria",
    rotulo: "Auditoría",
    cifras: [{
      id: "casos",
      cifra: datos.nCasosAuditados,
      texto: `${plural(datos.nCasosAuditados, "caso", "casos")}${fecha ? `, el ${fecha}` : ""}`,
    }],
  });
  if (datos.cola) {
    const inconsistencias = datos.cola.filter((i) => i.hallazgo_kind !== "caso_validar").length;
    const aRevisar = datos.cola.filter((i) => i.hallazgo_kind === "caso_validar").length;
    grupos.push({
      id: "hallazgos",
      rotulo: "Hallazgos",
      cifras: [
        { id: "inconsistencias", cifra: inconsistencias, texto: plural(inconsistencias, "regla con inconsistencias", "reglas con inconsistencias"), tono: "inconsistencia" },
        { id: "a-revisar", cifra: aRevisar, texto: plural(aRevisar, "regla con casos a revisar", "reglas con casos a revisar"), tono: "aviso" },
      ],
    });
  }
  return grupos;
}

/** El destino de la franja: "Por decidir N" lleva a Hallazgos; sin auditoría, un dato. */
export function destinoDeLaFranja(
  catalogo: CatalogoCompleto,
  datos: DatosDeLaFranja,
  irAHallazgos: () => void,
): DestinoDeFranja {
  if (!hayAuditoria(catalogo) || !datos.cola) return { rotulo: "Hallazgos", texto: "al auditar" };
  return { rotulo: "Por decidir", cifra: datos.cola.filter((i) => i.pending).length, onClick: irAHallazgos };
}

const AVISOS_POR_REGLA: Readonly<Partial<Record<string, (n: number) => string>>> = {
  valor_fuera_de_opciones: (n) =>
    n === 1
      ? "1 regla compara una pregunta con un valor que no está entre sus opciones."
      : `${formatoConteo(n)} reglas comparan una pregunta con un valor que no está entre sus opciones.`,
  condicion_indeterminada: (n) =>
    n === 1
      ? "1 regla tiene una condición que no se pudo evaluar en casi ningún caso."
      : `${formatoConteo(n)} reglas tienen una condición que no se pudo evaluar en casi ningún caso.`,
  cuenta_incompleta: (n) =>
    n === 1
      ? "1 regla no se pudo evaluar en parte de sus casos y su conteo puede quedarse corto."
      : `${formatoConteo(n)} reglas no se pudieron evaluar en parte de sus casos y su conteo puede quedarse corto.`,
};

/**
 * Los avisos del motor en la franja. Los de una sola regla se reúnen por
 * código ("3 reglas comparan..."), y su texto entero va en la ficha de cada
 * una; los generales van tal cual.
 */
export function avisosDeLaFranja(catalogo: CatalogoCompleto): AvisoDeFranja[] {
  const porCodigo = new Map<string, Set<string>>();
  const sueltos: AvisoDeFranja[] = [];
  for (const a of catalogo.avisos) {
    const resumen = AVISOS_POR_REGLA[a.codigo];
    if (a.id_regla && resumen) {
      const ids = porCodigo.get(a.codigo) ?? new Set<string>();
      ids.add(a.id_regla);
      porCodigo.set(a.codigo, ids);
      continue;
    }
    if (!sueltos.some((s) => s.texto === a.texto)) {
      sueltos.push({ id: `${a.codigo}-${sueltos.length}`, texto: a.texto, tono: "aviso" });
    }
  }
  const reunidos = [...porCodigo.entries()].map(([codigo, ids]) => ({
    id: codigo,
    texto: AVISOS_POR_REGLA[codigo]?.(ids.size) ?? "",
    tono: "aviso" as const,
  }));
  return [...reunidos, ...sueltos];
}
