import { describe, expect, test } from "vitest";

import type { MailCheck } from "../../../api/materialMail";
import { SOBRE, cifraDeChequeo, esChequeoConocido, rotuloDeChequeo } from "./modeloCorreo";
import { comoArreglar, destinoDelChequeo } from "./comoArreglar";

// El backend bloquea exportar mientras queden textos de relleno («[fecha límite]»): la Revisión lo nombra,
// cuenta y lleva al primero.
const pendientes = {
  code: "placeholders_pending",
  status: "error",
  value: 8,
  detail: "Quedan 8 textos entre corchetes por completar, como [Nombre del estudio].",
  items: ["[Nombre del estudio]", "[fecha límite]"],
  targets: [{ block_id: "__sobre", prop: "subject" }, { block_id: "plazo", prop: "text" }],
} as unknown as MailCheck;

describe("textos por completar", () => {
  test("se conoce, se nombra sin jerga y cuenta lo que queda", () => {
    expect(esChequeoConocido(pendientes)).toBe(true);
    expect(rotuloDeChequeo(pendientes)).toBe("Textos por completar");
    expect(cifraDeChequeo(pendientes)).toBe("quedan 8");
    expect(cifraDeChequeo({ ...pendientes, value: 1 } as MailCheck)).toBe("queda 1");
    expect(cifraDeChequeo({ ...pendientes, status: "ok", value: 0 } as MailCheck)).toBe("ninguno");
  });

  test("dice cómo arreglarlo y lleva al primer lugar señalado", () => {
    expect(comoArreglar("placeholders_pending")).toMatch(/corchetes/);
    expect(destinoDelChequeo(pendientes, SOBRE)).toBe("__sobre");
  });
});
