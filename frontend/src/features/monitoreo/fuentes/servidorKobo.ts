import type { ConnectionTokenState } from "../../../api/multiIntegrado";

/** El servidor público de KoboToolbox, que no es el único que existe. */
export const KOBO_SERVIDOR_PUBLICO = "https://kf.kobotoolbox.org";

/**
 * En qué servidor de Kobo hay que buscar, según el perfil de conexión activo.
 *
 * El wizard tenía `https://kf.kobotoolbox.org` escrito a mano en los dos puntos
 * que hablan con Kobo —listar «mis formularios» y registrar la fuente elegida—
 * y nunca miraba el perfil. Con una cuenta en un servidor propio, el token se
 * mandaba al servidor público y volvía `E_KOBO_TOKEN_REJECTED`: un error de
 * credenciales para lo que en realidad era una dirección equivocada.
 *
 * Medido con la cuenta de ACNUR en `https://kobo.unhcr.org` (2026-08-01): el
 * catálogo no abría, y pegar la URL completa del proyecto sí funcionaba —ese
 * camino lee el servidor de lo pegado (`direccionDeFuente.ts`)—. La pista de
 * que el modelo ya contemplaba varios servidores estaba ahí; el catálogo era
 * el que asumía uno solo.
 *
 * El público sigue siendo el respaldo: sin perfil configurado, o con un perfil
 * sin servidor declarado, es el destino correcto.
 */
export function servidorKoboActivo(
  connections: ConnectionTokenState[] | null | undefined,
): string {
  const kobo = (connections ?? []).find((connection) => connection.provider === "kobo");
  const base = String(kobo?.active_profile_base_url ?? "").trim();
  if (!base) return KOBO_SERVIDOR_PUBLICO;
  return base.replace(/\/+$/, "");
}

/**
 * El perfil con el que hay que pedir, cuando hay más de uno guardado.
 *
 * Va junto al servidor y no por separado: pedir con el servidor de un perfil y
 * el token de otro es exactamente el error que este archivo repara.
 */
export function perfilKoboActivo(
  connections: ConnectionTokenState[] | null | undefined,
): string {
  const kobo = (connections ?? []).find((connection) => connection.provider === "kobo");
  return String(kobo?.active_profile_id ?? "").trim();
}
