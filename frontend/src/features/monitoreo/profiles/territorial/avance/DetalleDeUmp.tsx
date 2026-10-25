import type { TerritorialQuotaProgressBlock } from "../../../../../api/client";
import { diaYMes, fmt, fmtConSigno, rotuloDeCelda } from "../rotulos";
import type { FilaDeUmp } from "./faltanteModel";
import { CuotaPorVariable } from "./CuotaPorVariable";
import { SiluetaDeDistrito } from "./SiluetaDeDistrito";

/**
 * Tarjeta de una UMP, desplegada bajo su fila de la cuota. Sigue a la tarjeta
 * de Validación › Cuotas que Gonzalo tomó de modelo (§2a-bis): cabecera con
 * distrito, zona y manzana y el estado en chip; responsable y actividad en sus
 * celdas; una sub-tarjeta por variable de cuota; y «Encuestadores» con lo
 * levantado, lo subsanado, la falta real y la matriz sexo por edad. Al pie, las
 * otras manzanas de la UMP.
 */
const ROTULO_DE_ESTADO = { pendiente: "Cuota pendiente", subsanada: "Completa con subsanación", completa: "Completa" } as const;
const TONO_DE_ESTADO = { pendiente: "is-falta", subsanada: "is-info", completa: "is-ok" } as const;

export function DetalleDeUmp({ fila }: { fila: FilaDeUmp }) {
  const bloque = fila.bloque;
  const cruce = bloque.observed_cross ?? null;
  const columnas = cruce?.columns ?? [];
  const filas = cruce?.rows ?? [];
  const delta = fila.ganancia - fila.perdida;
  const observado = Math.max(0, Math.round(Number(bloque.observed_validas ?? fila.logrado - delta) || 0));
  const celdasAjustadas = fila.celdas.filter((celda) => celda.delta !== 0).map((celda) => celda.rotulo);
  const avance = fila.meta > 0 ? Math.min(100, (fila.logrado / fila.meta) * 100) : 0;
  const ubicacion = [
    fila.distrito,
    fila.zona ? `Zona ${fila.zona}` : "",
    `Mz ${fila.manzana}`,
    fila.reemplazo ? "Reemplazo" : "Titular",
  ].filter(Boolean).join(" · ");
  return (
    <article className={`mon-falt-detalle is-${fila.estado}`} aria-label={`Cuota de la UMP ${fila.ump}`}>
      <header className="mon-falt-detalle-cabecera">
        <SiluetaDeDistrito distrito={fila.distrito} tono={fila.estado === "pendiente" ? "falta" : fila.estado === "subsanada" ? "info" : "ok"} lado={40} />
        <span className="mon-falt-detalle-titulo">
          <small>{ubicacion}</small>
          <strong>UMP {fila.ump}</strong>
        </span>
        <span className={`mon-ter-chip ${TONO_DE_ESTADO[fila.estado]}`}>{ROTULO_DE_ESTADO[fila.estado]}</span>
      </header>

      <dl className="mon-falt-detalle-meta">
        <div><dt>Responsable</dt><dd title={fila.aplicadorCompleto || undefined}>{fila.aplicador || "Sin responsable"}</dd></div>
        <div><dt>Actividad</dt><dd>{fila.ultimoCaso ? `Último caso el ${fila.ultimoCaso}` : "Sin casos en Kobo"}</dd></div>
        <div><dt>Cuentan</dt><dd><b>{fmt(fila.logrado)}</b> de {fmt(fila.meta)}</dd></div>
      </dl>
      <i className="mon-falt-detalle-barra" aria-hidden="true"><b style={{ width: `${avance}%` }} /></i>

      <CuotaPorVariable variables={fila.variables} titulo={`Cuota de la UMP ${fila.ump}`} />

      <section className="mon-falt-encuestadores" aria-label="Lo levantado en campo, lo subsanado y la falta real">
        <header>
          <h5>Encuestadores</h5>
          <span>{fmt(observado)} casos con consentimiento en la manzana</span>
        </header>
        <dl className="mon-falt-capas" data-qa-geometry-group={`territorial-falt-capas-${fila.ump}`} data-qa-geometry-contract="equal">
          <div data-qa-geometry-member="levantado">
            <dt>Levantado en campo</dt>
            <dd><b>{fmt(observado)}</b><span>casos de los encuestadores</span></dd>
          </div>
          <div data-qa-geometry-member="subsanado" className={delta !== 0 ? "is-info" : ""}>
            <dt>Subsanado</dt>
            <dd>
              <b>{delta === 0 ? "0" : fmtConSigno(delta)}</b>
              <span>
                {celdasAjustadas.length
                  ? `${delta < 0 ? "Resta de" : "Aporta a"} ${celdasAjustadas.join(", ")}`
                  : "Sin subsanaciones aplicadas"}
              </span>
            </dd>
          </div>
          <div data-qa-geometry-member="falta" className={fila.falta > 0 ? "is-falta" : "is-ok"}>
            <dt>Falta real</dt>
            <dd>
              <b>{fmt(fila.falta)}</b>
              <span>{fila.falta > 0 ? fila.faltantes.map((item) => item.texto).join(", ") : "Ninguna después de subsanar"}</span>
            </dd>
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
      </section>

      {fila.otras.length ? (
        <ul className="mon-falt-otras" aria-label="Otras manzanas de la UMP">
          {fila.otras.map((otra) => <OtraManzana key={otra.id_manzana} bloque={otra} />)}
        </ul>
      ) : null}
    </article>
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
