// =============================================================================
// modeloRecorte.ts — el recorte de la foto de un Destacado o de una Imagen (L7), sin React
// =============================================================================
// Espejo de collection_mail_recorte.R: los mismos valores por defecto (en un
// Destacado 1:1 con la foto a un lado y 2:1 arriba; en una Imagen, la foto
// entera) y el mismo rectángulo, para que el encuadre
// que se ve en el inspector sea el que recorta el render.

import type { MailBlock, MailCrop, MailCropRatio, MailFeatureBlock, MailImageBlock } from "../../../api/materialMail";
import type { Ajuste } from "./ajustesDeBloque";

export const PROPORCION: Record<Exclude<MailCropRatio, "original">, number> = {
  "1:1": 1, "4:3": 4 / 3, "2:1": 2, "16:9": 16 / 9,
};

export const AJUSTE_DE_PROPORCION: Ajuste = {
  clave: "ratio",
  rotulo: "Proporción",
  defecto: "1:1",
  opciones: [
    { valor: "original", rotulo: "Original", ayuda: "la foto entera, sin recortar" },
    { valor: "1:1", rotulo: "1:1" },
    { valor: "4:3", rotulo: "4:3" },
    { valor: "2:1", rotulo: "2:1" },
    { valor: "16:9", rotulo: "16:9" },
  ],
};

export type RecorteEfectivo = { ratio: MailCropRatio; x: number; y: number; zoom: number };

const limitar = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** `.cmail_crop_of`: la proporción del bloque o la de su forma; el centro y el zoom con sus defectos. */
export function recorteDe(block: MailFeatureBlock | MailImageBlock): RecorteEfectivo {
  const c = block.crop ?? {};
  const defecto: MailCropRatio = block.type === "image" ? "original" : block.layout === "arriba" ? "2:1" : "1:1";
  const ratio = c.ratio ?? defecto;
  return { ratio, x: limitar(c.x ?? 0.5, 0, 1), y: limitar(c.y ?? 0.5, 0, 1), zoom: limitar(c.zoom ?? 1, 1, 3) };
}

export type Rect = { x0: number; y0: number; w: number; h: number };

/** `.cmail_crop_rect`: el rectángulo en píxeles del original; `null` si va entera. */
export function rectDelRecorte(size: { width: number; height: number }, r: RecorteEfectivo): Rect | null {
  if (r.ratio === "original") return null;
  const k = PROPORCION[r.ratio];
  const { width: W, height: H } = size;
  let w: number; let h: number;
  if (W / H > k) { h = H / r.zoom; w = h * k; } else { w = W / r.zoom; h = w / k; }
  w = Math.max(1, Math.floor(w)); h = Math.max(1, Math.floor(h));
  const x0 = Math.round(Math.min(Math.max(r.x * W - w / 2, 0), W - w));
  const y0 = Math.round(Math.min(Math.max(r.y * H - h / 2, 0), H - h));
  return { x0, y0, w, h };
}

/** El bloque con un cambio de recorte. Un centro o un zoom se redondean a 2 decimales. */
export function conRecorte(block: MailBlock, cambio: Partial<MailCrop>): MailBlock {
  if (block.type !== "feature" && block.type !== "image") return block;
  const redondeo = (v: number | undefined) => (v === undefined ? undefined : Math.round(v * 100) / 100);
  const next: MailCrop = { ...(block.crop ?? {}), ...cambio };
  const limpio: MailCrop = {
    ...(next.ratio ? { ratio: next.ratio } : {}),
    ...(next.x !== undefined ? { x: redondeo(limitar(next.x, 0, 1)) } : {}),
    ...(next.y !== undefined ? { y: redondeo(limitar(next.y, 0, 1)) } : {}),
    ...(next.zoom !== undefined ? { zoom: redondeo(limitar(next.zoom, 1, 3)) } : {}),
  };
  return { ...block, crop: limpio };
}
