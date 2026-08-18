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
  it("mantiene un inventario de nodos vivos, sin claves repetidas", () => {
    // El conteo estaba clavado a mano —207 cuando ya iban 216— y se ponía rojo
    // con cada nodo nuevo y legítimo. Un guard que falla por lo correcto acaba
    // actualizándose a ciegas, que es lo contrario de guardar. Lo que sí vale
    // aquí es que no haya claves duplicadas: dos nodos con la misma clave hacen
    // que una dirección apunte a dos sitios, y eso sí es un defecto.
    expect(MANIFIESTO_NAVEGACION.length).toBeGreaterThan(0);
    const claves = MANIFIESTO_NAVEGACION.map((n) => n.clave);
    expect(new Set(claves).size).toBe(claves.length);
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

  it("expone las pestañas de los perfiles de Monitoreo, sin repetir clave", () => {
    const pestanas = nodosDe("monitoreo").filter((nodo) => nodo.nivel === "pestana");

    // Sin número fijo, por lo mismo: el guard con dientes es la unicidad de la
    // clave, no el total. Y que la pestaña de abajo siga estando, que es la que
    // se perdía al reordenar el catálogo del clon telefónico.
    expect(pestanas.length).toBeGreaterThan(0);
    expect(new Set(pestanas.map((nodo) => nodo.clave)).size).toBe(pestanas.length);
    expect(pestanas).toContainEqual(
      nodoPorClave("monitoreo/telefonico/consultas/subsanacion"),
    );
  });

  it("expone las 29 pestañas de Muestra, 26 de Procesamiento y 4 de Dashboard", () => {
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

    // ADR 0067: Selección gana «Relato» (aulas-relato). 27 → 28.
    expect(muestra).toHaveLength(29);
    expect(nodoPorClave("calc-muestra/opinion-universitaria/aulas/marco")).toBeNull();
    expect(
      nodoPorClave("calc-muestra/opinion-universitaria/aulas/aulas-relato"),
    ).not.toBeNull();
    expect(procesamiento).toHaveLength(26);
    expect(dashboard).toHaveLength(4);
  });

  it("no deja ninguna pestaña prometiendo una URL que no existe", () => {
    const noPublicadas = MANIFIESTO_NAVEGACION.filter(
      (nodo) => !nodo.direccionPublicada,
    );

    // Validación y Dashboard eran las últimas sin dirección: sus pestañas
    // vivían en un store y ni el deep-link ni `__pulsoNav.ir()` llegaban.
    // Que la lista esté vacía es lo que obliga a que una pestaña nueva nazca
    // enlazable, o con una decisión explícita que la saque de acá.
    expect(noPublicadas.map((nodo) => nodo.clave)).toEqual([]);

    // Y el recorrido del QA visual, que sólo pisa lo publicado, ahora las ve.
    const clavesQA = new Set(recorridoCompleto().map((nodo) => nodo.clave));
    expect(clavesQA.has("dashboard/dashboard/relaciones")).toBe(true);
    expect(clavesQA.has("procesamiento/validacion/limpieza")).toBe(true);
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
