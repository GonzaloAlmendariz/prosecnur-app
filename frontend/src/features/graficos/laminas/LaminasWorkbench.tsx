// Pestaña Láminas de Procesamiento › Gráficos (F6.1, parte 1): Estructura · Visor · Inspector.
// Dirección: `/graficos?pestana=laminas&foco=l-07[:g2]&panel=inspector`. `foco` es la fuente de verdad de la lámina
// seleccionada; se refleja en `usePlanStore.select` para que el Editor anterior abra en la misma lámina.

import { useCallback, useEffect, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useSession } from "../../../lib/SessionContext";
import { conNivel } from "../../../lib/navegacion/direccion";
import { useSeccion } from "../../../lib/navegacion/useDireccion";
import { usePanelDireccionable } from "../../../lib/navegacion/paneles";
import { PANEL_INSPECTOR_LAMINA } from "../panelesGraficos";
import { parseGraficosReportScope } from "../reportScope";
import { leerSlideMeta } from "../slideMeta";
import { usePlanStore } from "../store";
import { usePlanValidator } from "../usePlanValidator";
import { EstructuraInforme, type MarcaValidacion } from "./EstructuraInforme";
import { InspectorLamina } from "./InspectorLamina";
import { VisorLamina } from "./VisorLamina";
import { TiraMiniaturas } from "./TiraMiniaturas";
import { construirEstructura, focoDeLamina, parsearFocoLamina } from "./modeloEstructura";
import { useLaminasUi } from "./laminasStore";
import { usePreviewLamina } from "./usePreviewLamina";
import "./laminasWorkbench.css";

type Props = {
  /** Lleva a la pestaña del editor anterior conservando la lámina. */
  onIrEditorAnterior: () => void;
};

export function LaminasWorkbench({ onIrEditorAnterior }: Props) {
  const { state } = useSession();
  const location = useLocation();
  const navigate = useNavigate();
  const slides = usePlanStore((s) => s.plan.slides);
  const selectedSlideId = usePlanStore((s) => s.selectedSlideId);
  const select = usePlanStore((s) => s.select);
  const { issues } = usePlanValidator();
  const inspector = usePanelDireccionable(PANEL_INSPECTOR_LAMINA);
  const parte = useLaminasUi((s) => s.parte);
  const setParte = useLaminasUi((s) => s.setParte);
  const setSeccion = useLaminasUi((s) => s.setSeccionInspector);
  const estructuraVisible = useLaminasUi((s) => s.estructuraVisible);

  const estructura = useMemo(() => construirEstructura(slides), [slides]);
  const direccion = useSeccion("procesamiento");
  const foco = useMemo(() => parsearFocoLamina(direccion.foco), [direccion.foco]);
  const total = estructura.laminas.length;
  const posicionSeleccionada = useMemo(() => {
    if (foco && foco.posicion <= total) return foco.posicion;
    const porStore = estructura.laminas.find((l) => l.id === selectedSlideId);
    return porStore?.posicion ?? (total > 0 ? 1 : null);
  }, [foco, total, estructura, selectedSlideId]);
  const lamina = posicionSeleccionada ? estructura.laminas[posicionSeleccionada - 1] : null;
  const slide = lamina ? slides[lamina.posicion - 1] ?? null : null;
  const ranura = foco && foco.posicion === posicionSeleccionada ? foco.ranura : null;

  const escribirFoco = useCallback((valor: string | null) => {
    navigate({ pathname: location.pathname, search: conNivel(location.search, "foco", valor) }, { replace: true });
  }, [location.pathname, location.search, navigate]);

  // La URL siempre dice qué lámina se ve: sin `foco` (o uno fuera de rango) se escribe el resuelto.
  useEffect(() => {
    if (!posicionSeleccionada) return;
    if (!foco || foco.posicion !== posicionSeleccionada) escribirFoco(focoDeLamina(posicionSeleccionada));
  }, [foco, posicionSeleccionada, escribirFoco]);

  // El editor anterior abre en la misma lámina.
  useEffect(() => {
    if (slide && slide.id !== selectedSlideId) select(slide.id);
  }, [slide, selectedSlideId, select]);

  // Cada lámina empieza en su primera parte.
  useEffect(() => { setParte(1); }, [slide?.id, setParte]);

  const irA = useCallback((posicion: number) => {
    if (posicion < 1 || posicion > total) return;
    escribirFoco(focoDeLamina(posicion));
  }, [escribirFoco, total]);

  const prepOk = !!state?.analitica_prep_ok || parseGraficosReportScope(location.search) === "consolidated";
  const vista = usePreviewLamina(slide, lamina?.antetituloHeredado ?? null, prepOk);

  const validacion = useMemo(() => {
    const m: Record<string, MarcaValidacion> = {};
    for (const i of issues) {
      if (!i.slideId) continue;
      if (i.severity === "error") m[i.slideId] = "error";
      else if (!m[i.slideId]) m[i.slideId] = "warning";
    }
    return m;
  }, [issues]);

  if (!lamina || !slide) {
    return (
      <div className="pulso-f6-laminas-host">
      <div className="pulso-f6-laminas is-vacia" data-qa-surface="graficos/f6-laminas">
        <EstructuraInforme estructura={estructura} posicionActiva={null} onSeleccionar={irA} validacion={validacion} />
        <div className="pulso-f6-vacio-informe" role="status">
          <strong>El informe todavía no tiene láminas</strong>
          <p>Arma el plan desde el Editor anterior o con un plan sugerido; aquí verás cada lámina tal como sale.</p>
          <button type="button" className="pulso-f6-boton" onClick={onIrEditorAnterior}>Ir al Editor anterior</button>
        </div>
      </div>
      </div>
    );
  }

  return (
    <div className="pulso-f6-laminas-host">
    <div
      className={`pulso-f6-laminas${inspector.abierto ? " is-inspector-abierto" : ""}${estructuraVisible ? "" : " is-sin-estructura"}`}
      data-qa-surface="graficos/f6-laminas"
    >
      <EstructuraInforme
        estructura={estructura}
        posicionActiva={posicionSeleccionada}
        onSeleccionar={irA}
        validacion={validacion}
      />
      <VisorLamina
        lamina={lamina}
        total={total}
        vista={vista}
        prepOk={prepOk}
        parte={parte}
        onParte={setParte}
        onIr={irA}
        motorNativoApagado={leerSlideMeta(slide).motor_nativo === false}
        onAbrirAjustes={inspector.alternar}
        ajustesAbiertos={inspector.abierto}
        onVerAvisos={() => { setSeccion("estado"); if (!inspector.abierto) inspector.abrir(); }}
        tira={<TiraMiniaturas estructura={estructura} posicionActiva={lamina.posicion} onIr={irA} />}
      />
      <div className="pulso-f6-inspector-marco" {...inspector.props} onKeyDown={(e) => { if (e.key === "Escape" && inspector.abierto) inspector.cerrar(); }}>
        <InspectorLamina
          slide={slide}
          lamina={lamina}
          ranura={ranura}
          onRanura={(r) => escribirFoco(focoDeLamina(lamina.posicion, r))}
          visor={vista.lamina}
          onCerrar={inspector.cerrar}
          onIrEditorAnterior={onIrEditorAnterior}
        />
      </div>
      {inspector.abierto && (
        <button type="button" className="pulso-f6-velo pulso-f6-solo-compacto" aria-label="Cerrar ajustes" tabIndex={-1} onClick={inspector.cerrar} />
      )}
    </div>
    </div>
  );
}
