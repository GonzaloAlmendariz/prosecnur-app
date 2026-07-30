/**
 * Con qué variable se abre el avance de cada actor.
 *
 * Modelo tenía una sola vista —metas por actor— y esta es la segunda: qué
 * segmento interesa seguir dentro de cada actor. Son dos decisiones distintas
 * sobre el mismo actor (cuántos quiero, y cómo quiero verlos repartidos), y por
 * eso van en pestañas hermanas y no apiladas.
 *
 * La lista de columnas sale del catálogo del universo de cada actor, ordenada
 * por cobertura. Lo que no puede segmentar se muestra igual, deshabilitado y
 * con su motivo: un desplegable que esconde opciones sin decir por qué se lee
 * como un error de la app.
 */

import { useMemo } from "react";

import type {
  MonitoreoInterestVariable,
  MonitoreoSource,
  MonitoreoSourceVariableStat,
  MonitoreoState,
} from "../../../../../api/monitoreo";
import {
  EXPLICACION_NO_SEGMENTA,
  normalizarValores,
  variablesDeInteres,
  type VariableCandidata,
} from "../../../core/variablesDeInteres";

import "./distribucionPorActor.css";

export type ActorConCatalogo = {
  actor: string;
  sourceId: string;
  columnas: VariableCandidata[];
};

/** Empareja cada fuente de universo con el catálogo de columnas de su hoja. */
export function actoresConCatalogo(
  sources: readonly MonitoreoSource[] = [],
  variablesPorFuente: Record<string, MonitoreoSourceVariableStat[]> = {},
): ActorConCatalogo[] {
  return sources
    .filter((source) => String(source.role ?? "") === "universo")
    .map((source) => ({
      actor: String((source.dimensions as { actor?: string } | undefined)?.actor ?? source.label ?? "").trim(),
      sourceId: source.id,
      columnas: variablesDeInteres(variablesPorFuente[source.id] ?? []),
    }))
    .filter((item) => item.actor.length > 0)
    .sort((a, b) => a.actor.localeCompare(b.actor, "es"));
}

/** Todas las variables declaradas para un actor: puede tener más de una. */
export function declaracionesDeActor(
  declaradas: readonly MonitoreoInterestVariable[] = [],
  actor: string,
): MonitoreoInterestVariable[] {
  const clave = actor.trim().toLocaleLowerCase("es");
  return declaradas.filter((item) => item.actor.trim().toLocaleLowerCase("es") === clave);
}

function Barra({ valor, total, maximo }: { valor: number; total: number; maximo: number }) {
  const pct = total > 0 ? Math.round((valor / total) * 100) : 0;
  return (
    <span className="mon-dist-barra" title={`${valor} de ${total} · ${pct}%`}>
      <i style={{ width: `${Math.max(2, (valor / Math.max(1, maximo)) * 100)}%` }} />
    </span>
  );
}

function Reparto({ columna, normalizacion }: { columna: VariableCandidata; normalizacion: "ninguna" | "anio" }) {
  const valores = useMemo(
    () => normalizarValores(columna.valores, normalizacion),
    [columna.valores, normalizacion],
  );
  if (!valores.length) return null;
  const total = valores.reduce((suma, item) => suma + item.count, 0) + columna.otrosCasos;
  const maximo = Math.max(...valores.map((item) => item.count));
  return (
    <div className="mon-dist-reparto">
      <ul data-qa-geometry-capacity="owned" data-qa-geometry-content>
        {valores.map((item) => (
          <li key={item.value}>
            <span className="mon-dist-etiqueta" title={item.value}>{item.value}</span>
            <Barra valor={item.count} total={total} maximo={maximo} />
            <b>{item.count.toLocaleString("es-PE")}</b>
          </li>
        ))}
      </ul>
      {/* El recorte se declara: un top que aparenta ser el total miente. */}
      {columna.otrasCategorias > 0 ? (
        <p className="mon-dist-resto">
          y {columna.otrasCategorias.toLocaleString("es-PE")} categorías más,
          con {columna.otrosCasos.toLocaleString("es-PE")} casos
        </p>
      ) : null}
    </div>
  );
}

function TarjetaDeActor({
  item,
  declaradas,
  onAgregar,
  onQuitar,
  onNormalizar,
  guardando,
}: {
  item: ActorConCatalogo;
  declaradas: MonitoreoInterestVariable[];
  onAgregar: (actor: string, variable: string, normalizacion: "ninguna" | "anio") => void;
  onQuitar: (actor: string, variable: string) => void;
  onNormalizar: (actor: string, variable: string, normalizacion: "ninguna" | "anio") => void;
  guardando: boolean;
}) {
  const elegibles = item.columnas.filter(
    (columna) => !columna.motivoNoSegmenta || columna.motivoNoSegmenta === "sin-analizar",
  );
  const yaDeclarada = (name: string) => declaradas.some((d) => d.variable === name);
  const disponibles = elegibles.filter((columna) => !yaDeclarada(columna.name));

  if (!item.columnas.length) {
    return (
      <article className="mon-dist-actor is-vacia" data-qa-geometry-member>
        <header><strong>{item.actor}</strong></header>
        <p className="mon-dist-vacio">
          La base de este actor todavía no se ha sincronizado, así que no hay columnas que ofrecer.
        </p>
      </article>
    );
  }

  return (
    <article className="mon-dist-actor" data-qa-geometry-member>
      <header>
        <strong>{item.actor}</strong>
        <em>
          {declaradas.length
            ? `${declaradas.length} ${declaradas.length === 1 ? "variable declarada" : "variables declaradas"}`
            : `${elegibles.length} de ${item.columnas.length} columnas elegibles`}
        </em>
      </header>

      {/* Las declaradas se listan con su reparto; un actor puede seguir el ciclo
          de egreso y la situación laboral a la vez. */}
      {declaradas.map((declarada) => {
        const columna = item.columnas.find((c) => c.name === declarada.variable);
        if (!columna) return null;
        return (
          <section className="mon-dist-declarada" key={declarada.variable}>
            <div className="mon-dist-declarada-head">
              <strong>{columna.label}</strong>
              <span>{columna.cobertura}%</span>
              <button
                type="button"
                className="mon-dist-quitar"
                disabled={guardando}
                onClick={() => onQuitar(item.actor, declarada.variable)}
              >
                Quitar
              </button>
            </div>
            {columna.normalizacionSugerida === "anio" ? (
              <label className="mon-dist-agrupar">
                <input
                  type="checkbox"
                  checked={declarada.normalization === "anio"}
                  disabled={guardando}
                  onChange={(event) => onNormalizar(
                    item.actor,
                    declarada.variable,
                    event.currentTarget.checked ? "anio" : "ninguna",
                  )}
                />
                <span>Agrupar por año <small>2021-1 y 2021-2 cuentan como 2021</small></span>
              </label>
            ) : null}
            {columna.motivoNoSegmenta === "sin-analizar" ? (
              <p className="mon-dist-vacio">Su reparto aparece al actualizar esta fuente.</p>
            ) : (
              <Reparto columna={columna} normalizacion={declarada.normalization} />
            )}
          </section>
        );
      })}

      <label className="mon-dist-campo">
        <span>{declaradas.length ? "Añadir otra variable" : "Variable de interés"}</span>
        <select
          value=""
          disabled={guardando || !disponibles.length}
          onChange={(event) => {
            const nombre = event.currentTarget.value;
            if (!nombre) return;
            const columna = item.columnas.find((c) => c.name === nombre);
            onAgregar(item.actor, nombre, columna?.normalizacionSugerida ?? "ninguna");
          }}
        >
          <option value="">
            {disponibles.length
              ? "Elegir una columna…"
              : elegibles.length
                ? "Todas las columnas elegibles ya están declaradas"
                : "No hay columnas elegibles"}
          </option>
          {item.columnas.filter((columna) => !yaDeclarada(columna.name)).map((columna) => (
            <option
              key={columna.name}
              value={columna.name}
              disabled={Boolean(columna.motivoNoSegmenta) && columna.motivoNoSegmenta !== "sin-analizar"}
            >
              {columna.label}
              {columna.motivoNoSegmenta
                ? ` — ${EXPLICACION_NO_SEGMENTA[columna.motivoNoSegmenta]}`
                : ` · ${columna.cobertura}% · ${columna.categorias} categorías`}
            </option>
          ))}
        </select>
      </label>
    </article>
  );
}

export function DistribucionPorActor({
  state,
  guardando = false,
  onAgregar,
  onQuitar,
  onNormalizar,
}: {
  state?: MonitoreoState | null;
  guardando?: boolean;
  onAgregar: (actor: string, variable: string, normalizacion: "ninguna" | "anio") => void;
  onQuitar: (actor: string, variable: string) => void;
  onNormalizar: (actor: string, variable: string, normalizacion: "ninguna" | "anio") => void;
}) {
  const actores = useMemo(
    () => actoresConCatalogo(state?.sources ?? [], state?.source_metadata?.variables_by_source ?? {}),
    [state?.sources, state?.source_metadata],
  );
  const declaradas = state?.config?.operational_model?.interest_variables ?? [];

  if (!actores.length) {
    return (
      <div className="mon-dist-vacio-panel" data-qa-geometry-capacity="owned">
        <strong>Sin bases de universo conectadas</strong>
        <p>Las variables de interés salen de las columnas de esas hojas. Conéctalas en Fuentes.</p>
      </div>
    );
  }

  return (
    <div className="mon-dist">
      <header className="mon-dist-head">
        <div>
          <strong>Variables para abrir el detalle de cada actor</strong>
          <small>Decláralas desde su base de universo; Avance mostrará sus categorías y cobertura.</small>
        </div>
      </header>
      <div className="mon-dist-grid" data-qa-geometry-group="acreditacion-distribucion-actores" data-qa-geometry-contract="intrinsic">
        {actores.map((item) => (
          <TarjetaDeActor
            key={item.sourceId}
            item={item}
            declaradas={declaracionesDeActor(declaradas, item.actor)}
            onAgregar={onAgregar}
            onQuitar={onQuitar}
            onNormalizar={onNormalizar}
            guardando={guardando}
          />
        ))}
      </div>
    </div>
  );
}
