// Revisión de usabilidad de 2026-10-20 (F2, F3, F4, F15, F16): las reglas que
// deciden qué se ofrece y qué se dice, sin montar la vista.
import { describe, expect, it } from "vitest";

import type { MailGreetingBlock } from "../../../api/materialMail";
import { conCajon } from "./anchoDelEditor";
import { comoSaleEnLaPlataforma, ranuraDelTrato } from "./comoSaleEnLaPlataforma";
import { agregarRecordatorio, asuntoDeRecordatorio, marcaDeExportado } from "./modeloEnvios";
import { columnaQuePareceSexo, conTratoPorSexo, ofertaDelTrato } from "./modeloTrato";
import { salidaDelChequeo } from "./PanelRevision";
import { mailSendInvitation } from "../../../api/materialMail";

const SALUDO: MailGreetingBlock = { block_id: "saludo", type: "greeting", text: "Estimado(a) {{nombre}},", trato: { modo: "por_sexo", masculino: "Estimado", femenino: "Estimada", respaldo: "Estimado(a)" } };

describe("F2 · el saludo por sexo se ofrece donde se carga la lista", () => {
  it("reconoce la columna de sexo por su rótulo", () => {
    expect(columnaQuePareceSexo(["nombre", "correo", "sexo"])).toBe("sexo");
    expect(columnaQuePareceSexo(["Nombre", "Género"])).toBe("Género");
    expect(columnaQuePareceSexo(["GENDER"])).toBe("GENDER");
    expect(columnaQuePareceSexo(["sex"])).toBe("sex");
    expect(columnaQuePareceSexo(["sexo_de_la_persona"])).toBe("sexo_de_la_persona");
    expect(columnaQuePareceSexo(["nombre", "sexualidad", "género musical favorito"])).toBeNull();
  });

  it("ofrece la columna mientras el saludo no la use; después dice que ya la usa", () => {
    expect(ofertaDelTrato(SALUDO, ["nombre", "sexo"])).toEqual({ tipo: "ofrecer", columna: "sexo" });
    expect(ofertaDelTrato({ trato: undefined }, ["sexo"])).toEqual({ tipo: "ofrecer", columna: "sexo" });
    const conColumna = conTratoPorSexo({ ...SALUDO, trato: undefined }, "sexo");
    expect(conColumna.trato).toMatchObject({ modo: "por_sexo", columna: "sexo" });
    expect(ofertaDelTrato(conColumna, ["nombre", "sexo"])).toEqual({ tipo: "en-uso", columna: "sexo" });
    expect(ofertaDelTrato(conColumna, ["nombre", "genero"])).toEqual({ tipo: "ofrecer", columna: "genero" });
    expect(ofertaDelTrato(SALUDO, ["nombre", "correo"])).toBeNull();
    expect(ofertaDelTrato(null, ["sexo"])).toBeNull();
    expect(ofertaDelTrato(SALUDO, [])).toBeNull();
  });

  it("el aviso de la revisión lleva «Elegir columna» con el foco en el selector; la cabecera, a Identidad (F15)", () => {
    expect(salidaDelChequeo("greeting_trato", "saludo")).toEqual({ texto: "Elegir columna", foco: "trato-columna" });
    expect(salidaDelChequeo("images_alt", "__cabecera").texto).toBe("Ir a Identidad");
    expect(salidaDelChequeo("subject", "__sobre").texto).toBe("Ir al asunto");
    expect(salidaDelChequeo("images_alt", "banner").texto).toBe("Ir al bloque");
  });
});

describe("F4 · «Cómo sale» con el saludo según el sexo es lo que exporta el render", () => {
  const plantilla = { fields: [{ key: "enlace", tag: "ENLACE", label: "Enlace", sm: "SurveyLink" }], images: {} };
  const saludo: MailGreetingBlock = { ...SALUDO, trato: { ...SALUDO.trato!, columna: "sexo" } };

  it("SurveyMonkey: [CustomData1] [FirstName], como `.cmail_trato_html` en export", () => {
    const sale = comoSaleEnLaPlataforma(saludo, plantilla, "surveymonkey");
    expect(sale.lineas[0].plataforma).toBe("[CustomData1] [FirstName],");
    expect(sale.notas.join(" ")).toContain("[CustomData1]");
  });

  it("Mailchimp: el condicional de SALUDO con el respaldo", () => {
    const sale = comoSaleEnLaPlataforma(saludo, plantilla, "mailchimp");
    expect(sale.lineas[0].plataforma).toBe("*|IF:SALUDO|**|SALUDO|**|ELSE:|*Estimado(a)*|END:IF|* *|FNAME|*,");
  });

  it("sin columna dice el respaldo a todos y lo avisa; el dato libre salta los CustomData usados", () => {
    const sinColumna = comoSaleEnLaPlataforma({ ...SALUDO }, plantilla, "surveymonkey");
    expect(sinColumna.lineas[0].plataforma).toBe("Estimado(a) [FirstName],");
    expect(sinColumna.notas.join(" ")).toContain("Sin columna de sexo");
    expect(ranuraDelTrato({}, [{ sm: "CustomData1" }, { sm: "CustomData2" }, { sm: "SurveyLink" }])).toBe("CustomData3");
    expect(ranuraDelTrato({ sm: "CustomData9" }, [])).toBe("CustomData9");
  });
});

describe("F3 · por debajo de 1200 px la columna de bloques va a un cajón", () => {
  it("el umbral es el ancho útil del editor", () => {
    expect(conCajon(994)).toBe(true);
    expect(conCajon(1199)).toBe(true);
    expect(conCajon(1200)).toBe(false);
    expect(conCajon(1398)).toBe(false);
    expect(conCajon(0)).toBe(false);
  });
});

describe("F16 · el recordatorio nace con su asunto y la fila dice cuándo se exportó", () => {
  it("«Recordatorio: <asunto>», sin repetirse, sin marcadores y dentro de 80", () => {
    expect(asuntoDeRecordatorio("Encuesta de reacreditación de Contabilidad")).toBe("Recordatorio: Encuesta de reacreditación de Contabilidad");
    expect(asuntoDeRecordatorio("Recordatorio: Encuesta")).toBe("Recordatorio: Encuesta");
    expect(asuntoDeRecordatorio("[Asunto del correo]")).toBeNull();
    expect(asuntoDeRecordatorio("")).toBeNull();
    const largo = asuntoDeRecordatorio("x".repeat(100));
    expect(largo?.length).toBe(80);
    expect(largo?.endsWith("…")).toBe(true);
    const { envios } = agregarRecordatorio([mailSendInvitation()], "Encuesta");
    expect(envios[1]).toMatchObject({ label: "Recordatorio 1", subject: "Recordatorio: Encuesta", audience: "sin_respuesta" });
    expect(agregarRecordatorio([mailSendInvitation()]).envios[1].subject).toBeUndefined();
  });

  it("«exportado 20/10» desde la fecha del registro", () => {
    expect(marcaDeExportado("2026-10-20T18:30:11Z")).toBe("exportado 20/10");
    expect(marcaDeExportado(undefined)).toBe("");
    expect(marcaDeExportado("ayer")).toBe("");
  });
});
