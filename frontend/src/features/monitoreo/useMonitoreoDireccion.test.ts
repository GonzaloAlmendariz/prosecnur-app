import { describe, expect, it } from "vitest";
import {
  decidirSeguimiento,
  monitoreoPestanaDesdeParams,
  monitoreoSeccionDesdeParams,
  pestanaInicialDeSeccion,
} from "./useMonitoreoDireccion";

describe("dirección canónica de Monitoreo", () => {
  it("lee la sección del param canónico", () => {
    expect(monitoreoSeccionDesdeParams("?seccion=avance")).toBe("avance");
    expect(monitoreoSeccionDesdeParams("?seccion=calidad")).toBe("calidad");
    expect(monitoreoSeccionDesdeParams("")).toBeNull();
  });

  it("sigue aceptando el `?tab=` de los enlaces guardados", () => {
    expect(monitoreoSeccionDesdeParams("?tab=avance")).toBe("avance");
  });

  it("el param canónico gana sobre el alias", () => {
    expect(monitoreoSeccionDesdeParams("?tab=fuentes&seccion=avance")).toBe(
      "avance",
    );
  });

  it("traduce los alias por etiqueta visible que usaba el QA", () => {
    // Estas etiquetas venían de `--click-tab "Validación"` y compañía.
    expect(monitoreoSeccionDesdeParams("?tab=Validación")).toBe("calidad");
    expect(monitoreoSeccionDesdeParams("?tab=avance territorial")).toBe("avance");
    expect(monitoreoSeccionDesdeParams("?tab=UMPs")).toBe("modelo");
  });

  it("descarta una sección que no existe en vez de inventarla", () => {
    expect(monitoreoSeccionDesdeParams("?seccion=inexistente")).toBeNull();
  });

  it("lee la pestaña solo del param canónico", () => {
    expect(monitoreoPestanaDesdeParams("?pestana=ump")).toBe("ump");
    // `tab` nunca significó pestaña en Monitoreo: significaba sección.
    expect(monitoreoPestanaDesdeParams("?tab=ump")).toBeNull();
  });

  it("la pestaña de la URL solo aplica a la sección con la que se aterriza", () => {
    const disponibles = ["resumen", "ump", "ritmo", "salidas"];

    // Aterrizo en `avance`: la pestaña es para esta sección.
    expect(
      pestanaInicialDeSeccion("avance", "avance", "resumen", disponibles),
    ).toBe("resumen");

    // Aterrizo en `avance` pero pregunto por la pestaña de `fuentes`: esa
    // sección no la pidió nadie y conserva su default.
    expect(
      pestanaInicialDeSeccion("fuentes", "avance", "sheets", ["sheets", "sm"]),
    ).toBe("sheets");
  });

  it("una pestaña que no existe en la sección cae al default", () => {
    expect(
      pestanaInicialDeSeccion("avance", "avance", "resumen", [
        "resumen",
        "ump",
      ]),
    ).toBe("resumen");
  });
});

describe("seguimiento de la URL sin rebote", () => {
  // Regresión reportada por el usuario el 2026-07-24: al clickear secciones de
  // Monitoreo la vista lo devolvía a otra zona y se trababan click y scroll.
  //
  // Causa: la escritura iba por `history.replaceState` (a espaldas del router)
  // y la lectura por `useLocation`. El `search` del router quedaba viejo, se
  // leía como una petición externa y devolvía la vista a la sección anterior,
  // en bucle.
  it("no reacciona a la URL que escribió la propia vista", () => {
    // La vista pasó a `calidad` y escribió esa URL. El efecto vuelve a correr
    // con ese mismo `search`: no hay nada que seguir.
    expect(
      decidirSeguimiento({
        search: "?modo=territorial&seccion=calidad",
        ultimaEscrita: "?modo=territorial&seccion=calidad",
        seccionActiva: "calidad",
      }),
    ).toEqual({ tipo: "nada" });
  });

  it("el rebote: un `search` viejo NO debe reactivar la sección anterior", () => {
    // Esta es exactamente la entrada que producía el bug cuando lectura y
    // escritura miraban fuentes distintas: la vista ya está en `calidad` y su
    // última escritura fue `calidad`, pero llegaba un `search` rezagado con
    // `avance`. Ahora las dos mitades van por el router, así que este estado no
    // se produce; si alguien vuelve a separarlas, el `ultimaEscrita` desalineado
    // reaparece y este test documenta qué se rompe.
    const accion = decidirSeguimiento({
      search: "?modo=territorial&seccion=avance",
      ultimaEscrita: "?modo=territorial&seccion=calidad",
      seccionActiva: "calidad",
    });
    expect(accion).toEqual({ tipo: "ir-a-seccion", seccion: "avance" });
  });

  it("sigue una sección pedida de verdad desde afuera", () => {
    expect(
      decidirSeguimiento({
        search: "?modo=territorial&seccion=ocurrencias",
        ultimaEscrita: "?modo=territorial&seccion=avance",
        seccionActiva: "avance",
      }),
    ).toEqual({ tipo: "ir-a-seccion", seccion: "ocurrencias" });
  });

  it("aplaza la pestaña cuando también cambia la sección", () => {
    // Pedir `calidad/cuotas` estando en `avance` no puede meter `cuotas` en
    // `avance`: primero cambia la sección, la pestaña llega después.
    expect(
      decidirSeguimiento({
        search: "?seccion=calidad&pestana=cuotas",
        ultimaEscrita: null,
        seccionActiva: "avance",
        pestanaActiva: "resumen",
      }),
    ).toEqual({ tipo: "ir-a-seccion", seccion: "calidad" });
  });

  it("aplica la pestaña cuando la sección ya es la correcta", () => {
    expect(
      decidirSeguimiento({
        search: "?seccion=calidad&pestana=cuotas",
        ultimaEscrita: null,
        seccionActiva: "calidad",
        pestanaActiva: "geolocalizacion",
      }),
    ).toEqual({ tipo: "ir-a-pestana", pestana: "cuotas", seccion: "calidad" });
  });

  it("al montar con la URL ya aplicada no dispara nada", () => {
    // `ultimaEscrita` arranca en null, así que el guard no protege; lo que
    // evita el disparo es que la vista ya se sembró desde la misma URL.
    expect(
      decidirSeguimiento({
        search: "?modo=territorial&seccion=calidad&pestana=cuotas",
        ultimaEscrita: null,
        seccionActiva: "calidad",
        pestanaActiva: "cuotas",
      }),
    ).toEqual({ tipo: "nada" });
  });
});
