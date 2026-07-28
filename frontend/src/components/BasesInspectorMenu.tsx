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

import { forwardRef } from "react";

import { Check, ChevronDown, Database, FileSpreadsheet, FileText } from "../vendor/lucide-react";

import { Popover } from "./Popover";
import type { EstudioBase, EstudioPayload } from "../api/estudio";

/**
 * Resumen de una base, en la forma mínima que el desglose necesita.
 *
 * Existe porque no todos los módulos tienen el payload del estudio: Codificación
 * trabaja con claves y etiquetas y nada más. Antes que obligarlo a una petición
 * extra —o que se escriba su propio selector, que es de donde venía la
 * divergencia— el desglose acepta las dos formas y degrada: con datos completos
 * muestra instrumento y archivo, y sin ellos lista los nombres.
 */
export type BaseResumen = {
  nombre: string;
  etiqueta: string;
  instrumento?: string | null;
  datos?: string | null;
  filas?: number | null;
  columnas?: number | null;
  ext?: string | null;
  repeat?: string | null;
};

/** Construye los resúmenes desde el payload del estudio, cuando se tiene. */
export function basesDesdeEstudio(estudio: EstudioPayload): BaseResumen[] {
  return Object.entries(estudio.bases ?? {}).map(([nombre, base]) => ({
    nombre,
    etiqueta: nombreDeBase(nombre, base),
    instrumento: base.xlsform_file_name ?? null,
    datos: base.data_file_name ?? null,
    filas: base.n_filas,
    columnas: base.n_columnas,
    ext: base.data_ext ?? null,
    repeat: base.repeat_group ?? null,
  }));
}
import "./bases-inspector.css";

function formatearFilas(n: number | null | undefined): string {
  if (n == null) return "—";
  return n.toLocaleString("es-PE");
}

/** Nombre legible de la base: alias del analista, título de la fuente, o su id. */
function nombreDeBase(nombre: string, base: EstudioBase): string {
  return base.source_alias || base.source_title || (nombre === "default" ? "Base única" : nombre);
}

/**
 * Disparador canónico del selector de base.
 *
 * Existía tres veces —Validación con su componente, Codificación escrito a mano
 * en su page-file, y el del chrome— y las tres se veían parecidas por copia, no
 * por contrato. Acá vive una sola.
 *
 * Habla la misma gramática que los indicadores de la banda: rótulo pequeño en
 * mayúsculas arriba, valor abajo. Antes era un texto plano con un ícono de capas
 * al lado, y al ponerlo junto a un `ChromeIndicator` se leía como un control de
 * otra app: mismo sitio, misma altura, otra tipografía. El ícono decorativo se
 * fue —la banda va limpia— y el chevron se queda, porque es lo que anuncia que
 * esto abre algo.
 */
/*
 * `forwardRef` no es decorativo: este componente se pasa como `disparador` del
 * `Popover`, que clona el elemento e inyecta una `ref` para anclar el panel al
 * trigger. Un componente de función sin forwardRef descarta esa ref —React
 * avisa "Function components cannot be given refs"— y el Popover se queda sin
 * ancla, cayendo al `.pulso-page-frame` del contenedor para posicionarse.
 */
export const BaseSelectorTrigger = forwardRef<
  HTMLButtonElement,
  {
    etiqueta: string;
    /** Cuántas bases hay en el estudio. Se muestra como contador. */
    total: number;
    rotulo?: string;
  } & React.ButtonHTMLAttributes<HTMLButtonElement>
>(function BaseSelectorTrigger({ etiqueta, total, rotulo = "Base", ...resto }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      className="pulso-bases-inspector-trigger is-selector"
      title={`${etiqueta} · ${total} bases en el estudio`}
      {...resto}
    >
      <span className="pulso-bases-inspector-trigger-copy">
        <small>{rotulo}</small>
        <strong className="pulso-bases-inspector-trigger-label">{etiqueta}</strong>
      </span>
      <span className="pulso-bases-inspector-trigger-count">{total}</span>
      <ChevronDown size={12} aria-hidden className="pulso-bases-inspector-trigger-chevron" />
    </button>
  );
});

export function BasesInspectorMenu({
  bases,
  activa,
  onSeleccionar,
  deshabilitado,
  modo,
  disparador,
}: {
  bases: readonly BaseResumen[];
  /** Base activa, para marcarla en la lista. */
  activa?: string | null;
  /**
   * Si se pasa, cada base se vuelve seleccionable y el desglose ES el selector.
   * Sin esto es solo inventario de lectura.
   */
  onSeleccionar?: (nombre: string) => void;
  deshabilitado?: boolean;
  /**
   * Cómo trata el procesamiento a este conjunto de bases: combinadas en una sola
   * mesa o independientes. Vive acá y no en la banda porque es una propiedad DE
   * las bases, y tenerlo suelto a la derecha ponía dos controles a hablar del
   * mismo conjunto —uno decía «2 bases · Bases combinadas», el otro el nombre de
   * la activa— compitiendo por el ancho de la banda.
   */
  modo?: string | null;
  disparador: React.ReactElement;
}) {
  if (bases.length === 0) return disparador;

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
            {bases.length === 1 ? "1 base" : `${bases.length} bases`}
          </strong>
          <span>Instrumento y datos de cada una</span>
          {modo ? (
            <span className="pulso-bases-inspector-modo">{modo}</span>
          ) : null}
        </div>

        <ul className="pulso-bases-inspector-list">
          {bases.map((base) => {
            const nombre = base.nombre;
            const esActiva = nombre === activa;
            const tieneDetalle = Boolean(base.instrumento || base.datos);
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
                    <strong>{base.etiqueta}</strong>
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
                    <strong>{base.etiqueta}</strong>
                    {esActiva ? (
                      <span className="pulso-bases-inspector-badge">Activa</span>
                    ) : null}
                  </div>
                )}

                {tieneDetalle ? (
                  <>
                    <dl className="pulso-bases-inspector-grid">
                      <div>
                        <dt>
                          <FileText size={12} aria-hidden />
                          Instrumento
                        </dt>
                        <dd title={base.instrumento ?? undefined}>
                          {base.instrumento || "Sin formulario"}
                        </dd>
                      </div>
                      <div>
                        <dt>
                          <FileSpreadsheet size={12} aria-hidden />
                          Base de datos
                        </dt>
                        <dd title={base.datos ?? undefined}>
                          {base.datos || "Sin archivo"}
                        </dd>
                      </div>
                    </dl>

                    <p className="pulso-bases-inspector-meta">
                      {formatearFilas(base.filas)} filas · {formatearFilas(base.columnas)} columnas
                      {base.ext ? ` · ${base.ext}` : ""}
                      {base.repeat ? ` · repeat ${base.repeat}` : ""}
                    </p>
                  </>
                ) : null}
              </li>
            );
          })}
        </ul>
      </div>
    </Popover>
  );
}
