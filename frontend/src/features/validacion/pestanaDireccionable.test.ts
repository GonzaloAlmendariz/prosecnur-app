import { describe, expect, it } from "vitest";

import {
  PARAM_FAMILIA,
  resolverPestana,
  searchConSeleccion,
  searchDeExplorar,
  searchDePestana,
  seleccionDeLaDireccion,
} from "./pestanaDireccionable";

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

  it("la clave vieja de Instrumento abre Reglas, con o sin el panel de la regla", () => {
    // Plan de fidelidad, rebanada V0: antes, con `panel=regla`, abría Hallazgos.
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

describe("lo elegido en la pestaña, según la dirección", () => {
  it("Reglas: la familia y la regla de la ficha", () => {
    expect(seleccionDeLaDireccion({ pedida: "reglas", panel: null, foco: "R_1", familia: "saltos" }))
      .toEqual({ familia: "saltos", foco: "R_1" });
  });

  it("Reglas con el editor abierto: el foco es de la regla que se edita, no de la ficha", () => {
    expect(seleccionDeLaDireccion({ pedida: "reglas", panel: "regla", foco: "nueva", familia: "propias" }))
      .toEqual({ familia: "propias", foco: null });
  });

  it("el enlace viejo al detalle de una regla da esa regla en Reglas", () => {
    expect(seleccionDeLaDireccion({ pedida: "instrumento", panel: "regla", foco: "R_REQ_EDAD", familia: null }))
      .toEqual({ familia: null, foco: "R_REQ_EDAD" });
  });

  it("Hallazgos: el foco es el hallazgo, salvo con el caso abierto; el enlace viejo al detalle abre el hallazgo", () => {
    expect(seleccionDeLaDireccion({ pedida: "hallazgos", panel: null, foco: "R_1", familia: "saltos" }))
      .toEqual({ familia: null, foco: "R_1" });
    expect(seleccionDeLaDireccion({ pedida: "hallazgos", panel: "caso", foco: "AUD-009", familia: null }))
      .toEqual({ familia: null, foco: null });
    expect(seleccionDeLaDireccion({ pedida: "hallazgos", panel: "regla", foco: "R_1", familia: null }))
      .toEqual({ familia: null, foco: "R_1" });
  });

  it("Explorar: el foco es la pregunta explorada, por su código", () => {
    expect(seleccionDeLaDireccion({ pedida: "explorar", panel: null, foco: "edad", familia: "x" })).toEqual({ familia: null, foco: "edad" });
    // Sin pestaña en la dirección se abre Explorar, y su foco también vale.
    expect(seleccionDeLaDireccion({ pedida: null, panel: null, foco: "p10", familia: null })).toEqual({ familia: null, foco: "p10" });
  });

  it("Cierre no elige por la dirección", () => {
    expect(seleccionDeLaDireccion({ pedida: "cierre", panel: null, foco: "x", familia: null })).toEqual({ familia: null, foco: null });
  });

  it("a Explorar se llega con la pregunta en el foco (Ver en Explorar)", () => {
    const s = new URLSearchParams(searchDeExplorar("?pestana=reglas&panel=regla&foco=nueva&familia=saltos", "edad"));
    expect(s.get("pestana")).toBe("explorar");
    expect(s.get("foco")).toBe("edad");
    expect(s.get("panel")).toBeNull();
    expect(s.get(PARAM_FAMILIA)).toBeNull();
  });

  it("un foco o una familia en blanco no eligen nada", () => {
    expect(seleccionDeLaDireccion({ pedida: "reglas", panel: null, foco: "  ", familia: "" })).toEqual({ familia: null, foco: null });
  });
});

describe("escribir la pestaña y lo elegido", () => {
  const leer = (search: string) => new URLSearchParams(search);

  it("cambiar de pestaña descarta el panel, el foco y la familia de la anterior", () => {
    const s = leer(searchDePestana(`?pestana=reglas&panel=regla&foco=R_1&${PARAM_FAMILIA}=saltos`, "hallazgos"));
    expect(s.get("pestana")).toBe("hallazgos");
    expect(s.get("panel")).toBeNull();
    expect(s.get("foco")).toBeNull();
    expect(s.get(PARAM_FAMILIA)).toBeNull();
  });

  it("se puede llegar con lo elegido en la pestaña destino", () => {
    const s = leer(searchDePestana("?pestana=hallazgos&foco=R_9", "reglas", { familia: "propias", foco: "RC_1" }));
    expect(s.get("pestana")).toBe("reglas");
    expect(s.get("foco")).toBe("RC_1");
    expect(s.get(PARAM_FAMILIA)).toBe("propias");
  });

  it("la familia solo se escribe en Reglas", () => {
    const s = leer(searchDePestana("?pestana=reglas", "hallazgos", { familia: "saltos", foco: "R_1" }));
    expect(s.get(PARAM_FAMILIA)).toBeNull();
    expect(s.get("foco")).toBe("R_1");
  });

  it("elegir cambia solo lo que se pasa y conserva la pestaña", () => {
    const base = `?pestana=reglas&${PARAM_FAMILIA}=saltos&foco=R_1`;
    expect(leer(searchConSeleccion(base, { foco: "R_2" })).get(PARAM_FAMILIA)).toBe("saltos");
    expect(leer(searchConSeleccion(base, { foco: "R_2" })).get("foco")).toBe("R_2");
    const sinFamilia = leer(searchConSeleccion(base, { familia: null }));
    expect(sinFamilia.get(PARAM_FAMILIA)).toBeNull();
    expect(sinFamilia.get("pestana")).toBe("reglas");
    expect(sinFamilia.get("foco")).toBe("R_1");
  });
});
