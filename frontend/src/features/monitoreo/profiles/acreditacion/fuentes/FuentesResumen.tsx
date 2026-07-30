// Pestaña 1 de Fuentes — Resumen.
//
// §4.1 de `docs/plan-fuentes-legibles-2026-07.md`. Responde una sola pregunta:
// **¿de dónde vienen mis datos?** Por eso no tiene ningún control que cambie el
// estudio: es lectura, y es la primera pestaña porque es la que todo el mundo
// necesita antes de decidir nada.
//
// Lo que reemplaza es la antigua «Fuentes activas», que era la más legible de
// las cuatro y estaba última (hallazgo A2). Lo que le agrega:
//
//   · el nombre humano de cada fuente en vez del identificador (A4/R1);
//   · un enlace para abrirla en su servicio (A3/R2);
//   · una sola aparición de cada número (A7/R3);
//   · rótulos que dicen cuándo se actualizó en vez de «Snapshot local listo»
//     y «Metadata real lista» (A5/§3).

import { AlertTriangle, CheckCircle2, ExternalLink, Layers3, ListChecks, PhoneCall } from "../../../../../vendor/lucide-react";
import type { LucideIcon } from "../../../../../vendor/lucide-react";
import type { MonitoreoLinkCollector, MonitoreoSource } from "../../../../../api/client";
import { detalleTecnico, enlaceDeFuente, nombreDeFuente, servicioDeFuente } from "../../../fuentes/enlacesDeFuente";
import { contar, textoDeActualizacion } from "../../../fuentes/vocabulario";
import {
  acreditacionSourceActor,
  buildAcreditacionActiveSourcesSummary,
} from "../AcreditacionSourcesModel";
import "./fuentes.css";

/**
 * El agrupador es el papel (`role`), no el servicio: un universo en Sheets y un
 * universo en Kobo responden lo mismo y por eso van juntos. Esa es la inversión
 * frente al ANTES, que agrupaba por proveedor (A1).
 *
 * Universo, respuestas y barrido son vocabulario del estudio y el plan dice
 * expresamente que se conserva. No llevan glosa: explicarle «universo» a quien
 * diseñó el universo es relleno, y R4 lo prohíbe.
 */
type Papel = {
  key: "universo" | "respuestas" | "barrido";
  titulo: string;
  icon: LucideIcon;
};

const PAPELES: readonly Papel[] = [
  { key: "universo", titulo: "Universo", icon: Layers3 },
  { key: "respuestas", titulo: "Respuestas", icon: ListChecks },
  { key: "barrido", titulo: "Barrido", icon: PhoneCall },
];

function papelDeFuente(source: MonitoreoSource): Papel["key"] {
  if (source.role === "universo") return "universo";
  if (source.role === "barrido") return "barrido";
  return "respuestas";
}

function FilaDeFuente({ source }: { source: MonitoreoSource }) {
  const enlace = enlaceDeFuente(source);
  const nombre = nombreDeFuente(source);
  const actor = acreditacionSourceActor(source);
  const detalle = detalleTecnico(source);
  // R3 dentro de la fila: una hoja llamada «Administrativos», del actor
  // Administrativos, con el enlace rotulado «Administrativos» decía la misma
  // palabra tres veces. El subtítulo omite el actor cuando ya está en el
  // título, y el enlace cae a un rótulo genérico cuando repetiría el nombre.
  const subtitulo = [servicioDeFuente(source), actor === nombre ? "" : actor].filter(Boolean).join(" · ");
  return (
    <article className="fuentes-resumen-fila">
      <div className="fuentes-resumen-fila-titulo">
        {/* R1: el nombre humano es el título. El identificador vive abajo. */}
        <strong>{nombre}</strong>
        <em>{subtitulo}</em>
      </div>
      {/* Solo se ocupa espacio cuando hay algo accionable. `sin-enlace` es el
        * estado normal de SurveyMonkey y repetir su explicación en cada fila
        * —siete veces en `acrconta`— es exactamente el relleno que el Contrato
        * de Superficie prohíbe. Se dice una vez, en la cabecera de la tarjeta. */}
      {enlace.estado === "enlace" ? (
        <div className="fuentes-resumen-fila-enlace">
          <a href={enlace.href} target="_blank" rel="noreferrer" title={enlace.titulo}>
            <ExternalLink size={12} />
            <span>{enlace.texto === nombre ? `Abrir en ${servicioDeFuente(source)}` : enlace.texto}</span>
          </a>
        </div>
      ) : enlace.estado === "falta-dato" ? (
        <div className="fuentes-resumen-fila-enlace">
          <span className="is-pendiente">
            <AlertTriangle size={12} />
            {enlace.mensaje}
          </span>
        </div>
      ) : null}
      <div className="fuentes-resumen-fila-sync">{textoDeActualizacion(source.last_sync_at)}</div>
      <details className="fuentes-resumen-fila-detalle">
        <summary>Detalle técnico</summary>
        <dl>
          {detalle.map((fila) => (
            <div key={`${fila.etiqueta}-${fila.valor}`}>
              <dt>{fila.etiqueta}</dt>
              {/* Sin recorte: un identificador cortado no sirve para soporte (C4). */}
              <dd>{fila.valor}</dd>
            </div>
          ))}
        </dl>
      </details>
    </article>
  );
}

function TarjetaDePapel({ papel, sources }: { papel: Papel; sources: MonitoreoSource[] }) {
  const Icon = papel.icon;
  return (
    <section
      className="fuentes-resumen-tarjeta"
      aria-label={papel.titulo}
      data-qa-geometry-member
    >
      <header>
        <span><Icon size={14} /> {papel.titulo}</span>
        <strong>{contar(sources.length, "fuente", "fuentes")}</strong>
      </header>
      {/* C3: la capacidad la posee la lista, no la tarjeta. El vacío se resuelve
        * dentro del marco de la variante, sin encogerlo ni estirarlo. */}
      <div className="fuentes-resumen-lista" data-qa-geometry-capacity="owned">
        {sources.length ? (
          sources.map((source) => <FilaDeFuente key={source.id} source={source} />)
        ) : (
          <p className="fuentes-resumen-vacio">
            {papel.key === "universo"
              ? "Sin bases. Se conectan en Universo."
              : papel.key === "respuestas"
                ? "Sin encuestas. Se conectan en Encuestas y recopiladores."
                : "Sin hoja de barrido. Es opcional."}
          </p>
        )}
      </div>
    </section>
  );
}

/**
 * Servicios que no exponen una dirección, dicho una vez para toda la vista.
 *
 * Estuvo por fila —siete repeticiones de la misma frase en `acrconta`— y
 * después por tarjeta, y ahí rompió C2: el pie solo lo tenía Respuestas, así
 * que esa tarjeta medía 48,9 px más que Barrido. Un aviso que vale para toda
 * la superficie pertenece a la superficie, no a uno de sus miembros.
 */
function NotaDeServicios({ sources }: { sources: MonitoreoSource[] }) {
  const servicios = Array.from(new Set(
    sources
      .filter((source) => enlaceDeFuente(source).estado === "sin-enlace")
      .map(servicioDeFuente),
  ));
  if (!servicios.length) return null;
  return (
    <p className="fuentes-resumen-nota-servicio">
      {`${servicios.join(" y ")} no ${servicios.length === 1 ? "ofrece" : "ofrecen"} un enlace directo. ${servicios.length === 1 ? "Su identificador queda" : "Sus identificadores quedan"} en «Detalle técnico».`}
    </p>
  );
}

/**
 * Cobertura por actor: qué papel tiene cubierto cada uno y cuál le falta.
 *
 * Ocupa la franja superior porque responde de un vistazo lo que hoy exige
 * cruzar tres tarjetas: «¿Egresados tiene base y encuesta?». Es una matriz de
 * conteos reales, no un esquema del flujo: un diagrama que dibuje
 * «universo → respuestas → barrido» sin decir cuántos hay en cada casilla
 * decora, y decorar es lo que R4 prohíbe.
 */
function MapaDeCobertura({ actores, sources }: { actores: string[]; sources: MonitoreoSource[] }) {
  if (!actores.length) return null;
  return (
    <section className="fuentes-resumen-mapa" aria-label="Cobertura por actor">
      <div className="fuentes-resumen-mapa-encabezado">
        <span />
        {PAPELES.map((papel) => {
          const Icon = papel.icon;
          return <span key={papel.key}><Icon size={12} /> {papel.titulo}</span>;
        })}
      </div>
      {actores.map((actor) => (
        <div key={actor} className="fuentes-resumen-mapa-fila">
          <strong>{actor}</strong>
          {PAPELES.map((papel) => {
            const total = sources.filter((source) => (
              papelDeFuente(source) === papel.key && acreditacionSourceActor(source) === actor
            )).length;
            // El barrido es opcional por diseño del estudio: su ausencia se
            // pinta neutra, no como falta. Universo y respuestas sin cubrir sí
            // son huecos que alguien tiene que cerrar.
            const tono = total ? "is-cubierto" : papel.key === "barrido" ? "is-neutro" : "is-falta";
            return (
              <span
                key={papel.key}
                className={tono}
                title={`${actor} · ${papel.titulo}: ${contar(total, "fuente", "fuentes")}`}
              >
                {total || "—"}
              </span>
            );
          })}
        </div>
      ))}
    </section>
  );
}

export function FuentesResumen({
  sources,
  linkCollectors = [],
}: {
  sources: MonitoreoSource[];
  linkCollectors?: MonitoreoLinkCollector[];
}) {
  const activas = sources.filter((source) => source.enabled);
  const resumen = buildAcreditacionActiveSourcesSummary(sources, linkCollectors);
  const sinCobertura = resumen.missingSheetActors;
  const actores = Array.from(new Set([...resumen.actorsWithSurvey, ...resumen.actorsWithSheet])).sort(
    (left, right) => left.localeCompare(right, "es"),
  );

  return (
    <div className="fuentes-resumen">
      <header className="fuentes-resumen-cabecera">
        <div>
          {/* R3: el total ya vive en la barra de módulo y en la franja de
            * sección. Aquí se declara la pregunta que responde la vista. */}
          <strong>De dónde salen los datos</strong>
          <em>{textoDeActualizacion(resumen.lastSync)}</em>
        </div>
        <MapaDeCobertura actores={actores} sources={activas} />
        {sinCobertura.length ? (
          <p className="fuentes-resumen-aviso is-pendiente">
            <AlertTriangle size={14} />
            {/* R4: se nombra el paso concreto, no se explica el concepto. */}
            <span>
              {`${sinCobertura.join(", ")}: ${sinCobertura.length === 1 ? "encuesta sin base de universo" : "encuestas sin base de universo"}. Se conecta en Universo.`}
            </span>
          </p>
        ) : (
          <p className="fuentes-resumen-aviso is-listo">
            <CheckCircle2 size={14} />
            <span>Cobertura completa</span>
          </p>
        )}
      </header>

      {/* C1: grupo par declarado al construir, no descubierto por el QA. Es
        * `equal` —tres hermanas del mismo rol comparten alto y ancho— y el
        * vacío de la que tiene menos fuentes es capacidad interior legítima. */}
      <div
        className="fuentes-resumen-papeles"
        data-qa-geometry-group="fuentes-resumen-papeles"
        data-qa-geometry-contract="equal"
      >
        {PAPELES.map((papel) => (
          <TarjetaDePapel
            key={papel.key}
            papel={papel}
            sources={activas.filter((source) => papelDeFuente(source) === papel.key)}
          />
        ))}
      </div>

      <NotaDeServicios sources={activas} />
    </div>
  );
}
