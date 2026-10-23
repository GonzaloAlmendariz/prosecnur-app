import type { CSSProperties } from "react";
import { NotaDelModo } from "../../../core/NotaDelModo";
import { pctConEspacio } from "../../../core/formatoComun";
import { FAMILIAS_DEL_CLIENTE, rotuloDeRegla } from "./familiasDelCliente";
import type { Barrido as Modelo, FilaDeCategoria } from "./barridoModel";
import "./controlTelefonico.css";

function n(valor: number | null | undefined) {
  return valor == null ? "—" : valor.toLocaleString("es-PE");
}

function porcentaje(valor: number | null) {
  return pctConEspacio(valor);
}

const ETIQUETA = new Map(FAMILIAS_DEL_CLIENTE.map((item) => [item.id, item.etiqueta]));

/** Tarjeta del embudo: misma estructura en las cuatro (estándar §2a, 5b). */
function Tarjeta({ rotulo, valor, base, tramos, nota }: {
  rotulo: string;
  valor: number;
  base: number;
  tramos: Array<{ clave: string; valor: number }>;
  nota: string;
}) {
  return (
    <div className="mon-barrido-tarjeta">
      <span className="mon-ctl-antetitulo">{rotulo}</span>
      <strong className="is-num">{n(valor)}</strong>
      <span className="mon-barrido-tarjeta-barra" aria-hidden="true">
        {tramos.map((tramo) => (
          <i key={tramo.clave} className={`is-${tramo.clave}`} style={{ width: `${base > 0 ? (tramo.valor / base) * 100 : 0}%` }} />
        ))}
      </span>
      <span className="mon-barrido-tarjeta-nota">{nota}</span>
    </div>
  );
}

function FilaDeLaMatriz({ fila, total = false }: { fila: FilaDeCategoria; total?: boolean }) {
  const Celda = total ? "th" : "td";
  return (
    <tr className={total ? "is-total" : undefined}>
      <th scope="row">{fila.nombre}</th>
      <Celda className="is-num">{n(fila.listado)}</Celda>
      <Celda className="is-num">{n(fila.llamados)}</Celda>
      <Celda className="mon-barrido-pct">
        <i aria-hidden="true"><b style={{ width: `${Math.min(100, fila.pctLlamado ?? 0)}%` }} /></i>
        <span className="is-num">{porcentaje(fila.pctLlamado)}</span>
      </Celda>
      <Celda className="is-num">{n(fila.parcial)}</Celda>
      <Celda className="is-num">{n(fila.rechazo)}</Celda>
      <Celda className="is-num">{n(fila.sinLlamar)}</Celda>
      <Celda className="is-num">{n(fila.efectivasKobo)}</Celda>
    </tr>
  );
}

/**
 * Control › Barrido: cómo rinde la hoja. Embudo de cuatro tarjetas simétricas,
 * la base por categoría de cuota, los llamados por fecha del último intento,
 * lo que falta llamar y, a la derecha, los status del cliente con su regla.
 */
export function Barrido({ modelo, segmento }: { modelo: Modelo; segmento: string }) {
  const segmentoMinuscula = segmento.toLocaleLowerCase("es");
  const maximoFecha = Math.max(1, ...modelo.porFecha.map((item) => item.casos), modelo.otraFecha);
  const maximoSinLlamar = Math.max(1, ...modelo.categorias.map((fila) => fila.sinLlamar));
  return (
    <div className="mon-barrido" data-qa-geometry-group="telefonico-control-barrido" data-qa-geometry-contract="intrinsic">
      <div className="mon-barrido-principal">
        <section className="mon-ctl-panel mon-barrido-embudo" aria-label="Embudo del barrido">
          <Tarjeta
            rotulo="Listado"
            valor={modelo.listado}
            base={modelo.listado}
            tramos={[{ clave: "llamados", valor: modelo.llamados }, { clave: "sin-llamar", valor: modelo.sinLlamar }]}
            nota={`${n(modelo.llamados)} llamados y ${n(modelo.sinLlamar)} sin llamar`}
          />
          <Tarjeta
            rotulo="Llamados"
            valor={modelo.llamados}
            base={modelo.listado}
            tramos={[{ clave: "llamados", valor: modelo.llamados }]}
            nota={`${porcentaje(modelo.listado ? (modelo.llamados / modelo.listado) * 100 : null)} del listado`}
          />
          <Tarjeta
            rotulo="Efectivas en la hoja"
            valor={modelo.efectivasHoja}
            base={modelo.llamados}
            tramos={[{ clave: "efectiva", valor: modelo.efectivasHoja }]}
            nota={`${porcentaje(modelo.llamados ? (modelo.efectivasHoja / modelo.llamados) * 100 : null)} de los llamados; Kobo registra ${n(modelo.efectivasKobo)}`}
          />
          <Tarjeta
            rotulo="Sin llamar"
            valor={modelo.sinLlamar}
            base={modelo.listado}
            tramos={[{ clave: "sin-llamar", valor: modelo.sinLlamar }]}
            nota={modelo.sinAsignar != null && modelo.porLlamarAsignados != null
              ? `${n(modelo.porLlamarAsignados)} asignados y ${n(modelo.sinAsignar)} sin asignar`
              : `${porcentaje(modelo.listado ? (modelo.sinLlamar / modelo.listado) * 100 : null)} del listado`}
          />
        </section>

        <section className="mon-ctl-panel mon-barrido-matriz" aria-label={`Listado por ${segmentoMinuscula}`}>
          <header className="mon-ctl-panel-cabecera">
            <b>Listado por {segmentoMinuscula}</b>
            <span>{n(modelo.categorias.length ? modelo.total.listado : modelo.listado)} casos</span>
          </header>
          {modelo.categorias.length ? (
          <div className="mon-ctl-tabla-marco">
            <table className="mon-ctl-tabla">
              <thead>
                <tr>
                  <th scope="col">{segmento}</th>
                  <th scope="col" className="is-num">Listado</th>
                  <th scope="col" className="is-num">Llamados</th>
                  <th scope="col">% llamado</th>
                  <th scope="col" className="is-num">Parcial</th>
                  <th scope="col" className="is-num">Rechazo</th>
                  <th scope="col" className="is-num">Sin llamar</th>
                  <th scope="col" className="is-num">Efectivas Kobo</th>
                </tr>
              </thead>
              <tbody>
                {modelo.categorias.map((fila) => <FilaDeLaMatriz key={fila.nombre} fila={fila} />)}
              </tbody>
              <tfoot>
                <FilaDeLaMatriz fila={modelo.total} total />
              </tfoot>
            </table>
          </div>
          ) : (
            <NotaDelModo tono="neutro" className="mon-barrido-nota">
              El listado de {n(modelo.listado)} casos no se reparte por cuota hasta declarar el eje en Modelo, Cuotas.
            </NotaDelModo>
          )}
        </section>

        <div className="mon-barrido-pie">
          <section className="mon-ctl-panel mon-barrido-fechas" aria-label="Llamados por fecha del último intento">
            <header className="mon-ctl-panel-cabecera">
              <b>Llamados por fecha del último intento</b>
              <span>{n(modelo.llamados)} casos</span>
            </header>
            {modelo.porFecha.length || modelo.otraFecha ? (
            <div className="mon-barrido-columnas" role="img" aria-label={[
              ...modelo.porFecha.map((item) => `${item.fecha}: ${n(item.casos)}`),
              modelo.otraFecha ? `otra o sin fecha: ${n(modelo.otraFecha)}` : "",
            ].filter(Boolean).join(", ")}>
              {[...modelo.porFecha, ...(modelo.otraFecha ? [{ fecha: "Otra o sin fecha", casos: modelo.otraFecha }] : [])].map((item) => (
                <span key={item.fecha} className={item.fecha === "Otra o sin fecha" ? "is-otra" : undefined}>
                  <b className="is-num">{n(item.casos)}</b>
                  <i style={{ "--alto": `${(item.casos / maximoFecha) * 100}%` } as CSSProperties} />
                  <em>{item.fecha}</em>
                </span>
              ))}
            </div>
            ) : (
              <p className="mon-barrido-vacio">Ningún caso llamado todavía.</p>
            )}
            <NotaDelModo tono="neutro" className="mon-barrido-nota">La hoja guarda solo la fecha del último intento de cada caso.</NotaDelModo>
          </section>
          <section className="mon-ctl-panel mon-barrido-sin-llamar" aria-label="Sin llamar">
            <header className="mon-ctl-panel-cabecera">
              <b>Sin llamar</b>
              <span>{n(modelo.sinLlamar)} del listado</span>
            </header>
            {modelo.categorias.length ? (
            <ul>
              {[...modelo.categorias].sort((a, b) => b.sinLlamar - a.sinLlamar).map((fila) => (
                <li key={fila.nombre}>
                  <span>{fila.nombre}</span>
                  <i aria-hidden="true"><b style={{ width: `${(fila.sinLlamar / maximoSinLlamar) * 100}%` }} /></i>
                  <strong className="is-num">{n(fila.sinLlamar)}</strong>
                </li>
              ))}
            </ul>
            ) : (
              <p className="mon-barrido-vacio">Sin eje de cuota, lo que falta llamar no se reparte por categoría.</p>
            )}
            <footer className="mon-barrido-reparto">
              <span><span className="mon-ctl-antetitulo">Asignados</span><b className="is-num">{n(modelo.porLlamarAsignados)}</b></span>
              <span><span className="mon-ctl-antetitulo">Sin asignar</span><b className="is-num">{n(modelo.sinAsignar)}</b></span>
            </footer>
          </section>
        </div>
      </div>

      <section className="mon-ctl-panel mon-barrido-status" aria-label="Status del cliente">
        <header className="mon-ctl-panel-cabecera">
          <span className="mon-ctl-antetitulo">Status del cliente</span>
        </header>
        <div className="mon-barrido-status-lista">
          {modelo.status.length ? null : (
            <p className="mon-barrido-vacio">Ningún caso llamado: los {n(modelo.sinLlamar)} del listado siguen sin barrer.</p>
          )}
          {modelo.status.map((grupo) => (
            <div key={grupo.familia} className={`mon-barrido-familia is-${grupo.familia}`}>
              <span className="mon-barrido-familia-titulo">
                <i aria-hidden="true" />
                <b>{ETIQUETA.get(grupo.familia)}</b>
                <strong className="is-num">{n(grupo.total)}</strong>
              </span>
              <ul>
                {grupo.items.map((item) => (
                  <li key={item.status}>
                    <span>
                      {item.status}
                      {item.conRegla ? null : <em className="mon-ctl-sin-regla" title="El vocabulario del proyecto no declara este status">sin regla</em>}
                      {item.porRegla ? <em className="mon-ctl-por-regla">{rotuloDeRegla(grupo.familia)}</em> : null}
                    </span>
                    <i aria-hidden="true"><b style={{ width: `${(item.casos / modelo.maximoStatus) * 100}%` }} /></i>
                    <strong className="is-num">{n(item.casos)}</strong>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <NotaDelModo tono="info" className="mon-barrido-no-registra">
            <strong>Lo que la hoja no registra.</strong> Un status por caso, el del último intento: la hoja no guarda cada
            llamada, su hora ni el número marcado.
          </NotaDelModo>
        </div>
        <footer className="mon-barrido-status-pie">
          <span className="mon-tel-chip">No barrido {n(modelo.sinLlamar)}</span>
        </footer>
      </section>
    </div>
  );
}
