import { describe, expect, it } from "vitest";
import { MODE_GROUPS, tabDeGrupo } from "./argTabs";
import { filtrarAjustes } from "./buscarAjustes";
import type { ArgGrupo, ArgMetadata } from "../../api/client";

// El caso que motiva el módulo: `orden_categorias_manual` es del grupo
// `estilo`, o sea se edita en la pestaña Estilo. Buscarlo desde Datos contaba
// «3 de 50» y a la vez decía «ningún ajuste coincide»: el conteo miraba los 50
// args del graficador y la lista sólo podía pintar los del tab.

const arg = (name: string, grupo: ArgGrupo): ArgMetadata =>
  ({ name, label: name, grupo, tipo_input: "text" }) as unknown as ArgMetadata;

const ARGS = [
  arg("var", "datos"),
  arg("dividir_por", "datos"),
  arg("orden_barras", "estilo"),
  arg("orden_categorias_manual", "estilo"),
  arg("invertir_orden", "estilo"),
];

/** Espeja el reparto que hace GraficadorForm: filtrar por tab y luego buscar. */
function buscarEnTab(modo: keyof typeof MODE_GROUPS, texto: string) {
  const allow = new Set<string>(MODE_GROUPS[modo]);
  const delTab = ARGS.filter((a) => allow.has(a.grupo as string));
  const enTab = filtrarAjustes(delTab, texto);
  const nombresEnTab = new Set(delTab.map((a) => a.name));
  const fuera = filtrarAjustes(ARGS, texto).filter((a) => !nombresEnTab.has(a.name));
  return { total: delTab.length, enTab, fuera };
}

describe("tabDeGrupo", () => {
  it("ubica cada grupo canónico en la pestaña que lo edita", () => {
    expect(tabDeGrupo("datos")).toBe("Datos");
    expect(tabDeGrupo("estilo")).toBe("Estilo");
    expect(tabDeGrupo("valores")).toBe("Estilo");
    expect(tabDeGrupo("filtro")).toBe("Filtros");
  });

  it("devuelve null para un grupo que ninguna pestaña gobierna", () => {
    expect(tabDeGrupo("diagnostico")).toBeNull();
  });
});

describe("buscar un ajuste desde la pestaña equivocada", () => {
  it("Datos no cuenta como suyos los ajustes de Estilo", () => {
    const { total, enTab } = buscarEnTab("data", "orden");
    // El control de la medición: si contara los 50 del graficador, `total`
    // valdría 5 y el conteo diría «3 de 5» sin poder pintar ninguno.
    expect(total).toBe(2);
    expect(enTab).toHaveLength(0);
  });

  it("Datos sabe decir dónde se editan las coincidencias que no puede mostrar", () => {
    const { fuera } = buscarEnTab("data", "orden");
    expect(fuera.map((a) => a.name)).toEqual([
      "orden_barras",
      "orden_categorias_manual",
      "invertir_orden",
    ]);
    expect(new Set(fuera.map((a) => tabDeGrupo(a.grupo as ArgGrupo)))).toEqual(new Set(["Estilo"]));
  });

  it("Estilo sí encuentra el orden manual, que es donde vive", () => {
    const { total, enTab, fuera } = buscarEnTab("style", "orden");
    expect(total).toBe(3);
    expect(enTab.map((a) => a.name)).toContain("orden_categorias_manual");
    expect(fuera).toHaveLength(0);
  });
});
