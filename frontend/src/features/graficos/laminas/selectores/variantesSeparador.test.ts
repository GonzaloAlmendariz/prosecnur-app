import { describe, expect, test } from "vitest";
import type { Slide } from "../../../../api/graficos";
import { leerSlideMeta } from "../../slideMeta";
import { conVariante, varianteDe, VARIANTES_LAMINA } from "./tiposLamina";

// G8 (Gonzalo, 2026-10-13): el separador ofrece las versiones del recetario. Un valor junta nivel y versión y se guarda
// en `meta.nivel` y `meta.variante`, que es lo que lee el motor (lamina_seccion_variantes.R).
const sep = (meta: Record<string, unknown> = {}): Slide => ({ id: "s", tipo: "p_slide_seccion", payload: { titulo: "Perfil", meta } });

describe("versiones del separador", () => {
  test("siete versiones: tres de capítulo y cuatro de subcapítulo", () => {
    expect(VARIANTES_LAMINA.p_slide_seccion?.opciones.map((o) => o.valor)).toEqual(
      ["capitulo", "capitulo:numero", "capitulo:fondo", "subcapitulo", "subcapitulo:barra", "subcapitulo:banda", "subcapitulo:sin_lamina"]);
  });

  test("elegir una escribe nivel y versión; volver a la de siempre los borra", () => {
    const banda = { ...sep(), payload: conVariante(sep(), "subcapitulo:banda") } as Slide;
    expect(leerSlideMeta(banda)).toMatchObject({ nivel: "subcapitulo", variante: "banda" });
    expect(varianteDe(banda)).toBe("subcapitulo:banda");
    const capitulo = { ...banda, payload: conVariante(banda, "capitulo") } as Slide;
    expect(leerSlideMeta(capitulo).nivel).toBeUndefined();
    expect(leerSlideMeta(capitulo).variante).toBeUndefined();
    expect(varianteDe(capitulo)).toBe("capitulo");
  });

  test("un subcapítulo de antes (sólo `nivel`) se lee como el sobrio", () => {
    expect(varianteDe(sep({ nivel: "subcapitulo" }))).toBe("subcapitulo");
    expect(varianteDe(sep({ nivel: "subcapitulo", variante: "numero" }))).toBe("subcapitulo");
  });
});
