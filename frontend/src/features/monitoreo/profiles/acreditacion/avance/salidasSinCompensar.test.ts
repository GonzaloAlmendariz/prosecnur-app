import { describe, expect, it } from "vitest";
import type { AcreditacionAdvanceCard } from "./tarjetasDeAvance";
import { tablaDeAcreditacionDelCliente } from "./Salidas";

// Mismo fixture que test-monitoreo-avance-sin-compensar.R: un público en 170 de 100 y otro en 40 de 100.
// El total no compensa: faltan 60 y el cumplimiento es 140 de 200 (70 %), no 210 de 200.
const tarjeta = (id: string, effective: number, meta: number) =>
  ({ id, actor: id, universe: 300, effective, meta }) as unknown as AcreditacionAdvanceCard;

describe("hoja del cliente de acreditación", () => {
  it("el cumplimiento total no compensa sobrantes entre públicos", () => {
    const tabla = tablaDeAcreditacionDelCliente([tarjeta("Estudiantes", 170, 100), tarjeta("Docentes", 40, 100)]);
    const total = tabla?.total ?? [];
    expect(String(total[5])).toMatch(/^70/);
    expect(String(total[6])).toBe("60");
  });
});
