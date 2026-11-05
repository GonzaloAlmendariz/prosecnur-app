// Ajustes de «Resumen de diferencias» (`p_slide_resumen_diferencias`) en Inspector › Lámina: la selección de filas, los
// cruces con su nombre y los rótulos cortos de sus grupos, los topes de la selección automática y los capítulos con sus
// filas (ítem 15 de la revisión del PPT v7.23). Se pintan los argumentos del registro que no son texto (los textos van en
// «Textos», salvo «Cómo se nombran los casos», que va bajo «Comparar por» como en las tarjetas), en su orden y según su
// `depende`. Cada cambio es un `updateSlidePayload`.

import { useLocation } from "react-router-dom";
import type { ArgMetadata, Slide } from "../../../../api/graficos";
import { useSession } from "../../../../lib/SessionContext";
import { useGraficosReportScope } from "../../reportScope";
import { usePlanStore } from "../../store";
import { AjusteRegistro } from "../contenidoEspecial/AjusteRegistro";
import { ajustesQueAplican, conDependientesJuntos, valorEfectivo } from "../contenidoEspecial/ajustesRegistro";
import { CrucesLamina } from "../diferencias/CrucesLamina";
import { varCalificada } from "../ordenCategorias";
import { PropuestaResumen } from "../propuestaResumen/PropuestaResumen";
import { CapitulosResumen } from "./CapitulosResumen";
import { SeccionLaminaPlegable } from "../tarjetaLamina/SeccionLaminaPlegable";
import { esArgCapitulos, tituloSeccionLamina } from "../tarjetaLamina/seccionesLamina";
import "../datosGrafico.css";
import "../hallazgos/hallazgos.css";

// H4: dos secciones plegables de la pestaña «Lámina»: los ajustes y los capítulos con la propuesta del motor.
export function AjustesResumenDiferencias({ slide, args }: { slide: Slide; args: readonly ArgMetadata[] }) {
  const updatePayload = usePlanStore((s) => s.updateSlidePayload);
  const scope = useGraficosReportScope(useLocation().search);
  const baseActiva = useSession().state?.active_base;
  const payload = slide.payload as Record<string, unknown>;
  const seleccion = args.find((a) => a.name === "seleccion");
  const automatica = seleccion ? valorEfectivo(payload, seleccion) === "auto" : false;
  const set = (parche: Record<string, unknown>) => updatePayload(slide.id, parche);
  // «Cómo se nombran los casos» va con «Comparar por», como en las tarjetas (H6); no se pinta también suelto.
  const tienePublico = args.some((a) => a.name === "publico");
  const aplican = conDependientesJuntos(ajustesQueAplican(args, payload));
  const argCapitulos = aplican.find(esArgCapitulos);

  return (
    <>
      <SeccionLaminaPlegable seccion="ajustes" titulo={tituloSeccionLamina(slide.tipo, "ajustes")}>
        <div className="pulso-f6-especial pulso-f6-hallazgos-ajustes"
          data-qa="ajustes-resumen-diferencias" data-qa-geometry-group="graficos/f6-resumen-ajustes" data-qa-geometry-contract="intrinsic">
          <div className="pulso-f6-datos" data-qa-geometry-group="graficos/f6-resumen-datos" data-qa-geometry-contract="intrinsic">
            {aplican.filter((a) => !esArgCapitulos(a)).map((a) => {
              if (a.name === "publico") return null;
              if (a.name === "cruces") {
                return (
                  <CrucesLamina key={a.name} payload={payload} scope={scope} baseActiva={baseActiva} onParche={set}
                    ayudaVacia="Sin elegir, compara como las tarjetas del informe o por los cruces del estudio."
                    conPublico={tienePublico} />
                );
              }
              return <AjusteRegistro key={a.name} arg={a} valor={payload[a.name]} efectivo={valorEfectivo(payload, a)}
                onCambio={(v) => set({ [a.name]: v })} />;
            })}
          </div>
        </div>
      </SeccionLaminaPlegable>
      {argCapitulos && (
        <SeccionLaminaPlegable seccion="capitulos" titulo={tituloSeccionLamina(slide.tipo, "capitulos")}>
          <div className="pulso-f6-dato is-apilado">
            <CapitulosResumen valor={payload[argCapitulos.name]} automatica={automatica} scope={scope} conTitulo={false}
              calificar={(ref) => varCalificada(ref, baseActiva, scope)} onCambio={(v) => set({ [argCapitulos.name]: v })}
              propuesta={<PropuestaResumen key={slide.id} slide={slide} scope={scope} automatica={automatica} valor={payload[argCapitulos.name]} onAplicar={set} />} />
          </div>
        </SeccionLaminaPlegable>
      )}
    </>
  );
}
