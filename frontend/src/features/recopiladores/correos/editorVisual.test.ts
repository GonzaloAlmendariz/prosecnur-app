import { describe, expect, it } from "vitest";

import { mailSendInvitation } from "../../../api/materialMail";
import type { MailCheck, MailTemplate } from "../../../api/materialMail";
import { ajustesDe, anchoDeImagen, conAjuste, valorDeAjuste } from "./ajustesDeBloque";
import { comoSaleEnLaPlataforma, textoEnLaPlataforma } from "./comoSaleEnLaPlataforma";
import { domDePrueba } from "./domDePrueba.test-util";
import {
  APERTURA,
  chequeosPorBloque,
  huecoMasCercano,
  huecosEntreZonas,
  indiceDesdeHueco,
  insertarBloqueEn,
  moverBloqueA,
  propEnElPunto,
  zonasDeLaVista,
} from "./estructuraCorreo";
import { HISTORIAL_VACIO, atajoDeHistorial, deshacer, registrarCambio, rehacer } from "./historialCorreo";
import { CABECERA } from "./modeloCorreo";
import {
  desplazamientoDelCursor,
  htmlDelTexto,
  normalizarTexto,
  puntoDelDesplazamiento,
  textoDelDom,
  textoDelPegado,
  type OpcionesDeTexto,
} from "./serializarTexto";

const PLANTILLA: MailTemplate = {
  schema: "collection_mail_template/v2",
  template_id: "correo",
  revision: 1,
  subject: "Asunto",
  preheader: "",
  theme: { accent: "#0b1f54" },
  header: { kind: "logos", logo_ids: ["pulso"], background: "dark" },
  images: { pulso: { alt: "Pulso PUCP" } },
  fields: [
    { key: "carrera", tag: "CARRERA", label: "Carrera", fallback: "su carrera", sm: "CustomData1" },
    { key: "enlace", tag: "ENLACE", label: "Enlace", sm: "SurveyLink" },
    { key: "codigo", tag: "CODIGO", label: "Código" },
  ],
  blocks: [
    { block_id: "saludo", type: "greeting", text: "Estimado(a) {{nombre}}:", fallback: "Estimado(a):" },
    { block_id: "texto", type: "paragraph", text: "Hola" },
    { block_id: "accion", type: "button", text: "Responder", url: "https://x.org/r?c={{codigo}}" },
    { block_id: "firma", type: "signature", name: "Pulso PUCP" },
    { block_id: "pie", type: "footer_legal", text: "Recibe este correo porque…" },
  ],
};

const MULTI: OpcionesDeTexto = {
  enlaces: true,
  multilinea: true,
  rotuloDeCampo: (k) => (k === "nombre" ? "Nombre" : k === "carrera" ? "Carrera" : k),
};

function idaYVuelta(texto: string, opts: OpcionesDeTexto = MULTI): string {
  return textoDelDom(domDePrueba(htmlDelTexto(texto, opts)) as unknown as Node, opts);
}

describe("serializarTexto: ida y vuelta exacta", () => {
  it.each([
    "Hola",
    "Hola **{{nombre}}**, tu carrera es {{carrera}}.",
    "Responde [aquí](https://x.org/r?c={{codigo}}) antes del **viernes**.",
    "**Importante: [lee esto](https://x.org)** y responde.",
    "Dos renglones\ny el segundo con {{carrera}}",
    "Signos: 3 < 4 & \"comillas\" y 'apóstrofos'.",
    "  espacios   dobles  ",
  ])("%s", (texto) => {
    expect(idaYVuelta(texto)).toBe(texto);
  });

  it("los campos son chips con el rótulo, no el valor ni el {{}}", () => {
    const html = htmlDelTexto("Hola {{carrera}}", MULTI);
    expect(html).toContain('data-campo="carrera"');
    expect(html).toContain('contenteditable="false"');
    expect(html).toContain(">Carrera</span>");
    expect(html).not.toContain("{{carrera}}<");
  });

  it("sin enlaces permitidos, [texto](url) queda como texto", () => {
    const opts = { ...MULTI, enlaces: false };
    expect(htmlDelTexto("[a](https://x.org)", opts)).not.toContain("<a");
    expect(idaYVuelta("[a](https://x.org)", opts)).toBe("[a](https://x.org)");
  });

  it("en una línea, el salto es un espacio", () => {
    const opts = { ...MULTI, multilinea: false };
    expect(htmlDelTexto("a\nb", opts)).toBe("a b");
    expect(textoDelDom(domDePrueba("a<br>b") as unknown as Node, opts)).toBe("a b");
  });

  it("el DOM ajeno se aplana: fuente y divs de Enter no pasan como HTML; la cursiva es *cursiva* (E1n)", () => {
    const dom = domDePrueba('<i>uno</i> <font color="red">dos</font><div>tres</div><span style="x">cuatro</span>');
    expect(textoDelDom(dom as unknown as Node, MULTI)).toBe("*uno* dos\ntrescuatro");
  });

  it("<b> de Chrome cuenta como negrita; dos negritas contiguas son una", () => {
    expect(textoDelDom(domDePrueba("<b>a</b><strong>b</strong>") as unknown as Node, MULTI)).toBe("**ab**");
  });

  it("un ** sin pareja y un {{ suelto no se guardan como texto", () => {
    expect(normalizarTexto("hola ** mundo", { multilinea: true })).toBe("hola  mundo");
    expect(normalizarTexto("hola {{ Mundo y {{carrera}} }}", { multilinea: true })).toBe("hola  Mundo y {{carrera}} ");
  });

  it("un enlace sin URL o una negrita vacía no dejan marcas", () => {
    expect(textoDelDom(domDePrueba('<a data-href="">x</a><strong> </strong>') as unknown as Node, MULTI)).toBe("x ");
  });

  it("pegar HTML deja sólo su texto", () => {
    expect(textoDelPegado({ html: '<p style="color:red"><b>Hola</b> <script>alert(1)</script>mundo</p><p>dos &amp; tres</p>' }, true))
      .toBe("Hola mundo\ndos & tres");
    expect(textoDelPegado({ html: "<p>a</p><p>b</p>" }, false)).toBe("a b");
    expect(textoDelPegado({ html: "<b>ignorado</b>", texto: "plano\r\ncon CRLF" }, true)).toBe("plano\ncon CRLF");
  });

  it("el cursor se recuerda por caracteres visibles (un chip cuenta uno)", () => {
    const dom = domDePrueba(htmlDelTexto("ab {{carrera}} cd", MULTI));
    const ultimo = dom.childNodes[dom.childNodes.length - 1];
    const d = desplazamientoDelCursor(dom as unknown as Node, ultimo as unknown as Node, 2);
    expect(d).toBe(3 + 1 + 2);
    const p = puntoDelDesplazamiento(dom as unknown as Node, 6);
    expect(p.nodo).toBe(ultimo);
    expect(p.offset).toBe(2);
  });
});

describe("historialCorreo", () => {
  const t0 = PLANTILLA;
  const t1 = { ...PLANTILLA, subject: "A" };
  const t2 = { ...PLANTILLA, subject: "AB" };
  const t3 = { ...PLANTILLA, subject: "ABC" };

  it("agrupa el texto del mismo bloque y propiedad en menos de 1 s", () => {
    let h = registrarCambio(HISTORIAL_VACIO, t0, { texto: "texto.text", ahora: 0 });
    h = registrarCambio(h, t1, { texto: "texto.text", ahora: 400 });
    h = registrarCambio(h, t2, { texto: "texto.text", ahora: 900 });
    expect(h.pasado).toEqual([t0]);
    const atras = deshacer(h, t3)!;
    expect(atras.presente).toBe(t0);
    expect(atras.historial.futuro).toEqual([t3]);
  });

  it("una pausa de 1 s o un cambio de propiedad abre una entrada nueva", () => {
    let h = registrarCambio(HISTORIAL_VACIO, t0, { texto: "texto.text", ahora: 0 });
    h = registrarCambio(h, t1, { texto: "texto.text", ahora: 1200 });
    h = registrarCambio(h, t2, { texto: "accion.text", ahora: 1300 });
    expect(h.pasado).toEqual([t0, t1, t2]);
  });

  it("la estructura entra siempre sola y corta el grupo de texto", () => {
    let h = registrarCambio(HISTORIAL_VACIO, t0, { texto: "texto.text", ahora: 0 });
    h = registrarCambio(h, t1, null);
    expect(h.grupo).toBeNull();
    h = registrarCambio(h, t2, { texto: "texto.text", ahora: 100 });
    expect(h.pasado).toEqual([t0, t1, t2]);
  });

  it("deshacer y rehacer van y vuelven; un cambio nuevo borra el futuro", () => {
    let h = registrarCambio(HISTORIAL_VACIO, t0, null);
    const a = deshacer(h, t1)!;
    expect(a.presente).toBe(t0);
    const r = rehacer(a.historial, a.presente)!;
    expect(r.presente).toBe(t1);
    h = registrarCambio(a.historial, a.presente, null);
    expect(h.futuro).toEqual([]);
    expect(deshacer(HISTORIAL_VACIO, t0)).toBeNull();
    expect(rehacer(HISTORIAL_VACIO, t0)).toBeNull();
  });

  it("guarda a lo sumo 100 entradas", () => {
    let h = HISTORIAL_VACIO;
    for (let i = 0; i < 130; i += 1) h = registrarCambio(h, { ...t0, subject: String(i) }, null);
    expect(h.pasado).toHaveLength(100);
    expect(h.pasado[0].subject).toBe("30");
  });

  it("Cmd+Z deshace, Cmd+Shift+Z y Ctrl+Y rehacen", () => {
    const base = { metaKey: false, ctrlKey: false, shiftKey: false, altKey: false };
    expect(atajoDeHistorial({ ...base, key: "z", metaKey: true })).toBe("deshacer");
    expect(atajoDeHistorial({ ...base, key: "Z", metaKey: true, shiftKey: true })).toBe("rehacer");
    expect(atajoDeHistorial({ ...base, key: "y", ctrlKey: true })).toBe("rehacer");
    expect(atajoDeHistorial({ ...base, key: "z" })).toBeNull();
  });
});

describe("moverBloqueA respeta cabecera y pie", () => {
  const ids = (t: MailTemplate) => t.blocks.map((b) => b.block_id);

  it("mueve al índice final pedido", () => {
    expect(ids(moverBloqueA(PLANTILLA, "accion", 0))).toEqual(["accion", "saludo", "texto", "firma", "pie"]);
    expect(ids(moverBloqueA(PLANTILLA, "saludo", 2))).toEqual(["texto", "accion", "saludo", "firma", "pie"]);
  });

  it("nada pasa detrás del pie y el pie no se mueve", () => {
    expect(ids(moverBloqueA(PLANTILLA, "saludo", 99))).toEqual(["texto", "accion", "firma", "saludo", "pie"]);
    expect(moverBloqueA(PLANTILLA, "pie", 0)).toBe(PLANTILLA);
  });

  it("sin cambio devuelve la misma plantilla (no entra al historial)", () => {
    expect(moverBloqueA(PLANTILLA, "texto", 1)).toBe(PLANTILLA);
    expect(moverBloqueA(PLANTILLA, "no-existe", 0)).toBe(PLANTILLA);
  });

  it("un hueco de la lista original se traduce al índice final", () => {
    expect(indiceDesdeHueco(PLANTILLA, "saludo", 3)).toBe(2);
    expect(indiceDesdeHueco(PLANTILLA, "accion", 0)).toBe(0);
  });

  it("insertar en un hueco nunca queda detrás del pie; el pie es único", () => {
    const out = insertarBloqueEn(PLANTILLA, "image", 99)!;
    expect(ids(out.template).at(-1)).toBe("pie");
    expect(ids(out.template).at(-2)).toBe(out.block_id);
    const img = out.template.blocks.find((b) => b.block_id === out.block_id)!;
    expect(img.type === "image" && img.image_ref).toBe("imagen");
    expect(insertarBloqueEn(PLANTILLA, "footer_legal", 0)).toBeNull();
    const dos = insertarBloqueEn(out.template, "image", 1)!;
    const img2 = dos.template.blocks.find((b) => b.block_id === dos.block_id)!;
    expect(img2.type === "image" && img2.image_ref).toBe("imagen-2");
  });
});

describe("zonas por data-pulso-block, no contando filas", () => {
  const html = [
    '<table>',
    '<tr data-pulso-block="__cabecera" data-pulso-type="header"><td data-rect="0,0,600,80"><img src="x"></td></tr>',
    '<tr><td data-rect="0,80,600,8">&nbsp;</td></tr>',
    '<tr data-pulso-block="saludo" data-pulso-type="greeting"><td data-rect="0,88,600,50"><p data-pulso-prop="text" data-rect="46,100,500,24">Estimado(a) Ana:</p></td></tr>',
    '<tr data-pulso-block="otro" data-pulso-type="paragraph"><td data-rect="0,138,600,40">no está en la plantilla</td></tr>',
    '<tr data-pulso-block="texto" data-pulso-type="paragraph"><td data-rect="0,178,600,60"><p data-pulso-prop="text" data-rect="46,178,500,48">Hola</p></td></tr>',
    '<tr data-pulso-block="accion" data-pulso-type="button"><td data-rect="0,238,600,70"><a data-pulso-prop="text" data-rect="200,250,200,40">Responder</a></td></tr>',
    '<tr data-pulso-block="__apertura" data-pulso-type="opening" data-pulso-prop="opening"><td data-rect="0,310,600,30">Le recordamos…</td></tr>',
    '</table>',
    '<td data-pulso-block="pie" data-pulso-type="footer_legal" data-rect="0,400,600,60"><span data-pulso-prop="text" data-rect="20,410,560,18">Recibe…</span></td>',
  ].join("");
  const doc = domDePrueba(html);
  const zonas = zonasDeLaVista(doc as unknown as Document, PLANTILLA, 0.5);

  it("lee cabecera, bloques, apertura y pie; ignora marcas ajenas y filas sin marca", () => {
    expect(zonas.map((z) => z.id)).toEqual([CABECERA, "saludo", "texto", "accion", APERTURA, "pie"]);
    expect(zonas.find((z) => z.id === CABECERA)?.conImagen).toBe(true);
    expect(zonas.find((z) => z.id === APERTURA)?.tipo).toBe("opening");
  });

  it("mide en el espacio de la hoja (× escala) y encuentra el texto bajo el punto", () => {
    const texto = zonas.find((z) => z.id === "texto")!;
    expect(texto.rect).toEqual({ x: 0, y: 89, w: 300, h: 30 });
    expect(propEnElPunto(texto, 30, 100)).toBe("text");
    expect(propEnElPunto(texto, 2, 100)).toBeNull();
    expect(zonas.find((z) => z.id === APERTURA)?.props.map((p) => p.prop)).toEqual(["opening"]);
  });

  it("los huecos van bajo la cabecera y entre bloques, nunca bajo el pie", () => {
    const huecos = huecosEntreZonas(zonas, PLANTILLA);
    expect(huecos.map((h) => h.hueco)).toEqual([0, 1, 2, 3]);
    expect(huecoMasCercano(huecos, 120)?.hueco).toBe(2);
  });
});

describe("revisión junto al bloque", () => {
  const checks: MailCheck[] = [
    { code: "images_alt", status: "error", value: 1, detail: "", items: [], targets: [{ block_id: "banner" }, { block_id: CABECERA }] },
    { code: "fields_empty", status: "warning", value: 3, detail: "", items: [], targets: [{ block_id: "texto", prop: "text" }, { block_id: "texto", prop: "items.1" }] },
    { code: "subject", status: "ok", value: 30, detail: "", items: [], targets: [{ block_id: "texto" }] },
  ];

  it("cuenta errores y avisos por bloque, una vez por chequeo", () => {
    const por = chequeosPorBloque(checks);
    expect(por.banner).toMatchObject({ errores: 1, avisos: 0 });
    expect(por[CABECERA]).toMatchObject({ errores: 1 });
    expect(por.texto).toMatchObject({ errores: 0, avisos: 1 });
    expect(por.texto.chequeos).toHaveLength(1);
  });
});

describe("comoSaleEnLaPlataforma", () => {
  const bloque = (id: string) => PLANTILLA.blocks.find((b) => b.block_id === id)!;

  it("Mailchimp: el saludo con respaldo sale con su condicional", () => {
    const out = comoSaleEnLaPlataforma(bloque("saludo"), PLANTILLA, "mailchimp");
    expect(out.lineas[0].plataforma).toBe("*|IF:FNAME|*Estimado(a) *|FNAME|*:*|ELSE:|*Estimado(a):*|END:IF|*");
  });

  it("Mailchimp: un campo con respaldo usa IF en el texto, nunca dentro de un enlace", () => {
    expect(textoEnLaPlataforma("Tu carrera: {{carrera}}", PLANTILLA, "mailchimp"))
      .toBe("Tu carrera: *|IF:CARRERA|**|CARRERA|**|ELSE:|*su carrera*|END:IF|*");
    const boton = comoSaleEnLaPlataforma(bloque("accion"), PLANTILLA, "mailchimp");
    expect(boton.lineas.find((l) => l.rotulo === "Enlace")?.plataforma).toBe("https://x.org/r?c=*|CODIGO|*");
  });

  it("Mailchimp: negrita y enlaces del texto como HTML; el pie agrega dirección y baja", () => {
    expect(textoEnLaPlataforma("**Ya** [aquí](https://x.org/{{carrera}})", PLANTILLA, "mailchimp", { enlaces: true }))
      .toBe('<strong>Ya</strong> <a href="https://x.org/*|CARRERA|*">aquí</a>');
    const pie = comoSaleEnLaPlataforma(bloque("pie"), PLANTILLA, "mailchimp");
    expect(pie.lineas.at(-1)?.plataforma).toContain("*|UNSUB|*");
    expect(pie.lineas.at(-1)?.plataforma).toContain("*|LIST:ADDRESSLINE|*");
  });

  it("SurveyMonkey: corchetes, sin condicionales; un campo sin sm queda vacío y se avisa", () => {
    const saludo = comoSaleEnLaPlataforma(bloque("saludo"), PLANTILLA, "surveymonkey");
    expect(saludo.lineas[0].plataforma).toBe("Estimado(a) [FirstName]:");
    expect(saludo.notas.join(" ")).toMatch(/no tiene respaldo/);
    expect(textoEnLaPlataforma("{{carrera}} {{enlace}}", PLANTILLA, "surveymonkey")).toBe("[CustomData1] [SurveyLink]");
    const boton = comoSaleEnLaPlataforma(bloque("accion"), PLANTILLA, "surveymonkey");
    expect(boton.lineas.find((l) => l.rotulo === "Enlace")?.plataforma).toBe("https://x.org/r?c=");
    expect(boton.notas.join(" ")).toMatch(/«Código» no tiene equivalente/);
    const pie = comoSaleEnLaPlataforma(bloque("pie"), PLANTILLA, "surveymonkey");
    expect(pie.lineas.at(-1)?.plataforma).toContain("[OptOutLink]");
  });

  it("imagen: archivo del ZIP en Mailchimp; SurveyMonkey pide URL https", () => {
    const img = { block_id: "banner", type: "image" as const, image_ref: "linea-cierre", alt: "Gracias" };
    expect(comoSaleEnLaPlataforma(img, PLANTILLA, "mailchimp").lineas[0].plataforma).toBe('<img src="linea-cierre.png" alt="Gracias">');
    expect(comoSaleEnLaPlataforma(img, PLANTILLA, "surveymonkey").notas.join(" ")).toMatch(/URL https/);
    const conUrl = { ...PLANTILLA, images: { "linea-cierre": { alt: "", url: "https://cdn.x/l.png" } } };
    expect(comoSaleEnLaPlataforma(img, conUrl, "surveymonkey").lineas[0].plataforma).toContain('src="https://cdn.x/l.png"');
  });
});

describe("ajustesDeBloque", () => {
  it("enumeraciones cerradas con su valor por defecto", () => {
    const boton = PLANTILLA.blocks[2];
    expect(ajustesDe(boton).map((a) => a.clave)).toEqual(["fill", "size", "align"]);
    const fill = ajustesDe(boton)[0];
    expect(valorDeAjuste(boton, fill)).toBe("solido");
    expect(valorDeAjuste(conAjuste(boton, "fill", "contorno"), fill)).toBe("contorno");
    expect(conAjuste(boton, "fill", "rojo")).toBe(boton);
  });

  it("un párrafo sin alineación sigue la del estilo; elegir «Del estilo» quita la clave", () => {
    const parrafo = { block_id: "p", type: "paragraph" as const, text: "Hola" };
    const align = ajustesDe(parrafo).find((a) => a.clave === "align")!;
    expect(valorDeAjuste(parrafo, align)).toBe("estilo");
    const izquierda = conAjuste(parrafo, "align", "left");
    expect(izquierda).toMatchObject({ align: "left" });
    const deVuelta = conAjuste(izquierda, "align", "estilo");
    expect("align" in deVuelta).toBe(false);
    expect(valorDeAjuste(deVuelta, align)).toBe("estilo");
  });

  it("la lista numerada es un booleano; el ancho de imagen se acota a 40–600", () => {
    const lista = { block_id: "l", type: "list" as const, items: ["a"] };
    expect(conAjuste(lista, "ordered", "si")).toMatchObject({ ordered: true });
    expect(anchoDeImagen(1000)).toBe(600);
    expect(anchoDeImagen(10)).toBe(40);
    expect(anchoDeImagen("")).toBeUndefined();
  });
});

describe("texto de una zona", () => {
  const lista = { block_id: "l", type: "list" as const, items: ["uno", "dos"] };

  it("lee y escribe un punto por su índice", async () => {
    const { textoDeZona, conTextoDeZona, conPuntoNuevo, sinPunto, sinPuntosVacios } = await import("./estructuraCorreo");
    expect(textoDeZona(lista, "items.1")).toBe("dos");
    expect(conTextoDeZona(lista, "items.0", "UNO")).toMatchObject({ items: ["UNO", "dos"] });
    const nuevo = conPuntoNuevo(lista, "items.0");
    expect(nuevo.prop).toBe("items.1");
    expect(nuevo.block).toMatchObject({ items: ["uno", "", "dos"] });
    expect(sinPunto(nuevo.block, "items.1")).toMatchObject({ prop: "items.0", block: { items: ["uno", "dos"] } });
    expect(sinPunto({ ...lista, items: ["x"] }, "items.0").prop).toBeNull();
    expect(sinPuntosVacios(nuevo.block, "items.1")).toMatchObject({ items: ["uno", "dos"] });
  });

  it("un texto opcional vacío se quita; el enlace del botón no se edita en el sitio", async () => {
    const { conTextoDeZona, editableEnElSitio } = await import("./estructuraCorreo");
    const saludo = PLANTILLA.blocks[0];
    expect(conTextoDeZona(saludo, "fallback", "")).not.toHaveProperty("fallback");
    expect(editableEnElSitio(PLANTILLA.blocks[2], "url")).toBe(false);
    expect(editableEnElSitio(PLANTILLA.blocks[2], "text")).toBe(true);
    expect(editableEnElSitio(undefined, "opening")).toBe(true);
  });
});

describe("imagen de un bloque en la vista previa", () => {
  it("toma el src entre su marca y la siguiente", async () => {
    const { srcDeImagenDelBloque } = await import("./estructuraCorreo");
    const html = '<tr data-pulso-block="a"><td><img src="data:image/png;base64,AA&#10;BB" width="10"></td></tr><tr data-pulso-block="b"><td><span>hueco</span></td></tr><tr data-pulso-block="c"><td><img src="x.png"></td></tr>';
    expect(srcDeImagenDelBloque(html, "a")).toBe("data:image/png;base64,AABB");
    expect(srcDeImagenDelBloque(html, "b")).toBeNull();
    expect(srcDeImagenDelBloque(html, "z")).toBeNull();
  });
});

describe("store: historial por campaña", () => {
  it("agrupa el texto, deshace con la revisión vigente y se reinicia al cambiar de campaña", async () => {
    const { useCorreosStore } = await import("./store");
    const s = useCorreosStore.getState;
    s().reiniciar();
    s().cargaLista({
      presets: [],
      plantilla: { state_revision: 3, builtin: false, platform: "mailchimp", sends: [mailSendInvitation()], template: PLANTILLA, stored_problems: [] },
      destinatarios: { loaded: false, file_name: null, imported_at: null, row_count: 0, encoding: null, columns: [], mapping: null, counts: null, sample: [] },
    });
    // Se escribe de corrido en la misma palabra (N6 agrupa por palabra).
    s().editar((t) => ({ ...t, subject: "AsuntoA" }), "__sobre.subject");
    s().editar((t) => ({ ...t, subject: "AsuntoAB" }), "__sobre.subject");
    s().editar((t) => moverBloqueA(t, "accion", 0));
    expect(s().historial.pasado).toHaveLength(2);
    s().guardado({ noop: false, sends: [mailSendInvitation()], send_warnings: [], state_revision: 4, template: { ...s().borrador!, revision: 7 } });
    s().deshacer();
    expect(s().borrador?.blocks[0].block_id).toBe("saludo");
    expect(s().borrador?.revision).toBe(7);
    s().deshacer();
    expect(s().borrador?.subject).toBe("Asunto");
    s().rehacer();
    expect(s().borrador?.subject).toBe("AsuntoAB");
    // Un cambio que no cambia nada no entra.
    const antes = s().historial.pasado.length;
    s().editar((t) => moverBloqueA(t, "pie", 0));
    expect(s().historial.pasado).toHaveLength(antes);
    s().reiniciarCampana("otra");
    expect(s().historial.pasado).toHaveLength(0);
    expect(s().edicion).toBeNull();
  });
});
