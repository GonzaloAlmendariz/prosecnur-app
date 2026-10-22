import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";

import type { MailImageBlock, MailImageReduccion, MailTemplate } from "../../../api/materialMail";
import { LineaDeReduccion } from "./AvisoDeReduccion";
import { PanelDeImagen, problemaDelArchivo } from "./PanelDeImagen";
import { lineaDeReduccion, medidaLegible } from "./reduccionDeImagen";
import { useCorreosStore } from "./store";

const REDUCIDA: MailImageReduccion = {
  reducida: true,
  convertida: false,
  de: "3201×1801",
  a: "1200×675",
  peso_antes: 6_920_000,
  peso_despues: 983_000,
  formato_antes: "png",
  formato_despues: "png",
  aviso: null,
};

const BANNER: MailImageBlock = { block_id: "banner", type: "image", image_ref: "contabilidad-mailling", alt: "Contabilidad PUCP", bleed: true };
const PLANTILLA: MailTemplate = {
  schema: "collection_mail_template/v1",
  template_id: "correo",
  revision: 1,
  subject: "Acreditación",
  preheader: "",
  theme: { accent: "#0b1f54" },
  header: { kind: "logos", logo_ids: [], background: "dark" },
  images: {},
  fields: [],
  blocks: [BANNER],
};
const noop = () => {};

afterEach(() => useCorreosStore.getState().reiniciar());

describe("lineaDeReduccion", () => {
  it("dice la medida final con el × entre espacios", () => {
    expect(medidaLegible("1200×675")).toBe("1200 × 675");
    expect(lineaDeReduccion(REDUCIDA)).toEqual({ texto: "La reducimos a 1200 × 675 para el correo.", aviso: null });
  });

  it("trae el aviso del backend tal cual", () => {
    const aviso = "A 1200×675 px el PNG seguía pesando más de 1 MB; la guardamos como JPEG (calidad 85).";
    expect(lineaDeReduccion({ ...REDUCIDA, convertida: true, formato_despues: "jpeg", aviso })?.aviso).toBe(aviso);
  });

  it("no dice nada si no se redujo, no se sabe a cuánto o no vino", () => {
    expect(lineaDeReduccion({ ...REDUCIDA, reducida: false })).toBeNull();
    expect(lineaDeReduccion({ ...REDUCIDA, a: "" })).toBeNull();
    expect(lineaDeReduccion(null)).toBeNull();
    expect(lineaDeReduccion(undefined)).toBeNull();
  });
});

describe("LineaDeReduccion", () => {
  it("sin reducción no pinta nada", () => {
    expect(renderToStaticMarkup(<LineaDeReduccion reduccion={null} />)).toBe("");
    expect(renderToStaticMarkup(<LineaDeReduccion reduccion={{ ...REDUCIDA, reducida: false }} />)).toBe("");
  });

  it("con reducción es una línea de estado, con el aviso si vino y sin bytes crudos", () => {
    const html = renderToStaticMarkup(<LineaDeReduccion reduccion={{ ...REDUCIDA, aviso: "Las zonas transparentes quedaron en blanco." }} />);
    expect(html).toContain('role="status"');
    expect(html).toContain("La reducimos a 1200 × 675 para el correo.");
    expect(html).toContain("Las zonas transparentes quedaron en blanco.");
    expect(html).not.toMatch(/\d{6,}/);
  });
});

describe("las reducciones en el store", () => {
  it("se recuerdan por imagen; una subida que no se redujo olvida la anterior", () => {
    const st = useCorreosStore.getState();
    st.recordarReduccion("logo", REDUCIDA);
    st.recordarReduccion("banner", REDUCIDA);
    expect(Object.keys(useCorreosStore.getState().reducciones).sort()).toEqual(["banner", "logo"]);
    st.recordarReduccion("logo", { ...REDUCIDA, reducida: false });
    expect(Object.keys(useCorreosStore.getState().reducciones)).toEqual(["banner"]);
    st.recordarReduccion("banner", null);
    expect(useCorreosStore.getState().reducciones).toEqual({});
  });

  it("cambiar de campaña o salir las olvida", () => {
    useCorreosStore.getState().recordarReduccion("logo", REDUCIDA);
    useCorreosStore.getState().reiniciar();
    expect(useCorreosStore.getState().reducciones).toEqual({});
  });
});

describe("Lo que se dice antes de subir", () => {
  it("una imagen de varios MB ya no se rechaza en el navegador; una de más de 40 MB sí", () => {
    expect(problemaDelArchivo({ name: "banner.png", type: "image/png", size: 6_900_000 })).toBeNull();
    expect(problemaDelArchivo({ name: "banner.png", type: "image/png", size: 41 * 1024 * 1024 })).toMatch(/40 MB/);
  });

  it("la ayuda del inspector no pide reducirla antes", () => {
    const html = renderToStaticMarkup(
      <PanelDeImagen template={PLANTILLA} block={BANNER} vista={null} problemas={[]} ocupado={false} onEditarBloque={noop} onEditar={noop} onSubir={noop} />,
    );
    expect(html).not.toContain("hasta 1 MB");
    expect(html).toContain("la reducimos al subirla");
  });
});
