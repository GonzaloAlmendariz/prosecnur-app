// Word, Gráficos (O7a del rediseño, 2026-10-15): lo que vale para todos los gráficos del documento, el aviso de ajustes
// guardados que ya no se usan y, por cada tipo que usa el informe, sólo lo que el Word hace distinto de la lámina
// (`AJUSTES_WORD`). Todo lo demás sale como en la lámina y se decide en la tarjeta del gráfico, en Reglas o en Identidad.

import { useId } from "react";
import { resolveWordPresetsDefaults, wordChartPresetsDecisiones } from "../../../api/graficosConfigDefaults";
import { PulsoButton } from "../../../components/PulsoButton";
import { Switch } from "../../../components/Switch";
import { conOcultarEtiqueta, ocultarEtiquetaSiTitulo, type MapaPresets } from "../estiloInforme/modeloEstiloInforme";
import { usePlanStore } from "../store";
import { usePresetsMetadata } from "../usePresetsMetadata";
import { decisionesSinFijados } from "../wordFijado";
import { conModoInforme, esModoInforme, leerModoInforme, MODOS_MULTI_INFORME } from "./modeloMultiWord";
import { AJUSTES_WORD, ajustesSobrantes, sinSobrantes, tiposDelInforme, type AjusteWord } from "./ajustesWord";

const registro = (v: unknown): Record<string, Record<string, unknown>> =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, Record<string, unknown>>) : {};

function ControlAjuste({ ajuste, valor, opciones, onCambiar }: {
  ajuste: AjusteWord; valor: unknown; opciones: readonly { value: string; label: string }[]; onCambiar: (v: unknown) => void;
}) {
  const id = useId();
  return (
    <div className="pulso-f6-w-ajuste">
      <label htmlFor={id}><b>{ajuste.rotulo}</b><small>{ajuste.ayuda}</small></label>
      {ajuste.tipo === "bool" && <Switch id={id} checked={valor === true} onToggle={() => onCambiar(valor !== true)} ariaLabel={ajuste.rotulo} />}
      {ajuste.tipo === "number" && (
        <span className="pulso-f6-w-numero">
          <input id={id} type="number" className="pulso-f6-input" min={0} max={100} value={typeof valor === "number" ? valor : Number(valor) || 0}
            onChange={(e) => { const n = Number(e.target.value); if (Number.isFinite(n)) onCambiar(n); }} />
          {ajuste.unidad && <span>{ajuste.unidad}</span>}
        </span>
      )}
      {ajuste.tipo === "choice" && (
        <select id={id} className="pulso-f6-input" value={String(valor ?? "")} onChange={(e) => onCambiar(e.target.value)}>
          {opciones.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      )}
    </div>
  );
}

export function DetalleGraficos() {
  const wPresets = usePlanStore((s) => s.wPresets) as MapaPresets;
  const setWPresets = usePlanStore((s) => s.setWPresets);
  const configDefaults = usePlanStore((s) => s.configDefaults);
  const slides = usePlanStore((s) => s.plan.slides);
  const { presetsByName } = usePresetsMetadata();
  const referencia = resolveWordPresetsDefaults(configDefaults) as MapaPresets;
  const chartPresets = registro(wPresets.chart_presets);
  const defaults = registro(referencia.chart_presets);
  const decisiones = decisionesSinFijados(
    wordChartPresetsDecisiones(wPresets, referencia),
    Object.fromEntries(Object.values(presetsByName).map((p) => [p.name, p.word_fijado])),
  );
  const sobrantes = ajustesSobrantes(decisiones);
  const tipos = tiposDelInforme(slides);
  // Arriba, sólo los tipos con algo propio en el Word; el resto se nombra en una línea, sin repetir «como en la lámina».
  const conAjustes = tipos.filter((t) => (AJUSTES_WORD[t] ?? []).length > 0);
  const iguales = tipos.filter((t) => !(AJUSTES_WORD[t] ?? []).length);
  const ocultar = ocultarEtiquetaSiTitulo(wPresets, referencia);
  const nombreTipo = (t: string) => presetsByName[t]?.titulo_humano ?? t;
  const meta = (t: string, arg: string) => presetsByName[t]?.args.find((a) => a.name === arg);
  const cambiar = (tipo: string, arg: string, v: unknown) =>
    setWPresets({ ...wPresets, chart_presets: { ...chartPresets, [tipo]: { ...(chartPresets[tipo] ?? {}), [arg]: v } } });

  return (
    <>
      <section className="pulso-f6-informe-seccion" aria-label="Todos los gráficos del documento" data-qa-geometry-member data-seccion="word-graficos">
        <h3 className="pulso-f6-w-titulo">Todos los gráficos del documento</h3>
        <div className="pulso-f6-w-ajuste">
          <label htmlFor="f6-w-ocultar-eje"><b>No repetir el título como etiqueta del eje</b><small>El título va encima del gráfico; el eje queda limpio.</small></label>
          <Switch id="f6-w-ocultar-eje" checked={ocultar.activa} onToggle={() => setWPresets(conOcultarEtiqueta(wPresets, referencia, !ocultar.activa))}
            ariaLabel="No repetir el título como etiqueta del eje" />
        </div>
        <p className="pulso-f6-informe-ayuda">Cada gráfico sale como en su lámina: datos, orden, box y cifras se deciden en su tarjeta, en Reglas y en Identidad.</p>
      </section>

      {tipos.includes("multi_apiladas") && (
        <section className="pulso-f6-informe-seccion" aria-label="Multiapiladas en el Word" data-qa-geometry-member data-seccion="word-multi">
          <h3 className="pulso-f6-w-titulo">Multiapiladas en el Word</h3>
          <select className="pulso-f6-input" aria-label="Multiapiladas en el Word" value={leerModoInforme(wPresets)}
            onChange={(e) => { const m = e.target.value; if (esModoInforme(m)) setWPresets(conModoInforme(wPresets, m)); }}>
            {MODOS_MULTI_INFORME.map((m) => <option key={m.clave} value={m.clave}>{m.rotulo}</option>)}
          </select>
          <p className="pulso-f6-informe-ayuda">
            {MODOS_MULTI_INFORME.find((m) => m.clave === leerModoInforme(wPresets))?.detalle} Cada lámina puede elegir otra forma en su tarjeta.
          </p>
        </section>
      )}

      {sobrantes.length > 0 && (
        <section className="pulso-f6-informe-seccion pulso-f6-w-aviso" aria-label="Ajustes del Word que ya no se usan" data-qa-geometry-member data-seccion="word-sobrantes" role="status">
          <h3 className="pulso-f6-w-titulo">{sobrantes.length === 1 ? "Un ajuste del Word ya no se usa" : `${sobrantes.length} ajustes del Word ya no se usan`}</h3>
          <p className="pulso-f6-informe-ayuda">
            Quedaron guardados de la versión anterior de esta pestaña. Algunos no cambian el documento y otros lo apartan de la lámina, como los decimales, que deben venir de Reglas.
          </p>
          <ul className="pulso-f6-w-sobrantes">
            {sobrantes.map((s) => <li key={`${s.tipo}-${s.arg}`}><span>{nombreTipo(s.tipo)}</span><b>{meta(s.tipo, s.arg)?.label ?? s.arg}</b></li>)}
          </ul>
          <PulsoButton variant="secondary" size="sm" onClick={() => setWPresets({ ...wPresets, chart_presets: sinSobrantes(chartPresets, defaults, sobrantes) })}>
            Quitarlos
          </PulsoButton>
        </section>
      )}

      <section className="pulso-f6-informe-seccion" aria-label="Tipos de gráfico de este informe" data-qa-geometry-member data-seccion="word-tipos">
        <h3 className="pulso-f6-w-titulo">Tipos de gráfico de este informe</h3>
        {tipos.length === 0 ? (
          <p className="pulso-f6-informe-ayuda">El informe todavía no tiene gráficos.</p>
        ) : (
          <>
            {conAjustes.length > 0 && (
              <div className="pulso-f6-w-tipos" data-qa-geometry-group="graficos/f6-w-tipos" data-qa-geometry-contract="intrinsic">
                {conAjustes.map((t) => (
                  <div key={t} className="pulso-f6-w-tipo">
                    <span className="pulso-f6-w-tipo-nombre">{nombreTipo(t)}</span>
                    <div className="pulso-f6-w-tipo-ajustes" data-qa-geometry-group="graficos/f6-w-tipo-ajustes" data-qa-geometry-contract="intrinsic">
                      {(AJUSTES_WORD[t] ?? []).map((a) => {
                        const m = meta(t, a.arg);
                        const valor = chartPresets[t]?.[a.arg] ?? defaults[t]?.[a.arg] ?? m?.default;
                        return <ControlAjuste key={a.arg} ajuste={a} valor={valor} opciones={m?.choices ?? []} onCambiar={(v) => cambiar(t, a.arg, v)} />;
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {iguales.length > 0 && (
              <div className="pulso-f6-w-iguales">
                <span>{conAjustes.length ? "Los demás salen como en su lámina" : "Todos salen como en su lámina"}</span>
                <span className="pulso-f6-w-iguales-lista">{iguales.map((t) => <i key={t}>{nombreTipo(t)}</i>)}</span>
              </div>
            )}
          </>
        )}
      </section>
    </>
  );
}
