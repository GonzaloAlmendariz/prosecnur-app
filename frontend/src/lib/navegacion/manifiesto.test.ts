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
      nodoPorClave("monitoreo/telefonico/control/insistencia"),
    );
    // El modo telefónico aterriza en Avance › Cuotas, y la clave existe.
    expect(nodoPorClave("monitoreo/telefonico/avance/cuotas")).not.toBeNull();
    // Las claves anteriores al esqueleto común ya no son nodos: se leen como
    // alias en `direccionTelefonica.ts`.
    expect(nodoPorClave("monitoreo/telefonico/consultas/subsanacion")).toBeNull();
  });

  it("expone las 32 pestañas de Muestra, 29 de Procesamiento y 4 de Dashboard", () => {
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
    // Partición de titulares (2026-08-20): Selección gana «Solidez». 29 → 30.
    // La certeza sale de ser un panel dentro de «Cursos-horario requeridos» y
    // gana pestaña propia al final de Cálculo (2026-08-27). 30 → 31.
    // ADR 0082 (2026-08-27): Selección gana «¿Este sorteo o otro?»
    // (`aulas-rerandomizacion`), la última. 31 → 32.
    expect(muestra).toHaveLength(32);
    expect(nodoPorClave("calc-muestra/opinion-universitaria/aulas/marco")).toBeNull();
    expect(
      nodoPorClave("calc-muestra/opinion-universitaria/aulas/aulas-relato"),
    ).not.toBeNull();
    // F6.3 (2026-10-11): Gráficos gana «Vista general» (`vista-general`). 28 → 29.
    // F6.4 (A6 R3, 2026-10-11): Gráficos gana «Estilo del cliente» (`estilo`). 29 → 30.
    // A10 W-E (2026-10-11): Gráficos gana «Estilo del informe» (`estilo-informe`). 30 → 31.
    // Retiro del Editor anterior (2026-10-11): sale «clasico» y entra «Word» (y «PowerPoint» pasó a la tarjeta del gráfico). 31.
    // Contrato E4-E7, R4 (2026-10-13): Analítica gana «Comparativos» (`comparativos`). 31 → 32.
    expect(procesamiento).toHaveLength(32);
    expect(nodoPorClave("procesamiento/graficos/word")).not.toBeNull();
    expect(nodoPorClave("procesamiento/graficos/clasico")).toBeNull();
    // Rediseño N1 (2026-10-14): las claves pasan a `informe`, `identidad` y `reglas`; las viejas sólo se leen como alias. 32.
    expect(nodoPorClave("procesamiento/graficos/informe")).not.toBeNull();
    expect(nodoPorClave("procesamiento/graficos/identidad")).not.toBeNull();
    expect(nodoPorClave("procesamiento/graficos/reglas")).not.toBeNull();
    expect(nodoPorClave("procesamiento/graficos/vista-general")).toBeNull();
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
    const clave = "monitoreo/telefonico/control";

    expect(
      pestanasDisponiblesDeSeccion(clave).map((nodo) => nodo.direccion.pestana),
    ).toEqual(["barrido", "insistencia", "equipo", "discrepancias", "respuestas", "avisos"]);

    try {
      registrarPestanasDeSeccion(
        clave,
        { modulo: "monitoreo", modo: "telefonico", seccion: "control" },
        [
          { key: "barrido", label: "copy runtime ignorado" },
          { key: "insistencia", label: "copy runtime ignorado" },
        ],
      );

      const visibles = pestanasDisponiblesDeSeccion(clave);
      expect(visibles.map((nodo) => nodo.direccion.pestana)).toEqual([
        "barrido",
        "insistencia",
      ]);
      expect(visibles[0]).toBe(
        nodoPorClave("monitoreo/telefonico/control/barrido"),
      );
      expect(visibles[0]?.label).toBe("Barrido");
      expect(() =>
        registrarPestanasDeSeccion(
          clave,
          { modulo: "monitoreo", modo: "telefonico", seccion: "control" },
          [{ key: "fuera-del-contrato", label: "No existe" }],
        ),
      ).toThrow(/fuera-del-contrato/);
    } finally {
      olvidarPestanasDeSeccion(clave);
    }

    expect(
      pestanasDisponiblesDeSeccion(clave).map((nodo) => nodo.direccion.pestana),
    ).toEqual(["barrido", "insistencia", "equipo", "discrepancias", "respuestas", "avisos"]);
  });

  it("expone las pestañas de Selección de Hojas de ruta", () => {
    const seleccion = nodoPorClave("hojas-ruta/seleccion");
    expect(hijosDe(seleccion!.clave).map((n) => n.direccion.pestana)).toEqual([
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
