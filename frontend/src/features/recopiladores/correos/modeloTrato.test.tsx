import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { normalizeMailBlock, normalizeMailRecipients, normalizeMailTrato, type MailGreetingBlock, type MailRecipients } from "../../../api/materialMail";
import { conTrato, lecturaEnPalabras, lineaDelTrato, respaldoEnElSaludo, rotuloDeProblemaDelTrato, tratoDelSaludo } from "./modeloTrato";
import { SaludoSegunLaPersona } from "./SaludoSegunLaPersona";

const SALUDO: MailGreetingBlock = {
  block_id: "saludo",
  type: "greeting",
  text: "Estimado(a) {{nombre}}:",
  trato: { modo: "por_sexo", masculino: "Estimado", femenino: "Estimada", respaldo: "Estimado(a)" },
};

const LISTA: MailRecipients = normalizeMailRecipients({
  loaded: true,
  file_name: "lista.csv",
  row_count: 6,
  columns: ["correo", "nombre", "sexo"],
  counts: { total: 6, valid: 6 },
  sample: [{ index: 1, nombre: "Ana", fields: {}, trato: "Estimada" }],
  trato: {
    block_id: "saludo", columna: "sexo", presente: true, lectura: "m_f",
    counts: { efectivos: 6, masculino: 3, femenino: 2, sin_dato: 1, no_reconocido: 0 },
    no_reconocidos: [], palabras: { masculino: "Estimado", femenino: "Estimada", respaldo: "Estimado(a)" },
  },
});

describe("el trato del saludo (C8)", () => {
  it("se normaliza con sus palabras por defecto y viaja en el bloque", () => {
    expect(normalizeMailTrato({ modo: "por_sexo" })).toEqual({ modo: "por_sexo", masculino: "Estimado", femenino: "Estimada", respaldo: "Estimado(a)" });
    expect(normalizeMailTrato(null)).toBeUndefined();
    const b = normalizeMailBlock({ block_id: "saludo", type: "greeting", text: "Hola", trato: { modo: "fijo", columna: " sexo ", sm: "CustomData2" } });
    expect(b).toMatchObject({ trato: { modo: "fijo", columna: "sexo", sm: "CustomData2" } });
  });

  it("los destinatarios traen el resumen del trato y la palabra de cada muestra", () => {
    expect(LISTA.trato?.counts?.masculino).toBe(3);
    expect(LISTA.sample[0].trato).toBe("Estimada");
  });

  it("un saludo sin trato es igual para todos; cambiar la columna y las palabras", () => {
    expect(tratoDelSaludo({ trato: undefined }).modo).toBe("fijo");
    const conColumna = conTrato(SALUDO, { columna: "sexo" });
    expect(conColumna.trato?.columna).toBe("sexo");
    expect(conTrato(conColumna, { columna: null }).trato).not.toHaveProperty("columna");
    expect(conTrato(SALUDO, { palabra: "femenino", valor: "Querida" }).trato?.femenino).toBe("Querida");
    // Volver a «igual para todos» no pierde la columna.
    expect(conTrato(conColumna, { modo: "fijo" }).trato).toMatchObject({ modo: "fijo", columna: "sexo" });
  });

  it("la línea de resultado dice cuántos reciben cada palabra", () => {
    expect(lineaDelTrato(LISTA.trato!, SALUDO.trato!)).toBe("Estimado a 3 · Estimada a 2 · Estimado(a) a 1 sin dato");
    expect(lineaDelTrato({ ...LISTA.trato!, presente: false }, SALUDO.trato!)).toBeNull();
  });

  it("la lectura de «M» en palabras, y el respaldo en el texto", () => {
    expect(lecturaEnPalabras("m_f", SALUDO.trato!)).toContain("masculino");
    expect(lecturaEnPalabras("h_m", SALUDO.trato!)).toContain("mujer");
    expect(lecturaEnPalabras("m_ambigua", SALUDO.trato!)).toContain("Estimado(a)");
    expect(respaldoEnElSaludo(SALUDO)).toBe(true);
    expect(respaldoEnElSaludo({ ...SALUDO, text: "Hola {{nombre}}:" })).toBe(false);
  });

  it("los problemas llevan rótulo es-PE", () => {
    expect(rotuloDeProblemaDelTrato({ code: "bad_column", detail: "No existe." })).toBe("Columna de sexo: No existe.");
    expect(rotuloDeProblemaDelTrato({ code: "otro", detail: "x" })).toBe("x");
  });
});

describe("«Saludo según la persona» en el inspector", () => {
  const props = { plataforma: "mailchimp" as const, problemas: [], onEditar: () => undefined, onIrAPersonas: () => undefined };

  it("con lista M/F: la columna, las tres palabras y el resultado con cifras", () => {
    const html = renderToStaticMarkup(<SaludoSegunLaPersona {...props} block={{ ...SALUDO, trato: { ...SALUDO.trato!, columna: "sexo" } }} destinatarios={LISTA} />);
    expect(html).toContain("Saludo según la persona");
    expect(html).toContain('<option value="sexo" selected="">sexo</option>');
    expect(html.match(/data-qa-geometry-member/g)).toHaveLength(3);
    expect(html).toContain("Estimado a 3 · Estimada a 2 · Estimado(a) a 1 sin dato");
    expect(html).toContain("«M» se lee como masculino");
  });

  it("sin lista: pide cargarla en Personas", () => {
    const html = renderToStaticMarkup(<SaludoSegunLaPersona {...props} block={SALUDO} destinatarios={null} />);
    expect(html).toContain("Carga la lista en Personas para elegir la columna");
    expect(html).not.toContain("<select");
  });
});
