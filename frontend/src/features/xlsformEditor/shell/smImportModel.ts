// Modelo puro del diálogo «Traducir encuesta de SurveyMonkey».
//
// Voz de superficie (dirección creativa v3): sin `snake_case`, sin inglés, con
// un único par de conteos —preguntas de SurveyMonkey y campos del formulario—
// en todo el diálogo (checklist 2026-10-14, U6 y U8). Lo técnico (huella de la
// definición y versión del traductor) sólo aparece plegado y truncado.

import type {
  SurveyMonkeyTokenInfo,
  SurveyMonkeyVisualLogicRule,
} from "../../../api/multiIntegrado";
import type { SmSugerenciaLogica } from "../../../api/xlsformSmSugerencias";
import type { VisualLogicQuestion } from "./RuleWizard";

// ── Conteos ──────────────────────────────────────────────────────────────────

function plural(n: number, singular: string, varios: string): string {
  return `${n} ${n === 1 ? singular : varios}`;
}

/** «26 preguntas · 74 campos». */
export function textoConteoSm(preguntas: number, campos: number): string {
  return `${plural(preguntas, "pregunta", "preguntas")} · ${plural(campos, "campo", "campos")}`;
}

export const AYUDA_CONTEO_SM =
  "Preguntas: las que tiene la encuesta en SurveyMonkey. Campos: las variables que tendrá el formulario; cada fila de una matriz es un campo propio.";

export function textoSeccionesSm(n: number): string {
  return plural(n, "sección", "secciones");
}

// ── Saltos ───────────────────────────────────────────────────────────────────

/**
 * Lo que el resumen dice de los saltos. Nunca promete saltos que no hay: la API
 * de SurveyMonkey no los comparte (H4/U7).
 */
export function textoSaltosSm(reglas: number, sugerenciasPendientes: number): string {
  if (reglas > 0) return plural(reglas, "salto", "saltos");
  return sugerenciasPendientes > 0
    ? "Sin saltos: agrégalos o aplica la sugerencia"
    : "Sin saltos: agrégalos en «Lógica SurveyMonkey»";
}

// ── Conexión ─────────────────────────────────────────────────────────────────

export type TonoConexionSm = "lista" | "error" | "sin-token" | "pendiente";

export type EstadoConexionSm = {
  tono: TonoConexionSm;
  valor: string;
  /** Frase para lectores de pantalla y el `title` del chip. */
  detalle: string;
};

/**
 * Estado real de la conexión para el chip de la cabecera (U4): refleja la
 * prueba apenas termina, no espera a que se elija una encuesta.
 */
export function estadoConexionSm({
  hasUsableToken,
  tokenStatus,
  encuestaConectada,
  probando = false,
}: {
  hasUsableToken: boolean;
  tokenStatus: SurveyMonkeyTokenInfo | null;
  encuestaConectada: boolean;
  probando?: boolean;
}): EstadoConexionSm {
  if (encuestaConectada) {
    return { tono: "lista", valor: "Lista", detalle: "Conexión lista: la encuesta ya está cargada." };
  }
  if (probando) {
    return { tono: "pendiente", valor: "Probando…", detalle: "Probando la conexión con SurveyMonkey." };
  }
  if (!hasUsableToken) {
    return { tono: "sin-token", valor: "Sin token", detalle: "Falta el token de SurveyMonkey." };
  }
  if (tokenStatus?.ok === true) {
    return { tono: "lista", valor: "Lista", detalle: "Conexión lista: SurveyMonkey respondió." };
  }
  if (tokenStatus && tokenStatus.ok === false) {
    return tokenStatus.status_code === 401
      ? { tono: "error", valor: "Token rechazado", detalle: "SurveyMonkey rechazó el token: venció o fue revocado." }
      : { tono: "error", valor: "Sin respuesta", detalle: "No se pudo comprobar la conexión con SurveyMonkey." };
  }
  return { tono: "pendiente", valor: "Sin probar", detalle: "Hay un token, pero aún no se probó." };
}

// ── Detalles técnicos ────────────────────────────────────────────────────────

/** «42f8a1c3…9e0d»: se reconoce a simple vista y se copia entero con el botón. */
export function truncarHuella(sha: string | null | undefined, inicio = 8, fin = 4): string {
  const limpio = (sha ?? "").trim();
  if (!limpio) return "";
  if (limpio.length <= inicio + fin + 1) return limpio;
  return `${limpio.slice(0, inicio)}…${limpio.slice(-fin)}`;
}

/** «surveymonkey_api_xlsform/v1» → «Versión 1». */
export function versionTraductorLegible(perfil: string | null | undefined): string {
  const limpio = (perfil ?? "").trim();
  if (!limpio) return "";
  const version = limpio.match(/\/v(\d+(?:\.\d+)*)$/i);
  return version ? `Versión ${version[1]}` : "Versión sin número";
}

// ── Sugerencias de lógica → lógica visual ────────────────────────────────────

/** `Q0001`, `q1`, `p1`, `P01` → `p1`: la misma pregunta escrita de dos maneras. */
export function refCanonicaSm(ref: string): string {
  const limpio = ref.trim();
  const m = limpio.match(/^[pq]0*(\d+)(.*)$/i);
  return m ? `p${Number(m[1])}${(m[2] ?? "").toLowerCase()}` : limpio.toLowerCase();
}

function normalizarEtiqueta(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function preguntaDeSugerencia(
  sugerencia: SmSugerenciaLogica,
  questions: VisualLogicQuestion[],
): VisualLogicQuestion | null {
  const objetivo = refCanonicaSm(sugerencia.variable);
  return questions.find((q) => refCanonicaSm(q.ref) === objetivo) ?? null;
}

function opcionesQueCortan(sugerencia: SmSugerenciaLogica, question: VisualLogicQuestion) {
  const codigos = new Set(sugerencia.opciones_que_cortan.map((o) => o.codigo));
  const etiquetas = new Set(sugerencia.opciones_que_cortan.map((o) => normalizarEtiqueta(o.etiqueta)));
  const porCodigo = question.choices.filter((c) => codigos.has(c.name));
  // El código del instrumento generado puede no coincidir con el de la lista de
  // SurveyMonkey: si ninguno calza, se empareja por la etiqueta que se ve.
  return porCodigo.length
    ? porCodigo
    : question.choices.filter((c) => etiquetas.has(normalizarEtiqueta(c.label)));
}

export type ResultadoAplicarSugerencia =
  | { ok: true; rules: SurveyMonkeyVisualLogicRule[] }
  | { ok: false; motivo: string };

/**
 * Convierte la sugerencia en la regla que la lógica visual ya sabe guardar:
 * para la pregunta sugerida, las opciones que cortan pasan a «Fin de encuesta».
 * Respeta lo que el analista ya haya puesto en otras opciones de esa pregunta y
 * no toca las reglas de otras preguntas.
 */
export function aplicarSugerenciaFinDeEncuesta(
  rules: SurveyMonkeyVisualLogicRule[],
  questions: VisualLogicQuestion[],
  sugerencia: SmSugerenciaLogica,
  newId: () => string,
): ResultadoAplicarSugerencia {
  const question = preguntaDeSugerencia(sugerencia, questions);
  if (!question) {
    return {
      ok: false,
      motivo: `No encontré «${sugerencia.etiqueta}» entre las preguntas que admiten saltos. Agrégalo a mano en «Lógica SurveyMonkey».`,
    };
  }
  const cortan = new Set(opcionesQueCortan(sugerencia, question).map((c) => c.name));
  if (!cortan.size) {
    return {
      ok: false,
      motivo: `Las opciones de «${sugerencia.etiqueta}» no coinciden con las sugeridas. Agrégalo a mano en «Lógica SurveyMonkey».`,
    };
  }
  const existente = rules.find((r) => r.variableRef === question.ref) ?? null;
  const nextRule: SurveyMonkeyVisualLogicRule = {
    id: existente?.id ?? newId(),
    variableRef: question.ref,
    variableLabel: question.label,
    choices: question.choices.map((choice) => {
      const previa = existente?.choices.find((c) => c.choiceName === choice.name);
      return {
        choiceName: choice.name,
        choiceLabel: choice.label,
        choiceIndex: choice.index,
        action: cortan.has(choice.name) ? { kind: "end" as const } : previa?.action ?? { kind: "none" as const },
      };
    }),
  };
  const resto = rules.filter((r) => r.variableRef !== question.ref);
  return { ok: true, rules: [...resto, nextRule] };
}

/** ¿La lógica visual ya corta la encuesta en todas las opciones sugeridas? */
export function sugerenciaYaAplicada(
  rules: SurveyMonkeyVisualLogicRule[],
  questions: VisualLogicQuestion[],
  sugerencia: SmSugerenciaLogica,
): boolean {
  const question = preguntaDeSugerencia(sugerencia, questions);
  if (!question) return false;
  const regla = rules.find((r) => r.variableRef === question.ref);
  if (!regla) return false;
  const cortan = opcionesQueCortan(sugerencia, question);
  return cortan.length > 0 && cortan.every((c) =>
    regla.choices.some((rc) => rc.choiceName === c.name && rc.action.kind === "end"),
  );
}

/** «Si responde «No» a «¿Desea continuar…?» → fin de encuesta». */
export function textoSugerencia(sugerencia: SmSugerenciaLogica, maxEtiqueta = 72): string {
  const opciones = sugerencia.opciones_que_cortan.map((o) => `«${o.etiqueta}»`);
  const respuesta = opciones.length > 1
    ? `${opciones.slice(0, -1).join(", ")} o ${opciones[opciones.length - 1]}`
    : opciones[0] ?? "";
  const etiqueta = sugerencia.etiqueta.length > maxEtiqueta
    ? `${sugerencia.etiqueta.slice(0, maxEtiqueta - 1).trimEnd()}…`
    : sugerencia.etiqueta;
  return `Si responde ${respuesta} a «${etiqueta}» → fin de encuesta`;
}

/** Clave estable de una sugerencia para descartarla sin perderla al recargar. */
export function claveSugerencia(sugerencia: SmSugerenciaLogica): string {
  return `${sugerencia.tipo}:${refCanonicaSm(sugerencia.variable)}`;
}

// ── Perfiles de conexión ─────────────────────────────────────────────────────

type PerfilSm = { id: string; alias: string; is_default: boolean; has_token: boolean };

/**
 * Perfiles guardados a los que se puede cambiar cuando el activo falla (U2):
 * con token y distintos del que acaba de fallar. El predeterminado va primero.
 */
export function perfilesAlternativosSm<T extends PerfilSm>(perfiles: T[], perfilActivoId: string | null | undefined): T[] {
  const activo = (perfilActivoId ?? "").trim() || perfiles.find((p) => p.is_default)?.id || "";
  return perfiles
    .filter((p) => p.has_token && p.id && p.id !== activo)
    .sort((a, b) => Number(b.is_default) - Number(a.is_default));
}
