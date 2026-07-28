import type { ReactNode } from "react";
import {
  ChevronRight,
  FileCheck2,
  RefreshCw,
  X,
} from "../../../../vendor/lucide-react";
import { usePanelDireccionable, type PanelDeclarado } from "../../../../lib/navegacion/paneles";

/**
 * Barra de fuente de Ocurrencias.
 *
 * Antes la configuración del formulario Kobo —identidad del asset, cuatro KPIs,
 * siete botones y cuatro chips de estado— se renderizaba **antes** del switch de
 * pestañas, así que aparecía idéntica en las cinco y cobraba ~180px de peaje cada
 * vez. Con ACNUR ACG, la primera alerta de la pestaña Alertas quedaba pasado el
 * 40% de la pantalla.
 *
 * Ahora queda una línea de estado y todo lo demás vive en un panel direccionable.
 */

export const PANEL_FUENTE_OCURRENCIAS: PanelDeclarado = {
  id: "fuente",
  label: "Fuente de ocurrencias",
  clase: "sideover",
};

export type OccurrenceSourceBarProps = {
  /** "Sincronizada", "Sin configurar"… */
  estado: string;
  /** Verdadero cuando hay formulario vinculado y sincronizado. */
  activa: boolean;
  reportes: string;
  ultimaSync: string;
  formulario: string;
  /** Contenido del panel: acciones, picker de Kobo y prueba de campos. */
  children: ReactNode;
};

export function OccurrenceSourceBar({
  estado,
  activa,
  reportes,
  ultimaSync,
  formulario,
  children,
}: OccurrenceSourceBarProps) {
  const panel = usePanelDireccionable(PANEL_FUENTE_OCURRENCIAS);

  return (
    <>
      <div
        className={`mon-occurrences-sourcebar${activa ? " is-active" : " is-idle"}`}
        aria-label="Fuente de ocurrencias"
      >
        <span className="mon-occurrences-sourcebar__estado">
          <FileCheck2 size={13} />
          {estado}
        </span>
        <span className="mon-occurrences-sourcebar__dato">
          <strong>{reportes}</strong> reportes
        </span>
        <span className="mon-occurrences-sourcebar__dato">
          <RefreshCw size={12} />
          {ultimaSync}
        </span>
        <span className="mon-occurrences-sourcebar__form" title={formulario}>
          {formulario}
        </span>
        <button
          type="button"
          className="mon-occurrences-sourcebar__cta"
          onClick={panel.abrir}
          aria-expanded={panel.abierto}
        >
          Fuente y formulario
          <ChevronRight size={13} />
        </button>
      </div>

      {panel.abierto ? (
        <>
          <div className="mon-occurrences-sourcepanel__scrim" onClick={panel.cerrar} aria-hidden="true" />
          <aside
            className="mon-occurrences-sourcepanel"
            role="dialog"
            aria-modal="false"
            aria-label="Fuente y formulario de ocurrencias"
            {...panel.props}
          >
            <header className="mon-occurrences-sourcepanel__head">
              <div>
                <span>Fuente de ocurrencias</span>
                <strong>{formulario}</strong>
                <em>{estado} · {reportes} reportes · {ultimaSync}</em>
              </div>
              <button type="button" onClick={panel.cerrar} aria-label="Cerrar panel de fuente">
                <X size={15} />
              </button>
            </header>
            <div className="mon-occurrences-sourcepanel__body">{children}</div>
          </aside>
        </>
      ) : null}
    </>
  );
}
