import type { CalcMuestraComponente } from "../../../api/calcMuestra";
import { metaCuotaFijada, sugerenciaCuota } from "../criterioSalida";
import { safeNumber, type ComponentePatch } from "../sharedCore";
import { NumberCell } from "../universidad/aulas";
import { tecnicaDelActor } from "./actores";
import { actorVisual, primaryMetric } from "./catalogos";
import { CampoMargen } from "./CampoMeta";
import { margenReferencia, metaPorMargen } from "./modeloPropuesta";
import { campoMetaDelActor, pieDeCuota } from "./modelo";
import { origenDeTecnica } from "./secciones";
import { useDesbordaHorizontal } from "./useDesbordaHorizontal";
import "./general.css";
import "./secciones-acreditacion.css";
import { Panel } from "../../../components/Panel";

/**
 * Acreditación › Meta: las encuestas de cada público con su margen de error y la respuesta que exigen frente a la
 * esperada. La meta se escribe o sale de un margen (se escribe el margen y la meta se ajusta). La población viene
 * del Marco y aquí no se edita. La técnica la infiere el cuadro maestro PULSO desde actor, canal y N (A1).
 */
export function MetaAcreditacion({
  componentes,
  onComponente,
}: {
  componentes: CalcMuestraComponente[];
  onComponente: (id: string, patch: ComponentePatch) => void;
}) {
  const { ref, desborda } = useDesbordaHorizontal<HTMLDivElement>();
  return (
    <Panel
      className="cmg-actores-acred cmg-meta-acred"
      aria-labelledby="cmg-meta-titulo"
      // Pinta los componentes del estudio ya hidratado: no espera a nadie.
      data-audit-ready="true"
      eyebrow="Meta por actor"
      title={<span id="cmg-meta-titulo">Encuestas y margen</span>}
    >
      <div
        ref={ref}
        className="cmv2-table-wrap cmg-tabla-desplazable"
        data-desborda={desborda ? "true" : "false"}
        tabIndex={desborda ? 0 : undefined}
        role={desborda ? "region" : undefined}
        aria-label={desborda ? "Tabla de metas, desplazable" : undefined}
      >
        {/* `lang` sirve a lectores de pantalla y a Intl; los <input type=number>
            los formatea Chromium con el locale del sistema e ignoran `lang`
            (medido en L14, 2026-09-27). Aquí sólo hay enteros (N, %), que no
            llevan separador decimal; un campo decimal usa EntradaDecimal. */}
        <table className="cmv2-table cmg-tabla-actores" lang="es-PE">
          <caption className="cmg-sr-only">Población, meta, margen y técnica de cada actor</caption>
          <thead>
            <tr>
              <th scope="col">Actor</th>
              <th scope="col" className="cmg-num">Población</th>
              <th scope="col" className="cmg-num">Respuesta esperada</th>
              <th scope="col" className="cmg-num">Meta</th>
              <th scope="col" className="cmg-num">Margen <small className="cmg-th-nota">95 %</small></th>
              <th scope="col">Exige</th>
              <th scope="col">Técnica</th>
              <th scope="col">Resultado</th>
            </tr>
          </thead>
          <tbody>
            {componentes.map((comp) => {
              const meta = actorVisual(comp);
              const tecnica = tecnicaDelActor(comp.tecnica);
              const origen = origenDeTecnica(comp);
              const N = safeNumber(comp.marco.marco_validado, 0);
              const cuota = campoMetaDelActor(comp).tipo === "cuota";
              const metaN = cuota ? safeNumber(metaCuotaFijada(comp) ?? sugerenciaCuota(comp), 0) : safeNumber(comp.resultado?.n_objetivo, 0);
              const margen = margenReferencia(metaN, N);
              const esperada = safeNumber(comp.parametros.tasa_respuesta, 0);
              return (
                <tr key={comp.id} className={`cmv2-actor-row cmv2-actor-row--${meta.key}`}>
                  <th scope="row">
                    <div className="cmv2-actor-cell">
                      <span className="cmv2-actor-dot" aria-hidden="true" />
                      <strong>{meta.label}</strong>
                    </div>
                  </th>
                  <td className="cmg-num cmg-poblacion">{N > 0 ? fmtN(N) : <span className="cmg-sin-dato">Sin marco</span>}</td>
                  <td className="cmg-num">
                    {cuota ? (
                      // ADR 0143: en un barrido la respuesta esperada dice si la meta es alcanzable (el motor avisa por segmento).
                      <PercentCell
                        value={comp.parametros.tasa_respuesta}
                        ariaLabel={`Respuesta esperada de ${meta.label}`}
                        onChange={(v) => onComponente(comp.id, { parametros: { tasa_respuesta: v } })}
                      />
                    ) : <span className="cmg-sin-dato">En la meta</span>}
                  </td>
                  <td className="cmg-num">
                    <MetaDelActor comp={comp} actor={meta.label} onComponente={onComponente} />
                  </td>
                  <td className="cmg-num">
                    {cuota && N > 1 ? (
                      <CampoMargen
                        margen={margen}
                        etiqueta={`Margen de ${meta.label}`}
                        onMargen={(e) => { const n = metaPorMargen(e, N, 10); if (n != null) onComponente(comp.id, { meta: { valor: n, tipo: "cuota", origen: "usuario" } }); }}
                      />
                    ) : <span className="cmg-sin-dato">{margen == null ? "" : `± ${(margen * 100).toFixed(1)} %`}</span>}
                  </td>
                  <td><Exige meta={metaN} N={N} esperada={esperada} /></td>
                  <td>
                    <div className="cmv2-target-stack">
                      <span className={`cmg-actor-tecnica cmg-actor-tecnica--${tecnica.clase}`}>{tecnica.etiqueta}</span>
                      <small title={origen.detalle || undefined}>{origen.etiqueta}</small>
                    </div>
                  </td>
                  <td className="cmg-actor-resultado"><strong>{primaryMetric(comp)}</strong></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

const fmt = new Intl.NumberFormat("en-US");
const fmtN = (n: number) => fmt.format(Math.round(n));

/** La respuesta que exige la meta (meta / población) frente a la esperada: la barra es lo exigido, la marca lo esperado. */
function Exige({ meta, N, esperada }: { meta: number; N: number; esperada: number }) {
  if (!(meta > 0) || !(N > 0)) return <span className="cmg-sin-dato">Sin meta</span>;
  const exige = meta / N;
  const escala = Math.max(exige, esperada, 0.01) * 1.15;
  const excede = esperada > 0 && exige > esperada;
  return (
    <span className="cmg-exige" data-excede={excede ? "true" : undefined} title={esperada > 0 ? `Exige ${(exige * 100).toFixed(1)} %, se espera ${(esperada * 100).toFixed(1)} %` : undefined}>
      <span className="cmg-exige-barra">
        <i style={{ width: `${Math.min(100, (exige / escala) * 100)}%` }} />
        {esperada > 0 ? <b style={{ left: `${Math.min(100, (esperada / escala) * 100)}%` }} /> : null}
      </span>
      <em>{(exige * 100).toFixed(1)} %</em>
    </span>
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
          ariaLabel={`${campo.rotulo} de ${actor}`}
          onChange={(v) => onComponente(comp.id, { meta: { valor: Math.round(v), tipo: "cuota", origen: "usuario" } })}
        />
        {campo.rotulo !== "Encuestas" ? <PieDeMeta {...pieDeCuota(sugerido, campo.rotulo)} /> : null}
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
