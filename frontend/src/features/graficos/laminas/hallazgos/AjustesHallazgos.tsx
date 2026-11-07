// Ajustes de «Hallazgos clave» (`p_slide_hallazgos`) en Inspector › Lámina: el modo y, en el resumen ejecutivo, la
// selección, los topes, «También», los cruces con su nombre y los rótulos cortos de sus grupos, y los capítulos. Se
// pintan los argumentos del registro que no son texto (los textos van en «Textos»), en su orden y según su `depende`.
// Cada cambio es un `updateSlidePayload`.

import { useLocation } from "react-router-dom";
import { History } from "../../../../vendor/lucide-react";
import type { ArgMetadata, Slide } from "../../../../api/graficos";
import { useSession } from "../../../../lib/SessionContext";
import { useGraficosReportScope } from "../../reportScope";
import { usePlanStore } from "../../store";
import { AjusteRegistro } from "../contenidoEspecial/AjusteRegistro";
import { ajustesQueAplican, valorEfectivo } from "../contenidoEspecial/ajustesRegistro";
import { CrucesLamina } from "../diferencias/CrucesLamina";
import { varCalificada } from "../ordenCategorias";
import { PropuestaResumen } from "../propuestaResumen/PropuestaResumen";
import { CapitulosHallazgos } from "./CapitulosHallazgos";
import { MODOS_RESUMEN } from "./modeloCapitulosHallazgos";
import { SeccionLaminaPlegable } from "../tarjetaLamina/SeccionLaminaPlegable";
import { esArgCapitulos, tituloSeccionLamina } from "../tarjetaLamina/seccionesLamina";
import "../datosGrafico.css";
import "./hallazgos.css";

export { ajustesQueAplican, valorEfectivo };

// H4: dos secciones plegables de la pestaña «Lámina»: los ajustes («Hallazgos») y los capítulos con la propuesta del motor.
export function AjustesHallazgos({ slide, args }: { slide: Slide; args: readonly ArgMetadata[] }) {
  const updatePayload = usePlanStore((s) => s.updateSlidePayload);
  const scope = useGraficosReportScope(useLocation().search);
  const baseActiva = useSession().state?.active_base;
  const payload = slide.payload as Record<string, unknown>;
  const porNombre = new Map(args.map((a) => [a.name, a]));
  const texto = (n: string) => { const a = porNombre.get(n); return a ? String(valorEfectivo(payload, a) ?? "") : ""; };
  const modo = texto("modo") || "cifras";
  // La selección sólo existe en el resumen ejecutivo: en modo de cifras, un «auto» que quedó guardado no aplica.
  const automatica = MODOS_RESUMEN.has(modo) && texto("seleccion") === "auto";
  const set = (parche: Record<string, unknown>) => updatePayload(slide.id, parche);
  // «Cómo se nombran los casos» va con «Comparar por», como en las tarjetas (H6); no se pinta también suelto.
  const tienePublico = args.some((a) => a.name === "publico");
  const aplican = ajustesQueAplican(args, payload);
  const argCapitulos = aplican.find(esArgCapitulos);

  return (
    <>
      <SeccionLaminaPlegable seccion="ajustes" titulo={tituloSeccionLamina(slide.tipo, "ajustes")}>
        <div className="pulso-f6-especial pulso-f6-hallazgos-ajustes"
          data-qa-geometry-group="graficos/f6-hallazgos-ajustes" data-qa-geometry-contract="intrinsic">
          <div className="pulso-f6-datos" data-qa-geometry-group="graficos/f6-hallazgos-datos" data-qa-geometry-contract="intrinsic">
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
          {!MODOS_RESUMEN.has(modo) && (
            <p className="pulso-f6-pendiente">
              <History size={14} aria-hidden="true" />
              <span>Cifras destacadas: en este modo todavía se escriben en el plan.</span>
            </p>
          )}
        </div>
      </SeccionLaminaPlegable>
      {argCapitulos && (
        <SeccionLaminaPlegable seccion="capitulos" titulo={tituloSeccionLamina(slide.tipo, "capitulos")}>
          <div className="pulso-f6-dato is-apilado" data-campo={argCapitulos.name}>
            <CapitulosHallazgos valor={payload[argCapitulos.name]} modo={modo} automatica={automatica} conTitulo={false}
              calificar={(ref) => varCalificada(ref, baseActiva, scope)} scope={scope} onCambio={(v) => set({ [argCapitulos.name]: v })}
              propuesta={MODOS_RESUMEN.has(modo) && (
                <PropuestaResumen key={slide.id} slide={slide} scope={scope} automatica={automatica} valor={payload[argCapitulos.name]} onAplicar={set} />
              )} />
          </div>
        </SeccionLaminaPlegable>
      )}
    </>
  );
}
