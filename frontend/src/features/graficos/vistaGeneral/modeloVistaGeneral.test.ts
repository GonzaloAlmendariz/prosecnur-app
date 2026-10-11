import { describe, expect, it } from "vitest";
import type { Slide, SlideType } from "../../../api/graficos";
import { construirEstructura, contarLaminas } from "../laminas/modeloEstructura";
import {
  coberturaInforme,
  construirFilas,
  desplazarCapitulo,
  desplazarIds,
  duplicarSlides,
  eliminarSlides,
  filaDeLamina,
  focoEnLaminas,
  ladoDeSoltar,
  moverIds,
  ordenTrasSoltar,
  ranuraAlFinalDeFila,
  ranuraParaCapitulo,
  reordenarSlides,
  resolverFocoVistaGeneral,
} from "./modeloVistaGeneral";

const s = (id: string, tipo: SlideType, payload: Record<string, unknown> = {}): Slide => ({ id, tipo, payload });
const graf = (g = "p_barras_apiladas") => ({ graficador: g, args: { var: "P1" } });

// Apertura (a), capítulo 1 «Perfil» (c1: e, f-sub, g), capítulo 2 «Docentes» (c2: h, i), cierre (z).
const plan: Slide[] = [
  s("a", "p_slide_portada", { titulo: "Estudio" }),
  s("c1", "p_slide_seccion", { titulo: "Perfil" }),
  s("e", "p_slide_2_graficos", { titulo: "Edad", izquierda: graf("p_pie") }),
  s("f", "p_slide_seccion", { titulo: "Gestión", meta: { nivel: "subcapitulo" } }),
  s("g", "p_slide_1_grafico", { grafico: graf() }),
  s("c2", "p_slide_seccion", { titulo: "Docentes" }),
  s("h", "p_slide_1_grafico", { grafico: graf("p_donut") }),
  s("i", "p_slide_texto", { titulo: "Lectura" }),
  s("z", "p_slide_cierre"),
];
const ids = plan.map((x) => x.id);
const filas = construirFilas(construirEstructura(plan), plan);
const filasDe = (orden: string[]) => {
  const slides = reordenarSlides(plan, orden);
  return construirFilas(construirEstructura(slides), slides);
};
const fila = (id: string) => filas.find((f) => f.id === id)!;

describe("filas de la Vista general", () => {
  // Mata: perder el separador o los subcapítulos de la fila; contar distinto que la Estructura; glifos de ranuras vacías.
  it("una fila por nodo, con separador, subcapítulo y láminas en el orden del plan", () => {
    expect(filas.map((f) => f.rotulo)).toEqual(["Apertura", "1. Perfil", "2. Docentes", "Cierre"]);
    expect(fila("cap-c1").tarjetas.map((t) => `${t.rol}:${t.lamina.id}`)).toEqual([
      "separador:c1", "lamina:e", "subcapitulo:f", "lamina:g",
    ]);
    expect(fila("cap-c1").tarjetas.find((t) => t.rol === "subcapitulo")?.numero).toBe("1.1");
    const estructura = construirEstructura(plan);
    estructura.nodos.forEach((n, i) => expect(filas[i].conteo.laminas).toBe(contarLaminas(n)));
    expect(fila("cap-c1").tarjetas.find((t) => t.lamina.id === "e")?.graficos).toEqual(["p_pie"]);
  });

  // Mata: contar como «con gráfico» una lámina sin gráficos, o no marcar la de dos ranuras con una vacía.
  it("cuenta láminas, con gráfico e incompletas por capítulo y en total", () => {
    expect(fila("cap-c1").conteo).toEqual({ laminas: 4, conGrafico: 2, incompletas: 1 });
    expect(fila("cap-c2").conteo).toEqual({ laminas: 3, conGrafico: 1, incompletas: 0 });
    expect(coberturaInforme(filas)).toEqual({ laminas: 9, conGrafico: 3, incompletas: 1, capitulos: 2 });
  });
});

describe("reordenar láminas", () => {
  // Mata: insertar en el índice sin descontar las movidas que estaban antes; invertir el orden de una selección.
  it("dentro del capítulo: la ranura es la del orden original", () => {
    expect(moverIds(ids, new Set(["g"]), ids.indexOf("e"))).toEqual(["a", "c1", "g", "e", "f", "c2", "h", "i", "z"]);
    expect(moverIds(ids, new Set(["e"]), ids.indexOf("g") + 1)).toEqual(["a", "c1", "f", "g", "e", "c2", "h", "i", "z"]);
    expect(moverIds(ids, new Set(["i", "e"]), 1)).toEqual(["a", "e", "i", "c1", "f", "g", "c2", "h", "z"]);
  });

  // Mata: soltar al final de una fila con el índice de su primera lámina; mover a un capítulo que no cambia de fila.
  it("entre capítulos: al final de la fila de destino y la lámina cambia de capítulo", () => {
    const orden = moverIds(ids, new Set(["e"]), ranuraAlFinalDeFila(ids, fila("cap-c2")));
    expect(orden).toEqual(["a", "c1", "f", "g", "c2", "h", "i", "e", "z"]);
    expect(filaDeLamina(filasDe(orden), "e")?.rotulo).toBe("2. Docentes");
    expect(ordenTrasSoltar(ids, filas, { clase: "laminas", ids: ["h"] }, { clase: "tarjeta", id: "e", lado: "antes" }))
      .toEqual(["a", "c1", "h", "e", "f", "g", "c2", "i", "z"]);
    expect(ordenTrasSoltar(ids, filas, { clase: "laminas", ids: ["e"] }, { clase: "tarjeta", id: "e", lado: "despues" })).toBeNull();
  });

  // Mata: Alt+flecha que mueve dos lugares, que deja pasar a la del borde o que separa una selección contigua.
  it("Alt+↑/↓: un lugar por vez; en el borde se queda y la selección se junta", () => {
    expect(desplazarIds(ids, new Set(["g"]), -1)).toEqual(["a", "c1", "e", "g", "f", "c2", "h", "i", "z"]);
    expect(desplazarIds(ids, new Set(["a"]), -1)).toEqual(ids);
    expect(desplazarIds(ids, new Set(["z"]), 1)).toEqual(ids);
    expect(desplazarIds(ids, new Set(["e", "f"]), 1)).toEqual(["a", "c1", "g", "e", "f", "c2", "h", "i", "z"]);
    expect(desplazarIds(ids, new Set(["a", "e"]), -1)).toEqual(["a", "e", "c1", "f", "g", "c2", "h", "i", "z"]);
  });

  // Mata: la mitad del puntero invertida.
  it("la mitad izquierda suelta antes y la derecha después", () => {
    expect(ladoDeSoltar(10, 0, 176)).toBe("antes");
    expect(ladoDeSoltar(100, 0, 176)).toBe("despues");
  });
});

describe("mover capítulos", () => {
  // Mata: mover sólo el separador (dejando sus láminas) o cruzarlo con la Apertura o el Cierre.
  it("el capítulo viaja entero con su subcapítulo y sólo se cruza con capítulos", () => {
    const abajo = desplazarCapitulo(ids, filas, "cap-c1", 1);
    expect(abajo).toEqual(["a", "c2", "h", "i", "c1", "e", "f", "g", "z"]);
    expect(filasDe(abajo!).map((f) => f.rotulo)).toEqual(["Apertura", "1. Docentes", "2. Perfil", "Cierre"]);
    expect(desplazarCapitulo(ids, filas, "cap-c1", -1)).toBeNull();
    expect(desplazarCapitulo(ids, filas, "cap-c2", 1)).toBeNull();
    expect(ranuraParaCapitulo(ids, filas, "bloque-apertura", "antes")).toBeNull();
  });

  // Mata: arrastrar un capítulo sobre sí mismo como cambio, o aceptar un destino que no es capítulo.
  it("arrastrar un capítulo antes de otro", () => {
    expect(ordenTrasSoltar(ids, filas, { clase: "capitulo", filaId: "cap-c2" }, { clase: "capitulo", filaId: "cap-c1", lado: "antes" }))
      .toEqual(["a", "c2", "h", "i", "c1", "e", "f", "g", "z"]);
    expect(ordenTrasSoltar(ids, filas, { clase: "capitulo", filaId: "cap-c2" }, { clase: "capitulo", filaId: "cap-c2", lado: "antes" })).toBeNull();
    expect(ordenTrasSoltar(ids, filas, { clase: "capitulo", filaId: "cap-c2" }, { clase: "fin-fila", filaId: "bloque-cierre" })).toBeNull();
  });
});

describe("acciones en bloque", () => {
  // Mata: insertar la copia al final en vez de junto a su original; reusar un id existente; compartir el payload.
  it("duplicar deja cada copia tras su original, con id nuevo y payload propio", () => {
    let n = 0;
    const ids2 = ["e", "s-nuevo1", "s-nuevo2"];
    const { slides, copias } = duplicarSlides(plan, new Set(["e", "h"]), () => ids2[n++]);
    expect(copias).toEqual(["s-nuevo1", "s-nuevo2"]);
    expect(slides.map((x) => x.id)).toEqual(["a", "c1", "e", "s-nuevo1", "f", "g", "c2", "h", "s-nuevo2", "i", "z"]);
    const copia = slides[3];
    expect(copia.payload).toEqual(plan[2].payload);
    expect(copia.payload).not.toBe(plan[2].payload);
  });

  // Mata: dejar la referencia en una eliminada, o en ninguna cuando sólo quedan anteriores.
  it("eliminar quita las elegidas y propone la vecina viva", () => {
    expect(eliminarSlides(plan, new Set(["e", "f"]))).toMatchObject({ vecina: "g" });
    expect(eliminarSlides(plan, new Set(["e", "f"])).slides.map((x) => x.id)).toEqual(["a", "c1", "g", "c2", "h", "i", "z"]);
    expect(eliminarSlides(plan, new Set(["i", "z"])).vecina).toBe("h");
    expect(eliminarSlides(plan, new Set(ids)).vecina).toBeNull();
  });

  // Mata: perder láminas que el orden no nombra o repetirlas.
  it("reordenar el plan no pierde ni repite láminas", () => {
    expect(reordenarSlides(plan, ["z", "a", "z", "nada"]).map((x) => x.id)).toEqual(["z", "a", "c1", "e", "f", "g", "c2", "h", "i"]);
  });
});

describe("foco por id", () => {
  // Mata: resolver `foco` por posición cuando hay id (tras reordenar apuntaría a otra lámina), o ignorar el `l-NN` heredado.
  it("el id sigue a su lámina tras reordenar; `l-NN` se traduce a la de ahora", () => {
    const reordenado = reordenarSlides(plan, desplazarIds(ids, new Set(["g"]), -1));
    expect(resolverFocoVistaGeneral("g", reordenado)).toBe("g");
    expect(resolverFocoVistaGeneral("l-03", plan)).toBe("e");
    expect(resolverFocoVistaGeneral("l-03:g2", plan)).toBe("e");
    expect(resolverFocoVistaGeneral("l-99", plan)).toBeNull();
    expect(resolverFocoVistaGeneral("otra", plan)).toBeNull();
    expect(resolverFocoVistaGeneral(null, plan)).toBeNull();
  });

  // Mata: abrir en Láminas con la posición vieja.
  it("Enter abre en Láminas con la posición vigente", () => {
    const reordenado = reordenarSlides(plan, desplazarIds(ids, new Set(["g"]), -1));
    expect(focoEnLaminas(plan, "g")).toBe("l-05");
    expect(focoEnLaminas(reordenado, "g")).toBe("l-04");
    expect(focoEnLaminas(plan, "nada")).toBeNull();
  });
});
