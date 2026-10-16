import { describe, expect, test } from "vitest";

import type { MailCheck, MailTemplate } from "../../../api/materialMail";
import {
  BANNER_ID,
  CABECERA,
  agregarBloque,
  bloqueDelPie,
  chequeosOrdenados,
  cifraDeChequeo,
  claveDesdeRotulo,
  conTexto,
  escalaParaCaber,
  etiquetaDesdeClave,
  etiquetasDeMailchimp,
  filasDeLaTarjeta,
  htmlParaLaVista,
  huellaDeEdicion,
  idLibre,
  insertarToken,
  logosDeLaFranja,
  moverBloque,
  nuevoCampo,
  problemaDeCampo,
  propDelProblema,
  renombrarImagen,
  repartirProblemas,
  resumenDeBloque,
  slugDeImagen,
  textoDe,
  usarBanner,
  usarLogos,
} from "./modeloCorreo";

function plantilla(): MailTemplate {
  return {
    schema: "collection_mail_template/v1",
    template_id: "correo-recuperacion",
    preset_id: "recuperacion_estudiantes_v1",
    title: "Recuperación de estudiantes",
    revision: 3,
    template_sha256: "sha256:x",
    subject: "Estudio: invitación",
    preheader: "Diez minutos",
    theme: { accent: "#0b1f54" },
    header: { kind: "logos", logo_ids: ["logo-cliente", "pulso"], background: "dark" },
    images: { "logo-cliente": { alt: "Facultad" }, pulso: { alt: "Pulso PUCP" } },
    fields: [
      { key: "carrera", tag: "CARRERA", label: "Carrera", fallback: "su carrera" },
      { key: "enlace", tag: "ENLACE", label: "Enlace" },
    ],
    blocks: [
      { block_id: "saludo", type: "greeting", text: "Estimado(a) {{nombre}}:", fallback: "Estimado(a):" },
      { block_id: "contexto", type: "paragraph", text: "Pulso PUCP, por encargo de **la Facultad**, …", align: "justify" },
      { block_id: "accion", type: "button", text: "Acceder a la encuesta", url: "{{enlace}}" },
      { block_id: "importante", type: "callout", title: "Importante:", items: ["Confidencial.", "Sorteo."], variant: "box" },
      { block_id: "firma", type: "signature", closing: "Atentamente,", name: "Pulso PUCP" },
      { block_id: "pie", type: "footer_legal", text: "Recibe este correo porque…" },
    ],
  };
}

describe("resúmenes y etiquetas", () => {
  test("el resumen de un bloque quita la negrita", () => {
    expect(resumenDeBloque(plantilla().blocks[1])).toBe("Pulso PUCP, por encargo de la Facultad, …");
    expect(resumenDeBloque(plantilla().blocks[3])).toBe("Importante:");
  });

  test("{{nombre}} va siempre a FNAME y cada campo a su etiqueta", () => {
    expect(etiquetasDeMailchimp(plantilla()).map((e) => `${e.app}→${e.mc}`)).toEqual([
      "{{nombre}}→*|FNAME|*",
      "{{carrera}}→*|CARRERA|*",
      "{{enlace}}→*|ENLACE|*",
    ]);
  });
});

describe("campos de cada persona", () => {
  test("clave y etiqueta desde un rótulo en castellano", () => {
    expect(claveDesdeRotulo("Código de matrícula")).toBe("codigo_de_matricula");
    expect(claveDesdeRotulo("2do ciclo")).toBe("campo_2do_ciclo");
    expect(etiquetaDesdeClave("codigo_de_matricula")).toBe("CODIGO_DE_");
    // Una etiqueta reservada de Mailchimp nunca sale.
    expect(etiquetaDesdeClave("email")).toBe("C_EMAIL");
    expect(etiquetaDesdeClave("mc_x")).toBe("C_MC_X");
  });

  test("un campo nuevo no choca con los que ya existen", () => {
    const existentes = plantilla().fields;
    expect(nuevoCampo("Carrera", existentes)).toEqual({ key: "carrera_2", tag: "CARRERA_2", label: "Carrera" });
    expect(nuevoCampo("Nombre", existentes).key).toBe("nombre_2");
  });

  test("problemaDeCampo replica las reglas del contrato", () => {
    const otros = plantilla().fields;
    expect(problemaDeCampo({ key: "aula", tag: "AULA", label: "Aula" }, otros)).toBeNull();
    expect(problemaDeCampo({ key: "Aula", tag: "AULA", label: "Aula" }, otros)).toMatch(/minúsculas/);
    expect(problemaDeCampo({ key: "correo", tag: "CORREO", label: "Correo" }, otros)).toMatch(/reservado/);
    expect(problemaDeCampo({ key: "aula", tag: "UNSUB", label: "Aula" }, otros)).toMatch(/reservada/);
    expect(problemaDeCampo({ key: "aula", tag: "CARRERA", label: "Aula" }, otros)).toMatch(/repetida/);
    expect(problemaDeCampo({ key: "aula", tag: "DEMASIADOLARGA", label: "Aula" }, otros)).toMatch(/10/);
  });
});

describe("texto de un bloque", () => {
  test("las listas se editan una línea por punto y pierden las vacías", () => {
    const callout = plantilla().blocks[3];
    expect(textoDe(callout, "items")).toBe("Confidencial.\nSorteo.");
    expect(conTexto(callout, "items", "Uno\n\n  Dos  \n")).toMatchObject({ items: ["Uno", "Dos"] });
  });

  test("una nota vacía se quita en vez de viajar como lista vacía", () => {
    const boton = { ...plantilla().blocks[2], note: ["ID: 1"] } as MailTemplate["blocks"][number];
    expect("note" in conTexto(boton, "note", "")).toBe(false);
    // El enlace del botón es obligatorio: vacío se queda, para que el backend lo marque.
    expect(conTexto(boton, "url", "")).toMatchObject({ url: "" });
  });

  test("un respaldo vacío del saludo se quita", () => {
    expect("fallback" in conTexto(plantilla().blocks[0], "fallback", "")).toBe(false);
  });

  test("insertar un campo en el cursor, con un espacio si hace falta", () => {
    expect(insertarToken("Hola", 4, "carrera")).toEqual({ valor: "Hola {{carrera}}", cursor: 16 });
    expect(insertarToken("de  y", 3, "aula")).toEqual({ valor: "de {{aula}} y", cursor: 11 });
    expect(insertarToken("x", null, "aula").valor).toBe("x {{aula}}");
  });
});

describe("edición de la plantilla", () => {
  test("agregar después del elegido; sin elegido, antes de la firma", () => {
    const a = agregarBloque(plantilla(), "paragraph", "saludo");
    expect(a.template.blocks.map((b) => b.block_id)).toEqual(["saludo", "paragraph-1", "contexto", "accion", "importante", "firma", "pie"]);
    const b = agregarBloque(plantilla(), "list", null);
    expect(b.template.blocks.map((x) => x.block_id).slice(-3)).toEqual(["list-1", "firma", "pie"]);
  });

  test("nada se agrega después del pie", () => {
    const a = agregarBloque(plantilla(), "paragraph", "pie");
    expect(a.template.blocks.at(-1)?.block_id).toBe("pie");
  });

  test("mover respeta los bordes", () => {
    const t = plantilla();
    expect(moverBloque(t, "saludo", -1)).toBe(t);
    expect(moverBloque(t, "saludo", 1).blocks.slice(0, 2).map((b) => b.block_id)).toEqual(["contexto", "saludo"]);
  });

  test("la huella de edición ignora revisión y huella del backend", () => {
    const t = plantilla();
    expect(huellaDeEdicion({ ...t, revision: 9, template_sha256: "otra" })).toBe(huellaDeEdicion(t));
    expect(huellaDeEdicion({ ...t, subject: "otro" })).not.toBe(huellaDeEdicion(t));
  });
});

describe("imágenes", () => {
  test("el slug es el mismo que usa el backend para los logos", () => {
    expect(slugDeImagen("Logo Facultad_CCSS.PNG")).toBe("logo-facultad-ccss");
    expect(slugDeImagen("Pulso PUCP (blanco).png")).toBe("pulso-pucp-blanco");
  });

  test("un id ocupado recibe un sufijo libre", () => {
    expect(idLibre("pulso", ["logo-cliente"])).toBe("pulso");
    expect(idLibre("pulso", ["pulso", "pulso-2"])).toBe("pulso-3");
  });

  test("renombrar mueve alt y url y la referencia de la cabecera", () => {
    const t = renombrarImagen(plantilla(), "pulso", "pulso-2");
    expect(t.header).toMatchObject({ logo_ids: ["logo-cliente", "pulso-2"] });
    expect(t.images["pulso-2"]).toEqual({ alt: "Pulso PUCP" });
    expect(t.images.pulso).toBeUndefined();
  });

  test("ir al banner y volver conserva la franja", () => {
    const conBanner = usarBanner(plantilla());
    expect(conBanner.header).toEqual({ kind: "banner", image_ref: BANNER_ID });
    expect(logosDeLaFranja(conBanner)).toEqual(["logo-cliente", "pulso"]);
    expect(usarLogos(conBanner, "light").header).toEqual({ kind: "logos", logo_ids: ["logo-cliente", "pulso"], background: "light" });
  });
});

describe("problemas del 422", () => {
  test("se reparten por bloque con el índice de R (desde 1)", () => {
    const r = repartirProblemas([
      { path: "template.blocks[3].url", code: "bad_url", detail: "El enlace…" },
      { path: "template.blocks[1].fallback", code: "missing_fallback", detail: "Respaldo" },
      { path: "template.subject", code: "missing_text", detail: "Falta" },
      { path: "template.images.pulso.url", code: "bad_image_url", detail: "https" },
      { path: "template.fields[1].tag", code: "bad_tag", detail: "tag" },
      { path: "template.blocks[99].text", code: "x", detail: "fuera" },
    ], plantilla());
    expect(Object.keys(r.porBloque)).toEqual(["accion", "saludo"]);
    expect(r.sobre).toHaveLength(1);
    expect(r.cabecera).toHaveLength(1);
    expect(r.campos).toHaveLength(1);
    expect(r.otros).toHaveLength(1);
    expect(propDelProblema("template.blocks[3].items[2]")).toBe("items");
  });
});

describe("revisión", () => {
  const chk = (code: string, status: MailCheck["status"], value: MailCheck["value"], items: MailCheck["items"] = []): MailCheck => ({
    code, status, value, detail: "", items,
  });

  test("cifras en la voz de la vista", () => {
    expect(cifraDeChequeo(chk("subject", "ok", 58))).toBe("58 car.");
    expect(cifraDeChequeo(chk("preheader", "warning", 0))).toBe("falta");
    expect(cifraDeChequeo(chk("html_weight", "ok", 38 * 1024))).toBe("38 KB de 102 KB");
    expect(cifraDeChequeo(chk("images_hosted", "warning", 2))).toBe("2 por subir");
    expect(cifraDeChequeo(chk("tags_have_columns", "ok", 0, [{ tag: "A" }, { tag: "B" }, { tag: "C" }]))).toBe("3 de 3");
    expect(cifraDeChequeo(chk("tags_have_columns", "error", 1, [{ tag: "A" }, { tag: "B" }]))).toBe("1 de 2");
    expect(cifraDeChequeo(chk("recipients", "error", 0))).toBe("sin importar");
    expect(cifraDeChequeo(chk("banner_size", "error", "1000×500"))).toBe("1000 × 500");
  });

  test("primero lo que bloquea, después los avisos", () => {
    const orden = chequeosOrdenados([chk("a", "ok", 0), chk("b", "warning", 0), chk("c", "error", 0)]).map((c) => c.code);
    expect(orden).toEqual(["c", "b", "a"]);
  });
});

describe("vista previa", () => {
  test("el modo oscuro oscurece los fondos claros y respeta los de marca", () => {
    const html = "<html><head><title>x</title></head><body></body></html>";
    const oscuro = htmlParaLaVista(html, "oscuro", { papel: "P", tinta: "T", suave: "S" });
    expect(oscuro).toContain('[style*="background-color:#ffffff"]{background-color:P!important}');
    expect(oscuro).toContain("color:T!important");
    // El acento de la cabecera y del botón no se toca.
    expect(oscuro).not.toContain("#0b1f54");
    expect(oscuro.indexOf("<style data-pulso-vista>")).toBeLessThan(oscuro.indexOf("</head>"));
    expect(htmlParaLaVista(html, "escritorio")).not.toContain("!important");
  });

  test("el correo se muestra a escala cuando el lienzo no alcanza, nunca agrandado", () => {
    expect(escalaParaCaber(null, 648)).toBe(1);
    expect(escalaParaCaber(900, 648)).toBe(1);
    expect(escalaParaCaber(324, 648)).toBe(0.5);
    expect(escalaParaCaber(100, 648)).toBe(0.4);
  });

  test("las filas de la tarjeta siguen la forma del render: el pie va aparte", () => {
    const t = plantilla();
    expect(filasDeLaTarjeta(t)).toEqual([CABECERA, "", "saludo", "contexto", "accion", "importante", "firma", ""]);
    expect(bloqueDelPie(t)).toBe("pie");
  });
});
