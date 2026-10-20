// La miniatura de una campaña de correo en la lista: su banner, o la primera
// imagen del cuerpo si la cabecera es de logos. Es la imagen REAL del correo
// —la que el cliente entrega con URL pública—, no la plantilla de origen.
//
// El registro no la trae: se lee de la plantilla de cada campaña
// (`GET mail-template?campaign_id=`) y se recuerda por revisión, así que
// volver a la lista no la vuelve a pedir mientras el correo no cambie. Sin
// imagen con URL pública (pendiente de subir, cabecera de logos sin imagen en
// el cuerpo) no hay miniatura y la tarjeta pinta el emblema del tipo.

import { useEffect, useRef, useState } from "react";

import { apiMailTemplate, type MailCampaignSummary, type MailTemplate } from "../../../api/materialMail";
import { idDeCorreo } from "./modeloRegistro";

export type MiniaturaDeCorreo = { url: string; alt: string };

const URL_PUBLICA = /^https:\/\//i;

export function miniaturaDeLaPlantilla(t: Pick<MailTemplate, "header" | "images" | "blocks">): MiniaturaDeCorreo | null {
  const imagen = (ref: string | undefined) => {
    const img = ref ? t.images[ref] : undefined;
    return img?.url && URL_PUBLICA.test(img.url) ? { url: img.url, alt: img.alt } : null;
  };
  if (t.header.kind === "banner") {
    const banner = imagen(t.header.image_ref);
    if (banner) return banner;
  }
  for (const b of t.blocks) {
    if (b.type === "image") {
      const del = imagen(b.image_ref);
      if (del) return del;
    }
  }
  return null;
}

const recordadas = new Map<string, MiniaturaDeCorreo | null>();
const pedidas = new Set<string>();

/** Miniatura por id de campaña (`correo.<id>`); `undefined` mientras se lee. */
export function useMiniaturasDeCorreo(correos: readonly MailCampaignSummary[]): Record<string, MiniaturaDeCorreo | null> {
  const [, setVersion] = useState(0);
  // Montado, no «vigente»: la lista de correos cambia seguido mientras carga y
  // una respuesta que llega después igual tiene que pintarse.
  const montado = useRef(true);
  useEffect(() => {
    montado.current = true;
    return () => { montado.current = false; };
  }, []);
  useEffect(() => {
    for (const c of correos) {
      const clave = `${c.campaign_id}:${c.template_revision}`;
      if (recordadas.has(clave) || pedidas.has(clave)) continue;
      pedidas.add(clave);
      apiMailTemplate(c.campaign_id).then(
        (p) => {
          recordadas.set(clave, miniaturaDeLaPlantilla(p.template));
          if (montado.current) setVersion((v) => v + 1);
        },
        // Un fallo no se recuerda: la próxima vez se vuelve a pedir.
        () => undefined,
      ).finally(() => pedidas.delete(clave));
    }
  }, [correos]);
  const salida: Record<string, MiniaturaDeCorreo | null> = {};
  for (const c of correos) salida[idDeCorreo(c.campaign_id)] = recordadas.get(`${c.campaign_id}:${c.template_revision}`) ?? null;
  return salida;
}
