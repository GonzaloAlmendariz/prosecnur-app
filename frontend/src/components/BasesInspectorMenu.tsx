/**
 * Desplegable de bases: qué instrumento y qué base de datos tiene cada una.
 *
 * En un estudio multibase la pregunta operativa no es «cuántas bases hay» —eso ya
 * lo dice el chip— sino «qué formulario está usando cada una y sobre qué archivo».
 * Antes había que bajar al panel de bases del cuerpo para verlo, y en las fases 2 a
 * 5 ni eso: ahí la banda solo decía el número.
 *
 * Se apoya en el `Popover` de la casa (portal, clamping al viewport, cierre por
 * ESC y click fuera).
 *
 * Los dos datos van APILADOS y no en dos columnas. Con dos columnas cada nombre
 * tenía la mitad del ancho y ambos se truncaban al mismo prefijo, que es
 * exactamente lo que hay que evitar: el propósito del desglose es distinguir qué
 * XLSForm va con qué archivo, y esos nombres se diferencian por el final. Una base
 * cuyo instrumento no es el que uno cree es un error caro y silencioso.
 */

import { Check, Database, FileSpreadsheet, FileText } from "../vendor/lucide-react";

import { Popover } from "./Popover";
import type { EstudioBase, EstudioPayload } from "../api/estudio";
import "./bases-inspector.css";

function formatearFilas(n: number | null | undefined): string {
  if (n == null) return "—";
  return n.toLocaleString("es-PE");
}

/** Nombre legible de la base: alias del analista, título de la fuente, o su id. */
function nombreDeBase(nombre: string, base: EstudioBase): string {
  return base.source_alias || base.source_title || (nombre === "default" ? "Base única" : nombre);
}

export function BasesInspectorMenu({
  estudio,
  activa,
  onSeleccionar,
  deshabilitado,
  disparador,
}: {
  estudio: EstudioPayload;
  /** Base activa, para marcarla en la lista. */
  activa?: string | null;
  /**
   * Si se pasa, cada base se vuelve seleccionable y el desglose ES el selector.
   * Sin esto es solo inventario de lectura.
   */
  onSeleccionar?: (nombre: string) => void;
  deshabilitado?: boolean;
  disparador: React.ReactElement;
}) {
  const entradas = Object.entries(estudio.bases ?? {});
  if (entradas.length === 0) return disparador;

  return (
    <Popover
      side="bottom"
      align="start"
      maxWidth={520}
      ariaLabel="Instrumento y base de datos de cada base"
      trigger={disparador}
    >
      <div className="pulso-bases-inspector">
        <div className="pulso-bases-inspector-head">
          <strong>
            {entradas.length === 1 ? "1 base" : `${entradas.length} bases`}
          </strong>
          <span>Instrumento y datos de cada una</span>
        </div>

        <ul className="pulso-bases-inspector-list">
          {entradas.map(([nombre, base]) => {
            const esActiva = nombre === activa;
            const filas = formatearFilas(base.n_filas);
            const columnas = formatearFilas(base.n_columnas);
            return (
              <li
                key={nombre}
                className="pulso-bases-inspector-item"
                data-activa={esActiva ? "" : undefined}
                data-seleccionable={onSeleccionar ? "" : undefined}
              >
                {onSeleccionar ? (
                  <button
                    type="button"
                    className="pulso-bases-inspector-item-head"
                    data-nav-item=""
                    data-nav-shape="row"
                    data-nav-state={esActiva ? "selected" : undefined}
                    aria-pressed={esActiva}
                    disabled={deshabilitado || esActiva}
                    onClick={() => onSeleccionar(nombre)}
                  >
                    <Database size={13} aria-hidden />
                    <strong>{nombreDeBase(nombre, base)}</strong>
                    {esActiva ? (
                      <span className="pulso-bases-inspector-badge">
                        <Check size={11} aria-hidden />
                        Activa
                      </span>
                    ) : null}
                  </button>
                ) : (
                  <div className="pulso-bases-inspector-item-head">
                    <Database size={13} aria-hidden />
                    <strong>{nombreDeBase(nombre, base)}</strong>
                    {esActiva ? (
                      <span className="pulso-bases-inspector-badge">Activa</span>
                    ) : null}
                  </div>
                )}

                <dl className="pulso-bases-inspector-grid">
                  <div>
                    <dt>
                      <FileText size={12} aria-hidden />
                      Instrumento
                    </dt>
                    <dd title={base.xlsform_file_name ?? undefined}>
                      {base.xlsform_file_name || "Sin formulario"}
                    </dd>
                  </div>
                  <div>
                    <dt>
                      <FileSpreadsheet size={12} aria-hidden />
                      Base de datos
                    </dt>
                    <dd title={base.data_file_name ?? undefined}>
                      {base.data_file_name || "Sin archivo"}
                    </dd>
                  </div>
                </dl>

                <p className="pulso-bases-inspector-meta">
                  {filas} filas · {columnas} columnas
                  {base.data_ext ? ` · ${base.data_ext}` : ""}
                  {base.repeat_group ? ` · repeat ${base.repeat_group}` : ""}
                </p>
              </li>
            );
          })}
        </ul>
      </div>
    </Popover>
  );
}
