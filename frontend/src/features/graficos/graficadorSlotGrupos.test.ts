import { describe, expect, it } from "vitest";
import { MODE_GROUPS } from "./GraficadorSlot";

// El tab de Filtros es un editor de REGLAS y no monta el slot del graficador,
// asi que `valores`, `tabla` y `semaforo` no tenian donde salir: el registro los
// servia y la UI no los mostraba. `titulo_tabla` y `umbral_rojo_pct` de
// `p_tabla` llevaban asi desde que existen.

describe("reparto de grupos por tab", () => {
  it("ningún grupo de args queda sin tab", () => {
    // Los grupos canónicos que el registro puede emitir para un graficador.
    const canonicos = [
      "datos", "lectura", "valores", "leyenda", "espacio", "tabla",
      "textos", "estilo", "filtro", "semaforo", "canvas",
    ];
    const cubiertos = new Set(Object.values(MODE_GROUPS).flat());
    // `diagnostico` queda fuera a propósito: es debug visual, no configuración.
    expect(canonicos.filter((g) => !cubiertos.has(g as never))).toEqual([]);
  });

  it("un grupo no aparece en dos tabs", () => {
    const todos = Object.values(MODE_GROUPS).flat();
    expect(todos.length).toBe(new Set(todos).size);
  });

  it("Filtros sólo gobierna lo que su editor de reglas sabe editar", () => {
    expect(MODE_GROUPS.filters).toEqual(["filtro"]);
  });
});
