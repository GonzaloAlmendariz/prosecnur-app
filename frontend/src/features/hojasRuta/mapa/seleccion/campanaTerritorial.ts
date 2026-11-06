import { apiMaterialCampanaCrear, apiMaterialCampanas } from "../../../../api/materialCampanas";

/**
 * Checklist M1 (Material territorial): enviar la muestra no creaba la campaña territorial, y «Abrir en
 * Material de campo» caía en una lista vacía. Después de enviar, si el proyecto todavía no tiene su
 * campaña territorial (una por proyecto, ADR 0118), se crea; la fase la fija el backend con la activa.
 * Devuelve si quedó una campaña territorial. Un fallo no deshace el envío: Material sigue ofreciendo
 * crearla a mano.
 */
export const NOMBRE_CAMPANA_TERRITORIAL = "Campaña territorial";

export async function asegurarCampanaTerritorial(): Promise<boolean> {
  try {
    const registro = await apiMaterialCampanas();
    if (!registro) return false;
    if (registro.campaigns.some((c) => c.tipo === "territorial")) return true;
    const r = await apiMaterialCampanaCrear({ tipo: "territorial", name: NOMBRE_CAMPANA_TERRITORIAL, expected_registry_revision: registro.registry_revision });
    return r !== null;
  } catch {
    return false;
  }
}
