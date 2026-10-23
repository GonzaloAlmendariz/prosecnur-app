import { useMemo } from "react";
import type { ReactNode } from "react";
import { usePanelDireccionable, type PanelDeclarado } from "../../../lib/navegacion/paneles";
import { useFocoMonitoreo } from "../useMonitoreoDireccion";
import { escalaDeIntentos, filtrarCola, type CasoDeCola, type ResponsableDeCola } from "./colaDeInsistenciaModel";
import { useFiltrosDeCola } from "./colaDeInsistenciaStore";
import { FichaDelCaso } from "./colaDeInsistencia/FichaDelCaso";
import { FiltrosDeCola } from "./colaDeInsistencia/FiltrosDeCola";
import { ResponsablesDeCola } from "./colaDeInsistencia/ResponsablesDeCola";
import { TablaDeCola, type ColumnasDeCola } from "./colaDeInsistencia/TablaDeCola";
import "./colaDeInsistencia/colaDeInsistencia.css";

/** La ficha del caso es un panel direccionable: `panel=caso&foco=<código>`. */
export const PANEL_CASO: PanelDeclarado = { id: "caso", label: "Ficha del caso", clase: "inspector" };

function unicos(valores: readonly string[]) {
  return [...new Set(valores.filter(Boolean))].sort((a, b) => a.localeCompare(b, "es", { numeric: true }));
}

/**
 * Cola de insistencia, común a los modos que tienen barrido telefónico.
 *
 * Tres columnas: responsables (con «Sin asignar» aparte), la cola caso por
 * caso y la ficha del caso. Las columnas propias de un estudio (teléfono en
 * uso, origen) aparecen sólo si la hoja las trae. No hay acciones: Monitoreo
 * lee la hoja del equipo; reasignar o dejar de insistir se hace allá.
 */
export function ColaDeInsistencia({
  casos,
  responsables,
  columnas,
  reparto,
  corte,
  bajoLosResponsables,
}: {
  casos: readonly CasoDeCola[];
  responsables: readonly ResponsableDeCola[];
  columnas: ColumnasDeCola;
  reparto: { porLlamarAsignados: number; repartidos: number | null; equipo: number };
  /** Fecha del corte, corta («27/07»). */
  corte: string;
  /** Panel condicional bajo la lista de responsables (teléfonos por caso). */
  bajoLosResponsables?: ReactNode;
}) {
  const filtros = useFiltrosDeCola((estado) => estado.filtros);
  const panel = usePanelDireccionable(PANEL_CASO);
  const [foco, escribirFoco] = useFocoMonitoreo();
  const visibles = useMemo(() => filtrarCola(casos, filtros), [casos, filtros]);
  // Con la ficha cerrada, la columna de la derecha muestra el primer caso de
  // la cola a la vista: es la ficha implícita. Sólo un caso ELEGIDO es
  // dirección; en ventana angosta la ficha es un panel y se abre al elegir.
  const elegido = (panel.abierto && foco ? casos.find((caso) => caso.codigo === foco) : null) ?? null;
  const enFicha = elegido ?? visibles[0] ?? null;
  const titulo = filtros.responsable ? `Cola de ${filtros.responsable}` : "Cola";

  return (
    <div className="mon-cola" data-ficha-abierta={elegido ? "true" : "false"}>
      <FiltrosDeCola
        responsables={unicos(casos.map((caso) => caso.responsable))}
        resultados={unicos(casos.map((caso) => caso.status))}
        cuotas={unicos(casos.map((caso) => caso.cuota))}
        etiquetaCuota={columnas.categoria}
      />
      <div className="mon-cola-cuerpo" data-qa-geometry-group="telefonico-control-insistencia" data-qa-geometry-contract="intrinsic">
        <div className="mon-cola-izquierda">
          <ResponsablesDeCola responsables={responsables} reparto={reparto} />
          {bajoLosResponsables}
        </div>
        <section className="mon-cola-panel mon-cola-centro" aria-label="Casos por rellamar, con lo que registra la hoja">
          <header className="mon-cola-centro-cabecera">
            <b>{titulo}</b>
            <span>{escalaDeIntentos(visibles)}</span>
          </header>
          <TablaDeCola
            casos={visibles}
            columnas={columnas}
            elegido={enFicha?.codigo ?? null}
            onElegir={(codigo) => escribirFoco(codigo, { panel: PANEL_CASO.id })}
          />
          <footer className="mon-cola-centro-pie">
            {visibles.length.toLocaleString("es-PE")} de {casos.length.toLocaleString("es-PE")} casos en la cola
          </footer>
        </section>
        <FichaDelCaso
          caso={enFicha}
          etiquetaCategoria={columnas.categoria}
          corte={corte}
          cerrable={Boolean(elegido)}
          onCerrar={() => escribirFoco(null, { panel: null })}
          panelProps={panel.props}
        />
      </div>
    </div>
  );
}
