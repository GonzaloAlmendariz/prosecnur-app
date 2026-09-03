import { useState } from "react";

import { AlertTriangle } from "../../../../vendor/lucide-react";
import { ChipDato, ChipHora, ChipLugar } from "./AulasSistemaPabellon";
import type { RepartoVista } from "./repartoDeAplicadores";
import { fmt } from "./kpisDeAulas";

/**
 * El cuarto cuadro de Carga de campo: la pestaña de Asignación (dictado
 * 2026-09-02: «necesitaríamos una pestaña de asignación… para poder hacer una
 * asignación equitativa en base a lo que ya tenemos de momento, pero que sea
 * repetible por si llegan nuevas confirmaciones»).
 *
 * Es la hoja de trabajo del jefe de campo: cada fecha con sus citas repartidas
 * —qué cita, en qué ventana, con quién—, lo DESCUBIERTO destacado arriba de su
 * día (es el problema operativo, no un pie de página) y el rail de cargas por
 * aplicador al lado, con los de cero a la vista: estar libre es un dato del
 * reparto, no una ausencia.
 *
 * Hover o foco sobre un aplicador del rail resalta sus citas en los días —la
 * pregunta «¿qué le tocó a Ana?» se contesta sin leer la lista entera— y un
 * click lo deja fijado, el mismo gesto que las franjas de la malla.
 *
 * El reparto en sí es del MOTOR (greedy determinista, B29) y su vigencia es la
 * promesa del dictado: se recalcula con cada Recargar, sin memoria — una
 * confirmación nueva entra sola. Aquí no se reordena ni se recalcula nada.
 */

/**
 * Los códigos se listan COMPLETOS, sin techo (dictado 2026-09-02: «no pones
 * las cosas completas y actúas como si no tuvieras espacio cuando la pestaña
 * puede darle más espacio sin problema») y cada uno en su chip (veredicto del
 * mismo día: el sistema de chips es mandato transversal en Carga de campo).
 * La fila larga envuelve y crece hacia abajo; esconder quedó revocado.
 */
const chipsDeCodigos = (codigos: readonly string[]) =>
  codigos.map((c) => <ChipDato key={c}>{c}</ChipDato>);

export function AulasAsignacionDeAplicadores({
  reparto,
  lugares,
}: {
  /** `null` = la sesión no cargó la disponibilidad; se declara, no se rompe. */
  reparto: RepartoVista | null;
  /**
   * Código → lugar de la cita (`lugaresDelPlan`): el bloque `reparto` viaja
   * sin lugares y el jefe de campo reparte por edificio. Opcional: sin mapa,
   * la columna calla en vez de inventar.
   */
  lugares?: ReadonlyMap<string, string>;
}) {
  // El aplicador explorado desde el rail. Estado UI efímero de esta
  // superficie: no es un panel enlazable ni un foco de entidad — el mismo
  // criterio que la franja activa de la malla.
  const [enFoco, setEnFoco] = useState<string | null>(null);
  const [fijado, setFijado] = useState(false);

  if (!reparto) {
    return (
      <p className="aulas-carga-vacio" data-qa-geometry-member="true" data-qa-geometry-capacity="owned">
        El reparto sale de la disponibilidad de los aplicadores, que este estudio todavía no
        tiene cargada. Con el libro de disponibilidad del equipo (Excel) en la sesión, cada cita
        pactada recibe su aplicador: parejo, sin solapes y repetible con cada Recargar.
      </p>
    );
  }

  const resaltando = enFoco !== null;
  const claseDeFila = (aplicador: string): string | undefined => {
    if (!resaltando) return undefined;
    return aplicador === enFoco ? "es-resaltada" : "es-apagada";
  };

  return (
    <div className="aulas-asigna">
      <div className="aulas-carga-controles" data-qa-geometry-capacity="owned" data-qa-geometry-member="true">
        {/* La promesa del dictado, en una línea sobria: qué es este reparto y
            hasta cuándo vale. */}
        <p className="aulas-asigna-vigencia">
          Reparto <strong>vigente</strong> sobre lo agendado hasta hoy: se recalcula con cada
          Recargar y una confirmación nueva entra sola.
        </p>
        <dl className="aulas-carga-kpis">
          <div>
            <dt>Citas repartidas</dt>
            <dd>{fmt(reparto.citas)}</dd>
          </div>
          <div>
            <dt>Sin nadie que llegue</dt>
            <dd className={reparto.sinCubrir > 0 ? "es-descubierto" : undefined}>{fmt(reparto.sinCubrir)}</dd>
          </div>
          <div>
            <dt>Por confirmar</dt>
            <dd>{fmt(reparto.porConfirmar)}</dd>
          </div>
          <div>
            <dt>Aplicadores con carga</dt>
            <dd>
              {fmt(reparto.conCarga)}
              <span className="aulas-asigna-de"> de {fmt(reparto.equidad.length)}</span>
            </dd>
          </div>
        </dl>
      </div>

      <div className="aulas-asigna-cuerpo" data-qa-geometry-member data-qa-geometry-capacity="owned">
        <div className="aulas-asigna-dias">
          {reparto.dias.length === 0 ? (
            <p className="aulas-asigna-sin-dias">
              Nada que repartir todavía: ninguna cita pactada con fecha y hora. En cuanto se
              agende la primera, aparece aquí con su aplicador.
            </p>
          ) : (
            reparto.dias.map((d) => (
              <section key={d.fecha} className="aulas-asigna-dia">
                <h4>
                  {d.etiqueta}
                  <span>
                    {" "}· {fmt(d.asignaciones.length)}{" "}
                    {d.asignaciones.length === 1 ? "cita repartida" : "citas repartidas"}
                  </span>
                </h4>
                {d.noCubiertos.length > 0 ? (
                  /* Destacado y ARRIBA de su día: la cita descubierta es lo que
                     el jefe de campo tiene que resolver antes de esa fecha. */
                  <p className="aulas-asigna-descubiertos">
                    <AlertTriangle size={14} aria-hidden="true" />
                    <strong>
                      {fmt(d.noCubiertos.length)}{" "}
                      {d.noCubiertos.length === 1 ? "cita pactada" : "citas pactadas"} sin nadie
                      que llegue:
                    </strong>{" "}
                    {chipsDeCodigos(d.noCubiertos)}
                  </p>
                ) : null}
                {d.asignaciones.length > 0 ? (
                  <table className="aulas-asigna-tabla">
                    <thead>
                      <tr>
                        <th scope="col">Cita</th>
                        <th scope="col">Lugar</th>
                        <th scope="col">Ventana</th>
                        <th scope="col">Aplicador</th>
                      </tr>
                    </thead>
                    <tbody>
                      {d.asignaciones.map((a) => {
                        const lugar = lugares?.get(a.codigo) ?? "";
                        return (
                          <tr key={a.codigo} className={claseDeFila(a.aplicador)}>
                            <th scope="row">{a.codigo}</th>
                            {/* El chip del lugar con el color de su letra
                                (dictado 2026-09-02); sin lugar conocido la
                                columna calla, no inventa. */}
                            <td>{lugar ? <ChipLugar lugar={lugar} /> : ""}</td>
                            <td>
                              {a.inicio && a.fin
                                ? <ChipHora>{a.inicio}–{a.fin}</ChipHora>
                                : a.inicio ? <ChipHora>{a.inicio}</ChipHora> : "—"}
                            </td>
                            <td>{a.aplicador}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                ) : null}
                {d.porConfirmar.length > 0 ? (
                  /* El vocabulario de B11: la fecha sin hora pactada no pide
                     gente todavía. Se declara para que el día no parezca más
                     resuelto de lo que está; asignarle a alguien sería
                     inventar una cita. */
                  <p className="aulas-asigna-pendientes">
                    Por confirmar: {chipsDeCodigos(d.porConfirmar)} — fecha sin hora pactada; no
                    piden gente todavía.
                  </p>
                ) : null}
              </section>
            ))
          )}
        </div>

        <aside
          className="aulas-asigna-equidad"
          onMouseLeave={() => { if (!fijado) setEnFoco(null); }}
        >
          <h4>Cargas por aplicador</h4>
          {reparto.equidad.length === 0 ? (
            <p className="aulas-asigna-sin-dias">
              La disponibilidad cargada no trae aplicadores que listar.
            </p>
          ) : (
            <>
              <p className="aulas-asigna-nota">
                Con 0 también se listan: estar libre es un dato del reparto.
              </p>
              <ul>
                {reparto.equidad.map((e) => {
                  const activo = enFoco === e.aplicador;
                  return (
                    <li key={e.aplicador}>
                      <button
                        type="button"
                        className={`aulas-asigna-carga${activo ? " es-activo" : ""}${
                          e.asignadas === 0 ? " es-libre" : ""}`}
                        aria-pressed={fijado && activo}
                        aria-label={`${e.aplicador}: ${fmt(e.asignadas)} ${
                          e.asignadas === 1 ? "cita asignada" : "citas asignadas"}. Resalta sus citas en el reparto`}
                        onMouseEnter={() => { if (!fijado) setEnFoco(e.aplicador); }}
                        onFocus={() => { if (!fijado) setEnFoco(e.aplicador); }}
                        onClick={() => {
                          if (fijado && activo) { setFijado(false); return; }
                          setEnFoco(e.aplicador);
                          setFijado(true);
                        }}
                      >
                        <span className="aulas-asigna-nombre">{e.aplicador}</span>
                        {/* La carga como badge del MISMO sistema de chips
                            (veredicto 2026-09-02): un solo componente, y el
                            estado «libre» lo atenúa por contexto. */}
                        <span className="aulas-asigna-cifra"><ChipDato>{fmt(e.asignadas)}</ChipDato></span>
                        <i
                          className="aulas-asigna-barra"
                          style={{
                            width: `${reparto.cargaMax > 0
                              ? Math.round((e.asignadas / reparto.cargaMax) * 100)
                              : 0}%`,
                          }}
                          aria-hidden="true"
                        />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </aside>
      </div>

      {reparto.ilegibles > 0 ? (
        <p className="aulas-carga-aviso">
          {reparto.ilegibles === 1
            ? "1 entrada del reparto llegó ilegible y no se lista."
            : `${fmt(reparto.ilegibles)} entradas del reparto llegaron ilegibles y no se listan.`}
        </p>
      ) : null}
    </div>
  );
}
