// Ajustes de «Hallazgos clave» (`p_slide_hallazgos`) en Inspector › Lámina: el modo y, en el resumen ejecutivo, la
// selección, los topes, «También», los cruces con su nombre y los rótulos cortos de sus grupos, y los capítulos. Se
// pintan los argumentos del registro que no son texto (los textos van en «Textos»), en su orden y según su `depende`.
// Cada cambio es un `updateSlidePayload`.

import { useId } from "react";
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
import "../datosGrafico.css";
import "./hallazgos.css";

export { ajustesQueAplican, valorEfectivo };

export function AjustesHallazgos({ slide, args }: { slide: Slide; args: readonly ArgMetadata[] }) {
  const idTitulo = useId();
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

  return (
    <section className="pulso-f6-especial pulso-f6-hallazgos-ajustes" aria-labelledby={idTitulo}
      data-qa-geometry-group="graficos/f6-hallazgos-ajustes" data-qa-geometry-contract="intrinsic">
      <h3 id={idTitulo} className="pulso-f6-subtitulo">Hallazgos</h3>
      <div className="pulso-f6-datos" data-qa-geometry-group="graficos/f6-hallazgos-datos" data-qa-geometry-contract="intrinsic">
        {ajustesQueAplican(args, payload).map((a) => {
          if (a.name === "publico") return null;
          if (a.name === "cruces") {
            return (
              <CrucesLamina key={a.name} payload={payload} scope={scope} baseActiva={baseActiva} onParche={set}
                ayudaVacia="Sin elegir, compara como las tarjetas del informe o por los cruces del estudio."
                conPublico={tienePublico} />
            );
          }
          if (a.tipo_input === "hallazgos_capitulos") {
            return (
              <div key={a.name} className="pulso-f6-dato is-apilado" data-campo={a.name}>
                <CapitulosHallazgos valor={payload[a.name]} modo={modo} automatica={automatica}
                  calificar={(ref) => varCalificada(ref, baseActiva, scope)} scope={scope} onCambio={(v) => set({ [a.name]: v })}
                  propuesta={MODOS_RESUMEN.has(modo) && (
                    <PropuestaResumen key={slide.id} slide={slide} scope={scope} automatica={automatica} valor={payload[a.name]} onAplicar={set} />
                  )} />
              </div>
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
    </section>
  );
}
