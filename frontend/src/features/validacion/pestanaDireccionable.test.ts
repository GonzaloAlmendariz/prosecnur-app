import { describe, expect, it } from "vitest";

import { resolverPestana } from "./pestanaDireccionable";

// Vara V7: cada estado nuevo de superficie tiene test que lo distingue del
// vecino. `parsearDireccion` normaliza el token (minúsculas, `_` a `-`), así
// que una clave vuelve de la URL normalizada y la comparación tiene que
// normalizar los dos lados. Los alias de las claves viejas los cubre
// `pestanaValidacion.test.ts`; aquí, lo que ve la página.

describe("resolverPestana", () => {
  it("resuelve las cuatro pestañas por su clave", () => {
    expect(resolverPestana("explorar")).toBe("explorar");
    expect(resolverPestana("reglas")).toBe("reglas");
    expect(resolverPestana("hallazgos")).toBe("hallazgos");
    expect(resolverPestana("cierre")).toBe("cierre");
  });

  it("acepta el token normalizado que devuelve la dirección", () => {
    // El control de la costura: sin normalizar, la clave vieja con guion
    // devolvería "explorar" y el enlace aterrizaría en otra pestaña sin decir nada.
    expect(resolverPestana("reglas-custom")).toBe("reglas");
  });

  it("tolera mayúsculas y espacios de sobra", () => {
    expect(resolverPestana("  HALLAZGOS ")).toBe("hallazgos");
    expect(resolverPestana("  LIMPIEZA ")).toBe("hallazgos");
    expect(resolverPestana("Reglas Custom")).toBe("reglas");
  });

  it("el panel de la regla con la clave vieja de Instrumento abre Hallazgos", () => {
    expect(resolverPestana("instrumento", "regla")).toBe("hallazgos");
    expect(resolverPestana("instrumento")).toBe("reglas");
  });

  it("cae a la primera pestaña cuando la URL no nombra ninguna válida", () => {
    // Un enlace viejo o un typo no puede dejar el rail sin nada seleccionado.
    expect(resolverPestana("inexistente")).toBe("explorar");
    expect(resolverPestana("")).toBe("explorar");
    expect(resolverPestana(null)).toBe("explorar");
    expect(resolverPestana(undefined)).toBe("explorar");
  });
});
