// Contraportada del Word (W7 del rediseño, 2026-10-15). Espejo de `.word_contraportada` (reporte_word_portada.R) y de
// `.lam_cierre_contacto` (lamina_identidad.R): el logo al centro y una línea con correo, dirección y web; cada dato que no
// se escribe usa el de PULSO PUCP (`.LAM_CIERRE_CONTACTO`). Puro.

import type { DocumentoWordContacto } from "../../../api/graficosConfigNormalizer";

export type ClaveContacto = "correo" | "direccion" | "web";

export const CONTACTO_RECETARIO: Readonly<Record<ClaveContacto, string>> = {
  correo: "pulsopucp@pucp.edu.pe",
  direccion: "Av. Universitaria 1801, San Miguel, Lima 32, Perú",
  web: "pulso.pucp.edu.pe",
};

/** En el orden del motor: correo, dirección, web. */
export function contactoEfectivo(contacto: DocumentoWordContacto | undefined): string[] {
  return (["correo", "direccion", "web"] as const).map((k) => contacto?.[k]?.trim() || CONTACTO_RECETARIO[k]);
}
