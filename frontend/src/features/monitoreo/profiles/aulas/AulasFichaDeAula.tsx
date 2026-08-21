import { useMemo } from "react";

import type { MonitoreoAulasPlanRow } from "../../../../api/monitoreo";
import { X } from "../../../../vendor/lucide-react";
import { dondeSeSaca } from "./dondeSeSaca";
import { fichaDeAula } from "./fichaDeAula";

/**
 * Un aula y todo lo suyo, en una sola lectura.
 *
 * Va **inline y gobernada por `foco`**, igual que el detalle de facultad de
 * esta misma sección: la gramática declara `foco` para la entidad seleccionada
 * y no hacía falta un sideover nuevo para enseñar lo que ya cabe aquí. Se
 * enlaza con `?foco=aula:CH 31`.
 *
 * **Lo que falta se ve como falta.** Cada fuente dice si llegó, y una cifra
 * ausente sale como «—» y no como cero: un aula sin parte de campo no es un
 * aula donde no se encuestó a nadie.
 */

const fmt = (n: number | null) => (n === null ? "—" : n.toLocaleString("es-PE"));

type Fuentes = {
  agenda?: ReadonlyArray<Readonly<Record<string, unknown>>>;
  partes?: ReadonlyArray<Readonly<Record<string, unknown>>>;
  control?: ReadonlyArray<Readonly<Record<string, unknown>>>;
  brechas?: ReadonlyArray<Readonly<Record<string, unknown>>>;
};

export function AulasFichaDeAula({ codigo, fuentes, onCerrar }: {
  codigo: string;
  fuentes: Fuentes;
  onCerrar: () => void;
}) {
  // Se compone UNA vez y de ahí sale también la facultad con la que se busca la
  // salida. Calcularla aparte mirando sólo la agenda fue el defecto que tuvo el
  // primer intento: las aulas que la agenda no lista —pero sí el libro o las
  // brechas— se quedaban sin facultad y la salida no aparecía nunca.
  const ficha = useMemo(() => fichaDeAula(codigo, fuentes), [codigo, fuentes]);
  const salida = useMemo(
    () => dondeSeSaca(ficha.facultad, (fuentes.agenda ?? []) as MonitoreoAulasPlanRow[]),
    [ficha.facultad, fuentes.agenda],
  );
  if (!ficha.existe) {
    return (
      <div className="aulas-ficha" data-qa-geometry-capacity="owned" data-qa-geometry-member="true">
        <div className="aulas-ficha-cabeza">
          <h4>{ficha.codigo}</h4>
          <button type="button" onClick={onCerrar} aria-label="Cerrar la ficha">
            <X size={14} aria-hidden="true" />
          </button>
        </div>
        <p className="mon-profile-muted">
          Ninguna de las hojas del operativo trae este curso-horario: ni el plan,
          ni el parte de campo, ni el libro de control.
        </p>
      </div>
    );
  }

  return (
    <div className="aulas-ficha" data-qa-geometry-capacity="owned" data-qa-geometry-member="true">
      <div className="aulas-ficha-cabeza">
        <h4>
          {ficha.codigo}
          {ficha.facultad ? <small>{ficha.facultad}</small> : null}
        </h4>
        <button type="button" onClick={onCerrar} aria-label="Cerrar la ficha">
          <X size={14} aria-hidden="true" />
        </button>
      </div>

      <dl className="aulas-ficha-cifras">
        <div>
          <dt>Se esperaba</dt>
          <dd>{fmt(ficha.esperado)}</dd>
          <small>{ficha.elegibles === null ? "sin elegibles declarados" : `de ${fmt(ficha.elegibles)} elegibles`}</small>
        </div>
        <div>
          <dt>Llegó a plataforma</dt>
          <dd>{fmt(ficha.validas)}</dd>
          <small>{ficha.brecha === null ? "sin brecha calculada" : `brecha ${fmt(ficha.brecha)}`}</small>
        </div>
        <div>
          <dt>Anotó el campo</dt>
          <dd>{ficha.parte.hay ? fmt(ficha.parte.encuestas) : "—"}</dd>
          <small>
            {/* Un «— asistentes» se lee como una cifra rota. Cuando el parte
                llegó pero ese campo viene vacío, se dice cuál falta. */}
            {!ficha.parte.hay
              ? "sin parte de campo"
              : [
                ficha.parte.asistentes !== null ? `${fmt(ficha.parte.asistentes)} asistentes` : "sin asistentes anotados",
                ficha.parte.rechazos !== null ? `${fmt(ficha.parte.rechazos)} rechazos` : null,
              ].filter(Boolean).join(" · ")}
          </small>
        </div>
        <div>
          <dt>Contó el libro</dt>
          <dd>{ficha.control.hay ? fmt(ficha.control.enviadas) : "—"}</dd>
          <small>{ficha.control.hay ? "enviadas según el equipo" : "sin fila en el libro"}</small>
        </div>
      </dl>

      {(ficha.estado || ficha.fecha || ficha.parte.aplicador) && (
        <p className="aulas-ficha-pie">
          {ficha.estado ? <span>{ficha.estado}</span> : null}
          {ficha.fecha ? <span>{ficha.fecha}</span> : null}
          {ficha.parte.aplicador ? <span>{ficha.parte.aplicador}</span> : null}
        </p>
      )}

      {ficha.parte.observacion ? (
        <p className="aulas-ficha-nota">«{ficha.parte.observacion}»</p>
      ) : null}

      {/* **De dónde se saca lo que faltó.** Sólo cuando falta: un aula que
          llegó a lo suyo no necesita esta sección, y pintarla vacía sería un
          hueco sin propósito (C3). La cuenta es de SU facultad porque la cuota
          es por facultad. */}
      {ficha.brecha !== null && ficha.brecha > 0 && salida?.conocida ? (
        <p className="aulas-ficha-salida">
          Le faltan <strong>{fmt(ficha.brecha)}</strong>.{" "}
          {salida.reservasLibres > 0 ? (
            <>
              En {salida.facultad} {salida.reservasLibres === 1 ? "queda" : "quedan"}{" "}
              <strong>{fmt(salida.reservasLibres)}</strong>{" "}
              {salida.reservasLibres === 1 ? "reserva sin usar" : "reservas sin usar"}.
            </>
          ) : (
            <>
              En {salida.facultad} <strong>no queda ninguna reserva sin usar</strong>
              {salida.cadenasAgotadas > 0
                ? `: sus ${fmt(salida.cadenasAgotadas)} cadenas con reemplazo ya las gastaron.`
                : "; el diseño no le dio ninguna."}{" "}
              Lo que quede tiene que salir del banco de extras.
            </>
          )}
        </p>
      ) : null}
    </div>
  );
}
