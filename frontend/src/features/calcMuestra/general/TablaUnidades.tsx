import { ChevronLeft, ChevronRight, Table2 } from "lucide-react";

import type { CalcMuestraGeneralUnidad } from "../../../api/calcMuestraGeneral";
import { Panel } from "../../../components/Panel";
import { GlidingRadioGroup } from "../../../components/GlidingRadioGroup";
import { fmtInt } from "../sharedCore";
import "../universidad/shared/tablas.css";
import {
  filtrarUnidades,
  formatearPeso,
  formatearPi,
  paginar,
  type FiltroUnidades,
} from "./modelo";
import { useDesbordaHorizontal } from "./useDesbordaHorizontal";
import "./general.css";
import { EstadoVacio } from "../../../components/EstadoVacio";

const FILTROS: Array<{ id: FiltroUnidades; label: string }> = [
  { id: "todas", label: "Todas" },
  { id: "titular", label: "Principales" },
  { id: "reserva", label: "Reemplazos" },
];

/**
 * El listado sorteado con π y peso base por unidad. Se pagina —no se encierra
 * en un scroll propio— para que el único dueño de scroll siga siendo el panel
 * de la sección, sea el listado de 30 o de 3.000.
 */
export function TablaUnidades({
  unidades,
  filtro,
  pagina,
  onFiltro,
  onPagina,
}: {
  unidades: CalcMuestraGeneralUnidad[];
  filtro: FiltroUnidades;
  pagina: number;
  onFiltro: (filtro: FiltroUnidades) => void;
  onPagina: (pagina: number) => void;
}) {
  const { ref, desborda } = useDesbordaHorizontal<HTMLDivElement>();
  const filtradas = filtrarUnidades(unidades, filtro);
  const vista = paginar(filtradas, pagina);
  const conteo: Record<FiltroUnidades, number> = {
    todas: unidades.length,
    titular: unidades.filter((u) => u.estado === "titular").length,
    reserva: unidades.filter((u) => u.estado === "reserva").length,
  };

  return (
    <Panel
      className="cmg-unidades"
      aria-labelledby="cmg-unidades-titulo"
      data-qa-geometry-member
      eyebrow="Listado"
      title={<span id="cmg-unidades-titulo">Unidades seleccionadas</span>}
      actions={(
        <GlidingRadioGroup<(typeof FILTROS)[number], FiltroUnidades>
          value={filtro}
          options={FILTROS}
          getOptionValue={(f) => f.id}
          onValueChange={onFiltro}
          getOptionProps={() => ({ className: "cmg-filtro" })}
          className="cmg-filtros"
          aria-label="Filtrar unidades"
        >
          {(f) => <>{f.label} <span className="cmg-filtro-n">{fmtInt(conteo[f.id])}</span></>}
        </GlidingRadioGroup>
      )}
    >

      {filtradas.length === 0 ? (
        <EstadoVacio
          icono={<Table2 size={16} aria-hidden="true" />}
          titulo={filtro === "reserva" ? "Esta selección no incluyó reemplazos" : "El listado está vacío"}
        />
      ) : (
        <>
          <div
            ref={ref}
            className="cmv2-table-wrap cmg-tabla-desplazable"
            data-desborda={desborda ? "true" : "false"}
            tabIndex={desborda ? 0 : undefined}
            role={desborda ? "region" : undefined}
            aria-label={desborda ? "Listado de unidades, desplazable" : undefined}
          >
            <table className="cmv2-tabla cmg-tabla-unidades">
              <caption className="cmg-sr-only">Unidades seleccionadas con π y peso base</caption>
              <thead>
                <tr>
                  <th scope="col">Id</th>
                  <th scope="col">Estrato</th>
                  <th scope="col" className="cmv2-num cmg-simbolo">π</th>
                  <th scope="col" className="cmv2-num">Peso base</th>
                  <th scope="col">Estado</th>
                  <th scope="col" className="cmv2-num">Lote</th>
                </tr>
              </thead>
              <tbody>
                {vista.filas.map((u) => (
                  <tr key={`${u.estado}-${u.id}`}>
                    <th scope="row"><code>{u.id}</code></th>
                    <td>{u.estrato}</td>
                    <td className="cmv2-num" title={u.pi == null ? "Se recalcula al liberar el lote" : String(u.pi)}>
                      {formatearPi(u.pi)}
                    </td>
                    <td className="cmv2-num" title={u.peso_base == null ? undefined : String(u.peso_base)}>
                      {formatearPeso(u.peso_base)}
                    </td>
                    <td>
                      <span className={`cmg-estado cmg-estado--${u.estado}`}>
                        {u.estado === "titular" ? "Principal" : "Reemplazo"}
                      </span>
                    </td>
                    <td className="cmv2-num">{u.lote_reserva == null ? "—" : fmtInt(u.lote_reserva)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="cmg-paginacion">
            <span aria-live="polite">
              {fmtInt(vista.desde)}–{fmtInt(vista.hasta)} de {fmtInt(filtradas.length)}
            </span>
            {vista.paginas > 1 && (
              <div className="cmv2-inline-actions">
                <button
                  type="button"
                  className="cmv2-ghost"
                  onClick={() => onPagina(vista.pagina - 1)}
                  disabled={vista.pagina === 0}
                  aria-label="Página anterior"
                >
                  <ChevronLeft size={14} aria-hidden="true" />
                </button>
                <span>Página {fmtInt(vista.pagina + 1)} de {fmtInt(vista.paginas)}</span>
                <button
                  type="button"
                  className="cmv2-ghost"
                  onClick={() => onPagina(vista.pagina + 1)}
                  disabled={vista.pagina >= vista.paginas - 1}
                  aria-label="Página siguiente"
                >
                  <ChevronRight size={14} aria-hidden="true" />
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </Panel>
  );
}
