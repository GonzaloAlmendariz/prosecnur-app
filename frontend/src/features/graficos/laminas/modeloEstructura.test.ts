import { describe, expect, it } from "vitest";
import type { Slide, SlideType } from "../../../api/graficos";
import {
  construirEstructura,
  contarLaminas,
  filtrarEstructura,
} from "./modeloEstructura";

const s = (id: string, tipo: SlideType, payload: Record<string, unknown> = {}): Slide => ({ id, tipo, payload });
const graf = { graficador: "p_barras_apiladas", args: { var: "P1" } };

// Forma del plan de acrconta: apertura, Top Two Box, capítulos abiertos por separadores sin nivel.
const plan: Slide[] = [
  s("a", "p_slide_portada", { titulo: "Estudio" }),
  s("b", "p_slide_indice"),
  s("c", "p_slide_top_two_box", { titulo: "Top Two Box" }),
  s("d", "p_slide_seccion", { titulo: "Perfil" }),
  s("e", "p_slide_4_graficos_poblacion", { titulo: "Estudiantes", superior_izquierda: graf }),
  s("f", "p_slide_seccion", { titulo: "Gestión", meta: { nivel: "subcapitulo" } }),
  s("g", "p_slide_1_grafico", { grafico: graf }),
  s("h", "p_slide_seccion", { titulo: "Cuerpo académico" }),
  s("i", "p_slide_1_grafico", { titulo: "Docentes", grafico: graf, meta: { antetitulo: "Propio" } }),
  s("j", "p_slide_cierre"),
];

describe("construirEstructura", () => {
  const e = construirEstructura(plan);

  it("separa apertura, cómo leer, capítulos numerados y cierre", () => {
    expect(e.nodos.map((n) => (n.clase === "capitulo" ? `${n.numero} ${n.titulo}` : n.titulo))).toEqual([
      "Apertura", "Cómo leer este informe", "1 Perfil", "2 Cuerpo académico", "Cierre",
    ]);
    expect(e.laminas).toHaveLength(plan.length);
  });

  it("numera subcapítulos dentro de su capítulo y cuelga sus láminas", () => {
    const cap = e.nodos[2];
    expect(cap.clase).toBe("capitulo");
    if (cap.clase !== "capitulo") return;
    expect(cap.laminas.map((l) => l.id)).toEqual(["e"]);
    expect(cap.subcapitulos).toHaveLength(1);
    expect(cap.subcapitulos[0]).toMatchObject({ numero: "1.1", titulo: "Gestión" });
    expect(cap.subcapitulos[0].laminas.map((l) => l.id)).toEqual(["g"]);
    expect(contarLaminas(cap)).toBe(4);
  });

  it("hereda el antetítulo del último separador, también el de un subcapítulo", () => {
    const porId = Object.fromEntries(e.laminas.map((l) => [l.id, l]));
    expect(porId.a.antetituloHeredado).toBeNull();
    expect(porId.e.antetituloHeredado).toBe("Perfil");
    expect(porId.g.antetituloHeredado).toBe("Gestión");
    expect(porId.d.antetituloHeredado).toBeNull();
    // El heredado se informa aunque la lámina fije uno propio: es el marcador del campo.
    expect(porId.i.antetituloHeredado).toBe("Cuerpo académico");
  });

  it("título del analista o, sin él, el nombre del tipo; cuenta ranuras llenas", () => {
    const porId = Object.fromEntries(e.laminas.map((l) => [l.id, l]));
    expect(porId.b.titulo).toBe("Índice");
    expect(porId.e).toMatchObject({ ranuras: 4, ranurasLlenas: 1, posicion: 5 });
  });

  // Mata (F1 del QA de Vista general): armar los bloques por TIPO. Con la lámina de apertura detrás de «Cómo leer», la
  // fila Apertura se la quedaba y el orden pintado (1,2,3,5 | 4 | 6…) contradecía el plan.
  it("cada nodo es un tramo contiguo del plan: recorrerlos da el orden del plan", () => {
    const movido: Slide[] = [plan[0], plan[1], plan[2], plan[4], plan[3], ...plan.slice(5)];
    const est = construirEstructura(movido);
    const recorrido = est.nodos.flatMap((n) => n.clase === "bloque"
      ? n.laminas.map((l) => l.id)
      : [n.separador.id, ...n.laminas.map((l) => l.id), ...n.subcapitulos.flatMap((x) => [x.separador.id, ...x.laminas.map((l) => l.id)])]);
    expect(recorrido).toEqual(movido.map((x) => x.id));
    // La lámina de gráficos «e» detrás de «Cómo leer» y sin separador va a «Sin capítulo» (G13 b, 2026-10-13).
    expect(est.nodos.map((n) => n.titulo)).toEqual(["Apertura", "Cómo leer este informe", "Sin capítulo", "Perfil", "Cuerpo académico", "Cierre"]);
    const comoLeer = est.nodos[1];
    expect(comoLeer.clase === "bloque" && comoLeer.laminas.map((l) => l.id)).toEqual(["c"]);
    const sinCapitulo = est.nodos[2];
    expect(sinCapitulo.clase === "bloque" && sinCapitulo.laminas.map((l) => l.id)).toEqual(["e"]);
  });

  it("un cierre a mitad del plan corta el capítulo y no se lleva láminas de otro lado", () => {
    const conCierre: Slide[] = [s("d", "p_slide_seccion", { titulo: "Perfil" }), s("x", "p_slide_cierre"), s("y", "p_slide_1_grafico"), s("h", "p_slide_seccion", { titulo: "Otro" }), s("z", "p_slide_cierre")];
    const est = construirEstructura(conCierre);
    expect(est.nodos.map((n) => `${n.id}:${n.clase === "bloque" ? n.laminas.map((l) => l.id).join(",") : n.laminas.map((l) => l.id).join(",")}`))
      .toEqual(["cap-d:", "bloque-cierre:x,y", "cap-h:", "bloque-cierre-2:z"]);
  });

  it("un plan vacío no inventa nodos", () => {
    expect(construirEstructura([])).toEqual({ nodos: [], laminas: [] });
  });
});

describe("filtrarEstructura", () => {
  const e = construirEstructura(plan);
  it("sin consulta devuelve todo", () => {
    expect(filtrarEstructura(e, "  ")).toBe(e.nodos);
  });
  it("busca sin tildes y conserva el capítulo de la lámina hallada", () => {
    const r = filtrarEstructura(e, "docentes");
    expect(r).toHaveLength(1);
    expect(r[0].clase === "capitulo" && r[0].laminas.map((l) => l.id)).toEqual(["i"]);
  });
  it("un capítulo que coincide trae todas sus láminas", () => {
    const r = filtrarEstructura(e, "academico");
    expect(r[0].clase === "capitulo" && r[0].laminas.map((l) => l.id)).toEqual(["i"]);
  });
});

describe("resultados sin separador detrás de «Cómo leer» (G13 b)", () => {
  it("no quedan colgados de «Cómo leer»; el redondeo que sigue al Top Two Box sí", () => {
    const est = construirEstructura([s("a", "p_slide_portada"), s("t", "p_slide_top_two_box"), s("r", "p_slide_redondeo"), s("g1", "p_slide_1_grafico"), s("g2", "p_slide_1_grafico")]);
    expect(est.nodos.map((n) => n.titulo)).toEqual(["Apertura", "Cómo leer este informe", "Sin capítulo"]);
    expect(est.nodos[1].clase === "bloque" && est.nodos[1].laminas.map((l) => l.id)).toEqual(["t", "r"]);
    expect(est.nodos[2].clase === "bloque" && est.nodos[2].laminas.map((l) => l.id)).toEqual(["g1", "g2"]);
  });
});

describe("una lámina de apertura detrás de «Cómo leer» (G15/U11)", () => {
  it("no queda dentro de «Cómo leer»: abre su bloque de apertura, contiguo", () => {
    const est = construirEstructura([s("g", "p_slide_1_grafico"), s("t", "p_slide_top_two_box"), s("i", "p_slide_indice"), s("r", "p_slide_redondeo")]);
    expect(est.nodos.map((n) => n.titulo)).toEqual(["Apertura", "Cómo leer este informe", "Apertura", "Cómo leer este informe"]);
    expect(est.nodos[1].clase === "bloque" && est.nodos[1].laminas.map((l) => l.id)).toEqual(["t"]);
    expect(est.nodos[2].clase === "bloque" && est.nodos[2].laminas.map((l) => l.id)).toEqual(["i"]);
  });
});

describe("los resultados detrás de una Apertura reabierta (G15/U11, regresión)", () => {
  it("van a «Sin capítulo», no a la Apertura del índice", () => {
    const est = construirEstructura([s("g", "p_slide_1_grafico"), s("t", "p_slide_top_two_box"), s("i", "p_slide_indice"), s("a", "p_slide_1_grafico"), s("b", "p_slide_2_graficos")]);
    expect(est.nodos.map((n) => n.titulo)).toEqual(["Apertura", "Cómo leer este informe", "Apertura", "Sin capítulo"]);
    expect(est.nodos[3].clase === "bloque" && est.nodos[3].laminas.map((l) => l.id)).toEqual(["a", "b"]);
  });
});
