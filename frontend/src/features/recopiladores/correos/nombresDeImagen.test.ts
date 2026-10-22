import { describe, expect, it } from "vitest";

import type { MailCheck, MailTemplate } from "../../../api/materialMail";
import { comoArreglar } from "./comoArreglar";
import { domDePrueba } from "./domDePrueba.test-util";
import { logosDeLaCabecera } from "./estructuraCorreo";
import { cifraDeChequeo, rotuloDeChequeo } from "./modeloCorreo";
import { claseDeImagen, fraseDeLoQueFalta, idsSinArchivo, nombreDeImagen } from "./nombresDeImagen";
import { salidaDelChequeo } from "./PanelRevision";

type Plantilla = Pick<MailTemplate, "header" | "images" | "blocks">;

const LOGOS: Plantilla = {
  header: { kind: "logos", logo_ids: ["logo-cliente", "pulso"], background: "dark" },
  images: { "logo-cliente": { alt: "[Unidad solicitante]" }, pulso: { alt: "Pulso PUCP" } },
  blocks: [{ block_id: "foto", type: "image", image_ref: "campus", alt: "Foto del campus" }],
};

describe("H7 — cada imagen se nombra por su papel, nunca por su id", () => {
  it("usa la descripción sin corchetes; sin ella, el papel conocido o el id legible", () => {
    expect(nombreDeImagen(LOGOS, "logo-cliente")).toBe("Unidad solicitante");
    expect(nombreDeImagen(LOGOS, "pulso")).toBe("Pulso PUCP");
    expect(nombreDeImagen(LOGOS, "campus")).toBe("Foto del campus");
    const sinAlt: Plantilla = { ...LOGOS, images: { "logo-cliente": { alt: "" }, "logo-facultad": { alt: "[Describe la imagen]" } } };
    expect(nombreDeImagen(sinAlt, "logo-cliente")).toBe("Unidad solicitante");
    expect(nombreDeImagen(sinAlt, "logo-facultad")).toBe("Logo facultad");
  });

  it("distingue logo de la franja, banner e imagen de un bloque", () => {
    expect(claseDeImagen(LOGOS, "pulso")).toBe("logo");
    expect(claseDeImagen(LOGOS, "campus")).toBe("imagen");
    const banner: Plantilla = { ...LOGOS, header: { kind: "banner", image_ref: "banner-mailing" }, images: { "banner-mailing": { alt: "" } } };
    expect(claseDeImagen(banner, "banner-mailing")).toBe("banner");
    expect(nombreDeImagen(banner, "banner-mailing")).toBe("Banner");
  });

  it("dice lo que falta en una frase: «Falta el logo de la unidad solicitante y el de Pulso PUCP»", () => {
    expect(fraseDeLoQueFalta(LOGOS, ["logo-cliente", "pulso"])).toBe("Falta el logo de la unidad solicitante y el de Pulso PUCP.");
    expect(fraseDeLoQueFalta(LOGOS, ["pulso"])).toBe("Falta el logo de Pulso PUCP.");
    expect(fraseDeLoQueFalta(LOGOS, ["pulso", "campus"])).toBe("Falta el logo de Pulso PUCP y la imagen «Foto del campus».");
    expect(fraseDeLoQueFalta(LOGOS, [])).toBeNull();
    // Un logo propio va por su descripción, entre comillas; nunca su id.
    const propio: Plantilla = { ...LOGOS, images: { ...LOGOS.images, "logo-cliente": { alt: "Facultad de Letras" } } };
    const frase = fraseDeLoQueFalta(propio, ["logo-cliente", "pulso"]);
    expect(frase).toBe("Falta el logo «Facultad de Letras» y el de Pulso PUCP.");
    expect(frase).not.toMatch(/logo-cliente|pulso\b/);
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
