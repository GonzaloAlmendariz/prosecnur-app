import { describe, expect, test } from "vitest";

import { normalizeMailTemplate, type MailCheck, type MailTemplate } from "../../../api/materialMail";
import {
  BANNER_ID,
  CABECERA,
  agregarBloque,
  bloqueDelPie,
  chequeosOrdenados,
  cifraDeChequeo,
  descripcionDeBloque,
  enlaceParaLaPersona,
  logosDeLaVistaPrevia,
  muestraDetalle,
  notasDeLectura,
  textoDeItem,
  rotuloDeBloque,
  rotuloDeChequeo,
  tituloDeChequeo,
  claveDesdeRotulo,
  conTexto,
  escalaParaCaber,
  etiquetaDesdeClave,
  etiquetasDeMailchimp,
  esZonaDelCorreo,
  revisionBloquea,
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
    code, status, value, detail: "", items, targets: [],
  });

  test("cifras en la voz de la vista", () => {
    expect(cifraDeChequeo(chk("subject", "ok", 58))).toBe("58 car.");
    expect(cifraDeChequeo(chk("preheader", "warning", 0))).toBe("falta");
    expect(cifraDeChequeo(chk("html_weight", "ok", 38 * 1024))).toBe("38 KB de 102 KB");
    // E1g: las imágenes van en el ZIP importable; sólo un `data:` incrustado es error.
    expect(cifraDeChequeo(chk("images_hosted", "ok", 0))).toBe("en el ZIP o con URL");
    expect(cifraDeChequeo(chk("images_hosted", "error", 1))).toBe("incrustadas");
    expect(cifraDeChequeo(chk("import_zip_weight", "warning", 900 * 1024))).toBe("900 KB de 1.024 KB");
    // La razón de contraste sólo va en el `title`, con coma decimal.
    expect(cifraDeChequeo(chk("accent_contrast", "warning", 3.94))).toBe("cuesta leerlo");
    expect(cifraDeChequeo(chk("accent_contrast", "ok", 15.66))).toBe("se lee bien");
    expect(tituloDeChequeo(chk("accent_contrast", "ok", 15.66))).toBe("Contraste 15,7:1");
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

  test("las zonas se leen de las marcas del render, no contando filas", () => {
    const t = plantilla();
    expect(esZonaDelCorreo(CABECERA, t)).toBe(true);
    expect(esZonaDelCorreo("accion", t)).toBe(true);
    expect(esZonaDelCorreo("pie", t)).toBe(true);
    // Una marca de un bloque que la plantilla ya no tiene, o vacía, no es zona.
    expect(esZonaDelCorreo("otro", t)).toBe(false);
    expect(esZonaDelCorreo("", t)).toBe(false);
    expect(esZonaDelCorreo(null, t)).toBe(false);
    expect(bloqueDelPie(t)).toBe("pie");
  });
});

describe("bloque no reconocido", () => {
  const t = normalizeMailTemplate({ ...plantilla(), blocks: [{ block_id: "v", type: "video_embed", src: "x" }] });
  const block = t.blocks[0];

  test("se nombra como tal y dice su tipo", () => {
    expect(rotuloDeBloque(block)).toBe("Bloque no reconocido");
    expect(resumenDeBloque(block)).toBe("video_embed");
    expect(descripcionDeBloque(block)).toMatch(/video_embed.*se conserva/i);
  });

  test("moverlo no lo cambia", () => {
    const con = { ...plantilla(), blocks: [...plantilla().blocks.slice(0, 2), block] };
    const movido = moverBloque(con, "v", -1);
    expect(movido.blocks[1]).toBe(block);
  });
});

describe("enlace de la persona", () => {
  const campos = plantilla().fields;

  test("resuelve los campos con el dato de la persona y abrevia el origen", () => {
    const e = enlaceParaLaPersona(
      "https://es.surveymonkey.com/r/encuesta?d[codigo]={{codigo}}",
      { nombre: "Andrea", fields: { codigo: "20211234" } },
      campos,
    );
    expect(e.personal).toBe(true);
    expect(e.tramos).toEqual([
      { texto: "…/r/encuesta?d[codigo]=", campo: false },
      { texto: "20211234", campo: true },
    ]);
    expect(e.completo).toBe("https://es.surveymonkey.com/r/encuesta?d[codigo]=20211234");
  });

  test("un enlace que es todo un campo también se abrevia; sin dato va el respaldo", () => {
    const e = enlaceParaLaPersona("{{enlace}}", { nombre: "Ana", fields: { enlace: "https://x.org/e/abc" } }, campos);
    expect(e.tramos).toEqual([{ texto: "…/e/abc", campo: true }]);
    const sinDato = enlaceParaLaPersona("https://x.org/{{carrera}}", { nombre: "Ana", fields: {} }, campos);
    expect(sinDato.tramos[1]).toEqual({ texto: "su carrera", campo: true });
  });

  test("un enlace que es sólo un origen no se abrevia a nada", () => {
    const e = enlaceParaLaPersona("{{enlace}}", { nombre: "Ana", fields: { enlace: "https://example.org/" } }, campos);
    expect(e.tramos).toEqual([{ texto: "https://example.org/", campo: true }]);
  });

  test("nunca muestra un correo", () => {
    const e = enlaceParaLaPersona("mailto:{{contacto}}", { nombre: "Ana", fields: { contacto: "ana@ejemplo.org" } }, campos);
    expect(e.completo).not.toContain("@");
  });

  test("sin campos es un enlace común", () => {
    const e = enlaceParaLaPersona("https://pulso.pucp.edu.pe/encuesta", null, campos);
    expect(e.personal).toBe(false);
    expect(e.tramos).toEqual([{ texto: "…/encuesta", campo: false }]);
  });
});

describe("logos de la vista previa", () => {
  // Forma literal de `.cmail_header_html` (collection_mail_render.R), con el
  // salto de línea que `base64_enc` mete y `htmlEscape` escapa.
  const CABECERA_R = '<table><tr><td bgcolor="#0b1f54" align="left" style="padding:28px 40px 24px 40px;">'
    + '<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>'
    + '<td valign="middle"><img src="data:image/png;base64,iVBOR&#10;w0KG" width="138" height="46" alt="Facultad" style="display:block;"></td>'
    + '<td valign="middle" style="padding:0 18px;"><div style="width:1px;">&nbsp;</div></td>'
    + '<td valign="middle"><span style="display:inline-block;border:1px dashed #9aa3b5;">Pulso PUCP</span></td>'
    + '</tr></table></td></tr><tr><td valign="middle"><img src="data:otro"></td></tr></table>';

  test("empareja cada celda con su logo, en orden, y deja fuera los huecos", () => {
    expect(logosDeLaVistaPrevia(CABECERA_R, ["logo-cliente", "pulso"])).toEqual({
      "logo-cliente": "data:image/png;base64,iVBORw0KG",
    });
  });

  test("si las celdas no calzan con los logos, no promete nada", () => {
    expect(logosDeLaVistaPrevia(CABECERA_R, ["solo-uno"])).toEqual({});
    expect(logosDeLaVistaPrevia("<p>banner</p>", ["pulso"])).toEqual({});
    expect(logosDeLaVistaPrevia(null, ["pulso"])).toEqual({});
  });
});

describe("chequeos desconocidos", () => {
  const nuevo: MailCheck = { code: "dmarc_alignment", status: "ok", value: null, detail: "Remitente alineado.", items: [], targets: [] };

  test("se nombran por su code y muestran su detalle aunque estén bien", () => {
    expect(rotuloDeChequeo(nuevo)).toBe("dmarc_alignment");
    expect(muestraDetalle(nuevo)).toBe(true);
    expect(muestraDetalle({ ...nuevo, code: "subject" })).toBe(false);
    expect(muestraDetalle({ ...nuevo, code: "subject", status: "error" })).toBe(true);
    expect(rotuloDeChequeo({ ...nuevo, code: "toString" })).toBe("toString");
  });
});

describe("detalle de los chequeos nuevos", () => {
  test("un repetido con otro dato dice qué filas y qué etiquetas", () => {
    expect(textoDeItem({ row: 5, first_row: 2, tags: ["ENLACE", "CARRERA"] })).toBe("Fila 5 repite la 2: otro Enlace, Carrera");
    expect(cifraDeChequeo({ code: "duplicates_conflicting", status: "error", value: 1, detail: "", items: [], targets: [] })).toBe("1 en conflicto");
  });

  test("un vacío dentro de un enlace no tiene respaldo posible", () => {
    expect(textoDeItem({ tag: "ENLACE", key: "enlace", empty: 1, uses: ["url"], in_url: true, fallback_covers: false }))
      .toBe("Enlace: 1 sin dato · en enlace · sin respaldo posible");
    expect(textoDeItem({ tag: "CARRERA", empty: 2, fallback: "su carrera", uses: ["cuerpo"], fallback_covers: true }))
      .toBe("Carrera: 2 sin dato → «su carrera» · en cuerpo");
    expect(textoDeItem({ tag: "FNAME", empty: 1, fallback: "Estimado(a):", uses: ["asunto"], fallback_covers: false }))
      .toBe("Nombre: 1 sin dato · en asunto · el respaldo no alcanza");
  });

  test("el campo se nombra por su rótulo de la plantilla, con la columna a la derecha", () => {
    const campos = [{ key: "enlace", tag: "ENLACE", label: "Enlace a la encuesta" }, { key: "carrera", tag: "CARRERA", label: "Carrera" }];
    expect(textoDeItem({ key: "nombre", tag: "FNAME", column: "First Name" }, campos)).toBe("Nombre → First Name");
    expect(textoDeItem({ key: "carrera", tag: "CARRERA" }, campos)).toBe("Carrera: sin columna");
    expect(textoDeItem({ key: "enlace", tag: "ENLACE", column: "ENLACE" }, campos)).toBe("Enlace a la encuesta → ENLACE");
    expect(textoDeItem({ tag: "ENLACE", empty: 1, uses: ["url"], in_url: true }, campos)).toBe("Enlace a la encuesta: 1 sin dato · en enlace · sin respaldo posible");
  });
});

describe("notas de lectura de la lista", () => {
  test("codificación, filas vacías y repetidos con otro dato", () => {
    expect(notasDeLectura("windows-1252", {
      total: 3, valid: 3, without_email: 0, invalid_email: 0, duplicated: 1, names_unsplit: 0,
      duplicated_conflicting: 1, persons_with_any_empty: 0, rows_blank_dropped: 2,
    })).toEqual(["Leído como Windows-1252", "2 filas vacías descartadas", "1 repetido trae otro dato: va la primera fila"]);
    expect(notasDeLectura(null, null)).toEqual([]);
  });
});

describe("fields_empty sin destinatarios efectivos", () => {
  const check: MailCheck = { code: "fields_empty", status: "ok", value: 0, detail: "Sin destinatarios efectivos: no hay a quién revisar los campos.", items: [], targets: [] };

  test("no dice «todos» y muestra el motivo", () => {
    expect(cifraDeChequeo(check)).toBe("sin destinatarios");
    expect(muestraDetalle(check)).toBe(true);
    expect(cifraDeChequeo({ ...check, detail: "Todos los destinatarios tienen dato en cada campo." })).toBe("todos");
  });

  test("names_unsplit en formato «nombre» llega como aviso con su cifra", () => {
    const n: MailCheck = { code: "names_unsplit", status: "warning", value: 3, detail: "3 nombres traen una coma…", items: [], targets: [] };
    expect(cifraDeChequeo(n)).toBe("3 sin separar");
    expect(muestraDetalle(n)).toBe(true);
  });
});

describe("salida para Mailchimp por alcance", () => {
  const chk = (code: string, status: MailCheck["status"]): MailCheck => ({ code, status, value: null, detail: "", items: [], targets: [] });
  test("la plantilla sola sólo la frenan los errores del correo, no los de la audiencia", () => {
    const sinLista = { ready: false, checks: [chk("recipients", "error"), chk("subject", "ok")] };
    expect(revisionBloquea(sinLista, "plantilla")).toBe(false);
    expect(revisionBloquea(sinLista, "completo")).toBe(true);
    const pesado = { ready: false, checks: [chk("import_zip_weight", "error")] };
    expect(revisionBloquea(pesado, "plantilla")).toBe(true);
    expect(revisionBloquea(null, "completo")).toBe(false);
  });
});
