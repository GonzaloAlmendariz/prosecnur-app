import { isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { normalizeMailReview, type MailCheck, type MailImageBlock, type MailTemplate } from "../../../api/materialMail";
import { comoArreglar, destinoDelChequeo } from "./comoArreglar";
import { CABECERA, cifraDeChequeo, conTraeLogos, esBannerDeArriba, franjaPorElBanner, rotuloDeChequeo, traeLogosDe } from "./modeloCorreo";
import { PanelDeImagen } from "./PanelDeImagen";
import { PanelIdentidad } from "./PanelIdentidad";
import { PREGUNTA_LOGOS, PreguntaLogosDelBanner, QUITAR_FRANJA } from "./PreguntaLogosDelBanner";
import { PanelRevision } from "./PanelRevision";

const BANNER: MailImageBlock = { block_id: "banner", type: "image", image_ref: "contabilidad-mailling", alt: "Contabilidad PUCP", bleed: true };

const PLANTILLA: MailTemplate = {
  schema: "collection_mail_template/v1",
  template_id: "correo",
  revision: 1,
  subject: "Acreditación",
  preheader: "",
  theme: { accent: "#0b1f54" },
  header: { kind: "logos", logo_ids: ["pulso"], background: "dark" },
  images: { pulso: { alt: "Pulso PUCP" } },
  fields: [],
  blocks: [BANNER, { block_id: "texto", type: "paragraph", text: "Hola" }],
};

const noop = () => {};

/** Los botones del árbol que devuelve el componente (sin DOM: se llama a la función). */
function botones(nodo: ReactNode): ReactElement<{ onClick?: () => void; children?: ReactNode }>[] {
  if (Array.isArray(nodo)) return nodo.flatMap(botones);
  if (!isValidElement<{ onClick?: () => void; children?: ReactNode }>(nodo)) return [];
  const propios = typeof nodo.props.onClick === "function" ? [nodo] : [];
  return [...propios, ...botones(nodo.props.children)];
}

function texto(nodo: ReactNode): string {
  if (typeof nodo === "string" || typeof nodo === "number") return String(nodo);
  if (Array.isArray(nodo)) return nodo.map(texto).join("");
  return isValidElement<{ children?: ReactNode }>(nodo) ? texto(nodo.props.children) : "";
}

function clic(arbol: ReactNode, rotulo: string) {
  const boton = botones(arbol).find((b) => texto(b.props.children).trim() === rotulo);
  if (!boton?.props.onClick) throw new Error(`sin botón «${rotulo}»`);
  boton.props.onClick();
}

describe("PreguntaLogosDelBanner", () => {
  it("pregunta sólo cuando no hay dato", () => {
    const sin = renderToStaticMarkup(<PreguntaLogosDelBanner traeLogos={undefined} onQuitarFranja={null} onResponder={noop} />);
    expect(sin).toContain(PREGUNTA_LOGOS);
    expect(sin).toContain(">Sí<");
    expect(sin).toContain(">No<");
    const si = renderToStaticMarkup(<PreguntaLogosDelBanner traeLogos onQuitarFranja={null} onResponder={noop} />);
    expect(si).not.toContain(PREGUNTA_LOGOS);
    expect(si).toContain("Ya trae los logos");
    expect(si).toContain("cambiar");
    const no = renderToStaticMarkup(<PreguntaLogosDelBanner traeLogos={false} onQuitarFranja={noop} onResponder={noop} />);
    expect(no).toContain("No trae los logos");
    // «No» no cambia nada: no ofrece quitar la franja.
    expect(no).not.toContain(QUITAR_FRANJA);
  });

  it("«Sí» y «No» responden; «cambiar» vuelve a preguntar", () => {
    const onResponder = vi.fn();
    const arbol = PreguntaLogosDelBanner({ traeLogos: undefined, onQuitarFranja: null, onResponder });
    clic(arbol, "Sí");
    clic(arbol, "No");
    expect(onResponder.mock.calls).toEqual([[true], [false]]);
    const respondida = PreguntaLogosDelBanner({ traeLogos: true, onQuitarFranja: null, onResponder });
    clic(respondida, "cambiar");
    expect(onResponder).toHaveBeenLastCalledWith(undefined);
  });

  it("con «Sí» y franja, ofrece quitarla en la misma línea", () => {
    const onQuitarFranja = vi.fn();
    const arbol = PreguntaLogosDelBanner({ traeLogos: true, onQuitarFranja, onResponder: noop });
    clic(arbol, QUITAR_FRANJA);
    expect(onQuitarFranja).toHaveBeenCalledOnce();
  });
});

describe("trae_logos en la plantilla", () => {
  it("«Sí» y «No» escriben el dato en la imagen; olvidar lo borra", () => {
    const si = conTraeLogos(PLANTILLA, BANNER.image_ref, true, BANNER.alt);
    expect(si.images[BANNER.image_ref]).toEqual({ alt: "Contabilidad PUCP", trae_logos: true });
    const no = conTraeLogos(si, BANNER.image_ref, false);
    expect(traeLogosDe(no, BANNER.image_ref)).toBe(false);
    const olvido = conTraeLogos(no, BANNER.image_ref, undefined);
    expect(olvido.images[BANNER.image_ref]).toEqual({ alt: "Contabilidad PUCP" });
    expect(traeLogosDe(olvido, BANNER.image_ref)).toBeUndefined();
    // Sin cambio, la misma plantilla: el historial no registra nada.
    expect(conTraeLogos(PLANTILLA, "pulso", undefined)).toBe(PLANTILLA);
  });

  it("«Quitar la franja» pasa la imagen a sangre de arriba a la cabecera banner", () => {
    const con = conTraeLogos(PLANTILLA, BANNER.image_ref, true, BANNER.alt);
    expect(esBannerDeArriba(con, "banner")).toBe(true);
    const out = franjaPorElBanner(con, "banner");
    expect(out.header).toEqual({ kind: "banner", image_ref: "contabilidad-mailling" });
    expect(out.blocks.map((b) => b.block_id)).toEqual(["texto"]);
    expect(out.images["contabilidad-mailling"]).toEqual({ alt: "Contabilidad PUCP", trae_logos: true });
    // Una imagen a sangre que no está arriba no se mueve.
    const abajo = { ...con, blocks: [...con.blocks].reverse() };
    expect(esBannerDeArriba(abajo, "banner")).toBe(false);
    expect(franjaPorElBanner(abajo, "banner")).toBe(abajo);
  });
});

describe("La pregunta en los paneles", () => {
  const panelDeImagen = (template: MailTemplate, vista: string | null, block: MailImageBlock = BANNER) => renderToStaticMarkup(
    <PanelDeImagen template={template} block={block} vista={vista} problemas={[]} ocupado={false} onEditarBloque={noop} onEditar={noop} onSubir={noop} />,
  );

  it("la imagen a sangre con archivo y sin dato pregunta; con dato, no", () => {
    expect(panelDeImagen(PLANTILLA, "blob:banner")).toContain(PREGUNTA_LOGOS);
    expect(panelDeImagen(PLANTILLA, null)).not.toContain(PREGUNTA_LOGOS);
    expect(panelDeImagen(PLANTILLA, "blob:banner", { ...BANNER, bleed: undefined })).not.toContain(PREGUNTA_LOGOS);
    const respondida = panelDeImagen(conTraeLogos(PLANTILLA, BANNER.image_ref, true), "blob:banner");
    expect(respondida).not.toContain(PREGUNTA_LOGOS);
    expect(respondida).toContain("Ya trae los logos");
    expect(respondida).toContain(QUITAR_FRANJA);
  });

  it("la cabecera banner pregunta y no ofrece quitar una franja que no sale", () => {
    const conBanner: MailTemplate = {
      ...PLANTILLA,
      header: { kind: "banner", image_ref: "banner-mailing" },
      images: { ...PLANTILLA.images, "banner-mailing": { alt: "Banner del estudio" } },
    };
    const panel = (t: MailTemplate) => renderToStaticMarkup(
      <PanelIdentidad template={t} imagenesLocales={{ "banner-mailing": "blob:b" }} htmlDeLaVista={null} sinArchivo={[]} bannerCheck={null} ocupado={false} onEditar={noop} onSubir={noop} />,
    );
    expect(panel(conBanner)).toContain(PREGUNTA_LOGOS);
    const si = panel(conTraeLogos(conBanner, "banner-mailing", true));
    expect(si).toContain("Ya trae los logos");
    expect(si).not.toContain(QUITAR_FRANJA);
  });
});

describe("Revisión › logos_duplicados", () => {
  const crudo = {
    code: "logos_duplicados",
    status: "warning",
    value: 1,
    detail: "Los logos podrían salir dos veces: el banner ya los trae y además está la franja de logos.",
    items: ["contabilidad-mailling"],
    targets: [{ block_id: "__cabecera" }, { block_id: "banner" }],
  };

  it("se rotula sin jerga, con su arreglo, y lleva a la cabecera", () => {
    const revision = normalizeMailReview({ checks: [crudo] });
    const check = revision.checks[0] as MailCheck;
    expect(rotuloDeChequeo(check)).toBe("Logos repetidos");
    expect(cifraDeChequeo(check)).toBe("podrían salir dos veces");
    expect(comoArreglar("logos_duplicados")).toBe("Quita la franja de logos o marca que el banner no los trae.");
    expect(destinoDelChequeo(check, "__sobre")).toBe(CABECERA);
    const html = renderToStaticMarkup(<PanelRevision revision={revision} cargando={false} onIrAlBloque={noop} />);
    expect(html).toContain("Logos repetidos");
    expect(html).toContain("Quita la franja de logos o marca que el banner no los trae.");
    // e14: el botón dice adonde lleva (el inspector de la cabecera), no «Ir a Identidad».
    expect(html).toContain("Ir a la cabecera");
    // El código sólo va en el atributo `data-chequeo`, nunca a la vista.
    expect(html.replace(/<[^>]*>/g, " ")).not.toContain("logos_duplicados");
  });
});
