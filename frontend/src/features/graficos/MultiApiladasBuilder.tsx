import { useMemo, useState } from "react";
import type React from "react";
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  GitCompare,
  Layers3,
  ListPlus,
  Plus,
  Rows3,
  Split,
  Trash2,
  UsersRound,
} from "lucide-react";
import { GraficadorRef } from "../../api/client";
import { VarWithSource, formatVarRef, parseVarRef, useVariables } from "./useVariables";

type Props = {
  graf: GraficadorRef;
  onArgs: (patch: Record<string, unknown>) => void;
};

type Intent = "comparar" | "pregunta_grupos" | "preguntas_grupos" | "publicos_tema" | "combinar";

type TopicBlock = {
  key: string;
  title: string;
  vars: string[];
};

type MultiBlock = {
  modo?: string;
  vars?: unknown;
  var?: unknown;
  cruces?: unknown;
  titulo?: unknown;
  subtitulo?: unknown;
  altura_rel?: unknown;
  top2box?: unknown;
  top2box_labels?: unknown;
  titulos_grupo?: unknown;
};

const INTENTS: {
  key: Intent;
  title: string;
  description: string;
  example: string;
  Icon: typeof GitCompare;
  requiresMulti?: boolean;
}[] = [
  {
    key: "comparar",
    title: "Comparar preguntas",
    description: "Varias preguntas con la misma escala, una fila por pregunta.",
    example: "Satisfaccion, claridad y confianza en una sola lectura.",
    Icon: GitCompare,
  },
  {
    key: "pregunta_grupos",
    title: "Abrir una pregunta por grupos",
    description: "Una pregunta dividida por region, sexo, sede u otro grupo.",
    example: "Satisfaccion por region.",
    Icon: Split,
  },
  {
    key: "preguntas_grupos",
    title: "Abrir preguntas por grupos",
    description: "Varias preguntas, cada una abierta por el mismo grupo.",
    example: "Tres indicadores por tipo de usuario.",
    Icon: Layers3,
  },
  {
    key: "publicos_tema",
    title: "Comparar publicos por tema",
    description: "Temas comparados entre fuentes o bases del estudio.",
    example: "Docentes, estudiantes y administrativos frente al mismo tema.",
    Icon: UsersRound,
    requiresMulti: true,
  },
  {
    key: "combinar",
    title: "Combinar bloques",
    description: "Varios bloques verticales, incluso con escalas distintas.",
    example: "Un bloque Likert y otro Si/No en la misma lamina.",
    Icon: Rows3,
  },
];

export default function MultiApiladasBuilder({ graf, onArgs }: Props) {
  const { variables, multi, sources, loading } = useVariables();
  const [reviewRequested, setReviewRequested] = useState(false);
  const args = graf.args ?? {};
  const intent = detectIntent(args);
  const refs = refsForIntent(args);
  const issues = validateArgs(args, variables, multi);
  const scale = scaleSummary(refs, variables, multi);
  const summary = buildSummary(intent, args, refs, variables, multi);
  const hasErrors = issues.some((i) => i.kind === "error");

  function commitArgs(patch: Record<string, unknown>) {
    onArgs(patch);
  }

  function setIntent(next: Intent) {
    if (next === "publicos_tema" && (!multi || sources.length < 2)) return;
    setReviewRequested(false);
    if (next === "comparar") {
      commitArgs({
        modo: "var",
        vars: asStringArray(args.vars),
        var: null,
        cruces: null,
        bloques: null,
        titulos_grupo: null,
      });
    } else if (next === "pregunta_grupos") {
      commitArgs({
        modo: "cruce",
        vars: null,
        var: typeof args.var === "string" ? args.var : "",
        cruces: typeof args.cruces === "string" ? args.cruces : "",
        bloques: null,
        titulos_grupo: null,
      });
    } else if (next === "preguntas_grupos") {
      commitArgs({
        modo: "var_cruce",
        vars: Array.isArray(args.vars) ? args.vars : [],
        var: null,
        cruces: typeof args.cruces === "string" ? args.cruces : "",
        bloques: null,
      });
    } else if (next === "publicos_tema") {
      const topics = topicsFromArgs(args.vars, args.titulos_grupo);
      commitArgs({
        modo: "var_cruce",
        vars: topicsToVars(topics.length ? topics : [newTopic(1)]),
        titulos_grupo: topicsToTitles(topics.length ? topics : [newTopic(1)]),
        var: null,
        cruces: null,
        bloques: null,
      });
    } else {
      commitArgs({
        modo: "multilista",
        bloques: asBlocks(args.bloques).length ? asBlocks(args.bloques) : [{ modo: "var", vars: [] }],
        vars: null,
        var: null,
        cruces: null,
        titulos_grupo: null,
      });
    }
  }

  if (loading) {
    return <div style={hintStyle}>Cargando variables del estudio...</div>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <section style={panelStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
          <div>
            <div style={eyebrowStyle}>Constructor de multi-apiladas</div>
            <div style={{ fontSize: 13, color: "var(--pulso-text)", lineHeight: 1.45 }}>
              Elige como quieres leer los datos y completa solo los campos que necesita esa lectura.
            </div>
          </div>
          <StatusPill
            tone={reviewRequested ? (hasErrors ? "error" : "ok") : "idle"}
            onClick={() => setReviewRequested(true)}
          >
            {reviewRequested ? (hasErrors ? "Revisar datos" : "Todo listo") : "Revisar seleccion"}
          </StatusPill>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 8, marginTop: 12 }}>
          {INTENTS.map((item) => {
            const active = item.key === intent;
            const disabled = item.requiresMulti && (!multi || sources.length < 2);
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setIntent(item.key)}
                disabled={disabled}
                style={{
                  ...intentButtonStyle,
                  borderColor: active ? "var(--pulso-primary)" : "var(--pulso-border)",
                  background: active ? "var(--pulso-primary-soft)" : "white",
                  opacity: disabled ? 0.52 : 1,
                  cursor: disabled ? "not-allowed" : "pointer",
                }}
                title={disabled ? "Requiere que el estudio tenga varias bases cargadas." : item.description}
              >
                <span style={{ display: "flex", alignItems: "center", gap: 7, color: active ? "var(--pulso-primary)" : "var(--pulso-text)" }}>
                  <item.Icon size={14} />
                  <strong>{item.title}</strong>
                </span>
                <span style={{ fontSize: 11, lineHeight: 1.35, color: "var(--pulso-text-soft)" }}>
                  {disabled ? "Requiere varias bases cargadas." : item.description}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <SummaryPanel summary={summary} scale={scale} multi={multi} />
      {reviewRequested && <IssuesPanel issues={issues} />}

      {intent === "comparar" && (
        <CompareQuestions args={args} onArgs={commitArgs} variables={variables} multi={multi} />
      )}
      {intent === "pregunta_grupos" && (
        <QuestionByGroups args={args} onArgs={commitArgs} variables={variables} multi={multi} />
      )}
      {intent === "preguntas_grupos" && (
        <QuestionsByGroups args={args} onArgs={commitArgs} variables={variables} multi={multi} />
      )}
      {intent === "publicos_tema" && (
        <PublicsByTopic args={args} onArgs={commitArgs} variables={variables} multi={multi} sourceCount={sources.length} />
      )}
      {intent === "combinar" && (
        <MultiListBlocks args={args} onArgs={commitArgs} variables={variables} multi={multi} sourceCount={sources.length} />
      )}
    </div>
  );
}

function CompareQuestions({ args, onArgs, variables, multi }: BuilderSectionProps) {
  const vars = asStringArray(args.vars);
  return (
    <BuilderSection title="Preguntas a comparar" hint="Todas deben compartir escala. El gráfico crea una fila por pregunta.">
      <MultiVarPicker
        value={vars}
        onChange={(next) => onArgs({ modo: "var", vars: next })}
        variables={variables}
        multi={multi}
      />
      <ScaleInline refs={vars} variables={variables} multi={multi} />
      <SettingsPanel args={args} onArgs={onArgs} />
    </BuilderSection>
  );
}

function QuestionByGroups({ args, onArgs, variables, multi }: BuilderSectionProps) {
  const varRef = typeof args.var === "string" ? args.var : "";
  const cruce = typeof args.cruces === "string" ? args.cruces : "";
  return (
    <BuilderSection title="Pregunta y grupo" hint="La pregunta define los segmentos de color; el grupo define las filas.">
      <FieldLabel label="Pregunta principal" help="Sus opciones se convierten en segmentos apilados.">
        <SingleVarSelect value={varRef} onChange={(v) => onArgs({ modo: "cruce", var: v })} variables={variables} multi={multi} />
      </FieldLabel>
      <FieldLabel label="Grupo para abrir" help="Cada valor de esta variable sera una fila del grafico.">
        <SingleVarSelect value={cruce} onChange={(v) => onArgs({ modo: "cruce", cruces: v })} variables={variables} multi={multi} />
      </FieldLabel>
      <ScaleInline refs={varRef ? [varRef] : []} variables={variables} multi={multi} />
      <SettingsPanel args={args} onArgs={onArgs} />
    </BuilderSection>
  );
}

function QuestionsByGroups({ args, onArgs, variables, multi }: BuilderSectionProps) {
  const vars = asStringArray(args.vars);
  const cruce = typeof args.cruces === "string" ? args.cruces : "";
  const titles = titlesFromValue(args.titulos_grupo);
  return (
    <BuilderSection title="Preguntas y grupo comun" hint="Cada pregunta queda como bloque, y dentro se muestran los valores del grupo.">
      <MultiVarPicker
        value={vars}
        onChange={(next) => onArgs({ modo: "var_cruce", vars: next })}
        variables={variables}
        multi={multi}
      />
      <FieldLabel label="Grupo para abrir" help="El mismo grupo se aplica a todas las preguntas.">
        <SingleVarSelect value={cruce} onChange={(v) => onArgs({ modo: "var_cruce", cruces: v })} variables={variables} multi={multi} />
      </FieldLabel>
      <TitlesEditor
        keys={vars}
        titles={titles}
        variables={variables}
        multi={multi}
        onChange={(next) => onArgs({ titulos_grupo: next })}
      />
      <ScaleInline refs={vars} variables={variables} multi={multi} />
      <SettingsPanel args={args} onArgs={onArgs} />
    </BuilderSection>
  );
}

function PublicsByTopic({ args, onArgs, variables, multi, sourceCount }: BuilderSectionProps & { sourceCount: number }) {
  const topics = topicsFromArgs(args.vars, args.titulos_grupo);
  if (!multi || sourceCount < 2) {
    return (
      <RequirementPanel
        title="Esta intención requiere varias bases"
        text="Para comparar publicos por tema, primero declara y carga varias bases del estudio en Carga. Luego cada fila podra representar una fuente."
      />
    );
  }
  return (
    <BuilderSection title="Temas y publicos" hint="Cada tema agrupa variables equivalentes de distintas fuentes. No se usa variable de cruce.">
      <TopicBlocksEditor
        topics={topics.length ? topics : [newTopic(1)]}
        variables={variables}
        multi={multi}
        onChange={(next) => onArgs({ modo: "var_cruce", vars: topicsToVars(next), titulos_grupo: topicsToTitles(next), cruces: null })}
      />
      <ScaleInline refs={topics.flatMap((t) => t.vars)} variables={variables} multi={multi} />
      <SettingsPanel args={args} onArgs={onArgs} />
    </BuilderSection>
  );
}

function MultiListBlocks({ args, onArgs, variables, multi, sourceCount }: BuilderSectionProps & { sourceCount: number }) {
  const blocks = asBlocks(args.bloques);
  const normalized = blocks.length ? blocks : [{ modo: "var", vars: [] }];

  function commit(next: MultiBlock[]) {
    onArgs({ modo: "multilista", bloques: next });
  }

  return (
    <BuilderSection title="Bloques verticales" hint="Cada bloque puede tener su propia escala. No se permite anidar otro Combinar bloques.">
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {normalized.map((block, index) => (
          <BlockEditor
            key={index}
            index={index}
            block={block}
            variables={variables}
            multi={multi}
            sourceCount={sourceCount}
            onChange={(patch) => {
              const next = normalized.map((b, i) => i === index ? { ...b, ...patch } : b);
              commit(next);
            }}
            onRemove={() => commit(normalized.filter((_, i) => i !== index))}
            onMove={(direction) => {
              const target = direction === "up" ? index - 1 : index + 1;
              if (target < 0 || target >= normalized.length) return;
              const next = [...normalized];
              [next[index], next[target]] = [next[target], next[index]];
              commit(next);
            }}
          />
        ))}
      </div>
      <button
        type="button"
        onClick={() => commit([...normalized, { modo: "var", vars: [] }])}
        style={secondaryButtonStyle}
      >
        <Plus size={12} /> Agregar bloque
      </button>
    </BuilderSection>
  );
}

function BlockEditor({
  index,
  block,
  variables,
  multi,
  sourceCount,
  onChange,
  onRemove,
  onMove,
}: {
  index: number;
  block: MultiBlock;
  variables: VarWithSource[];
  multi: boolean;
  sourceCount: number;
  onChange: (patch: MultiBlock) => void;
  onRemove: () => void;
  onMove: (direction: "up" | "down") => void;
}) {
  const blockIntent = detectBlockIntent(block);
  const vars = asStringArray(block.vars);
  const title = typeof block.titulo === "string" ? block.titulo : "";
  const subtitle = typeof block.subtitulo === "string" ? block.subtitulo : "";
  const height = block.altura_rel === null || block.altura_rel === undefined ? "" : String(block.altura_rel);

  function setBlockIntent(next: Intent) {
    if (next === "publicos_tema" && (!multi || sourceCount < 2)) return;
    if (next === "comparar") onChange({ modo: "var", vars: [], var: null, cruces: null, titulos_grupo: null });
    if (next === "pregunta_grupos") onChange({ modo: "cruce", vars: null, var: "", cruces: "", titulos_grupo: null });
    if (next === "preguntas_grupos") onChange({ modo: "var_cruce", vars: [], var: null, cruces: "", titulos_grupo: null });
    if (next === "publicos_tema") {
      const topics = topicsFromArgs(block.vars, block.titulos_grupo);
      onChange({
        modo: "var_cruce",
        vars: topicsToVars(topics.length ? topics : [newTopic(1)]),
        titulos_grupo: topicsToTitles(topics.length ? topics : [newTopic(1)]),
        cruces: null,
      });
    }
  }

  return (
    <div style={blockStyle}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <strong style={{ fontSize: 12 }}>Bloque {index + 1}</strong>
        <select
          value={blockIntent}
          onChange={(e) => setBlockIntent(e.target.value as Intent)}
          style={{ ...inputStyle, width: "auto", flex: 1 }}
        >
          <option value="comparar">Comparar preguntas</option>
          <option value="pregunta_grupos">Abrir una pregunta por grupos</option>
          <option value="preguntas_grupos">Abrir preguntas por grupos</option>
          <option value="publicos_tema" disabled={!multi || sourceCount < 2}>Comparar publicos por tema</option>
        </select>
        <button type="button" className="pulso-icon" onClick={() => onMove("up")} title="Subir bloque"><ArrowUp size={12} /></button>
        <button type="button" className="pulso-icon" onClick={() => onMove("down")} title="Bajar bloque"><ArrowDown size={12} /></button>
        <button type="button" className="pulso-icon pulso-icon-danger" onClick={onRemove} title="Eliminar bloque"><Trash2 size={12} /></button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 100px", gap: 8 }}>
        <FieldLabel label="Titulo del bloque" compact>
          <input value={title} onChange={(e) => onChange({ titulo: e.target.value })} style={inputStyle} />
        </FieldLabel>
        <FieldLabel label="Subtitulo" compact>
          <input value={subtitle} onChange={(e) => onChange({ subtitulo: e.target.value })} style={inputStyle} />
        </FieldLabel>
        <FieldLabel label="Altura" compact help="Opcional. Peso relativo del bloque dentro de la composicion.">
          <input
            type="number"
            min={0.1}
            step={0.1}
            value={height}
            onChange={(e) => onChange({ altura_rel: e.target.value === "" ? null : Number(e.target.value) })}
            style={inputStyle}
          />
        </FieldLabel>
      </div>

      {blockIntent === "comparar" && (
        <>
          <MultiVarPicker value={vars} onChange={(next) => onChange({ modo: "var", vars: next })} variables={variables} multi={multi} compact />
          <ScaleInline refs={vars} variables={variables} multi={multi} />
        </>
      )}
      {blockIntent === "pregunta_grupos" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <FieldLabel label="Pregunta" compact>
            <SingleVarSelect value={typeof block.var === "string" ? block.var : ""} onChange={(v) => onChange({ modo: "cruce", var: v })} variables={variables} multi={multi} />
          </FieldLabel>
          <FieldLabel label="Grupo" compact>
            <SingleVarSelect value={typeof block.cruces === "string" ? block.cruces : ""} onChange={(v) => onChange({ modo: "cruce", cruces: v })} variables={variables} multi={multi} />
          </FieldLabel>
        </div>
      )}
      {blockIntent === "preguntas_grupos" && (
        <>
          <MultiVarPicker value={vars} onChange={(next) => onChange({ modo: "var_cruce", vars: next })} variables={variables} multi={multi} compact />
          <FieldLabel label="Grupo" compact>
            <SingleVarSelect value={typeof block.cruces === "string" ? block.cruces : ""} onChange={(v) => onChange({ modo: "var_cruce", cruces: v })} variables={variables} multi={multi} />
          </FieldLabel>
          <TitlesEditor
            keys={vars}
            titles={titlesFromValue(block.titulos_grupo)}
            variables={variables}
            multi={multi}
            onChange={(next) => onChange({ titulos_grupo: next })}
          />
        </>
      )}
      {blockIntent === "publicos_tema" && (
        (!multi || sourceCount < 2) ? (
          <RequirementPanel title="Requiere varias bases" text="Este bloque compara fuentes. Primero activa y carga varias bases en Carga." />
        ) : (
          <TopicBlocksEditor
            topics={topicsFromArgs(block.vars, block.titulos_grupo)}
            variables={variables}
            multi={multi}
            onChange={(next) => onChange({ modo: "var_cruce", vars: topicsToVars(next), titulos_grupo: topicsToTitles(next), cruces: null })}
          />
        )
      )}
      <BlockSettings block={block} onChange={onChange} />
    </div>
  );
}

type BuilderSectionProps = {
  args: Record<string, unknown>;
  onArgs: (patch: Record<string, unknown>) => void;
  variables: VarWithSource[];
  multi: boolean;
};

function BuilderSection({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return (
    <section style={panelStyle}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <ListPlus size={14} color="var(--pulso-primary)" />
        <strong style={{ fontSize: 13 }}>{title}</strong>
      </div>
      <div style={{ fontSize: 11, color: "var(--pulso-text-soft)", lineHeight: 1.45, marginBottom: 10 }}>{hint}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>{children}</div>
    </section>
  );
}

function FieldLabel({ label, help, compact, children }: { label: string; help?: string; compact?: boolean; children: React.ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: compact ? 3 : 5 }}>
      <span style={{ fontSize: compact ? 10 : 11, fontWeight: 700, color: "var(--pulso-text)" }}>{label}</span>
      {help && <span style={{ fontSize: 10, color: "var(--pulso-text-soft)", lineHeight: 1.35 }}>{help}</span>}
      {children}
    </label>
  );
}

function MultiVarPicker({
  value,
  onChange,
  variables,
  multi,
  compact = false,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  variables: VarWithSource[];
  multi: boolean;
  compact?: boolean;
}) {
  const [query, setQuery] = useState("");
  const selected = new Set(value);
  const options = variables
    .map((v) => ({ ...v, ref: formatVarRef(v.source, v.name, multi) }))
    .filter((v) => !selected.has(v.ref))
    .filter((v) => {
      const q = query.trim().toLowerCase();
      if (!q) return true;
      return v.name.toLowerCase().includes(q) || v.label.toLowerCase().includes(q) || v.source.toLowerCase().includes(q);
    })
    .slice(0, 250);

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= value.length) return;
    const next = [...value];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 5, minHeight: compact ? 22 : 28 }}>
        {value.length === 0 && <span style={hintStyle}>Ninguna pregunta seleccionada.</span>}
        {value.map((ref, index) => {
          const info = findVar(ref, variables, multi);
          return (
            <span key={`${ref}-${index}`} style={chipStyle} title={info?.label ?? ref}>
              <span style={{ fontFamily: "ui-monospace, monospace" }}>{displayRef(ref, multi)}</span>
              <button type="button" className="pulso-icon" onClick={() => move(index, -1)} title="Subir"><ArrowUp size={10} /></button>
              <button type="button" className="pulso-icon" onClick={() => move(index, 1)} title="Bajar"><ArrowDown size={10} /></button>
              <button type="button" className="pulso-icon pulso-icon-danger" onClick={() => onChange(value.filter((_, i) => i !== index))} title="Quitar"><Trash2 size={10} /></button>
            </span>
          );
        })}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 140px", gap: 6 }}>
        <select
          value=""
          onChange={(e) => {
            const ref = e.target.value;
            if (ref) onChange([...value, ref]);
          }}
          style={inputStyle}
        >
          <option value="">Agregar pregunta...</option>
          {options.map((v) => (
            <option key={`${v.source}:${v.name}`} value={v.ref}>
              {multi ? `${v.source}$` : ""}{v.name} - {v.label.slice(0, 56)}{v.label.length > 56 ? "..." : ""}
            </option>
          ))}
        </select>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar"
          style={inputStyle}
        />
      </div>
    </div>
  );
}

function SingleVarSelect({
  value,
  onChange,
  variables,
  multi,
}: {
  value: string;
  onChange: (ref: string) => void;
  variables: VarWithSource[];
  multi: boolean;
}) {
  return (
    <select value={value ?? ""} onChange={(e) => onChange(e.target.value)} style={inputStyle}>
      <option value="">Selecciona variable...</option>
      {variables.map((v) => {
        const ref = formatVarRef(v.source, v.name, multi);
        return (
          <option key={`${v.source}:${v.name}`} value={ref}>
            {multi ? `${v.source}$` : ""}{v.name} - {v.label.slice(0, 64)}{v.label.length > 64 ? "..." : ""}
          </option>
        );
      })}
    </select>
  );
}

function TopicBlocksEditor({
  topics,
  variables,
  multi,
  onChange,
}: {
  topics: TopicBlock[];
  variables: VarWithSource[];
  multi: boolean;
  onChange: (next: TopicBlock[]) => void;
}) {
  const normalized = topics.length ? topics : [newTopic(1)];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {normalized.map((topic, index) => (
        <div key={topic.key || index} style={blockStyle}>
          <div style={{ display: "grid", gridTemplateColumns: "130px minmax(0, 1fr) 34px", gap: 8, alignItems: "end" }}>
            <FieldLabel label="Clave" compact help="Identificador del tema.">
              <input
                value={topic.key}
                onChange={(e) => {
                  const key = slugKey(e.target.value) || `tema_${index + 1}`;
                  onChange(normalized.map((t, i) => i === index ? { ...t, key } : t));
                }}
                style={inputStyle}
              />
            </FieldLabel>
            <FieldLabel label="Titulo visible" compact>
              <input
                value={topic.title}
                onChange={(e) => onChange(normalized.map((t, i) => i === index ? { ...t, title: e.target.value } : t))}
                style={inputStyle}
              />
            </FieldLabel>
            <button type="button" className="pulso-icon pulso-icon-danger" onClick={() => onChange(normalized.filter((_, i) => i !== index))} title="Eliminar tema">
              <Trash2 size={12} />
            </button>
          </div>
          <MultiVarPicker
            value={topic.vars}
            onChange={(vars) => onChange(normalized.map((t, i) => i === index ? { ...t, vars } : t))}
            variables={variables}
            multi={multi}
            compact
          />
          <ScaleInline refs={topic.vars} variables={variables} multi={multi} />
        </div>
      ))}
      <button type="button" style={secondaryButtonStyle} onClick={() => onChange([...normalized, newTopic(normalized.length + 1)])}>
        <Plus size={12} /> Agregar tema
      </button>
    </div>
  );
}

function TitlesEditor({
  keys,
  titles,
  variables,
  multi,
  onChange,
}: {
  keys: string[];
  titles: Record<string, string>;
  variables: VarWithSource[];
  multi: boolean;
  onChange: (next: Record<string, string>) => void;
}) {
  if (!keys.length) return null;
  return (
    <details style={{ border: "1px solid var(--pulso-border)", borderRadius: 7, padding: "7px 9px", background: "var(--pulso-surface)" }}>
      <summary style={{ cursor: "pointer", fontSize: 11, fontWeight: 700 }}>Titulos de bloque</summary>
      <div style={{ display: "flex", flexDirection: "column", gap: 7, marginTop: 8 }}>
        {keys.map((key) => {
          const info = findVar(key, variables, multi);
          return (
            <FieldLabel key={key} label={displayRef(key, multi)} compact help={info?.label}>
              <input
                value={titles[key] ?? ""}
                placeholder={info?.label ?? key}
                onChange={(e) => onChange({ ...titles, [key]: e.target.value })}
                style={inputStyle}
              />
            </FieldLabel>
          );
        })}
      </div>
    </details>
  );
}

function SettingsPanel({ args, onArgs }: { args: Record<string, unknown>; onArgs: (patch: Record<string, unknown>) => void }) {
  const labels = asStringArray(args.top2box_labels);
  return (
    <details style={detailsStyle}>
      <summary style={summaryStyle}>Ajustes del bloque</summary>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
        <label style={toggleStyle}>
          <input
            type="checkbox"
            checked={!!args.top2box}
            onChange={(e) => onArgs({ top2box: e.target.checked })}
          />
          Mostrar Top 2
        </label>
        <FieldLabel label="Ancho etiquetas" compact help="Caracteres por linea en las etiquetas de la izquierda.">
          <input
            type="number"
            min={10}
            value={args.wrap_y === undefined || args.wrap_y === null ? 50 : Number(args.wrap_y)}
            onChange={(e) => onArgs({ wrap_y: Number(e.target.value) })}
            style={inputStyle}
          />
        </FieldLabel>
        <div style={{ gridColumn: "1 / -1" }}>
          <FieldLabel label="Etiquetas Top 2" compact help="Opcional. Separalas con coma. Si queda vacio, se usan las dos ultimas categorias.">
            <input
              value={labels.join(", ")}
              onChange={(e) => onArgs({ top2box_labels: splitList(e.target.value) })}
              style={inputStyle}
              placeholder="Muy de acuerdo, De acuerdo"
            />
          </FieldLabel>
        </div>
      </div>
    </details>
  );
}

function BlockSettings({ block, onChange }: { block: MultiBlock; onChange: (patch: MultiBlock) => void }) {
  const labels = asStringArray(block.top2box_labels);
  return (
    <details style={detailsStyle}>
      <summary style={summaryStyle}>Ajustes de este bloque</summary>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 }}>
        <label style={toggleStyle}>
          <input
            type="checkbox"
            checked={!!block.top2box}
            onChange={(e) => onChange({ top2box: e.target.checked })}
          />
          Mostrar Top 2
        </label>
        <FieldLabel label="Etiquetas Top 2" compact>
          <input value={labels.join(", ")} onChange={(e) => onChange({ top2box_labels: splitList(e.target.value) })} style={inputStyle} />
        </FieldLabel>
      </div>
    </details>
  );
}

function ScaleInline({ refs, variables, multi }: { refs: string[]; variables: VarWithSource[]; multi: boolean }) {
  const scale = scaleSummary(refs, variables, multi);
  if (!refs.length) return null;
  return (
    <div style={{ ...inlineStatusStyle, borderColor: toneColor(scale.tone), color: toneColor(scale.tone) }}>
      {scale.tone === "ok" ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />}
      <span>{scale.message}</span>
    </div>
  );
}

function SummaryPanel({ summary, scale, multi }: { summary: string[]; scale: ScaleResult; multi: boolean }) {
  return (
    <section style={{ ...panelStyle, padding: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7 }}>
        <CheckCircle2 size={14} color={toneColor(scale.tone)} />
        <strong style={{ fontSize: 12 }}>Sintesis</strong>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {summary.map((item) => <span key={item} style={summaryChipStyle}>{item}</span>)}
        <span style={summaryChipStyle}>{multi ? "Estudio multibase" : "Una base activa"}</span>
      </div>
    </section>
  );
}

function IssuesPanel({ issues }: { issues: ValidationIssue[] }) {
  if (!issues.length) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      {issues.map((issue, i) => (
        <div key={`${issue.message}-${i}`} style={{ ...inlineStatusStyle, borderColor: toneColor(issue.kind), color: toneColor(issue.kind) }}>
          <AlertCircle size={13} />
          <span>{issue.message}</span>
        </div>
      ))}
    </div>
  );
}

function RequirementPanel({ title, text }: { title: string; text: string }) {
  return (
    <div style={{ ...panelStyle, borderColor: "var(--pulso-warning-border)", background: "#fff9eb" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, fontSize: 13 }}>
        <AlertCircle size={14} /> {title}
      </div>
      <div style={{ fontSize: 12, color: "var(--pulso-text-soft)", lineHeight: 1.45, marginTop: 6 }}>{text}</div>
    </div>
  );
}

type ValidationIssue = { kind: "error" | "warning"; message: string };
type Tone = "idle" | "ok" | "warning" | "error";
type ScaleResult = { tone: Tone; label: string; message: string };

function detectIntent(args: Record<string, unknown>): Intent {
  if (args.modo === "multilista") return "combinar";
  if (args.modo === "cruce") return "pregunta_grupos";
  if (args.modo === "var_cruce") {
    return isNamedVars(args.vars) ? "publicos_tema" : "preguntas_grupos";
  }
  return "comparar";
}

function detectBlockIntent(block: MultiBlock): Intent {
  if (block.modo === "cruce") return "pregunta_grupos";
  if (block.modo === "var_cruce") return isNamedVars(block.vars) ? "publicos_tema" : "preguntas_grupos";
  return "comparar";
}

function validateArgs(args: Record<string, unknown>, variables: VarWithSource[], multi: boolean): ValidationIssue[] {
  const intent = detectIntent(args);
  const issues: ValidationIssue[] = [];
  const refs = refsForIntent(args);
  const scale = scaleSummary(refs, variables, multi);
  if (scale.tone === "error") issues.push({ kind: "error", message: scale.message });
  if (scale.tone === "warning") issues.push({ kind: "warning", message: scale.message });

  if (intent === "comparar" && asStringArray(args.vars).length === 0) {
    issues.push({ kind: "error", message: "Selecciona al menos una pregunta." });
  }
  if (intent === "pregunta_grupos") {
    if (!args.var) issues.push({ kind: "error", message: "Selecciona la pregunta principal." });
    if (!args.cruces) issues.push({ kind: "error", message: "Selecciona la variable de grupo." });
  }
  if (intent === "preguntas_grupos") {
    if (asStringArray(args.vars).length === 0) issues.push({ kind: "error", message: "Selecciona las preguntas a abrir." });
    if (!args.cruces) issues.push({ kind: "error", message: "Selecciona el grupo comun." });
  }
  if (intent === "publicos_tema") {
    if (!multi) issues.push({ kind: "error", message: "Comparar publicos por tema requiere un estudio multibase." });
    const topics = topicsFromArgs(args.vars, args.titulos_grupo);
    if (!topics.length) issues.push({ kind: "error", message: "Agrega al menos un tema." });
    topics.forEach((t) => {
      if (!t.vars.length) issues.push({ kind: "error", message: `El tema "${t.title || t.key}" no tiene variables.` });
    });
    if (args.cruces) issues.push({ kind: "warning", message: "En comparacion de publicos no se usa cruce; cada fila ya es una fuente." });
  }
  if (intent === "combinar") {
    const blocks = asBlocks(args.bloques);
    if (!blocks.length) issues.push({ kind: "error", message: "Agrega al menos un bloque." });
    blocks.forEach((block, i) => {
      if (block.modo === "multilista") issues.push({ kind: "error", message: `El bloque ${i + 1} no puede ser otro Combinar bloques.` });
      if (detectBlockIntent(block) === "publicos_tema" && !multi) {
        issues.push({ kind: "error", message: `El bloque ${i + 1} compara fuentes y requiere varias bases.` });
      }
    });
  }
  return issues;
}

function refsForIntent(args: Record<string, unknown>): string[] {
  const intent = detectIntent(args);
  if (intent === "comparar" || intent === "preguntas_grupos") return asStringArray(args.vars);
  if (intent === "pregunta_grupos") return typeof args.var === "string" && args.var ? [args.var] : [];
  if (intent === "publicos_tema") return topicsFromArgs(args.vars, args.titulos_grupo).flatMap((t) => t.vars);
  if (intent === "combinar") {
    return asBlocks(args.bloques).flatMap((block) => {
      const bIntent = detectBlockIntent(block);
      if (bIntent === "pregunta_grupos") return typeof block.var === "string" && block.var ? [block.var] : [];
      if (bIntent === "publicos_tema") return topicsFromArgs(block.vars, block.titulos_grupo).flatMap((t) => t.vars);
      return asStringArray(block.vars);
    });
  }
  return [];
}

function buildSummary(intent: Intent, args: Record<string, unknown>, refs: string[], variables: VarWithSource[], multi: boolean): string[] {
  const intentLabel = INTENTS.find((i) => i.key === intent)?.title ?? "Multi-apiladas";
  const sources = new Set(refs.map((r) => findVar(r, variables, multi)?.source).filter(Boolean));
  const rows = estimateRows(intent, args, variables, multi);
  const scale = scaleSummary(refs, variables, multi);
  return [
    intentLabel,
    rows ? `${rows} fila${rows === 1 ? "" : "s"} estimada${rows === 1 ? "" : "s"}` : "Filas por armar",
    scale.label,
    sources.size ? `${sources.size} fuente${sources.size === 1 ? "" : "s"}` : "Fuentes por detectar",
    args.top2box ? "Top 2 activo" : "Top 2 opcional",
  ];
}

function estimateRows(intent: Intent, args: Record<string, unknown>, variables: VarWithSource[], multi: boolean): number {
  if (intent === "comparar") return asStringArray(args.vars).length;
  if (intent === "pregunta_grupos") return choicesCount(args.cruces, variables, multi) || 1;
  if (intent === "preguntas_grupos") return Math.max(1, asStringArray(args.vars).length) * Math.max(1, choicesCount(args.cruces, variables, multi));
  if (intent === "publicos_tema") return topicsFromArgs(args.vars, args.titulos_grupo).reduce((acc, t) => acc + t.vars.length, 0);
  if (intent === "combinar") return asBlocks(args.bloques).length;
  return 0;
}

function choicesCount(ref: unknown, variables: VarWithSource[], multi: boolean): number {
  if (typeof ref !== "string") return 0;
  return findVar(ref, variables, multi)?.choices?.length ?? 0;
}

function scaleSummary(refs: string[], variables: VarWithSource[], multi: boolean): ScaleResult {
  if (!refs.length) return { tone: "idle", label: "Escala por detectar", message: "Cuando elijas preguntas, se revisara si comparten escala." };
  const found = refs.map((ref) => findVar(ref, variables, multi));
  if (found.some((v) => !v)) return { tone: "warning", label: "Variables por revisar", message: "Hay variables que no aparecen en el instrumento cargado." };
  const keys = found.map((v) => scaleKey(v)).filter(Boolean);
  if (!keys.length) return { tone: "warning", label: "Escala no detectada", message: "No se detecto escala en estas preguntas. El preview confirmara si esta combinacion se puede graficar." };
  const unique = Array.from(new Set(keys));
  if (unique.length > 1) return { tone: "error", label: "Escalas distintas", message: "Estas preguntas no comparten una escala compatible. Usa Combinar bloques si necesitas mezclar escalas." };
  const first = found.find(Boolean);
  const choiceN = first?.choices?.length ?? 0;
  const listName = first?.list_name || "escala compatible";
  return { tone: "ok", label: choiceN ? `${listName} (${choiceN})` : listName, message: choiceN ? `Estas preguntas comparten escala: ${listName}, ${choiceN} categorias.` : `Estas preguntas comparten escala: ${listName}.` };
}

function scaleKey(v: VarWithSource | undefined): string {
  if (!v) return "";
  return v.scale_signature || v.list_name || "";
}

function findVar(ref: string, variables: VarWithSource[], multi: boolean): VarWithSource | undefined {
  const parsed = parseVarRef(ref);
  if (multi) {
    if (parsed.source) return variables.find((v) => v.source === parsed.source && v.name === parsed.name);
    return variables.find((v) => v.name === parsed.name);
  }
  return variables.find((v) => v.name === parsed.name || `${v.source}$${v.name}` === ref);
}

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === "string" && v.trim().length > 0);
  if (typeof value === "string" && value.trim()) return [value.trim()];
  return [];
}

function asBlocks(value: unknown): MultiBlock[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is MultiBlock => !!v && typeof v === "object" && !Array.isArray(v));
}

function isNamedVars(value: unknown): value is Record<string, string[]> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function topicsFromArgs(varsValue: unknown, titlesValue: unknown): TopicBlock[] {
  if (!isNamedVars(varsValue)) return [];
  const titles = titlesFromValue(titlesValue);
  return Object.entries(varsValue).map(([key, refs], i) => ({
    key,
    title: titles[key] || key || `Tema ${i + 1}`,
    vars: asStringArray(refs),
  }));
}

function titlesFromValue(value: unknown): Record<string, string> {
  if (!value) return {};
  if (typeof value === "string") {
    return Object.fromEntries(value.split("\n").map((line) => {
      const idx = line.indexOf("=");
      if (idx < 0) return ["", ""];
      return [line.slice(0, idx).trim(), line.slice(idx + 1).trim()];
    }).filter(([k]) => k));
  }
  if (typeof value === "object" && !Array.isArray(value)) {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(value)) out[k] = String(v ?? "");
    return out;
  }
  return {};
}

function topicsToVars(topics: TopicBlock[]): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  topics.forEach((topic, i) => {
    const key = slugKey(topic.key) || `tema_${i + 1}`;
    out[key] = topic.vars;
  });
  return out;
}

function topicsToTitles(topics: TopicBlock[]): Record<string, string> {
  const out: Record<string, string> = {};
  topics.forEach((topic, i) => {
    const key = slugKey(topic.key) || `tema_${i + 1}`;
    out[key] = topic.title || key;
  });
  return out;
}

function newTopic(n: number): TopicBlock {
  return { key: `tema_${n}`, title: `Tema ${n}`, vars: [] };
}

function splitList(text: string): string[] {
  return text.split(",").map((x) => x.trim()).filter(Boolean);
}

function slugKey(text: string): string {
  return text.trim().toLowerCase().replace(/[^a-z0-9_]+/g, "_").replace(/^_+|_+$/g, "");
}

function displayRef(ref: string, multi: boolean): string {
  if (multi) return ref;
  return parseVarRef(ref).name;
}

function toneColor(tone: Tone | ValidationIssue["kind"]) {
  if (tone === "idle") return "var(--pulso-text-soft)";
  if (tone === "ok") return "var(--pulso-success-fg, #157347)";
  if (tone === "error") return "var(--pulso-danger-fg, #b42318)";
  return "var(--pulso-warning-fg, #96620f)";
}

const panelStyle: React.CSSProperties = {
  border: "1px solid var(--pulso-border)",
  borderRadius: 8,
  background: "white",
  padding: 12,
};

const blockStyle: React.CSSProperties = {
  border: "1px solid var(--pulso-border)",
  borderRadius: 8,
  background: "var(--pulso-surface)",
  padding: 10,
  display: "flex",
  flexDirection: "column",
  gap: 9,
};

const intentButtonStyle: React.CSSProperties = {
  border: "1px solid var(--pulso-border)",
  borderRadius: 8,
  padding: 10,
  display: "flex",
  flexDirection: "column",
  gap: 5,
  textAlign: "left",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  border: "1px solid var(--pulso-border)",
  borderRadius: 5,
  padding: "6px 8px",
  fontSize: 12,
  background: "white",
  color: "var(--pulso-text)",
};

const secondaryButtonStyle: React.CSSProperties = {
  alignSelf: "flex-start",
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  border: "1px solid var(--pulso-border)",
  borderRadius: 6,
  background: "white",
  padding: "7px 10px",
  fontSize: 12,
  cursor: "pointer",
};

const chipStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  border: "1px solid var(--pulso-primary-border)",
  background: "var(--pulso-primary-soft)",
  color: "var(--pulso-primary)",
  borderRadius: 6,
  padding: "3px 5px",
  fontSize: 11,
};

const hintStyle: React.CSSProperties = {
  fontSize: 11,
  color: "var(--pulso-text-soft)",
  fontStyle: "italic",
};

const eyebrowStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 800,
  textTransform: "uppercase",
  letterSpacing: 0.5,
  color: "var(--pulso-primary)",
  marginBottom: 4,
};

const inlineStatusStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 7,
  border: "1px solid",
  borderRadius: 7,
  padding: "7px 9px",
  fontSize: 11,
  background: "white",
};

const detailsStyle: React.CSSProperties = {
  border: "1px solid var(--pulso-border)",
  borderRadius: 7,
  padding: "7px 9px",
  background: "var(--pulso-surface)",
};

const summaryStyle: React.CSSProperties = {
  cursor: "pointer",
  fontSize: 11,
  fontWeight: 700,
};

const toggleStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 7,
  fontSize: 12,
  fontWeight: 600,
};

const summaryChipStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  border: "1px solid var(--pulso-border)",
  background: "var(--pulso-surface)",
  borderRadius: 999,
  padding: "3px 8px",
  fontSize: 11,
  color: "var(--pulso-text)",
};

function StatusPill({ tone, children, onClick }: { tone: Tone; children: React.ReactNode; onClick?: () => void }) {
  const style: React.CSSProperties = {
    border: `1px solid ${toneColor(tone)}`,
    color: toneColor(tone),
    borderRadius: 999,
    padding: "3px 8px",
    fontSize: 10,
    fontWeight: 800,
    whiteSpace: "nowrap",
    background: "white",
  };
  if (onClick) {
    return (
      <button type="button" onClick={onClick} style={{ ...style, cursor: "pointer" }}>
        {children}
      </button>
    );
  }
  return (
    <span style={style}>
      {children}
    </span>
  );
}
