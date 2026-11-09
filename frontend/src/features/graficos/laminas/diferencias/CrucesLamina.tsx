// Con qué se compara en una lámina de diferencias («Comparar por»), el nombre de cada pregunta y el nombre corto de sus grupos (`cruces`,
// `rotulos` y `cortos` del payload). Reusa los controles de las tarjetas (CrucesTarjetas, CortosGrupos); la regla de
// qué cruces rigen y qué se escribe vive en modeloCrucesLamina.ts.

import { CrucesTarjetas } from "./OpcionesTarjetas";
import { CortosGrupos } from "./CortosGrupos";
import { CasosNombrados } from "./CasosNombrados";
import { crucesDeLamina, crucesImplicitos, parcheCrucesLamina, tarjetasDeLamina } from "./modeloCrucesLamina";
import type { CambiosOpcion } from "./modeloTarjetas";
import "./diferencias.css";

type Props = {
  payload: Record<string, unknown>;
  scope: "active" | "consolidated";
  baseActiva: string | null | undefined;
  /** Qué rige sin cruces elegidos, dicho para esta lámina. */
  ayudaVacia: string;
  /** La lámina declara `publico`: «Cómo se nombran los casos» va aquí, tras el nombre corto de los grupos (H6). */
  conPublico?: boolean;
  onParche: (parche: Record<string, unknown>) => void;
};

export function CrucesLamina({ payload, scope, baseActiva, ayudaVacia, conPublico = false, onParche }: Props) {
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
      {/* Estas láminas usan siempre el nombre corto de un grupo (`.dif_corto`), no sólo cuando no cabe. */}
      <CortosGrupos valor={valor} cruces={cruces} scope={scope} baseActiva={baseActiva} uso="siempre" onCambio={(cortos) => cambiar({ cortos })} />
      {conPublico && (
        <CasosNombrados valor={typeof payload.publico === "string" ? payload.publico : ""} ayuda='En la lectura de la lámina, p. ej. "estudiantes".'
          onCambio={(p) => onParche({ publico: p })} />
      )}
    </div>
  );
}
