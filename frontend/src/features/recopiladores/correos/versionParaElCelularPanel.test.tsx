// Panel de la versión para el celular (L12): el campo de URL aparece sólo con
// la imagen alojada por URL (SurveyMonkey), y su error se ve en el panel.

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { MailImageBlock } from "../../../api/materialMail";
import { VersionParaElCelular } from "./VersionParaElCelular";

const afiche: MailImageBlock = { block_id: "a", type: "image", image_ref: "afiche", alt: "Afiche", mobile_ref: "afiche-movil" };
const panel = (extra: Partial<Parameters<typeof VersionParaElCelular>[0]> = {}) => renderToStaticMarkup(
  <VersionParaElCelular block={afiche} vista={null} ocupado={false} onEditarBloque={() => {}} onSubir={() => {}} {...extra} />,
);

describe("versión para el celular en el panel", () => {
  it("en el archivo (Mailchimp) no pide URL; alojada por URL, sí", () => {
    expect(panel()).not.toContain("URL pública de la versión para el celular");
    expect(panel({ url: "", onUrl: () => {} })).toContain("URL pública de la versión para el celular");
  });

  it("sin versión todavía ofrece subirla; con versión, cambiarla o quitarla", () => {
    const sin = renderToStaticMarkup(
      <VersionParaElCelular block={{ ...afiche, mobile_ref: undefined }} vista={null} ocupado={false} onEditarBloque={() => {}} onSubir={() => {}} />,
    );
    expect(sin).toContain("Subir una versión para el celular");
    expect(panel({ vista: "blob:x" })).toContain("Quitar");
  });

  it("su problema de la revisión se ve en el panel aunque vaya en el archivo", () => {
    const html = panel({ problemas: [{ path: "template.blocks[3].mobile_ref", code: "bad_image_ref", detail: "La imagen del celular nombra un archivo del proyecto." }] });
    expect(html).toContain("La imagen del celular nombra un archivo del proyecto.");
  });
});
