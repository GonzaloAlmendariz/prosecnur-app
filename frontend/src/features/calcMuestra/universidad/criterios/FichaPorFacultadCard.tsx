/**
 * La ficha de cada facultad: los seis pasos y la columna del estudio anterior.
 *
 * Es la cadena entera que Gonzalo pidió ver: cuántos alumnos se calcularon para
 * la muestra, cuánta es la muestra, cuántas aulas del catálogo pasan los
 * criterios, cuántos alumnos hay por curso-horario, cuántas aulas hacen falta y
 * si quedan reemplazos para cada titular — «no tiene que ser la misma cantidad
 * de reemplazos que en otras facultades con más aulas, pero al menos debería
 * tener reemplazos».
 *
 * La columna de 2025 va **en cada paso**, no en un resumen aparte: una cuota que
 * cambió y unas aulas que se desplomaron significan cosas distintas, y sólo se
 * distinguen mirando el paso donde ocurren.
 */
import { useState } from "react";
import type { FichaFacultad } from "./fichaFacultadModel";
import { fmtInt } from "../../sharedCore";

function delta(hoy: number | null, antes: number | null): string {
  if (hoy == null || antes == null) return "";
  const d = hoy - antes;
  if (d === 0) return "igual";
  return `${d > 0 ? "+" : ""}${fmtInt(d)}`;
}

function Ficha({
  ficha,
  periodo,
  comparando,
}: {
  ficha: FichaFacultad;
  periodo: string;
  comparando: boolean;
}) {
  const [abierta, setAbierta] = useState(false);
  const paso5 = ficha.pasos.find((p) => p.n === 5);
  const paso3 = ficha.pasos.find((p) => p.n === 3);
  // Lo que se lee de un vistazo antes de abrir: si le alcanzan las aulas.
  const alcanza =
    paso5?.hoy != null && paso3?.hoy != null ? paso3.hoy >= paso5.hoy : null;

  return (
    <li className="cmv2-ficha" data-alcanza={alcanza == null ? "sin-dato" : String(alcanza)}>
      <button
        type="button"
        className="cmv2-ficha-head"
        aria-expanded={abierta}
        onClick={() => setAbierta((v) => !v)}
      >
        <strong>{ficha.facultad}</strong>
        <span className="cmv2-ficha-resumen">
          {paso5?.hoy != null ? <>necesita {fmtInt(paso5.hoy)}</> : null}
          {paso3?.hoy != null ? <> · tiene {fmtInt(paso3.hoy)}</> : null}
          {ficha.reservasSostenibles != null ? (
            <>
              {" · "}
              {ficha.reservasSostenibles === 0
                ? "sin reservas"
                : `${fmtInt(ficha.reservasSostenibles)} reservas por titular`}
              {ficha.reservasPedidas != null ? ` de ${fmtInt(ficha.reservasPedidas)}` : null}
            </>
          ) : null}
        </span>
      </button>
      {/* Las reglas que rigen SÓLO aquí van FUERA del colapso: son lo que
          distingue a esta facultad de las demás y hay que verlas recorriendo la
          lista, sin abrir quince fichas. Dentro queda sólo la nota de que no
          tiene ninguna, que es detalle. */}
      {ficha.criteriosPropios.length ? (
        <p className="cmv2-ficha-propios">
          <span className="cmv2-ficha-propios-titulo">Criterios propios:</span>{" "}
          {ficha.criteriosPropios.map((c, i) => (
            <span key={c.etiqueta} className="cmv2-ficha-propio" data-clase={c.clase}>
              {i > 0 ? " · " : null}
              {c.etiqueta} <small>({c.detalle})</small>
            </span>
          ))}
        </p>
      ) : null}
      {abierta ? (
        <>
          {ficha.criteriosPropios.length ? null : (
            <p className="cmv2-ficha-propios cmv2-ficha-propios-vacio">
              Sin criterios propios: usa los generales.
            </p>
          )}
          <div className="cmv2-ficha-wrap">
            <table className="cmv2-ficha-tabla">
              <thead>
                <tr>
                  <th scope="col">Paso</th>
                  <th scope="col">Este estudio</th>
                  {comparando ? (
                    <>
                      <th scope="col">{periodo || "Anterior"}</th>
                      <th scope="col">Δ</th>
                    </>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {ficha.pasos.map((p) => (
                  <tr key={p.n}>
                    <th scope="row">
                      <span className="cmv2-ficha-n">{p.n}</span> {p.titulo}
                      <small>{p.detalle}</small>
                    </th>
                    <td>{p.hoy != null ? fmtInt(p.hoy) : "—"}</td>
                    {comparando ? (
                      <>
                        <td>{p.antes != null ? fmtInt(p.antes) : "—"}</td>
                        <td>{delta(p.hoy, p.antes) || "—"}</td>
                      </>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {ficha.aviso ? <p className="cmv2-ficha-aviso">{ficha.aviso}</p> : null}
        </>
      ) : null}
    </li>
  );
}

export function FichaPorFacultadCard({
  fichas,
  periodo = "",
}: {
  fichas: FichaFacultad[];
  periodo?: string;
}) {
  // C3: la superficie contiene su propio vacío. Medido contra HSVG2026 abierto:
  // sin estratos calculados la tarjeta desaparecía entera, y desde la pestaña no
  // se distingue «todavía no corriste el cálculo» de «esta tarjeta no existe».
  if (!fichas.length) {
    return (
      <section className="cmv2-ficha-card cmv2-ficha-card-vacia" aria-label="Ficha por facultad">
        <header>
          <strong>Cada facultad, paso a paso</strong>
          <span>
            Todavía no hay estratos calculados: las fichas por facultad aparecen
            cuando el motor resuelve la muestra en la sección <strong>Cálculo</strong>.
          </span>
        </header>
      </section>
    );
  }
  const sinMargen = fichas.filter((f) => f.reservasSostenibles === 0).length;
  // Igual que en la tarjeta general: sin ninguna cifra del estudio anterior, sus
  // dos columnas son noventa celdas vacias.
  const comparando = fichas.some((f) => f.pasos.some((p) => p.antes != null));

  return (
    <section className="cmv2-ficha-card" aria-label="Ficha por facultad">
      <header>
        <strong>Cada facultad, paso a paso</strong>
        <span>
          De la población a las aulas que hay que visitar, con lo que hizo{" "}
          {periodo || "el estudio anterior"} al lado.
          {sinMargen > 0 ? (
            <>
              {" "}
              <strong>{fmtInt(sinMargen)}</strong> de {fmtInt(fichas.length)} no dejan
              ninguna aula para reemplazar.
            </>
          ) : null}
        </span>
      </header>
      <ul className="cmv2-ficha-lista">
        {fichas.map((f) => (
          <Ficha key={f.facultad} ficha={f} periodo={periodo} comparando={comparando} />
        ))}
      </ul>
    </section>
  );
}
