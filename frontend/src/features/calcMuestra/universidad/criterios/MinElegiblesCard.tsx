/**
 * Tarjeta del criterio 7 — "Elegibles por curso-horario": umbral general,
 * mínimos propios por facultad (vacío = hereda el general) y tasa de
 * asistencia esperada que SUGIERE mínimos ajustados por inasistencia
 * (ceil(mínimo/tasa), reunión con el asesor muestral 2026-07-15).
 *
 * Control explícito y explicado: la sugerencia se muestra con su porqué y se
 * aplica SOLO con el botón "Usar sugerido" (por fila o general), nunca sola.
 * Presentacional: el cálculo vive en minElegiblesModel.ts y la edición pasa
 * por el borrador confirmable de la tab (mismo flujo que el resto de la suite).
 */
import { Lightbulb } from "lucide-react";
import type { CriteriosSeleccionMarco } from "../../../../api/client";
import { IconConfirm, IconSuccess, IconUndo } from "../../../../lib/icons";
import { minEligibleThreshold } from "../../dominio";
import { fmtInt } from "../../sharedCore";
import {
  avisoMatriculados,
  minimoFacultad,
  minimoSugerido,
  presentesEsperados,
  tasaAsistencia,
} from "./minElegiblesModel";

export type FacultadMinRef = { key: string; label: string; aulas: number | null };

/** Parseo de un input numérico opcional: vacío → null; inválido → null. */
function parseEntero(raw: string): number | null {
  if (!raw.trim()) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? Math.max(1, Math.round(n)) : null;
}

export function MinElegiblesCard({
  seleccion,
  fallbackUmbral,
  facultades,
  pendiente,
  onUmbral,
  onMinimoFacultad,
  onTasa,
  onConfirmar,
  onDescartar,
}: {
  /** Borrador de la selección de criterios (la tab decide cuándo confirma). */
  seleccion: CriteriosSeleccionMarco;
  /** Umbral general vigente si el borrador aún no fija uno (config, default 15). */
  fallbackUmbral: number;
  /** Facultades del catálogo del marco (clave normalizada + etiqueta + # CH). */
  facultades: FacultadMinRef[];
  pendiente: boolean;
  onUmbral: (value: number) => void;
  onMinimoFacultad: (facultadKey: string, valor: number | null) => void;
  /** Tasa de asistencia esperada como proporción 0–1 (null = sin definir). */
  onTasa: (tasa: number | null) => void;
  onConfirmar: () => void;
  onDescartar: () => void;
}) {
  const umbral = minEligibleThreshold(seleccion, fallbackUmbral);
  const tasa = tasaAsistencia(seleccion);
  const overrides = facultades.filter((fac) => minimoFacultad(seleccion, fac.key) != null).length;
  const avisoMatric = avisoMatriculados(seleccion, facultades, umbral);
  const sugeridoGeneral = minimoSugerido(umbral, tasa);
  const presentesGeneral = presentesEsperados(umbral, tasa);
  const tasaPct = tasa == null ? null : Math.round(tasa * 100);

  return (
    <article
      className="cmv2-crit-card"
      data-scope="aula"
      data-kind="numeric"
      data-long="true"
      data-pending={pendiente ? "true" : "false"}
    >
      <header className="cmv2-crit-card-head">
        <div className="cmv2-crit-card-title">
          <strong>Elegibles por curso-horario</strong>
          <span className="cmv2-crit-card-meta">
            <span className="cmv2-crit-col">criterio 7 · regla final del marco</span>
          </span>
        </div>
        <div className="cmv2-crit-card-state">
          <span className="cmv2-crit-head-count">
            ≥ {fmtInt(umbral)}
            {overrides > 0 ? ` · ${overrides} ${overrides === 1 ? "facultad con mínimo propio" : "facultades con mínimo propio"}` : ""}
          </span>
          <span className="cmv2-crit-state" data-state={pendiente ? "pending" : "confirmed"}>
            {pendiente ? (
              <span className="cmv2-crit-state-dot" aria-hidden="true" />
            ) : (
              <IconSuccess size={13} aria-hidden="true" />
            )}
            {pendiente ? "Cambios sin confirmar" : "Confirmado"}
          </span>
        </div>
      </header>

      <div className="cmv2-crit-card-body">
        <div className="cmv2-crit-num-inputs">
          <label className="cmv2-crit-num-field">
            <span>Mínimo general de elegibles</span>
            <input
              type="number"
              min={1}
              value={umbral}
              onChange={(e) => onUmbral(Math.max(1, Math.round(Number(e.target.value) || 1)))}
            />
          </label>
          <label className="cmv2-crit-num-field">
            <span>Tasa de asistencia esperada (%)</span>
            <input
              type="number"
              min={1}
              max={100}
              placeholder="opcional"
              value={tasaPct ?? ""}
              onChange={(e) => {
                const pct = parseEntero(e.target.value);
                onTasa(pct == null ? null : Math.min(100, pct) / 100);
              }}
            />
          </label>
        </div>
        <span className="cmv2-crit-num-hint">
          Excluye del marco los cursos-horario con menos elegibles que el mínimo de su facultad (o el general si no
          tiene uno propio). Referencia de estudios previos: facultades grandes como Ciencias e Ingeniería o Derecho
          suelen usar 20–25; unidades pequeñas como Arte y Diseño, 8–12.
        </span>

        {/* El OTRO umbral. Hay dos mínimos sobre magnitudes anidadas —elegibles
            ≤ matriculados siempre— y sólo éste se ve; el de matriculados manda
            en cuanto una facultad baja por debajo de él, y hasta entonces es
            invisible porque no recorta nada. Medido: Artes Escénicas con mínimo
            10 y matriculados en 15 subió a 57 en vez de a 103. */}
        {avisoMatric ? (
          <div className="cmv2-crit-sug" role="note" data-tone="warn">
            <Lightbulb size={14} aria-hidden="true" />
            <p className="cmv2-crit-sug-copy">
              Hay además un mínimo de <strong>{fmtInt(avisoMatric.umbral)} matriculados</strong> por
              curso-horario. Manda sobre el de elegibles en{" "}
              {avisoMatric.tapadas.length === 1 ? "la facultad" : "las facultades"} que piden menos:{" "}
              {avisoMatric.tapadas.map((f) => `${f.label} (${fmtInt(f.minimo)})`).join(", ")}. Ahí el
              recorte lo hace el de matriculados, no el que ves aquí.
            </p>
          </div>
        ) : null}

        {tasa != null && sugeridoGeneral != null ? (
          <div className="cmv2-crit-sug" role="note">
            <Lightbulb size={14} aria-hidden="true" />
            <p className="cmv2-crit-sug-copy">
              Con asistencia del {tasaPct}%, un mínimo de {fmtInt(umbral)} encuentra ~{fmtInt(presentesGeneral ?? 0)}{" "}
              elegibles presentes el día de la aplicación; para encontrar {fmtInt(umbral)} sugerimos exigir{" "}
              <strong>{fmtInt(sugeridoGeneral)}</strong> matriculados elegibles. La sugerencia no se aplica sola:
              decide por facultad o usa el general.
            </p>
            <button
              type="button"
              className="cmv2-crit-sug-btn"
              disabled={sugeridoGeneral === umbral}
              onClick={() => onUmbral(sugeridoGeneral)}
            >
              Usar sugerido general ({fmtInt(sugeridoGeneral)})
            </button>
          </div>
        ) : null}

        {facultades.length > 0 ? (
          <div className="cmv2-crit-minfac" data-con-sugerido={tasa != null ? "true" : "false"}>
            <div className="cmv2-crit-minfac-head" role="row">
              <span role="columnheader">Facultad</span>
              <span role="columnheader">Mínimo propio</span>
              {tasa != null ? <span role="columnheader">Sugerido por asistencia</span> : null}
            </div>
            {facultades.map((fac) => {
              const propio = minimoFacultad(seleccion, fac.key);
              const base = propio ?? umbral;
              const sugerido = minimoSugerido(base, tasa);
              const presentes = presentesEsperados(base, tasa);
              return (
                <div key={fac.key} className="cmv2-crit-minfac-row" role="row" data-active={propio != null}>
                  <span className="cmv2-crit-minfac-fac" role="rowheader" title={fac.label}>
                    {fac.label}
                    {fac.aulas != null && fac.aulas > 0 ? (
                      <em className="cmv2-crit-minfac-aulas">{fmtInt(fac.aulas)} CH</em>
                    ) : null}
                  </span>
                  <span className="cmv2-crit-minfac-input">
                    <input
                      type="number"
                      min={1}
                      value={propio ?? ""}
                      placeholder={`${fmtInt(umbral)} (general)`}
                      aria-label={`Mínimo de elegibles en ${fac.label}`}
                      onChange={(e) => onMinimoFacultad(fac.key, parseEntero(e.target.value))}
                    />
                  </span>
                  {tasa != null && sugerido != null ? (
                    <span className="cmv2-crit-minfac-sug">
                      <span className="cmv2-crit-minfac-sug-copy">
                        {fmtInt(base)} encuentra ~{fmtInt(presentes ?? 0)}
                      </span>
                      <button
                        type="button"
                        className="cmv2-crit-sug-btn"
                        disabled={sugerido === base}
                        onClick={() => onMinimoFacultad(fac.key, sugerido)}
                      >
                        Usar sugerido ({fmtInt(sugerido)})
                      </button>
                    </span>
                  ) : tasa != null ? (
                    <span className="cmv2-crit-minfac-sug">—</span>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="cmv2-crit-empty-note">
            Los mínimos por facultad se editan cuando el marco lista sus facultades. Construye el marco para verlas.
          </p>
        )}
      </div>

      {pendiente ? (
        <div className="cmv2-crit-confirm" role="status" aria-live="polite">
          <div className="cmv2-crit-confirm-copy">
            <strong>Revisa estos mínimos antes de incorporarlos.</strong>
            <span>Los demás criterios y el marco reconstruido no cambian todavía.</span>
          </div>
          <div className="cmv2-crit-confirm-actions">
            <button type="button" className="cmv2-crit-discard-btn" onClick={onDescartar}>
              <IconUndo size={14} aria-hidden="true" />
              Descartar
            </button>
            <button type="button" className="cmv2-crit-confirm-btn" onClick={onConfirmar}>
              <IconConfirm size={14} aria-hidden="true" />
              Confirmar mínimos
            </button>
          </div>
        </div>
      ) : null}
    </article>
  );
}
