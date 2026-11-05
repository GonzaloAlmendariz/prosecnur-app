// «Tarjetas junto al total» en la sección «Diferencias entre grupos» del inspector (ADR 0129, propuesta P08).
//
// C1: la sección declara qué hace —las diferencias de cada grupo frente al resto, en los cruces del estudio, junto al
// gráfico del total— y su estado (`data-estado`: encendidas / apagadas). Las tarjetas mismas las calcula y dibuja el
// motor con la regla del estudio; la vista previa de la lámina es la del motor real. Encendidas, la sección dice cómo
// salen (OpcionesTarjetas). En la lámina de dos gráficos cada gráfico tiene su sección y edita la opción de su ranura.

import type { ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { usePanelDireccionable } from "../../../../lib/navegacion/paneles";
import { useSession } from "../../../../lib/SessionContext";
import { PulsoButton } from "../../../../components/PulsoButton";
import { Switch } from "../../../../components/Switch";
import { PANEL_DIFERENCIAS_REGLA } from "../../panelesGraficos";
import { useGraficosReportScope } from "../../reportScope";
import { leerSlideMeta } from "../../slideMeta";
import { usePlanStore } from "../../store";
import { OpcionesTarjetas } from "./OpcionesTarjetas";
import {
  admiteEnLinea,
  leerTarjetas,
  maxEfectivo,
  metaConTarjetas,
  opcionActiva,
  opcionAlternada,
  opcionCon,
  opcionConTodas,
  opcionTodas,
  ranuraDeTarjetas,
  TARJETAS_MAX,
  type CambiosOpcion,
} from "./modeloTarjetas";
import "./diferencias.css";

type VistaProps = {
  activas: boolean;
  onAlternar: (activas: boolean) => void;
  onAbrirRegla: () => void;
  todas?: boolean;
  onAlternarTodas?: (todas: boolean) => void;
  /** Tope en vigor (4 por defecto; 2 por gráfico en la lámina de dos). */
  max?: number;
  /** En la lámina de dos gráficos: las tarjetas van debajo de este gráfico. */
  enRanura?: boolean;
  /** Cómo salen (cruces, nombres, rótulos cortos, casos, tope); sólo con las tarjetas encendidas. */
  opciones?: ReactNode;
};

/** La sección sin store ni dirección: lo que pintan los tests. */
export function TarjetasDiferenciasVista({
  activas, onAlternar, onAbrirRegla, todas = false, onAlternarTodas, max = TARJETAS_MAX, enRanura = false, opciones,
}: VistaProps) {
  const donde = enRanura ? "debajo de este gráfico" : "junto al total";
  const tope = `Hasta ${max} ${max === 1 ? "tarjeta" : "tarjetas"}`;
  return (
    <div
      className="pulso-sig-inspector"
      data-estado={activas ? (todas ? "tarjetas_todas" : "tarjetas_encendidas") : "tarjetas_apagadas"}
      data-ranura={enRanura ? "" : undefined}
      data-qa="tarjetas-diferencias"
      data-qa-surface="graficos/f6-tarjetas-diferencias"
      data-qa-geometry-group="graficos/f6-tarjetas-diferencias"
      data-qa-geometry-contract="intrinsic"
    >
      <div className="pulso-f6-dato" data-qa-geometry-member="">
        <span className="pulso-f6-dato-rotulo">{enRanura ? "Tarjetas bajo el gráfico" : "Tarjetas junto al total"}</span>
        <Switch checked={activas} ariaLabel={`Tarjetas de diferencias ${donde}`} onToggle={() => onAlternar(!activas)} />
      </div>
      {activas && onAlternarTodas && (
        <div className="pulso-f6-dato" data-qa-geometry-member="">
          <span className="pulso-f6-dato-rotulo">Todos los grupos</span>
          <Switch checked={todas} ariaLabel="Mostrar todos los grupos aunque no difieran" onToggle={() => onAlternarTodas(!todas)} />
        </div>
      )}
      <div className="pulso-sig-cuerpo" data-qa-geometry-member="">
        <p className="pulso-sig-texto">
          {!activas
            ? `Muestra ${donde} los grupos que difieren del resto.`
            : todas
              ? `Una tarjeta por cruce con todos sus grupos; la flecha marca solo las diferencias. ${tope}.`
              : `Cada grupo frente al resto, en los cruces del estudio. ${tope}; sin diferencias, la lámina va sin ellas.`}
        </p>
      </div>
      {activas && opciones}
      <div className="pulso-sig-regla-linea" data-qa-geometry-member="">
        <span>Una sola regla para láminas, Word y tablas de cruces.</span>
        <PulsoButton variant="link" size="sm" data-pulso-abre-panel={PANEL_DIFERENCIAS_REGLA.id} onClick={onAbrirRegla}>
          Regla del estudio…
        </PulsoButton>
      </div>
    </div>
  );
}

/** La sección de un gráfico: en la lámina de un gráfico edita la opción de la lámina; en la de dos, la de su ranura. */
export function TarjetasDiferencias({ slideId, slot = "grafico" }: { slideId: string; slot?: string }) {
  const slide = usePlanStore((s) => s.plan.slides.find((x) => x.id === slideId));
  const updatePayload = usePlanStore((s) => s.updateSlidePayload);
  const reglaPanel = usePanelDireccionable(PANEL_DIFERENCIAS_REGLA);
  const scope = useGraficosReportScope(useLocation().search);
  const baseActiva = useSession().state?.active_base;
  if (!slide) return null;
  const meta = leerSlideMeta(slide);
  const ranura = ranuraDeTarjetas(slide.tipo, slot);
  const valor = leerTarjetas(meta, ranura);
  const grafico = (slide.payload as Record<string, unknown>)[slot];
  const graficador = grafico && typeof grafico === "object" && "graficador" in grafico ? String((grafico as { graficador: unknown }).graficador) : "";
  const guardar = (siguiente: ReturnType<typeof opcionAlternada>) =>
    updatePayload(slide.id, { meta: metaConTarjetas(meta, ranura, siguiente) });
  return (
    <TarjetasDiferenciasVista
      activas={opcionActiva(valor)}
      onAlternar={(activas) => guardar(opcionAlternada(valor, activas))}
      onAbrirRegla={reglaPanel.abrir}
      todas={opcionTodas(valor)}
      onAlternarTodas={(todas) => guardar(opcionConTodas(valor, todas))}
      max={maxEfectivo(valor, ranura)}
      enRanura={ranura !== null}
      opciones={
        <OpcionesTarjetas valor={valor} ranura={ranura} scope={scope} baseActiva={baseActiva} enLinea={admiteEnLinea(graficador, ranura)}
          onCambio={(cambios: CambiosOpcion) => guardar(opcionCon(valor, cambios))} />
      }
    />
  );
}
