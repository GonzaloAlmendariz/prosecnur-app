import { describe, expect, it } from "vitest";
import { buildAcreditacionPhoneSourceContract } from "../TelefonicoSourcesModel";
import { rotuloDeDato } from "./rotulosDeColumna";

describe("rótulos de los datos que espera cada pieza", () => {
  it("toda clave que el contrato espera tiene rótulo", () => {
    const contrato = buildAcreditacionPhoneSourceContract([]);
    const claves = [contrato.universe, contrato.sweep, contrato.platform].flatMap((slot) => slot.expected);
    const sinRotulo = claves.filter((clave) => !rotuloDeDato(clave));
    expect(sinRotulo).toEqual([]);
  });

  it("ningún rótulo repite la clave interna sin tilde", () => {
    expect(rotuloDeDato("atencion")).toBe("Atención");
    expect(rotuloDeDato("tramite")).toBe("Trámite");
    expect(rotuloDeDato("telefono")).toBe("Teléfono");
    expect(rotuloDeDato("CodPulso")).toBe("CodPulso");
  });
});
