import { ArrowRight } from "lucide-react";
import { Link, useLocation } from "react-router-dom";

import type { CalcMuestraCanalRecojo, CalcMuestraComponente } from "../../../api/calcMuestra";
import { conNivel } from "../../../lib/navegacion/direccion";
import { searchConNivel } from "../../../lib/navegacion/useDireccion";
import { metaCuotaFijada, sugerenciaCuota } from "../criterioSalida";
import { safeNumber, type ComponentePatch } from "../sharedCore";
import { NumberCell } from "../universidad/aulas";
import { tecnicaDelActor } from "./actores";
import { actorVisual, CANAL_OPTIONS, primaryMetric } from "./catalogos";
import { origenDeTecnica } from "./secciones";
import { useDesbordaHorizontal } from "./useDesbordaHorizontal";
import "./general.css";

/** Dirección de la Selección de un actor: `seccion=seleccion&foco=<id>`. */
export function hrefSeleccionDeActor(pathname: string, search: string, componenteId: string): string {
  return `${pathname}${conNivel(searchConNivel(search, "seccion", "seleccion"), "foco", componenteId)}`;
}

/**
 * Acreditación › Actores: marco, canal y meta de cada actor. La técnica no se
 * elige aquí: la infiere el cuadro maestro PULSO desde actor, canal y N, y la
 * fila dice de dónde salió (A1). Cada actor enlaza con su Selección.
 */
export function ActoresAcreditacion({
  componentes,
  onComponente,
}: {
  componentes: CalcMuestraComponente[];
  onComponente: (id: string, patch: ComponentePatch) => void;
}) {
  const location = useLocation();
  const { ref, desborda } = useDesbordaHorizontal<HTMLDivElement>();
  return (
    <section className="cmv2-panel" aria-labelledby="cmg-actores-marco-titulo">
      <div className="cmv2-panel-head">
        <span className="cmv2-eyebrow">Marco por actor</span>
        <strong id="cmg-actores-marco-titulo">Actores del estudio</strong>
      </div>
      <p className="cmg-nota">
        El cuadro maestro PULSO de acreditación elige la técnica de cada actor según actor, canal y N. Sin N, el actor conserva su técnica inicial.
      </p>
      <div
        ref={ref}
        className="cmv2-table-wrap cmg-tabla-desplazable"
        data-desborda={desborda ? "true" : "false"}
        tabIndex={desborda ? 0 : undefined}
        role={desborda ? "region" : undefined}
        aria-label={desborda ? "Tabla de actores, desplazable" : undefined}
      >
        <table className="cmv2-table">
          <thead>
            <tr>
              <th>Actor</th>
              <th>Canal</th>
              <th>Marco (N)</th>
              <th>Meta mínima</th>
              <th>Técnica</th>
              <th>Resultado</th>
              <th><span className="cmg-sr-only">Selección</span></th>
            </tr>
          </thead>
          <tbody>
            {componentes.map((comp) => {
              const meta = actorVisual(comp);
              const tecnica = tecnicaDelActor(comp.tecnica);
              const origen = origenDeTecnica(comp);
              return (
                <tr key={comp.id} className={`cmv2-actor-row cmv2-actor-row--${meta.key}`}>
                  <td>
                    <div className="cmv2-actor-cell">
                      <span className="cmv2-actor-dot" aria-hidden="true" />
                      <strong>{meta.label}</strong>
                    </div>
                  </td>
                  <td>
                    <select
                      className="cmv2-channel-select"
                      aria-label={`Canal de ${meta.label}`}
                      value={comp.canal_recojo}
                      onChange={(e) => onComponente(comp.id, { canal_recojo: e.currentTarget.value as CalcMuestraCanalRecojo })}
                    >
                      {CANAL_OPTIONS.map((opt) => <option key={opt.id} value={opt.id}>{opt.label}</option>)}
                    </select>
                  </td>
                  <td>
                    <NumberCell
                      value={comp.marco.marco_validado}
                      title={`Marco (N) de ${meta.label}`}
                      onChange={(v) => onComponente(comp.id, { marco: { marco_validado: v, universo_bruto: v, marco_contactable: v } })}
                    />
                  </td>
                  <td>
                    <MetaDelActor comp={comp} onComponente={onComponente} />
                  </td>
                  <td>
                    <div className="cmv2-target-stack">
                      <span className={`cmg-actor-tecnica cmg-actor-tecnica--${tecnica.clase}`}>{tecnica.etiqueta}</span>
                      <small title={origen.detalle || undefined}>{origen.etiqueta}</small>
                    </div>
                  </td>
                  <td><strong>{primaryMetric(comp)}</strong></td>
                  <td>
                    <Link
                      className="cmv2-ghost cmg-ir-seleccion"
                      to={hrefSeleccionDeActor(location.pathname, location.search, comp.id)}
                      aria-label={`Marco y sorteo de ${meta.label}`}
                    >
                      Selección <ArrowRight size={13} aria-hidden="true" />
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function MetaDelActor({
  comp,
  onComponente,
}: {
  comp: CalcMuestraComponente;
  onComponente: (id: string, patch: ComponentePatch) => void;
}) {
  const sugerido = sugerenciaCuota(comp);
  if (comp.tecnica === "no_prob_cuotas") {
    return (
      <NumberCell
        value={metaCuotaFijada(comp)}
        placeholder={sugerido == null ? undefined : String(sugerido)}
        title={sugerido == null ? "Cuota sin fijar." : `Sin fijar. El motor aplica ${sugerido}.`}
        onChange={(v) => onComponente(comp.id, { meta: { valor: Math.round(v), tipo: "cuota" } })}
      />
    );
  }
  if (comp.tecnica === "no_prob_conveniencia") {
    return (
      <div className="cmv2-target-stack">
        <PercentCell value={comp.parametros.cobertura_objetivo} onChange={(v) => onComponente(comp.id, { parametros: { cobertura_objetivo: v } })} />
        <small>Piso {comp.parametros.n_minimo_estrato} · tope {comp.parametros.tope_operativo}</small>
      </div>
    );
  }
  if (comp.tecnica === "prob_conglomerado_multietapico" || comp.tecnica === "prob_aleatorio_simple" || comp.tecnica === "prob_estratificado") {
    return (
      <div className="cmv2-target-stack">
        <PercentCell value={comp.parametros.oversample_pct} onChange={(v) => onComponente(comp.id, { parametros: { oversample_pct: v } })} />
        <small>Sobremuestra</small>
      </div>
    );
  }
  return (
    <div className="cmv2-target-stack">
      <PercentCell value={comp.parametros.cobertura_objetivo} onChange={(v) => onComponente(comp.id, { parametros: { cobertura_objetivo: v } })} />
      <small>Cobertura</small>
    </div>
  );
}

function PercentCell({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return (
    <label className="cmv2-number-cell cmv2-percent-cell">
      <input
        type="number"
        min={0}
        max={100}
        step={5}
        value={Number.isFinite(value) ? String(Math.round(value * 100)) : ""}
        onChange={(e) => onChange(safeNumber(e.currentTarget.value, 0) / 100)}
      />
      <span>%</span>
    </label>
  );
}
