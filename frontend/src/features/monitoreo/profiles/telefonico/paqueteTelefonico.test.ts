import { describe, expect, it } from "vitest";

import { PIEZAS_DEL_PAQUETE_TELEFONICO, piezasRequeridas } from "../../core/paqueteDeFuentes";
import { buildAcreditacionPhoneSourceContract } from "./TelefonicoSourcesModel";
import { repartoDeFuentes } from "./fuentes/repartoDePestanas";

// La lista compartida de piezas no puede importarse del modelo del perfil —lo
// consumen los dos perfiles y ese modelo vive dentro de uno—, así que la única
// forma de que no se separen es comprobarlo. Si mañana el contrato gana una
// pieza y la lista no, el paquete seguiría diciendo «3» mientras el resumen
// pinta cuatro tarjetas.

describe("el paquete telefónico y el contrato de fuentes cuentan lo mismo", () => {
  it("la lista compartida son los slots del contrato, en su orden", () => {
    const contrato = buildAcreditacionPhoneSourceContract([]);
    expect([contrato.universe.key, contrato.sweep.key, contrato.platform.key])
      .toEqual([...PIEZAS_DEL_PAQUETE_TELEFONICO]);
  });

  it("el resumen ofrece exactamente esas piezas cuando falta alguna", () => {
    expect(repartoDeFuentes("activas", false).slots).toEqual([...PIEZAS_DEL_PAQUETE_TELEFONICO]);
  });

  it("telefónico exige su paquete; los demás modos, lo que hayan declarado", () => {
    expect(piezasRequeridas(true, 0)).toBe(PIEZAS_DEL_PAQUETE_TELEFONICO.length);
    expect(piezasRequeridas(true, 9)).toBe(PIEZAS_DEL_PAQUETE_TELEFONICO.length);
    expect(piezasRequeridas(false, 9)).toBe(9);
    expect(piezasRequeridas(false, 0)).toBe(0);
  });
});
