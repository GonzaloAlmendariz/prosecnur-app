import { describe, expect, it } from "vitest";

import { disponerRamificacion, type PiezaAInsertar } from "./ramificacion";

const ORIGEN = { x: 100, y: 200 };

function pieza(id: string, tipo: PiezaAInsertar["target_type"] = "modulo"): PiezaAInsertar {
  return { target_type: tipo, target_id: id, titulo: id };
}

function nodoDe(r: ReturnType<typeof disponerRamificacion>, destino: string) {
  return r.nodes.find((n) => n.ref?.target_id === destino)!;
}

describe("disponerRamificacion", () => {
  it("sin piezas no inventa nada", () => {
    expect(disponerRamificacion([], ORIGEN, "s")).toEqual({ nodes: [], edges: [] });
  });

  it("la profundidad en el árbol se convierte en profundidad en el lienzo", () => {
    const r = disponerRamificacion(
      [pieza("procesamiento/carga/fuentes"), pieza("procesamiento"), pieza("procesamiento/carga")],
      ORIGEN,
      "s",
    );
    const modulo = nodoDe(r, "procesamiento");
    const seccion = nodoDe(r, "procesamiento/carga");
    const pestana = nodoDe(r, "procesamiento/carga/fuentes");
    expect(modulo.y).toBeLessThan(seccion.y);
    expect(seccion.y).toBeLessThan(pestana.y);
  });

  it("una sección de modo cuenta el modo como un nivel", () => {
    const r = disponerRamificacion(
      [pieza("monitoreo"), pieza("monitoreo::territorial"), pieza("monitoreo::territorial/avance")],
      ORIGEN,
      "s",
    );
    const ys = ["monitoreo", "monitoreo::territorial", "monitoreo::territorial/avance"].map(
      (d) => nodoDe(r, d).y,
    );
    expect(ys[0]).toBeLessThan(ys[1]);
    expect(ys[1]).toBeLessThan(ys[2]);
  });

  it("los hermanos de un mismo nivel se reparten en horizontal sin pisarse", () => {
    const r = disponerRamificacion(
      [pieza("procesamiento/carga"), pieza("procesamiento/validacion"), pieza("procesamiento/analitica")],
      ORIGEN,
      "s",
    );
    const ys = new Set(r.nodes.map((n) => n.y));
    expect(ys.size).toBe(1);
    const xs = r.nodes.map((n) => n.x).sort((a, b) => a - b);
    expect(new Set(xs).size).toBe(3);
    // Separación mayor que el ancho del nodo: no se superponen.
    expect(xs[1] - xs[0]).toBeGreaterThanOrEqual(r.nodes[0].w);
  });

  it("traza la arista de la sección a su módulo", () => {
    const r = disponerRamificacion([pieza("procesamiento"), pieza("procesamiento/validacion")], ORIGEN, "s");
    expect(r.edges).toHaveLength(1);
    expect(r.edges[0].from_node).toBe(nodoDe(r, "procesamiento").id);
    expect(r.edges[0].to_node).toBe(nodoDe(r, "procesamiento/validacion").id);
  });

  it("con el nivel intermedio ausente, engancha al ancestro más cercano PRESENTE", () => {
    // Traer «Monitoreo» y su pestaña sin el modo del medio no puede dejar la
    // ramificación cortada: la arista salta el nivel que el usuario no trajo.
    const r = disponerRamificacion(
      [pieza("monitoreo"), pieza("monitoreo::territorial/avance")],
      ORIGEN,
      "s",
    );
    expect(r.edges).toHaveLength(1);
    expect(r.edges[0].from_node).toBe(nodoDe(r, "monitoreo").id);
  });

  it("cada pieza engancha a su ancestro MÁS CERCANO, no al módulo raíz", () => {
    const r = disponerRamificacion(
      [pieza("monitoreo"), pieza("monitoreo::territorial"), pieza("monitoreo::territorial/avance")],
      ORIGEN,
      "s",
    );
    const avance = r.edges.find((e) => e.to_node === nodoDe(r, "monitoreo::territorial/avance").id)!;
    expect(avance.from_node).toBe(nodoDe(r, "monitoreo::territorial").id);
  });

  it("piezas de módulos distintos no se conectan entre sí", () => {
    const r = disponerRamificacion([pieza("monitoreo"), pieza("procesamiento")], ORIGEN, "s");
    expect(r.edges).toEqual([]);
  });

  it("un hito o una entrada no cuelgan del árbol de la app", () => {
    // No son parte de la estructura: son anotaciones sobre ella.
    const r = disponerRamificacion(
      [pieza("procesamiento"), pieza("t1", "tarea"), pieza("e1", "entrada")],
      ORIGEN,
      "s",
    );
    expect(r.edges).toEqual([]);
    expect(nodoDe(r, "t1").y).toBeGreaterThan(nodoDe(r, "procesamiento").y);
  });

  it("un hito y una entrada son más altos que una pieza de la app", () => {
    const r = disponerRamificacion([pieza("procesamiento"), pieza("t1", "tarea")], ORIGEN, "s");
    expect(nodoDe(r, "t1").h).toBeGreaterThan(nodoDe(r, "procesamiento").h);
  });

  it("los ids no colisionan dentro de una inserción", () => {
    const r = disponerRamificacion(
      ["a", "a/b", "a/c", "a/b/d"].map((x) => pieza(x)),
      ORIGEN,
      "s",
    );
    expect(new Set(r.nodes.map((n) => n.id)).size).toBe(4);
    expect(new Set(r.edges.map((e) => e.id)).size).toBe(r.edges.length);
  });

  it("la ramificación nace en el origen que se le pasa", () => {
    const r = disponerRamificacion([pieza("procesamiento")], { x: 500, y: 900 }, "s");
    expect(r.nodes[0]).toMatchObject({ x: 500, y: 900 });
  });

  it("las aristas dicen pertenencia, no dependencia", () => {
    // «bloquea» haría que el mapa se lea como un grafo de precedencias.
    const r = disponerRamificacion([pieza("procesamiento"), pieza("procesamiento/carga")], ORIGEN, "s");
    expect(r.edges[0].relation).toBe("contiene");
  });
});
