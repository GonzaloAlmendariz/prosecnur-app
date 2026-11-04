import { useEffect } from "react";
import { FileCheck2 } from "lucide-react";
import type { MonitoreoAcreditacion, MonitoreoLastSheetsPublication } from "../../../../../api/client";
import { formatoConteo } from "../../../../../lib/formatoNumero";
import { usePanelDireccionable, type PanelDeclarado } from "../../../../../lib/navegacion/paneles";
import { PulsoButton } from "../../../../../components/PulsoButton";
import { corteCorto } from "../../../core/barraComun";
import { pctConEspacio } from "../../../core/formatoComun";
import { HojaDelCliente, type TablaDelCliente } from "../../../salidas/estandar/HojaDelCliente";
import { SalidasDeMonitoreo } from "../../../salidas/estandar/SalidasDeMonitoreo";
import type { MonitoreoOutputsWorkbenchProps } from "../../../salidas/MonitoreoOutputsWorkbench";
import { useResumenDelCorte } from "../navegacion/resumenDelCorte";
import { RotuloEnBarra } from "../navegacion/rotuloDePestana";
import type { AcreditacionAdvanceCard } from "./tarjetasDeAvance";
import { DialogoCerrarCampo } from "./DialogoCerrarCampo";
import { estadoDelCierre, publicacionesFrenteAlCorte, type EstadoDelCierre } from "./salidasModelo";
import "./avance.css";
import "./salidasEntregables.css";
import "../insumos/insumos.css";
import "../insumos/reglas/reglas.css";

/** El cierre del campo es un diálogo direccionable: `panel=cerrar-campo`. */
export const PANEL_CERRAR_CAMPO: PanelDeclarado = { id: "cerrar-campo", label: "Cerrar campo", clase: "dialogo" };

/** La fila propia de acreditación en «Salidas del corte»: el cierre del campo, con lo que falta para cerrarlo. */
export function filaDelCierre(cierre: EstadoDelCierre) {
  const pendientes = cierre.puntos.filter((p) => p.estado !== "ok");
  return {
    clave: "cierre",
    titulo: "Cierre del campo",
    estado: cierre.cerrado ? `Cerrado${cierre.cierreAt ? ` el ${corteCorto(cierre.cierreAt)}` : ""}` : pendientes.length ? `${formatoConteo(pendientes.length)} ${pendientes.length === 1 ? "pendiente" : "pendientes"}` : "Listo para cerrar",
    tono: cierre.cerrado ? "success" as const : pendientes.length ? "warn" as const : "info" as const,
    detalle: cierre.puntos.map((p) => `${p.rotulo}: ${p.valor}`).join(", "),
  };
}

/**
 * La tabla de la hoja del cliente: el avance de cada público contra su meta. «Faltan» del total suma lo que falta
 * en cada público: lo que sobra en uno no cubre lo que falta en otro.
 */
export function tablaDeAcreditacionDelCliente(tarjetas: readonly AcreditacionAdvanceCard[]): TablaDelCliente | null {
  if (!tarjetas.length) return null;
  const n = (v: number | null) => (v == null ? "—" : formatoConteo(v));
  const faltan = (c: AcreditacionAdvanceCard) => (c.meta == null ? null : Math.max(0, c.meta - c.effective));
  const avance = (efectivas: number, meta: number | null) => (meta ? pctConEspacio((efectivas / meta) * 100) : "—");
  const metas = tarjetas.reduce((t, c) => t + (c.meta ?? 0), 0);
  const efectivas = tarjetas.reduce((t, c) => t + c.effective, 0);
  const faltanTotal = tarjetas.reduce((t, c) => t + (faltan(c) ?? 0), 0);
  return {
    cabecera: ["Público", "Meta", "Efectivas", "Faltan", "Avance"],
    numericas: [false, true, true, true, true],
    filas: tarjetas.map((c) => ({
      clave: c.id,
      celdas: [c.actor, n(c.meta), <b key="e">{n(c.effective)}</b>, n(faltan(c)), avance(c.effective, c.meta)],
    })),
    total: ["Total", n(metas), n(efectivas), n(faltanTotal), avance(efectivas, metas)],
  };
}

/**
 * Avance › Salidas de acreditación sobre el estándar de Salidas (4 nov 2026): el cierre del campo es la primera
 * fila de la lista, con su diálogo (`panel=cerrar-campo`); la hoja del cliente lleva el avance por público y el
 * motor completo queda en «PDF y cliente».
 */
export function Salidas({
  corte,
  clienteSheets,
  internoSheets,
  acreditacion,
  guardando,
  error,
  onCerrarCampo,
  motor,
  encabezado,
}: {
  corte: string | null;
  clienteSheets: MonitoreoLastSheetsPublication | null | undefined;
  internoSheets: MonitoreoLastSheetsPublication | null | undefined;
  acreditacion: MonitoreoAcreditacion | null | undefined;
  guardando: boolean;
  error?: string | null;
  onCerrarCampo?: (planDeRefuerzo: string, aprobacion: boolean) => Promise<void>;
  motor: MonitoreoOutputsWorkbenchProps;
  /** El nombre del estudio en la hoja del cliente. */
  encabezado: string;
}) {
  const avance = useResumenDelCorte((estado) => estado.avance);
  const casos = useResumenDelCorte((estado) => estado.casos);
  const panel = usePanelDireccionable(PANEL_CERRAR_CAMPO);
  const publicaciones = publicacionesFrenteAlCorte(corte, clienteSheets, internoSheets);
  const cierre = estadoDelCierre({ tarjetas: avance?.tarjetas ?? [], esperan: casos?.esperan ?? null, publicaciones, acreditacion });
  // Cerrado el campo, el diálogo ya no tiene nada que confirmar: sale de la dirección.
  const { abierto, cerrar } = panel;
  useEffect(() => {
    if (cierre.cerrado && abierto) cerrar();
  }, [cierre.cerrado, abierto, cerrar]);
  const accionDeCierre = cierre.cerrado || !onCerrarCampo ? undefined : (
    <PulsoButton variant="primary" size="sm" onClick={panel.abrir}><FileCheck2 size={14} aria-hidden="true" /> Cerrar campo</PulsoButton>
  );
  return (
    <>
      <SalidasDeMonitoreo
        {...motor}
        rotulo={<RotuloEnBarra />}
        filasPropias={[{ ...filaDelCierre(cierre), accion: accionDeCierre }]}
        vistaPrevia={(
          <HojaDelCliente
            encabezado={encabezado}
            corte={corte ? corteCorto(corte) : ""}
            titulo="Avance por público"
            tabla={tablaDeAcreditacionDelCliente(avance?.tarjetas ?? [])}
            vacio="El corte todavía no trae el avance por público."
          />
        )}
      />
      {panel.abierto && onCerrarCampo && !cierre.cerrado ? (
        <DialogoCerrarCampo
          cierre={cierre}
          planInicial={acreditacion?.plan_refuerzo ?? ""}
          aprobacionInicial={Boolean(acreditacion?.aprobacion_metodologica)}
          guardando={guardando}
          error={error}
          onCerrar={panel.cerrar}
          panelId={PANEL_CERRAR_CAMPO.id}
          onCerrarCampo={(plan, aprobacion) => { void onCerrarCampo(plan, aprobacion); }}
        />
      ) : null}
    </>
  );
}
