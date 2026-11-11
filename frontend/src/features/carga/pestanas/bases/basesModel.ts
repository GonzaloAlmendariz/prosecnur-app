// Carga › Bases (ADR 0142, etapa P4b, rebanada R2): la colección de bases del
// estudio, igual para una base, bases separadas, integrada, independientes y
// grupo repetido. Todo lo que la pestaña dibuja sale de aquí: qué bases hay,
// de dónde viene cada una, qué cifra lleva su tarjeta y qué fuentes la forman.
//
// Las hijas de un grupo repetido van dentro de su base madre y no cuentan como
// base (`esGrupoRepetido`, el mismo criterio que Estado del estudio).

import type { EstudioBase, EstudioMultiIntegratedOrigin, EstudioPayload } from "../../../../api/estudio";
import { esGrupoRepetido, fasesDeBase, type FaseDeBase } from "../../../procesamiento/estado/basesDelEstudioModel";
import type { CargaTopologyResolution } from "../../CargaTopologyModel";
import type { CargaTopologyIntent, MultiBaseStrategy } from "../../store";
import { integratedHistoryArray } from "../../surveymonkey/smBasesModel";

/**
 * El estado de Carga de una base, con la misma lectura y las mismas palabras
 * que la columna "Carga" de Estado del estudio (`fasesDeBase`): "Cargada" o
 * "Incompleta". Es el literal de `status.imported`; el motor no publica si la
 * base está al día ni cuántas decisiones le faltan.
 */
export type EstadoDeCarga = Pick<FaseDeBase, "estado" | "tono" | "detalle">;

export function estadoDeCarga(status: EstudioBase["status"]): EstadoDeCarga | null {
  const carga = fasesDeBase(status)?.find((f) => f.fase === "carga");
  return carga ? { estado: carga.estado, tono: carga.tono, detalle: carga.detalle } : null;
}

/** De dónde viene una base, con el nombre que ve el usuario. Lista cerrada. */
export type OrigenDeCarga =
  | "Archivos"
  | "SurveyMonkey"
  | "KoboToolbox"
  | "Archivo .sav"
  | "Monitoreo"
  | "Formulario publicado"
  | "Otro origen";

/** Nombre de la base de una sola base: el flujo simple la registra así en el estudio. */
export const NOMBRE_BASE_UNICA = "default";

export type FuenteDeBase = {
  clave: string;
  /** Título de la encuesta o nombre del archivo. */
  titulo: string;
  /** El título es un nombre de archivo y se dibuja como tal. */
  esArchivo: boolean;
  /** Vía por la que llegó (correo, QR en aula), si la base la declara. */
  canal: string | null;
  /** De dónde viene esta fuente, con el nombre que ve el usuario. */
  origen: OrigenDeCarga;
  /**
   * Respuestas que aporta la fuente a la base. Solo se sabe por fuente cuando
   * el motor lo publica (`included_records` de cada encuesta de SurveyMonkey);
   * en una base de una sola fuente es la cifra de la base.
   */
  respuestas: number | null;
  /** Última lectura desde la plataforma (ISO), solo si el motor la publica. */
  leidaEl: string | null;
  /** Valor de la columna de origen en una base integrada ("docentes"). */
  llave: string | null;
};

export type HijaDeBase = {
  nombre: string;
  etiqueta: string;
  filas: number | null;
  madre: string;
  estado: EstadoDeCarga | null;
};

export type BaseDeLaColeccion = {
  nombre: string;
  etiqueta: string;
  origen: OrigenDeCarga;
  /** Filas del archivo de respuestas recibido; `null` si no se sabe. */
  respuestas: number | null;
  /** Columnas del archivo de respuestas recibido (antes de prepararlo). */
  columnas: number | null;
  formulario: string | null;
  /** De dónde sale el formulario, en una frase corta ("Formulario cargado (XLSForm)"). */
  formularioDe: string;
  /** Estado de Carga de la base (`status.imported`); `null` si el motor no lo envió. */
  estado: EstadoDeCarga | null;
  fuentes: FuenteDeBase[];
  /** Columna que distingue las fuentes de una base integrada. */
  unidasPor: string | null;
  hijas: HijaDeBase[];
  /** Lo que le falta a la base para tener formulario y respuestas. */
  falta: "formulario" | "respuestas" | null;
  /** Solo SurveyMonkey suma otra encuesta a una base existente (hasta M-C5). */
  puedeAgregarFuente: boolean;
  /** Recibe una versión nueva de sus respuestas desde un archivo (`recibeNuevaVersionDe`). */
  recibeNuevaVersion: boolean;
  /** Se le reemplazan formulario y respuestas (`reemplazaArchivosDe`). */
  reemplazaArchivos: boolean;
  /** La base existe en el estudio: se puede renombrar, quitar y descargar por nombre. */
  enEstudio: boolean;
  base: EstudioBase | null;
};

export type ColeccionDeBases = {
  bases: BaseDeLaColeccion[];
  /** Bases del estudio; los grupos repetidos no cuentan. */
  nBases: number;
  nGruposRepetidos: number;
};

export const CAUSA_SIN_OTRA_FUENTE = "Todavía no se pueden unir más fuentes a una base de este origen.";

function texto(valor: unknown): string {
  const limpio = String(valor ?? "").trim();
  return limpio === "NA" ? "" : limpio;
}

function entero(valor: unknown): number | null {
  return typeof valor === "number" && Number.isFinite(valor) ? valor : null;
}

/** El título es un archivo (`…_03_08_26.xlsx`), no el título de una encuesta. */
export function esNombreDeArchivo(titulo: string): boolean {
  return /\.(?:xlsx|xls|xlsm|csv|sav|json|zip|txt|tsv|ods)$/i.test(titulo.trim());
}

/**
 * Un nombre que puso el motor y no una persona: minúsculas, cifras y guiones
 * bajos, con al menos un separador (`post_distribution_monitoring_2026_q2`).
 * "docentes" o "Estudiantes 2026" son nombres elegidos.
 */
export function esIdentificador(nombre: string): boolean {
  return /^[a-z0-9]+(?:[_-][a-z0-9]+)+$/.test(nombre.trim());
}

/**
 * Nombre de la base en Carga. Es el que eligió el usuario (el que se renombra)
 * salvo cuando la base todavía lleva el identificador que le puso el motor:
 * entonces se lee el título de su encuesta, como lo hacen el selector de bases
 * y Estado del estudio (`source_alias` y luego `source_title`). Un título que es
 * un nombre de archivo no sirve de nombre. El identificador queda en el `title`.
 */
export function etiquetaDeBase(base: Pick<EstudioBase, "nombre" | "source_alias" | "source_title" | "repeat_group">): string {
  const propio = [texto(base.source_alias), texto(base.source_title)]
    .find((t) => t && t !== base.nombre && !esNombreDeArchivo(t)) ?? "";
  if (base.nombre === NOMBRE_BASE_UNICA) return propio || "Base única";
  if (!esIdentificador(base.nombre)) return base.nombre;
  if (propio) return propio;
  // Sin título: el identificador con formato mínimo, partido en palabras y no a
  // media palabra. Una hija de grupo repetido se nombra por su grupo. No se
  // inventa un nombre: la etiqueta del grupo en el formulario no llega en
  // `/api/estudio` (pedido al motor).
  const grupo = texto(base.repeat_group);
  return identificadorLegible(grupo || base.nombre);
}

/** `rep_servicios` → "Rep servicios": guiones por espacios y mayúscula inicial; nada más. */
export function identificadorLegible(identificador: string): string {
  const palabras = identificador.trim().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
  return palabras ? palabras.charAt(0).toLocaleUpperCase("es") + palabras.slice(1) : identificador;
}

export function origenDeCarga(base: Pick<EstudioBase, "source_kind">): OrigenDeCarga {
  const tipo = texto(base.source_kind).toLowerCase();
  if (tipo.startsWith("formulario_publicado")) return "Formulario publicado";
  if (tipo.startsWith("surveymonkey")) return "SurveyMonkey";
  if (tipo.startsWith("monitoreo")) return "Monitoreo";
  if (tipo.startsWith("kobo")) return "KoboToolbox";
  if (tipo === "sav") return "Archivo .sav";
  // Sin `source_kind` la base entró por el flujo de archivos, que no lo escribe.
  if (tipo === "" || tipo === "manual" || tipo === "local" || tipo === "xlsform" || tipo === "existing_project") return "Archivos";
  return "Otro origen";
}

/**
 * Las bases que reciben "Nueva versión" de sus respuestas: el mismo alcance que
 * tenía la tarjeta de "Bases del estudio" en HEAD (las que su `origenDeBase`
 * llamaba "Archivos" o "Excel"). Quedan fuera SurveyMonkey clásico y el
 * formulario publicado desde SurveyMonkey (se actualizan desde la plataforma),
 * el formulario publicado desde .sav y todo lo de Kobo, grupos repetidos
 * incluidos. Un `source_kind` vacío o "NA" es una base de archivos.
 */
export function recibeNuevaVersionDe(sourceKind: string | null | undefined): boolean {
  const k = texto(sourceKind) || "manual";
  if (k === "surveymonkey" || k === "formulario_publicado_surveymonkey") return false;
  if (k === "formulario_publicado_sav") return false;
  if (k.startsWith("kobo")) return false;
  return true;
}

/**
 * Las bases a las que se les reemplazan formulario y respuestas: las de
 * archivos sin integrar, que son las que creaban los carriles manuales, el
 * único lugar donde HEAD montaba esa acción (`BaseRow` dentro de
 * `CargaManualBaseLanes`). Las de plataforma y las integradas se rehacen desde
 * su origen o su asistente.
 */
export function reemplazaArchivosDe(base: Pick<EstudioBase, "source_kind" | "multi_integrated" | "parent_base">): boolean {
  const k = texto(base.source_kind) || "manual";
  return (k === "manual" || k === "local" || k === "xlsform") && !base.multi_integrated && !texto(base.parent_base);
}

/** Fecha (ISO) de la última lectura desde la plataforma; solo SurveyMonkey la publica en `/api/estudio`. */
function leidaEl(base: EstudioBase): string | null {
  return texto(base.surveymonkey_refreshed_at) || null;
}

function fuentesDeBase(base: EstudioBase): { fuentes: FuenteDeBase[]; unidasPor: string | null } {
  const integradas = integratedHistoryArray<EstudioMultiIntegratedOrigin>(base.multi_integrated?.origins);
  if (integradas.length > 0) {
    return {
      unidasPor: texto(base.multi_integrated?.origin_key_name) || null,
      fuentes: integradas.map((o, i) => {
        const archivo = texto(o.data_file_name);
        const titulo = texto(o.label) || texto(o.key_value) || archivo || texto(o.survey_id) || `Fuente ${i + 1}`;
        return {
          clave: `${texto(o.id) || i}`,
          titulo,
          esArchivo: esNombreDeArchivo(titulo),
          canal: null,
          origen: origenDeCarga({ source_kind: o.source_kind }),
          // El motor no guarda cuántas respuestas aportó cada origen integrado.
          respuestas: null,
          leidaEl: null,
          llave: texto(o.key_value) || null,
        };
      }),
    };
  }
  const sm = base.surveymonkey_sources ?? [];
  if (sm.length > 1) {
    return {
      unidasPor: null,
      fuentes: sm.map((f, i) => {
        const titulo = texto(f.source_title) || texto(f.source_alias) || texto(f.survey_id) || `Encuesta ${i + 1}`;
        return {
          clave: `${texto(f.survey_id)}:${texto(f.channel)}:${i}`,
          titulo,
          esArchivo: false,
          canal: texto(f.channel) || null,
          origen: "SurveyMonkey",
          respuestas: entero(f.included_records),
          leidaEl: leidaEl(base),
          llave: null,
        };
      }),
    };
  }
  const titulo = texto(base.source_title) || texto(base.source_alias) || texto(base.data_file_name);
  if (!titulo) return { fuentes: [], unidasPor: null };
  return {
    unidasPor: null,
    fuentes: [{
      clave: "unica",
      titulo,
      esArchivo: esNombreDeArchivo(titulo),
      canal: texto(base.source_channel) || null,
      origen: origenDeCarga(base),
      respuestas: entero(base.n_filas),
      leidaEl: leidaEl(base),
      llave: null,
    }],
  };
}

/** De dónde sale el formulario de la base, en una frase corta. */
export function formularioDeBase(
  base: Pick<EstudioBase, "source_kind" | "multi_integrated" | "xlsform_file_id">,
): string {
  if (!texto(base.xlsform_file_id)) return "Sin formulario";
  if (base.multi_integrated) return "Formulario integrado";
  const origen = origenDeCarga(base);
  if (origen === "Formulario publicado") return "Formulario publicado";
  if (origen === "SurveyMonkey") return "Formulario leído de la encuesta";
  if (origen === "KoboToolbox" || origen === "Monitoreo") return "Formulario leído de la plataforma";
  return "Formulario cargado (XLSForm)";
}

function filaDeBase(base: EstudioBase, hijas: HijaDeBase[]): BaseDeLaColeccion {
  const origen = origenDeCarga(base);
  const { fuentes, unidasPor } = fuentesDeBase(base);
  const tieneFormulario = Boolean(texto(base.xlsform_file_id));
  const tieneRespuestas = Boolean(texto(base.data_file_id));
  return {
    nombre: base.nombre,
    etiqueta: etiquetaDeBase(base),
    origen,
    respuestas: entero(base.n_filas),
    columnas: entero(base.n_columnas),
    formulario: texto(base.xlsform_file_name) || null,
    formularioDe: formularioDeBase(base),
    estado: estadoDeCarga(base.status),
    fuentes,
    unidasPor,
    hijas,
    falta: !tieneFormulario ? "formulario" : !tieneRespuestas ? "respuestas" : null,
    // Solo la vía SurveyMonkey clásica: una base nacida de un formulario
    // publicado suma sus campañas desde el formulario (ADR 0102).
    puedeAgregarFuente: texto(base.source_kind) === "surveymonkey",
    // Una base integrada se rehace desde su asistente: un archivo suelto la
    // reemplazaría y dejaría sin valor el registro de sus orígenes.
    recibeNuevaVersion: recibeNuevaVersionDe(base.source_kind) && !base.multi_integrated,
    reemplazaArchivos: reemplazaArchivosDe(base),
    enEstudio: true,
    base,
  };
}

/**
 * Las bases madre en su orden, cada una con sus grupos repetidos dentro. Un
 * grupo cuya madre no está en el estudio queda como tarjeta propia al final:
 * no se pierde de la vista.
 */
export function coleccionDelEstudio(estudio: Pick<EstudioPayload, "bases">, orden: readonly string[] = []): ColeccionDeBases {
  const todas = Object.entries(estudio.bases ?? {}).map(([clave, base]) => ({ ...base, nombre: base.nombre || clave }));
  const madres = todas.filter((b) => !esGrupoRepetido(b));
  const hijas = todas.filter((b) => esGrupoRepetido(b));
  const nombresMadre = new Set(madres.map((b) => b.nombre));
  const posicion = (nombre: string) => {
    const i = orden.indexOf(nombre);
    return i < 0 ? Number.POSITIVE_INFINITY : i;
  };
  const ordenadas = madres
    .map((b, alta) => ({ b, alta }))
    .sort((x, y) => posicion(x.b.nombre) - posicion(y.b.nombre) || x.alta - y.alta)
    .map(({ b }) => b);
  const filas = ordenadas.map((madre) => filaDeBase(
    madre,
    hijas
      .filter((h) => texto(h.parent_base) === madre.nombre)
      .map((h) => ({ nombre: h.nombre, etiqueta: etiquetaDeBase(h), filas: entero(h.n_filas), madre: etiquetaDeBase(madre), estado: estadoDeCarga(h.status) })),
  ));
  const huerfanas = hijas.filter((h) => !nombresMadre.has(texto(h.parent_base)));
  for (const h of huerfanas) filas.push(filaDeBase(h, []));
  return { bases: filas, nBases: madres.length, nGruposRepetidos: hijas.length };
}

export type SesionDeUnaBase = {
  tieneFormulario: boolean;
  tieneRespuestas: boolean;
  /** La base `default` del estudio, si la sesión ya lo tiene y se leyó. */
  registrada: EstudioBase | null;
  /** Lo que dejó la última subida en esta sesión de la página. */
  respuestasSubidas: number | null;
  columnasSubidas: number | null;
};

/**
 * Una base sin estudio de varias bases: la tarjeta aparece en cuanto hay
 * formulario o respuestas, y dice lo que le falta.
 */
export function coleccionDeUnaBase(sesion: SesionDeUnaBase): ColeccionDeBases {
  if (!sesion.tieneFormulario && !sesion.tieneRespuestas) return { bases: [], nBases: 0, nGruposRepetidos: 0 };
  const registrada = sesion.registrada;
  const base: BaseDeLaColeccion = registrada
    ? { ...filaDeBase({ ...registrada, nombre: registrada.nombre || NOMBRE_BASE_UNICA }, []), puedeAgregarFuente: false, recibeNuevaVersion: false, reemplazaArchivos: false }
    : {
        nombre: NOMBRE_BASE_UNICA,
        etiqueta: "Base única",
        origen: "Archivos",
        respuestas: null,
        columnas: null,
        formulario: null,
        formularioDe: sesion.tieneFormulario ? "Formulario cargado (XLSForm)" : "Sin formulario",
        estado: null,
        fuentes: [],
        unidasPor: null,
        hijas: [],
        falta: null,
        puedeAgregarFuente: false,
        recibeNuevaVersion: false,
        reemplazaArchivos: false,
        enEstudio: false,
        base: null,
      };
  return {
    bases: [{
      ...base,
      respuestas: sesion.respuestasSubidas ?? base.respuestas,
      columnas: sesion.columnasSubidas ?? base.columnas,
      falta: !sesion.tieneFormulario ? "formulario" : !sesion.tieneRespuestas ? "respuestas" : null,
      // Con una base, los archivos se cambian en sus tarjetas de subida.
      enEstudio: false,
    }],
    nBases: 1,
    nGruposRepetidos: 0,
  };
}

/** La base que nombra el `foco`, incluida una hija de grupo repetido. */
export function baseEnfocada(
  coleccion: ColeccionDeBases,
  foco: string | null,
): { base: BaseDeLaColeccion; hija: HijaDeBase | null } | null {
  const nombre = texto(foco);
  if (!nombre) return null;
  for (const base of coleccion.bases) {
    if (base.nombre === nombre) return { base, hija: null };
    const hija = base.hijas.find((h) => h.nombre === nombre);
    if (hija) return { base, hija };
  }
  return null;
}

/** Cifra de la fila: lo que se cuenta va en el rótulo ("421 respuestas"). */
export function rotuloRespuestas(n: number): string {
  return n === 1 ? "respuesta" : "respuestas";
}

export type CifrasDeLaColeccion = {
  nBases: number;
  nGruposRepetidos: number;
  /** Fuentes de respuestas de las bases madre. */
  nFuentes: number;
  /**
   * Suma de las respuestas recibidas por las bases madre (las filas de un
   * grupo repetido no son respuestas). `null` si alguna base no tiene cifra:
   * una suma parcial diría menos de lo que hay.
   */
  respuestas: number | null;
};

/** Las cifras de la cabecera de Bases; cada una sale solo de aquí. */
export function cifrasDeLaColeccion(coleccion: ColeccionDeBases): CifrasDeLaColeccion {
  const madres = coleccion.bases;
  const conCifra = madres.filter((b) => b.respuestas !== null);
  return {
    nBases: coleccion.nBases,
    nGruposRepetidos: coleccion.nGruposRepetidos,
    nFuentes: madres.reduce((suma, b) => suma + b.fuentes.length, 0),
    respuestas: madres.length > 0 && conCifra.length === madres.length
      ? conCifra.reduce((suma, b) => suma + (b.respuestas ?? 0), 0)
      : null,
  };
}

/**
 * La base que muestra el inspector: la que nombra el `foco` o, sin foco, la
 * primera. El inspector está siempre a la vista, como en el prototipo; elegir
 * otra base escribe su `foco`.
 */
export function baseDelInspector(
  coleccion: ColeccionDeBases,
  foco: string | null,
): { base: BaseDeLaColeccion; hija: HijaDeBase | null } | null {
  const pedida = baseEnfocada(coleccion, foco);
  if (pedida) return pedida;
  const primera = coleccion.bases[0];
  return primera ? { base: primera, hija: null } : null;
}

/** Qué significa la relación, en una frase, bajo su nombre en la línea de la relación. */
export function descripcionDeRelacion(relacion: string): string {
  if (relacion === "Una base") return "Un formulario y sus respuestas. Al agregar otra base se elige cómo se relacionan.";
  if (relacion === "Bases separadas") return "Cada base tiene su formulario y se procesa por su cuenta.";
  if (relacion === "Una base con varias fuentes") return "Las fuentes se reúnen en una base con un formulario guía común.";
  if (relacion === "Bases independientes") return "Cada encuesta es una base; comparten reglas y sus datos no se mezclan.";
  return "Elige cómo se relacionan antes de agregar bases.";
}

/** La relación entre las bases en una línea, con el nombre que ve el usuario. */
export function textoDeRelacion(
  resolucion: Pick<CargaTopologyResolution, "mode" | "strategy">,
  intencion: CargaTopologyIntent,
): string {
  const estrategia: MultiBaseStrategy | null = resolucion.strategy
    ?? (intencion === "separate" || intencion === "integrated" || intencion === "independent" ? intencion : null);
  if (resolucion.mode !== "multi" && estrategia === null && intencion !== "multi") return "Una base";
  if (estrategia === "separate") return "Bases separadas";
  if (estrategia === "integrated") return "Una base con varias fuentes";
  if (estrategia === "independent") return "Bases independientes";
  return "Varias bases, falta decidir cómo se relacionan";
}
