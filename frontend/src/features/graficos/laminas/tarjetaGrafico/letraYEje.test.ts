import { describe, expect, it } from "vitest";
import { conLetraYEje, leerLetraYEje } from "./letraYEje";

// U12 del checklist de mandos del mazo (2026-11-05): letra y eje libre de las agrupadas, en `overrides`.
describe("letra y eje de las agrupadas", () => {
  it("lee los tamaños del mazo: la cifra en mm se ve en puntos", () => {
    expect(leerLetraYEje({ overrides: { size_ejes: 14, size_texto_barras: 4.9, usar_eje_libre: true } }))
      .toEqual({ rotuloPt: 14, cifraPt: 14, ejeLibre: true });
    expect(leerLetraYEje({ overrides: { size_ejes: 12, size_texto_barras: 4.2 } })).toEqual({ rotuloPt: 12, cifraPt: 12, ejeLibre: false });
    expect(leerLetraYEje({})).toEqual({ rotuloPt: null, cifraPt: null, ejeLibre: false });
  });

  it("escribe en overrides sin tocar lo demás; la cifra va en mm", () => {
    const args = { overrides: { orden_barras: "mayor_menor" } };
    expect(conLetraYEje(args, { rotuloPt: 13, cifraPt: 12, ejeLibre: true }))
      .toEqual({ orden_barras: "mayor_menor", size_ejes: 13, size_texto_barras: 4.23, usar_eje_libre: true });
  });

  it("vaciar un tamaño o apagar el eje libre borra su clave; sin claves, null", () => {
    const args = { overrides: { size_ejes: 13, usar_eje_libre: true } };
    expect(conLetraYEje(args, { rotuloPt: null, ejeLibre: false })).toBeNull();
  });
});
