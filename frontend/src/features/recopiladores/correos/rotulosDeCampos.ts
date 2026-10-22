// rotulosDeCampos.ts — cómo se ve un campo como chip, en el lienzo y en Envíos.
//
// El chip de un campo dice su rótulo («Nombre», «Carrera»), nunca la llave del
// motor. Es la misma regla en el inspector del bloque y en la apertura de un
// envío: vive aquí para que no se separen.

import type { MailTemplate } from "../../../api/materialMail";
import { clavesDeclaradas, rotuloDeClave } from "./camposDeclarados";

export type RotulosDeCampos = {
  rotuloDeCampo: (key: string) => string;
  ayudaDeCampo: (key: string) => string;
  /** N5: lo que la campaña no declara sale como chip inválido, con su aviso. */
  campoValido: (key: string) => boolean;
};

export function rotulosDeCampos(template: Pick<MailTemplate, "fields">): RotulosDeCampos {
  const declaradas = clavesDeclaradas(template);
  const rotulo = (key: string) => (key === "nombre" ? "Nombre" : template.fields.find((f) => f.key === key)?.label || rotuloDeClave(key));
  return {
    rotuloDeCampo: rotulo,
    ayudaDeCampo: (key: string) => `${rotulo(key)}: cambia con cada persona`,
    campoValido: (key: string) => declaradas.has(key),
  };
}
