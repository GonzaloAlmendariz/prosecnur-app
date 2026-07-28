// Validación de URL de captura — espejo de `api/R/capture_url.R`.
//
// Una "URL de captura" es la dirección sobre la que se cuelgan los parámetros de
// personalización por unidad (`?d[campo]=valor` en Kobo, Custom Variables en
// SurveyMonkey) y que después se convierte en QR.
//
// La regla central es el fragmento: todo lo que va después de `#` es local al
// navegador y nunca llega al formulario. Si la URL base trae fragmento, los
// parámetros concatenados quedan dentro de él y el QR abre un formulario en
// blanco, sin trazabilidad. El caso más frecuente es
// `<servidor>/#/forms/<uid>/landing`, la pantalla administrativa del proyecto en
// Kobo, que se diagnostica aparte para poder decir qué hacer en su lugar.
//
// Cualquier cambio aquí debe replicarse en el helper de R: los dos lados
// comparten los mismos códigos y los mismos casos de prueba.

export type CaptureUrlIssue = "" | "vacia" | "no_http" | "landing_kobo" | "fragmento";

const KOBO_LANDING = /#\/forms\/[^/]+\/landing/i;

export function captureUrlIssue(url: unknown): CaptureUrlIssue {
  // Se normaliza como en R (`as.character`) para que un no-string dé el mismo
  // diagnóstico en los dos lados y no solo el mismo rechazo.
  const value = url === null || url === undefined ? "" : String(url).trim();
  if (!value) return "vacia";
  if (!/^https?:\/\//i.test(value)) return "no_http";
  if (KOBO_LANDING.test(value)) return "landing_kobo";
  if (value.includes("#")) return "fragmento";
  return "";
}

export function captureUrlOk(url: unknown): boolean {
  return captureUrlIssue(url) === "";
}

export function captureUrlMessage(issue: CaptureUrlIssue): string {
  switch (issue) {
    case "vacia":
      return "Falta la URL de captura del formulario.";
    case "no_http":
      return "La URL de captura debe empezar con http:// o https://.";
    case "landing_kobo":
      return (
        "Esa es la pantalla administrativa del proyecto en Kobo, no el formulario de captura. " +
        "Los parámetros que van después de '#' no llegan al formulario, así que el QR abriría " +
        "un formulario sin identificar la unidad. Abre el proyecto en Kobo, copia el enlace del " +
        "formulario web y pégalo aquí."
      );
    case "fragmento":
      return (
        "La URL de captura no puede contener '#'. Todo lo que va después del '#' se queda en el " +
        "navegador, así que los parámetros de personalización nunca llegarían al formulario."
      );
    default:
      return "";
  }
}

/** Mensaje listo para mostrar, o cadena vacía si la URL sirve. */
export function captureUrlWarning(url: unknown): string {
  return captureUrlMessage(captureUrlIssue(url));
}
