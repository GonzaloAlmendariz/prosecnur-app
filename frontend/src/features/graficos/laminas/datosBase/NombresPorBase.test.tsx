// La fila «Nombre de cada público» pintada (markup estático): una caja por base con el nombre guardado, y su vacío
// contenido en la fila cuando el estudio tiene una sola base.
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NombresPorBase } from "./NombresPorBase";
import { NotaBaseCompartido } from "./NotaBaseCompartido";

let fuentes = [{ name: "docentes" }, { name: "egresados" }];
vi.mock("../../useVariables", () => ({
  useVariables: () => ({ sources: fuentes, multi: fuentes.length > 1, variables: [], loading: false, error: null }),
}));
afterEach(() => { fuentes = [{ name: "docentes" }, { name: "egresados" }]; });

const pintar = (valor: unknown) => renderToStaticMarkup(
  <NombresPorBase argName="tabla_encabezados" rotulo="Nombre de cada público" ayuda={null} valor={valor} onCambio={() => undefined} />,
);

describe("NombresPorBase", () => {
  it("una caja por base, con el nombre guardado y el técnico de placeholder", () => {
    const html = pintar("egresados=Egresados");
    expect([...html.matchAll(/aria-label="Nombre del público ([^"]+)"/g)].map((m) => m[1])).toEqual(["docentes", "egresados"]);
    expect(html).toMatch(/value="Egresados"/);
    expect(html).toMatch(/placeholder="docentes"/);
    expect(html).toMatch(/role="group"/);
  });
  it("con una sola base no dibuja cajas: lo dice dentro de la fila", () => {
    fuentes = [{ name: "principal" }];
    const html = pintar("");
    expect(html).not.toMatch(/<input/);
    expect(html).toMatch(/no tiene bases separadas/);
  });
  it("la nota del informe compartido es una nota con el texto del contrato", () => {
    expect(renderToStaticMarkup(<NotaBaseCompartido />)).toMatch(/role="note".*En el informe compartido elige la base de esta variable\./);
  });
});
