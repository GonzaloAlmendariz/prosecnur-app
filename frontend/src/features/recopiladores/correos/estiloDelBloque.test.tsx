// Estilo propio del bloque (GOAL editor profesional, L3 y L4): la paleta del
// correo, la caja del bloque y el panel «Estilo» del inspector.

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { MAIL_BOX_BG_NAMES, type MailBlock, type MailTemplate } from "../../../api/materialMail";
import { EstiloDelBloque } from "./EstiloDelBloque";
import {
  CAJA_INICIAL,
  ajustesAlineadosConElContrato,
  cajaDe,
  conCaja,
  fondoDeCaja,
  lecturaDeCaja,
  paletaDelCorreo,
  tintaDeCaja,
  tinteDe,
} from "./modeloCaja";
import { contraste } from "./modeloEstilo";
import { repartirProblemas } from "./modeloCorreo";
import { PanelDeBloque } from "./PanelDeBloque";

const tema = { accent: "#0b1f54" };
const parrafo: MailBlock = { block_id: "p", type: "paragraph", text: "Hola" };
const pie: MailBlock = { block_id: "pie", type: "footer_legal" };
const noop = () => {};

function plantilla(blocks: MailBlock[]): MailTemplate {
  return {
    schema: "collection_mail_template/v2",
    template_id: "correo",
    revision: 1,
    subject: "Invitación",
    preheader: "",
    theme: tema,
    header: { kind: "logos", logo_ids: ["pulso"], background: "dark" },
    images: { pulso: { alt: "Pulso PUCP" } },
    fields: [],
    blocks: [...blocks, pie],
  };
}

describe("paleta del correo (L3)", () => {
  it("trae los cuatro nombres con el hex que dibuja el render", () => {
    const p = paletaDelCorreo(tema);
    expect(p.map((c) => c.valor)).toEqual([...MAIL_BOX_BG_NAMES]);
    expect(p.find((c) => c.valor === "tinte")?.hex).toBe(tinteDe("#0b1f54"));
    expect(p.find((c) => c.valor === "acento")?.hex).toBe("#0b1f54");
    expect(p.find((c) => c.valor === "papel")?.hex).toBe("#ffffff");
  });

  it("el tinte es el de .cmail_tint (92 % de blanco)", () => {
    // #0b1f54 → round(11*.08+255*.92)=235, round(31*.08+255*.92)=237, round(84*.08+255*.92)=241
    expect(tinteDe("#0b1f54")).toBe("#ebedf1");
  });

  it("suma hasta tres colores de la marca sin repetir los del tema", () => {
    const p = paletaDelCorreo(tema, ["#0B1F54", "#c9a24a", "#7a1f35", "#2f5d34", "#0f5c6e", "no-es-color"]);
    const marca = p.filter((c) => c.origen === "marca").map((c) => c.valor);
    expect(marca).toEqual(["#c9a24a", "#7a1f35", "#2f5d34"]);
  });

  it("en Campaña el papel es el fondo de la página", () => {
    const p = paletaDelCorreo({ accent: "#0b1f54", estilo: "campana", page_bg: "#5b3f8c" });
    expect(p.find((c) => c.valor === "papel")?.hex).toBe("#5b3f8c");
  });
});

describe("caja del bloque", () => {
  it("darle estilo crea la caja; quitarlo la borra; el pie legal no la admite", () => {
    const con = conCaja(parrafo, CAJA_INICIAL);
    expect(cajaDe(con)).toEqual({ bg: "tinte" });
    expect(cajaDe(conCaja(con, { border: "fino" }))).toEqual({ bg: "tinte", border: "fino" });
    expect(conCaja(con, null)).not.toHaveProperty("box");
    expect(conCaja(parrafo, null)).toBe(parrafo);
    expect(conCaja(pie, { bg: "tinte" })).toBe(pie);
  });

  it("la tinta automática se lee sobre cualquier fondo de la paleta y de la marca", () => {
    for (const bg of ["papel", "tinte", "acento", "tinta", "#e3a72f", "#c9a24a", "#f3e9d2"]) {
      const box = { bg };
      expect(contraste(tintaDeCaja(box, tema), fondoDeCaja(box, tema))).toBeGreaterThanOrEqual(4.5);
      expect(lecturaDeCaja(box, tema).seLee).toBe(true);
    }
  });

  it("un texto fijo que no se lee se avisa", () => {
    expect(lecturaDeCaja({ bg: "acento", text: "acento" }, tema).seLee).toBe(false);
  });

  it("las opciones del inspector son las del contrato, en su orden", () => {
    expect(ajustesAlineadosConElContrato()).toBe(true);
  });
});

describe("panel «Estilo» (L4)", () => {
  it("sin caja ofrece darle estilo propio y nada más", () => {
    const html = renderToStaticMarkup(<EstiloDelBloque block={parrafo} theme={tema} onEditar={noop} />);
    expect(html).toContain("Usa el estilo del correo.");
    expect(html).toContain("Darle estilo propio");
    expect(html).not.toContain("Esquinas");
  });

  it("con caja muestra fondo, borde, esquinas, espaciado, color del texto y la lectura", () => {
    const block = conCaja(parrafo, { bg: "acento", corners: "redondas" });
    const html = renderToStaticMarkup(<EstiloDelBloque block={block} theme={tema} deLaMarca={["#c9a24a"]} onEditar={noop} />);
    for (const r of ["Fondo", "Borde", "Esquinas", "Espaciado", "Color del texto", "Quitar el estilo propio", "Marca", "Otro"]) {
      expect(html).toContain(r);
    }
    expect(html).toMatch(/aria-checked="true"[^>]*title="Acento · #0b1f54"/);
    expect(html).toMatch(/aria-checked="true"[^>]*title="Redondas: 16 px"/);
    expect(html).toContain("Se lee bien");
  });

  it("el inspector ofrece Contenido | Estilo en un párrafo y no en el pie legal", () => {
    const t = plantilla([parrafo]);
    const props = {
      template: t, problemas: repartirProblemas([], t), persona: null,
      onEditar: noop, onEditarBloque: noop, onDestino: noop, onMover: noop, onQuitar: noop, onAbrirIdentidad: noop,
    };
    expect(renderToStaticMarkup(<PanelDeBloque {...props} seleccion="p" />)).toContain('aria-label="Qué editar del bloque"');
    expect(renderToStaticMarkup(<PanelDeBloque {...props} seleccion="pie" />)).not.toContain('aria-label="Qué editar del bloque"');
  });
});

describe("colores de la marca en el editor", () => {
  it("el hook se llama antes de los returns de carga y error (si no, React #310 al terminar de cargar)", async () => {
    const { readFileSync } = await import("node:fs");
    const fuente = readFileSync(new URL("./CorreosEditor.tsx", import.meta.url), "utf8");
    const hook = fuente.indexOf("useColoresDeLaMarca(template");
    const primerReturn = fuente.indexOf('if (st.campanasCarga === "error")');
    expect(hook).toBeGreaterThan(0);
    expect(primerReturn).toBeGreaterThan(0);
    expect(hook).toBeLessThan(primerReturn);
  });

  it("la vista Contenido | Estilo se declara antes del primer return de PanelDeBloque", async () => {
    const { readFileSync } = await import("node:fs");
    const fuente = readFileSync(new URL("./PanelDeBloque.tsx", import.meta.url), "utf8");
    const hook = fuente.indexOf("useState<VistaDelBloque>");
    const primerReturn = fuente.indexOf("if (seleccion === SOBRE)");
    expect(hook).toBeGreaterThan(0);
    expect(hook).toBeLessThan(primerReturn);
  });
});

describe("sección Destacado en el editor (L5)", () => {
  it("se inserta sin foto, sobre el tinte, con sus textos editables y la forma «Imagen»", async () => {
    const { bloqueNuevo, propsDeTexto } = await import("./modeloCorreo");
    const { ajustesDe } = await import("./ajustesDeBloque");
    const b = bloqueNuevo("feature", "feature-1");
    expect(b).toMatchObject({ type: "feature", layout: "izquierda", box: { bg: "tinte" } });
    expect(b).not.toHaveProperty("image_ref");
    expect(propsDeTexto("feature")).toEqual(["eyebrow", "title", "text", "button_text", "url"]);
    expect(ajustesDe(b).map((a) => a.opciones.map((o) => o.valor))).toEqual([["izquierda", "derecha", "arriba"]]);
  });

  it("subir una foto le pone su id y el panel pide describirla", async () => {
    const { conArchivoDeImagen } = await import("./piezasGraficas");
    const t = plantilla([{ block_id: "d", type: "feature", title: "Sorteo" }]);
    const out = conArchivoDeImagen(t, "d", "Audífonos Sorteo.JPG");
    expect(out?.template.blocks[0]).toMatchObject({ image_ref: expect.stringMatching(/^audifonos-sorteo/) });
    const { ImagenDelDestacado } = await import("./ImagenDelDestacado");
    const html = renderToStaticMarkup(
      <ImagenDelDestacado block={{ block_id: "d", type: "feature", title: "Sorteo", image_ref: "premio" }} vista={null}
        problemas={[]} ocupado={false} onEditarBloque={noop} onSubir={noop} />,
    );
    expect(html).toContain("Falta describirla");
    expect(html).toContain("Quitar la foto");
  });

  it("el normalizador conserva el Destacado y su caja; una forma desconocida se descarta", async () => {
    const { normalizeMailBlock } = await import("../../../api/materialMail");
    const b = normalizeMailBlock({ block_id: "d", type: "feature", title: "T", image_ref: "premio", alt: "A", layout: "abajo", box: { bg: "tinte" } });
    expect(b).toMatchObject({ type: "feature", title: "T", image_ref: "premio", alt: "A", box: { bg: "tinte" } });
    expect(b).not.toHaveProperty("layout");
  });
});

describe("Destacado recién insertado (L5)", () => {
  it("nace con un enlace que ya vale: el del botón del correo, o el campo de la encuesta, o sin botón", async () => {
    const { bloqueParaInsertar } = await import("./estructuraCorreo");
    const conBoton = plantilla([{ block_id: "b", type: "button", text: "Ir", url: "{{enlace}}" }]);
    expect(bloqueParaInsertar(conBoton, "feature")).toMatchObject({ url: "{{enlace}}", button_text: "Responder la encuesta" });
    const conCampo = { ...plantilla([]), fields: [{ key: "link", tag: "LINK", label: "Enlace", destino: "encuesta" as const }] };
    expect(bloqueParaInsertar(conCampo, "feature")).toMatchObject({ url: "{{link}}" });
    const sinNada = bloqueParaInsertar(plantilla([{ block_id: "b", type: "button", text: "Ir", url: "https://" }]), "feature");
    expect(sinNada).not.toHaveProperty("url");
    expect(sinNada).not.toHaveProperty("button_text");
  });
});

describe("enlaces en el Destacado", () => {
  it("el texto admite [texto](url) como en el render; el título y el botón no", async () => {
    const { admiteEnlaces } = await import("./comoSaleEnLaPlataforma");
    expect(admiteEnlaces("feature", "text")).toBe(true);
    expect(admiteEnlaces("feature", "title")).toBe(false);
    expect(admiteEnlaces("feature", "button_text")).toBe(false);
  });
});
