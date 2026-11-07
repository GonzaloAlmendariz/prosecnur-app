// El cumplimiento de la meta de un actor (Modelo de Telefónico y de Acreditación) como
// EstadoChip (P6b de la pasada de formato). Era `mon-acr-model-badge` con un ícono por
// estado, copiado en las dos páginas; va dentro de los botones de la lista de actores,
// por eso es el `<span role="status">` de EstadoChip y no un control.
import { EstadoChip } from "../../../components/EstadoChip";
import type { ChromeStatusTone } from "../../../components/ModuleCommandBar";
import type { MonitoreoCumplimientoEstado } from "../../../api/monitoreo";
import { cumplimientoLabel } from "./baseComunTelAcr";
import "./cumplimientoChip.css";

/** El tono que pintaban `.mon-acr-model-badge.is-*` (profilePage.css); «sin meta» iba sin color. */
export const TONO_DE_CUMPLIMIENTO: Record<MonitoreoCumplimientoEstado, ChromeStatusTone> = {
  cumple_meta: "success",
  brecha_menor_documentada: "warn",
  brecha_relevante: "danger",
  sin_objetivo: "neutral",
};

export function AcreditacionCumplimientoBadge({ estado }: { estado: MonitoreoCumplimientoEstado }) {
  return <EstadoChip label={cumplimientoLabel(estado)} tone={TONO_DE_CUMPLIMIENTO[estado]} />;
}
