// Campaña complementaria (ADR 0101): lógica pura de la tarjeta y del diálogo.
//
// La presentación vive en `CampanaComplementariaPanel.tsx`,
// `CampanaComplementariaDialog.tsx` y `CampanasDeclaradas.tsx`; aquí van las
// decisiones que se pueden equivocar —quién admite campañas, qué dice la vista
// previa, cómo se escribe la dirección del diálogo— para probarlas sin React.

import type { XlsformFormSource } from "../../../api/multiIntegrado";
import type { CampanaPregunta, CampanaVistaPrevia } from "../../../api/xlsformCampanas";
import { conNivel } from "../../../lib/navegacion/direccion";
import {
  searchConPanel,
  searchSinPanel,
  type PanelDeclarado,
} from "../../../lib/navegacion/paneles";

/**
 * El diálogo de declarar una campaña. Se abre con
 * `?panel=campana-complementaria&foco=<id del formulario>`.
 */
export const PANEL_CAMPANA_COMPLEMENTARIA: PanelDeclarado = {
  id: "campana-complementaria",
  label: "Agregar campaña complementaria",
  clase: "dialogo",
};

export function searchAbrirCampana(search: string, formId: string): string {
  return conNivel(searchConPanel(search, PANEL_CAMPANA_COMPLEMENTARIA), "foco", formId);
}

export function searchCerrarCampana(search: string): string {
  return conNivel(searchSinPanel(search, PANEL_CAMPANA_COMPLEMENTARIA), "foco", null);
}

/** ID de SurveyMonkey de la encuesta principal, o `null` si no viene de allí. */
export function encuestaPrincipalDe(source: XlsformFormSource | null | undefined): string | null {
  if (!source || source.kind !== "surveymonkey") return null;
  const id = typeof source.survey_id === "string" ? source.survey_id.trim() : "";
  return id || null;
}

/** Sólo un formulario traducido de SurveyMonkey puede tener campañas. */
export function admiteCampana(source: XlsformFormSource | null | undefined): boolean {
  return encuestaPrincipalDe(source) != null;
}

export function resumenCampanas(n: number): string {
  if (n <= 0) return "Sólo la encuesta principal";
  return `Principal + ${n} ${n === 1 ? "campaña" : "campañas"}`;
}

function porcentaje(cobertura: number | null): string {
  if (cobertura == null) return "";
  // Hacia abajo: un 79,6 % no puede mostrarse como «80 %» si se bloquea.
  const decimas = Math.floor(cobertura * 1000) / 10;
  return `${decimas.toLocaleString("es-PE", { maximumFractionDigits: 1 })} %`;
}

export function textoCobertura(cobertura: number | null, coberturaTexto: string): string {
  return coberturaTexto || porcentaje(cobertura);
}

/** Proporción mínima de preguntas que deben calzar para ser una campaña (ADR 0101). */
export const UMBRAL_CAMPANA = 0.8;

export type EstadoVeredicto = "completa" | "con_diferencias" | "bloqueada";
export type TonoVeredicto = "success" | "warning" | "danger";
export type IdDiferencia = "faltan" | "extra" | "ambiguas";

/** Preguntas de una diferencia agrupadas como se leen en el instrumento. */
export type SeccionPreguntas = {
  clave: string;
  /** `null` para una tanda de preguntas sueltas: no lleva encabezado. */
  titulo: string | null;
  preguntas: CampanaPregunta[];
};

export type ContadorDiferencia = {
  id: IdDiferencia;
  /** Rótulo corto del contador. */
  titulo: string;
  /** Qué significa, una sola vez, al abrir el detalle. */
  ayuda: string;
  n: number;
  secciones: SeccionPreguntas[];
  /** Pocas (≤ 5) y sin bloqueo: el detalle arranca abierto. */
  abiertoPorDefecto: boolean;
};

export type LecturaVistaPrevia = {
  estado: EstadoVeredicto;
  tono: TonoVeredicto;
  /** El veredicto en una línea. */
  titular: string;
  /** «46 de 74 campos calzan». */
  calce: string;
  /** «62.1 %», tal como lo formatea el servidor. */
  cobertura: string;
  /** 0–100 para el medidor; `null` si el servidor no la manda. */
  porcentaje: number | null;
  puedeDeclarar: boolean;
  /** Indicación cuando no es una campaña de este instrumento. */
  bloqueo: string | null;
  /** Siempre los tres, en el mismo orden: el grupo es par (C2). */
  contadores: ContadorDiferencia[];
};

/** Detalle con más preguntas que esto arranca plegado. */
export const MAX_DETALLE_ABIERTO = 5;


/**
 * Pregunta madre de una variable: `p13_1` → `p13`, `p4_other` → `p4`. Las
 * filas de una matriz de SurveyMonkey comparten madre.
 */
export function preguntaMadre(variable: string): string {
  const limpia = variable.trim();
  return limpia.replace(/_other$/i, "").replace(/_\d+$/, "") || limpia;
}

/**
 * Agrupa por sección. El payload de la vista previa no trae el título de la
 * página, así que la sección se lee de la variable: las filas de una misma
 * matriz (`p13_1`, `p13_3`…) van juntas bajo «Batería p13»; las preguntas
 * sueltas consecutivas forman una tanda sin encabezado. El orden se respeta.
 */
export function agruparPorSeccion(preguntas: readonly CampanaPregunta[]): SeccionPreguntas[] {
  const corridas: Array<{ madre: string; preguntas: CampanaPregunta[] }> = [];
  for (const pregunta of preguntas) {
    const madre = preguntaMadre(pregunta.variable || pregunta.etiqueta);
    const ultima = corridas.at(-1);
    if (ultima && ultima.madre === madre) ultima.preguntas.push(pregunta);
    else corridas.push({ madre, preguntas: [pregunta] });
  }
  const secciones: SeccionPreguntas[] = [];
  for (const corrida of corridas) {
    if (corrida.preguntas.length > 1) {
      secciones.push({ clave: `bateria-${corrida.madre}-${secciones.length}`, titulo: `Batería ${corrida.madre}`, preguntas: corrida.preguntas });
      continue;
    }
    const ultima = secciones.at(-1);
    if (ultima && ultima.titulo === null) ultima.preguntas.push(...corrida.preguntas);
    else secciones.push({ clave: `sueltas-${secciones.length}`, titulo: null, preguntas: [...corrida.preguntas] });
  }
  return secciones;
}

const DIFERENCIAS: ReadonlyArray<{ id: IdDiferencia; titulo: string; ayuda: string }> = [
  {
    id: "faltan",
    titulo: "Quedarán vacías",
    ayuda: "Preguntas del instrumento que esta encuesta no trae: quedarán vacías para sus respuestas.",
  },
  {
    id: "extra",
    titulo: "No entran",
    ayuda: "Preguntas de esta encuesta que el instrumento no tiene: sus respuestas no se leerán.",
  },
  {
    id: "ambiguas",
    titulo: "Ambiguas",
    ayuda: "Preguntas que podrían calzar con más de una del instrumento: no se emparejan.",
  },
];

function textoCalce(emparejadas: number, base: number): string {
  // «Campos»: el mismo número que el import y el editor (n_preguntas_base
  // cuenta variables que reciben respuesta, sin `_other` con madre).
  const sustantivo = base === 1 ? "campo" : "campos";
  const verbo = emparejadas === 1 ? "calza" : "calzan";
  return `${emparejadas} de ${base} ${sustantivo} ${verbo}`;
}

export function leerVistaPrevia(vista: CampanaVistaPrevia): LecturaVistaPrevia {
  const bloqueada = vista.instrumento_distinto;
  const contadores: ContadorDiferencia[] = DIFERENCIAS.map(({ id, titulo, ayuda }) => {
    const preguntas = vista[id];
    return {
      id,
      titulo,
      ayuda,
      n: preguntas.length,
      secciones: agruparPorSeccion(preguntas),
      abiertoPorDefecto: !bloqueada && preguntas.length > 0 && preguntas.length <= MAX_DETALLE_ABIERTO,
    };
  });
  const hayDiferencias = contadores.some((contador) => contador.n > 0);
  const estado: EstadoVeredicto = bloqueada ? "bloqueada" : hayDiferencias ? "con_diferencias" : "completa";
  const tono: TonoVeredicto = estado === "bloqueada" ? "danger" : estado === "con_diferencias" ? "warning" : "success";
  const titular = estado === "bloqueada"
    ? "No es una campaña de este instrumento"
    : estado === "con_diferencias"
      ? "Es una campaña de este instrumento, con diferencias"
      : "Es una campaña de este instrumento";
  const porcentaje = vista.cobertura == null ? null : Math.round(vista.cobertura * 1000) / 10;
  const bloqueo = bloqueada
    ? "Calza menos del 80 % de las preguntas. Impórtala como un formulario propio y relaciónala con este en Equivalencias."
    : null;
  return {
    estado,
    tono,
    titular,
    calce: textoCalce(vista.n_emparejadas, vista.n_preguntas_base),
    cobertura: textoCobertura(vista.cobertura, vista.cobertura_texto),
    porcentaje,
    puedeDeclarar: !bloqueada,
    bloqueo,
    contadores,
  };
}

/** Por qué una encuesta del catálogo no se puede elegir como campaña. */
export function motivoNoElegible(
  surveyId: string,
  principal: string | null,
  declaradas: readonly string[],
): string | null {
  if (principal && surveyId === principal) return "Es la encuesta principal";
  if (declaradas.includes(surveyId)) return "Ya está declarada";
  return null;
}
