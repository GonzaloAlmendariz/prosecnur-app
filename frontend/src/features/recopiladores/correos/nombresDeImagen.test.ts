import { describe, expect, it } from "vitest";

import type { MailCheck, MailTemplate } from "../../../api/materialMail";
import { comoArreglar } from "./comoArreglar";
import { domDePrueba } from "./domDePrueba.test-util";
import { logosDeLaCabecera } from "./estructuraCorreo";
import { cifraDeChequeo, rotuloDeChequeo } from "./modeloCorreo";
import { claseDeImagen, fraseDeLoQueFalta, fraseDeLoQueFaltaDe, idsSinArchivo, nombreDeImagen } from "./nombresDeImagen";
import { salidaDelChequeo } from "./PanelRevision";

type Plantilla = Pick<MailTemplate, "header" | "images" | "blocks">;

const LOGOS: Plantilla = {
  header: { kind: "logos", logo_ids: ["logo-cliente", "pulso"], background: "dark" },
  images: { "logo-cliente": { alt: "[Unidad solicitante]" }, pulso: { alt: "Pulso PUCP" } },
  blocks: [{ block_id: "foto", type: "image", image_ref: "campus", alt: "Foto del campus" }],
};

describe("H7 — cada imagen se nombra por su papel, nunca por su id", () => {
  it("usa la descripción que le dio el equipo, sin corchetes; sin ella, su papel («Logo 2»), nunca un nombre de serie", () => {
    expect(nombreDeImagen(LOGOS, "logo-cliente")).toBe("Unidad solicitante");
    expect(nombreDeImagen(LOGOS, "campus")).toBe("Foto del campus");
    const sinAlt: Plantilla = { ...LOGOS, images: { "logo-cliente": { alt: "" }, pulso: { alt: "" } } };
    // Sin descripción, ni «Unidad solicitante» ni «Pulso PUCP»: el correo no siempre es de Pulso (Gonzalo, 2026-10-24).
    expect(nombreDeImagen(sinAlt, "logo-cliente")).toBe("Logo 1");
    expect(nombreDeImagen(sinAlt, "pulso")).toBe("Logo 2");
    const otra: Plantilla = { ...sinAlt, images: { "logo-facultad": { alt: "[Describe la imagen]" } } };
    expect(nombreDeImagen(otra, "logo-facultad")).toBe("Logo facultad");
  });

  it("distingue logo de la franja, banner e imagen de un bloque", () => {
    expect(claseDeImagen(LOGOS, "pulso")).toBe("logo");
    expect(claseDeImagen(LOGOS, "campus")).toBe("imagen");
    const banner: Plantilla = { ...LOGOS, header: { kind: "banner", image_ref: "banner-mailing" }, images: { "banner-mailing": { alt: "" } } };
    expect(claseDeImagen(banner, "banner-mailing")).toBe("banner");
    expect(nombreDeImagen(banner, "banner-mailing")).toBe("Banner");
  });

  it("dice lo que falta por su papel y cuántas, sin nombrar a nadie: «Faltan los logos»", () => {
    expect(fraseDeLoQueFalta(LOGOS, ["logo-cliente", "pulso"])).toBe("Faltan los logos.");
    expect(fraseDeLoQueFalta(LOGOS, ["pulso"])).toBe("Falta un logo.");
    expect(fraseDeLoQueFalta(LOGOS, ["pulso", "campus"])).toBe("Faltan un logo y una imagen.");
    expect(fraseDeLoQueFalta(LOGOS, [])).toBeNull();
    const banner: Plantilla = { ...LOGOS, header: { kind: "banner", image_ref: "b" }, images: { b: { alt: "Banner" } } };
    expect(fraseDeLoQueFalta(banner, ["b"])).toBe("Falta el banner.");
    // Ni la descripción propia ni el id: «Facultad de Letras» tampoco se cita.
    const propio: Plantilla = { ...LOGOS, images: { ...LOGOS.images, "logo-cliente": { alt: "Facultad de Letras" } } };
    const frase = fraseDeLoQueFalta(propio, ["logo-cliente", "pulso"]) ?? "";
    expect(frase).not.toMatch(/Pulso|Facultad|unidad|logo-cliente|pulso\b/i);
    // El renglón de cada logo por subir: «Falta el logo 2».
    expect(fraseDeLoQueFaltaDe(LOGOS, "pulso")).toBe("Falta el logo 2");
    expect(fraseDeLoQueFaltaDe(banner, "b")).toBe("Falta el banner");
  });

  it("la revisión de images_available habla de logos subidos y lleva a Identidad", () => {
    const chk: MailCheck = { code: "images_available", status: "error", value: 2, detail: "Imágenes que no están en el proyecto ni tienen URL.", items: ["logo-cliente", "pulso", "pulso"], targets: [{ block_id: "__cabecera" }] };
    expect(idsSinArchivo(chk.items)).toEqual(["logo-cliente", "pulso"]);
    expect(rotuloDeChequeo(chk)).toBe("Logos e imágenes subidos");
    expect(cifraDeChequeo(chk)).toBe("faltan 2");
    expect(cifraDeChequeo({ ...chk, value: 1 })).toBe("falta 1");
    expect(salidaDelChequeo("images_available", "__cabecera").texto).toBe("Subir en Identidad");
    // Regla del ZIP: el arreglo nunca propone alojar la imagen por fuera.
    expect(comoArreglar("images_available")).not.toMatch(/URL|alojad/i);
  });
});

describe("H3 — los logos de la cabecera se miden uno por uno", () => {
  const html = [
    '<table><tr data-pulso-block="__cabecera" data-pulso-type="header"><td data-rect="0,0,600,90"><table><tr>',
    '<td valign="middle"><span data-rect="48,22,120,46">[Unidad solicitante]</span></td>',
    '<td valign="middle" style="padding:0 18px;"><div data-rect="186,22,1,46">&nbsp;</div></td>',
    '<td valign="middle"><img src="data:image/png;base64,AA" data-rect="206,22,120,46"></td>',
    "</tr></table></td></tr></table>",
  ].join("");

  it("cada celda de logo, a escala, con o sin imagen; los separadores no cuentan", () => {
    const doc = domDePrueba(html) as unknown as Document;
    expect(logosDeLaCabecera(doc, ["logo-cliente", "pulso"], 0.5)).toEqual([
      { id: "logo-cliente", rect: { x: 24, y: 11, w: 60, h: 23 }, conImagen: false },
      { id: "pulso", rect: { x: 103, y: 11, w: 60, h: 23 }, conImagen: true },
    ]);
  });

  it("si las celdas no calzan con los logos, no promete nada", () => {
    const doc = domDePrueba(html) as unknown as Document;
    expect(logosDeLaCabecera(doc, ["solo-uno"], 1)).toEqual([]);
    expect(logosDeLaCabecera(doc, [], 1)).toEqual([]);
  });
});
