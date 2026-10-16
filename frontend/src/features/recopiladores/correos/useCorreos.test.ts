import { describe, expect, test } from "vitest";

import { MailApiError } from "../../../api/materialMail";
import { avisoDeImportacion } from "./useCorreos";

describe("avisoDeImportacion", () => {
  test("una lista sin encabezados se explica en la voz de la vista", () => {
    const e = new MailApiError("E_COLLECTION_MAIL_RECIPIENTS_NO_HEADER", "x", 422, null);
    expect(avisoDeImportacion(e)).toBe("La primera fila parece un destinatario; agrega una fila de encabezados.");
  });

  test("una codificación desconocida pide CSV UTF-8 o XLSX", () => {
    const e = new MailApiError("E_COLLECTION_MAIL_RECIPIENTS_ENCODING", "x", 422, null);
    expect(avisoDeImportacion(e)).toMatch(/CSV UTF-8.*XLSX/);
  });

  test("la plantilla guardada inválida bloquea el import con un mensaje claro", () => {
    const e = new MailApiError("E_COLLECTION_MAIL_TEMPLATE_STORED_INVALID", "x", 409, null);
    expect(avisoDeImportacion(e)).toMatch(/plantilla guardada.*no es válida/i);
  });

  test("otro error conserva el mensaje del backend, sin el motivo interno", () => {
    const e = new MailApiError(
      "E_COLLECTION_MAIL_RECIPIENTS_UNREADABLE",
      "No se pudo leer el archivo de destinatarios. (ref. err-1)",
      422,
      { reason: "parse_error", error_id: "err-1" },
    );
    // `ApiError` añade el código al final, como en el resto de la app.
    expect(avisoDeImportacion(e)).toMatch(/^No se pudo leer el archivo de destinatarios\. \(ref\. err-1\)/);
    expect(avisoDeImportacion(e)).not.toContain("parse_error");
  });
});
