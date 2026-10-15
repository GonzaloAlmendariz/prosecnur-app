import { describe, expect, it } from "vitest";
import { CONTACTO_RECETARIO, contactoEfectivo } from "./modeloCierreWord";

// W7: la contraportada usa el contacto propio y, donde falta, el de PULSO PUCP (`.lam_cierre_contacto`).
describe("contraportada del Word", () => {
  it("sin datos, el contacto del recetario; con datos, los propios en el orden del motor", () => {
    expect(contactoEfectivo(undefined)).toEqual([CONTACTO_RECETARIO.correo, CONTACTO_RECETARIO.direccion, CONTACTO_RECETARIO.web]);
    expect(contactoEfectivo({ correo: "unsa@unsa.edu.pe", web: "  " })).toEqual(["unsa@unsa.edu.pe", CONTACTO_RECETARIO.direccion, CONTACTO_RECETARIO.web]);
  });
});
