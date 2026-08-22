/**
 * El método con el que se sortea es el que el usuario configuró.
 *
 * `recommendedMethodId` daba prioridad a la recomendación del comparador y sólo
 * caía a la configuración cuando NO había comparación — que era justo el caso en
 * que el botón de sortear estaba deshabilitado. Medido en HSVG2026 el
 * 2026-08-22: config «cube_balanceado», recomendado «pool_controlado», y el
 * botón decía «Sortear con Optimizar repetidos».
 *
 * Gonzalo: «¿por qué te fuerza a compararlos siempre? ¿Por qué no sólo
 * seleccionar uno e ir con ese?».
 */
import { describe, expect, it } from "vitest";
import { resolverMetodoParaSortear } from "../classroomLabModel";

describe("el método del sorteo sale de la configuración", () => {
  it("con un método configurado, ése gana aunque el comparador prefiera otro", () => {
    // El caso decisivo. Sin él, devolver el recomendado pasa cualquier prueba
    // en la que ambos coincidan, que es lo que dejó pasar al mutante en el
    // primer intento de este contrato.
    expect(resolverMetodoParaSortear("sistematico_pps", "pool_controlado")).toBe("sistematico_pps");
  });

  it("sin configuración válida cae al recomendado, no a un id inventado", () => {
    expect(resolverMetodoParaSortear("motor_que_no_existe", "pool_controlado")).toBe("pool_controlado");
    expect(resolverMetodoParaSortear("", "pool_controlado")).toBe("pool_controlado");
  });

  it("los cuatro métodos de la pestaña son configuraciones válidas", () => {
    for (const id of ["sistematico_pps", "cube_balanceado", "local_pivotal_balanceado", "pool_controlado"]) {
      expect(resolverMetodoParaSortear(id, "otro_cualquiera"), `no reconoce ${id}`).toBe(id);
    }
  });
});
