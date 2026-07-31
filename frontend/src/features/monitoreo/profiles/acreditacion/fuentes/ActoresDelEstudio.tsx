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

import { useEffect, useMemo, useState } from "react";
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
import { apiMonitoreoActorRename, apiMonitoreoActores } from "../../../../../api/monitoreo";
import {
  ACTORES_SEMILLA,
  claveDeActor,
  cuentasPorActor,
  elencoVisible,
  faltantesDelActor,
} from "../../../fuentes/rosterDeActores";
import { actorInitialLabel } from "../formato";
import "./actoresDelEstudio.css";

type Borrador = {
  /** Identidad estable de la fila mientras se edita, no el nombre. */
  key: string;
  actor: string;
  /** El nombre con el que este actor está guardado hoy, "" si es nuevo. */
  guardadoComo: string;
  phone: boolean;
};

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

function borradorDesde(unit: MonitoreoActorUnit): Borrador {
  return {
    key: unit.id || claveDeActor(unit.actor),
    actor: unit.actor,
    guardadoComo: unit.actor,
    phone: Boolean(unit.phone?.enabled),
  };
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
  const elenco = useMemo(() => elencoVisible(unidades, sources), [unidades, sources]);
  const cuentas = useMemo(() => cuentasPorActor(sources), [sources]);

  const [borradores, setBorradores] = useState<Borrador[]>(() => elenco.map(borradorDesde));
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  // El elenco del servidor manda mientras no haya edición en curso. Sin esta
  // sincronización, conectar una fuente nueva en otra pestaña dejaba aquí una
  // lista vieja que al guardar habría borrado al actor recién aparecido.
  const firmaServidor = elenco.map((unit) => `${unit.actor}:${unit.phone?.enabled}`).join("|");
  useEffect(() => {
    setBorradores(elenco.map(borradorDesde));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firmaServidor]);

  const sucio = useMemo(() => {
    if (borradores.length !== elenco.length) return true;
    return borradores.some((fila, i) => (
      fila.actor.trim() !== elenco[i].actor || fila.phone !== Boolean(elenco[i].phone?.enabled)
    ));
  }, [borradores, elenco]);

  const duplicados = useMemo(() => {
    const vistos = new Set<string>();
    const repetidos = new Set<string>();
    for (const fila of borradores) {
      const clave = claveDeActor(fila.actor);
      if (!clave) continue;
      if (vistos.has(clave)) repetidos.add(fila.key);
      vistos.add(clave);
    }
    return repetidos;
  }, [borradores]);

  const vacios = borradores.filter((fila) => !claveDeActor(fila.actor)).length;
  const puedeGuardar = sucio && !guardando && duplicados.size === 0 && vacios === 0;

  function editar(key: string, cambios: Partial<Borrador>) {
    setBorradores((actual) => actual.map((fila) => (fila.key === key ? { ...fila, ...cambios } : fila)));
  }

  function agregar(nombre = "") {
    const key = `nuevo-${borradores.length}-${nombre || "actor"}`;
    setBorradores((actual) => [...actual, { key, actor: nombre, guardadoComo: "", phone: false }]);
  }

  function quitar(key: string) {
    setBorradores((actual) => actual.filter((fila) => fila.key !== key));
  }

  /**
   * Guardar es dos operaciones, y el orden importa.
   *
   * Los renombrados van primero y uno por uno, porque cada uno tiene que
   * arrastrar las fuentes del actor. Si se guardara el elenco de golpe, el
   * nombre nuevo entraría como un actor más y el viejo seguiría vivo en sus
   * fuentes: exactamente la partición que este bloque viene a impedir.
   */
  async function guardar() {
    setGuardando(true);
    setError("");
    try {
      let ultimoEstado: MonitoreoState | null = null;
      for (const fila of borradores) {
        const nombre = fila.actor.trim();
        if (!fila.guardadoComo || !nombre) continue;
        if (claveDeActor(nombre) === claveDeActor(fila.guardadoComo)) continue;
        const result = await apiMonitoreoActorRename(fila.guardadoComo, nombre);
        ultimoEstado = result.state;
      }
      const result = await apiMonitoreoActores(borradores
        .filter((fila) => claveDeActor(fila.actor))
        .map((fila) => ({
          actor: fila.actor.trim(),
          label: fila.actor.trim(),
          phone: { enabled: fila.phone, role: fila.phone ? "target" : "none" },
        })));
      ultimoEstado = result.state;
      if (ultimoEstado) onStateChange?.(ultimoEstado);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGuardando(false);
    }
  }

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
