import { pctConEspacio } from "../../../core/formatoComun";
import type { TelefonicoStatusMatrix } from "../telefonicoTeamModel";

/**
 * Status por operador en porcentaje y casos, con la fila del equipo arriba.
 * Una celda se tiñe cuando el operador se aparta 12 puntos o más de la mediana
 * del equipo (ámbar por encima, azul por debajo); la regla es la de
 * `telefonicoTeamModel.ts`, la misma de la vista anterior.
 */
export function EquipoMatriz({
  matriz,
  elegido,
  onElegir,
}: {
  matriz: TelefonicoStatusMatrix;
  elegido: string | null;
  onElegir: (nombre: string) => void;
}) {
  return (
    <>
      <div className="mon-ctl-tabla-marco">
        <table className="mon-ctl-tabla mon-equipo-matriz">
          <thead>
            <tr>
              <th scope="col">Operador</th>
              <th scope="col" className="is-num">Casos</th>
              {matriz.estados.map((estado) => <th key={estado} scope="col" className="is-num">{estado}</th>)}
            </tr>
          </thead>
          <tbody>
            <tr className="is-equipo">
              <th scope="row">Equipo</th>
              <td className="is-num">{matriz.total.toLocaleString("es-PE")}</td>
              {matriz.general.map((celda) => (
                <td key={celda.estado}>
                  <span>{pctConEspacio(celda.pct)}</span>
                  <small>{celda.casos.toLocaleString("es-PE")} casos</small>
                </td>
              ))}
            </tr>
            {matriz.responsables.map((fila) => {
              const activo = fila.responsable === elegido;
              return (
                <tr key={fila.key} className={activo ? "is-activo" : undefined} aria-current={activo ? "true" : undefined}>
                  <th scope="row">
                    <button type="button" onClick={() => onElegir(fila.responsable)}>{fila.responsable}</button>
                  </th>
                  <td className="is-num">{fila.total.toLocaleString("es-PE")}</td>
                  {fila.celdas.map((celda) => (
                    <td
                      key={celda.estado}
                      className={celda.senal === "normal" ? undefined : `is-${celda.senal}`}
                      title={celda.desviacion == null ? undefined : `${celda.desviacion > 0 ? "+" : ""}${celda.desviacion.toLocaleString("es-PE", { maximumFractionDigits: 1 })} puntos frente a la mediana`}
                    >
                      <span>{pctConEspacio(celda.pct)}</span>
                      <small>{celda.casos.toLocaleString("es-PE")}</small>
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {/* Leyenda de rótulos cortos y centrada; la regla de la mediana va una sola vez, en su tooltip. */}
      <footer className="mon-equipo-leyenda" title={`12 puntos o más frente a la mediana del equipo, calculada sobre los operadores con ${matriz.minimoParaComparar} casos o más`}>
        <span><i className="is-alta" aria-hidden="true" />Sobre la mediana</span>
        <span><i className="is-baja" aria-hidden="true" />Bajo la mediana</span>
      </footer>
    </>
  );
}
