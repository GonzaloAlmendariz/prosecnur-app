import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";

import { normalizeMailReview, type MailCheck, type MailImageBlock, type MailImageReduccion, type MailTemplate, type MailTwoImagesBlock } from "../../../api/materialMail";
import { CABECERA, resumenDeBloque, usarBanner } from "./modeloCorreo";
import { fraseDeNitidez } from "./nitidez";
import { descripcionDeImagen, resumenDeCabecera, resumenDeFila } from "./nombresDeImagen";
import { PanelIdentidad } from "./PanelIdentidad";
import { PanelRevision, salidasDeLoQueFalta } from "./PanelRevision";
import { chequeoDelBannerVisible, lineaDeReduccion, medidaDelBanner } from "./reduccionDeImagen";
import { useCorreosStore } from "./store";

const noop = () => {};

const DECORATIVA: MailImageBlock = { block_id: "torre", type: "image", image_ref: "torre-alta-1a10-2", alt: "", decorative: true };
const FOTO: MailImageBlock = { block_id: "foto", type: "image", image_ref: "campus-1", alt: "" };
const PAR: MailTwoImagesBlock = { block_id: "par", type: "two_images", left: "izq-1", right: "der-1", alt_left: "Patio", alt_right: "" };

const PLANTILLA: MailTemplate = {
  schema: "collection_mail_template/v1",
  template_id: "correo",
  revision: 1,
  subject: "Acreditación",
  preheader: "",
  theme: { accent: "#0b1f54" },
  header: { kind: "logos", logo_ids: ["logo-cliente", "pulso"], background: "dark" },
  images: {
    "logo-cliente": { alt: "Facultad" },
    pulso: { alt: "Pulso PUCP" },
    "torre-alta-1a10-2": { alt: "" },
    "campus-1": { alt: "" },
    "izq-1": { alt: "" },
    "der-1": { alt: "" },
  },
  fields: [],
  blocks: [DECORATIVA, FOTO, PAR],
};

afterEach(() => useCorreosStore.getState().reiniciar());

describe("e15 #2 · la miniatura de cada logo no queda vacía tras recargar", () => {
  const vista = '<tr><td bgcolor="#0b1f54"><table><tr>'
    + '<td valign="middle"><img src="data:image/png;base64,QUJD" alt="Facultad"></td>'
    + '<td valign="middle" style="padding:0 18px;"><div></div></td>'
    + '<td valign="middle"><img src="data:image/png;base64,REVG" alt="Pulso PUCP"></td>'
    + "</tr></table></td></tr>";

  it("sin subida en esta sesión, la fila toma el logo de la vista previa", () => {
    const html = renderToStaticMarkup(
      <PanelIdentidad template={PLANTILLA} imagenesLocales={{}} htmlDeLaVista={vista} sinArchivo={[]} bannerCheck={null} ocupado={false} onEditar={noop} onSubir={noop} />,
    );
    const filas = html.slice(html.indexOf('class="rec-mail-logos"'));
    expect(filas).toContain('<img src="data:image/png;base64,QUJD" alt="Facultad"/>');
    expect(filas).toContain('<img src="data:image/png;base64,REVG" alt="Pulso PUCP"/>');
    expect(filas).not.toContain("is-vacia");
  });

  it("sin vista previa, cae a la URL de la imagen", () => {
    const conUrl: MailTemplate = { ...PLANTILLA, images: { ...PLANTILLA.images, pulso: { alt: "Pulso PUCP", url: "https://x.org/pulso.png" } } };
    const html = renderToStaticMarkup(
      <PanelIdentidad template={conUrl} imagenesLocales={{}} htmlDeLaVista={null} sinArchivo={[]} bannerCheck={null} ocupado={false} onEditar={noop} onSubir={noop} />,
    );
    expect(html.slice(html.indexOf('class="rec-mail-logos"'))).toContain('src="https://x.org/pulso.png"');
  });
});

describe("e15 #3 · el subtítulo de la lista no muestra tipo ni id", () => {
  it("la cabecera de banner no repite «banner» en minúscula", () => {
    const conBanner = usarBanner(PLANTILLA, "banner-1");
    expect(resumenDeCabecera({ ...conBanner, images: { ...conBanner.images, "banner-1": { alt: "Banner" } } })).toBe("");
    expect(resumenDeCabecera({ ...conBanner, images: { ...conBanner.images, "banner-1": { alt: "" } } })).toBe("");
    expect(resumenDeCabecera({ ...conBanner, images: { ...conBanner.images, "banner-1": { alt: "Contabilidad PUCP" } } })).toBe("Contabilidad PUCP");
    expect(resumenDeCabecera(PLANTILLA)).toBe("2 logos");
  });

  it("una imagen decorativa o sin descripción no muestra su id", () => {
    expect(resumenDeFila(PLANTILLA, DECORATIVA)).toBe("");
    expect(resumenDeFila(PLANTILLA, FOTO)).toBe("");
    expect(resumenDeBloque(DECORATIVA)).toBe("");
    expect(resumenDeBloque(FOTO)).toBe("");
    const descrita: MailImageBlock = { ...FOTO, alt: "Campus de noche" };
    expect(resumenDeFila({ ...PLANTILLA, blocks: [descrita] }, descrita)).toBe("Campus de noche");
  });

  it("el par muestra sólo las descripciones que hay", () => {
    expect(resumenDeFila(PLANTILLA, PAR)).toBe("Patio");
    expect(resumenDeBloque(PAR)).toBe("Patio");
    const sinAlt: MailTwoImagesBlock = { ...PAR, alt_left: "" };
    expect(resumenDeFila({ ...PLANTILLA, blocks: [sinAlt] }, sinAlt)).toBe("");
    expect(descripcionDeImagen(PLANTILLA, "pulso")).toBe("Pulso PUCP");
    // El texto de serie de un par nuevo se ve en la lista, pero no nombra la imagen en la Revisión.
    const deSerie: MailTwoImagesBlock = { ...PAR, alt_left: "Describe la imagen de la izquierda", alt_right: "Describe la imagen de la derecha" };
    const conSerie = { ...PLANTILLA, blocks: [deSerie] };
    expect(resumenDeFila(conSerie, deSerie)).toBe("Describe la imagen de la izquierda · Describe la imagen de la derecha");
    expect(descripcionDeImagen(conSerie, "der-1")).toBe("");
    expect(fraseDeNitidez({ code: "image_width", status: "warning", items: [{ id: "der-1", block_id: "par", width: 60 }] }, deSerie, conSerie))
      .toBe("La imagen de la derecha de «Dos imágenes» es chica: súbela de al menos 120 px de ancho.");
  });
});

describe("e15 #4 · la tarjeta del banner dice una sola medida", () => {
  const REDUCIDA: MailImageReduccion = {
    reducida: true, convertida: false, de: "3201×1801", a: "1200×675",
    peso_antes: 6_920_000, peso_despues: 983_000, formato_antes: "png", formato_despues: "png", aviso: null,
  };
  const ok: MailCheck = { code: "banner_size", status: "ok", value: "1200×675", detail: "Banner de 1200 × 675.", items: [], targets: [] };

  it("la medida real, salvo que la línea de reducción ya la diga", () => {
    expect(medidaDelBanner(ok, null)).toBe("1200 × 675 px");
    expect(medidaDelBanner(ok, REDUCIDA)).toBeNull();
    expect(medidaDelBanner(null, null)).toBeNull();
    expect(medidaDelBanner({ value: 2_000_000 }, null)).toBeNull();
    expect(chequeoDelBannerVisible(ok)).toBe(false);
    expect(chequeoDelBannerVisible({ ...ok, status: "error" })).toBe(true);
  });

  // La línea de reducción vive en el store (no llega a un render de servidor):
  // su texto y la medida de la tarjeta se prueban por separado.
  it("tras subir uno grande: la medida la dice sólo la línea de reducción", () => {
    expect(lineaDeReduccion(REDUCIDA)?.texto).toBe("La reducimos a 1200 × 675 para el correo.");
    expect(medidaDelBanner(ok, REDUCIDA)).toBeNull();
    expect(chequeoDelBannerVisible(ok)).toBe(false);
  });

  it("tras recargar (sin reducción en la sesión): la medida guardada, una vez", () => {
    const conBanner: MailTemplate = { ...usarBanner(PLANTILLA, "banner-1"), images: { ...PLANTILLA.images, "banner-1": { alt: "Contabilidad" } } };
    const html = renderToStaticMarkup(
      <PanelIdentidad template={conBanner} imagenesLocales={{ "banner-1": "blob:b" }} htmlDeLaVista={null} sinArchivo={[]} bannerCheck={ok} ocupado={false} onEditar={noop} onSubir={noop} />,
    );
    expect(html.match(/1200 × 675/g)).toHaveLength(1);
    expect(html).toContain("1200 × 675 px");
    expect(html).not.toContain("1200 × 600");
    expect(html).not.toContain("Banner de 1200 × 675.");
    expect(html).not.toContain("La app revisa");
  });
});

describe("e15 #5 · la Revisión dice de qué imagen y adónde se sube", () => {
  const nitidez = (items: MailCheck["items"]): MailCheck => ({ code: "image_width", status: "warning", value: 1, detail: "", items, targets: [{ block_id: "par" }] });

  it("(a) la nitidez nombra la imagen por su descripción o por su bloque", () => {
    expect(fraseDeNitidez(nitidez([{ id: "izq-1", block_id: "par", width: 280 }]), PAR, PLANTILLA))
      .toBe("«Patio» (izquierda) es chica: súbela de al menos 560 px de ancho.");
    expect(fraseDeNitidez(nitidez([{ id: "der-1", block_id: "par", width: 280 }]), PAR, PLANTILLA))
      .toBe("La imagen de la derecha de «Dos imágenes» es chica: súbela de al menos 560 px de ancho.");
    // En el inspector del bloque basta el lado.
    expect(fraseDeNitidez(nitidez([{ id: "der-1", block_id: "par", width: 280 }]), PAR))
      .toBe("La imagen de la derecha es chica: súbela de al menos 560 px de ancho.");
  });

  it("(a) el panel lo dice en la causa", () => {
    const html = renderToStaticMarkup(
      <PanelRevision
        revision={normalizeMailReview({ checks: [nitidez([{ id: "der-1", block_id: "par", width: 280 }])] })}
        cargando={false}
        onIrAlBloque={noop}
        template={PLANTILLA}
      />,
    );
    expect(html).toContain("La imagen de la derecha de «Dos imágenes» es chica");
  });

  const faltan: MailCheck = {
    code: "images_available", status: "error", value: 2, detail: "",
    items: ["pulso", "izq-1"], targets: [{ block_id: CABECERA }, { block_id: "par" }],
  };

  it("(b) un botón por lugar: la cabecera y el bloque, cada uno con su rótulo", () => {
    expect(salidasDeLoQueFalta(faltan, PLANTILLA, { cabeceraSinAlt: false })).toEqual([
      { destino: CABECERA, texto: "Subir en la cabecera" },
      { destino: "par", texto: "Subir «Patio»" },
    ]);
    expect(salidasDeLoQueFalta({ ...faltan, items: ["der-1"], targets: [{ block_id: "par" }] }, PLANTILLA))
      .toEqual([{ destino: "par", texto: "Subir en «Dos imágenes»" }]);
  });

  it("(b) el panel pinta los dos botones", () => {
    const html = renderToStaticMarkup(
      <PanelRevision revision={normalizeMailReview({ checks: [faltan] })} cargando={false} onIrAlBloque={noop} template={PLANTILLA} />,
    );
    expect(html).toContain("Subir en la cabecera");
    expect(html).toContain("Subir «Patio»");
  });
});
