// Qué hay detrás de lo que el usuario pega al conectar una fuente.
//
// §4.3 de `docs/plan-fuentes-legibles-2026-07.md`. El ANTES pedía pegar un
// «Spreadsheet ID» en un input y no decía nada hasta que se apretaba un botón;
// si lo pegado no servía, el error llegaba desde el backend y hablaba de
// binding. Aquí el diagnóstico es local, inmediato y dice qué hacer.
//
// El tono no se inventa: es el mismo de `lib/captureUrl.ts`, que ya resuelve el
// caso gemelo —distinguir la pantalla administrativa de Kobo de la URL de
// captura— y explica la consecuencia antes de pedir la corrección.
//
// Este módulo es puro y no habla con la red: decide si lo pegado se puede usar.
// Comprobar que existe de verdad es el paso siguiente del flujo, y ese sí
// consulta al servicio.

export type ServicioDeFuente = "google_sheets" | "kobo" | "surveymonkey";

export type DireccionReconocida =
  | { ok: true; servicio: "google_sheets"; spreadsheetId: string }
  | { ok: true; servicio: "kobo"; baseUrl: string; assetUid: string };

export type DireccionRechazada = { ok: false; motivo: MotivoDeRechazo; mensaje: string };

export type MotivoDeRechazo =
  | "vacia"
  | "otro_servicio"
  | "sin_identificador"
  | "no_navegable";

export type LecturaDeDireccion = DireccionReconocida | DireccionRechazada;

function limpio(value: unknown) {
  return String(value ?? "").trim();
}

function rechazo(motivo: MotivoDeRechazo, mensaje: string): DireccionRechazada {
  return { ok: false, motivo, mensaje };
}

/**
 * Un ID de Google Sheets es una cadena larga sin espacios ni barras. Se acepta
 * pegado suelto porque es lo que la app pedía hasta ahora y hay proyectos que
 * lo tienen guardado así, pero el camino que la UI ofrece es pegar la URL.
 */
const ID_SUELTO = /^[A-Za-z0-9_-]{20,}$/;

export function leerDireccionDeSheets(texto: unknown): LecturaDeDireccion {
  const valor = limpio(texto);
  if (!valor) return rechazo("vacia", "Pega la dirección del Google Sheet.");

  const enUrl = valor.match(/spreadsheets\/d\/([A-Za-z0-9_-]+)/i)?.[1];
  if (enUrl) return { ok: true, servicio: "google_sheets", spreadsheetId: enUrl };

  if (ID_SUELTO.test(valor)) return { ok: true, servicio: "google_sheets", spreadsheetId: valor };

  if (/^https?:\/\//i.test(valor)) {
    if (/docs\.google\.com/i.test(valor)) {
      return rechazo(
        "sin_identificador",
        "Esa dirección de Google no apunta a una hoja de cálculo. Abre el Sheet y copia la dirección completa desde la barra del navegador.",
      );
    }
    return rechazo(
      "otro_servicio",
      "Esa dirección no es de Google Sheets. Abre el Sheet y copia la dirección desde la barra del navegador.",
    );
  }

  return rechazo(
    "sin_identificador",
    "No se reconoce como un Google Sheet. Pega la dirección completa del documento.",
  );
}

/**
 * Kobo publica el proyecto en `<servidor>/#/forms/<uid>`, con o sin `/landing`
 * al final. Interesa quedarse con el servidor y el uid por separado: el mismo
 * estudio puede vivir en `kf.kobotoolbox.org`, en `kobo.unhcr.org` o en un
 * servidor propio, y guardar solo el uid deja la fuente sin poder abrirse.
 */
export function leerDireccionDeKobo(texto: unknown): LecturaDeDireccion {
  const valor = limpio(texto);
  if (!valor) return rechazo("vacia", "Pega la dirección del proyecto en Kobo.");

  if (!/^https?:\/\//i.test(valor)) {
    return rechazo(
      "sin_identificador",
      "Pega la dirección completa del proyecto en Kobo, empezando por https://.",
    );
  }

  const uid = valor.match(/#\/forms\/([A-Za-z0-9_-]+)/i)?.[1]
    ?? valor.match(/\/api\/v2\/assets\/([A-Za-z0-9_-]+)/i)?.[1];
  if (!uid) {
    return rechazo(
      "sin_identificador",
      "Esa dirección de Kobo no incluye un formulario. Abre el proyecto en Kobo y copia la dirección desde la barra del navegador.",
    );
  }

  const servidor = valor.match(/^(https?:\/\/[^/]+)/i)?.[1];
  if (!servidor) {
    return rechazo("sin_identificador", "No se reconoce el servidor de Kobo en esa dirección.");
  }

  return { ok: true, servicio: "kobo", baseUrl: servidor.replace(/\/+$/, ""), assetUid: uid };
}

/**
 * SurveyMonkey no se conecta pegando una dirección.
 *
 * No es una limitación de la UI: la app guarda el `base_url` de la API, que no
 * es navegable, y la dirección pública de una encuesta (`/r/<hash>`) no
 * contiene el `survey_id` con el que se leen las respuestas. Se elige del
 * catálogo de la cuenta, y por eso este caso devuelve siempre el mismo
 * diagnóstico en vez de fingir que hay algo que pegar.
 */
export function leerDireccionDeSurveyMonkey(): DireccionRechazada {
  return rechazo(
    "no_navegable",
    "SurveyMonkey no se conecta por dirección: la encuesta se elige del catálogo de tu cuenta.",
  );
}

export function leerDireccion(servicio: ServicioDeFuente, texto: unknown): LecturaDeDireccion {
  if (servicio === "google_sheets") return leerDireccionDeSheets(texto);
  if (servicio === "kobo") return leerDireccionDeKobo(texto);
  return leerDireccionDeSurveyMonkey();
}

/** Si el servicio admite pegar una dirección o solo elegir del catálogo. */
export function admiteDireccionPegada(servicio: ServicioDeFuente) {
  return servicio !== "surveymonkey";
}
