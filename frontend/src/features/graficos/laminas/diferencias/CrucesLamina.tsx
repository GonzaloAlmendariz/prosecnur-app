// Los cruces de una lámina de diferencias con el nombre de cada uno y los rótulos cortos de sus grupos (`cruces`,
// `rotulos` y `cortos` del payload). Reusa los controles de las tarjetas (CrucesTarjetas, CortosGrupos); la regla de
// qué cruces rigen y qué se escribe vive en modeloCrucesLamina.ts.

import { CrucesTarjetas } from "./OpcionesTarjetas";
import { CortosGrupos } from "./CortosGrupos";
import { crucesDeLamina, crucesImplicitos, parcheCrucesLamina, tarjetasDeLamina } from "./modeloCrucesLamina";
import type { CambiosOpcion } from "./modeloTarjetas";
import "./diferencias.css";

type Props = {
  payload: Record<string, unknown>;
  scope: "active" | "consolidated";
  baseActiva: string | null | undefined;
  /** Qué rige sin cruces elegidos, dicho para esta lámina. */
  ayudaVacia: string;
  onParche: (parche: Record<string, unknown>) => void;
};

export function CrucesLamina({ payload, scope, baseActiva, ayudaVacia, onParche }: Props) {
  const valor = tarjetasDeLamina(payload);
  const cruces = crucesDeLamina(payload);
  const cambiar = (c: CambiosOpcion) => onParche(parcheCrucesLamina(payload, c));
  return (
    <div className="pulso-f6-datos" data-campo="cruces" data-qa="cruces-lamina"
      data-qa-geometry-group="graficos/f6-cruces-lamina" data-qa-geometry-contract="intrinsic">
      <CrucesTarjetas valor={valor} cruces={cruces} onCambio={cambiar} ayudaVacia={ayudaVacia}
        ayudaLlena={crucesImplicitos(payload)
          ? "Los que la lámina nombra. El nombre vacío usa el de la pregunta."
          : "En este orden. El nombre vacío usa el de la pregunta."} />
      <CortosGrupos valor={valor} cruces={cruces} scope={scope} baseActiva={baseActiva} onCambio={(cortos) => cambiar({ cortos })} />
    </div>
  );
}
