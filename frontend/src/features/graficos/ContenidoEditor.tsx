import { usePlanStore } from "./store";

// Opciones que deciden QUÉ láminas entra al entregable, no cómo se ven.
// Viven aparte de paletas/presets/estilos a propósito: aquéllas cambian la
// apariencia de lo que ya existe, éstas cambian la cantidad de diapositivas.
//
// El interruptor de «Otros» era hasta ahora una bandera sólo alcanzable
// editando el JSON de configuración a mano (`config.auto_otros_slides`).
// En ACRD Ingeniería eso costó una entrega: los informes tenían las láminas,
// el plan guardado en el proyecto no, y al regenerar desaparecían sin aviso
// — se descubrió comparando 31 diapositivas contra 39.

export function ContenidoEditor() {
  const autoOtrosSlides = usePlanStore((s) => s.autoOtrosSlides);
  const setAutoOtrosSlides = usePlanStore((s) => s.setAutoOtrosSlides);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <OpcionSwitch
        label="Incluir láminas de respuestas en Otros"
        descripcion={
          "Agrega una lámina después de cada gráfico cuya pregunta tenga campo " +
          "abierto, con el listado literal de las respuestas que quedaron sin codificar."
        }
        value={autoOtrosSlides}
        onChange={setAutoOtrosSlides}
      />
    </div>
  );
}

function OpcionSwitch({
  label, descripcion, value, onChange,
}: {
  label: string;
  descripcion: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div
      style={{
        display: "flex", alignItems: "flex-start", gap: 12,
        padding: "10px 12px",
        border: "1px solid var(--pulso-border)",
        borderRadius: 8,
        background: "var(--pulso-surface-2)",
      }}
    >
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 3 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--pulso-text)" }}>
          {label}
        </span>
        <span style={{ fontSize: 11, color: "var(--pulso-text-soft)", lineHeight: 1.45 }}>
          {descripcion}
        </span>
      </div>
      <BoolSwitch value={value} onChange={onChange} label={label} />
    </div>
  );
}

// Mismo switch que usa `ArgField` para los args booleanos de los presets:
// que la única opción de esta pestaña se vea igual que las del inspector es
// lo que la hace legible sin explicarla.
function BoolSwitch({
  value, onChange, label,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      className={`pulso-gv2-switch ${value ? "is-on" : ""}`}
      onClick={() => onChange(!value)}
      role="switch"
      aria-checked={value}
      aria-label={label}
      style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        padding: "5px 10px", borderRadius: 999,
        border: `1px solid ${value ? "var(--pulso-primary)" : "var(--pulso-border)"}`,
        background: value ? "var(--pulso-primary-soft)" : "white",
        color: value ? "var(--pulso-primary)" : "var(--pulso-text-soft)",
        fontSize: 11, fontWeight: 600, cursor: "pointer",
        flexShrink: 0,
        transition: "background 120ms ease, border-color 120ms ease",
      }}
    >
      <span
        className="pulso-gv2-switch-track"
        style={{
          width: 24, height: 12, borderRadius: 999,
          background: value ? "var(--pulso-primary)" : "var(--pulso-border)",
          position: "relative",
          transition: "background 120ms ease",
        }}
      >
        <span
          className="pulso-gv2-switch-thumb"
          style={{
            position: "absolute",
            top: 1, left: value ? 13 : 1,
            width: 10, height: 10, borderRadius: "50%",
            background: "white",
            transition: "left 120ms ease",
          }}
        />
      </span>
      {value ? "Sí" : "No"}
    </button>
  );
}
