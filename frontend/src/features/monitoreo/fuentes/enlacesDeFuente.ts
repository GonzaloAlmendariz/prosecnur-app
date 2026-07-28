// Nombre humano y enlace de una fuente de Monitoreo.
//
// Reglas R1 y R2 de `docs/plan-fuentes-legibles-2026-07.md`:
//
//   R1 — el nombre humano manda; el identificador es metadato.
//   R2 — todo identificador con URL se muestra como enlace; cuando no se puede
//        armar, la superficie dice qué falta para tenerlo.
//
// El ANTES que esto reemplaza: `sourceSpreadsheetDisplay()` devolvía el
// identificador acortado *como texto del enlace*
// (`1UMlN7xVAzQOrgl...bDQm5mbQ`), de modo que el usuario veía el ID tanto si
// había enlace como si no. Aquí el texto del enlace es siempre algo que una
// persona puede leer, y el identificador viaja aparte, en `detalleTecnico()`.
//
// Este módulo es infraestructura compartida entre los cuatro modos de
// Monitoreo: no conoce actores, canales ni cuotas. Lo específico de cada modo
// vive en su perfil.

import type { MonitoreoSheetBinding, MonitoreoSource } from "../../../api/client";

/**
 * Un enlace resuelto, o la razón por la que no hay uno.
 *
 * `sin-enlace` no es un error: es el estado normal de una fuente cuyo servicio
 * no expone una dirección web que la app pueda construir con lo que guarda.
 * Se distingue de `falta-dato` —donde el usuario sí puede hacer algo— para que
 * la vista no invite a arreglar lo que no está roto.
 */
export type EnlaceDeFuente =
  | { estado: "enlace"; href: string; texto: string; titulo: string }
  | { estado: "falta-dato"; mensaje: string }
  | { estado: "sin-enlace"; mensaje: string };

export type DetalleTecnico = { etiqueta: string; valor: string };

function texto(value: unknown) {
  return String(value ?? "").trim();
}

function primerTexto(...values: unknown[]) {
  for (const value of values) {
    const found = texto(value);
    if (found) return found;
  }
  return "";
}

function campoDeHoja(source: MonitoreoSource, field: keyof MonitoreoSheetBinding) {
  return texto(source.sheet_binding?.[field]);
}

/**
 * El identificador del spreadsheet puede venir como ID pelado o como URL
 * completa pegada por el usuario. Se normaliza a ID para poder construir
 * siempre la misma dirección.
 */
function idDeSpreadsheet(raw: string) {
  if (!raw) return "";
  return raw.match(/spreadsheets\/d\/([^/?#]+)/i)?.[1] || raw.replace(/^https?:\/\//i, "");
}

/**
 * Nombre legible de la fuente (R1).
 *
 * El orden importa: primero lo que una persona escribió (título de la encuesta,
 * nombre de la hoja, etiqueta de la fuente) y solo al final el identificador,
 * que aquí es último recurso y no punto de partida.
 */
export function nombreDeFuente(source: MonitoreoSource) {
  const nombre = primerTexto(
    source.survey_title,
    source.dimensions?.survey_title,
    campoDeHoja(source, "sheet_name"),
    source.label,
  );
  if (nombre) return nombre;
  // Sin nombre humano no se inventa uno: se nombra el tipo de fuente para que
  // la tarjeta siga siendo legible, y el identificador queda en el detalle.
  if (source.kind === "google_sheets") return "Google Sheet sin nombre";
  if (source.kind === "kobo") return "Formulario Kobo sin nombre";
  if (source.kind === "surveymonkey") return "Encuesta sin nombre";
  return "Fuente sin nombre";
}

/** Nombre del servicio, para decir de dónde viene el dato sin jerga de API. */
export function servicioDeFuente(source: MonitoreoSource) {
  if (source.kind === "google_sheets") return "Google Sheets";
  if (source.kind === "kobo") return "Kobo";
  if (source.kind === "surveymonkey") return "SurveyMonkey";
  return "Fuente manual";
}

function enlaceDeHoja(source: MonitoreoSource): EnlaceDeFuente {
  const raw = campoDeHoja(source, "spreadsheet_id");
  if (!raw) {
    return {
      estado: "falta-dato",
      mensaje: "Falta el enlace del Google Sheet.",
    };
  }
  const href = /^https?:\/\//i.test(raw)
    ? raw
    : `https://docs.google.com/spreadsheets/d/${encodeURIComponent(idDeSpreadsheet(raw))}/edit`;
  const hoja = campoDeHoja(source, "sheet_name");
  return {
    estado: "enlace",
    href,
    // El texto del enlace es el nombre de la hoja o del documento, nunca el ID.
    texto: hoja || nombreDeFuente(source),
    titulo: href,
  };
}

function enlaceDeKobo(source: MonitoreoSource): EnlaceDeFuente {
  const uid = texto(source.asset_uid);
  const base = texto(source.base_url).replace(/\/+$/, "");
  if (!uid) {
    return {
      estado: "falta-dato",
      mensaje: "Falta elegir el formulario de Kobo.",
    };
  }
  if (!base) {
    return {
      estado: "falta-dato",
      mensaje: "Falta el servidor de Kobo de esta fuente.",
    };
  }
  // Pantalla administrativa del proyecto en Kobo. Sirve para abrirlo y NUNCA
  // como URL de captura: el fragmento `#` se queda en el navegador y los
  // parámetros por unidad no llegarían al formulario. Ver `lib/captureUrl.ts`.
  return {
    estado: "enlace",
    href: `${base}/#/forms/${encodeURIComponent(uid)}`,
    texto: `Abrir en Kobo`,
    titulo: "Abre el proyecto en Kobo. No es la dirección de captura del formulario.",
  };
}

function enlaceDeSurveyMonkey(source: MonitoreoSource): EnlaceDeFuente {
  const id = texto(source.survey_id);
  if (!id) {
    return {
      estado: "falta-dato",
      mensaje: "Falta elegir la encuesta de SurveyMonkey.",
    };
  }
  // Deliberadamente NO se construye una dirección web a partir del survey_id.
  // El único `base_url` que la app guarda para SurveyMonkey es el de la API
  // (`api.surveymonkey.com/v3`), que no es navegable, y adivinar la forma de la
  // URL del panel produciría un enlace roto — peor que no ofrecer ninguno.
  //
  // El dato para resolverlo ya existe del lado de R: los recopiladores traen
  // `url_present`, o sea que la URL se conoce y no se expone al frontend.
  // Cuando `MonitoreoSurveyMonkeyCollector` publique esa `url`, este caso pasa
  // a `estado: "enlace"` sin tocar las vistas.
  return {
    estado: "sin-enlace",
    mensaje: "SurveyMonkey no expone la dirección de la encuesta.",
  };
}

/** Enlace para abrir la fuente en su servicio de origen (R2). */
export function enlaceDeFuente(source: MonitoreoSource): EnlaceDeFuente {
  if (source.kind === "google_sheets") return enlaceDeHoja(source);
  if (source.kind === "kobo") return enlaceDeKobo(source);
  if (source.kind === "surveymonkey") return enlaceDeSurveyMonkey(source);
  return { estado: "sin-enlace", mensaje: "Fuente sin servicio externo." };
}

/**
 * Lo que baja al renglón «Detalle técnico» (R1).
 *
 * Son los identificadores que hoy ocupan el subtítulo de cada tarjeta. Siguen
 * estando —hacen falta para soporte y para cruzar con la plataforma— pero
 * dejan de competir con el nombre.
 */
export function detalleTecnico(source: MonitoreoSource): DetalleTecnico[] {
  const filas: DetalleTecnico[] = [];
  const surveyId = texto(source.survey_id);
  const assetUid = texto(source.asset_uid);
  const spreadsheet = idDeSpreadsheet(campoDeHoja(source, "spreadsheet_id"));
  const rango = campoDeHoja(source, "range");
  if (surveyId) filas.push({ etiqueta: "Encuesta en SurveyMonkey", valor: surveyId });
  if (assetUid) filas.push({ etiqueta: "Formulario en Kobo", valor: assetUid });
  if (spreadsheet) filas.push({ etiqueta: "Documento de Google Sheets", valor: spreadsheet });
  if (rango) filas.push({ etiqueta: "Rango leído", valor: rango });
  filas.push({ etiqueta: "Identificador interno", valor: source.id });
  return filas;
}
