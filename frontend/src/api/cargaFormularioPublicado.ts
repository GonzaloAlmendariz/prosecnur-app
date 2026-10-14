// cargaFormularioPublicado.ts — la base nace del formulario publicado (ADR 0102).
//
// Primero el instrumento, después los datos: Carga › Agregar base elige una
// revisión publicada en Formularios y trae las respuestas desde SurveyMonkey,
// un `.sav` o un Excel, llevadas a SUS variables y SUS códigos. La vista previa
// declara lo que no calza antes de crear la base; con menos del 80 % de las
// variables del instrumento emparejadas, el backend bloquea.
//
// No se reexporta desde el barrel `client.ts`: el código nuevo importa de su
// módulo de dominio (patrón de `cargaFuentes.ts` y `cargaOrigenExterno.ts`).
//
// R serializa un escalar como vector de largo uno, una lista de un elemento
// como objeto suelto y `NULL` como `{}`: los normalizadores aceptan las tres.

import { apiFetch, handle, headers } from "./core";

export type FuenteRespuestas = "surveymonkey" | "sav" | "excel";

export const FUENTES_RESPUESTAS: readonly FuenteRespuestas[] = ["surveymonkey", "sav", "excel"];

/** Umbral de cobertura bajo el cual el backend bloquea (ADR 0102 §3). */
export const UMBRAL_COBERTURA = 0.8;

export type CampanaPublicada = { survey_id: string; titulo: string };

export type FormularioPublicado = {
  form_id: string;
  form_name: string;
  revision_id: string;
  revision_no: number | null;
  published_at: string;
  survey_id: string;
  campanas: CampanaPublicada[];
  logic_status: string;
  logic_external: boolean;
  /** Programa declarado («SPSS», «R»…), vacío si no se dijo. */
  logic_external_herramienta: string;
  n_campos: number | null;
};

export type VariableConEtiqueta = { variable: string; etiqueta: string };

export type Recodificacion = { variable: string; etiqueta: string; desde: string; hacia: string };

export type EtiquetaSinPar = { etiqueta: string; n: number };

/** Respuestas de una variable cuya etiqueta no está en el formulario, y cuáles son. */
export type OpcionesSinPar = { variable: string; n: number; etiquetas: EtiquetaSinPar[] };

export type FuenteVistaPrevia = { tipo: string; titulo: string; survey_id: string; n_filas: number | null };

export type BloqueoVistaPrevia = { codigo: string; mensaje: string };

export type VistaPreviaFormularioPublicado = {
  n_filas: number | null;
  fuentes: FuenteVistaPrevia[];
  n_emparejadas: number;
  n_variables_instrumento: number;
  /** Fracción 0–1; `null` si el backend no la manda. */
  cobertura: number | null;
  cobertura_texto: string;
  sin_par_instrumento: VariableConEtiqueta[];
  sin_par_fuente: VariableConEtiqueta[];
  recodificaciones: Recodificacion[];
  opciones_sin_par: OpcionesSinPar[];
  bloqueo: BloqueoVistaPrevia | null;
};

export type ImportarFormularioPublicadoResultado = {
  base_name: string;
  n_filas: number | null;
  n_columnas: number | null;
  instrument_revision_id: string;
  origen_declarado: boolean;
};

/** La importación desde SurveyMonkey corre como job; las demás responden al momento. */
export type ImportarFormularioPublicadoRespuesta =
  | { tipo: "job"; job_id: string }
  | { tipo: "listo"; resultado: ImportarFormularioPublicadoResultado };

export type CuerpoVistaPrevia = {
  revision_id: string;
  fuente: FuenteRespuestas;
  file_id?: string;
  incluir_campanas?: boolean;
};

export type CuerpoImportar = CuerpoVistaPrevia & { base_name: string };

// ---------------------------------------------------------------------------
// Normalizadores defensivos
// ---------------------------------------------------------------------------

function registro(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function escalar(value: unknown): unknown {
  return Array.isArray(value) && value.length === 1 ? value[0] : value;
}

function texto(value: unknown): string {
  const v = escalar(value);
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return "";
}

function numeroONulo(value: unknown): number | null {
  const v = escalar(value);
  if (v === null || v === undefined || v === "" || v === "NA") return null;
  if (typeof v === "object") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function enteroONulo(value: unknown): number | null {
  const n = numeroONulo(value);
  return n == null ? null : Math.max(0, Math.round(n));
}

function booleano(value: unknown): boolean {
  const v = escalar(value);
  return v === true || v === 1 || v === "1" || v === "true" || v === "TRUE";
}

/** Lista de objetos: arreglo, objeto suelto (lista de uno) o `{}` (NULL). */
function lista(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) return value.map(registro).filter((r) => Object.keys(r).length > 0);
  const r = registro(value);
  return Object.keys(r).length ? [r] : [];
}

/** Código de opción: «5», «99», o texto si la fuente no trae número. */
function codigo(value: unknown): string {
  const v = escalar(value);
  if (v === null || v === undefined || v === "NA") return "";
  return texto(v);
}

function normalizeCampana(raw: Record<string, unknown>): CampanaPublicada | null {
  const survey_id = texto(raw.survey_id);
  const titulo = texto(raw.titulo) || texto(raw.title);
  if (!survey_id && !titulo) return null;
  return { survey_id, titulo: titulo || survey_id };
}

export function normalizeFormularioPublicado(raw: unknown): FormularioPublicado | null {
  const r = registro(raw);
  const revision_id = texto(r.revision_id);
  if (!revision_id) return null;
  const logic_status = texto(r.logic_status);
  return {
    form_id: texto(r.form_id),
    form_name: texto(r.form_name) || texto(r.form_id) || "Formulario sin nombre",
    revision_id,
    revision_no: enteroONulo(r.revision_no),
    published_at: texto(r.published_at),
    survey_id: texto(r.survey_id),
    campanas: lista(r.campanas).map(normalizeCampana).filter((c): c is CampanaPublicada => c !== null),
    logic_status,
    logic_external: booleano(r.logic_external) || logic_status === "external_declared",
    logic_external_herramienta: texto(r.logic_external_herramienta) || texto(registro(r.logic_external).herramienta),
    n_campos: enteroONulo(r.n_campos),
  };
}

export function normalizeFormulariosPublicados(raw: unknown): FormularioPublicado[] {
  const vistos = new Set<string>();
  const out: FormularioPublicado[] = [];
  for (const item of lista(registro(raw).formularios)) {
    const f = normalizeFormularioPublicado(item);
    if (!f || vistos.has(f.revision_id)) continue;
    vistos.add(f.revision_id);
    out.push(f);
  }
  return out;
}

function variablesConEtiqueta(value: unknown): VariableConEtiqueta[] {
  return lista(value)
    .map((r) => ({ variable: texto(r.variable), etiqueta: texto(r.etiqueta) }))
    .filter((v) => v.variable);
}

export function normalizeVistaPreviaFormularioPublicado(raw: unknown): VistaPreviaFormularioPublicado {
  const r = registro(raw);
  const n_emparejadas = enteroONulo(r.n_emparejadas) ?? 0;
  const n_variables_instrumento = enteroONulo(r.n_variables_instrumento) ?? 0;
  let cobertura = numeroONulo(r.cobertura);
  if (cobertura != null) {
    // Tolera que llegue en porcentaje (0–100) en vez de fracción.
    if (cobertura > 1) cobertura = cobertura / 100;
    cobertura = Math.max(0, Math.min(1, cobertura));
  } else if (n_variables_instrumento > 0) {
    cobertura = Math.min(1, n_emparejadas / n_variables_instrumento);
  }
  const bloqueoRaw = registro(r.bloqueo);
  const mensajeBloqueo = texto(bloqueoRaw.mensaje);
  const codigoBloqueo = texto(bloqueoRaw.codigo);
  return {
    n_filas: enteroONulo(r.n_filas),
    fuentes: lista(r.fuentes).map((f) => ({
      tipo: texto(f.tipo),
      titulo: texto(f.titulo),
      survey_id: texto(f.survey_id),
      n_filas: enteroONulo(f.n_filas),
    })),
    n_emparejadas,
    n_variables_instrumento,
    cobertura,
    cobertura_texto: texto(r.cobertura_texto),
    sin_par_instrumento: variablesConEtiqueta(r.sin_par_instrumento),
    sin_par_fuente: variablesConEtiqueta(r.sin_par_fuente),
    recodificaciones: lista(r.recodificaciones)
      .map((x) => ({ variable: texto(x.variable), etiqueta: texto(x.etiqueta), desde: codigo(x.desde), hacia: codigo(x.hacia) }))
      .filter((x) => x.variable),
    opciones_sin_par: lista(r.opciones_sin_par)
      .map((x) => ({
        variable: texto(x.variable),
        n: enteroONulo(x.n) ?? 0,
        etiquetas: lista(x.etiquetas)
          .map((e) => ({ etiqueta: texto(e.etiqueta), n: enteroONulo(e.n) ?? 0 }))
          .filter((e) => e.etiqueta),
      }))
      .filter((x) => x.variable && x.n > 0),
    bloqueo: mensajeBloqueo || codigoBloqueo
      ? { codigo: codigoBloqueo, mensaje: mensajeBloqueo || "Esta base no se puede crear con este formulario." }
      : null,
  };
}

export function normalizeImportarResultado(raw: unknown): ImportarFormularioPublicadoResultado {
  const r = registro(raw);
  return {
    base_name: texto(r.base_name),
    n_filas: enteroONulo(r.n_filas),
    n_columnas: enteroONulo(r.n_columnas),
    instrument_revision_id: texto(r.instrument_revision_id),
    origen_declarado: booleano(r.origen_declarado),
  };
}

export function normalizeImportarRespuesta(raw: unknown): ImportarFormularioPublicadoRespuesta {
  const jobId = texto(registro(raw).job_id);
  if (jobId) return { tipo: "job", job_id: jobId };
  return { tipo: "listo", resultado: normalizeImportarResultado(raw) };
}

function cuerpo(body: CuerpoVistaPrevia | CuerpoImportar): Record<string, string | boolean> {
  const out: Record<string, string | boolean> = { revision_id: body.revision_id, fuente: body.fuente };
  if ("base_name" in body && body.base_name.trim()) out.base_name = body.base_name.trim();
  if (body.fuente !== "surveymonkey") {
    const fileId = body.file_id?.trim();
    if (!fileId) throw new Error("Sube primero el archivo con las respuestas.");
    out.file_id = fileId;
  } else if (body.incluir_campanas) {
    out.incluir_campanas = true;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Llamadas
// ---------------------------------------------------------------------------

export async function apiCargaFormulariosPublicados(): Promise<FormularioPublicado[]> {
  const raw = await handle<unknown>(
    await apiFetch("/api/carga/formularios-publicados", { headers: headers() }),
  );
  return normalizeFormulariosPublicados(raw);
}

export async function apiCargaFormularioPublicadoVistaPrevia(
  body: CuerpoVistaPrevia,
): Promise<VistaPreviaFormularioPublicado> {
  const raw = await handle<unknown>(
    await apiFetch("/api/carga/formulario-publicado/vista-previa", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(cuerpo(body)),
    }),
  );
  return normalizeVistaPreviaFormularioPublicado(raw);
}

export async function apiCargaFormularioPublicadoImportar(
  body: CuerpoImportar,
): Promise<ImportarFormularioPublicadoRespuesta> {
  const raw = await handle<unknown>(
    await apiFetch("/api/carga/formulario-publicado/importar", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(cuerpo(body)),
    }),
  );
  return normalizeImportarRespuesta(raw);
}
