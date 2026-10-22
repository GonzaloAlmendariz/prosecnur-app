import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { MailCheck, MailTheme } from "../../../api/materialMail";
import { AjustesDelCorreo } from "./AjustesDelCorreo";
import {
  GRIS_DE_LA_CASA,
  anchoDe,
  anchoDeLaHoja,
  conAncho,
  conFondo,
  fondoDeLaPagina,
  lecturaDelPie,
  muestrasDeFondo,
  nombreDelFondo,
  paginaDelLienzo,
} from "./modeloAjustes";

const SOBRIO: MailTheme = { accent: "#0B1F54" };
const CAMPANA: MailTheme = { accent: "#0B1F54", estilo: "campana" };
const noop = () => {};
const pintar = (theme: MailTheme, chequeos: Partial<Record<"campana_footer_contrast" | "campana_text_contrast", MailCheck>> = {}) =>
  renderToStaticMarkup(<AjustesDelCorreo theme={theme} srcDelBanner={null} chequeos={chequeos} onTema={noop} />);

describe("ancho en computadora", () => {
  it("por defecto 600, y 600 no se escribe", () => {
    expect(anchoDe(SOBRIO)).toBe(600);
    expect(conAncho(SOBRIO, 640)).toEqual({ accent: "#0B1F54", width: 640 });
    expect(conAncho({ ...SOBRIO, width: 640 }, 600)).toEqual(SOBRIO);
    expect(conAncho(SOBRIO, 600)).toEqual(SOBRIO);
    expect("width" in conAncho(SOBRIO, 600)).toBe(false);
  });

  it("el segmentado ofrece 560 · 600 (recomendado) · 640 con 600 marcado sin declararlo", () => {
    const html = pintar(SOBRIO);
    expect(html).toContain('aria-label="Ancho en computadora"');
    const opciones = [...html.matchAll(/role="radio" aria-checked="(true|false)" class="xfk-seg__opt[^"]*">([^<]+)</g)].map((m) => [m[1], m[2]]);
    expect(opciones).toEqual([["false", "560 px"], ["true", "600 px (recomendado)"], ["false", "640 px"]]);
    expect(html).toContain("En el teléfono el correo ocupa toda la pantalla y los márgenes bajan a 20 px.");
    expect(pintar({ ...SOBRIO, width: 640 })).toMatch(/aria-checked="true" class="xfk-seg__opt is-on">640 px</);
  });

  it("la hoja del lienzo sigue el ancho elegido; el teléfono no cambia", () => {
    expect(anchoDeLaHoja("escritorio", SOBRIO)).toBe(648);
    expect(anchoDeLaHoja("escritorio", { ...SOBRIO, width: 640 })).toBe(688);
    expect(anchoDeLaHoja("oscuro", { ...SOBRIO, width: 560 })).toBe(608);
    expect(anchoDeLaHoja("telefono", { ...SOBRIO, width: 640 })).toBe(375);
    expect(anchoDeLaHoja("escritorio", null)).toBe(648);
  });
});

describe("fondo de la página", () => {
  it("sobrio: sin declarar es el gris de la casa; las muestras empiezan por el gris y la cabecera", () => {
    expect(fondoDeLaPagina(SOBRIO)).toEqual({ color: GRIS_DE_LA_CASA, declarado: false, porDefecto: GRIS_DE_LA_CASA });
    expect(muestrasDeFondo(SOBRIO, ["#2E7D8C", "#0b1f54", "#F28C28", "#101010"])).toEqual([GRIS_DE_LA_CASA, "#0B1F54", "#2E7D8C", "#F28C28"]);
    expect(nombreDelFondo(GRIS_DE_LA_CASA, SOBRIO)).toBe("Gris de la casa");
    expect(nombreDelFondo("#0b1f54", SOBRIO)).toBe("Igual que la cabecera");
    expect(nombreDelFondo("#2E7D8C", SOBRIO)).toBe("Del banner");
  });

  it("sobrio: «Igual que la cabecera» escribe el acento; «Volver al gris» y el gris quitan la clave", () => {
    const conCabecera = conFondo(SOBRIO, "#0b1f54");
    expect(conCabecera).toEqual({ accent: "#0B1F54", page_bg: "#0B1F54" });
    expect(fondoDeLaPagina(conCabecera)).toMatchObject({ color: "#0B1F54", declarado: true });
    expect(conFondo(conCabecera, null)).toEqual(SOBRIO);
    expect(conFondo(conCabecera, "#eef1f5")).toEqual(SOBRIO);
  });

  it("campaña: sin declarar es el acento (no se ofrece el gris) y elegir el acento quita la clave", () => {
    expect(fondoDeLaPagina(CAMPANA)).toEqual({ color: "#0B1F54", declarado: false, porDefecto: "#0B1F54" });
    expect(muestrasDeFondo(CAMPANA, null)).toEqual(["#0B1F54"]);
    expect(conFondo({ ...CAMPANA, page_bg: "#2E7D8C" }, "#0b1f54")).toEqual(CAMPANA);
    expect(conFondo(CAMPANA, "#2e7d8c")).toEqual({ ...CAMPANA, page_bg: "#2E7D8C" });
  });

  it("el pie: se lee sobre navy o blanco; cuesta sobre un gris medio; la revisión manda", () => {
    expect(lecturaDelPie("#0B1F54")).toMatchObject({ tono: "ok", frase: "El pie se lee bien" });
    expect(lecturaDelPie("#7A7A7A")).toMatchObject({ tono: "error", frase: "El pie cuesta leerse: elige otro fondo" });
    const check: MailCheck = { code: "campana_footer_contrast", status: "error", value: 3.2, detail: "El pie legal…", items: [], targets: [] };
    expect(lecturaDelPie("#0B1F54", check)).toEqual({ tono: "error", frase: "El pie cuesta leerse: elige otro fondo", razon: 3.2, detalle: "El pie legal…" });
  });

  it("el lienzo pinta la página en Escritorio: campaña siempre, sobrio sólo con page_bg", () => {
    expect(paginaDelLienzo({ theme: SOBRIO }, "escritorio")).toBeNull();
    expect(paginaDelLienzo({ theme: { ...SOBRIO, page_bg: "#0b1f54" } }, "escritorio")).toBe("#0B1F54");
    expect(paginaDelLienzo({ theme: { ...SOBRIO, page_bg: "#0b1f54" } }, "telefono")).toBeNull();
    expect(paginaDelLienzo({ theme: CAMPANA }, "escritorio")).toBe("#0B1F54");
    expect(paginaDelLienzo(null, "escritorio")).toBeNull();
  });
});

describe("AjustesDelCorreo", () => {
  it("sobrio por defecto: el gris marcado, sin «Volver al gris» ni línea del pie", () => {
    const html = pintar(SOBRIO);
    expect(html).toContain('data-qa-geometry-group="material-campo/correo/ajustes"');
    expect(html).toContain("Fondo de la página");
    expect(html).toMatch(/role="radio" aria-checked="true" aria-label="Gris de la casa #EEF1F5"/);
    expect(html).toMatch(/aria-checked="false" aria-label="Igual que la cabecera #0B1F54"/);
    expect(html).toContain('data-foco="estilo-page_bg"');
    expect(html).not.toContain("Volver al gris");
    expect(html).not.toContain("El pie");
  });

  it("sobrio con la cabecera de fondo: «Volver al gris» y el contraste del pie en vivo", () => {
    const html = pintar({ ...SOBRIO, page_bg: "#0B1F54" });
    expect(html).toMatch(/aria-checked="true" aria-label="Igual que la cabecera #0B1F54"/);
    expect(html).toContain("Volver al gris");
    expect(html).toContain("El pie se lee bien");
    expect(pintar({ ...SOBRIO, page_bg: "#7A7A7A" })).toContain("El pie cuesta leerse: elige otro fondo");
  });

  it("campaña: un solo «Fondo de la página», con el texto y el pie; sin «Volver al gris»", () => {
    const html = pintar(CAMPANA);
    expect(html.match(/data-foco="estilo-page_bg"/g)).toHaveLength(1);
    expect(html).toContain("Se lee bien");
    expect(html).toContain("El pie se lee bien");
    expect(html).not.toContain("Gris de la casa");
    expect(html).not.toContain("Volver al gris");
  });
});
