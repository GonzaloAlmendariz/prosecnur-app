import type { EnvioMeta } from "../../../../api/materialTerritorial";

/**
 * El envío que se muestra: el que devolvió el POST, mientras la relectura del estado no traiga uno
 * igual o más nuevo. Revisión con ojo de usuario (1 nov 2026): con el backend ocupado, la relectura
 * tardó casi dos minutos y el panel seguía en «Enviando…» con la foto ya guardada.
 */
export function envioVigente(delEstado: EnvioMeta | null, recien: EnvioMeta | null): EnvioMeta | null {
  if (!recien) return delEstado;
  if (!delEstado) return recien;
  return (delEstado.enviado_at ?? "") >= (recien.enviado_at ?? "") ? delEstado : recien;
}
