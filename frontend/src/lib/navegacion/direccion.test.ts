import { describe, expect, it } from "vitest";
import {
  conNivel,
  describirDireccion,
  hrefSinParamDeProyecto,
  mismaDireccion,
  moduloDesdePathname,
  parsearDireccion,
  parsearDireccionDesdeHref,
  serializarDireccion,
} from "./direccion";

describe("gramática de direcciones", () => {
  it("lee la jerarquía completa desde los params canónicos", () => {
    expect(
      parsearDireccion(
        "/monitoreo",
        "?modo=territorial&seccion=avance&pestana=mapa&panel=filtros&foco=150101",
      ),
    ).toEqual({
      modulo: "monitoreo",
      modo: "territorial",
      seccion: "avance",
      pestana: "mapa",
      panel: "filtros",
      foco: "150101",
    });
  });

  it("resuelve `tab` según el módulo, que es donde estaba la ambigüedad", () => {
    // En Monitoreo `tab` nombraba una sección…
    expect(parsearDireccion("/monitoreo", "?tab=avance")?.seccion).toBe("avance");
    expect(parsearDireccion("/monitoreo", "?tab=avance")?.pestana).toBeUndefined();

    // …y en Hojas de ruta, una pestaña dentro de la sección `stage`.
    const hojas = parsearDireccion("/hojas-ruta", "?stage=entrega&tab=cuotas");
    expect(hojas?.seccion).toBe("entrega");
    expect(hojas?.pestana).toBe("cuotas");
  });

  it("acepta los alias legacy de cada módulo", () => {
    expect(parsearDireccion("/calc-muestra", "?mesa=aulas")?.modo).toBe("aulas");
    expect(parsearDireccion("/calc-muestra", "?desk=aulas")?.modo).toBe("aulas");
    expect(parsearDireccion("/bitacora", "?tab=cronograma")?.seccion).toBe(
      "cronograma",
    );
    expect(parsearDireccion("/monitoreo", "?perfil=aulas")?.modo).toBe("aulas");
  });

  it("prefiere el param canónico sobre su alias", () => {
    expect(
      parsearDireccion("/hojas-ruta", "?stage=muestra&seccion=entrega")?.seccion,
    ).toBe("entrega");
  });

  it("trata las rutas hermanas de Procesamiento como secciones del módulo", () => {
    expect(parsearDireccion("/carga")).toEqual({
      modulo: "procesamiento",
      seccion: "carga",
    });
    expect(parsearDireccion("/graficos")?.seccion).toBe("graficos");
    expect(moduloDesdePathname("/validacion")).toBe("procesamiento");
  });

  it("normaliza tildes, espacios y mayúsculas de los tokens", () => {
    expect(parsearDireccion("/monitoreo", "?seccion=Validación")?.seccion).toBe(
      "validacion",
    );
    expect(
      parsearDireccion("/monitoreo", "?seccion=modelo_operativo")?.seccion,
    ).toBe("modelo-operativo");
  });

  it("devuelve null fuera de la jerarquía de módulos", () => {
    expect(parsearDireccion("/enciclopedia")).toBeNull();
    expect(parsearDireccion("/no-existe")).toBeNull();
  });

  it("preserva params ajenos a la gramática", () => {
    const direccion = parsearDireccion("/graficos", "?scope=consolidado");
    expect(direccion?.extra).toEqual({ scope: "consolidado" });
    expect(serializarDireccion(direccion!)).toContain("scope=consolidado");
  });

  it("no permite que `extra` reinyecte params reservados al serializar", () => {
    const href = serializarDireccion({
      modulo: "hojas-ruta",
      seccion: "entrega",
      pestana: "titulares",
      panel: "filtros",
      extra: {
        tab: "cuotas",
        stage: "muestra",
        modo: "legacy",
        scope: "consolidado",
      },
    });
    const url = new URL(href, "http://local.prosecnur");

    expect(Object.fromEntries(url.searchParams)).toEqual({
      scope: "consolidado",
      seccion: "entrega",
      pestana: "titulares",
      panel: "filtros",
    });
  });

  it("escribe siempre la forma canónica, nunca el alias por el que entró", () => {
    const direccion = parsearDireccion("/hojas-ruta", "?stage=entrega&tab=cuotas");
    const href = serializarDireccion(direccion!);
    expect(href).toBe("/hojas-ruta?seccion=entrega&pestana=cuotas");
    expect(href).not.toContain("stage=");
    expect(href).not.toContain("tab=");
  });

  it("no duplica en query una sección que ya nombra el pathname", () => {
    expect(
      serializarDireccion({ modulo: "procesamiento", seccion: "carga" }),
    ).toBe("/carga");
    expect(
      serializarDireccion({
        modulo: "procesamiento",
        seccion: "codificacion",
        pestana: "catalogo",
      }),
    ).toBe("/codificacion?pestana=catalogo");
  });

  it("da la vuelta completa: parsear y serializar es idempotente", () => {
    const casos = [
      "/monitoreo?modo=territorial&seccion=avance",
      "/hojas-ruta?seccion=entrega&pestana=titulares",
      "/carga",
      "/bitacora?seccion=cronograma",
      "/calc-muestra?modo=aulas",
    ];
    for (const href of casos) {
      const direccion = parsearDireccionDesdeHref(href);
      expect(direccion, href).not.toBeNull();
      expect(serializarDireccion(direccion!), href).toBe(href);
    }
  });

  it("conserva el proyecto de dev al serializar", () => {
    expect(
      serializarDireccion({
        modulo: "monitoreo",
        seccion: "avance",
        proyecto: "/ruta/x.pulso",
      }),
    ).toBe("/monitoreo?seccion=avance&pulso=%2Fruta%2Fx.pulso");
  });

  it("reescribe un solo nivel sin perder el resto del estado", () => {
    expect(conNivel("?seccion=avance&scope=consolidado", "pestana", "mapa")).toBe(
      "?seccion=avance&scope=consolidado&pestana=mapa",
    );
    expect(conNivel("?seccion=avance&panel=filtros", "panel", null)).toBe(
      "?seccion=avance",
    );
  });

  it("sobrevive al warm start: sacar el proyecto no toca los niveles", () => {
    // El deep-link abre el `.pulso` y consume el `?pulso=`. Si en esa limpieza
    // se llevara por delante los niveles, el enlace aterrizaría en el landing
    // del módulo en vez de la vista pedida — que es el fallo que este helper
    // existe para impedir.
    expect(
      hrefSinParamDeProyecto(
        "/monitoreo?pulso=%2Fruta%2Fx.pulso&modo=territorial&seccion=avance&pestana=ump&panel=filtros#estado",
      ),
    ).toBe(
      "/monitoreo?modo=territorial&seccion=avance&pestana=ump&panel=filtros#estado",
    );
  });

  it("saca también los alias viejos del param de proyecto", () => {
    expect(hrefSinParamDeProyecto("/carga?devPulso=%2Fa.pulso&pestana=x")).toBe(
      "/carga?pestana=x",
    );
    expect(hrefSinParamDeProyecto("/carga?devProject=%2Fa.pulso")).toBe("/carga");
  });

  it("describe la dirección en una clave estable y legible", () => {
    expect(
      describirDireccion({
        modulo: "monitoreo",
        modo: "territorial",
        seccion: "avance",
        pestana: "mapa",
        panel: "filtros",
      }),
    ).toBe("monitoreo/territorial/avance/mapa#filtros");
  });

  it("compara direcciones por sus niveles y no por foco", () => {
    const base = { modulo: "monitoreo", seccion: "avance" } as const;
    expect(mismaDireccion(base, { ...base, foco: "abc" })).toBe(true);
    expect(mismaDireccion(base, { ...base, pestana: "mapa" })).toBe(false);
  });
});
