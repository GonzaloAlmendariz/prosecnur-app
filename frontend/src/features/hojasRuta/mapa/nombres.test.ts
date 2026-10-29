import { expect, test } from "vitest";
import { nombreDistrito } from "./nombres";

test("los distritos se leen como nombre propio, con partículas en minúscula", () => {
  expect(nombreDistrito("SAN JUAN DE LURIGANCHO")).toBe("San Juan de Lurigancho");
  expect(nombreDistrito("LOS OLIVOS")).toBe("Los Olivos");
  expect(nombreDistrito("CARMEN DE LA LEGUA REYNOSO")).toBe("Carmen de la Legua Reynoso");
  expect(nombreDistrito("BREÑA")).toBe("Breña");
  expect(nombreDistrito("ATE")).toBe("Ate");
});
