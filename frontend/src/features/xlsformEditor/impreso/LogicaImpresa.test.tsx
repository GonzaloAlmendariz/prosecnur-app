// «Así se lee la lógica» (L36 · D-L36-20): contrato del cliente, agrupación por pregunta y los tres estados.
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { normalizeLogicaImpresa, type InstruccionImpresa } from "../../../api/xlsformImpreso";
import { agruparLogica, ListaLogicaImpresa, rotuloInstruccion } from "./LogicaImpresa";

const salto = (numero: string, nombre: string, opcion: string, texto: string): InstruccionImpresa =>
  ({ numero, nombre, tipo: "salto", opcion, texto });

describe("lógica impresa", () => {
  it("normaliza lo que manda el servidor y descarta tipos o textos vacíos", () => {
    const l = normalizeLogicaImpresa({
      lenguaje: "condiciones",
      instrucciones: [
        { numero: "3", nombre: "consent", tipo: "salto", opcion: "No (2)", texto: "pase a la pregunta 56" },
        { numero: "4", nombre: "x", tipo: "otro", texto: "nada" },
        { numero: "5", nombre: "y", tipo: "salida", texto: "  " },
      ],
      avisos: ["Condiciones que dependen de una pregunta posterior: p9.", 3],
    });
    expect(l.lenguaje).toBe("condiciones");
    expect(l.instrucciones).toHaveLength(1);
    expect(l.avisos).toEqual(["Condiciones que dependen de una pregunta posterior: p9."]);
    expect(normalizeLogicaImpresa(null)).toEqual({ lenguaje: "saltos", instrucciones: [], avisos: [] });
  });

  it("agrupa por pregunta en el orden del cuestionario y rotula cuándo se lee", () => {
    const grupos = agruparLogica([
      salto("3", "consent", "No (2)", "pase a la pregunta 56"),
      salto("4", "filtro", "No (2)", "pase a la pregunta 56"),
      salto("4", "filtro", "Solo consultas (3)", "pase a la pregunta 56"),
    ]);
    expect(grupos.map((g) => [g.numero, g.instrucciones.length])).toEqual([["3", 1], ["4", 2]]);
    expect(rotuloInstruccion(grupos[0]!.instrucciones[0]!)).toBe('Si responde "No (2)"');
    expect(rotuloInstruccion({ numero: "1", nombre: "a", tipo: "condicion", opcion: "", texto: "En caso…" })).toBe("Antes de la pregunta");
  });

  it("contiene su vacío, su error y sus avisos", () => {
    const vacio = renderToStaticMarkup(<ListaLogicaImpresa estado={{ fase: "lista", logica: { lenguaje: "saltos", instrucciones: [], avisos: [] } }} />);
    expect(vacio).toContain("no tiene saltos ni condiciones");
    expect(renderToStaticMarkup(<ListaLogicaImpresa estado={{ fase: "error", causa: "sin sesión" }} />)).toContain("No pude leer la lógica: sin sesión");
    const conAviso = renderToStaticMarkup(<ListaLogicaImpresa estado={{ fase: "lista", logica: {
      lenguaje: "saltos", instrucciones: [salto("3", "consent", "No (2)", "pase a la pregunta 56")], avisos: ["Aviso de prueba."],
    } }} />);
    expect(conAviso).toContain("Aviso de prueba.");
    expect(conAviso).toContain("Si responde &quot;No (2)&quot;");
    expect(conAviso).toContain("pase a la pregunta 56");
  });
});
