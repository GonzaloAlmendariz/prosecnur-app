// H4: los avisos de la lámina, plegados en un chip bajo la cabecera del inspector. Antes eran una franja de tres o
// cuatro líneas que a 1024x600 se comía un tercio de la altura útil. El chip dice cuántos hay; al pulsarlo, la lista
// se despliega debajo (abierto o cerrado se recuerda en laminasStore mientras la app está abierta).

import { useId } from "react";
import { AlertTriangle, ChevronDown } from "../../../vendor/lucide-react";
import { formatoConteo } from "../../../lib/formatoNumero";
import { useLaminasUi } from "./laminasStore";

export function rotuloAvisos(n: number): string {
  return n === 1 ? "1 aviso en esta lámina" : `${formatoConteo(n)} avisos en esta lámina`;
}

export function AvisosLamina({ avisos }: { avisos: readonly string[] }) {
  const id = useId();
  const abiertos = useLaminasUi((s) => s.avisosAbiertos);
  const alternar = useLaminasUi((s) => s.alternarAvisos);
  if (avisos.length === 0) return null;
  return (
    <div className={`pulso-f6-inspector-avisos${abiertos ? " is-abierta" : ""}`}>
      <button type="button" className="pulso-f6-inspector-avisos-chip" aria-expanded={abiertos} aria-controls={`${id}-lista`} onClick={alternar}>
        <AlertTriangle size={14} aria-hidden="true" />
        <span>{rotuloAvisos(avisos.length)}</span>
        <ChevronDown size={14} aria-hidden="true" className="pulso-f6-inspector-avisos-chevron" />
      </button>
      <ul id={`${id}-lista`} hidden={!abiertos}>
        {avisos.map((a) => <li key={a}>{a}</li>)}
      </ul>
    </div>
  );
}
