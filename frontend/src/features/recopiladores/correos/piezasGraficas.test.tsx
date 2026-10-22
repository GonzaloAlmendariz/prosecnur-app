import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { MAIL_CHECK_CODES, normalizeMailBlock, type MailBlock, type MailCheck, type MailTemplate } from "../../../api/materialMail";
import { ajustesDe, conAjuste, valorDeAjuste } from "./ajustesDeBloque";
import { BibliotecaDeBloques, CUANDO_USARLO, GRUPOS } from "./BibliotecaDeBloques";
import { comoArreglar } from "./comoArreglar";
import { domDePrueba } from "./domDePrueba.test-util";
import { insertarBloqueEn } from "./estructuraCorreo";
import { cifraDeChequeo, repartirProblemas, rotuloDeBloque, rotuloDeChequeo } from "./modeloCorreo";
import { PanelDeBloque } from "./PanelDeBloque";
import {
  IMAGEN_DECORATIVA,
  PIEZAS_GRAFICAS,
  colorDePieza,
  conArchivoDeImagen,
  conColor,
  descripcionesPendientes,
  esInsertable,
  idDelIcono,
  ladosDelPar,
  lecturaDePieza,
  srcsDelPar,
} from "./piezasGraficas";

const BASE: MailTemplate = {
  schema: "collection_mail_template/v2",
  template_id: "correo",
  revision: 1,
  subject: "Invitación",
  preheader: "",
  theme: { accent: "#0b1f54" },
  header: { kind: "logos", logo_ids: ["pulso"], background: "dark" },
  images: { pulso: { alt: "Pulso PUCP" }, "imagen-izquierda": { alt: "Ya usada" } },
  fields: [],
  blocks: [
    { block_id: "texto", type: "paragraph", text: "Hola" },
    { block_id: "pie", type: "footer_legal" },
  ],
};

const noop = () => {};

function panel(template: MailTemplate, seleccion: string, extra: Partial<Parameters<typeof PanelDeBloque>[0]> = {}): string {
  return renderToStaticMarkup(
    <PanelDeBloque
      template={template}
      seleccion={seleccion}
      problemas={repartirProblemas([], template)}
      persona={null}
      onEditar={noop}
      onEditarBloque={noop}
      onDestino={noop}
      onMover={noop}
      onQuitar={noop}
      onAbrirIdentidad={noop}
      {...extra}
    />,
  );
}

describe("biblioteca › piezas gráficas", () => {
  it("lista las cinco piezas en su grupo, cada una con su miniatura y su «cuándo usarla»", () => {
    const grupo = GRUPOS.find((g) => g.titulo === "Piezas gráficas");
    expect(grupo?.tipos).toEqual(["band", "ornament", "icon_text", "two_images", IMAGEN_DECORATIVA]);
    const html = renderToStaticMarkup(<BibliotecaDeBloques template={BASE} onElegir={noop} onCerrar={noop} />);
    expect(html).toContain("Piezas gráficas");
    for (const [tipo, nombre] of [
      ["band", "Banda de color"],
      ["ornament", "Separador decorativo"],
      ["icon_text", "Ícono con texto"],
      ["two_images", "Dos imágenes"],
      [IMAGEN_DECORATIVA, "Imagen decorativa"],
    ] as const) {
      const tarjeta = html.match(new RegExp(`<button[^>]*data-tipo="${tipo}"[^>]*>(.*?)</button>`))?.[0] ?? "";
      expect(tarjeta, tipo).toContain(nombre);
      // Se arrastra como las demás y su «cuándo usarla» se lee a la vista.
      expect(tarjeta).toContain('draggable="true"');
      expect(tarjeta).toContain(CUANDO_USARLO[tipo].replace(/«|»/g, (c) => c));
      // Miniatura dibujada (SVG con tokens), nunca una imagen externa.
      expect(tarjeta).toContain('<svg class="rec-bib-esquema"');
      expect(tarjeta).not.toContain("<img");
    }
    expect(html.match(/data-tipo=/g)).toHaveLength(15);
  });

  it("lo que trae un arrastre se valida contra lo insertable", () => {
    expect(PIEZAS_GRAFICAS.every(esInsertable)).toBe(true);
    expect(esInsertable("html_crudo")).toBe(false);
  });
});

describe("insertar cada pieza produce el JSON del contrato", () => {
  const insertar = (tipo: Parameters<typeof insertarBloqueEn>[1]) => {
    const out = insertarBloqueEn(BASE, tipo, 1);
    if (!out) throw new Error("no se insertó");
    const block = out.template.blocks[1];
    // Lo que se inserta vuelve igual del normalizador: es JSON del contrato, sin claves inventadas.
    expect(normalizeMailBlock(JSON.parse(JSON.stringify(block)))).toEqual(block);
    return block as unknown as Record<string, unknown>;
  };

  it("banda: alto medio y sin color (sigue el de la casa)", () => {
    expect(insertar("band")).toEqual({ block_id: "band-1", type: "band", height: "m" });
  });

  it("separador: onda", () => {
    expect(insertar("ornament")).toEqual({ block_id: "ornament-1", type: "ornament", style: "onda" });
  });

  it("ícono con texto: un ícono de la casa y su texto", () => {
    const b = insertar("icon_text");
    expect(Object.keys(b).sort()).toEqual(["block_id", "icon", "text", "type"]);
    expect(b.icon).toBe("calendario");
  });

  it("dos imágenes: dos archivos que no chocan con los del correo y sus dos descripciones", () => {
    const b = insertar("two_images");
    expect(Object.keys(b).sort()).toEqual(["alt_left", "alt_right", "block_id", "left", "right", "type"]);
    expect(b.left).toBe("imagen-izquierda-2");
    expect(b.right).toBe("imagen-derecha");
    expect(String(b.alt_left).trim()).not.toBe("");
  });

  it("imagen decorativa: image con decorative y alt vacío", () => {
    expect(insertar(IMAGEN_DECORATIVA)).toEqual({ block_id: "image-decorativa-1", type: "image", image_ref: "decorativa", alt: "", decorative: true });
  });
});

describe("ajustes de las piezas", () => {
  const banda: MailBlock = { block_id: "b", type: "band" };
  const orn: MailBlock = { block_id: "o", type: "ornament" };
  const icono: MailBlock = { block_id: "i", type: "icon_text", icon: "calendario", text: "Hola" };

  it("alto, forma e ícono son enumeraciones cerradas", () => {
    expect(conAjuste(banda, "height", "l")).toEqual({ ...banda, height: "l" });
    expect(conAjuste(banda, "height", "xl")).toBe(banda);
    expect(conAjuste(orn, "style", "puntos")).toEqual({ ...orn, style: "puntos" });
    expect(conAjuste(orn, "style", "linea_doble")).toEqual({ ...orn, style: "linea_doble" });
    expect(conAjuste(icono, "icon", "regalo")).toEqual({ ...icono, icon: "regalo" });
    expect(conAjuste(icono, "icon", "cohete")).toBe(icono);
    expect(ajustesDe(icono).find((a) => a.clave === "icon")?.opciones).toHaveLength(12);
    expect(valorDeAjuste(banda, ajustesDe(banda)[0])).toBe("m");
  });

  it("el color se escribe #rrggbb; vacío vuelve al de la casa; en un ícono no aplica", () => {
    expect(conColor(banda, "#F28C28")).toEqual({ ...banda, color: "#f28c28" });
    expect(conColor({ ...orn, color: "#f28c28" }, null)).toEqual(orn);
    expect(conColor(banda, "naranja")).toBe(banda);
    expect(conColor(icono, "#f28c28")).toBe(icono);
    // El de la casa: el acento en Sobrio, el relleno del botón en Campaña.
    expect(colorDePieza(banda, { accent: "#0B1F54" })).toBe("#0b1f54");
    expect(colorDePieza(banda, { accent: "#0b1f54", estilo: "campana" })).toBe("#f9d53e");
    expect(colorDePieza({ ...banda, color: "#F28C28" }, { accent: "#0b1f54" })).toBe("#f28c28");
  });

  it("el contraste en vivo usa los mínimos del render (1,5:1)", () => {
    expect(lecturaDePieza("#f28c28", "#ffffff").tono).toBe("ok");
    expect(lecturaDePieza("#f4f4f4", "#ffffff").tono).toBe("warning");
  });

  it("el ícono en SurveyMonkey se nombra como el PNG que genera el render", () => {
    expect(idDelIcono("calendario", { accent: "#0B1F54" })).toBe("icono-calendario-0b1f54");
  });
});

describe("inspector de cada pieza", () => {
  const conBloque = (block: MailBlock): MailTemplate => ({ ...BASE, blocks: [block, ...BASE.blocks] });

  it("banda: color con su lectura de contraste y el alto", () => {
    const html = panel(conBloque({ block_id: "b", type: "band", color: "#f28c28" }), "b");
    expect(html).toContain('type="color"');
    expect(html).toContain('value="#f28c28"');
    expect(html).toContain("Se distingue del fondo");
    expect(html).toContain("Gruesa");
  });

  it("separador: forma y color; la revisión manda sobre el cálculo local", () => {
    const check: MailCheck = { code: "piezas_contrast", status: "warning", value: 1, detail: "", items: [], targets: [{ block_id: "o", prop: "color" }] };
    const html = panel(conBloque({ block_id: "o", type: "ornament", style: "puntos" }), "o", { chequeos: [check] });
    expect(html).toContain("Línea doble");
    expect(html).toContain("Casi no se distingue del fondo");
    expect(html).toContain('aria-invalid="true"');
  });

  it("ícono con texto: doce radios con nombre accesible y uno solo tabulable", () => {
    const html = panel(conBloque({ block_id: "i", type: "icon_text", icon: "reloj", text: "Hasta el **30**" }), "i");
    expect(html.match(/role="radio"/g)).toHaveLength(12);
    expect(html).toContain('aria-label="Reloj"');
    expect(html).toMatch(/aria-checked="true"[^>]*aria-label="Reloj"/);
    expect(html.match(/tabindex="0"/gi)).toHaveLength(1);
    // El texto se edita con su campo; el ícono no sale como segmentado.
    expect(html).toContain("Texto");
    expect(html).not.toContain('aria-label="Ícono del bloque"');
  });

  it("dos imágenes: cada lado con «Subir imagen» y su descripción obligatoria", () => {
    const html = panel(conBloque({ block_id: "p", type: "two_images", left: "a", right: "b", alt_left: "Campus", alt_right: "" }), "p");
    expect(html.match(/Subir imagen/g)).toHaveLength(2);
    expect(html.match(/aria-invalid="true"/g)).toHaveLength(1);
    expect(html).toContain("Falta describirla");
  });

  it("dos imágenes: las miniaturas no fijan el alto del <img>", () => {
    const html = panel(conBloque({ block_id: "p", type: "two_images", left: "a", right: "b", alt_left: "A", alt_right: "B" }), "p", {
      vistasDelPar: { left: "blob:a", right: "blob:b" },
    });
    expect(html.match(/<img [^>]*>/g)).toHaveLength(2);
    expect(html).not.toMatch(/<img [^>]*(height=|style=)/);
  });
});

describe("imagen decorativa: no necesita descripción", () => {
  const conImagen = (decorative: boolean): MailTemplate => ({
    ...BASE,
    blocks: [{ block_id: "img", type: "image", image_ref: "franja", alt: "", ...(decorative ? { decorative: true } : {}) }, ...BASE.blocks],
  });

  it("la revisión del cliente la saca de lo que falta describir", () => {
    expect(descripcionesPendientes(conImagen(false))).toEqual([{ block_id: "img", prop: "alt" }]);
    expect(descripcionesPendientes(conImagen(true))).toEqual([]);
    expect(descripcionesPendientes({ blocks: [{ block_id: "p", type: "two_images", left: "a", right: "b", alt_left: "", alt_right: "[Describe la imagen]" }] }))
      .toEqual([{ block_id: "p", prop: "alt_left" }, { block_id: "p", prop: "alt_right" }]);
  });

  it("el inspector ofrece el interruptor y, encendido, no pide el texto alternativo", () => {
    const comun = panel(conImagen(false), "img");
    expect(comun).toContain("Solo decorativa (no necesita descripción)");
    expect(comun).toContain("Texto alternativo");
    expect(comun).toContain('aria-invalid="true"');
    const deco = panel(conImagen(true), "img");
    expect(deco).toMatch(/role="switch"[^>]*aria-checked="true"|aria-checked="true"[^>]*role="switch"/);
    expect(deco).not.toContain("Texto alternativo");
    expect(deco).not.toContain('aria-invalid="true"');
    expect(rotuloDeBloque(conImagen(true).blocks[0])).toBe("Imagen decorativa");
  });
});

describe("los chequeos nuevos tienen rótulo, cifra y arreglo", () => {
  for (const code of ["piezas_contrast", "icon_text_sm_icon"] as const) {
    it(code, () => {
      expect(MAIL_CHECK_CODES).toContain(code);
      const check: MailCheck = { code, status: "warning", value: 2, detail: "", items: [], targets: [] };
      expect(rotuloDeChequeo(check)).not.toBe(code);
      expect(rotuloDeChequeo(check)).not.toMatch(/[_]|contrast|icon/);
      expect(cifraDeChequeo(check)).toMatch(/^2 /);
      expect(comoArreglar(code)).toBeTruthy();
    });
  }
});

describe("subir el archivo de un lado del par", () => {
  const par: MailTemplate = {
    ...BASE,
    images: { ...BASE.images, "imagen-derecha": { alt: "", url: "https://x.org/d.png" } },
    blocks: [{ block_id: "p", type: "two_images", left: "imagen-izquierda", right: "imagen-derecha", alt_left: "A", alt_right: "B" }, ...BASE.blocks],
  };

  it("el lado pasa a nombrar el archivo y su entrada del mapa se renombra", () => {
    const out = conArchivoDeImagen(par, "p", "Torre Central.PNG", "right");
    expect(out?.id).toBe("torre-central");
    expect(out?.template.blocks[0]).toMatchObject({ left: "imagen-izquierda", right: "torre-central" });
    expect(out?.template.images["torre-central"]).toEqual({ alt: "", url: "https://x.org/d.png" });
    expect(out?.template.images).not.toHaveProperty("imagen-derecha");
  });

  it("no choca con el otro lado ni con otra imagen", () => {
    const out = conArchivoDeImagen(par, "p", "imagen-izquierda.png", "right");
    expect(out?.id).toBe("imagen-izquierda-2");
    expect(conArchivoDeImagen(par, "texto", "x.png")).toBeNull();
  });
});

describe("el par en la vista previa", () => {
  const HTML = [
    '<table><tr data-pulso-block="p" data-pulso-type="two_images"><td><table><tr>',
    '<td class="cmail-stack" data-rect="0,0,250,200"><img src="data:image/png;base64,AA&#10;BB" data-pulso-prop="alt_left" data-rect="10,10,200,150"></td>',
    '<td class="cmail-stack" data-rect="250,0,250,200"><span data-rect="260,10,200,133">Torre</span></td>',
    "</tr></table></td></tr></table>",
  ].join("");

  it("lee el src de cada lado por su data-pulso-prop", () => {
    expect(srcsDelPar(HTML, "p")).toEqual({ left: "data:image/png;base64,AABB", right: null });
    expect(srcsDelPar(HTML, "otro")).toEqual({ left: null, right: null });
  });

  it("mide cada lado y sabe cuál no tiene archivo", () => {
    const lados = ladosDelPar(domDePrueba(HTML) as unknown as Document, "p", 0.5);
    expect(lados).toEqual([
      { lado: "left", rect: { x: 5, y: 5, w: 100, h: 75 }, conImagen: true },
      { lado: "right", rect: { x: 130, y: 5, w: 100, h: 66.5 }, conImagen: false },
    ]);
  });
});
