// U4 · «Diferencias del informe» (`?panel=diferencias`, sideover; propuesta de significancia §3.5). Revisión en lote de
// las láminas con cruce desde GET /api/graficos/diferencias/informe: resumen arriba, filtro «Para revisar» (frágiles con
// títulos que afirman, cruces sin diferencias, diferencias bajo el umbral, bases chicas, pruebas no ejecutadas) y una
// fila por lámina que lleva a ella. Como Avisos, no es modal: la lámina elegida se ve al lado. «Exportar revisión»
// arma el CSV en el cliente.

import { useCallback, useEffect, useMemo, useRef } from "react";
import { Download, RotateCcw, X } from "../../../../vendor/lucide-react";
import type { ControlPanel } from "../../../../lib/navegacion/paneles";
import type { LaminaDiferencias } from "../../../../api/graficosDiferencias";
import { PulsoTable, type PulsoTableColumna } from "../../../../components/PulsoTable";
import { PulsoButton } from "../../../../components/PulsoButton";
import { Skeleton } from "../../../../components/Skeleton";
import { formatoConteo } from "../../../../lib/formatoNumero";
import { usePanelDireccionable } from "../../../../lib/navegacion/paneles";
import { PANEL_DIFERENCIAS_REGLA } from "../../panelesGraficos";
import { Segmentado } from "../../subpestanas/Segmentado";
import { capaVisibleFuera, destinoDelFoco, escucharEscape } from "../cierreConEscape";
import { enfocarSinDesplazar } from "../enfocarSinDesplazar";
import type { EstructuraInforme } from "../modeloEstructura";
import { Capsula } from "./Capsula";
import {
  csvRevision,
  estadoRevision,
  filtrarRevision,
  OPCIONES_FILTRO,
  queRevisar,
  resumenRegla,
  type FilaRevision,
  type FiltroRevision,
} from "./modeloDiferencias";
import { useDiferenciasUi } from "./store";
import { useDiferenciasInforme } from "./useDiferencias";
import "./diferencias.css";

type Props = {
  panel: ControlPanel;
  estructura: EstructuraInforme;
  /** La lámina a la vista (`foco`): su fila queda elegida. */
  slideIdActual: string | null;
  onIr: (posicion: number) => void;
};

export function RevisionDiferenciasPanel({ panel, estructura, slideIdActual, onIr }: Props) {
  const { carga, reintentar } = useDiferenciasInforme(true);
  const filtro = useDiferenciasUi((s) => s.filtro);
  const setFiltro = useDiferenciasUi((s) => s.setFiltro);
  const regla = usePanelDireccionable(PANEL_DIFERENCIAS_REGLA);
  const raizRef = useRef<HTMLElement>(null);
  const disparadorRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const activo = document.activeElement;
    disparadorRef.current = activo instanceof HTMLElement && activo !== document.body ? activo : null;
  }, []);
  const cerrarPanel = panel.cerrar;
  const cerrar = useCallback(() => {
    cerrarPanel();
    requestAnimationFrame(() => enfocarSinDesplazar(destinoDelFoco(disparadorRef.current, document.querySelector<HTMLElement>(".pulso-f6-mas > button"))));
  }, [cerrarPanel]);
  useEffect(() => escucharEscape(document, cerrar, () => capaVisibleFuera(document, raizRef.current)), [cerrar]);

  const datos = carga && carga.estado !== "error" ? carga.datos : undefined;
  const porId = useMemo(() => new Map(estructura.laminas.map((l) => [l.id, l])), [estructura]);
  const filas: FilaRevision[] = useMemo(() => filtrarRevision(datos?.laminas ?? [], filtro).map((lamina) => {
    const enPlan = porId.get(lamina.slide_id);
    return { lamina, posicion: enPlan?.posicion ?? null, titulo: lamina.titulo || enPlan?.titulo || lamina.slide_id };
  }), [datos, filtro, porId]);

  const exportar = () => {
    if (!datos) return;
    const todas = datos.laminas.map((lamina) => {
      const enPlan = porId.get(lamina.slide_id);
      return { lamina, posicion: enPlan?.posicion ?? null, titulo: lamina.titulo || enPlan?.titulo || lamina.slide_id };
    });
    descargarCsv(csvRevision(todas), "diferencias-del-informe.csv");
  };

  const r = datos?.resumen;
  return (
    <aside
      ref={raizRef}
      className="pulso-sig-revision"
      aria-label="Diferencias del informe"
      {...panel.props}
      data-audit-ready={datos || carga?.estado === "error" ? "graficos-diferencias-informe" : "false"}
      data-qa-surface="graficos/diferencias-informe"
      data-qa-geometry-group="graficos/diferencias-informe"
      data-qa-geometry-contract="intrinsic"
    >
      <header className="pulso-f6-col-head" data-qa-geometry-member="">
        <h2>Diferencias del informe</h2>
        <span className="pulso-f6-col-sp" />
        <PulsoButton variant="secondary" size="sm" onClick={exportar} disabled={!datos || datos.laminas.length === 0}>
          <Download size={14} aria-hidden="true" /> Exportar revisión
        </PulsoButton>
        <PulsoButton variant="icon" size="sm" aria-label="Cerrar diferencias del informe" onClick={cerrar}>
          <X size={16} aria-hidden="true" />
        </PulsoButton>
      </header>
      <div className="pulso-sig-revision-cuerpo" data-qa-geometry-member="" data-qa-scroll-owner="diferencias-informe">
        {carga?.estado === "error" ? (
          <div className="pulso-sig-caja is-peligro" role="alert">
            <strong className="pulso-sig-titulo">No se pudo revisar el informe</strong>
            <p className="pulso-sig-texto">{carga.message}{carga.code ? <> · <code>{carga.code}</code></> : null}{carga.error_id ? <> · id <code>{carga.error_id}</code></> : null}</p>
            <div className="pulso-sig-acciones">
              <PulsoButton variant="secondary" size="sm" onClick={reintentar}><RotateCcw size={14} aria-hidden="true" /> Reintentar</PulsoButton>
            </div>
          </div>
        ) : !datos || !r ? (
          <div className="pulso-sig-chips" role="status" aria-label="Revisando las láminas con cruce">
            <Skeleton forma="texto" ancho={84} alto={24} />
            <Skeleton forma="texto" ancho={100} alto={24} />
            <Skeleton forma="texto" ancho={84} alto={24} />
          </div>
        ) : (
          <>
            <ul className="pulso-sig-chips" aria-label="Resumen del informe">
              <li className="pulso-sig-chip">{r.cruces === 1 ? "1 cruce" : `${formatoConteo(r.cruces)} cruces`}</li>
              <li className="pulso-sig-chip is-marcada"><Capsula letras="" decorativa /> {r.marcadas === 1 ? "1 marcada" : `${formatoConteo(r.marcadas)} marcadas`}</li>
              <li className="pulso-sig-chip is-fragil">{r.fragiles === 1 ? "1 frágil" : `${formatoConteo(r.fragiles)} frágiles`}</li>
              <li className="pulso-sig-chip">{formatoConteo(r.ninguna)} sin diferencias</li>
              {r.bases_chicas > 0 && <li className="pulso-sig-chip is-aviso">{r.bases_chicas === 1 ? "1 base chica" : `${formatoConteo(r.bases_chicas)} bases chicas`}</li>}
              {r.sin_prueba > 0 && <li className="pulso-sig-chip is-peligro">{formatoConteo(r.sin_prueba)} sin prueba</li>}
            </ul>
            <div className="pulso-sig-revision-barra">
              <Segmentado<FiltroRevision> etiqueta="Qué láminas mostrar" valor={filtro} opciones={OPCIONES_FILTRO} onCambiar={setFiltro} />
              <span className="pulso-sig-espacio" />
              <PulsoButton variant="link" size="sm" data-pulso-abre-panel={PANEL_DIFERENCIAS_REGLA.id} onClick={regla.abrir}
                title={`${resumenRegla(datos.regla)}${r.familia ? ` · familia de ${formatoConteo(r.familia)} comparaciones` : ""}`}>
                {resumenRegla(datos.regla)}
              </PulsoButton>
            </div>
            <TablaRevision filas={filas} filtro={filtro} slideIdActual={slideIdActual} onIr={onIr} />
          </>
        )}
      </div>
    </aside>
  );
}

const VACIO: Readonly<Record<FiltroRevision, string>> = {
  todas: "El informe no tiene láminas con cruce.",
  revisar: "Nada para revisar: ninguna lámina con cruce tiene avisos.",
  marcadas: "Ninguna lámina con cruce tiene diferencias marcadas.",
};

function TablaRevision({ filas, filtro, slideIdActual, onIr }: {
  filas: FilaRevision[]; filtro: FiltroRevision; slideIdActual: string | null; onIr: (posicion: number) => void;
}) {
  const columnas: PulsoTableColumna<FilaRevision>[] = [
    { id: "lamina", encabezado: "Lám.", ancho: 52, tipo: "cifra", celda: (f) => f.posicion ?? "—", valor: (f) => f.posicion },
    { id: "cruce", encabezado: "Cruce", ancho: 190, celda: (f) => textoCruce(f), valor: (f) => textoCruce(f) },
    { id: "estado", encabezado: "Estado", ancho: 140, celda: (f) => <EstadoChip lamina={f.lamina} /> },
    { id: "revisar", encabezado: "Qué revisar", ancho: 196, celda: (f) => queRevisar(f.lamina).join(" · ") || "—", valor: (f) => queRevisar(f.lamina).join(" · ") },
  ];
  const porId = new Map(filas.map((f) => [f.lamina.slide_id, f]));
  return (
    <PulsoTable columnas={columnas} filas={filas} idDeFila={(f) => f.lamina.slide_id} ariaLabel="Láminas con cruce" densidad="comoda"
      seleccionada={slideIdActual} altoMaximo={2000} vacio={VACIO[filtro]}
      onSeleccionar={(id) => { const p = porId.get(id)?.posicion; if (p) onIr(p); }} />
  );
}

function textoCruce(f: FilaRevision): string {
  return [f.titulo, f.lamina.cruce].filter(Boolean).join(" · ");
}

function EstadoChip({ lamina }: { lamina: LaminaDiferencias }) {
  const e = estadoRevision(lamina);
  return (
    <span className={`pulso-sig-chip is-${e.tono}`}>
      {(e.tono === "marcada" || e.tono === "fragil") && <Capsula letras="" fragil={e.tono === "fragil"} decorativa />} {e.rotulo}
    </span>
  );
}

/** El CSV con la marca UTF-8 para que Excel lea las tildes. */
function descargarCsv(contenido: string, nombre: string) {
  const url = URL.createObjectURL(new Blob([`﻿${contenido}`], { type: "text/csv;charset=utf-8" }));
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = nombre;
  enlace.click();
  URL.revokeObjectURL(url);
}
