import { describe, expect, it } from "vitest";
import type { ArgMetadata } from "../../api/client";

// Los constructores del plan (`p_barras_agrupadas()` y compañía) declaran sus
// formals y NO tienen `...`: `var, titulo, cruces, overrides, base, filtros,
// mostrar_ceros, excluir_opciones`. Un arg de graficador guardado al nivel del
// slot se cae al construir el elemento y nunca llega al motor.
//
// Eso convirtió el orden manual de barras en una REPARACIÓN FANTASMA: guardado
// en el .pulso, visible en pantalla, ausente del PPT. Medido con `trace()`:
// cero llamadas al graficador lo recibían. Este test existe para que no vuelva
// a pasar en silencio.

/** Espeja `overrideArgNames` de GraficadorForm. */
function nombresQueVanAOverrides(
  argsPreset: string[],
  argsGraficador: ArgMetadata[],
): Set<string> {
  const names = new Set(argsPreset);
  for (const a of argsGraficador) if (a.via_overrides) names.add(a.name);
  return names;
}

/** Espeja la rama de `handleChange` que decide dónde se escribe el valor. */
function escribir(
  name: string,
  value: unknown,
  destinoOverrides: Set<string>,
  overridesActuales: Record<string, unknown> = {},
): Record<string, unknown> {
  if (destinoOverrides.has(name)) {
    return { overrides: { ...overridesActuales, [name]: value } };
  }
  return { [name]: value };
}

const arg = (name: string, via?: boolean): ArgMetadata =>
  ({ name, label: name, tipo_input: "text", grupo: "estilo", via_overrides: via }) as unknown as ArgMetadata;

describe("args que viajan por overrides", () => {
  const GRAF = [arg("orden_categorias_manual", true), arg("mostrar_ceros")];
  const PRESET = ["size_ejes", "color_titulo"];

  it("un arg marcado `via_overrides` se escribe dentro de overrides", () => {
    const destino = nombresQueVanAOverrides(PRESET, GRAF);
    const patch = escribir("orden_categorias_manual", ["A", "B"], destino);
    expect(patch).toEqual({ overrides: { orden_categorias_manual: ["A", "B"] } });
    // El control: sin la marca acabaría al nivel del slot, que es donde el
    // constructor lo descarta.
    const sinMarca = nombresQueVanAOverrides(PRESET, [arg("orden_categorias_manual")]);
    expect(escribir("orden_categorias_manual", ["A", "B"], sinMarca))
      .toEqual({ orden_categorias_manual: ["A", "B"] });
  });

  it("los args del preset siguen yendo a overrides, como siempre", () => {
    const destino = nombresQueVanAOverrides(PRESET, GRAF);
    expect(escribir("size_ejes", 13.5, destino)).toEqual({ overrides: { size_ejes: 13.5 } });
  });

  it("un arg del graficador SIN la marca se queda al nivel del slot", () => {
    // `mostrar_ceros` sí es formal del constructor, así que ahí llega bien.
    const destino = nombresQueVanAOverrides(PRESET, GRAF);
    expect(escribir("mostrar_ceros", true, destino)).toEqual({ mostrar_ceros: true });
  });

  it("no pisa los overrides que ya había", () => {
    const destino = nombresQueVanAOverrides(PRESET, GRAF);
    const patch = escribir("orden_categorias_manual", ["A"], destino, { size_ejes: 13.5 });
    expect(patch).toEqual({ overrides: { size_ejes: 13.5, orden_categorias_manual: ["A"] } });
  });
});
