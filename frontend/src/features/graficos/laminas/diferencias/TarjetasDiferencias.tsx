// «Tarjetas junto al total» en la sección «Diferencias entre grupos» del inspector (ADR 0129, propuesta P08).
//
// C1: la sección declara qué hace —las diferencias de cada grupo frente al resto, en los cruces del estudio, junto al
// gráfico del total— y su estado (`data-estado`: encendidas / apagadas). Las tarjetas mismas las calcula y dibuja el
// motor con la regla del estudio; la vista previa de la lámina es la del motor real.

import { usePanelDireccionable } from "../../../../lib/navegacion/paneles";
import { PulsoButton } from "../../../../components/PulsoButton";
import { Switch } from "../../../../components/Switch";
import { PANEL_DIFERENCIAS_REGLA } from "../../panelesGraficos";
import { leerSlideMeta } from "../../slideMeta";
import { usePlanStore } from "../../store";
import { TARJETAS_MAX, tarjetasActivas, tarjetasAlternadas } from "./modeloTarjetas";
import "./diferencias.css";

type VistaProps = { activas: boolean; onAlternar: (activas: boolean) => void; onAbrirRegla: () => void };

/** La sección sin store ni dirección: lo que pintan los tests. */
export function TarjetasDiferenciasVista({ activas, onAlternar, onAbrirRegla }: VistaProps) {
  return (
    <div
      className="pulso-sig-inspector"
      data-estado={activas ? "tarjetas_encendidas" : "tarjetas_apagadas"}
      data-qa="tarjetas-diferencias"
      data-qa-surface="graficos/f6-tarjetas-diferencias"
      data-qa-geometry-group="graficos/f6-tarjetas-diferencias"
      data-qa-geometry-contract="intrinsic"
    >
      <div className="pulso-f6-dato" data-qa-geometry-member="">
        <span className="pulso-f6-dato-rotulo">Tarjetas junto al total</span>
        <Switch checked={activas} ariaLabel="Tarjetas de diferencias junto al total" onToggle={() => onAlternar(!activas)} />
      </div>
      <div className="pulso-sig-cuerpo" data-qa-geometry-member="">
        <p className="pulso-sig-texto">
          {activas
            ? `Cada grupo frente al resto, en los cruces del estudio. Hasta ${TARJETAS_MAX} tarjetas; sin diferencias, la lámina va sin ellas.`
            : "Muestra al lado del total los grupos que difieren del resto."}
        </p>
      </div>
      <div className="pulso-sig-regla-linea" data-qa-geometry-member="">
        <span>Una sola regla para láminas, Word y tablas de cruces.</span>
        <PulsoButton variant="link" size="sm" data-pulso-abre-panel={PANEL_DIFERENCIAS_REGLA.id} onClick={onAbrirRegla}>
          Regla del estudio…
        </PulsoButton>
      </div>
    </div>
  );
}

export function TarjetasDiferencias({ slideId }: { slideId: string }) {
  const slide = usePlanStore((s) => s.plan.slides.find((x) => x.id === slideId));
  const updatePayload = usePlanStore((s) => s.updateSlidePayload);
  const reglaPanel = usePanelDireccionable(PANEL_DIFERENCIAS_REGLA);
  if (!slide) return null;
  const meta = leerSlideMeta(slide);
  const alternar = (activas: boolean) => {
    const siguiente: Record<string, unknown> = { ...meta };
    const valor = tarjetasAlternadas(meta, activas);
    if (valor === undefined) delete siguiente.tarjetas_diferencias;
    else siguiente.tarjetas_diferencias = valor;
    updatePayload(slide.id, { meta: siguiente });
  };
  return <TarjetasDiferenciasVista activas={tarjetasActivas(meta)} onAlternar={alternar} onAbrirRegla={reglaPanel.abrir} />;
}
