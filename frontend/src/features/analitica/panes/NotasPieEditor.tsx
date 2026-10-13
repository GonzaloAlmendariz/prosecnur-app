import { useEffect, useId, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronDown, FileText, GitBranch, Plus, X } from "lucide-react";
import type { VariableInstrumento } from "../../../api/client";
import { useAnaliticaStore } from "../store";
import { VariableSelect } from "../VariableSelect";
import {
  coerceUmbral,
  notasDeCruceHuerfanas,
  notasDeCruceVisibles,
  resumenNotasPie,
  setNotaTexto,
} from "./notasPieModel";
import "./NotasPieEditor.css";

// NotasPieEditor: sección plegable «Notas al pie» de Frecuencias y Cruces.
// Ambos panes editan el mismo bloque `config.notas` (contrato con el motor R).
// Frecuencias muestra fuente y bases; Cruces suma notas por variable de cruce
// y el aviso de base reducida.

type Props = {
  variante: "frecuencias" | "cruces";
  // Variables que el pane ya ofrece (las candidatas a tener base propia).
  variables: VariableInstrumento[];
  // Solo en Cruces: variables del banner, en su orden.
  crucesVars?: readonly string[];
  // Plegada por defecto; abierta solo para pruebas o enlaces futuros.
  defaultOpen?: boolean;
};

export function NotasPieEditor({ variante, variables, crucesVars = [], defaultOpen = false }: Props) {
  const notas = useAnaliticaStore((s) => s.config.notas);
  const setNotas = useAnaliticaStore((s) => s.setNotas);
  const [open, setOpen] = useState(defaultOpen);
  const bodyId = useId();
  const conCruces = variante === "cruces";
  const resumen = resumenNotasPie(notas, conCruces);

  return (
    <section
      className="analitica-collapsible analitica-notas-pie"
      aria-label="Notas al pie"
    >
      <button
        type="button"
        className="analitica-collapsible-trigger"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="analitica-collapsible-chevron" data-open={open ? "true" : "false"} aria-hidden="true">
          <ChevronDown size={13} />
        </span>
        <span>Notas al pie</span>
        {!open && <span className="analitica-collapsible-summary">{resumen}</span>}
      </button>

      {open && (
        <div
          id={bodyId}
          className="analitica-collapsible-body analitica-notas-pie-body"
          data-qa-geometry-group={`analitica-notas-pie-${variante}`}
          data-qa-geometry-contract="intrinsic"
        >
          <div className="analitica-notas-pie-fields">
            <label className="analitica-notas-pie-field" data-qa-geometry-member="true">
              <span className="pulso-section-eyebrow">Fuente</span>
              <input
                type="text"
                value={notas.fuente}
                placeholder="Pulso PUCP 2026."
                onChange={(e) => setNotas({ fuente: e.target.value })}
              />
              <small>Se imprime como «Fuente: …».</small>
            </label>
            <label className="analitica-notas-pie-field" data-qa-geometry-member="true">
              <span className="pulso-section-eyebrow">Base por defecto</span>
              <input
                type="text"
                value={notas.base_defecto}
                placeholder="total de encuestados."
                onChange={(e) => setNotas({ base_defecto: e.target.value })}
              />
              <small>Vacía, la tabla no lleva línea de base.</small>
            </label>
          </div>

          <BasesPorPregunta
            variables={variables}
            valores={notas.base_por_pregunta}
            onChange={(base_por_pregunta) => setNotas({ base_por_pregunta })}
          />

          {conCruces && (
            <>
              <NotasPorCruce
                crucesVars={crucesVars}
                variables={variables}
                valores={notas.por_cruce}
                onChange={(por_cruce) => setNotas({ por_cruce })}
              />
              <BaseReducida
                activo={notas.base_reducida.activo}
                umbral={notas.base_reducida.umbral}
                onChange={(base_reducida) => setNotas({ base_reducida })}
              />
            </>
          )}
        </div>
      )}
    </section>
  );
}

// -- Base por pregunta -------------------------------------------------------

function BasesPorPregunta({
  variables,
  valores,
  onChange,
}: {
  variables: VariableInstrumento[];
  valores: Record<string, string>;
  onChange: (next: Record<string, string>) => void;
}) {
  // Filas agregadas aún sin texto: viven solo en la UI hasta que se escriba
  // algo (el store guarda únicamente entradas no vacías).
  const [pendientes, setPendientes] = useState<string[]>([]);
  const [adding, setAdding] = useState(false);
  const [pendingVar, setPendingVar] = useState("");

  const filas = useMemo(() => {
    const guardadas = Object.keys(valores);
    return [...guardadas, ...pendientes.filter((v) => !(v in valores))];
  }, [valores, pendientes]);
  const labelPorVariable = useMemo(() => new Map(variables.map((v) => [v.name, v.label])), [variables]);

  function commitAdd() {
    if (pendingVar && !filas.includes(pendingVar)) setPendientes((p) => [...p, pendingVar]);
    setPendingVar("");
    setAdding(false);
  }

  function quitar(variable: string) {
    setPendientes((p) => p.filter((v) => v !== variable));
    if (variable in valores) onChange(setNotaTexto(valores, variable, ""));
  }

  return (
    <div className="analitica-notas-pie-group" data-qa-geometry-member="true">
      <div className="analitica-notas-pie-group-head">
        <span className="pulso-section-eyebrow">Base por pregunta</span>
        <small>Reemplaza la base por defecto en esa tabla.</small>
      </div>
      {filas.length === 0 && !adding && (
        <div className="analitica-empty" data-qa-geometry-capacity="owned">
          <span className="analitica-empty-icon" aria-hidden="true">
            <FileText size={15} />
          </span>
          <strong>Todas usan la base por defecto</strong>
          <small>Agrega una pregunta con base distinta, por ejemplo un filtro.</small>
        </div>
      )}
      {filas.length > 0 && (
        <ul className="analitica-notas-pie-list">
          {filas.map((variable) => (
            <NotaRow
              key={variable}
              variable={variable}
              etiqueta={labelPorVariable.get(variable)}
              texto={valores[variable] ?? ""}
              placeholder="quienes respondieron la pregunta anterior."
              onTexto={(texto) => onChange(setNotaTexto(valores, variable, texto))}
              onQuitar={() => quitar(variable)}
            />
          ))}
        </ul>
      )}
      {adding ? (
        <div className="analitica-picker-edit-row">
          <div className="analitica-picker-select">
            <VariableSelect
              variables={variables.filter((v) => !filas.includes(v.name))}
              value={pendingVar}
              onChange={setPendingVar}
              placeholder="Seleccionar pregunta…"
            />
          </div>
          <button type="button" className="pulso-primary" onClick={commitAdd} disabled={!pendingVar}>
            Añadir
          </button>
          <button
            type="button"
            className="pulso-secondary"
            onClick={() => { setAdding(false); setPendingVar(""); }}
          >
            Cancelar
          </button>
        </div>
      ) : (
        <button type="button" className="analitica-add-inline" onClick={() => setAdding(true)}>
          <Plus size={12} /> Añadir base para una pregunta
        </button>
      )}
    </div>
  );
}

// -- Notas por variable de cruce --------------------------------------------

function NotasPorCruce({
  crucesVars,
  variables,
  valores,
  onChange,
}: {
  crucesVars: readonly string[];
  variables: VariableInstrumento[];
  valores: Record<string, string>;
  onChange: (next: Record<string, string>) => void;
}) {
  const filas = notasDeCruceVisibles(valores, crucesVars);
  const huerfanas = notasDeCruceHuerfanas(valores, crucesVars);
  const labelPorVariable = useMemo(() => new Map(variables.map((v) => [v.name, v.label])), [variables]);

  return (
    <div className="analitica-notas-pie-group" data-qa-geometry-member="true">
      <div className="analitica-notas-pie-group-head">
        <span className="pulso-section-eyebrow">Nota por variable de cruce</span>
        <small>Va debajo de cada tabla, en el orden de las columnas.</small>
      </div>
      {filas.length === 0 ? (
        <div className="analitica-empty" data-qa-geometry-capacity="owned">
          <span className="analitica-empty-icon" aria-hidden="true">
            <GitBranch size={15} />
          </span>
          <strong>Sin variables de cruce</strong>
          <small>Agrega una en Variables a cruzar para anotarla.</small>
        </div>
      ) : (
        <ul className="analitica-notas-pie-list">
          {filas.map(({ variable, texto }) => (
            <NotaRow
              key={variable}
              variable={variable}
              etiqueta={labelPorVariable.get(variable)}
              texto={texto}
              placeholder="Agrupa las regiones con menos de 30 casos."
              onTexto={(t) => onChange(setNotaTexto(valores, variable, t))}
            />
          ))}
        </ul>
      )}
      {huerfanas.length > 0 && (
        <p className="analitica-notas-pie-hint">
          {huerfanas.length === 1 ? "Una nota queda guardada" : `${huerfanas.length} notas quedan guardadas`} para{" "}
          {huerfanas.map((v, i) => (
            <span key={v}>{i > 0 ? ", " : ""}<code>{v}</code></span>
          ))}
          . Vuelve a aparecer si agregas la variable.
        </p>
      )}
    </div>
  );
}

// -- Fila de nota ------------------------------------------------------------

function NotaRow({
  variable,
  etiqueta,
  texto,
  placeholder,
  onTexto,
  onQuitar,
}: {
  variable: string;
  etiqueta?: string;
  texto: string;
  placeholder: string;
  onTexto: (texto: string) => void;
  onQuitar?: () => void;
}) {
  const inputId = useId();
  return (
    <li className={`analitica-notas-pie-row${onQuitar ? " has-action" : ""}`}>
      <label htmlFor={inputId} className="analitica-notas-pie-row-var" title={etiqueta ?? variable}>
        <code>{variable}</code>
        {etiqueta && <span>{etiqueta}</span>}
      </label>
      <input
        id={inputId}
        type="text"
        value={texto}
        placeholder={placeholder}
        onChange={(e) => onTexto(e.target.value)}
      />
      {onQuitar && (
        <button type="button" className="pulso-icon" onClick={onQuitar} aria-label={`Quitar la base de ${variable}`}>
          <X size={11} />
        </button>
      )}
    </li>
  );
}

// -- Aviso de base reducida --------------------------------------------------

function BaseReducida({
  activo,
  umbral,
  onChange,
}: {
  activo: boolean;
  umbral: number;
  onChange: (patch: { activo?: boolean; umbral?: number }) => void;
}) {
  // Borrador local para poder vaciar el campo mientras se escribe.
  const [borrador, setBorrador] = useState(String(umbral));
  const umbralId = useId();
  useEffect(() => { setBorrador(String(umbral)); }, [umbral]);

  function commit(valor: string) {
    const n = coerceUmbral(valor);
    setBorrador(String(n));
    if (n !== umbral) onChange({ umbral: n });
  }

  return (
    <div className="analitica-notas-pie-group" data-qa-geometry-member="true">
      <label className={`analitica-control-card ${activo ? "is-active" : ""}`}>
        <input type="checkbox" checked={activo} onChange={(e) => onChange({ activo: e.target.checked })} />
        <span className="analitica-control-icon">
          {activo ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}
        </span>
        <span className="analitica-control-stack">
          <span className="analitica-control-title">Avisar base reducida</span>
          <span className="analitica-control-copy">
            Nombra las columnas con menos casos válidos sin ponderar que el umbral.
          </span>
        </span>
      </label>
      <div className="analitica-notas-pie-umbral">
        <label htmlFor={umbralId}>Umbral de casos</label>
        <input
          id={umbralId}
          type="number"
          min={1}
          step={1}
          inputMode="numeric"
          value={borrador}
          disabled={!activo}
          onChange={(e) => {
            setBorrador(e.target.value);
            const n = Number(e.target.value);
            if (e.target.value !== "" && Number.isFinite(n) && n >= 1) onChange({ umbral: Math.floor(n) });
          }}
          onBlur={(e) => commit(e.target.value)}
        />
      </div>
    </div>
  );
}
