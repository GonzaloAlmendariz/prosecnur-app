// Ajustes de «Resumen de diferencias» (`p_slide_resumen_diferencias`) en Inspector › Lámina: la selección de filas, los
// cruces con su nombre y los rótulos cortos de sus grupos, los topes de la selección automática y los capítulos con sus
// filas (ítem 15 de la revisión del PPT v7.23). Se pintan los argumentos del registro que no son texto (los textos van en
// «Textos», salvo «Cómo se nombran los casos», que va bajo «Comparar por» como en las tarjetas), en su orden y según su
// `depende`. Cada cambio es un `updateSlidePayload`.

import { useId } from "react";
import { useLocation } from "react-router-dom";
import type { ArgMetadata, Slide } from "../../../../api/graficos";
import { useSession } from "../../../../lib/SessionContext";
import { useGraficosReportScope } from "../../reportScope";
import { usePlanStore } from "../../store";
import { AjusteRegistro } from "../contenidoEspecial/AjusteRegistro";
import { ajustesQueAplican, conDependientesJuntos, valorEfectivo } from "../contenidoEspecial/ajustesRegistro";
import { CrucesLamina } from "../diferencias/CrucesLamina";
import { varCalificada } from "../ordenCategorias";
import { CapitulosResumen } from "./CapitulosResumen";
import "../datosGrafico.css";
import "../hallazgos/hallazgos.css";

export function AjustesResumenDiferencias({ slide, args }: { slide: Slide; args: readonly ArgMetadata[] }) {
  const idTitulo = useId();
  const updatePayload = usePlanStore((s) => s.updateSlidePayload);
  const scope = useGraficosReportScope(useLocation().search);
  const baseActiva = useSession().state?.active_base;
  const payload = slide.payload as Record<string, unknown>;
  const seleccion = args.find((a) => a.name === "seleccion");
  const automatica = seleccion ? valorEfectivo(payload, seleccion) === "auto" : false;
  const set = (parche: Record<string, unknown>) => updatePayload(slide.id, parche);
  // «Cómo se nombran los casos» va con «Comparar por», como en las tarjetas (H6); no se pinta también suelto.
  const tienePublico = args.some((a) => a.name === "publico");

  return (
    <section className="pulso-f6-especial pulso-f6-hallazgos-ajustes" aria-labelledby={idTitulo}
      data-qa="ajustes-resumen-diferencias" data-qa-geometry-group="graficos/f6-resumen-ajustes" data-qa-geometry-contract="intrinsic">
      <h3 id={idTitulo} className="pulso-f6-subtitulo">Resumen de diferencias</h3>
      <div className="pulso-f6-datos" data-qa-geometry-group="graficos/f6-resumen-datos" data-qa-geometry-contract="intrinsic">
        {conDependientesJuntos(ajustesQueAplican(args, payload)).map((a) => {
          if (a.name === "publico") return null;
          if (a.name === "cruces") {
            return (
              <CrucesLamina key={a.name} payload={payload} scope={scope} baseActiva={baseActiva} onParche={set}
                ayudaVacia="Sin elegir, compara como las tarjetas del informe o por los cruces del estudio."
                conPublico={tienePublico} />
            );
          }
          if (a.tipo_input === "resumen_capitulos") {
            return (
              <div key={a.name} className="pulso-f6-dato is-apilado">
                <CapitulosResumen valor={payload[a.name]} automatica={automatica} scope={scope}
                  calificar={(ref) => varCalificada(ref, baseActiva, scope)} onCambio={(v) => set({ [a.name]: v })} />
              </div>
            );
          }
          return <AjusteRegistro key={a.name} arg={a} valor={payload[a.name]} efectivo={valorEfectivo(payload, a)}
            onCambio={(v) => set({ [a.name]: v })} />;
        })}
      </div>
    </section>
  );
}
