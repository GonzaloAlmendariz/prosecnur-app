// Contrato de presentación de errores (identidad verbal v1.2): el mensaje
// explica qué pasó; el código `E_*` es visible pero AL FINAL, en mono, y
// nunca como único contenido. Este helper separa mensaje y código para que
// ErrorBlock (States.tsx) pinte el código como <code> sin que contamine el
// texto principal.
//
// Formatos reconocidos:
//   - Canónico (ApiError de client.ts):  "mensaje · E_CODE" / "mensaje · HTTP_500"
//   - Legado (productores aún sin migrar, ej. bootClient / MonitoreoPage):
//     "[E_CODE] mensaje" — se normaliza al orden del contrato.

export type SplitErrorDetail = {
  message: string;
  code: string | null;
};

// El separador canónico es « · » y el código va anclado al final. La regex
// toma el ÚLTIMO separador (lazy + anchor), así los «·» dentro del mensaje
// no rompen la detección. Flag `s`: los mensajes de R pueden ser multilínea.
const SUFFIX_RE = /^(.*?)\s*·\s*((?:E_|HTTP_)[A-Z0-9_]+)$/s;
const LEGACY_PREFIX_RE = /^\[((?:E_|HTTP_)[A-Z0-9_]+)\]\s*(.*)$/s;

// Copy de respaldo cuando el string era SOLO el código: el contrato prohíbe
// mostrar un código como único contenido del error.
const NO_DETAIL_FALLBACK = "Ocurrió un error sin más detalle. Reintenta; si persiste, revisa la conexión con el backend.";

export function splitErrorDetail(detail: string): SplitErrorDetail {
  const trimmed = detail.trim();
  if (!trimmed) return { message: "", code: null };

  const suffix = SUFFIX_RE.exec(trimmed);
  if (suffix) {
    const message = suffix[1].trim();
    return { message: message || NO_DETAIL_FALLBACK, code: suffix[2] };
  }

  const legacy = LEGACY_PREFIX_RE.exec(trimmed);
  if (legacy) {
    const message = legacy[2].trim();
    return { message: message || NO_DETAIL_FALLBACK, code: legacy[1] };
  }

  return { message: trimmed, code: null };
}

// La causa de un error en llano, para la forma con causa de ErrorBlock (ADR 0142,
// etapa P7). Dos mensajes no le dicen nada a quien procesa: el del navegador
// cuando el motor no contesta ("Failed to fetch") y el de un error interno del
// motor ("Error interno del servidor (ref. 7F3A21C4)."), cuya referencia va
// aparte con `identificadorDelError`. Los demás mensajes del motor ya son la
// causa y pasan sin el código.
export const CAUSA_SIN_MOTOR = "El motor de la app no respondió.";
export const CAUSA_ERROR_INTERNO = "Es un error inesperado de la app, no de tus datos.";

export function causaDelError(detail: string): string {
  const { message, code } = splitErrorDetail(detail);
  if (/failed to fetch|networkerror|load failed|network request failed/i.test(message)) return CAUSA_SIN_MOTOR;
  if (code === "E_INTERNAL") return CAUSA_ERROR_INTERNO;
  return message;
}

/** La referencia de un error interno (`ref. 7F3A21C4` en el mensaje del motor), para soporte. */
export function identificadorDelError(detail: string): string | undefined {
  return /ref\.\s*([0-9A-F]{6,})/i.exec(detail)?.[1];
}
