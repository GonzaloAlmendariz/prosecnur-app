import { expect, test } from "vitest";
import { normalizarDecisionCobertura } from "./hojasRuta";

test("la decisión de cobertura se normaliza: vigente null, distritos sin ubigeo fuera", () => {
  const r = normalizarDecisionCobertura({ fase: "field", exigida: [{ ubigeo: "150132", distrito: "SJL", excluida: 0.124 }, { distrito: "x" }], huella: "h", vigente: null });
  expect(r.exigida).toEqual([{ ubigeo: "150132", distrito: "SJL", excluida: 0.124 }]);
  expect(r.vigente).toBeNull();
  expect(normalizarDecisionCobertura({ vigente: 3 }).vigente).toBe(3);
  expect(normalizarDecisionCobertura(null)).toEqual({ fase: "field", exigida: [], huella: "", vigente: null });
});

import { muestraConCuotasRepartidas } from "./hojasRuta";

test("una muestra sin cuota de sexo repartida se detecta (pide 4/4 en todas)", () => {
  expect(muestraConCuotasRepartidas([{ cuota_sexo_totals: "3,5" }, { cuota_sexo_totals: "4,4" }])).toBe(true);
  expect(muestraConCuotasRepartidas([{ cuota_sexo_totals: "3,5" }, {}])).toBe(false);
  expect(muestraConCuotasRepartidas([])).toBe(true);
});
