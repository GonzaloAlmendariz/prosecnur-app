import { describe, expect, test } from "vitest";
import { escalonDePoblacion, SECUENCIA_POBLACION } from "./MapaPoblacion";

describe("escalonDePoblacion", () => {
  test("el distrito más poblado toma el último escalón y uno sin dato el primero", () => {
    expect(escalonDePoblacion(940818, 940818)).toBe(SECUENCIA_POBLACION - 1);
    expect(escalonDePoblacion(0, 940818)).toBe(0);
  });

  test("la raíz no aplasta a los distritos chicos: Chorrillos frente a San Juan de Lurigancho", () => {
    // 309.779 / 940.818 = 0,33 → raíz 0,57 → escalón 3 de 0..5.
    expect(escalonDePoblacion(309779, 940818)).toBe(3);
  });
});
