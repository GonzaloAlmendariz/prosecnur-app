import { describe, expect, it } from "vitest";
import type { Grupo } from "../../../api/codificacion";
import { asignarCodigo, quitarCodigo } from "./asignacionCodigos";

const grupo = (id: string, respuestas: string[]): Grupo => ({ id, codigo: id.replace("g", ""), etiqueta: `Código ${id}`, respuestas, origen: "nuevo" });
const porGrupo = (grupos: Grupo[]) => Object.fromEntries(grupos.map((g) => [g.id, g.respuestas]));

describe("asignarCodigo", () => {
  it("sin varios códigos, la respuesta sale del grupo donde estaba y queda solo en el destino", () => {
    const antes = [grupo("g1", ["colas", "trato"]), grupo("g2", []), grupo("g3", ["horario"])];
    expect(porGrupo(asignarCodigo(antes, "colas", "g2", false))).toEqual({ g1: ["trato"], g2: ["colas"], g3: ["horario"] });
  });

  it("con varios códigos, el destino se suma y los demás grupos no cambian", () => {
    const antes = [grupo("g1", ["colas", "trato"]), grupo("g2", []), grupo("g3", ["horario"])];
    const despues = asignarCodigo(antes, "colas", "g2", true);
    expect(porGrupo(despues)).toEqual({ g1: ["colas", "trato"], g2: ["colas"], g3: ["horario"] });
    // Los grupos que no cambian conservan su identidad.
    expect(despues[0]).toBe(antes[0]);
    expect(despues[2]).toBe(antes[2]);
  });

  it("la misma asignación da resultados distintos según se admitan varios o no", () => {
    const antes = [grupo("g1", ["colas"]), grupo("g2", [])];
    const codigosDe = (grupos: Grupo[]) => grupos.filter((g) => g.respuestas.includes("colas")).map((g) => g.id);
    expect(codigosDe(asignarCodigo(antes, "colas", "g2", false))).toEqual(["g2"]);
    expect(codigosDe(asignarCodigo(antes, "colas", "g2", true))).toEqual(["g1", "g2"]);
  });

  it("asignar dos veces el mismo código no duplica la respuesta", () => {
    const una = asignarCodigo([grupo("g1", [])], "colas", "g1", true);
    expect(porGrupo(asignarCodigo(una, "colas", "g1", true))).toEqual({ g1: ["colas"] });
    expect(porGrupo(asignarCodigo(una, "colas", "g1", false))).toEqual({ g1: ["colas"] });
  });

  it("un destino que no existe no toca nada: la respuesta no pierde su código", () => {
    const antes = [grupo("g1", ["colas"])];
    expect(asignarCodigo(antes, "colas", "no-existe", false)).toBe(antes);
  });

  it("no muta los grupos que recibe", () => {
    const antes = [grupo("g1", ["colas"]), grupo("g2", [])];
    asignarCodigo(antes, "colas", "g2", false);
    expect(porGrupo(antes)).toEqual({ g1: ["colas"], g2: [] });
  });
});

describe("quitarCodigo", () => {
  it("quita la respuesta de ese grupo y deja los demás", () => {
    const antes = [grupo("g1", ["colas", "trato"]), grupo("g2", ["colas"])];
    const despues = quitarCodigo(antes, "colas", "g1");
    expect(porGrupo(despues)).toEqual({ g1: ["trato"], g2: ["colas"] });
    expect(despues[1]).toBe(antes[1]);
  });

  it("quitar lo que no está no cambia nada (un segundo clic no vuelve a asignar)", () => {
    const antes = [grupo("g1", ["trato"])];
    expect(quitarCodigo(antes, "colas", "g1")[0]).toBe(antes[0]);
  });
});
