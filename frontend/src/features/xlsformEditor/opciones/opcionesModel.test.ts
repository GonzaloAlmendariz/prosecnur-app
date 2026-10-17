// La pestaña nombra cada lista por su contenido y la agrupa por lo que pide atención. Mata: mostrar sólo el código,
// perder una lista entre grupos o contar como «en uso» una que nadie usa.
import { describe, expect, it } from "vitest";
import { gruposDeListas, nombreLegible } from "./opcionesModel";
import type { CatalogSummary } from "../types";

const lista = (listName: string, labels: string[]): CatalogSummary => ({ listName, title: listName, items: labels.map((label, i) => ({ rowIndex: i, name: String(i + 1), label })) });

describe("pestaña Listas de opciones", () => {
  it("nombra la lista por sus primeras etiquetas", () => {
    expect(nombreLegible(lista("si_no", ["Sí", "No"]).items)).toBe("Sí, No");
    expect(nombreLegible(lista("area", ["Académica", "Administrativa", "Campo", "Otro"]).items)).toBe("Académica, Administrativa, Campo y 1 más");
    expect(nombreLegible([])).toBe("Sin opciones");
  });
  it("cada lista cae en un solo grupo: repetidas, en uso o sin uso", () => {
    const cats = [lista("a", ["Sí", "No"]), lista("b", ["Sí", "No"]), lista("c", ["Uno"]), lista("d", ["Dos"])];
    const grupos = gruposDeListas(cats, { a: 1, b: 2, c: 3, d: 0 }, [{ firma: "x", listas: ["a", "b"], opciones: [], preguntas: ["p1", "p2"], sugerencia: "si_no" }], null);
    expect(grupos.map((g) => [g.titulo, g.items.map((i) => i.key)])).toEqual([["Se repiten", ["a", "b"]], ["En uso", ["c"]], ["Sin uso", ["d"]]]);
    expect(grupos[2].items[0]).toMatchObject({ titulo: "Dos", resumen: "d, sin uso", aviso: true });
  });
});
