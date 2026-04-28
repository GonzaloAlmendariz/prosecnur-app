import {
  closestCenter,
  DndContext,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowDown, ArrowUp, GripVertical, HelpCircle, RotateCcw } from "lucide-react";
import { DimensionesChoice, VariableInstrumento } from "../../../../api/client";
import { useDimensionesWizardStore } from "../store";

// Editor expandible de mapping para una lista evaluativa.
//
// Lo que muestra y deja editar:
//   • Lista de códigos en orden ascendente (drag-reorder con @dnd-kit).
//     El primer código en la lista vale 0; el último vale 100; los
//     intermedios se interpolan linealmente.
//   • Cada código tiene chips para marcarlo como Normal / Missing / N/A.
//     Los Missing/N/A NO cuentan en la escala 0-100 (saltan el cómputo).
//   • Botón "Invertir" para flippear el orden de un click.
//   • Botón "Restaurar" para volver al orden default sugerido por
//     instrumento (numérico ascendente cuando aplica).
//
// El "valor 0-100" se calcula y muestra en vivo al lado de cada código
// para que el analista entienda inmediatamente la consecuencia del
// orden que está fijando.

type Props = {
  lista: string;
  choicesDetectadas: DimensionesChoice[];
  // Vars del instrumento que usan ESTA lista (vienen de
  // /dimensiones/detect en e.vars). Las exponemos al usuario para que
  // vea exactamente qué preguntas se recodificarán al activar la lista.
  vars: string[];
  // Catálogo completo del instrumento para resolver labels humanos por
  // var. Si no hay match, mostramos solo el code.
  variablesInstrumento: VariableInstrumento[];
};

type CodeMode = "normal" | "missing" | "noaplica";

export function ListaMappingEditor({ lista, choicesDetectadas, vars, variablesInstrumento }: Props) {
  const draft = useDimensionesWizardStore((s) => s.draft);
  const setOrdenLista = useDimensionesWizardStore((s) => s.setOrdenLista);
  const setCodigosNoAplica = useDimensionesWizardStore((s) => s.setCodigosNoAplica);
  const setCodigosMissingGlobal = useDimensionesWizardStore((s) => s.setCodigosMissingGlobal);

  // Orden actual: si el draft tiene `orden_por_lista[lista]` lo usamos;
  // si no, defaulteamos al orden sugerido por el backend (que viene en
  // choicesDetectadas ya pre-ordenado).
  const ordenGuardado = draft.orden_por_lista[lista];
  const codesActuales =
    ordenGuardado && ordenGuardado.length > 0
      ? ordenGuardado
      : choicesDetectadas.map((c) => c.code);

  const labelMap: Record<string, string> = {};
  choicesDetectadas.forEach((c) => {
    labelMap[c.code] = c.label;
  });

  const missingGlobal = new Set(draft.codigos_missing);
  const naLista = new Set(draft.codigos_no_aplica[lista] ?? []);

  function modoDe(code: string): CodeMode {
    if (naLista.has(code)) return "noaplica";
    if (missingGlobal.has(code)) return "missing";
    return "normal";
  }

  // Códigos que aportan al cómputo 0-100 (excluye missing y N/A).
  const codigosNormales = codesActuales.filter((c) => modoDe(c) === "normal");
  const valorPara = (code: string): string => {
    if (modoDe(code) !== "normal") return "—";
    const idx = codigosNormales.indexOf(code);
    if (idx < 0 || codigosNormales.length === 0) return "—";
    if (codigosNormales.length === 1) return "100";
    const v = (idx / (codigosNormales.length - 1)) * 100;
    return v.toFixed(0);
  };

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = codesActuales.indexOf(String(active.id));
    const newIdx = codesActuales.indexOf(String(over.id));
    if (oldIdx < 0 || newIdx < 0) return;
    setOrdenLista(lista, arrayMove(codesActuales, oldIdx, newIdx));
  }

  function invertirOrden() {
    setOrdenLista(lista, [...codesActuales].reverse());
  }

  function restaurarDefault() {
    setOrdenLista(lista, choicesDetectadas.map((c) => c.code));
  }

  function setModo(code: string, modo: CodeMode) {
    // Missing es global en el draft (s$codigos_missing). N/A es per-lista.
    const wasMissing = missingGlobal.has(code);
    const wasNa = naLista.has(code);

    if (modo === "missing" && !wasMissing) {
      setCodigosMissingGlobal([...draft.codigos_missing, code]);
    } else if (modo !== "missing" && wasMissing) {
      setCodigosMissingGlobal(draft.codigos_missing.filter((c) => c !== code));
    }
    if (modo === "noaplica" && !wasNa) {
      setCodigosNoAplica(lista, [...(draft.codigos_no_aplica[lista] ?? []), code]);
    } else if (modo !== "noaplica" && wasNa) {
      setCodigosNoAplica(
        lista,
        (draft.codigos_no_aplica[lista] ?? []).filter((c) => c !== code),
      );
    }
  }

  // Mapa nombre → meta de las variables que usan esta lista (para
  // mostrar labels humanos en el bloque "Preguntas que usan esta lista").
  const varsConLabels = vars.map((v) => {
    const meta = variablesInstrumento.find((x) => x.name === v);
    return { name: v, label: meta?.label ?? "" };
  });

  return (
    <div
      style={{
        marginTop: 10,
        padding: "12px 14px",
        borderRadius: 8,
        background: "var(--pulso-surface-2, #f4f5f9)",
        border: "1px solid var(--pulso-border)",
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Listado de preguntas que usan esta lista — para que el usuario
          tome decisión consciente sobre la lista al ver exactamente
          qué se recodificará. */}
      {varsConLabels.length > 0 && (
        <div
          style={{
            marginBottom: 12,
            padding: "10px 12px",
            borderRadius: 6,
            background: "white",
            border: "1px solid var(--pulso-border)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              marginBottom: 6,
            }}
          >
            <HelpCircle size={11} color="var(--pulso-text-soft)" />
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: 0.4,
                color: "var(--pulso-text-soft)",
              }}
            >
              Preguntas que usan esta lista ({varsConLabels.length})
            </span>
          </div>
          <ul
            style={{
              margin: 0,
              padding: 0,
              listStyle: "none",
              display: "flex",
              flexDirection: "column",
              gap: 4,
            }}
          >
            {varsConLabels.map((v) => (
              <li
                key={v.name}
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  gap: 8,
                  fontSize: 12,
                  color: "var(--pulso-text)",
                  lineHeight: 1.4,
                }}
              >
                <code
                  style={{
                    fontFamily: "ui-monospace, monospace",
                    fontSize: 10,
                    color: "var(--pulso-text-soft)",
                    background: "var(--pulso-surface-2, #f4f5f9)",
                    padding: "1px 5px",
                    borderRadius: 3,
                    flexShrink: 0,
                  }}
                >
                  {v.name}
                </code>
                <span
                  style={{
                    flex: 1,
                    minWidth: 0,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                  title={v.label || v.name}
                >
                  {v.label || <em style={{ color: "var(--pulso-text-soft)" }}>(sin etiqueta)</em>}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 10,
          flexWrap: "wrap",
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: 0.4,
            color: "var(--pulso-text-soft)",
            flex: 1,
          }}
        >
          Mapeo de códigos → 0-100
        </span>
        <button
          type="button"
          onClick={invertirOrden}
          title="Invertir el orden — útil cuando el código menor es el 'mejor'"
          style={btnSecundarioStyle}
        >
          <ArrowDown size={11} />
          <ArrowUp size={11} style={{ marginLeft: -4 }} /> Invertir
        </button>
        <button
          type="button"
          onClick={restaurarDefault}
          title="Volver al orden sugerido por el instrumento"
          style={btnSecundarioStyle}
        >
          <RotateCcw size={11} /> Restaurar
        </button>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          marginBottom: 8,
          fontSize: 11,
          color: "var(--pulso-text-soft)",
        }}
      >
        <span>↓ Menor (0)</span>
        <span style={{ flex: 1, height: 1, background: "var(--pulso-border)" }} />
        <span>↑ Mayor (100)</span>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={codesActuales} strategy={verticalListSortingStrategy}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {codesActuales.map((code) => (
              <SortableCodeRow
                key={code}
                code={code}
                label={labelMap[code] ?? ""}
                modo={modoDe(code)}
                valor={valorPara(code)}
                onModo={(m) => setModo(code, m)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <p
        style={{
          margin: "10px 0 0",
          fontSize: 10,
          color: "var(--pulso-text-soft)",
          lineHeight: 1.5,
        }}
      >
        Arrastra para reordenar. El código de arriba se recodifica como{" "}
        <strong>0</strong>, el de abajo como <strong>100</strong>, los intermedios
        se interpolan linealmente. Marca códigos como <em>Missing</em> (no respondió)
        o <em>N/A</em> (no aplica) para que NO entren al cómputo.
      </p>
    </div>
  );
}

function SortableCodeRow({
  code,
  label,
  modo,
  valor,
  onModo,
}: {
  code: string;
  label: string;
  modo: CodeMode;
  valor: string;
  onModo: (m: CodeMode) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: code });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.55 : 1,
    boxShadow: isDragging ? "var(--pulso-shadow-med)" : "none",
  };

  const bg =
    modo === "missing"
      ? "var(--pulso-warn-bg, #fffbeb)"
      : modo === "noaplica"
        ? "var(--pulso-surface)"
        : "white";
  const border =
    modo === "missing"
      ? "var(--pulso-warn-border, #fcd34d)"
      : modo === "noaplica"
        ? "var(--pulso-border)"
        : "var(--pulso-border)";

  return (
    <div
      ref={setNodeRef}
      style={{
        display: "grid",
        gridTemplateColumns: "auto auto 1fr auto auto",
        gap: 10,
        alignItems: "center",
        padding: "6px 10px",
        borderRadius: 6,
        background: bg,
        border: `1px solid ${border}`,
        ...style,
      }}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label={`Reordenar código ${code}`}
        style={{
          background: "transparent",
          border: "none",
          cursor: "grab",
          color: "var(--pulso-text-soft)",
          padding: 0,
          display: "inline-flex",
          alignItems: "center",
        }}
      >
        <GripVertical size={13} />
      </button>
      <code
        style={{
          fontFamily: "ui-monospace, monospace",
          fontWeight: 700,
          fontSize: 11,
          padding: "2px 6px",
          borderRadius: 4,
          background: "var(--pulso-surface-2, #f4f5f9)",
          color: "var(--pulso-text)",
          minWidth: 24,
          textAlign: "center",
        }}
      >
        {code}
      </code>
      <span
        style={{
          fontSize: 12,
          color: modo === "normal" ? "var(--pulso-text)" : "var(--pulso-text-soft)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {label || <em style={{ color: "var(--pulso-text-soft)" }}>(sin etiqueta)</em>}
      </span>
      <div style={{ display: "inline-flex", gap: 2 }}>
        <ModeChip active={modo === "normal"} onClick={() => onModo("normal")}>
          Normal
        </ModeChip>
        <ModeChip active={modo === "missing"} onClick={() => onModo("missing")} tone="warn">
          Missing
        </ModeChip>
        <ModeChip active={modo === "noaplica"} onClick={() => onModo("noaplica")} tone="muted">
          N/A
        </ModeChip>
      </div>
      <span
        style={{
          fontSize: 12,
          fontWeight: 700,
          fontVariantNumeric: "tabular-nums",
          color: modo === "normal" ? "var(--pulso-primary)" : "var(--pulso-text-soft)",
          minWidth: 32,
          textAlign: "right",
        }}
        aria-label={`Vale ${valor} en escala 0-100`}
      >
        {valor}
      </span>
    </div>
  );
}

function ModeChip({
  active,
  tone = "primary",
  onClick,
  children,
}: {
  active: boolean;
  tone?: "primary" | "warn" | "muted";
  onClick: () => void;
  children: React.ReactNode;
}) {
  const palette = {
    primary: { bg: "var(--pulso-primary)", fg: "white", border: "var(--pulso-primary)" },
    warn: { bg: "var(--pulso-warn-fg, #b45309)", fg: "white", border: "var(--pulso-warn-fg, #b45309)" },
    muted: { bg: "var(--pulso-text-soft)", fg: "white", border: "var(--pulso-text-soft)" },
  } as const;
  const c = palette[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "3px 8px",
        fontSize: 10,
        fontWeight: 600,
        borderRadius: 999,
        border: `1px solid ${active ? c.border : "var(--pulso-border)"}`,
        background: active ? c.bg : "transparent",
        color: active ? c.fg : "var(--pulso-text-soft)",
        cursor: "pointer",
        transition: "background var(--anim-dur-short), color var(--anim-dur-short)",
      }}
    >
      {children}
    </button>
  );
}

const btnSecundarioStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  padding: "3px 8px",
  fontSize: 10,
  fontWeight: 600,
  border: "1px solid var(--pulso-border)",
  borderRadius: 6,
  background: "white",
  cursor: "pointer",
  color: "var(--pulso-text)",
};
