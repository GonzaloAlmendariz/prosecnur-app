import { describe, expect, it } from "vitest";
import { fraseDelReparto } from "./colaDeInsistenciaModel";

describe("fraseDelReparto", () => {
  it("sin nadie en cola no dice «0 responsables» ni «0 por llamar»", () => {
    expect(fraseDelReparto({ equipo: 0, repartidos: 400, porLlamarAsignados: 0 })).toBe(
      "Ningún responsable tiene casos en cola. La hoja reparte 400 casos.",
    );
    expect(fraseDelReparto({ equipo: 0, repartidos: null, porLlamarAsignados: 0 })).toBe("Ningún responsable tiene casos en cola.");
  });

  it("con equipo en cola dice quién, cuánto falta por llamar y cuánto reparte la hoja", () => {
    expect(fraseDelReparto({ equipo: 3, repartidos: 1153, porLlamarAsignados: 6 })).toBe(
      "3 responsables con casos en cola; 6 por llamar, ya asignados. La hoja reparte 1,153 casos.",
    );
    expect(fraseDelReparto({ equipo: 1, repartidos: 1, porLlamarAsignados: 1 })).toBe(
      "1 responsable con casos en cola; 1 por llamar, ya asignado. La hoja reparte 1 caso.",
    );
  });
});
