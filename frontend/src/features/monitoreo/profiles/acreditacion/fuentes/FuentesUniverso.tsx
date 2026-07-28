// Pestaña 2 de Fuentes — Universo.
//
// §4.1 de `docs/plan-fuentes-legibles-2026-07.md`. Responde: **¿a quién mide el
// estudio, y qué base lo dice de cada actor?**
//
// Lo que reemplaza es un rail de actores con un formulario al lado que pedía
// pegar `SPREADSHEET`, escribir a mano `PESTAÑA DEL ACTOR` y elegir entre dos
// botones —`Leer pestañas` y `Confirmar base`— sin decir cuál iba primero. Ese
// formulario era una segunda puerta de conexión: hacía peor lo que el panel
// «Conectar fuente» ya hace con verificación previa (N1, N3, N4).
//
// Aquí no se conecta nada: se LEE el estado de cobertura, y conectar o cambiar
// una base abre la misma puerta única, con el actor precargado por `?foco=`.
// La pestaña deja de ser un formulario y pasa a ser la respuesta a una
// pregunta, que es el criterio con el que se cortó toda la sección.

import { AlertTriangle, CheckCircle2, ExternalLink, Layers3, PhoneCall } from "../../../../../vendor/lucide-react";
import type { MonitoreoSource, MonitoreoState } from "../../../../../api/client";
import { enlaceDeFuente, nombreDeFuente } from "../../../fuentes/enlacesDeFuente";
import { contar, textoDeActualizacion } from "../../../fuentes/vocabulario";
import { acreditacionActorOptions, acreditacionSourceActor } from "../AcreditacionSourcesModel";
import { PanelConectarFuente } from "./PanelConectarFuente";
import "./fuentes.css";

function mismoActor(izquierda: string, derecha: string) {
  return izquierda.localeCompare(derecha, "es", { sensitivity: "base" }) === 0;
}

function baseDelActor(sources: MonitoreoSource[], actor: string) {
  return sources.find((source) => (
    source.kind === "google_sheets"
    && source.role === "universo"
    && mismoActor(acreditacionSourceActor(source), actor)
  )) ?? null;
}

function FilaDeActor({
  actor,
  base,
  onConectar,
}: {
  actor: string;
  base: MonitoreoSource | null;
  onConectar: (actor: string) => void;
}) {
  const enlace = base ? enlaceDeFuente(base) : null;
  const hoja = base?.sheet_binding?.sheet_name ?? "";
  return (
    <article className={`fuentes-universo-fila${base ? " is-cubierto" : ""}`} data-qa-geometry-member>
      <div className="fuentes-universo-actor">
        <strong>{actor}</strong>
        {base ? (
          <em>{hoja ? `Pestaña ${hoja}` : nombreDeFuente(base)}</em>
        ) : (
          // R4: se nombra la consecuencia operativa, no el concepto. Sin base no
          // hay denominador, y sin denominador el avance de este actor no se
          // puede leer contra nada.
          <em className="is-pendiente">Sin base: su avance no tiene contra qué medirse</em>
        )}
      </div>

      <div className="fuentes-universo-estado">
        {base ? (
          <>
            <span className="is-listo"><CheckCircle2 size={13} /> Conectada</span>
            <small>{textoDeActualizacion(base.last_sync_at)}</small>
          </>
        ) : (
          <span className="is-pendiente"><AlertTriangle size={13} /> Pendiente</span>
        )}
      </div>

      <div className="fuentes-universo-acciones">
        {enlace?.estado === "enlace" ? (
          <a href={enlace.href} target="_blank" rel="noreferrer" title={enlace.titulo}>
            <ExternalLink size={12} />
            <span>Abrir</span>
          </a>
        ) : null}
        <button type="button" onClick={() => onConectar(actor)}>
          {base ? "Cambiar" : "Conectar base"}
        </button>
      </div>
    </article>
  );
}

export function FuentesUniverso({
  sources,
  onStateChange,
}: {
  sources: MonitoreoSource[];
  onStateChange?: (state: MonitoreoState) => void;
}) {
  // El universo se define por actor, y los actores los conocemos por dos vías:
  // los que ya tienen encuesta y los que ya tienen base. Un actor con encuesta
  // y sin base es precisamente el hueco que esta pestaña existe para mostrar.
  const activas = sources.filter((source) => source.enabled);
  const actores = acreditacionActorOptions(activas).sort((a, b) => a.localeCompare(b, "es"));
  const barrido = activas.filter((source) => source.kind === "google_sheets" && source.role === "barrido");
  const cubiertos = actores.filter((actor) => baseDelActor(activas, actor)).length;

  function conectar(actor: string) {
    // `?foco=` es el param canónico de «entidad seleccionada» (ADR 0044), así
    // que la fila no abre un formulario propio: pide la puerta única con el
    // actor ya elegido, y esa dirección es enlazable y alcanzable por el QA.
    const params = new URLSearchParams(window.location.search);
    params.set("panel", "conectar-fuente");
    params.set("foco", actor);
    window.history.replaceState(null, "", `${window.location.pathname}?${params.toString()}`);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }

  return (
    <div className="fuentes-universo">
      <header className="fuentes-universo-cabecera">
        <div>
          <span>Universo</span>
          <strong>{`${cubiertos} de ${actores.length} ${actores.length === 1 ? "actor con base" : "actores con base"}`}</strong>
        </div>
        <PanelConectarFuente
          sources={sources}
          actoresSugeridos={actores}
          papelInicial="universo"
          onStateChange={onStateChange}
        />
      </header>

      <section
        className="fuentes-universo-lista"
        aria-label="Base de universo por actor"
        data-qa-geometry-group="fuentes-universo-actores"
        data-qa-geometry-contract="equal"
        data-qa-geometry-capacity="owned"
      >
        {actores.length ? actores.map((actor) => (
          <FilaDeActor
            key={actor}
            actor={actor}
            base={baseDelActor(activas, actor)}
            onConectar={conectar}
          />
        )) : (
          <p className="fuentes-universo-vacio">
            <Layers3 size={16} />
            Sin actores. Se detectan al conectar la primera encuesta o la primera base.
          </p>
        )}
      </section>

      {/* El barrido estaba plegado dentro de un `details` cerrado, así que un
        * estudio telefónico no veía su hoja operativa sin abrir un desplegable
        * que no anunciaba contener nada. Es opcional, no secundario. */}
      <section className="fuentes-universo-barrido" aria-label="Hoja de barrido">
        <header>
          <span><PhoneCall size={14} /> Barrido</span>
          <strong>{contar(barrido.length, "hoja", "hojas")}</strong>
        </header>
        {barrido.length ? (
          <div className="fuentes-universo-barrido-lista">
            {barrido.map((source) => {
              const enlace = enlaceDeFuente(source);
              return (
                <div key={source.id}>
                  <strong>{nombreDeFuente(source)}</strong>
                  <small>{textoDeActualizacion(source.last_sync_at)}</small>
                  {enlace.estado === "enlace" ? (
                    <a href={enlace.href} target="_blank" rel="noreferrer" title={enlace.titulo}>
                      <ExternalLink size={12} /><span>Abrir</span>
                    </a>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : (
          <p>Sin hoja de barrido. Es opcional: solo hace falta si el estudio persigue a quien no contestó.</p>
        )}
      </section>
    </div>
  );
}
