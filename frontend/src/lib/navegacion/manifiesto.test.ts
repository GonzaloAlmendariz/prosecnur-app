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
import {
  olvidarPestanasDeSeccion,
  pestanasDisponiblesDeSeccion,
  registrarPestanasDeSeccion,
} from "./runtime";

describe("manifiesto de navegación", () => {
  it("mantiene el inventario completo de 206 nodos vivos", () => {
    // +1 por D10: Consistencia es pestaña propia de Datos.
    expect(MANIFIESTO_NAVEGACION).toHaveLength(206);
  });

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
      if (
        nodo.nivel === "modulo"
        || nodo.nivel === "modo"
        || !nodo.direccionPublicada
      ) continue;
      const vuelta = parsearDireccionDesdeHref(nodo.href);
      expect(vuelta, nodo.clave).not.toBeNull();
      expect(vuelta?.modulo, nodo.clave).toBe(nodo.direccion.modulo);
      expect(vuelta?.seccion, nodo.clave).toBe(nodo.direccion.seccion);
      // El parser global normaliza `_` a `-`; la página conserva el id raw en
      // el query (p. ej. `base_final`) para no romper enlaces existentes.
      expect(vuelta?.pestana, nodo.clave).toBe(
        nodo.direccion.pestana?.replaceAll("_", "-"),
      );
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

  it("expone las 69 pestañas posibles de los perfiles de Monitoreo", () => {
    const pestanas = nodosDe("monitoreo").filter((nodo) => nodo.nivel === "pestana");

    expect(pestanas).toHaveLength(69);
    expect(new Set(pestanas.map((nodo) => nodo.clave)).size).toBe(69);
    expect(pestanas).toContainEqual(
      nodoPorClave("monitoreo/telefonico/consultas/subsanacion"),
    );
  });

  it("expone las 27 pestañas de Muestra, 26 de Procesamiento y 4 de Dashboard", () => {
    const muestra = nodosDe("calc-muestra").filter(
      (nodo) =>
        nodo.nivel === "pestana"
        && nodo.direccion.modo === "opinion-universitaria",
    );
    const procesamiento = nodosDe("procesamiento").filter(
      (nodo) => nodo.nivel === "pestana",
    );
    const dashboard = nodosDe("dashboard").filter(
      (nodo) => nodo.nivel === "pestana",
    );

    expect(muestra).toHaveLength(27);
    expect(nodoPorClave("calc-muestra/opinion-universitaria/aulas/marco")).toBeNull();
    expect(procesamiento).toHaveLength(26);
    expect(dashboard).toHaveLength(4);
  });

  it("conserva ocho pestañas auditables sin prometer una URL inexistente", () => {
    const noPublicadas = MANIFIESTO_NAVEGACION.filter(
      (nodo) => !nodo.direccionPublicada,
    );

    expect(noPublicadas.map((nodo) => nodo.clave)).toEqual([
      "procesamiento/validacion/explorar",
      "procesamiento/validacion/instrumento",
      "procesamiento/validacion/reglas_custom",
      "procesamiento/validacion/limpieza",
      "dashboard/dashboard/resumen",
      "dashboard/dashboard/relaciones",
      "dashboard/dashboard/base_datos",
      "dashboard/dashboard/dimensiones",
    ]);
    expect(noPublicadas.slice(0, 4).every((nodo) => nodo.href === "/validacion")).toBe(
      true,
    );
    expect(noPublicadas.slice(4).every((nodo) => nodo.href === "/tablero")).toBe(
      true,
    );

    const clavesQA = new Set(recorridoCompleto().map((nodo) => nodo.clave));
    expect(noPublicadas.every((nodo) => !clavesQA.has(nodo.clave))).toBe(true);
  });

  it("permite que runtime sustituya una sección por un subconjunto declarado", () => {
    const clave = "monitoreo/telefonico/consultas";

    expect(
      pestanasDisponiblesDeSeccion(clave).map((nodo) => nodo.direccion.pestana),
    ).toEqual(["plataforma", "cruces", "subsanacion"]);

    try {
      registrarPestanasDeSeccion(
        clave,
        { modulo: "monitoreo", modo: "telefonico", seccion: "consultas" },
        [
          { key: "plataforma", label: "copy runtime ignorado" },
          { key: "cruces", label: "copy runtime ignorado" },
        ],
      );

      const visibles = pestanasDisponiblesDeSeccion(clave);
      expect(visibles.map((nodo) => nodo.direccion.pestana)).toEqual([
        "plataforma",
        "cruces",
      ]);
      expect(visibles[0]).toBe(
        nodoPorClave("monitoreo/telefonico/consultas/plataforma"),
      );
      expect(visibles[0]?.label).toBe("Efectivas Kobo");
      expect(() =>
        registrarPestanasDeSeccion(
          clave,
          { modulo: "monitoreo", modo: "telefonico", seccion: "consultas" },
          [{ key: "fuera-del-contrato", label: "No existe" }],
        ),
      ).toThrow(/fuera-del-contrato/);
    } finally {
      olvidarPestanasDeSeccion(clave);
    }

    expect(
      pestanasDisponiblesDeSeccion(clave).map((nodo) => nodo.direccion.pestana),
    ).toEqual(["plataforma", "cruces", "subsanacion"]);
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
