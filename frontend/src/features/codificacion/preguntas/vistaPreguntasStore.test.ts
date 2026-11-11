import { describe, expect, it } from "vitest";
import { useVistaPreguntas } from "./vistaPreguntasStore";

describe("cómo se mira Preguntas", () => {
  it('abre en "Con texto", sin búsqueda ni unidad seleccionada', () => {
    expect(useVistaPreguntas.getState()).toMatchObject({ filtro: "con-texto", consulta: "", seleccion: null });
  });

  it("recuerda el filtro, la búsqueda y la selección mientras dura la ventana", () => {
    const inicial = useVistaPreguntas.getState();
    inicial.elegirFiltro("todas");
    inicial.buscar("otro");
    inicial.seleccionar("p3");
    expect(useVistaPreguntas.getState()).toMatchObject({ filtro: "todas", consulta: "otro", seleccion: "p3" });
    useVistaPreguntas.setState({ filtro: "con-texto", consulta: "", seleccion: null });
  });
});
