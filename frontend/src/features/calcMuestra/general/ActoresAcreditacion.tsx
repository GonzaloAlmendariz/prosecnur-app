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
import { campoMetaDelActor, pieDeCuota } from "./modelo";
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
    <section
      className="cmv2-panel cmg-actores-acred"
      aria-labelledby="cmg-actores-marco-titulo"
      // Pinta los componentes del estudio ya hidratado: no espera a nadie.
      data-audit-ready="true"
    >
      <div className="cmv2-panel-head">
        <div>
          <span className="cmv2-eyebrow">Marco por actor</span>
          <h3 className="cmg-panel-titulo" id="cmg-actores-marco-titulo">Actores del estudio</h3>
        </div>
      </div>
      <p className="cmg-nota" id="cmg-actores-nota">
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
        {/* es-PE escribe «0.5»: `lang` alcanza también a los `NumberCell` (V10). */}
        <table className="cmv2-table cmg-tabla-actores" aria-describedby="cmg-actores-nota" lang="es-PE">
          <caption className="cmg-sr-only">Marco, canal, meta y técnica de cada actor</caption>
          <thead>
            <tr>
              <th scope="col">Actor</th>
              <th scope="col">Canal</th>
              <th scope="col" className="cmg-num">Marco (N)</th>
              <th scope="col" className="cmg-num">Meta mínima</th>
              <th scope="col">Técnica</th>
              <th scope="col">Resultado</th>
              <th scope="col"><span className="cmg-sr-only">Selección</span></th>
            </tr>
          </thead>
          <tbody>
            {componentes.map((comp) => {
              const meta = actorVisual(comp);
              const tecnica = tecnicaDelActor(comp.tecnica);
              const origen = origenDeTecnica(comp);
              return (
                <tr key={comp.id} className={`cmv2-actor-row cmv2-actor-row--${meta.key}`}>
                  <th scope="row">
                    <div className="cmv2-actor-cell">
                      <span className="cmv2-actor-dot" aria-hidden="true" />
                      <strong>{meta.label}</strong>
                    </div>
                  </th>
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
                  <td className="cmg-num">
                    <NumberCell
                      value={comp.marco.marco_validado}
                      ariaLabel={`Marco (N) de ${meta.label}`}
                      onChange={(v) => onComponente(comp.id, { marco: { marco_validado: v, universo_bruto: v, marco_contactable: v } })}
                    />
                  </td>
                  <td className="cmg-num">
                    <MetaDelActor comp={comp} actor={meta.label} onComponente={onComponente} />
                  </td>
                  <td>
                    <div className="cmv2-target-stack">
                      <span className={`cmg-actor-tecnica cmg-actor-tecnica--${tecnica.clase}`}>{tecnica.etiqueta}</span>
                      <small title={origen.detalle || undefined}>{origen.etiqueta}</small>
                    </div>
                  </td>
                  <td className="cmg-actor-resultado"><strong>{primaryMetric(comp)}</strong></td>
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
  actor,
  onComponente,
}: {
  comp: CalcMuestraComponente;
  actor: string;
  onComponente: (id: string, patch: ComponentePatch) => void;
}) {
  const campo = campoMetaDelActor(comp);
  if (campo.tipo === "cuota") {
    const sugerido = sugerenciaCuota(comp);
    return (
      <div className="cmv2-target-stack">
        <NumberCell
          value={metaCuotaFijada(comp)}
          placeholder={sugerido == null ? undefined : String(sugerido)}
          ariaLabel={`Cuota de ${actor}`}
          onChange={(v) => onComponente(comp.id, { meta: { valor: Math.round(v), tipo: "cuota", origen: "usuario" } })}
        />
        <PieDeMeta {...pieDeCuota(sugerido)} />
      </div>
    );
  }
  return (
    <div className="cmv2-target-stack">
      <PercentCell
        value={comp.parametros[campo.clave]}
        ariaLabel={`${campo.rotulo} de ${actor}`}
        onChange={(v) => onComponente(comp.id, { parametros: { [campo.clave]: v } })}
      />
      <PieDeMeta detalle={campo.detalle} piezas={campo.piezas} />
    </div>
  );
}

/**
 * Pie de la meta: piezas cortas que no se parten por dentro (V15); el lector
 * de pantalla y el título reciben la frase entera.
 */
function PieDeMeta({ detalle, piezas }: { detalle: string; piezas: readonly string[] }) {
  return (
    <small className="cmg-meta-pie" title={detalle}>
      <span className="cmg-sr-only">{detalle}</span>
      {piezas.map((pieza, i) => (
        <span key={`${i}-${pieza}`} className="cmg-meta-pieza" aria-hidden="true">{pieza}</span>
      ))}
    </small>
  );
}

function PercentCell({ value, ariaLabel, onChange }: { value: number; ariaLabel: string; onChange: (value: number) => void }) {
  return (
    <label className="cmv2-number-cell cmv2-percent-cell">
      <input
        type="number"
        lang="es-PE"
        min={0}
        max={100}
        step={5}
        aria-label={ariaLabel}
        value={Number.isFinite(value) ? String(Math.round(value * 100)) : ""}
        onChange={(e) => onChange(safeNumber(e.currentTarget.value, 0) / 100)}
      />
      <span aria-hidden="true">%</span>
    </label>
  );
}
