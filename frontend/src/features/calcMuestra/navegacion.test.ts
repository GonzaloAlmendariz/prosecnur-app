import { describe, expect, it } from "vitest";

import { PROSECNUR_MODULES } from "../../lib/modules";
import { parsearDireccion, serializarDireccion } from "../../lib/navegacion/direccion";
import { resolverSeccion, seccionesDelModo } from "../../lib/navegacion/useDireccion";
import { deskDeModo, modoCrudoDeLaDireccion, modoDeDesk, sinAliasDeModo } from "./navegacion";

const CALC = PROSECNUR_MODULES.find((m) => m.slug === "calc-muestra")!;

describe("dirección de Cálculo de muestra", () => {
  it("declara sus mesas como modos con secciones propias", () => {
    // La deuda que esto cierra: el módulo tenía 41 pantallas bajo una sola
    // dirección porque el manifiesto solo conocía una sección genérica.
    expect(CALC.modos?.map((m) => m.id)).toEqual([
      "opinion-universitaria",
      "marco-disponible",
      "acreditacion",
      "territorial-handoff",
      "sin-definir",
    ]);
    for (const modo of CALC.modos ?? []) {
      expect(modo.sections.length, `el modo ${modo.id} no declara secciones`).toBeGreaterThan(0);
    }
  });

  it("resuelve la sección contra el modo activo, no contra el primero", () => {
    const universitario = seccionesDelModo(CALC, "opinion-universitaria");
    const acreditacion = seccionesDelModo(CALC, "acreditacion");

    expect(universitario.map((s) => s.id)).toEqual([
      "definicion",
      "marco",
      "calculo",
      "aulas",
      "salidas",
    ]);
    expect(acreditacion.map((s) => s.id)).toEqual(["actores", "contexto", "resultados"]);
  });

  it("cae al default del modo cuando la dirección pide una sección de otra mesa", () => {
    // Enlace viejo o mesa que cambió al abrir otro estudio: el rail no puede
    // quedarse sin selección.
    const acreditacion = seccionesDelModo(CALC, "acreditacion");
    expect(resolverSeccion("aulas", acreditacion)).toBe("actores");
    expect(resolverSeccion("contexto", acreditacion)).toBe("contexto");
  });

  it("una dirección completa sobrevive el round-trip", () => {
    const href = "/calc-muestra?modo=opinion-universitaria&seccion=aulas&pestana=seleccion";
    const direccion = parsearDireccion("/calc-muestra", "?modo=opinion-universitaria&seccion=aulas&pestana=seleccion");

    expect(direccion?.modulo).toBe("calc-muestra");
    expect(direccion?.modo).toBe("opinion-universitaria");
    expect(direccion?.seccion).toBe("aulas");
    expect(direccion?.pestana).toBe("seleccion");
    expect(serializarDireccion(direccion!)).toBe(href);
  });

  describe("traducción entre la mesa del dominio y el modo de la dirección", () => {
    it("publica en kebab lo que el dominio nombra en snake", () => {
      // Regresión: publicar `opinion_universitaria` y leer de vuelta
      // `opinion-universitaria` —la gramática normaliza el token— hacía que la
      // comprobación de «ya está escrito» nunca fuera cierta, y el efecto de
      // publicación se repetía en bucle.
      expect(modoDeDesk("opinion_universitaria")).toBe("opinion-universitaria");
      expect(modoDeDesk("territorial_handoff")).toBe("territorial-handoff");
      expect(modoDeDesk("acreditacion")).toBe("acreditacion");
    });

    it("el ida y vuelta es estable para todas las mesas", () => {
      for (const desk of [
        "opinion_universitaria",
        "marco_disponible",
        "acreditacion",
        "territorial_handoff",
        "sin_definir",
        "legacy",
      ]) {
        expect(deskDeModo(modoDeDesk(desk)), `la mesa ${desk} no sobrevive el round-trip`).toBe(desk);
      }
    });

    it("el modo publicado coincide con un modo declarado en el manifiesto", () => {
      // Si esto se rompe, `useSeccion` resolvería contra el primer modo y el
      // rail mostraría las secciones de otra mesa.
      const declarados = new Set((CALC.modos ?? []).map((m) => m.id));
      for (const desk of ["opinion_universitaria", "marco_disponible", "acreditacion", "territorial_handoff"]) {
        expect(declarados.has(modoDeDesk(desk)), `${desk} publica un modo que el manifiesto no declara`).toBe(true);
      }
    });

    it("tolera el snake y los espacios al leer un modo de vuelta", () => {
      expect(deskDeModo("opinion_universitaria")).toBe("opinion_universitaria");
      expect(deskDeModo("OPINION-UNIVERSITARIA")).toBe("opinion_universitaria");
      expect(deskDeModo("desconocido")).toBeNull();
      expect(deskDeModo(null)).toBeNull();
    });
  });

  describe("alias históricos del deep-link", () => {
    it("lee mesa/desk/tipo cuando no hay param canónico", () => {
      expect(modoCrudoDeLaDireccion("?mesa=aulas")).toBe("aulas");
      expect(modoCrudoDeLaDireccion("?desk=aulas")).toBe("aulas");
      expect(modoCrudoDeLaDireccion("?tipo=aulas")).toBe("aulas");
    });

    it("prefiere el param canónico sobre el alias", () => {
      expect(modoCrudoDeLaDireccion("?modo=acreditacion&mesa=aulas")).toBe("acreditacion");
    });

    it("los quita al reescribir, sin tocar el resto de la dirección", () => {
      // `pulso` es el deep-link de dev que salta el BootGate: perderlo dejaría
      // la vista sin proyecto justo al aterrizar.
      expect(sinAliasDeModo("?mesa=aulas&pulso=/x/y.pulso&seccion=marco"))
        .toBe("?pulso=%2Fx%2Fy.pulso&seccion=marco");
      expect(sinAliasDeModo("?seccion=marco")).toBe("?seccion=marco");
    });

    it("no deja una interrogación suelta cuando el alias era todo lo que había", () => {
      expect(sinAliasDeModo("?mesa=aulas")).toBe("");
    });
  });
});
