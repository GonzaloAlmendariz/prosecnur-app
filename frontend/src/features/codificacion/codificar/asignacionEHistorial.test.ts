import { describe, expect, test } from "vitest";
import type { Grupo, RespuestaUnica } from "../../../api/codificacion";
import {
  ZONA_CODIGO_NUEVO,
  asignarVarias,
  crearCodigoCon,
  destinoDeSuelta,
  quitarUltimoCodigo,
  siguienteCodigo,
  zonaDeCodigo,
} from "./asignacionEnLote";
import { TOPE_DE_HISTORIAL, apilarPaso, deshacerPaso, pasoEntre } from "./historialAsignaciones";
import { cifrasDeCasos, cifrasDeTarjeta, filtrarPorCodigo, tarjetasDeCodigos } from "./modeloDeCodificar";

function grupo(id: string, codigo: string, respuestas: string[], extra: Partial<Grupo> = {}): Grupo {
  return { id, codigo, etiqueta: `Código ${codigo}`, respuestas, origen: "nuevo", ...extra };
}
const base = (): Grupo[] => [grupo("g1", "1", ["a", "b"]), grupo("g2", "2", ["c"]), grupo("g3", "3", [])];
const miembros = (gs: readonly Grupo[]) => Object.fromEntries(gs.map((g) => [g.id, g.respuestas]));

describe("asignar varias respuestas a un código", () => {
  test("sin varios códigos por respuesta, cada una sale de donde estaba", () => {
    expect(miembros(asignarVarias(base(), ["a", "c"], "g3", false))).toEqual({ g1: ["b"], g2: [], g3: ["a", "c"] });
  });

  test("con varios códigos por respuesta, el código se suma y nada sale de su lugar", () => {
    expect(miembros(asignarVarias(base(), ["a", "c"], "g3", true))).toEqual({ g1: ["a", "b"], g2: ["c"], g3: ["a", "c"] });
  });

  test("un destino que no existe no cambia nada", () => {
    const gs = base();
    expect(asignarVarias(gs, ["a"], "nada", false)).toBe(gs);
  });

  test("quitar el código a varias les saca el último que tienen y deja igual a las que no tienen", () => {
    const gs = asignarVarias(base(), ["a"], "g3", true);
    expect(miembros(quitarUltimoCodigo(gs, ["a", "z"]))).toEqual({ g1: ["a", "b"], g2: ["c"], g3: [] });
  });

  test("el código nuevo sigue al mayor por debajo de 70 y lleva lo que se soltó en él", () => {
    expect(siguienteCodigo([grupo("x", "3", []), grupo("y", "96", [])])).toBe("4");
    expect(siguienteCodigo([grupo("y", "96", [])])).toBe("97");
    expect(siguienteCodigo([])).toBe("1");
    const { grupos, creado } = crearCodigoCon(base(), ["a"], "  Iglesia   del barrio ", false, "nuevo");
    expect(creado).toMatchObject({ id: "nuevo", codigo: "4", etiqueta: "Iglesia del barrio", respuestas: ["a"], origen: "nuevo" });
    expect(miembros(grupos).g1).toEqual(["b"]);
  });

  test("dónde se soltó: la tarjeta de un código, la de crear uno o ninguna", () => {
    expect(destinoDeSuelta(zonaDeCodigo("g2"))).toEqual({ tipo: "codigo", grupoId: "g2" });
    expect(destinoDeSuelta(ZONA_CODIGO_NUEVO)).toEqual({ tipo: "nuevo" });
    expect(destinoDeSuelta("respuesta:a")).toBeNull();
    expect(destinoDeSuelta(undefined)).toBeNull();
  });
});

describe("historial para deshacer", () => {
  test("deshacer una asignación devuelve exactamente los grupos de antes", () => {
    const antes = base();
    const despues = asignarVarias(antes, ["a", "c"], "g3", false);
    const paso = pasoEntre(antes, despues, "asignar");
    expect(paso).not.toBeNull();
    expect(deshacerPaso(despues, paso!)).toEqual(antes);
  });

  test("deshacer la creación de un código lo quita y devuelve sus respuestas a su lugar", () => {
    const antes = base();
    const { grupos: despues } = crearCodigoCon(antes, ["c"], "Nuevo", false, "g9");
    expect(deshacerPaso(despues, pasoEntre(antes, despues, "crear")!)).toEqual(antes);
  });

  test("deshacer la eliminación de un código lo devuelve al lugar que ocupaba", () => {
    const antes = base();
    const despues = antes.filter((g) => g.id !== "g2");
    expect(deshacerPaso(despues, pasoEntre(antes, despues, "eliminar")!)).toEqual(antes);
  });

  test("un cambio de nombre o de orden no es un paso, y se conserva al deshacer el anterior", () => {
    const antes = base();
    const asignado = asignarVarias(antes, ["c"], "g1", false);
    const paso = pasoEntre(antes, asignado, "asignar")!;
    const renombrado = asignado.map((g) => (g.id === "g1" ? { ...g, etiqueta: "Trato" } : g));
    expect(pasoEntre(asignado, renombrado, "renombrar")).toBeNull();
    expect(pasoEntre(asignado, [...asignado].reverse(), "mover")).toBeNull();
    const deshecho = deshacerPaso(renombrado, paso);
    expect(miembros(deshecho)).toEqual(miembros(antes));
    expect(deshecho.find((g) => g.id === "g1")?.etiqueta).toBe("Trato");
  });

  test("la pila guarda al menos 20 pasos y olvida los más viejos por encima del tope", () => {
    expect(TOPE_DE_HISTORIAL).toBeGreaterThanOrEqual(20);
    const paso = (n: number) => ({ rotulo: `p${n}`, miembros: [], creados: [], quitados: [] });
    let pila = apilarPaso([], paso(0), 3);
    for (let i = 1; i < 5; i++) pila = apilarPaso(pila, paso(i), 3);
    expect(pila.map((p) => p.rotulo)).toEqual(["p2", "p3", "p4"]);
  });
});

function respuesta(clave: string, frecuencia: number): RespuestaUnica {
  return { texto_normalizado: clave, texto: clave, variantes: 1, frecuencia, uuids: [] };
}

describe("lo que pintan la lista y las tarjetas", () => {
  test("Por codificar deja solo las respuestas sin ningún código", () => {
    const rs = ["a", "b", "c", "d"].map((k) => respuesta(k, 1));
    expect(filtrarPorCodigo(rs, base(), "sin-codigo").map((r) => r.texto_normalizado)).toEqual(["d"]);
    expect(filtrarPorCodigo(rs, base(), "todas")).toHaveLength(4);
  });

  test("la tarjeta de un código lleva sus respuestas con sus veces; una clave que la base ya no trae va sin veces", () => {
    const [t1] = tarjetasDeCodigos(base(), [respuesta("a", 4)]);
    expect(t1.respuestas).toEqual([
      { clave: "a", texto: "a", titulo: "a", veces: 4, enBase: true },
      { clave: "b", texto: "b", titulo: "b", veces: 0, enBase: false },
    ]);
    expect(cifrasDeTarjeta(t1)).toEqual({ respuestas: 1, casos: 4, fueraDeLaBase: 1 });
  });

  test("en una múltiple con Otros, los casos con código van sobre los que marcaron la opción y su detalle dice cuántos faltan", () => {
    const rs = [respuesta("a", 3), respuesta("b", 2), respuesta("d", 4)];
    const [conCodigo, conTexto] = cifrasDeCasos(rs, base(), 11);
    expect(conCodigo).toMatchObject({ id: "con-codigo", valor: 5, de: 11, aviso: true });
    expect(conCodigo.detalle).toBe("11 personas marcaron Otros: 5 casos con código y 6 casos sin código");
    expect(conTexto).toMatchObject({ id: "con-texto", valor: 9 });
  });

  test("sin el total de Otros, los casos con código van sin base y sin aviso", () => {
    const [conCodigo] = cifrasDeCasos([respuesta("a", 3)], base(), null);
    expect(conCodigo).toEqual({ id: "con-codigo", valor: 3, singular: "caso con código", plural: "casos con código" });
  });
});
