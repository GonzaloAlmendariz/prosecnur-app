import { describe, expect, it } from "vitest";
import { ESTADOS_QUE_CAEN } from "./RegistroDeCampo";
import { fuenteDelMotor } from "./fuenteDelMotor.testutil";

/**
 * **Quinta lista compartida del perfil, y la única que no declaraba nadie.**
 *
 * La tripleta `sin_acceso · cancelada · reemplazo_pendiente` decide dos cosas en
 * dos sitios: en el motor, qué filas entran en el reporte `brechas` —junto a las
 * que tienen `brecha > 0`—; aquí, cuándo ofrecer la activación de la cadena. Es
 * el mismo concepto, «el aula cayó», y si divergen el motor cuenta como caída una
 * que la pantalla no deja reemplazar, o al revés.
 *
 * Las otras cuatro réplicas estaban dichas en un comentario. Ésta apareció
 * comparando las listas de literales de los dos lados, el 2026-08-30: de diez
 * listas del frontend y setenta y cinco del motor, coincidían exactamente dos, y
 * la otra ya estaba atada.
 */
const R = new URL("../../../../../../api/R/monitoreo_aulas_universitarias.R", import.meta.url);

function caidasDelMotor(): string[] {
  const fuente = fuenteDelMotor(R);
  const m = fuente.match(/operational_status %in% c\(("sin_acceso"[^)]*)\)/);
  if (!m) throw new Error("no se encontró la tripleta de caídas en el motor");
  return [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]);
}

describe("«el aula cayó» significa lo mismo en los dos lados", () => {
  it("la tripleta del motor se lee y no está vacía", () => {
    expect(caidasDelMotor().length).toBeGreaterThanOrEqual(3);
  });

  it("motor y pantalla declaran exactamente los mismos estados", () => {
    expect([...ESTADOS_QUE_CAEN].sort()).toEqual([...caidasDelMotor()].sort());
  });

  it("«reemplazada» NO está, y es deliberado", () => {
    // Ya lo fue: volver a activar consumiría otra reserva sin que nadie lo pida.
    expect(ESTADOS_QUE_CAEN.has("reemplazada")).toBe(false);
    expect(caidasDelMotor()).not.toContain("reemplazada");
  });
});
