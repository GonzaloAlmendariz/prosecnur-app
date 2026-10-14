// Carga › Agregar base › Formulario publicado (ADR 0102): lógica pura del flujo.
// Primero se elige el instrumento publicado, después de dónde vienen las
// respuestas; la vista previa declara lo que no calza y la base se crea ligada a
// la revisión elegida. Aquí viven el reductor del flujo, los rótulos y el
// veredicto de cobertura; el componente sólo pinta.

import {
  UMBRAL_COBERTURA,
  type FormularioPublicado,
  type FuenteRespuestas,
  type VistaPreviaFormularioPublicado,
} from "../../../api/cargaFormularioPublicado";
import type { ImportJobProgreso } from "../importEnSegundoPlano";
import { formatoConteo, formatoConteoDe } from "../../../lib/formatoNumero";

// ---------------------------------------------------------------------------
// Rótulos
// ---------------------------------------------------------------------------

export function rotuloRevision(revisionNo: number | null): string {
  return revisionNo != null ? `revisión ${revisionNo}` : "revisión publicada";
}

/** «12 campos · 2 campañas · Lógica: fuera de Prosecnur · SPSS». */
export function detallesFormulario(f: FormularioPublicado): string[] {
  const partes: string[] = [];
  if (f.n_campos != null) partes.push(formatoConteoDe(f.n_campos, "campo"));
  if (f.campanas.length) partes.push(formatoConteoDe(f.campanas.length, "campaña"));
  if (f.logic_external) partes.push("Lógica: fuera de Prosecnur · SPSS");
  return partes;
}

export const ROTULOS_FUENTE: Record<FuenteRespuestas, { rotulo: string; ayuda: string }> = {
  surveymonkey: { rotulo: "Su encuesta de SurveyMonkey", ayuda: "Las respuestas se traen de tu cuenta" },
  sav: { rotulo: "Un archivo .sav", ayuda: "El export de SPSS, también uno ya limpiado" },
  excel: { rotulo: "Un Excel", ayuda: "Con las columnas del formulario (.xlsx o .csv)" },
};

/** Las fuentes que este formulario admite: SurveyMonkey sólo si la revisión trae su encuesta. */
export function fuentesDisponibles(f: FormularioPublicado | null): FuenteRespuestas[] {
  if (!f) return [];
  return f.survey_id ? ["surveymonkey", "sav", "excel"] : ["sav", "excel"];
}

/**
 * Nombre de base sugerido desde el formulario: sin tildes, sin espacios ni «$»
 * (la regla de `errorNombreBase`). «Estudiantes — Arte 2026» → «estudiantes_arte_2026».
 */
export function nombreBaseSugerido(formName: string): string {
  return formName
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48);
}

// ---------------------------------------------------------------------------
// Veredicto de la vista previa
// ---------------------------------------------------------------------------

export type Veredicto = {
  nivel: "listo" | "bloqueado";
  porcentaje: number | null;
  titulo: string;
  detalle: string;
};

export function veredictoVistaPrevia(vp: VistaPreviaFormularioPublicado): Veredicto {
  const porcentaje = vp.cobertura != null ? Math.round(vp.cobertura * 100) : null;
  // El backend manda la cobertura como número suelto («100.0»); el texto se arma
  // aquí con lo que el analista reconoce: preguntas de SU formulario.
  const calzan = `${formatoConteo(vp.n_emparejadas)} de ${formatoConteoDe(vp.n_variables_instrumento, "pregunta")} del formulario tienen datos`;
  const bajoUmbral = vp.cobertura != null && vp.cobertura < UMBRAL_COBERTURA;
  if (vp.bloqueo || bajoUmbral) {
    return {
      nivel: "bloqueado",
      porcentaje,
      titulo: "Esta base no es de este formulario",
      detalle: vp.bloqueo?.mensaje || `${calzan}; hace falta al menos el ${Math.round(UMBRAL_COBERTURA * 100)} %.`,
    };
  }
  const filas = vp.n_filas != null ? `${formatoConteoDe(vp.n_filas, "respuesta")} · ` : "";
  return { nivel: "listo", porcentaje, titulo: "Las respuestas calzan con el formulario", detalle: `${filas}${calzan}` };
}

export type Contador = { clave: string; rotulo: string; valor: number; ayuda: string };

/** Los tres contadores pares de lo que no calza. */
export function contadoresVistaPrevia(vp: VistaPreviaFormularioPublicado): Contador[] {
  return [
    {
      clave: "sin-par-instrumento",
      rotulo: "Sin par en la fuente",
      valor: vp.sin_par_instrumento.length,
      ayuda: "Preguntas del formulario que quedan vacías",
    },
    {
      clave: "sin-par-fuente",
      rotulo: "No entran",
      valor: vp.sin_par_fuente.length,
      ayuda: "Columnas de la fuente que el formulario no tiene",
    },
    {
      clave: "opciones-sin-par",
      rotulo: "Opciones sin par",
      valor: vp.opciones_sin_par.reduce((s, x) => s + x.n, 0),
      ayuda: "Respuestas cuya etiqueta no está en el formulario",
    },
  ];
}

// ---------------------------------------------------------------------------
// Tarjeta de la base: el formulario al que quedó ligada
// ---------------------------------------------------------------------------

export type VinculoFormulario = {
  formulario: string;
  revision: string;
  logicaExterna: boolean;
  /** Programa con que se limpió («SPSS», «R»…); vacío si no se declaró. */
  herramienta: string;
};

type BaseLigable = {
  instrument_revision_id?: string | null;
  instrument_revision_binding?: string | null;
};

function textoCampo(base: object, campo: string): string {
  const v = (base as Record<string, unknown>)[campo];
  return typeof v === "string" ? v.trim() : "";
}

function verdadCampo(base: object, campo: string): boolean {
  const v = (base as Record<string, unknown>)[campo];
  if (v === true) return true;
  return !!v && typeof v === "object" && !Array.isArray(v) && Object.keys(v).length > 0;
}

/**
 * «Formulario: <nombre> · revisión N» para una base ligada a una revisión. El
 * nombre sale del catálogo de publicados; si la revisión ya no es la última, se
 * usa lo que la base traiga y, si nada, «Formulario publicado».
 */
export function vinculoFormularioDeBase(base: BaseLigable, formularios: readonly FormularioPublicado[]): VinculoFormulario | null {
  const revisionId = String(base.instrument_revision_id ?? "").trim();
  if (!revisionId) return null;
  const f = formularios.find((x) => x.revision_id === revisionId);
  const formulario = f?.form_name || textoCampo(base, "instrument_form_name") || "Formulario publicado";
  const revisionNo = f?.revision_no ?? null;
  const declarado = verdadCampo(base, "origen_declarado") || verdadCampo(base, "origen_externo");
  const origen = (base as Record<string, unknown>).origen_externo;
  const herramientaBase = origen && typeof origen === "object" ? textoCampo(origen, "herramienta") : "";
  const logicaExterna = Boolean(f?.logic_external) || declarado;
  return {
    formulario,
    revision: rotuloRevision(revisionNo),
    logicaExterna,
    herramienta: logicaExterna ? herramientaBase || f?.logic_external_herramienta || "" : "",
  };
}

/** «Base limpia declarada (SPSS)», o sin programa si no se dijo cuál. */
export function rotuloBaseDeclarada(v: Pick<VinculoFormulario, "herramienta">): string {
  return v.herramienta ? `Base limpia declarada (${v.herramienta})` : "Base limpia declarada";
}

// ---------------------------------------------------------------------------
// Reductor del flujo
// ---------------------------------------------------------------------------

export type ArchivoSubido = { file_id: string; nombre: string };

export type EstadoFlujo = {
  revisionId: string | null;
  fuente: FuenteRespuestas | null;
  incluirCampanas: boolean;
  archivo: ArchivoSubido | null;
  nombreBase: string;
  nombreTocado: boolean;
  fase: "eligiendo" | "subiendo" | "previsualizando" | "creando";
  vistaPrevia: VistaPreviaFormularioPublicado | null;
  progreso: ImportJobProgreso | null;
  error: string;
};

export const ESTADO_INICIAL: EstadoFlujo = {
  revisionId: null,
  fuente: null,
  incluirCampanas: false,
  archivo: null,
  nombreBase: "",
  nombreTocado: false,
  fase: "eligiendo",
  vistaPrevia: null,
  progreso: null,
  error: "",
};

export type AccionFlujo =
  | { tipo: "formulario"; revisionId: string; nombreSugerido: string }
  | { tipo: "fuente"; fuente: FuenteRespuestas }
  | { tipo: "campanas"; incluir: boolean }
  | { tipo: "nombre"; nombre: string }
  | { tipo: "subiendo" }
  | { tipo: "subido"; archivo: ArchivoSubido }
  | { tipo: "previsualizando" }
  | { tipo: "vistaPrevia"; vistaPrevia: VistaPreviaFormularioPublicado }
  | { tipo: "creando" }
  | { tipo: "progreso"; progreso: ImportJobProgreso }
  | { tipo: "error"; mensaje: string }
  | { tipo: "limpiarError" }
  | { tipo: "reiniciar" };

/** Cambiar algo de lo que depende la vista previa la invalida. */
const SIN_VISTA = { vistaPrevia: null, progreso: null, error: "" } as const;

export function reducirFlujo(estado: EstadoFlujo, accion: AccionFlujo): EstadoFlujo {
  switch (accion.tipo) {
    case "formulario":
      if (estado.revisionId === accion.revisionId) return estado;
      return {
        ...ESTADO_INICIAL,
        revisionId: accion.revisionId,
        nombreBase: estado.nombreTocado ? estado.nombreBase : accion.nombreSugerido,
        nombreTocado: estado.nombreTocado,
      };
    case "fuente":
      if (estado.fuente === accion.fuente) return estado;
      return { ...estado, ...SIN_VISTA, fuente: accion.fuente, archivo: null, fase: "eligiendo" };
    case "campanas":
      return { ...estado, ...SIN_VISTA, incluirCampanas: accion.incluir, fase: "eligiendo" };
    case "nombre":
      return { ...estado, nombreBase: accion.nombre, nombreTocado: true };
    case "subiendo":
      return { ...estado, ...SIN_VISTA, archivo: null, fase: "subiendo" };
    case "subido":
      return { ...estado, archivo: accion.archivo, fase: "eligiendo" };
    case "previsualizando":
      return { ...estado, ...SIN_VISTA, fase: "previsualizando" };
    case "vistaPrevia":
      return { ...estado, vistaPrevia: accion.vistaPrevia, fase: "eligiendo" };
    case "creando":
      return { ...estado, progreso: null, error: "", fase: "creando" };
    case "progreso":
      return { ...estado, progreso: accion.progreso };
    case "error":
      return { ...estado, error: accion.mensaje, progreso: null, fase: "eligiendo" };
    case "limpiarError":
      return { ...estado, error: "" };
    case "reiniciar":
      return ESTADO_INICIAL;
    default:
      return estado;
  }
}

/** ¿Hay lo necesario para pedir la vista previa? */
export function puedePrevisualizar(estado: EstadoFlujo): boolean {
  if (!estado.revisionId || !estado.fuente || estado.fase !== "eligiendo") return false;
  return estado.fuente === "surveymonkey" || !!estado.archivo;
}

/** «Crear base» exige una vista previa sin bloqueo y un nombre válido. */
export function puedeCrear(estado: EstadoFlujo, errorNombre: string | null): boolean {
  if (!estado.vistaPrevia || estado.fase !== "eligiendo" || errorNombre) return false;
  return veredictoVistaPrevia(estado.vistaPrevia).nivel === "listo";
}
