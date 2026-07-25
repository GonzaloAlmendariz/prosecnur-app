import { describe, expect, it } from "vitest";
import { PROSECNUR_MODULES } from "../modules";
import { parsearDireccionDesdeHref } from "./direccion";
import {
  MANIFIESTO_NAVEGACION,
  hijosDe,
  nodoPorClave,
  nodosDe,
  recorridoCompleto,
} from "./manifiesto";

describe("manifiesto de navegación", () => {
  it("cubre los ocho módulos y no inventa ninguno", () => {
    const modulos = MANIFIESTO_NAVEGACION.filter((n) => n.nivel === "modulo");
    expect(modulos).toHaveLength(PROSECNUR_MODULES.length);
    expect(new Set(modulos.map((n) => n.direccion.modulo)).size).toBe(
      PROSECNUR_MODULES.length,
    );
  });

  it("da a cada nodo una clave única y estable", () => {
    const claves = MANIFIESTO_NAVEGACION.map((n) => n.clave);
    expect(new Set(claves).size).toBe(claves.length);
    for (const clave of claves) expect(clave).not.toMatch(/undefined/);
  });

  it("cuelga cada nodo de un padre que existe", () => {
    const claves = new Set(MANIFIESTO_NAVEGACION.map((n) => n.clave));
    for (const nodo of MANIFIESTO_NAVEGACION) {
      if (nodo.padre === null) {
        expect(nodo.nivel).toBe("modulo");
        continue;
      }
      expect(claves.has(nodo.padre), `${nodo.clave} → ${nodo.padre}`).toBe(true);
    }
  });

  it("emite hrefs que vuelven a parsear a la misma dirección", () => {
    for (const nodo of MANIFIESTO_NAVEGACION) {
      if (nodo.nivel === "modulo" || nodo.nivel === "modo") continue;
      const vuelta = parsearDireccionDesdeHref(nodo.href);
      expect(vuelta, nodo.clave).not.toBeNull();
      expect(vuelta?.modulo, nodo.clave).toBe(nodo.direccion.modulo);
      expect(vuelta?.seccion, nodo.clave).toBe(nodo.direccion.seccion);
      expect(vuelta?.pestana, nodo.clave).toBe(nodo.direccion.pestana);
    }
  });

  it("aterriza los nodos de módulo en una sección real de ese módulo", () => {
    // El landing de un módulo puede coincidir con su primera sección
    // (`/bitacora` es a la vez el módulo y su sección `bitacora`). Eso es
    // correcto: lo que no puede pasar es que aterrice en una sección ajena.
    for (const nodo of MANIFIESTO_NAVEGACION) {
      if (nodo.nivel !== "modulo") continue;
      const vuelta = parsearDireccionDesdeHref(nodo.href);
      expect(vuelta?.modulo, nodo.clave).toBe(nodo.direccion.modulo);
      if (!vuelta?.seccion) continue;
      const secciones = nodosDe(nodo.direccion.modulo)
        .filter((item) => item.nivel === "seccion")
        .map((item) => item.direccion.seccion);
      expect(secciones, nodo.clave).toContain(vuelta.seccion);
    }
  });

  it("enumera los cuatro modos de Monitoreo con sus secciones", () => {
    const modos = nodosDe("monitoreo").filter((n) => n.nivel === "modo");
    expect(modos.map((n) => n.direccion.modo)).toEqual([
      "acreditacion",
      "telefonico",
      "territorial",
      "aulas",
    ]);

    // Territorial es el modo con más secciones: seis.
    const territorial = nodoPorClave("monitoreo/territorial");
    expect(territorial).not.toBeNull();
    expect(hijosDe(territorial!.clave)).toHaveLength(6);
  });

  it("distingue la misma sección en modos distintos", () => {
    // `calidad` se llama "Validación" en territorial y también en aulas: son
    // nodos separados porque el contenido y el estado de cada uno difieren.
    const territorial = nodoPorClave("monitoreo/territorial/calidad");
    const aulas = nodoPorClave("monitoreo/aulas/calidad");
    expect(territorial).not.toBeNull();
    expect(aulas).not.toBeNull();
    expect(territorial!.clave).not.toBe(aulas!.clave);
  });

  it("expone las pestañas de Entrega de Hojas de ruta", () => {
    const entrega = nodoPorClave("hojas-ruta/entrega");
    expect(hijosDe(entrega!.clave).map((n) => n.direccion.pestana)).toEqual([
      "cuotas",
      "titulares",
      "reemplazos",
    ]);
  });

  it("da un recorrido determinista y filtrable para los runners de QA", () => {
    const primera = recorridoCompleto();
    const segunda = recorridoCompleto();
    expect(primera.map((n) => n.clave)).toEqual(segunda.map((n) => n.clave));
    expect(primera.every((n) => n.nivel === "seccion" || n.nivel === "pestana")).toBe(
      true,
    );

    const soloMonitoreo = recorridoCompleto({ modulos: ["monitoreo"] });
    expect(soloMonitoreo.length).toBeGreaterThan(0);
    expect(
      soloMonitoreo.every((n) => n.direccion.modulo === "monitoreo"),
    ).toBe(true);
  });
});
