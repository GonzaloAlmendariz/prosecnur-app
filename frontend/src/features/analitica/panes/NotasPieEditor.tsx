import { useEffect, useId, useMemo, useState, type ReactNode } from "react";
import { AlertTriangle, CheckCircle2, ChevronDown, FileText, GitBranch, Plus, X } from "lucide-react";
import type { VariableInstrumento } from "../../../api/client";
import { PulsoButton } from "../../../components/PulsoButton";
import { useAnaliticaStore } from "../store";
import { VariableSelect } from "../VariableSelect";
import {
  coerceUmbral,
  filasDeNotas,
  notasDeCruceHuerfanas,
  notasDeCruceVisibles,
  notasFueraDeOpciones,
  resumenNotasComparativo,
  resumenNotasPie,
  setNotaTexto,
  type OpcionNota,
} from "./notasPieModel";
import "./NotasPieEditor.css";

// NotasPieEditor: sección plegable «Notas al pie», una sola para Analítica.
// - Frecuencias y Cruces editan el bloque `config.notas` del store (contrato
//   con el motor R `reporte_notas_pie.R`): fuente, bases y, en Cruces, notas
//   por variable de cruce y aviso de base reducida.
// - Comparativos edita sus propias notas (`notas_pregunta` / `notas_generales`
//   del body del comparativo), que llegan por props: no tocan `config.notas`.
// Las notas por pregunta siguen un único patrón: vacío propio y «Añadir…» con
// selector, nunca un campo por pregunta.

type PropsDelReporte = {
  variante: "frecuencias" | "cruces";
  // Variables que el pane ya ofrece (las candidatas a tener base propia).
  variables: VariableInstrumento[];
  // Solo en Cruces: variables del banner, en su orden.
  crucesVars?: readonly string[];
  // Plegada por defecto; abierta solo para pruebas o enlaces futuros.
  defaultOpen?: boolean;
};

type PropsDelComparativo = {
  variante: "comparativo";
  // Preguntas elegidas en el comparativo: las únicas que pueden llevar nota.
  preguntas: readonly OpcionNota[];
  notasPregunta: Record<string, string>;
  notasGenerales: string;
  onNota: (clave: string, texto: string) => void;
  onGenerales: (texto: string) => void;
  defaultOpen?: boolean;
};

export type NotasPieEditorProps = PropsDelReporte | PropsDelComparativo;

export function NotasPieEditor(props: NotasPieEditorProps) {
  return props.variante === "comparativo"
    ? <NotasDelComparativo {...props} />
    : <NotasDelReporte {...props} />;
}

// -- Plegable ----------------------------------------------------------------

function NotasPiePlegable({
  variante,
  resumen,
  defaultOpen,
  children,
}: {
  variante: NotasPieEditorProps["variante"];
  resumen: string;
  defaultOpen: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const bodyId = useId();
  return (
    <section
      className="analitica-collapsible analitica-notas-pie"
      aria-label="Notas al pie"
      data-qa-geometry-member="true"
    >
      <button
        type="button"
        className="analitica-collapsible-trigger analitica-notas-pie-trigger"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="analitica-collapsible-chevron" data-open={open ? "true" : "false"} aria-hidden="true">
          <ChevronDown size={13} />
        </span>
        <span className="analitica-notas-pie-titulo">Notas al pie</span>
        <span className="analitica-collapsible-summary">{resumen}</span>
      </button>

      {open && (
        <div
          id={bodyId}
          className="analitica-collapsible-body analitica-notas-pie-body"
          data-qa-geometry-group={`analitica-notas-pie-${variante}`}
          data-qa-geometry-contract="intrinsic"
        >
          {children}
        </div>
      )}
    </section>
  );
}

// -- Frecuencias y Cruces (store) -------------------------------------------

function NotasDelReporte({ variante, variables, crucesVars = [], defaultOpen = false }: PropsDelReporte) {
  const notas = useAnaliticaStore((s) => s.config.notas);
  const setNotas = useAnaliticaStore((s) => s.setNotas);
  const conCruces = variante === "cruces";
  const opciones = useMemo(() => opcionesDeVariables(variables), [variables]);

  return (
    <NotasPiePlegable variante={variante} resumen={resumenNotasPie(notas, conCruces)} defaultOpen={defaultOpen}>
      <div className="analitica-notas-pie-fields">
        <label className="analitica-notas-pie-field" data-qa-geometry-member="true">
          <span className="pulso-section-eyebrow">Fuente</span>
          <input
            type="text"
            value={notas.fuente}
            placeholder="Nombre de la institución y año del estudio"
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

      <NotasPorPregunta
        opciones={opciones}
        valores={notas.base_por_pregunta}
        onTexto={(clave, texto) => setNotas({ base_por_pregunta: setNotaTexto(notas.base_por_pregunta, clave, texto) })}
        textos={TEXTOS_BASE_POR_PREGUNTA}
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
    </NotasPiePlegable>
  );
}

function opcionesDeVariables(variables: readonly VariableInstrumento[]): OpcionNota[] {
  return variables.map((v) => ({ clave: v.name, etiqueta: v.label, codigo: v.name, tipo: v.tipo }));
}

// -- Comparativos (props) ----------------------------------------------------

function NotasDelComparativo({
  preguntas,
  notasPregunta,
  notasGenerales,
  onNota,
  onGenerales,
  defaultOpen = false,
}: PropsDelComparativo) {
  const generalesId = useId();
  const { visibles, fuera } = notasFueraDeOpciones(notasPregunta, preguntas);
  return (
    <NotasPiePlegable
      variante="comparativo"
      resumen={resumenNotasComparativo(notasPregunta, notasGenerales, preguntas)}
      defaultOpen={defaultOpen}
    >
      <div className="analitica-notas-pie-field" data-qa-geometry-member="true">
        <label htmlFor={generalesId} className="pulso-section-eyebrow">Notas generales</label>
        <textarea
          id={generalesId}
          rows={3}
          value={notasGenerales}
          placeholder="Una nota por línea."
          onChange={(e) => onGenerales(e.target.value)}
        />
        <small>Una por línea. Salen bajo todas las tablas.</small>
      </div>

      <NotasPorPregunta
        opciones={preguntas}
        valores={visibles}
        onTexto={onNota}
        textos={TEXTOS_NOTA_POR_PREGUNTA}
        pie={fuera > 0 ? (
          <p className="analitica-notas-pie-hint">
            {fuera === 1
              ? "Una nota queda guardada para una pregunta que no está elegida. No se imprime mientras no la elijas."
              : `${fuera} notas quedan guardadas para preguntas que no están elegidas. No se imprimen mientras no las elijas.`}
          </p>
        ) : null}
      />
    </NotasPiePlegable>
  );
}

// -- Notas por pregunta (patrón único) --------------------------------------

type TextosNotasPorPregunta = {
  titulo: string;
  ayuda: string;
  vacioTitulo: string;
  vacioPista: string;
  anadir: string;
  placeholder: string;
  quitar: (pregunta: string) => string;
};

const TEXTOS_BASE_POR_PREGUNTA: TextosNotasPorPregunta = {
  titulo: "Base por pregunta",
  ayuda: "Reemplaza la base por defecto en esa tabla.",
  vacioTitulo: "Todas usan la base por defecto",
  vacioPista: "Agrega una pregunta con base distinta, por ejemplo un filtro.",
  anadir: "Añadir base para una pregunta",
  placeholder: "quienes respondieron la pregunta anterior.",
  quitar: (pregunta) => `Quitar la base de ${pregunta}`,
};

const TEXTOS_NOTA_POR_PREGUNTA: TextosNotasPorPregunta = {
  titulo: "Nota por pregunta",
  ayuda: "Sale bajo la tabla de esa pregunta, después de las notas generales.",
  vacioTitulo: "Ninguna pregunta lleva nota propia",
  vacioPista: "Agrega una para aclarar un cambio de redacción o de filtro entre bases.",
  anadir: "Añadir nota para una pregunta",
  placeholder: "En 2024 la pregunta se hizo solo a quienes trabajan.",
  quitar: (pregunta) => `Quitar la nota de ${pregunta}`,
};

function NotasPorPregunta({
  opciones,
  valores,
  onTexto,
  textos,
  pie,
}: {
  opciones: readonly OpcionNota[];
  valores: Record<string, string>;
  onTexto: (clave: string, texto: string) => void;
  textos: TextosNotasPorPregunta;
  pie?: ReactNode;
}) {
  // Filas agregadas aún sin texto: viven solo en la UI hasta que se escriba
  // algo (sólo se guardan entradas no vacías).
  const [pendientes, setPendientes] = useState<string[]>([]);
  const [adding, setAdding] = useState(false);
  const [pendingVar, setPendingVar] = useState("");

  const filas = useMemo(() => filasDeNotas(valores, pendientes), [valores, pendientes]);
  const porClave = useMemo(() => new Map(opciones.map((o) => [o.clave, o])), [opciones]);
  // VariableSelect lista variables del instrumento; una opción sin código
  // (una fila del comparativo) se muestra sólo con su etiqueta.
  const conCodigo = opciones.some((o) => o.codigo);
  const seleccionables = useMemo<VariableInstrumento[]>(
    () => opciones
      .filter((o) => !filas.includes(o.clave))
      .map((o) => ({ name: o.clave, label: o.etiqueta, tipo: o.tipo ?? "", list_name: "" })),
    [opciones, filas],
  );

  function commitAdd() {
    if (pendingVar && !filas.includes(pendingVar)) setPendientes((p) => [...p, pendingVar]);
    setPendingVar("");
    setAdding(false);
  }

  function quitar(clave: string) {
    setPendientes((p) => p.filter((v) => v !== clave));
    if (clave in valores) onTexto(clave, "");
  }

  return (
    <div className="analitica-notas-pie-group" data-qa-geometry-member="true">
      <div className="analitica-notas-pie-group-head">
        <span className="pulso-section-eyebrow">{textos.titulo}</span>
        <small>{textos.ayuda}</small>
      </div>
      {filas.length === 0 && !adding && (
        <div className="analitica-empty" data-qa-geometry-capacity="owned">
          <span className="analitica-empty-icon" aria-hidden="true">
            <FileText size={15} />
          </span>
          <strong>{textos.vacioTitulo}</strong>
          <small>{textos.vacioPista}</small>
        </div>
      )}
      {filas.length > 0 && (
        <ul className="analitica-notas-pie-list">
          {filas.map((clave) => {
            const opcion = porClave.get(clave);
            const nombre = opcion?.etiqueta || opcion?.codigo || clave;
            return (
              <NotaRow
                key={clave}
                codigo={opcion ? opcion.codigo : clave}
                etiqueta={opcion?.etiqueta}
                texto={valores[clave] ?? ""}
                placeholder={textos.placeholder}
                onTexto={(texto) => onTexto(clave, texto)}
                onQuitar={() => quitar(clave)}
                quitarLabel={textos.quitar(nombre)}
              />
            );
          })}
        </ul>
      )}
      {adding ? (
        <div className="analitica-picker-edit-row">
          <div className="analitica-picker-select">
            <VariableSelect
              variables={seleccionables}
              value={pendingVar}
              onChange={setPendingVar}
              placeholder="Seleccionar pregunta…"
              mostrarNombre={conCodigo}
            />
          </div>
          <PulsoButton variant="primary" onClick={commitAdd} disabled={!pendingVar}>
            Añadir
          </PulsoButton>
          <PulsoButton variant="secondary" onClick={() => { setAdding(false); setPendingVar(""); }}>
            Cancelar
          </PulsoButton>
        </div>
      ) : (
        <button type="button" className="analitica-add-inline" onClick={() => setAdding(true)} disabled={opciones.length === 0}>
          <Plus size={12} /> {textos.anadir}
        </button>
      )}
      {pie}
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
              codigo={variable}
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
  codigo,
  etiqueta,
  texto,
  placeholder,
  onTexto,
  onQuitar,
  quitarLabel,
}: {
  // Nombre de la variable; ausente en las filas del comparativo.
  codigo?: string;
  etiqueta?: string;
  texto: string;
  placeholder: string;
  onTexto: (texto: string) => void;
  onQuitar?: () => void;
  quitarLabel?: string;
}) {
  const inputId = useId();
  return (
    <li className={`analitica-notas-pie-row${onQuitar ? " has-action" : ""}`}>
      <label
        htmlFor={inputId}
        className={`analitica-notas-pie-row-var${codigo ? "" : " is-etiqueta"}`}
        title={etiqueta || codigo}
      >
        {codigo && <code>{codigo}</code>}
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
        <PulsoButton variant="icon" size="sm" onClick={onQuitar} aria-label={quitarLabel ?? "Quitar"}>
          <X size={12} aria-hidden="true" />
        </PulsoButton>
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
