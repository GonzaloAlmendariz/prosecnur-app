import { describe, expect, it } from "vitest";
import type { Slide, SlideType } from "../../../api/graficos";
import {
  construirEstructura,
  contarLaminas,
  filtrarEstructura,
  focoDeLamina,
  parsearFocoLamina,
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

  it("un plan vacío no inventa nodos", () => {
    expect(construirEstructura([])).toEqual({ nodos: [], laminas: [] });
  });
});

describe("foco de lámina", () => {
  it("lee l-NN y l-NN:gK y rechaza lo demás", () => {
    expect(parsearFocoLamina("l-07")).toEqual({ posicion: 7, ranura: null });
    expect(parsearFocoLamina("l-67:g2")).toEqual({ posicion: 67, ranura: 2 });
    expect(parsearFocoLamina("p-14")).toBeNull();
    expect(parsearFocoLamina("l-0")).toBeNull();
    expect(parsearFocoLamina("slide-7")).toBeNull();
    expect(parsearFocoLamina(null)).toBeNull();
  });

  it("escribe con dos cifras y ida y vuelta estable", () => {
    expect(focoDeLamina(7)).toBe("l-07");
    expect(focoDeLamina(7, 2)).toBe("l-07:g2");
    expect(focoDeLamina(123)).toBe("l-123");
    expect(parsearFocoLamina(focoDeLamina(14, 3))).toEqual({ posicion: 14, ranura: 3 });
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
