// Cuerpo del panel «Cómo se emparejaron las preguntas» (ADR 0094, ítem 15).
//
// Sin router ni diálogo: recibe el estado de la carga y los callbacks, y pinta.
// El anfitrión (`FuentesEmparejamientoPanel`) lo monta dentro del sideover.

import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ChevronDown, Inbox, Info, SearchX, X } from "../../vendor/lucide-react";
import { EMPAREJAMIENTO_ESTADOS_FILA, type CargaFuentesEmparejamiento, type EmparejamientoFuente } from "../../api/cargaFuentes";
import { GlidingRadioGroup } from "../../components/GlidingRadioGroup";
import { EmptyState, ErrorBlock, LoadingBlock } from "../../components/States";
import {
  EMPAREJAMIENTO_ESTADOS,
  avisoExclusion,
  conteosDeFuente,
  datoRespuestas,
  filtrarFilas,
  filtroInicial,
  fuenteEnFoco,
  nombreDeFuente,
  type EmparejamientoFiltro,
} from "./fuentesEmparejamientoModel";
import { EmparejamientoInsignia, FuentesEmparejamientoTabla, ICONO_ESTADO } from "./FuentesEmparejamientoTabla";

export type EmparejamientoCarga =
  | { tipo: "cargando" }
  | { tipo: "error"; mensaje: string }
  | { tipo: "listo"; datos: CargaFuentesEmparejamiento };

const OPCIONES_FILTRO: readonly { id: EmparejamientoFiltro; label: string }[] = [
  { id: "diferencias", label: "Solo diferencias" },
  { id: "todas", label: "Todas" },
];

export type FuentesEmparejamientoVistaProps = {
  carga: EmparejamientoCarga;
  foco: string | null;
  /** `null` = el filtro por defecto de la fuente (diferencias si las hay). */
  filtro: EmparejamientoFiltro | null;
  onFiltro: (filtro: EmparejamientoFiltro) => void;
  onElegirFuente: (surveyId: string) => void;
  onCerrar: () => void;
  /** Enlace a la pestaña Equivalencias; solo se usa si el backend dice que existe. */
  hrefEquivalencias: string;
  /**
   * Envoltorios del título y la línea, para que el diálogo los reconozca. Con
   * `Dialog.Title`/`Dialog.Description` en `asChild`, Radix les pone su propio
   * `id` y conecta `aria-labelledby`/`aria-describedby`: por eso los nodos no
   * traen `id` propio (si lo trajeran, pisaría el de Radix y el diálogo se
   * quedaría sin nombre accesible).
   */
  renderTitulo?: (contenido: ReactNode) => ReactNode;
  renderDescripcion?: (contenido: ReactNode) => ReactNode;
};

function formatoEntero(n: number): string {
  return n.toLocaleString("es-PE");
}

function SelectorFuente({
  fuentes,
  valor,
  onElegir,
}: {
  fuentes: readonly EmparejamientoFuente[];
  valor: string;
  onElegir: (surveyId: string) => void;
}) {
  return (
    <label className="pulso-emparejamiento-selector">
      <span>Fuente</span>
      <select value={valor} onChange={(event) => onElegir(event.target.value)}>
        {!valor && <option value="">Elige una fuente</option>}
        {fuentes.map((fuente) => (
          <option key={fuente.survey_id} value={fuente.survey_id}>
            {nombreDeFuente(fuente)}
          </option>
        ))}
      </select>
    </label>
  );
}

function Cifras({ fuente }: { fuente: EmparejamientoFuente }) {
  const conteos = conteosDeFuente(fuente);
  return (
    <section className="pulso-emparejamiento-cifras" aria-label="Resumen del emparejamiento">
      <ul data-qa-geometry-group="emparejamiento-cifras" data-qa-geometry-contract="equal">
        {EMPAREJAMIENTO_ESTADOS_FILA.map((estado) => {
          const Icono = ICONO_ESTADO[estado];
          const n = conteos[estado];
          return (
            <li key={estado} className={`is-${estado}${n === 0 ? " is-cero" : ""}`}>
              <strong>{formatoEntero(n)}</strong>
              <span>
                <Icono size={13} aria-hidden="true" />
                {EMPAREJAMIENTO_ESTADOS[estado].cifra}
              </span>
            </li>
          );
        })}
      </ul>
      {fuente.n_preguntas_base > 0 && (
        <p>
          {formatoEntero(fuente.n_emparejadas)} de {formatoEntero(fuente.n_preguntas_base)} preguntas de la base tienen par en esta fuente.
        </p>
      )}
    </section>
  );
}

function Leyenda() {
  return (
    <details className="pulso-emparejamiento-leyenda">
      <summary>
        <Info size={13} aria-hidden="true" />
        Qué significa cada estado
        <ChevronDown size={13} aria-hidden="true" className="pulso-emparejamiento-leyenda-flecha" />
      </summary>
      <ul>
        {EMPAREJAMIENTO_ESTADOS_FILA.map((estado) => (
          <li key={estado}>
            <EmparejamientoInsignia estado={estado} />
            <span>{EMPAREJAMIENTO_ESTADOS[estado].leyenda}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}

function PieEquivalencias({
  equivalencias,
  hrefEquivalencias,
}: {
  equivalencias: CargaFuentesEmparejamiento["equivalencias"];
  hrefEquivalencias: string;
}) {
  return (
    <aside className="pulso-emparejamiento-equivalencias" aria-labelledby="pulso-emparejamiento-equivalencias-titulo">
      <strong id="pulso-emparejamiento-equivalencias-titulo">¿Y Equivalencias?</strong>
      <p>Las fuentes son canales de un mismo público: sus respuestas se juntan en una sola base.</p>
      <p>Equivalencias relaciona públicos distintos, cada uno en su propia base.</p>
      {equivalencias.disponible ? (
        <Link to={hrefEquivalencias} className="pulso-emparejamiento-equivalencias-enlace">
          Ir a Equivalencias
          <ArrowRight size={13} aria-hidden="true" />
        </Link>
      ) : equivalencias.motivo ? (
        <p className="pulso-emparejamiento-equivalencias-motivo">{equivalencias.motivo}</p>
      ) : null}
    </aside>
  );
}

function DetalleFuente({
  fuente,
  filtro,
  onFiltro,
}: {
  fuente: EmparejamientoFuente;
  filtro: EmparejamientoFiltro;
  onFiltro: (filtro: EmparejamientoFiltro) => void;
}) {
  const nombre = nombreDeFuente(fuente);
  const visibles = filtrarFilas(fuente.filas, filtro);
  return (
    <>
      <Cifras fuente={fuente} />
      <Leyenda />
      <div className="pulso-emparejamiento-barra">
        <GlidingRadioGroup
          value={filtro}
          options={OPCIONES_FILTRO}
          getOptionValue={(opcion) => opcion.id}
          onValueChange={onFiltro}
          className="pulso-emparejamiento-filtro"
          aria-label="Qué preguntas mostrar"
        >
          {(opcion) => opcion.label}
        </GlidingRadioGroup>
        <span className="pulso-emparejamiento-barra-conteo" aria-live="polite">
          {formatoEntero(visibles.length)} de {formatoEntero(fuente.filas.length)} preguntas
        </span>
      </div>
      <div className="pulso-emparejamiento-tabla-wrap">
        {visibles.length ? (
          <FuentesEmparejamientoTabla filas={visibles} fuenteNombre={nombre} />
        ) : (
          <EmptyState
            variant="inline"
            icon={<Inbox size={18} />}
            title="Todas las preguntas se emparejaron con el mismo nombre."
            hint="Elige «Todas» para verlas."
          />
        )}
      </div>
    </>
  );
}

export function FuentesEmparejamientoVista({
  carga,
  foco,
  filtro,
  onFiltro,
  onElegirFuente,
  onCerrar,
  hrefEquivalencias,
  renderTitulo = (contenido) => contenido,
  renderDescripcion = (contenido) => contenido,
}: FuentesEmparejamientoVistaProps) {
  const datos = carga.tipo === "listo" ? carga.datos : null;
  const fuente = fuenteEnFoco(datos, foco);
  const fuentes = datos?.fuentes ?? [];
  const exclusion = fuente ? avisoExclusion(fuente) : null;
  const respuestas = fuente ? datoRespuestas(fuente) : null;
  const titulo = fuente
    ? `Cómo se emparejaron las preguntas de ${nombreDeFuente(fuente)}`
    : "Cómo se emparejaron las preguntas";
  const mostrarSelector = fuentes.length > 1 || (fuentes.length > 0 && !fuente);

  let cuerpo: ReactNode;
  if (carga.tipo === "cargando") {
    cuerpo = <LoadingBlock label="Leyendo cómo se emparejaron las preguntas…" />;
  } else if (carga.tipo === "error") {
    cuerpo = <ErrorBlock label="No se pudo leer el emparejamiento de las preguntas" detail={carga.mensaje} />;
  } else if (!fuentes.length) {
    cuerpo = (
      <EmptyState
        icon={<Inbox size={20} />}
        title="Esta base no junta encuestas"
        hint="No hay fuentes que emparejar con la base."
      />
    );
  } else if (!fuente) {
    cuerpo = (
      <EmptyState
        icon={<SearchX size={20} />}
        title="Esa fuente ya no forma parte de esta base"
        hint="Elige otra fuente arriba."
      />
    );
  } else if (!fuente.detalle_disponible) {
    cuerpo = (
      <EmptyState
        icon={<Inbox size={20} />}
        title="Vuelve a traer las respuestas para ver el detalle de esta fuente."
        hint={fuente.n_preguntas_base > 0
          ? `${formatoEntero(fuente.n_emparejadas)} de ${formatoEntero(fuente.n_preguntas_base)} preguntas de la base tienen par en esta fuente.`
          : undefined}
      />
    );
  } else {
    cuerpo = <DetalleFuente fuente={fuente} filtro={filtro ?? filtroInicial(fuente)} onFiltro={onFiltro} />;
  }

  return (
    <div className="pulso-emparejamiento-marco">
      <header className="pulso-emparejamiento-cabecera">
        <div className="pulso-emparejamiento-titular">
          {renderTitulo(
            <h2 tabIndex={-1} data-emparejamiento-titulo="">
              {titulo}
            </h2>,
          )}
          <button
            type="button"
            className="pulso-emparejamiento-cerrar"
            aria-label="Cerrar"
            title="Cerrar"
            onClick={onCerrar}
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
        {exclusion && (
          <p className="pulso-emparejamiento-exclusion" role="status">
            {exclusion}
          </p>
        )}
        {renderDescripcion(
          <p className="pulso-emparejamiento-regla">
            Cada pregunta se empareja con la de la base por su texto y su escala, la misma regla que usa Equivalencias.
          </p>,
        )}
        {respuestas && (
          <p
            className={`pulso-emparejamiento-respuestas${fuente?.n_filas_incorporadas === 0 ? " is-sin-respuestas" : ""}`}
          >
            {respuestas}
          </p>
        )}
        {mostrarSelector && (
          <SelectorFuente fuentes={fuentes} valor={fuente?.survey_id ?? ""} onElegir={onElegirFuente} />
        )}
      </header>
      <div
        className="pulso-emparejamiento-cuerpo"
        data-qa-geometry-group="emparejamiento-cuerpo"
        data-qa-geometry-contract="intrinsic"
      >
        {cuerpo}
        {datos && <PieEquivalencias equivalencias={datos.equivalencias} hrefEquivalencias={hrefEquivalencias} />}
      </div>
    </div>
  );
}
