import { X } from "../../../../vendor/lucide-react";
import type { FichaDeAula } from "./fichaDeAula";

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

export function AulasFichaDeAula({ ficha, onCerrar }: {
  ficha: FichaDeAula;
  onCerrar: () => void;
}) {
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
    </div>
  );
}
