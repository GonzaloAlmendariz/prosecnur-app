import type { TerritorialQuotaProgressBlock } from "../../../../../api/client";
import { diaYMes, fmt, fmtConSigno, rotuloDeCelda } from "../rotulos";
import type { FilaDeUmp } from "./faltanteModel";

/**
 * Detalle desplegable de una UMP en la cuota (paridad con Validación › Cuotas,
 * §1b): lo levantado por los encuestadores, lo subsanado y la falta real; la
 * matriz observada sexo por edad con el ajuste de cada celda; y las otras
 * manzanas de la UMP con su estado.
 */
export function DetalleDeUmp({ fila }: { fila: FilaDeUmp }) {
  const bloque = fila.bloque;
  const cruce = bloque.observed_cross ?? null;
  const columnas = cruce?.columns ?? [];
  const filas = cruce?.rows ?? [];
  const delta = fila.ganancia - fila.perdida;
  const observado = Math.max(0, Math.round(Number(bloque.observed_validas ?? fila.logrado - delta) || 0));
  const celdasAjustadas = fila.celdas.filter((celda) => celda.delta !== 0).map((celda) => celda.rotulo);
  return (
    <div className="mon-falt-detalle">
      <dl className="mon-falt-capas">
        <div>
          <dt>Encuestadores</dt>
          <dd><b>{fmt(observado)}</b> casos con consentimiento en la manzana</dd>
        </div>
        <div>
          <dt>Subsanado</dt>
          <dd>
            <b>{delta === 0 ? "0" : fmtConSigno(delta)}</b>{" "}
            {celdasAjustadas.length
              ? `${delta < 0 ? "Resta de" : "Aporta a"} ${celdasAjustadas.join(", ")}`
              : "Sin subsanaciones aplicadas"}
          </dd>
        </div>
        <div>
          <dt>Falta real</dt>
          <dd>
            <b>{fmt(fila.falta)}</b>{" "}
            {fila.falta > 0 ? fila.faltantes.map((item) => item.texto).join(", ") : "Ninguna después de subsanar"}
          </dd>
        </div>
        <div>
          <dt>Último caso</dt>
          <dd><b>{fila.ultimoCaso || "—"}</b> {fila.aplicadorCompleto ? `por ${fila.aplicador}` : ""}</dd>
        </div>
      </dl>
      {filas.length && columnas.length ? (
        <table className="mon-falt-cruce" aria-label={`UMP ${fila.ump}: casos observados por sexo y edad`}>
          <thead>
            <tr>
              <th scope="col">Sexo</th>
              {columnas.map((columna) => <th key={columna.label} scope="col">{rotuloDeCelda(columna.label)}</th>)}
              <th scope="col">Total</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((renglon) => (
              <tr key={renglon.label}>
                <th scope="row">{rotuloDeCelda(renglon.label)}</th>
                {columnas.map((columna) => {
                  const celda = (renglon.cells ?? []).find((item) => String(item.label || item.age) === String(columna.label));
                  const ajuste = Math.round(Number(celda?.adjustment_delta ?? 0) || 0);
                  return (
                    <td key={columna.label}>
                      {fmt(celda?.value ?? 0)}
                      {ajuste !== 0 ? <b className={ajuste > 0 ? "is-recibe" : "is-cede"}>{fmtConSigno(ajuste)}</b> : null}
                    </td>
                  );
                })}
                <td>
                  {fmt(renglon.total)}
                  {renglon.target != null ? <span className="mon-falt-de"> de {fmt(renglon.target)}</span> : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="mon-falt-detalle-vacio">La manzana en uso no tiene casos con consentimiento.</p>
      )}
      {fila.otras.length ? (
        <ul className="mon-falt-otras" aria-label="Otras manzanas de la UMP">
          {fila.otras.map((otra) => <OtraManzana key={otra.id_manzana} bloque={otra} />)}
        </ul>
      ) : null}
    </div>
  );
}

function OtraManzana({ bloque }: { bloque: TerritorialQuotaProgressBlock }) {
  const tipo = String(bloque.tipo_manzana ?? "").toLowerCase() === "reemplazo" ? "Reemplazo" : "Titular";
  const ultimo = diaYMes(bloque.last_response_date_iso || bloque.last_response_date_label);
  return (
    <li>
      <b>{tipo} {bloque.manzana}</b>
      <span>{fmt(bloque.validas)} de {fmt(bloque.target)} casos</span>
      <span>{ultimo ? `último caso el ${ultimo}` : "sin casos"}</span>
      <span>Ya no se usa</span>
    </li>
  );
}
