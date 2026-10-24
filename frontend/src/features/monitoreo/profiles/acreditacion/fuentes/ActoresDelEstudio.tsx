// Bloque 1 de Fuentes: quiénes son los actores del estudio.
//
// Es el paso que faltaba. Hasta aquí un actor no existía como objeto: nacía del
// texto libre que alguien escribía al conectar la primera fuente que lo
// nombraba. Las consecuencias medidas en `acrconta`: renombrar «Egresados»
// exigía editar el string en sus seis fuentes una por una y fallar en una sola
// lo partía en dos actores; un actor sin encuesta conectada no tenía dónde
// nacer; y los cinco nombres que la app sugería eran una constante del frontend
// que nadie podía editar. Modelo lo decía en pantalla —«Actores definidos en
// Fuentes»— mientras Fuentes no tenía dónde definirlos.
//
// Aquí el elenco se declara antes de conectar nada, y es lo que después usan la
// asignación de encuestas, la cardinalidad de padrones y el permiso de barrido.

import {
  AlertTriangle,
  Check,
  Loader2,
  PhoneCall,
  Plus,
  Trash2,
  Users,
} from "../../../../../vendor/lucide-react";
import type { MonitoreoActorUnit, MonitoreoSource, MonitoreoState } from "../../../../../api/client";
import { ACTORES_SEMILLA, claveDeActor, faltantesDelActor } from "../../../fuentes/rosterDeActores";
import { useElencoDeActores } from "./useElencoDeActores";
import { actorInitialLabel } from "../formato";
import "./actoresDelEstudio.css";

/**
 * Plural explícito, no un sufijo pegado.
 *
 * `padrón` + `es` da «padrónes»: el plural español mueve el acento
 * (padrón → padrones) y ninguna regla de sufijo lo acierta. Se declaran las dos
 * formas y se acabó.
 *
 * Antepone el número, así que sirve para «4 encuestas» pero no para frases
 * donde la cifra va dentro («sus 6 fuentes»): esas se escriben enteras.
 */
function plural(n: number, singular: string, plural_: string) {
  return `${n} ${n === 1 ? singular : plural_}`;
}

export function ActoresDelEstudio({
  sources,
  unidades,
  onStateChange,
}: {
  sources: MonitoreoSource[];
  unidades?: MonitoreoActorUnit[];
  onStateChange?: (state: MonitoreoState) => void;
}) {
  const {
    borradores, guardando, error, duplicados, puedeGuardar, cuentas, editar, agregar, quitar, guardar,
  } = useElencoDeActores({ sources, unidades, onStateChange });

  const sinDeclarar = ACTORES_SEMILLA.filter((nombre) => (
    !borradores.some((fila) => claveDeActor(fila.actor) === claveDeActor(nombre))
  ));

  return (
    <div className="mon-acr-source-view mon-acr-actores-view">
      <section className="mon-acr-object-surface">
        <div className="mon-acr-object-surface-head">
          <div>
            <span>Actores del estudio</span>
            <strong>
              {borradores.length
                ? `${borradores.length} ${borradores.length === 1 ? "actor" : "actores"}`
                : "Sin declarar"}
            </strong>
          </div>
          <button type="button" className="pulso-primary" onClick={() => { void guardar(); }} disabled={!puedeGuardar}>
            {guardando ? <Loader2 size={14} className="pulso-spin" /> : <Check size={14} />}
            Guardar elenco
          </button>
        </div>

        {error ? <div className="mon-sm-error">{error}</div> : null}

        {borradores.length ? (
          <div className="mon-acr-actores-lista" data-qa-geometry-group="fuentes-actores" data-qa-geometry-contract="equal">
            {borradores.map((fila) => {
              // Las fuentes se cuentan por el nombre GUARDADO, no por el que se
              // está escribiendo. Mientras se renombra, el actor sigue siendo el
              // mismo y sus fuentes también: buscarlas por el nombre nuevo daba
              // cero y la nota prometía renombrar «sus 0 fuentes».
              const cuenta = cuentas.get(claveDeActor(fila.guardadoComo || fila.actor))
                ?? { actor: fila.actor, universo: 0, respuestas: 0, barrido: 0 };
              const faltan = faltantesDelActor(cuenta, fila.phone);
              const repetido = duplicados.has(fila.key);
              const renombrado = Boolean(fila.guardadoComo)
                && claveDeActor(fila.actor) !== claveDeActor(fila.guardadoComo);
              const conFuentes = cuenta.universo + cuenta.respuestas + cuenta.barrido;
              return (
                <article
                  key={fila.key}
                  className={`mon-acr-actor-card${repetido ? " is-invalid" : ""}`}
                  data-qa-geometry-member
                >
                  <div className="mon-acr-actor-card-head">
                    <span className="mon-acr-actor-card-icon" aria-hidden="true">
                      {actorInitialLabel(fila.actor)}
                    </span>
                    <label className="mon-acr-actor-card-name">
                      <span>Nombre</span>
                      <input
                        value={fila.actor}
                        onChange={(event) => editar(fila.key, { actor: event.currentTarget.value })}
                        placeholder="Nombre del actor"
                        disabled={guardando}
                        aria-invalid={repetido}
                      />
                    </label>
                    <button
                      type="button"
                      className="mon-acr-actor-card-remove"
                      onClick={() => quitar(fila.key)}
                      disabled={guardando}
                      aria-label={`Quitar ${fila.actor || "actor"}`}
                      title={conFuentes
                        ? "Quitarlo del elenco no borra sus fuentes; volverá a aparecer mientras las tenga."
                        : "Quitar del elenco"}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>

                  <label className="mon-switch-line mon-acr-actor-card-phone">
                    <input
                      type="checkbox"
                      checked={fila.phone}
                      onChange={(event) => editar(fila.key, { phone: event.currentTarget.checked })}
                      disabled={guardando}
                    />
                    <span>
                      <PhoneCall size={13} />
                      <strong>{fila.phone ? "Con canal telefónico" : "Sin canal telefónico"}</strong>
                    </span>
                  </label>

                  {/* Lo que este actor ya tiene conectado. Es el dato que decide
                    * si su avance se puede calcular, no un adorno de estado. */}
                  <div className="mon-acr-actor-card-fuentes">
                    <span className={cuenta.universo ? "is-ready" : "is-missing"}>
                      {plural(cuenta.universo, "padrón", "padrones")}
                    </span>
                    <span className={cuenta.respuestas ? "is-ready" : "is-missing"}>
                      {plural(cuenta.respuestas, "encuesta", "encuestas")}
                    </span>
                    {fila.phone ? (
                      <span className={cuenta.barrido ? "is-ready" : "is-missing"}>
                        {plural(cuenta.barrido, "barrido", "barridos")}
                      </span>
                    ) : null}
                  </div>

                  <div className="mon-acr-actor-card-nota">
                    {repetido ? (
                      <span className="is-invalid"><AlertTriangle size={12} /> Ya hay otro actor con este nombre.</span>
                    ) : renombrado ? (
                      <span className="is-pending">
                        Al guardar, «{fila.guardadoComo}» pasa a llamarse así en {conFuentes === 1 ? "su única fuente" : `sus ${conFuentes} fuentes`}.
                      </span>
                    ) : faltan.length ? (
                      <span className="is-missing">{faltan.join(" · ")}</span>
                    ) : (
                      <span className="is-ready">Listo para medir avance</span>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="mon-acr-empty-state">
            <Users size={18} />
            <strong>Este estudio todavía no declara sus actores</strong>
            <span>Un actor es cada grupo que responde por separado y se mide contra su propia cuota. Empieza por los habituales y ajústalos.</span>
          </div>
        )}

        <div className="mon-acr-actores-agregar">
          <button type="button" onClick={() => agregar()} disabled={guardando}>
            <Plus size={13} /> Agregar actor
          </button>
          {sinDeclarar.length ? (
            <div className="mon-acr-actores-sugeridos">
              <span>Habituales:</span>
              {sinDeclarar.map((nombre) => (
                <button key={nombre} type="button" onClick={() => agregar(nombre)} disabled={guardando}>
                  <Plus size={11} /> {nombre}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
