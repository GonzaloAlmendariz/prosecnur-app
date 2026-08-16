import { describe, expect, it } from "vitest";

import { resolverPestana } from "./pestanaDireccionable";

// Vara V7: cada estado nuevo de superficie tiene test que lo distingue del
// vecino. Este resolver quedó sin cubrir cuando se publicaron las direcciones
// de Validación, y carga la costura más fácil de romper: `parsearDireccion`
// normaliza el token —minúsculas, `_` a `-`— así que `reglas_custom` vuelve de
// la URL como `reglas-custom` y la comparación tiene que normalizar los dos
// lados.

describe("resolverPestana", () => {
  it("resuelve las cuatro pestañas por su clave", () => {
    expect(resolverPestana("explorar")).toBe("explorar");
    expect(resolverPestana("instrumento")).toBe("instrumento");
    expect(resolverPestana("reglas_custom")).toBe("reglas_custom");
    expect(resolverPestana("limpieza")).toBe("limpieza");
  });

  it("acepta el token normalizado que devuelve la dirección", () => {
    // El control de la costura: sin normalizar los dos lados, esta línea
    // devolvería «explorar» y el deep-link a Criterios de revisión aterrizaría
    // en otra pestaña sin decir nada.
    expect(resolverPestana("reglas-custom")).toBe("reglas_custom");
  });

  it("tolera mayúsculas y espacios de sobra", () => {
    expect(resolverPestana("  LIMPIEZA ")).toBe("limpieza");
    expect(resolverPestana("Reglas Custom")).toBe("reglas_custom");
  });

  it("cae a la primera pestaña cuando la URL no nombra ninguna válida", () => {
    // Un enlace viejo o un typo no puede dejar el rail sin nada seleccionado.
    expect(resolverPestana("inexistente")).toBe("explorar");
    expect(resolverPestana("")).toBe("explorar");
    expect(resolverPestana(null)).toBe("explorar");
    expect(resolverPestana(undefined)).toBe("explorar");
  });
});
