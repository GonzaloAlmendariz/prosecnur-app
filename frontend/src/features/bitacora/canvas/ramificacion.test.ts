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

  it("la profundidad en el árbol se convierte en avance hacia la derecha", () => {
    const r = disponerRamificacion(
      [pieza("procesamiento/carga/fuentes"), pieza("procesamiento"), pieza("procesamiento/carga")],
      ORIGEN,
      "s",
    );
    const modulo = nodoDe(r, "procesamiento");
    const seccion = nodoDe(r, "procesamiento/carga");
    const pestana = nodoDe(r, "procesamiento/carga/fuentes");
    expect(modulo.x).toBeLessThan(seccion.x);
    expect(seccion.x).toBeLessThan(pestana.x);
  });

  it("una sección de modo cuenta el modo como un nivel", () => {
    const r = disponerRamificacion(
      [pieza("monitoreo"), pieza("monitoreo::territorial"), pieza("monitoreo::territorial/avance")],
      ORIGEN,
      "s",
    );
    const xs = ["monitoreo", "monitoreo::territorial", "monitoreo::territorial/avance"].map(
      (d) => nodoDe(r, d).x,
    );
    expect(xs[0]).toBeLessThan(xs[1]);
    expect(xs[1]).toBeLessThan(xs[2]);
  });

  it("los hermanos de un mismo nivel se apilan en vertical sin pisarse", () => {
    const r = disponerRamificacion(
      [pieza("procesamiento/carga"), pieza("procesamiento/validacion"), pieza("procesamiento/analitica")],
      ORIGEN,
      "s",
    );
    const xs = new Set(r.nodes.map((n) => n.x));
    expect(xs.size).toBe(1);
    const ys = r.nodes.map((n) => n.y).sort((a, b) => a - b);
    expect(new Set(ys).size).toBe(3);
    // Separación mayor que el alto del nodo: no se superponen.
    expect(ys[1] - ys[0]).toBeGreaterThanOrEqual(r.nodes[0].h);
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

describe("el layout es un árbol, no filas por nivel", () => {
  const RAMA_PROCESAMIENTO = [
    pieza("procesamiento"),
    pieza("procesamiento/carga"),
    pieza("procesamiento/validacion"),
    pieza("procesamiento/codificacion"),
    pieza("procesamiento/analitica"),
    pieza("procesamiento/graficos"),
    pieza("procesamiento/carga/plan"),
    pieza("procesamiento/carga/fuentes"),
    pieza("procesamiento/carga/revision"),
    pieza("procesamiento/carga/estructura"),
    pieza("procesamiento/carga/datos"),
  ];

  it("cada padre queda centrado frente a sus hijos", () => {
    // Repartiendo por nivel —cada fila de izquierda a derecha sin mirar de
    // quién cuelga— las aristas cruzan todo el ancho del mapa.
    const r = disponerRamificacion(RAMA_PROCESAMIENTO, ORIGEN, "s");
    const centroDe = (destino: string) => {
      const n = nodoDe(r, destino);
      return n.y + n.h / 2;
    };
    const pestanas = ["plan", "fuentes", "revision", "estructura", "datos"].map((t) =>
      centroDe(`procesamiento/carga/${t}`),
    );
    expect(centroDe("procesamiento/carga")).toBeCloseTo(
      (Math.min(...pestanas) + Math.max(...pestanas)) / 2,
      5,
    );

    const secciones = ["carga", "validacion", "codificacion", "analitica", "graficos"].map((s) =>
      centroDe(`procesamiento/${s}`),
    );
    expect(centroDe("procesamiento")).toBeCloseTo(
      (Math.min(...secciones) + Math.max(...secciones)) / 2,
      5,
    );
  });

  it("los hermanos de un padre quedan juntos, sin otro subárbol en el medio", () => {
    const r = disponerRamificacion(
      [
        pieza("procesamiento"),
        pieza("procesamiento/carga"),
        pieza("procesamiento/carga/plan"),
        pieza("procesamiento/carga/datos"),
        pieza("procesamiento/validacion"),
        pieza("procesamiento/validacion/x"),
      ],
      ORIGEN,
      "s",
    );
    const ys = (d: string) => nodoDe(r, d).y;
    const deCarga = [ys("procesamiento/carga/plan"), ys("procesamiento/carga/datos")];
    const deValidacion = ys("procesamiento/validacion/x");
    expect(Math.max(...deCarga) < deValidacion || Math.min(...deCarga) > deValidacion).toBe(true);
  });

  it("dos subárboles no se pisan", () => {
    const r = disponerRamificacion(
      [
        pieza("monitoreo"), pieza("monitoreo::territorial"), pieza("monitoreo::territorial/avance"),
        pieza("procesamiento"), pieza("procesamiento/carga"),
      ],
      ORIGEN,
      "s",
    );
    const celdas = r.nodes.map((n) => `${Math.round(n.x)}:${Math.round(n.y)}`);
    expect(new Set(celdas).size).toBe(celdas.length);
  });

  it("una anotación no entra en el árbol: va en su propia fila al pie", () => {
    const r = disponerRamificacion(
      [pieza("procesamiento"), pieza("procesamiento/carga"), pieza("t1", "tarea")],
      ORIGEN,
      "s",
    );
    const maxEstructura = Math.max(
      nodoDe(r, "procesamiento").y,
      nodoDe(r, "procesamiento/carga").y,
    );
    expect(nodoDe(r, "t1").y).toBeGreaterThan(maxEstructura);
  });

  it("el orden no depende de en qué orden se marcaron las piezas", () => {
    const posiciones = (r: ReturnType<typeof disponerRamificacion>) =>
      r.nodes
        .map((n) => `${n.ref?.target_id}@${n.x},${n.y}`)
        .sort()
        .join("|");
    expect(posiciones(disponerRamificacion([...RAMA_PROCESAMIENTO].reverse(), ORIGEN, "s"))).toBe(
      posiciones(disponerRamificacion(RAMA_PROCESAMIENTO, ORIGEN, "s")),
    );
  });

  it("la ramificación completa de Procesamiento son 11 nodos y 10 aristas", () => {
    const r = disponerRamificacion(RAMA_PROCESAMIENTO, ORIGEN, "s");
    expect(r.nodes).toHaveLength(11);
    expect(r.edges).toHaveLength(10);
  });
});
