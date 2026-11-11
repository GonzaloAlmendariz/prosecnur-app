// Material de campo > Correo > Seguimiento: sus pestañas y cómo se leen de la
// dirección. La sección es del estudio entero (todas las campañas de
// Mailchimp), así que su dirección no lleva `campana`.

export const SECCION_SEGUIMIENTO = "seguimiento";

/** El orden es el del manifiesto (`lib/modules.ts`); la primera es el aterrizaje. */
export const PESTANAS_DE_SEGUIMIENTO = ["respondieron", "horarios", "correo-personal"] as const;
export type PestanaDeSeguimiento = (typeof PESTANAS_DE_SEGUIMIENTO)[number];

export function esPestanaDeSeguimiento(valor: string): valor is PestanaDeSeguimiento {
  return (PESTANAS_DE_SEGUIMIENTO as readonly string[]).includes(valor);
}

/** La pestaña pedida si existe; si no, la de aterrizaje. */
export function resolverPestanaDeSeguimiento(pedida: string | null | undefined): PestanaDeSeguimiento {
  const p = (pedida ?? "").trim().toLowerCase();
  return esPestanaDeSeguimiento(p) ? p : PESTANAS_DE_SEGUIMIENTO[0];
}
