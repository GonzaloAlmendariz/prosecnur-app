// Mata: marcar como hecha una sección que la lógica saltó, contar preguntas ocultas o mostrar códigos en lo respondido.
import { describe, expect, it } from "vitest";
import type { BuilderNode } from "../../types";
import { respuestasDadas, seccionesDelRecorrido } from "./modeloRecorrido";

const n = (name: string, listName = "", base = "select_one") => ({ name, label: `¿${name}?`, paperNumber: "", typeInfo: { raw: base, base, listName } }) as unknown as BuilderNode;
const paginas = [
  { id: "a", title: "Inicio", nodes: [n("p1", "sn"), n("p2", "", "text")] },
  { id: "b", title: "Trabajo", nodes: [n("p3", "", "text")] },
  { id: "c", title: "Cierre", nodes: [n("p4", "", "text")] },
];

describe("recorrido de Probar formulario", () => {
  it("la sección que la lógica saltó queda omitida, no hecha ni pendiente", () => {
    const s = seccionesDelRecorrido(paginas, [{ id: "a" }, { id: "c" }], "c", () => true, () => true, { p1: "2", p2: "hola" });
    expect(s.map((x) => [x.id, x.estado, x.respondidas, x.total])).toEqual([["a", "hecha", 2, 2], ["b", "omitida", 0, 1], ["c", "actual", 0, 1]]);
  });
  it("no cuenta las preguntas ocultas por su condición", () => {
    const s = seccionesDelRecorrido(paginas, [{ id: "a" }], "a", () => true, (x) => x.name !== "p2", {});
    expect(s[0].total).toBe(1);
  });
  it("lo respondido lleva la etiqueta de la opción, no su código", () => {
    const r = respuestasDadas(paginas, { p1: "2", p2: "hola" }, () => [{ rowIndex: 0, name: "1", label: "Sí" }, { rowIndex: 1, name: "2", label: "No" }]);
    expect(r.map((x) => [x.name, x.texto])).toEqual([["p1", "No"], ["p2", "hola"]]);
  });
});
