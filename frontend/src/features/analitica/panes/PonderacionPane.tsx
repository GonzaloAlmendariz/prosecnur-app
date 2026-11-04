import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, HelpCircle, Info, Landmark, Plus, Scale, X } from "../../../vendor/lucide-react";
import {
  apiAnaliticaColumnValues, apiAnaliticaPonderacionPreview,
  PonderPreview, ValorColumna, VariableInstrumento,
} from "../../../api/client";
import { Panel } from "../../../components/Panel";
import { PulsoButton } from "../../../components/PulsoButton";
import { Switch } from "../../../components/Switch";
import { formatoConteo } from "../../../lib/formatoNumero";
import { conOrigenPesoBase, origenPesoBase } from "../ponderacionConfigModel";
import { CifrasPestana } from "../CifrasPestana";
import { useAnaliticaStore } from "../store";
import { VariableSelect } from "../VariableSelect";
import { useSession } from "../../../lib/SessionContext";
import { MetasCpv2025 } from "./MetasCpv2025";
import { PesoPorColumna } from "./PesoPorColumna";
import { PonderacionAjustes } from "./PonderacionAjustes";
import { PonderacionEfecto } from "./PonderacionEfecto";
import { PonderacionPesoBase } from "./PonderacionPesoBase";
import { useVariablesDeLaBase, variablesDeLectura } from "./variablesDeLaBase";
import "./PonderacionPane.css";

// PonderacionPane — pondera los reportes (frecuencias, cruces, dimensiones)
// para que representen a la población. Flujo guiado: guía de decisión →
// activar → método → variables y objetivos → diagnóstico en vivo → aplicar.
// La ponderación se persiste en analitica_config.ponderacion (autosave) y el
// backend recalcula el peso de forma determinista; aquí solo se previsualiza.

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
const intfmt = (x: number) => formatoConteo(x);

export function PonderacionPane() {
  const pond = useAnaliticaStore((s) => s.config.ponderacion);
  const setPonderacion = useAnaliticaStore((s) => s.setPonderacion);
  const upsertMargin = useAnaliticaStore((s) => s.upsertPonderMargin);
  const removeMargin = useAnaliticaStore((s) => s.removePonderMargin);
  const setDesign = useAnaliticaStore((s) => s.setPonderDesign);
  const setRake = useAnaliticaStore((s) => s.setPonderRake);
  const setTrim = useAnaliticaStore((s) => s.setPonderTrim);

  const porColumna = pond.modo === "columna";
  const baseActiva = useSession().state?.active_base ?? null;
  const margins = pond.rake?.margins ?? [];
  const origen = origenPesoBase(pond);

  // F7: la lectura se repite al cambiar de base y distingue cargando de vacío.
  const lecturaVariables = useVariablesDeLaBase(baseActiva);
  const variables = useMemo(() => variablesDeLectura(lecturaVariables), [lecturaVariables]);
  const [preview, setPreview] = useState<PonderPreview | null>(null);
  const [catCache, setCatCache] = useState<Record<string, ValorColumna[]>>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const categoricas = useMemo(() => variables.filter((v) => !!v.categorica), [variables]);
  const labelOf = (name: string) =>
    variables.find((v) => v.name === name)?.label || name;

  // Categorías de una variable (cacheadas) para armar los inputs de objetivo.
  async function ensureCats(name: string) {
    if (!name || catCache[name]) return;
    try {
      const r = await apiAnaliticaColumnValues(name);
      setCatCache((c) => ({ ...c, [name]: r.values }));
    } catch { /* no-op */ }
  }
  useEffect(() => {
    [...margins.map((m) => m.var), pond.design?.var].forEach((v) => v && ensureCats(v));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(margins.map((m) => m.var)), pond.design?.var]);

  // Preview con debounce ante cualquier cambio de la config de ponderación.
  useEffect(() => {
    // El preview del backend calcula calibración: con el peso tomado de una
    // columna no hay nada que previsualizar y sus cifras serían de otro método.
    if (!pond.enabled || porColumna) { setPreview(null); return; }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try { setPreview(await apiAnaliticaPonderacionPreview(pond)); }
      catch { setPreview(null); }
    }, 500);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [JSON.stringify(pond)]);

  const d = preview?.ok ? preview.diagnostics : undefined;
  const nEff = d ? intfmt(d.n_eff) : "—";
  const deff = d ? d.deff.toFixed(2) : "—";

  return (
    <Panel className="analitica-ponderacion-panel">
      {/* C1: guía, interruptor, pasos y diagnóstico son bloques independientes
          de alto intrínseco; el dueño del scroll es el panel. */}
      <div
        className="analitica-report-shell analitica-ponderacion-workbench"
        data-qa-geometry-group="analitica/ponderacion-workbench"
        data-qa-geometry-contract="intrinsic"
      >

        {/* Docbar */}
        <div className="analitica-cruces-docbar">
          <span className="analitica-cruces-docbar-icon" aria-hidden="true"><Scale size={16} /></span>
          <div className="analitica-cruces-docbar-copy">
            <span>Producto analítico</span>
            <strong>Ponderación</strong>
            <small>Ajusta tus resultados para que representen a la población.</small>
          </div>
          <CifrasPestana
            ariaLabel="Estado de la ponderación"
            cifras={[
              { etiqueta: "Estado", valor: pond.enabled ? "Activa" : "Inactiva", tono: pond.enabled ? "acento" : "neutral" },
              { etiqueta: "n efectivo", valor: nEff },
              { etiqueta: "DEFF", valor: deff },
            ]}
          />
        </div>

        {/* Guía de decisión */}
        <DecisionAid />

        {/* Interruptor maestro */}
        <div className={`pond-card pond-master${pond.enabled ? " is-on" : ""}`}>
          <Switch
            checked={pond.enabled}
            onToggle={() => setPonderacion({ enabled: !pond.enabled })}
            ariaLabel="Activar ponderación"
          />
          <div className="pond-master-copy">
            <div className="pond-title">Activar ponderación</div>
            <div className="pond-copy">
              {pond.enabled
                ? "Frecuencias, cruces y dimensiones usan los pesos. Apágala para volver a peso 1 en cada caso."
                : "Tus reportes usan cada caso con peso 1 (sin ponderar)."}
            </div>
          </div>
        </div>

        {pond.enabled && (
          <PesoPorColumna
            modo={porColumna ? "columna" : "calibracion"}
            pesoColumna={pond.peso_columna ?? ""}
            lectura={lecturaVariables}
            baseActiva={baseActiva}
            onModo={(modo) => setPonderacion(modo === "columna" ? { modo } : { modo: undefined, peso_columna: undefined })}
            onColumna={(peso_columna) => setPonderacion({ modo: "columna", peso_columna })}
          />
        )}

        {pond.enabled && !porColumna && (
          <>
            <StepLabel n={1} text="Peso base" />
            <PonderacionPesoBase
              origen={origen}
              columna={pond.design?.peso_columna ?? ""}
              variables={variables}
              onOrigen={(o) => setPonderacion(conOrigenPesoBase(pond, o))}
              onColumna={(peso_columna) => setDesign({ peso_columna })}
            />
            {origen === "estrato" && (
              <div className="pond-design">
                {pond.design?.var ? (
                  <CategoryEditor
                    mode="design"
                    variable={pond.design.var}
                    label={labelOf(pond.design.var)}
                    categorias={catCache[pond.design.var] ?? []}
                    values={pond.design.pop_sizes ?? {}}
                    onChange={(vals) => setDesign({ pop_sizes: vals })}
                    onRemove={() => setDesign({ var: "", pop_sizes: {} })}
                  />
                ) : (
                  <AddVariable
                    variables={categoricas.filter((v) => !margins.some((m) => m.var === v.name))}
                    label="Elegir el estrato (distrito, sede…)"
                    onPick={(name) => { ensureCats(name); setDesign({ var: name, pop_sizes: {} }); }}
                  />
                )}
              </div>
            )}

            <StepLabel n={2} text="Metas" />
            <MetasCpv2025
              categoricas={categoricas}
              catCache={catCache}
              ensureCats={ensureCats}
              margenes={margins}
              guardado={pond.metas_cpv2025}
              onAplicar={upsertMargin}
              onGuardarPedido={(metas_cpv2025) => setPonderacion({ metas_cpv2025 })}
            />
            {margins.map((m) => (
              <CategoryEditor
                key={m.var}
                mode="rake"
                variable={m.var}
                label={labelOf(m.var)}
                categorias={catCache[m.var] ?? []}
                values={m.targets}
                fuente={m.fuente ? "CPV 2025" : null}
                observed={preview?.margins?.[m.var]}
                onChange={(vals) => upsertMargin({ var: m.var, targets: vals })}
                onRemove={() => removeMargin(m.var)}
              />
            ))}
            <AddVariable
              variables={categoricas.filter((v) => !margins.some((m) => m.var === v.name) && v.name !== pond.design?.var)}
              label="Agregar variable a ajustar"
              onPick={(name) => { ensureCats(name); upsertMargin({ var: name, targets: {} }); }}
            />

            <StepLabel n={3} text="Ajustes" />
            <PonderacionAjustes
              pond={pond}
              onEscala={(escala) => setPonderacion({ escala })}
              onTotal={(total_poblacion) => setPonderacion({ total_poblacion })}
              onRake={setRake}
              onTrim={setTrim}
            />

            <StepLabel n={4} text="Efecto" />
            <PonderacionEfecto preview={preview} labelOf={labelOf} />
          </>
        )}

      </div>
    </Panel>
  );
}

// ---- Guía de decisión -------------------------------------------------------
function DecisionAid() {
  const [describe, setDescribe] = useState<boolean | null>(null);
  const [margins, setMargins] = useState<boolean | null>(null);
  const answered = describe !== null && margins !== null;
  const conviene = describe === true && margins === true;
  const comparar = describe === false;
  return (
    <div className="pond-card pond-aid">
      <div className="pond-aid-head">
        <HelpCircle size={17} aria-hidden="true" />
        <span className="pond-heading">Antes de empezar: ¿lo necesitas?</span>
      </div>
      <div className="pond-copy">
        Ponderar corrige el sesgo, pero cuesta precisión. Responde dos cosas y te digo si conviene.
      </div>
      {/* C1: dos preguntas independientes; cada fila mide lo que su texto
          necesita al envolver. */}
      <div
        className="pond-yesno-lista"
        data-qa-geometry-group="analitica/ponderacion-preguntas"
        data-qa-geometry-contract="intrinsic"
      >
        <YesNo
          q="¿Vas a describir a la población (no solo comparar grupos entre sí)?"
          yes="Describir población"
          no="Solo comparar grupos"
          value={describe}
          onChange={setDescribe}
        />
        <YesNo
          q="¿Tienes cifras poblacionales confiables (censo, padrón)?"
          yes="Con cifras confiables"
          no="Sin cifras confiables"
          value={margins}
          onChange={setMargins}
        />
      </div>
      {answered && (
        <div className={`pond-veredicto${conviene ? " is-success" : " is-warn"}`} role="status">
          {conviene ? <CheckCircle2 size={17} aria-hidden="true" /> : <Info size={17} aria-hidden="true" />}
          <span>
            {conviene
              ? "Ponderar tiene sentido aquí. Configura los objetivos abajo."
              : comparar
                ? "Si tu objetivo es comparar grupos con un diseño balanceado, probablemente no necesites ponderar: cuesta precisión sin corregir sesgo."
                : "Sin cifras poblacionales confiables no puedes fijar objetivos. Consíguelas antes de ponderar."}
          </span>
        </div>
      )}
    </div>
  );
}

function YesNo({ q, yes, no, value, onChange }: {
  q: string; yes: string; no: string; value: boolean | null; onChange: (v: boolean) => void;
}) {
  return (
    <div className="pond-yesno">
      <span className="pond-yesno-q">{q}</span>
      <div className="analitica-segmented" role="group" aria-label={q}>
        <button type="button" className={value === true ? "is-on" : ""} aria-pressed={value === true} onClick={() => onChange(true)}>{yes}</button>
        <button type="button" className={value === false ? "is-on" : ""} aria-pressed={value === false} onClick={() => onChange(false)}>{no}</button>
      </div>
    </div>
  );
}

// ---- Editor de categorías (rake targets / design pop_sizes) -----------------
function CategoryEditor({ mode, variable, label, categorias, values, fuente, observed, onChange, onRemove }: {
  mode: "rake" | "design";
  variable: string; label: string;
  /** Las metas vienen de una fuente (CPV 2025); editarlas a mano la suelta. */
  fuente?: string | null;
  categorias: ValorColumna[];
  values: Record<string, number>;
  observed?: { categoria: string; muestra: number }[];
  onChange: (vals: Record<string, number>) => void;
  onRemove: () => void;
}) {
  const obs = (cat: string) => observed?.find((o) => o.categoria === cat)?.muestra;
  const set = (cat: string, raw: string) => {
    const next = { ...values };
    const num = parseFloat(raw);
    if (raw === "" || !Number.isFinite(num)) delete next[cat];
    else next[cat] = num;
    onChange(next);
  };
  const usarMuestra = () => {
    const next: Record<string, number> = {};
    categorias.forEach((c) => { const o = obs(c.value); if (o != null) next[c.value] = +(o * 100).toFixed(1); });
    onChange(next);
  };
  const igualar = () => {
    const next: Record<string, number> = {};
    const k = categorias.length || 1;
    categorias.forEach((c) => { next[c.value] = +(100 / k).toFixed(1); });
    onChange(next);
  };
  const isRake = mode === "rake";
  // Metas del censo llegan en conteos; las tecleadas, en porcentaje.
  const enConteos = Object.values(values).reduce((a, b) => a + b, 0) > 101;
  return (
    <div className={`pond-card pond-categorias${isRake ? " is-rake" : " is-design"}`}>
      <div className="pond-categorias-head">
        <span className="pond-title">{label}</span>
        {fuente && (
          <span className="pond-categorias-fuente" title="Población censada, sin la omisión censal. Editar una meta la deja como tecleada.">
            <Landmark size={12} aria-hidden="true" />{fuente}
          </span>
        )}
        {isRake && (
          <span className="pond-categorias-acciones">
            <PulsoButton variant="secondary" size="sm" onClick={usarMuestra} title="Prefijar los objetivos con la distribución actual de tu muestra">
              Usar muestra
            </PulsoButton>
            <PulsoButton variant="secondary" size="sm" onClick={igualar}>Igualar</PulsoButton>
          </span>
        )}
        <PulsoButton variant="icon" size="sm" aria-label={`Quitar ${variable}`} onClick={onRemove} className="pond-categorias-quitar">
          <X size={15} aria-hidden="true" />
        </PulsoButton>
      </div>
      <div className="pond-categorias-fila is-cabecera">
        <span>categoría</span>
        {isRake && <span className="pond-num">en tu muestra</span>}
        <span className="pond-num">{isRake && !enConteos ? "meta %" : "población"}</span>
      </div>
      {categorias.length === 0 && (
        <div className="pond-copy pond-categorias-cargando">Cargando categorías…</div>
      )}
      {categorias.map((c) => (
        <div key={c.value} className="pond-categorias-fila">
          <span className="pond-categorias-nombre">{c.label || c.value}</span>
          {isRake && (
            <span className="pond-num pond-categorias-muestra">
              {obs(c.value) != null ? pct(obs(c.value)!) : "—"}
            </span>
          )}
          <input
            value={values[c.value] ?? ""}
            onChange={(e) => set(c.value, e.target.value)}
            placeholder={isRake && !enConteos ? "%" : "n"}
            inputMode="decimal"
            className="pond-categorias-input"
            aria-label={`${isRake ? "objetivo" : "población"} ${c.label}`}
          />
        </div>
      ))}
    </div>
  );
}

// ---- Agregar variable -------------------------------------------------------
function AddVariable({ variables, label, onPick }: {
  variables: VariableInstrumento[]; label: string; onPick: (name: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  if (!adding) {
    return (
      <PulsoButton variant="secondary" className="analitica-add-button" onClick={() => setAdding(true)}>
        <Plus size={13} aria-hidden="true" /> {label}
      </PulsoButton>
    );
  }
  return (
    <div className="pond-add">
      <div className="pond-add-select">
        <VariableSelect variables={variables} value="" onChange={(name) => { if (name) onPick(name); setAdding(false); }} placeholder="Elegir variable categórica…" />
      </div>
      <PulsoButton variant="secondary" onClick={() => setAdding(false)}>Cancelar</PulsoButton>
    </div>
  );
}

function StepLabel({ n, text }: { n: number; text: string }) {
  return (
    <div className="pond-paso">
      Paso {n} — {text}
    </div>
  );
}
