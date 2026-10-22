import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { normalizeMailTemplate, type MailCheck, type MailTheme } from "../../../api/materialMail";
import { EstiloDelCorreo } from "./EstiloDelCorreo";
import {
  AMARILLO_DE_LA_CASA,
  BLANCO,
  GRAFITO,
  coloresDominantes,
  conEstilo,
  contraste,
  estiloDe,
  lecturaConRevision,
  lecturaDelBoton,
  lecturaDelFondo,
  sugerenciasDeFondo,
  textoSobre,
} from "./modeloEstilo";
import { salidaDelChequeo } from "./PanelRevision";
import { paginaDeCampana } from "./VistaPreviaDelCorreo";
import { destinoDelChequeo } from "./comoArreglar";
import { IDENTIDAD } from "./modeloEstilo";
import { rotuloDeChequeo, cifraDeChequeo, tituloDeChequeo } from "./modeloCorreo";

/**
 * Fixture del tema Campaña (E1n) mientras el backend no publique las claves:
 * el acento navy de la casa y un color tomado del banner como fondo, botón amarillo, onda al pie.
 */
const CAMPANA: MailTheme = normalizeMailTemplate({
  schema: "collection_mail_template/v2",
  template_id: "correo",
  revision: 1,
  subject: "Encuesta de satisfacción 2026-2",
  preheader: "",
  theme: { accent: "#0B1F54", estilo: "campana", page_bg: "#2E7D8C", button_bg: "#F9D53E", onda: "pie", text_align: "center" },
  header: { kind: "banner", image_ref: "banner-mailing" },
  images: { "banner-mailing": { alt: "Encuesta de satisfacción" } },
  fields: [],
  blocks: [{ block_id: "texto", type: "paragraph", text: "Hola" }],
}).theme;

const noop = () => {};

describe("contraste (WCAG 2.x, la fórmula del backend)", () => {
  it("blanco y negro son 21:1; un color consigo mismo, 1:1", () => {
    expect(contraste("#FFFFFF", "#000000")).toBeCloseTo(21, 5);
    expect(contraste("#2E7D8C", "#2e7d8c")).toBeCloseTo(1, 5);
    expect(contraste("rojizo", "#FFFFFF")).toBeNull();
  });

  it("el texto sale blanco sobre un fondo oscuro y grafito sobre uno claro", () => {
    expect(textoSobre("#2E7D8C")).toBe(BLANCO);
    expect(textoSobre(AMARILLO_DE_LA_CASA)).toBe(GRAFITO);
  });

  it("dice si se lee y hacia dónde moverse", () => {
    expect(lecturaDelFondo("#2E7D8C")).toMatchObject({ tono: "ok", frase: "Se lee bien" });
    // Un gris medio: ni el blanco ni el grafito llegan a 4.5:1.
    expect(lecturaDelFondo("#7A7A7A").tono).toBe("error");
    expect(lecturaDelFondo("#767676").tono).toBe("ok");
    expect(lecturaDelFondo("#4F86A8")).toMatchObject({ tono: "error", frase: "Poco contraste: elige un fondo más claro" });
    expect(lecturaDelBoton(AMARILLO_DE_LA_CASA, GRAFITO, "#2E7D8C")).toMatchObject({ tono: "ok", frase: "Se lee bien" });
    expect(lecturaDelBoton("#F2D43A", GRAFITO, "#F9D53E").tono).toBe("warning");
  });

  it("cuando la revisión trae su chequeo, manda la revisión", () => {
    const check: MailCheck = { code: "campana_text_contrast", status: "error", value: 3.1, detail: "El texto no se lee sobre el fondo: oscurécelo.", items: [], targets: [] };
    // El veredicto es el de la revisión; la frase sigue corta y el detalle va al tooltip.
    expect(lecturaConRevision(lecturaDelFondo("#2E7D8C"), check)).toEqual({ tono: "error", frase: "Poco contraste: elige otro color", razon: 3.1, detalle: check.detail });
    expect(lecturaConRevision(lecturaDelFondo("#2E7D8C"), null).tono).toBe("ok");
  });
});

describe("tema del estilo", () => {
  it("los valores por defecto: Sobrio, justificado, fondo = acento, botón amarillo", () => {
    expect(estiloDe({ accent: "#0b1f54" })).toEqual({
      estilo: "sobrio", fondo: "#0b1f54", boton: AMARILLO_DE_LA_CASA, textoDelBoton: GRAFITO, alineacion: "justify", onda: "ninguna",
    });
    expect(estiloDe(CAMPANA)).toMatchObject({ estilo: "campana", fondo: "#2E7D8C", alineacion: "center", onda: "pie" });
  });

  it("el valor por defecto no se escribe y cambiar el botón recalcula su texto", () => {
    expect(conEstilo({ accent: "#0b1f54", band: "acento" }, { estilo: "sobrio", text_align: "justify" })).toEqual({ accent: "#0b1f54", band: "acento" });
    expect(conEstilo({ accent: "#0b1f54", text_align: "left" }, { text_align: "justify" })).toEqual({ accent: "#0b1f54" });
    expect(conEstilo({ accent: "#0b1f54", button_bg: "#FFFFFF", button_text: "#000000" }, { button_bg: "#123456" }))
      .toEqual({ accent: "#0b1f54", button_bg: "#123456" });
    // Volver a Sobrio conserva lo elegido en Campaña.
    expect(conEstilo(CAMPANA, { estilo: "sobrio" })).toMatchObject({ page_bg: "#2E7D8C", button_bg: "#F9D53E" });
    expect(conEstilo(CAMPANA, { estilo: "sobrio" }).estilo).toBeUndefined();
  });

  it("en Campaña la página se pinta con page_bg (o el acento); en Sobrio no", () => {
    expect(paginaDeCampana({ theme: CAMPANA })).toBe("#2E7D8C");
    expect(paginaDeCampana({ theme: { accent: "#0B1F54", estilo: "campana" } })).toBe("#0B1F54");
    expect(paginaDeCampana({ theme: { accent: "#0B1F54", page_bg: "#2E7D8C" } })).toBeNull();
    expect(paginaDeCampana(null)).toBeNull();
  });
});

describe("colores del banner", () => {
  const pixel = (hex: string, n: number) => {
    const v = parseInt(hex.slice(1), 16);
    return Array.from({ length: n }, () => [(v >> 16) & 255, (v >> 8) & 255, v & 255, 255]).flat();
  };

  it("los más frecuentes, sin blancos, transparentes ni casi iguales", () => {
    const datos = [
      ...pixel("#2E7D8C", 50), ...pixel("#2F7E8D", 10), ...pixel("#F9D53E", 30),
      ...pixel("#FFFFFF", 80), ...pixel("#F28C28", 20), ...pixel("#101010", 5),
      0, 0, 0, 0,
    ];
    expect(coloresDominantes(datos)).toEqual(["#2E7D8C", "#F9D53E", "#F28C28"]);
    expect(coloresDominantes(pixel("#FFFFFF", 10))).toEqual([]);
  });

  it("se ofrecen hasta tres del banner más el acento; sin banner, sólo el acento", () => {
    expect(sugerenciasDeFondo(["#2E7D8C", "#F9D53E", "#F28C28", "#101010"], "#0b1f54")).toEqual(["#2E7D8C", "#F9D53E", "#F28C28", "#0B1F54"]);
    expect(sugerenciasDeFondo(null, "#0b1f54")).toEqual(["#0B1F54"]);
    expect(sugerenciasDeFondo(["#0B1F54"], "#0b1f54")).toEqual(["#0B1F54"]);
  });
});

describe("EstiloDelCorreo", () => {
  it("Sobrio: dos miniaturas como radio, sólo la alineación (justificado)", () => {
    const html = renderToStaticMarkup(<EstiloDelCorreo theme={{ accent: "#0b1f54" }} srcDelBanner={null} chequeos={{}} onTema={noop} />);
    expect(html.match(/role="radio" aria-checked="(true|false)" class="rec-estilo-opcion/g)).toHaveLength(2);
    expect(html).toContain('data-qa-geometry-group="material-campo/correo/estilos"');
    expect(html).toContain("rec-estilo-mini is-sobrio");
    expect(html).toContain("rec-estilo-mini is-campana");
    expect(html).not.toContain("Fondo de la página");
    expect(html).toMatch(/aria-checked="true"[^>]*>Justificado/);
    expect(html).not.toMatch(/<img/);
  });

  it("Campaña: botón, onda y su contraste; el fondo de la página vive en Ajustes (E1p)", () => {
    const html = renderToStaticMarkup(<EstiloDelCorreo theme={CAMPANA} srcDelBanner={null} chequeos={{}} onTema={noop} />);
    expect(html).not.toContain("Fondo de la página");
    expect(html).not.toContain('data-foco="estilo-page_bg"');
    expect(html).toContain("Relleno del botón");
    expect(html).toContain("Onda al pie");
    expect(html).toContain("Se lee bien");
    expect(html.match(/class="rec-estilo-muestra( is-on)?"/g)?.length).toBe(2);
    expect(html).toMatch(/aria-checked="true"[^>]*>Centrado/);
  });

  it("Sobrio va primero y recomendado", () => {
    const html = renderToStaticMarkup(<EstiloDelCorreo theme={{ accent: "#0b1f54" }} srcDelBanner={null} chequeos={{}} onTema={noop} />);
    expect(html.indexOf("Sobrio")).toBeLessThan(html.indexOf("Campaña"));
    expect(html).toMatch(/Sobrio<span class="rec-estilo-recomendado">Recomendado<\/span>/);
  });

  it("el chequeo de la revisión manda en el veredicto", () => {
    const check: MailCheck = { code: "campana_button_contrast", status: "warning", value: 2.4, detail: "El botón se pierde en el fondo.", items: [], targets: [] };
    const html = renderToStaticMarkup(<EstiloDelCorreo theme={CAMPANA} srcDelBanner={null} chequeos={{ campana_button_contrast: check }} onTema={noop} />);
    expect(html).toContain('title="El botón se pierde en el fondo."');
    expect(html).toContain("rec-mail-estado-linea is-warning");
    expect(html).toContain('data-foco="estilo-button_bg"');
  });
});

describe("chequeos de Campaña en la revisión", () => {
  const chk = (code: string, prop: string, extra: MailCheck["targets"] = []): MailCheck => ({
    code, status: "error", value: 3.12, detail: "x", items: [], targets: [{ block_id: IDENTIDAD, prop }, ...extra],
  });

  it("llevan a Identidad › Estilo, al control del color", () => {
    const texto = chk("campana_text_contrast", "page_bg");
    const boton = chk("campana_button_contrast", "button_bg", [{ block_id: "accion" }]);
    expect(destinoDelChequeo(texto, "__sobre")).toBe(IDENTIDAD);
    expect(salidaDelChequeo(texto.code, IDENTIDAD, "page_bg")).toEqual({ texto: "Ir a Identidad", foco: "estilo-page_bg" });
    expect(salidaDelChequeo(boton.code, IDENTIDAD, "button_bg")).toEqual({ texto: "Ir a Identidad", foco: "estilo-button_bg" });
  });

  it("tienen rótulo y muestran su razón", () => {
    expect(rotuloDeChequeo(chk("campana_footer_contrast", "page_bg"))).toBe("El pie se lee sobre el fondo");
    expect(cifraDeChequeo(chk("campana_text_contrast", "page_bg"))).toBe("cuesta leerlo");
    expect(tituloDeChequeo(chk("campana_text_contrast", "page_bg"))).toBe("Contraste 3,1:1");
  });
});
