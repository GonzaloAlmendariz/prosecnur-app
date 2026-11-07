import { expect, test } from "vitest";
import { nombreDistrito } from "./nombres";

test("los distritos se leen como nombre propio, con partículas en minúscula", () => {
  expect(nombreDistrito("SAN JUAN DE LURIGANCHO")).toBe("San Juan de Lurigancho");
  expect(nombreDistrito("LOS OLIVOS")).toBe("Los Olivos");
  expect(nombreDistrito("CARMEN DE LA LEGUA REYNOSO")).toBe("Carmen de la Legua Reynoso");
  expect(nombreDistrito("BREÑA")).toBe("Breña");
  expect(nombreDistrito("ATE")).toBe("Ate");
});

test("los distritos llevan sus tildes, que la cartografía no trae", () => {
  expect(nombreDistrito("ANCON")).toBe("Ancón");
  expect(nombreDistrito("MI PERU")).toBe("Mi Perú");
  expect(nombreDistrito("SAN MARTIN DE PORRES")).toBe("San Martín de Porres");
  expect(nombreDistrito("VILLA MARIA DEL TRIUNFO")).toBe("Villa María del Triunfo");
  expect(nombreDistrito("JOSE LUIS BUSTAMANTE Y RIVERO")).toBe("José Luis Bustamante y Rivero");
  expect(nombreDistrito("ANDRES AVELINO CACERES DORREGARAY")).toBe("Andrés Avelino Cáceres Dorregaray");
  expect(nombreDistrito("TUPAC AMARU INCA")).toBe("Túpac Amaru Inca");
  expect(nombreDistrito("VEINTISEIS DE OCTUBRE")).toBe("Veintiséis de Octubre");
  // Un nombre que ya trae su tilde o su eñe no cambia.
  expect(nombreDistrito("LA TINGUIÑA")).toBe("La Tinguiña");
});
