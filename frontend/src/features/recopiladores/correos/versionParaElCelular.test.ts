// Versión para el celular del bloque Imagen (L12): contrato del cliente, subida
// a su ranura y lectura de lo que pinta la vista previa.

import { describe, expect, it } from "vitest";

import { normalizeMailBlock, type MailBlock, type MailTemplate } from "../../../api/materialMail";
import { srcDelMovil } from "./estructuraCorreo";
import { conArchivoDeImagen, imagenDeBloque, imagenesDelCuerpo } from "./piezasGraficas";

const afiche: MailBlock = { block_id: "a", type: "image", image_ref: "afiche", alt: "Afiche", bleed: true };
const plantilla = (blocks: MailBlock[]) => ({ blocks, images: {}, fields: [] }) as unknown as MailTemplate;

describe("versión para el celular", () => {
  it("el normalizador la conserva y no la inventa", () => {
    expect(normalizeMailBlock({ ...afiche, mobile_ref: "afiche-movil" })).toMatchObject({ mobile_ref: "afiche-movil" });
    expect(normalizeMailBlock(afiche)).not.toHaveProperty("mobile_ref");
  });

  it("subir a la ranura «movil» la nombra sin tocar la de PC ni chocar con otra imagen", () => {
    const t = plantilla([afiche]);
    expect(imagenDeBloque(afiche, "movil")).toBe("");
    const out = conArchivoDeImagen(t, "a", "Afiche.png", "movil");
    expect(out?.template.blocks[0]).toMatchObject({ image_ref: "afiche", mobile_ref: "afiche-2" });
    expect(imagenesDelCuerpo(out!.template)).toEqual(["afiche", "afiche-2"]);
    // Reemplazarla no toca la de PC.
    const otra = conArchivoDeImagen(out!.template, "a", "celular.png", "movil");
    expect(otra?.template.blocks[0]).toMatchObject({ image_ref: "afiche", mobile_ref: "celular" });
  });

  it("lee el src de la versión del celular de la vista previa (su <img> lleva data-pulso-prop)", () => {
    const html = '<tr data-pulso-block="a"><td><img class="cmail-pc" src="data:pc"><div class="cmail-movil"><img src="data:movil&amp;x" data-pulso-prop="mobile_ref"></div></td></tr><tr data-pulso-block="b"><img src="otra" data-pulso-prop="mobile_ref"></tr>';
    expect(srcDelMovil(html, "a")).toBe("data:movil&x");
    expect(srcDelMovil(html, "zz")).toBeNull();
  });
});
