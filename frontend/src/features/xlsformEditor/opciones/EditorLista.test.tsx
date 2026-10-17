// S3: una lista que sale de una repetición (`select_one ${HH01_2_aux}` del ACNUR) no se presenta como una lista vacía
// a la que hay que «agregar la primera» opción: se dice de dónde salen las opciones y no se ofrece escribirlas.
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { acnur } from "../reglas/acnurEs.fixture";
import { EditorLista } from "./EditorLista";
import { origenDeLista } from "./opcionesModel";

const nada = () => {};
const props = { usos: 2, onRename: nada, onAgregar: nada, onCambio: nada, onQuitar: nada, onMover: nada, onBorrarLista: nada };

describe("EditorLista con opciones dinámicas", () => {
  it("con la estructura, cita la pregunta y la repetición por su etiqueta y no ofrece «Agregar opción»", () => {
    const A = acnur();
    const lista = { listName: "${HH01_2_aux}", title: "${HH01_2_aux}", items: [] };
    const html = renderToStaticMarkup(<EditorLista lista={lista} {...props} origen={origenDeLista(lista.listName, A.structure)} />);
    expect(html).toContain("Las opciones son las respuestas a «Nombre del miembro del hogar», una por cada fila registrada en la repetición «Lista de los miembros del hogar»");
    expect(html).not.toContain("Agrega la primera");
    expect(html).not.toContain("Agregar opción");
    expect(html).toContain("opciones dinámicas");
  });
  it("sin la estructura, el código de la lista basta para no ofrecer escribirlas", () => {
    const html = renderToStaticMarkup(<EditorLista lista={{ listName: "${HH01_2_aux}", title: "", items: [] }} {...props} />);
    expect(html).toContain("Las opciones son las respuestas a «HH01_2_aux»");
    expect(html).not.toContain("Agregar opción");
  });
  it("una lista de choices vacía sigue ofreciendo agregar la primera", () => {
    const html = renderToStaticMarkup(<EditorLista lista={{ listName: "nueva", title: "", items: [] }} {...props} />);
    expect(html).toContain("Agrega la primera");
    expect(html).toContain("Agregar opción");
  });
});
