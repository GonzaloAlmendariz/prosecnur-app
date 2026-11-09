import { useMemo, useState, type ReactNode } from "react";

import type { HojasRutaIntegratedConfig } from "../../../../api/hojasRuta";
import { Dialog } from "../../../../components/Dialog";
import { PulsoButton } from "../../../../components/PulsoButton";
import { formatoConteo, formatoDecimal } from "../../../../lib/formatoNumero";
import { Search, SlidersHorizontal } from "../../../../vendor/lucide-react";
import { filtrarGrupos, GRUPOS_AJUSTES, resumenGrupo, type GrupoAjustesId } from "./gruposAjustes";
import "./ajustes.css";

/** La vista previa del pie: lo que el diseño vigente produce. */
export type VistaPreviaDiseno = { n: number | null; rutas: number | null; distritos: number; margen: number | null };


type Props = {
  abierto: boolean;
  grupo: GrupoAjustesId;
  config: HojasRutaIntegratedConfig;
  fase: string;
  vista: VistaPreviaDiseno;
  onGrupo: (g: GrupoAjustesId) => void;
  onCerrar: () => void;
  /** El contenido de los grupos ya mudados a la ventana; `null` = todavía se edita en su sección. */
  contenidoDe?: (g: GrupoAjustesId) => ReactNode | null;
  /** Grupos con cambios en borrador, sin aplicar. */
  pendientes?: number;
  /** La vista previa no refleja los últimos cambios: se atenúa hasta Recalcular. */
  desfasada?: boolean;
  onRecalcular?: () => void;
  /** Lo que Aplicar descartaría (cuotas, sorteo…); ocupa la pista del pie en vez de «Esc cierra». */
  aviso?: string | null;
  /** Cancelar descarta lo editado en la ventana y cierra; la ✕ y Esc cierran sin descartar. */
  onCancelar?: () => void;
  onAplicar?: () => void;
  aplicando?: boolean;
};

/**
 * «Ajustes del diseño» (maqueta aprobada, lámina 6): la ventana que reúne la configuración del diseño
 * muestral en ocho grupos, con buscador, navegación lateral y un pie con la vista previa. Etapa M0: el
 * los ocho grupos con su contenido (M2–M6); si el contenido aún no llegó, el grupo dice su valor vigente.
 * Recalcular y Aplicar son dos botones distintos; sin cambios pendientes los dos esperan.
 */
export function AjustesDiseno({ abierto, grupo, config, fase, vista, onGrupo, onCerrar, contenidoDe, pendientes = 0, desfasada = false, onRecalcular, onCancelar, onAplicar, aplicando = false, aviso = null }: Props) {
  const [busqueda, setBusqueda] = useState("");
  const visibles = useMemo(() => filtrarGrupos(busqueda), [busqueda]);
  const actual = GRUPOS_AJUSTES.find((g) => g.id === grupo) ?? GRUPOS_AJUSTES[0];
  const n = vista.n;
  const contenido = contenidoDe?.(actual.id) ?? null;
  return (
    <Dialog
      open={abierto}
      onOpenChange={(o) => !o && onCerrar()}
      title="Ajustes del diseño"
      icon={<SlidersHorizontal size={16} aria-hidden />}
      size="lg"
      alto="fijo"
      flush
      className="hr-ajustes"
      bodyClassName="hr-ajustes-medio"
      closeLabel="Cerrar los ajustes"
      footerHint={aviso ? <span className="hr-ajustes-aviso">{aviso}</span> : null}
      footerStatus={
        <dl className="hr-ajustes-vista" aria-label="Vista previa del diseño" data-desfasada={desfasada || undefined} title={desfasada ? "Hay cambios sin recalcular" : undefined}>
          <div><dt>Encuestas</dt><dd>{n == null ? "—" : formatoConteo(n)}</dd></div>
          <div><dt>Rutas</dt><dd>{vista.rutas == null ? "—" : formatoConteo(vista.rutas)}</dd></div>
          <div><dt>Distritos</dt><dd>{formatoConteo(vista.distritos)}</dd></div>
          <div><dt>Margen</dt><dd>{vista.margen == null ? "—" : `±${formatoDecimal(vista.margen * 100, 1)} pp`}</dd></div>
        </dl>
      }
      footer={
        <>
          <PulsoButton variant="ghost" size="lg" onClick={onCancelar ?? onCerrar} title="Descarta los cambios sin aplicar y cierra">Cancelar</PulsoButton>
          <PulsoButton variant="secondary" size="lg" disabled={!desfasada || aplicando} title={desfasada ? "Actualiza la vista previa sin guardar" : "La vista previa está al día"} onClick={onRecalcular}>Recalcular</PulsoButton>
          <PulsoButton variant="primary" size="lg" disabled={!pendientes || aplicando || !onAplicar} title={pendientes ? `Guarda ${pendientes === 1 ? "el cambio" : `los ${pendientes} cambios`} y recalcula en el servidor` : "Sin cambios que aplicar"} onClick={onAplicar}>{aplicando ? "Aplicando…" : pendientes ? `Aplicar ${pendientes}` : "Aplicar"}</PulsoButton>
        </>
      }
    >
      <nav className="hr-ajustes-nav" aria-label="Grupos de ajustes">
        <label className="hr-ajustes-buscar">
          <Search size={14} aria-hidden />
          {/* Al abrir, el foco va al buscador y no a la ✕ (que aparecía con el anillo de foco, como si fuera lo que hay que hacer). */}
          <input autoFocus type="search" placeholder="Buscar un ajuste" aria-label="Buscar un ajuste" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
        </label>
        {visibles.length ? visibles.map((g) => (
          <button key={g.id} type="button" className="hr-ajustes-nav-item" aria-current={g.id === actual.id ? "true" : undefined} onClick={() => onGrupo(g.id)}>
            <span>{g.nombre}</span>
            <small>{resumenGrupo(g.id, config, { n, fase })}</small>
          </button>
        )) : <p className="hr-ajustes-nada">Ningún ajuste con «{busqueda}».</p>}
      </nav>
      <div className="hr-ajustes-cuerpo" key={actual.id}>
        <div className="hr-ajustes-grupo-cab">
          <h3>{actual.nombre}</h3>
          <p>{actual.descripcion}</p>
        </div>
        {contenido ?? (
          <>
            <dl className="hr-ajustes-vigente">
              <dt>Vigente</dt>
              <dd>{resumenGrupo(actual.id, config, { n, fase })}</dd>
            </dl>
            <p className="hr-mapa-nota">Cargando el diseño…</p>
          </>
        )}
      </div>
    </Dialog>
  );
}
