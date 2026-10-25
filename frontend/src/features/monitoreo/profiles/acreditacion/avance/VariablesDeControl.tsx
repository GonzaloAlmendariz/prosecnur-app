import { useMemo, type ReactNode } from "react";
import { SlidersHorizontal } from "lucide-react";
import { pctConEspacio } from "../../../core/formatoComun";
import { fmt } from "../formato";
import { CabeceraDeTarjeta } from "../navegacion/rotuloDePestana";
import { VacioDeBloque } from "../piezas/AvisoDeTarjeta";
import { clasePublico, paletaDePublicos } from "../paletaPublicos";
import { agruparVariablesDeControl, diferenciaMarcada, puntos, type FilaDeControl } from "./variablesDeControlModelo";
import "./avance.css";
import "../paletaPublicos.css";

function pct(valor: number | null) {
  return valor == null ? "—" : pctConEspacio(valor);
}

/**
 * Avance › Por cuota › Variables de control: una tabla por público y variable
 * con el peso de cada categoría en el universo y en las efectivas, su
 * diferencia y los parciales y rechazos. Debajo, las tablas del reporte, que
 * llegan armadas desde el page-file.
 */
export function VariablesDeControl({ filas, reporte }: { filas: readonly FilaDeControl[]; reporte?: ReactNode }) {
  const grupos = useMemo(() => agruparVariablesDeControl(filas), [filas]);
  const paleta = useMemo(() => paletaDePublicos(grupos.map((grupo) => grupo.actor)), [grupos]);
  const variables = grupos.reduce((suma, grupo) => suma + grupo.variables.length, 0);
  return (
    <div className="acr-vc" data-qa-geometry-group="acreditacion-avance-variables" data-qa-geometry-contract="intrinsic">
      <section className="acr-av-panel acr-vc-tabla" aria-label="Variables de control" data-qa-geometry-member>
        <CabeceraDeTarjeta primera>
          <h3>
            Variables de control
            {variables ? <span className="acr-av-chip" title={`${fmt(grupos.length)} ${grupos.length === 1 ? "público" : "públicos"}`}>{`${fmt(variables)} ${variables === 1 ? "variable" : "variables"}`}</span> : null}
          </h3>
        </CabeceraDeTarjeta>
        {grupos.length ? (
          <div className="acr-pub-tabla-marco" data-qa-geometry-capacity="owned">
            <table className="acr-pub-tabla">
              <thead>
                <tr>
                  <th scope="col">Categoría</th>
                  <th scope="col" className="is-num">Universo</th>
                  <th scope="col" className="is-num">Efectivas</th>
                  <th scope="col" className="acr-vc-col-barras">Universo frente a efectivas</th>
                  <th scope="col" className="is-num">Diferencia</th>
                  <th scope="col" className="is-num">Parciales</th>
                  <th scope="col" className="is-num">Rechazos</th>
                </tr>
              </thead>
              {grupos.flatMap((grupo) => grupo.variables.map((variable) => (
                <tbody key={`${grupo.actor}-${variable.variable}`} className={clasePublico(paleta, grupo.actor)}>
                  <tr className="acr-vc-grupo">
                    <th scope="colgroup" colSpan={7}>
                      <i className="mon-publico-punto" aria-hidden="true" />
                      {`${grupo.actor}, ${variable.variable}`}
                    </th>
                  </tr>
                  {variable.rows.map((fila) => (
                    <tr key={fila.value}>
                      <th scope="row">{fila.value}</th>
                      <td className="is-num">{fmt(fila.universe)}</td>
                      <td className="is-num"><b>{fmt(fila.effective)}</b></td>
                      <td className="acr-vc-col-barras">
                        <span className="acr-vc-barras" role="img" aria-label={`${pct(fila.baseShare)} del universo, ${pct(fila.effectiveShare)} de las efectivas`}>
                          <span className="acr-vc-barra is-universo"><i style={{ width: `${Math.min(100, fila.baseShare ?? 0)}%` }} /></span>
                          <span className="acr-av-num acr-vc-pct">{pct(fila.baseShare)}</span>
                          <span className="acr-vc-barra is-efectivas"><i style={{ width: `${Math.min(100, fila.effectiveShare ?? 0)}%` }} /></span>
                          <span className="acr-av-num acr-vc-pct">{pct(fila.effectiveShare)}</span>
                        </span>
                      </td>
                      <td className={`is-num${diferenciaMarcada(fila.deltaPp) ? " is-marcada" : ""}`}>{puntos(fila.deltaPp)}</td>
                      <td className="is-num">{fmt(fila.partial)}</td>
                      <td className="is-num">{fmt(fila.refusals)}</td>
                    </tr>
                  ))}
                </tbody>
              )))}
            </table>
          </div>
        ) : (
          <VacioDeBloque icono={<SlidersHorizontal size={15} />} titulo="El corte no trae variables de control." descripcion="Aparecen cuando el padrón declara año de egreso, dedicación o área." />
        )}
        {grupos.length ? (
          <span className="acr-av-leyenda is-centrada">
            <span><i className="acr-vc-punto is-universo" aria-hidden="true" />% del universo</span>
            <span><i className="acr-vc-punto is-efectivas" aria-hidden="true" />% de las efectivas</span>
          </span>
        ) : null}
      </section>
      {reporte}
    </div>
  );
}
