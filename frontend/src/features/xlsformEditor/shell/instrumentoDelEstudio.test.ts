import { describe, expect, it } from "vitest";

import { ofrecerInstrumentoDelEstudio } from "./instrumentoDelEstudio";

const instrumento = { file_id: "f1", nombre: "acnurcg-instrumento.xlsx", base: "Base 1", n_questions: 66 };

describe("ofrecerInstrumentoDelEstudio (hallazgo 12 de la auditoría visual)", () => {
  it("con sólo un borrador de 1 pregunta, se ofrece el instrumento de 66", () => {
    expect(ofrecerInstrumentoDelEstudio(instrumento, [{ source: null, nQuestions: 1 }])).toBe(true);
  });

  it("con la biblioteca vacía también se ofrece", () => {
    expect(ofrecerInstrumentoDelEstudio(instrumento, [])).toBe(true);
  });

  it("si un formulario ya viene de ese archivo, no", () => {
    const forms = [{ source: { kind: "xlsform", original_name: "ACNURCG-instrumento.xlsx" }, nQuestions: 60 }];
    expect(ofrecerInstrumentoDelEstudio(instrumento, forms)).toBe(false);
  });

  it("si ya hay un formulario tan grande como el instrumento, no se le discute", () => {
    expect(ofrecerInstrumentoDelEstudio(instrumento, [{ source: null, nQuestions: 70 }])).toBe(false);
  });

  it("sin instrumento, o con uno sin preguntas, no", () => {
    expect(ofrecerInstrumentoDelEstudio(null, [])).toBe(false);
    expect(ofrecerInstrumentoDelEstudio({ ...instrumento, n_questions: 0 }, [])).toBe(false);
  });
});
