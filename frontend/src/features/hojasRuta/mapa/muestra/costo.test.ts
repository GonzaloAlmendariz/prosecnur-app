import { expect, test } from "vitest";
import { PLAN_SUPUESTOS_POR_DEFECTO } from "../../../../api/hojasRuta";
import { costoEstimado } from "./costo";

test("costo estimado: visitas por ruta, jornadas por capacidad y días por encuestadores", () => {
  const plan = { ...PLAN_SUPUESTOS_POR_DEFECTO, visitas_por_jornada: 30, encuestadores: 2, costo_por_entrevista: 10, costo_por_jornada: 100 };
  // Dos distritos de 16 y 20 entrevistas, k = 8, respuesta 0,5 → 16 visitas por ruta.
  const c = costoEstimado([16, 20], 8, { respuesta: 0.5 }, plan);
  // 16: 2 rutas × 16 = 32 visitas → 2 jornadas · 20: 2 × 16 + resto 4 → 8 = 40 visitas → 2 jornadas.
  expect(c.visitas).toBe(72);
  expect(c.jornadas).toBe(4);
  expect(c.dias).toBe(2);
  expect(c.costo).toBe(36 * 10 + 4 * 100);
  expect(c.tieneCostos).toBe(true);
  expect(costoEstimado([], 8, { respuesta: 0.5 }, PLAN_SUPUESTOS_POR_DEFECTO).tieneCostos).toBe(false);
});
