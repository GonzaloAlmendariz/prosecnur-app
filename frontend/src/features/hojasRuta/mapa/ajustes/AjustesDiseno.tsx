import { useMemo, useState } from "react";

import type { HojasRutaIntegratedConfig } from "../../../../api/hojasRuta";
import { Dialog } from "../../../../components/Dialog";
import { PulsoButton } from "../../../../components/PulsoButton";
import { formatoConteo, formatoDecimal } from "../../../../lib/formatoNumero";
import { ArrowRight, Search, SlidersHorizontal } from "../../../../vendor/lucide-react";
import { filtrarGrupos, GRUPOS_AJUSTES, resumenGrupo, type GrupoAjustesId, type SeccionOrigen } from "./gruposAjustes";
import "./ajustes.css";

/** La vista previa del pie: lo que el diseño vigente produce. */
export type VistaPreviaDiseno = { n: number | null; rutas: number | null; distritos: number; margen: number | null };

const NOMBRE_SECCION: Record<SeccionOrigen, string> = { muestra: "Muestra", poblacion: "Población", manzanas: "Manzanas", seleccion: "Selección" };

type Props = {
  abierto: boolean;
  grupo: GrupoAjustesId;
  config: HojasRutaIntegratedConfig;
  fase: string;
  vista: VistaPreviaDiseno;
  onGrupo: (g: GrupoAjustesId) => void;
  onCerrar: () => void;
  /** Mientras el grupo no pasa a la ventana (M2–M6), lleva a la sección donde hoy se edita. */
  onIrSeccion: (s: SeccionOrigen) => void;
};

/**
 * «Ajustes del diseño» (maqueta aprobada, lámina 6): la ventana que reúne la configuración del diseño
 * muestral en ocho grupos, con buscador, navegación lateral y un pie con la vista previa. Etapa M0: el
 * armazón; cada grupo declara su valor vigente y, hasta que su contenido se mude aquí, dónde se edita.
 * Recalcular y Aplicar son dos botones distintos; sin cambios pendientes los dos esperan.
 */
export function AjustesDiseno({ abierto, grupo, config, fase, vista, onGrupo, onCerrar, onIrSeccion }: Props) {
  const [busqueda, setBusqueda] = useState("");
  const visibles = useMemo(() => filtrarGrupos(busqueda), [busqueda]);
  const actual = GRUPOS_AJUSTES.find((g) => g.id === grupo) ?? GRUPOS_AJUSTES[0];
  const n = vista.n;
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
      footerStatus={
        <dl className="hr-ajustes-vista" aria-label="Vista previa del diseño">
          <div><dt>Encuestas</dt><dd>{n == null ? "—" : formatoConteo(n)}</dd></div>
          <div><dt>Rutas</dt><dd>{vista.rutas == null ? "—" : formatoConteo(vista.rutas)}</dd></div>
          <div><dt>Distritos</dt><dd>{formatoConteo(vista.distritos)}</dd></div>
          <div><dt>Margen</dt><dd>{vista.margen == null ? "—" : `±${formatoDecimal(vista.margen * 100, 1)} pp`}</dd></div>
        </dl>
      }
      footer={
        <>
          <PulsoButton variant="secondary" onClick={onCerrar}>Cancelar</PulsoButton>
          <PulsoButton variant="secondary" disabled title="Sin cambios que recalcular">Recalcular</PulsoButton>
          <PulsoButton variant="primary" disabled title="Sin cambios que aplicar">Aplicar</PulsoButton>
        </>
      }
    >
      <nav className="hr-ajustes-nav" aria-label="Grupos de ajustes">
        <label className="hr-ajustes-buscar">
          <Search size={14} aria-hidden />
          <input type="search" placeholder="Buscar un ajuste" aria-label="Buscar un ajuste" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
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
        <dl className="hr-ajustes-vigente">
          <dt>Vigente</dt>
          <dd>{resumenGrupo(actual.id, config, { n, fase })}</dd>
        </dl>
        <div className="hr-ajustes-pendiente">
          <span>Se edita en {NOMBRE_SECCION[actual.origen]} mientras el grupo pasa a esta ventana.</span>
          <PulsoButton variant="secondary" size="sm" onClick={() => onIrSeccion(actual.origen)}>
            Ir a {NOMBRE_SECCION[actual.origen]} <ArrowRight size={13} aria-hidden />
          </PulsoButton>
        </div>
      </div>
    </Dialog>
  );
}
