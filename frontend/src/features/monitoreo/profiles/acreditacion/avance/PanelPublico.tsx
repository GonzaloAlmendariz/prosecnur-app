import { X } from "lucide-react";
import { Alert } from "../../../../../components/Alert";
import { fmt, normalizeSourceMatch } from "../formato";
import { casosDelCorte } from "../control/casos/tiposDeCaso";
import type { BarridoDelPublico } from "../navegacion/resumenDelCorte";
import type { MonitoreoInternalQueryIssue } from "../../../../../api/client";
import { efectivasPorCanal, tieneMeta, type DiaDeAvance } from "./avanceModelo";
import { AreaAcumulada } from "./graficosDeAvance";
import type { AcreditacionAdvanceCard } from "./tarjetasDeAvance";

function Fila({ etiqueta, valor, total, clase }: { etiqueta: string; valor: number; total: number; clase: string }) {
  return (
    <div className="acr-pub-embudo-fila">
      <span>{etiqueta}</span>
      <span className="acr-av-pista is-gruesa"><i className={clase} style={{ width: `${total > 0 ? Math.min(100, (valor / total) * 100) : 0}%` }} /></span>
      <b className="acr-av-num">{fmt(valor)}</b>
    </div>
  );
}

/**
 * Inspector del público en Avance › Por público (`panel=publico&foco=<público>`):
 * efectivas y meta, del universo a la efectiva, el acumulado, las efectivas por
 * canal, el barrido si el público lo tiene y los casos del público.
 */
export function PanelPublico({
  tarjeta,
  serie,
  fuentes,
  elegido,
  onCerrar,
  issues,
  barridos,
}: {
  /** `null` mientras los casos no llegan (vienen con el corte de Control). */
  issues: readonly MonitoreoInternalQueryIssue[] | null;
  barridos: ReadonlyMap<string, BarridoDelPublico> | null;
  tarjeta: AcreditacionAdvanceCard;
  serie: readonly DiaDeAvance[];
  fuentes: ReadonlyArray<Record<string, unknown>>;
  /** Abierto por dirección: muestra el botón de cerrar. */
  elegido: boolean;
  onCerrar: () => void;
}) {
  const clave = normalizeSourceMatch(tarjeta.actor);
  const conMeta = tieneMeta(tarjeta);
  const meta = tarjeta.meta ?? 0;
  const respondieron = tarjeta.effective + tarjeta.partial + tarjeta.refusals;
  const canales = efectivasPorCanal(fuentes, tarjeta.actor);
  const maxCanal = Math.max(1, ...canales.map((canal) => canal.efectivas));
  const barrido = barridos?.get(clave) ?? null;
  const casos = issues ? casosDelCorte(issues, (actor) => normalizeSourceMatch(actor) === clave) : null;
  const avance = conMeta ? Math.round((tarjeta.effective / meta) * 100) : null;

  return (
    <aside className="acr-av-panel acr-pub-panel" aria-label={`Público ${tarjeta.actor}`} data-pulso-panel={elegido ? "publico" : undefined}>
      <header className="acr-av-panel-cabecera">
        <h3><span className="acr-av-antetitulo">Público</span> {tarjeta.actor}</h3>
        {elegido ? (
          <button type="button" className="acr-av-icono" onClick={onCerrar} aria-label="Cerrar el público">
            <X size={16} aria-hidden="true" />
          </button>
        ) : null}
      </header>
      <div className="acr-pub-panel-cuerpo">
        <p className="acr-pub-cifra">
          <b className="acr-av-num">{fmt(tarjeta.effective)}</b>
          <span className="acr-av-tenue">{conMeta ? `de ${fmt(meta)} meta` : `de ${fmt(tarjeta.universe)} personas`}</span>
          {avance != null
            ? <span className={`acr-av-chip ${avance >= 100 ? "is-cumple" : "is-falta"}`}>{fmt(avance)} % de la meta</span>
            : <span className="acr-av-chip">Sin meta</span>}
        </p>
        <div className="acr-pub-bloque">
          <span className="acr-av-antetitulo">Del universo a la efectiva</span>
          <Fila etiqueta="Universo" valor={tarjeta.universe} total={tarjeta.universe} clase="is-universo" />
          <Fila etiqueta="Respondieron" valor={respondieron} total={tarjeta.universe} clase="is-respondieron" />
          <Fila etiqueta="Efectivas" valor={tarjeta.effective} total={tarjeta.universe} clase="is-efectiva" />
        </div>
        <div className="acr-pub-bloque acr-pub-acumulado" data-qa-geometry-capacity="owned">
          <span className="acr-av-antetitulo">Efectivas acumuladas</span>
          {serie.length
            ? <AreaAcumulada serie={serie} meta={conMeta ? meta : null} etiqueta={`Efectivas acumuladas de ${tarjeta.actor}`} />
            : <Alert kind="info">Este público aún no tiene efectivas con fecha.</Alert>}
        </div>
        {canales.length ? (
          <div className="acr-pub-bloque">
            <span className="acr-av-antetitulo">Por canal</span>
            {canales.map((canal) => (
              <div key={canal.canal} className="acr-pub-embudo-fila">
                <span>{canal.canal}</span>
                <span className="acr-av-pista"><i className="is-canal" style={{ width: `${(canal.efectivas / maxCanal) * 100}%` }} /></span>
                <b className="acr-av-num">{fmt(canal.efectivas)}</b>
              </div>
            ))}
          </div>
        ) : null}
        {barrido ? (
          <div className="acr-pub-bloque">
            <span className="acr-av-antetitulo">Barrido telefónico</span>
            <div className="acr-pub-kvs" data-qa-geometry-group="acreditacion-publico-barrido" data-qa-geometry-contract="equal">
              <div className="acr-res-kpi" data-qa-geometry-member><small>Barridos</small><b className="acr-av-num">{fmt(barrido.barridos)} <span className="acr-av-tenue">de {fmt(barrido.asignados)}</span></b></div>
              <div className="acr-res-kpi" data-qa-geometry-member><small>Efectivas al teléfono</small><b className="acr-av-num">{fmt(barrido.efectivasAlTelefono)}</b></div>
              <div className="acr-res-kpi" data-qa-geometry-member><small>Sin barrer</small><b className="acr-av-num">{fmt(barrido.noBarridos)}</b></div>
            </div>
          </div>
        ) : null}
        <div className="acr-pub-bloque">
          <span className="acr-av-antetitulo">Casos de este público</span>
          {casos ? (
            casos.porTipo.length ? (
              <div className="acr-res-chips">
                {casos.porTipo.map((tipo) => (
                  <span key={tipo.tipo} className={`acr-av-chip${tipo.grupo === "espera" ? " is-falta" : ""}`}>{tipo.etiqueta} {fmt(tipo.casos)}</span>
                ))}
              </div>
            ) : <span className="acr-av-tenue">Sin casos marcados en el corte.</span>
          ) : <Alert kind="info">Los casos se están preparando con el cruce del padrón.</Alert>}
        </div>
      </div>
    </aside>
  );
}
