import { describe, expect, test } from "vitest";

import {
  resolverSeccion,
  searchConNivel,
  seccionesDelModo,
} from "./useDireccion";
import { PROSECNUR_MODULES } from "../modules";
import type { ProsecnurModuleSectionMeta } from "../modules";

const seccion = (id: string): ProsecnurModuleSectionMeta =>
  ({ id, label: id, to: `/x?seccion=${id}` }) as unknown as ProsecnurModuleSectionMeta;

describe("seccionesDelModo", () => {
  test("un módulo sin modos devuelve su propio juego de secciones", () => {
    const meta = { sections: [seccion("a"), seccion("b")], modos: undefined };
    expect(seccionesDelModo(meta, null).map((s) => s.id)).toEqual(["a", "b"]);
  });

  test("un modo REESCRIBE el juego: no lo mezcla con el del módulo", () => {
    const meta = {
      sections: [seccion("del-modulo")],
      modos: [
        { id: "uno", label: "Uno", sections: [seccion("a1")] },
        { id: "dos", label: "Dos", sections: [seccion("b1"), seccion("b2")] },
      ],
    };
    expect(seccionesDelModo(meta, "dos").map((s) => s.id)).toEqual(["b1", "b2"]);
    expect(seccionesDelModo(meta, "dos").map((s) => s.id)).not.toContain("del-modulo");
  });

  test("un modo desconocido cae al primero declarado, no a vacío", () => {
    const meta = {
      sections: [],
      modos: [
        { id: "uno", label: "Uno", sections: [seccion("a1")] },
        { id: "dos", label: "Dos", sections: [seccion("b1")] },
      ],
    };
    // Pasa de verdad: un enlace viejo con `?modo=` de otro estudio, o un perfil
    // que ya no existe. Dejar el rail vacío sería peor que aterrizar en el
    // primer modo.
    expect(seccionesDelModo(meta, "inventado").map((s) => s.id)).toEqual(["a1"]);
  });

  test("sin meta devuelve vacío en vez de reventar", () => {
    expect(seccionesDelModo(null, "x")).toEqual([]);
  });
});

describe("resolverSeccion", () => {
  const secciones = [seccion("carga"), seccion("validacion")];

  test("respeta la sección que pide la URL cuando existe", () => {
    expect(resolverSeccion("validacion", secciones)).toBe("validacion");
  });

  test("cae al default del manifiesto si la URL pide una que el modo no tiene", () => {
    expect(resolverSeccion("avance", secciones)).toBe("carga");
  });

  test("sin sección en la URL, la primera del manifiesto", () => {
    expect(resolverSeccion(null, secciones)).toBe("carga");
    expect(resolverSeccion(undefined, secciones)).toBe("carga");
  });

  test("sin secciones declaradas devuelve lo pedido, o null", () => {
    expect(resolverSeccion("algo", [])).toBe("algo");
    expect(resolverSeccion(null, [])).toBeNull();
  });
});

describe("searchConNivel — descarte de niveles hijos", () => {
  test("cambiar de sección descarta la pestaña y el panel", () => {
    // El bug que esto evita: la pestaña «ump» de Avance no existe en Fuentes, y
    // arrastrarla deja una pestaña activa que el rail nuevo no lista.
    const antes = "?seccion=avance&pestana=ump&panel=filtros";
    const despues = new URLSearchParams(searchConNivel(antes, "seccion", "fuentes"));
    expect(despues.get("seccion")).toBe("fuentes");
    expect(despues.get("pestana")).toBeNull();
    expect(despues.get("panel")).toBeNull();
  });

  test("cambiar de modo descarta sección, pestaña y panel", () => {
    const antes = "?modo=territorial&seccion=avance&pestana=ump&panel=filtros";
    const despues = new URLSearchParams(searchConNivel(antes, "modo", "telefonico"));
    expect(despues.get("modo")).toBe("telefonico");
    expect(despues.get("seccion")).toBeNull();
    expect(despues.get("pestana")).toBeNull();
    expect(despues.get("panel")).toBeNull();
  });

  test("cambiar de pestaña descarta el panel pero conserva la sección", () => {
    const antes = "?seccion=avance&pestana=ump&panel=filtros";
    const despues = new URLSearchParams(searchConNivel(antes, "pestana", "distrito"));
    expect(despues.get("seccion")).toBe("avance");
    expect(despues.get("pestana")).toBe("distrito");
    expect(despues.get("panel")).toBeNull();
  });

  test("abrir un panel no toca ningún otro nivel", () => {
    const antes = "?modo=territorial&seccion=avance&pestana=ump";
    const despues = new URLSearchParams(searchConNivel(antes, "panel", "filtros"));
    expect(despues.get("modo")).toBe("territorial");
    expect(despues.get("seccion")).toBe("avance");
    expect(despues.get("pestana")).toBe("ump");
    expect(despues.get("panel")).toBe("filtros");
  });

  test("preserva los params ajenos a la gramática", () => {
    // `?pulso=` es el deep-link de dev y hay params de feature que tampoco son
    // nuestros. Perderlos al clickear una sección rompería el flujo de QA.
    const antes = "?seccion=avance&pulso=%2Ftmp%2Fx.pulso&ordenar=fecha";
    const despues = new URLSearchParams(searchConNivel(antes, "seccion", "fuentes"));
    expect(despues.get("pulso")).toBe("/tmp/x.pulso");
    expect(despues.get("ordenar")).toBe("fecha");
  });

  test("pasar null borra el nivel", () => {
    const despues = new URLSearchParams(searchConNivel("?seccion=avance", "seccion", null));
    expect(despues.get("seccion")).toBeNull();
  });
});

describe("integración con el manifiesto real", () => {
  test("todo módulo con modos resuelve una sección para cada modo declarado", () => {
    const huerfanos: string[] = [];
    for (const modulo of PROSECNUR_MODULES) {
      for (const modo of modulo.modos ?? []) {
        const secciones = seccionesDelModo(modulo, modo.id);
        const resuelta = resolverSeccion(null, secciones);
        if (!resuelta) huerfanos.push(`${modulo.slug}/${modo.id}`);
      }
    }
    expect(
      huerfanos,
      "un modo sin secciones deja el rail vacío al aterrizar en él",
    ).toEqual([]);
  });

  test("todo módulo sin modos resuelve su sección de aterrizaje", () => {
    const huerfanos: string[] = [];
    for (const modulo of PROSECNUR_MODULES) {
      if (modulo.modos && modulo.modos.length > 0) continue;
      if (modulo.sections.length === 0) continue;
      if (!resolverSeccion(null, seccionesDelModo(modulo, null))) {
        huerfanos.push(modulo.slug);
      }
    }
    expect(huerfanos).toEqual([]);
  });
});
