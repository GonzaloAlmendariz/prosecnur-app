import { Download, Eye, Filter, Search, X } from "../../../vendor/lucide-react";

import type { BitacoraPreferencias } from "../../../api/bitacora";
import { MODULOS_BITACORA, TONOS } from "./gramatica";

export type FiltroBitacora = BitacoraPreferencias["bitacora"];

/**
 * Filtros de la bitácora (ADR 0047).
 *
 * Persisten en el `.pulso` porque describen el ESTUDIO, no la máquina: volver
 * al proyecto y encontrar el filtro puesto es parte de retomar el trabajo.
 *
 * Se aplican en el servidor para que la exportación entregue exactamente lo
 * mismo que la vista muestra; acá solo se declaran.
 */
export function FiltrosBitacora({
  filtro,
  total,
  visibles,
  exportando,
  onCambio,
  onExportar,
}: {
  filtro: FiltroBitacora;
  total: number;
  visibles: number;
  exportando: boolean;
  onCambio: (parche: Partial<FiltroBitacora>) => void;
  onExportar: () => void;
}) {
  const activo =
    filtro.tonos.length > 0 ||
    filtro.modulos.length > 0 ||
    filtro.etiquetas.length > 0 ||
    filtro.texto.length > 0 ||
    filtro.mostrar_archivadas;

  function alternar(lista: string[], valor: string): string[] {
    return lista.includes(valor) ? lista.filter((v) => v !== valor) : [...lista, valor];
  }

  return (
    <div className="bit-filtros">
      {/* Los controles envuelven dentro de su propia zona; la cola queda
          anclada a la derecha y centrada. Con todo en un solo flex, al
          envolver el botón de exportar caía solo a una segunda línea. */}
      <div className="bit-filtros-controles">
      <label className="bit-filtros-busqueda">
        <Search size={14} aria-hidden="true" />
        <span className="pulso-sr-only">Buscar en la bitácora</span>
        <input
          type="search"
          value={filtro.texto}
          placeholder="Buscar en título y detalle"
          onChange={(event) => onCambio({ texto: event.target.value })}
        />
      </label>

      <div className="bit-filtros-grupo" role="group" aria-label="Filtrar por tipo">
        {TONOS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`bit-chip is-boton${filtro.tonos.includes(t.id) ? " is-activo" : ""}`}
            aria-pressed={filtro.tonos.includes(t.id)}
            onClick={() => onCambio({ tonos: alternar(filtro.tonos, t.id) })}
          >
            {t.label}
          </button>
        ))}
      </div>

      <label className="bit-filtros-modulo">
        <Filter size={13} aria-hidden="true" />
        <span className="pulso-sr-only">Filtrar por módulo</span>
        <select
          value={filtro.modulos[0] ?? ""}
          onChange={(event) =>
            onCambio({ modulos: event.target.value ? [event.target.value] : [] })
          }
        >
          <option value="">Todos los módulos</option>
          {MODULOS_BITACORA.map((m) => (
            <option key={m.id} value={m.id}>{m.label}</option>
          ))}
        </select>
      </label>

      <button
        type="button"
        className={`bit-chip is-boton${filtro.mostrar_archivadas ? " is-activo" : ""}`}
        aria-pressed={filtro.mostrar_archivadas}
        onClick={() => onCambio({ mostrar_archivadas: !filtro.mostrar_archivadas })}
      >
        <Eye size={12} />
        <span>Archivadas</span>
      </button>
      </div>

      {/* Conteo y acciones viajan juntos a la derecha: sueltos, al envolver la
          fila el botón caía solo a una segunda línea y el bloque quedaba
          desbalanceado. */}
      <div className="bit-filtros-cola">
        <span className="bit-filtros-conteo">
          {activo ? `${visibles} de ${total}` : `${total} ${total === 1 ? "entrada" : "entradas"}`}
        </span>

        {activo && (
          <button
            type="button"
            className="bit-boton-sutil"
            onClick={() =>
              onCambio({ tonos: [], modulos: [], etiquetas: [], texto: "", mostrar_archivadas: false })
            }
          >
            <X size={12} />
            <span>Limpiar</span>
          </button>
        )}

        {/* Exporta lo FILTRADO, no todo: es lo que el usuario está mirando. */}
        <button
          type="button"
          className="bit-boton"
          onClick={onExportar}
          disabled={exportando || visibles === 0}
        >
          <Download size={14} />
          <span>Exportar</span>
        </button>
      </div>
    </div>
  );
}
