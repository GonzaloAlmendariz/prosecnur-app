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
