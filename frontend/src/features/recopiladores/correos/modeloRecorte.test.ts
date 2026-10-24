// Recorte de la foto del Destacado (L7): el mismo rectángulo que
// collection_mail_recorte.R, con los mismos casos que test-collection-mail-recorte.R.

import { describe, expect, it } from "vitest";

import { normalizeMailBlock, normalizeMailCrop, type MailFeatureBlock, type MailImageBlock } from "../../../api/materialMail";
import { srcOriginalDelBloque } from "./estructuraCorreo";
import { conRecorte, recorteDe, rectDelRecorte } from "./modeloRecorte";

const dest = (extra: Partial<MailFeatureBlock> = {}): MailFeatureBlock => ({ block_id: "d", type: "feature", title: "T", image_ref: "premio", ...extra });

describe("recorte efectivo", () => {
  it("sin crop: 1:1 a un lado, 2:1 arriba; original no recorta", () => {
    expect(recorteDe(dest()).ratio).toBe("1:1");
    expect(recorteDe(dest({ layout: "arriba" })).ratio).toBe("2:1");
    expect(rectDelRecorte({ width: 1200, height: 800 }, recorteDe(dest({ crop: { ratio: "original" } })))).toBeNull();
  });

  it("el rectángulo es el de R: proporción, centro pegado al borde y zoom", () => {
    const apaisada = { width: 1200, height: 800 };
    expect(rectDelRecorte(apaisada, recorteDe(dest()))).toEqual({ x0: 200, y0: 0, w: 800, h: 800 });
    expect(rectDelRecorte(apaisada, recorteDe(dest({ crop: { x: 0 } })))?.x0).toBe(0);
    expect(rectDelRecorte(apaisada, recorteDe(dest({ crop: { x: 1 } })))?.x0).toBe(400);
    expect(rectDelRecorte(apaisada, recorteDe(dest({ crop: { zoom: 2 } })))).toMatchObject({ w: 400, h: 400 });
    expect(rectDelRecorte({ width: 1000, height: 1000 }, recorteDe(dest({ layout: "arriba" })))).toEqual({ x0: 0, y0: 250, w: 1000, h: 500 });
    // Un borde en una mitad (244.5) va hacia arriba, igual que en R.
    expect(rectDelRecorte(apaisada, recorteDe(dest({ crop: { ratio: "4:3", y: 0, zoom: 1.5 } })))).toEqual({ x0: 245, y0: 0, w: 711, h: 533 });
  });

  it("un cambio se acota a su rango y se redondea", () => {
    const b = conRecorte(dest(), { x: 1.37, y: 0.333333, zoom: 9 });
    expect(b).toMatchObject({ crop: { x: 1, y: 0.33, zoom: 3 } });
    expect(conRecorte(dest(), { ratio: "4:3" })).toMatchObject({ crop: { ratio: "4:3" } });
  });
});

describe("contrato del recorte en el cliente", () => {
  it("el normalizador deja sólo lo válido y el bloque lo conserva", () => {
    expect(normalizeMailCrop({ ratio: "3:2", x: 2, y: 0.4, zoom: 0.5, css: "x" })).toEqual({ y: 0.4 });
    const b = normalizeMailBlock({ block_id: "d", type: "feature", title: "T", crop: { ratio: "16:9", x: 0.2 } });
    expect(b).toMatchObject({ crop: { ratio: "16:9", x: 0.2 } });
  });

  it("lee la foto entera que manda la vista previa para encuadrar", () => {
    const html = '<tr data-pulso-block="d"><td><img src="data:image/jpeg;base64,RECORTE" data-pulso-original="data:image/jpeg;base64,ENTERA"></td></tr><tr data-pulso-block="otro"><img data-pulso-original="NO"></tr>';
    expect(srcOriginalDelBloque(html, "d")).toBe("data:image/jpeg;base64,ENTERA");
    expect(srcOriginalDelBloque(html, "nada")).toBeNull();
    // El base64 de R viene partido en renglones: la miniatura del encuadre no se decodificaba.
    const partido = '<tr data-pulso-block="d"><img src="x" data-pulso-original="data:image/png;base64,AAAA&#10;BBBB&#13;&#10;CC"></tr>';
    expect(srcOriginalDelBloque(partido, "d")).toBe("data:image/png;base64,AAAABBBBCC");
  });
});

describe("recorte en un bloque Imagen", () => {
  const img = (extra: Partial<MailImageBlock> = {}): MailImageBlock => ({ block_id: "i", type: "image", image_ref: "premio", alt: "P", ...extra });

  it("sin crop sale entera (nada de antes cambia); con crop, el mismo rectángulo que en R", () => {
    expect(recorteDe(img()).ratio).toBe("original");
    expect(rectDelRecorte({ width: 320, height: 240 }, recorteDe(img()))).toBeNull();
    expect(rectDelRecorte({ width: 320, height: 240 }, recorteDe(img({ crop: { ratio: "16:9", y: 0.2 } })))).toEqual({ x0: 0, y0: 0, w: 320, h: 180 });
    expect(conRecorte(img(), { ratio: "4:3" })).toMatchObject({ crop: { ratio: "4:3" } });
  });

  it("el normalizador conserva el crop de una Imagen", () => {
    expect(normalizeMailBlock({ block_id: "i", type: "image", image_ref: "p", alt: "P", crop: { ratio: "2:1", zoom: 1.5 } }))
      .toMatchObject({ crop: { ratio: "2:1", zoom: 1.5 } });
  });
});
