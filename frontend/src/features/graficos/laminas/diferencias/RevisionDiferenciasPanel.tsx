// U4 · «Diferencias del informe» (`?panel=diferencias`, sideover; propuesta de significancia §3.5). Revisión en lote de
// las láminas con cruce desde GET /api/graficos/diferencias/informe: resumen arriba, filtro «Para revisar» (frágiles con
// títulos que afirman, cruces sin diferencias, diferencias bajo el umbral, bases chicas, pruebas no ejecutadas) y una
// fila por ranura con cruce (ADR 0128 «Familia por base»: una lámina de cuatro gráficos tiene hasta cuatro) que lleva a
// su lámina; los conteos de arriba son los del `resumen`, que el backend cuenta por ranura. Como Avisos, no es modal: la lámina elegida se ve al lado. «Exportar revisión»
// arma el CSV en el cliente.

import { useCallback, useEffect, useMemo, useRef } from "react";
import { Download, RotateCcw } from "../../../../vendor/lucide-react";
import type { ControlPanel } from "../../../../lib/navegacion/paneles";
import type { ResultadoDiferencias } from "../../../../api/graficosDiferencias";
import { PulsoTable, type PulsoTableColumna } from "../../../../components/PulsoTable";
import { PulsoButton } from "../../../../components/PulsoButton";
import { CabeceraPanel } from "../../../../components/CabeceraPanel";
import { Skeleton } from "../../../../components/Skeleton";
import { formatoConteo } from "../../../../lib/formatoNumero";
import { usePanelDireccionable } from "../../../../lib/navegacion/paneles";
import { PANEL_DIFERENCIAS_REGLA } from "../../panelesGraficos";
import { RadioSegmentado } from "../../subpestanas/RadioSegmentado";
import { capaVisibleFuera, destinoDelFoco, escucharEscape } from "../cierreConEscape";
import { enfocarSinDesplazar } from "../enfocarSinDesplazar";
import type { EstructuraInforme } from "../modeloEstructura";
import { CajaDiferencias } from "./CajaDiferencias";
import { CodigoError } from "./CodigoError";
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
import { filasPorRanura } from "./modeloRanuras";
import { useDiferenciasUi } from "./store";
import { useDiferenciasInforme, useNombreDeGrafico } from "./useDiferencias";
import "./diferencias.css";
import "./ranurasDiferencias.css";

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
  const nombreDe = useNombreDeGrafico();
  const porId = useMemo(() => new Map(estructura.laminas.map((l) => [l.id, l])), [estructura]);
  const todas: FilaRevision[] = useMemo(
    () => filasPorRanura(datos?.laminas ?? [], nombreDe, (id) => porId.get(id)),
    [datos, nombreDe, porId],
  );
  const filas: FilaRevision[] = useMemo(() => {
    const visibles = new Set(filtrarRevision(todas.map((f) => f.lamina), filtro));
    return todas.filter((f) => visibles.has(f.lamina));
  }, [todas, filtro]);

  const exportar = () => {
    if (!datos) return;
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
      <header data-qa-geometry-member="">
        <CabeceraPanel titulo="Diferencias del informe" onCerrar={cerrar} etiquetaCerrar="Cerrar diferencias del informe"
          acciones={(
            <PulsoButton variant="secondary" size="sm" onClick={exportar} disabled={todas.length === 0}>
              <Download size={14} aria-hidden="true" /> Exportar revisión
            </PulsoButton>
          )} />
      </header>
      <div className="pulso-sig-revision-cuerpo" data-qa-geometry-member="" data-qa-scroll-owner="diferencias-informe" data-qa-geometry-capacity="owned">
        {carga?.estado === "error" ? (
          <CajaDiferencias tono="peligro" role="alert">
            <strong className="pulso-sig-titulo">No se pudo revisar el informe</strong>
            <p className="pulso-sig-texto">{carga.message}<CodigoError code={carga.code} errorId={carga.error_id} /></p>
            <div className="pulso-sig-acciones">
              <PulsoButton variant="secondary" size="sm" onClick={reintentar}><RotateCcw size={14} aria-hidden="true" /> Reintentar</PulsoButton>
            </div>
          </CajaDiferencias>
        ) : !datos || !r ? (
          <div className="pulso-sig-chips" role="status" aria-label="Revisando las láminas con cruce">
            <Skeleton forma="texto" ancho={84} alto={24} />
            <Skeleton forma="texto" ancho={100} alto={24} />
            <Skeleton forma="texto" ancho={84} alto={24} />
          </div>
        ) : (
          <>
            {/* Las pastillas miden 24 px y centran su rótulo, como un control: ese alto es suyo, no capacidad sin usar. */}
            <ul className="pulso-sig-chips" aria-label="Resumen del informe" data-qa-geometry-group="graficos/diferencias-informe-resumen" data-qa-geometry-contract="intrinsic">
              <li data-qa-geometry-member="" data-qa-geometry-capacity="owned" className="pulso-sig-chip">{r.cruces === 1 ? "1 cruce" : `${formatoConteo(r.cruces)} cruces`}</li>
              <li data-qa-geometry-member="" data-qa-geometry-capacity="owned" className="pulso-sig-chip is-marcada"><Capsula letras="" decorativa /> {r.marcadas === 1 ? "1 marcada" : `${formatoConteo(r.marcadas)} marcadas`}</li>
              <li data-qa-geometry-member="" data-qa-geometry-capacity="owned" className="pulso-sig-chip is-fragil">{r.fragiles === 1 ? "1 frágil" : `${formatoConteo(r.fragiles)} frágiles`}</li>
              <li data-qa-geometry-member="" data-qa-geometry-capacity="owned" className="pulso-sig-chip">{formatoConteo(r.ninguna)} sin diferencias</li>
              {r.bases_chicas > 0 && <li data-qa-geometry-member="" data-qa-geometry-capacity="owned" className="pulso-sig-chip is-aviso">{r.bases_chicas === 1 ? "1 base chica" : `${formatoConteo(r.bases_chicas)} bases chicas`}</li>}
              {r.sin_prueba > 0 && <li data-qa-geometry-member="" data-qa-geometry-capacity="owned" className="pulso-sig-chip is-peligro">{formatoConteo(r.sin_prueba)} sin prueba</li>}
            </ul>
            <div className="pulso-sig-revision-barra">
              <RadioSegmentado<FiltroRevision> etiqueta="Qué gráficos mostrar" valor={filtro} opciones={OPCIONES_FILTRO} onCambiar={setFiltro} />
              <span className="pulso-sig-espacio" />
              <PulsoButton variant="link" size="sm" data-pulso-abre-panel={PANEL_DIFERENCIAS_REGLA.id} onClick={regla.abrir}
                title={`${resumenRegla(datos.regla)}${r.familia ? ` (familia de ${formatoConteo(r.familia)} comparaciones)` : ""}`}>
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
  todas: "El informe no tiene gráficos con cruce.",
  revisar: "Nada para revisar: ningún gráfico con cruce tiene avisos.",
  marcadas: "Ningún gráfico con cruce tiene diferencias marcadas.",
};

function TablaRevision({ filas, filtro, slideIdActual, onIr }: {
  filas: FilaRevision[]; filtro: FiltroRevision; slideIdActual: string | null; onIr: (posicion: number) => void;
}) {
  const columnas: PulsoTableColumna<FilaRevision>[] = [
    // R15: el marco de la revisión mide ~460 px a 1440 (C4): tres columnas que caben enteras. «Qué revisar» va como
    // última línea de la celda del gráfico, que puede crecer en alto; antes era una cuarta columna escondida a la derecha.
    { id: "lamina", encabezado: "Lám.", ancho: 44, tipo: "cifra", celda: (f) => f.posicion ?? "—", valor: (f) => f.posicion },
    {
      id: "cruce", encabezado: "Gráfico", ancho: 252, valor: (f) => `${textoCruce(f)}. ${queRevisar(f.lamina).join("; ")}`,
      celda: (f) => {
        const revisar = queRevisar(f.lamina).join("; ");
        return (
          <span className="pulso-sig-revision-celda" title={textoCruce(f)}>
            <span>{f.titulo}</span>
            <small>{lineaGrafico(f)}</small>
            {revisar && <small className="is-revisar">{revisar}</small>}
          </span>
        );
      },
    },
    { id: "estado", encabezado: "Estado", ancho: 160, celda: (f) => <EstadoChip lamina={f.lamina} /> },
  ];
  const porClave = new Map(filas.map((f) => [claveDeFila(f), f]));
  // La fila elegida es la primera ranura de la lámina a la vista.
  const actual = filas.find((f) => f.lamina.slide_id === slideIdActual);
  return (
    <PulsoTable columnas={columnas} filas={filas} idDeFila={claveDeFila} ariaLabel="Gráficos con cruce" densidad="comoda"
      seleccionada={actual ? claveDeFila(actual) : null} altoMaximo={2000} vacio={VACIO[filtro]}
      onSeleccionar={(id) => { const p = porClave.get(id)?.posicion; if (p) onIr(p); }} />
  );
}

const claveDeFila = (f: FilaRevision): string => f.clave ?? f.lamina.slide_id;

/** «Gráfico 2: Barras agrupadas (cruce)» con varios gráficos en la lámina; «Cruce: gedad» con uno. */
function lineaGrafico(f: FilaRevision): string {
  const cruce = f.lamina.cruce ?? "sin cruce";
  return f.grafico ? `${f.grafico} (${cruce})` : `Cruce: ${cruce}`;
}

/** «Título (cruce)»; en una lámina con varios gráficos, además cuál: «Título, Gráfico 2: Barras agrupadas (cruce)». */
function textoCruce(f: FilaRevision): string {
  const nombre = f.grafico ? `${f.titulo}, ${f.grafico}` : f.titulo;
  return f.lamina.cruce ? `${nombre} (${f.lamina.cruce})` : nombre;
}

function EstadoChip({ lamina }: { lamina: ResultadoDiferencias }) {
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
