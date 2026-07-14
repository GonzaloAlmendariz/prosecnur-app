import { useId, useState } from "react";
import { ChevronDown, Layers3 } from "../../../vendor/lucide-react";
import type { ExplorerRepeatContext } from "../../../lib/rosterExplorer";

type Props = {
  context: ExplorerRepeatContext;
  selectedCode: string | null;
  onChange: (code: string | null) => void;
};

function countLabel(value: number): string {
  return value.toLocaleString("es-PE");
}

export default function RepeatDimensionBar({ context, selectedCode, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const optionsId = useId();
  const options = [
    { code: null, label: "Todos", n_instancias: context.n_instancias },
    ...context.options,
  ];
  const selectedOption = options.find((option) => option.code === selectedCode) ?? options[0];

  function handleKeyDown(event: React.KeyboardEvent<HTMLButtonElement>, index: number) {
    let nextIndex: number | null = null;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      nextIndex = (index + 1) % options.length;
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      nextIndex = (index - 1 + options.length) % options.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = options.length - 1;
    }
    if (nextIndex == null) return;
    event.preventDefault();
    const next = options[nextIndex];
    onChange(next.code);
    const buttons = event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>("button[role='radio']");
    buttons?.[nextIndex]?.focus();
  }

  return (
    <section className={`pulso-repeat-dimension${open ? " is-open" : ""}`} aria-label="Respuestas por servicio">
      <button
        type="button"
        className="pulso-repeat-dimension-trigger"
        aria-label="Elegir servicio analizado"
        aria-expanded={open}
        aria-controls={optionsId}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="pulso-repeat-dimension-icon" aria-hidden="true"><Layers3 size={14} /></span>
        <span className="pulso-repeat-dimension-trigger-label">Servicio analizado</span>
        <strong className="pulso-repeat-dimension-trigger-value" title={selectedOption.label}>
          {selectedOption.label}
        </strong>
        <span className="pulso-repeat-dimension-trigger-count">
          {countLabel(selectedOption.n_instancias)} instancias
        </span>
        <span className="pulso-repeat-dimension-trigger-action">{open ? "Ocultar" : "Ver servicios"}</span>
        <ChevronDown className="pulso-repeat-dimension-chevron" size={15} aria-hidden="true" />
      </button>

      <div id={optionsId} className="pulso-repeat-dimension-panel" hidden={!open}>
        <div className="pulso-repeat-dimension-panel-copy">
          <strong>Respuestas por servicio</strong>
          <span>Selecciona una opción para filtrar el sidebar y los gráficos.</span>
        </div>
        <div className="pulso-repeat-dimension-options" role="radiogroup" aria-label="Filtrar por servicio">
          {options.map((option, index) => {
            const active = option.code === selectedCode;
            return (
              <button
                key={option.code ?? "__all__"}
                type="button"
                role="radio"
                aria-checked={active}
                className={`pulso-repeat-dimension-option${active ? " is-active" : ""}`}
                onClick={() => {
                  onChange(option.code);
                  setOpen(false);
                }}
                onKeyDown={(event) => handleKeyDown(event, index)}
                tabIndex={active ? 0 : -1}
                title={`${option.label}: ${countLabel(option.n_instancias)} fila${option.n_instancias === 1 ? "" : "s"} repetida${option.n_instancias === 1 ? "" : "s"}`}
              >
                <span>{option.label}</span>
                <strong>{countLabel(option.n_instancias)}</strong>
              </button>
            );
          })}
        </div>
        {context.unclassified_instances > 0 && (
          <p className="pulso-repeat-dimension-unclassified">
            {countLabel(context.unclassified_instances)} sin servicio identificado
          </p>
        )}
      </div>
    </section>
  );
}
