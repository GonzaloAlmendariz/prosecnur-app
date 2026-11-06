import type { DashboardLastDeploy } from "../../../api/dashboard";

/**
 * Sin base elegida no hay tablero que publicar: el cliente abriría «Dashboard no disponible». El backend se niega
 * con este mismo motivo (`api/R/dashboard_publish_fuente.R`, E_DASHBOARD_SIN_FUENTE); el botón lo dice antes.
 * Mantener las dos frases iguales: `accionPublicar.test.ts` las compara.
 */
export const MOTIVO_SIN_FUENTE = "El tablero no tiene base elegida: elígela en Dashboard › Fuente antes de publicar.";

export function accionPublicar({ tieneFuente, lastDeploy }: { tieneFuente: boolean; lastDeploy?: DashboardLastDeploy | null }) {
  return {
    label: lastDeploy ? "Re-publicar" : "Publicar",
    disabled: !tieneFuente,
    title: !tieneFuente
      ? MOTIVO_SIN_FUENTE
      : lastDeploy
        ? `Re-publicar a ${lastDeploy.repo_id}`
        : "Publicar el dashboard como Hugging Face Space",
  };
}
