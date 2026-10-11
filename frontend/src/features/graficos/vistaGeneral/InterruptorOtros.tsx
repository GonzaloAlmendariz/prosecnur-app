// Interruptor «Láminas de «Otros» en el PowerPoint» de la barra de Vista general (contrato A5 2b). Lee y escribe el
// store (`autoOtrosSlides`, un paso deshacible); encendido muestra el chip «+ Otros al exportar» al lado, en el mismo
// grupo, para que el marco de la barra no salte (C2).

import { useId } from "react";
import { useLocation } from "react-router-dom";
import { Switch } from "../../../components/Switch";
import { useSession } from "../../../lib/SessionContext";
import { modoMultibaseDelPlan } from "../modoMultibase";
import { useGraficosReportScope } from "../reportScope";
import { usePlanStore } from "../store";
import { ayudaOtros, CHIP_OTROS, ROTULO_OTROS } from "./interruptorOtros";

export function InterruptorOtros() {
  const { state } = useSession();
  const scope = useGraficosReportScope(useLocation().search);
  const encendido = usePlanStore((s) => s.autoOtrosSlides);
  const setAutoOtrosSlides = usePlanStore((s) => s.setAutoOtrosSlides);
  const ayuda = ayudaOtros(modoMultibaseDelPlan(state?.estudio_processing_mode, state?.n_bases, state?.active_base, scope));
  return <InterruptorOtrosVista encendido={encendido} ayuda={ayuda} onCambiar={setAutoOtrosSlides} />;
}

/** Presentación pura del interruptor (se prueba sin store). */
export function InterruptorOtrosVista({ encendido, ayuda, onCambiar }: {
  encendido: boolean;
  ayuda: string;
  onCambiar: (valor: boolean) => void;
}) {
  const id = useId();
  return (
    <span className="pulso-f6-vg-otros" role="group" aria-labelledby={`${id}-rotulo`} aria-describedby={`${id}-ayuda`}
      data-qa-geometry-member title={ayuda}>
      <Switch id={`${id}-sw`} checked={encendido} onToggle={() => onCambiar(!encendido)} ariaLabel={ROTULO_OTROS} />
      <label id={`${id}-rotulo`} htmlFor={`${id}-sw`} className="pulso-f6-vg-otros-rotulo">{ROTULO_OTROS}</label>
      <span id={`${id}-ayuda`} className="pulso-sr-only">{ayuda}</span>
      {encendido && <span className="pulso-f6-vg-otros-chip">{CHIP_OTROS}</span>}
    </span>
  );
}
