import { GraficadorRef } from "../../api/client";
import VariablePicker from "./VariablePicker";

function Row({ label, children, help }: { label: string; children: React.ReactNode; help?: string }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 3, marginBottom: "0.5rem", fontSize: 12 }}>
      <span style={{ fontWeight: 500 }}>{label}</span>
      {children}
      {help && <span style={{ color: "#888", fontSize: 10 }}>{help}</span>}
    </label>
  );
}

function TxtIn({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return <input value={value ?? ""} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
    style={{ padding: "3px 6px", fontSize: 12, border: "1px solid #d1d5db", borderRadius: 4 }} />;
}

type Props = {
  graf: GraficadorRef;
  onArgs: (patch: Record<string, unknown>) => void;
};

function FormBarras({ graf, onArgs }: Props) {
  const a = graf.args;
  return (
    <>
      <Row label="var" help="Variable principal a graficar."><VariablePicker value={a.var as string} onChange={(v) => onArgs({ var: v ?? "" })} /></Row>
      <Row label="cruces" help="Variable de cruce (opcional)."><VariablePicker value={a.cruces as string} onChange={(v) => onArgs({ cruces: v })} allowEmpty /></Row>
      <Row label="titulo"><TxtIn value={a.titulo as string} onChange={(v) => onArgs({ titulo: v })} placeholder="(opcional)" /></Row>
    </>
  );
}

function FormPieDonut({ graf, onArgs }: Props) {
  const a = graf.args;
  return (
    <>
      <Row label="var"><VariablePicker value={a.var as string} onChange={(v) => onArgs({ var: v ?? "" })} /></Row>
      <Row label="titulo"><TxtIn value={a.titulo as string} onChange={(v) => onArgs({ titulo: v })} placeholder="(opcional)" /></Row>
    </>
  );
}

function FormNumerico({ graf, onArgs }: Props) {
  const a = graf.args;
  return (
    <>
      <Row label="var"><VariablePicker value={a.var as string} onChange={(v) => onArgs({ var: v ?? "" })} /></Row>
      <Row label="metrica">
        <select value={(a.metrica as string) ?? "mean"} onChange={(e) => onArgs({ metrica: e.target.value })}
          style={{ fontSize: 12, padding: "3px 6px" }}>
          <option value="N">N (conteo)</option>
          <option value="pct">% (porcentaje)</option>
          <option value="mean">Media</option>
          <option value="median">Mediana</option>
        </select>
      </Row>
      <Row label="cruce"><VariablePicker value={a.cruce as string} onChange={(v) => onArgs({ cruce: v })} allowEmpty /></Row>
      <Row label="titulo"><TxtIn value={a.titulo as string} onChange={(v) => onArgs({ titulo: v })} placeholder="(opcional)" /></Row>
    </>
  );
}

function FormBoxMedia({ graf, onArgs }: Props) {
  const a = graf.args;
  return (
    <>
      <Row label="var"><VariablePicker value={a.var as string} onChange={(v) => onArgs({ var: v ?? "" })} /></Row>
      <Row label="cruce"><VariablePicker value={a.cruce as string} onChange={(v) => onArgs({ cruce: v })} allowEmpty /></Row>
      <Row label="titulo"><TxtIn value={a.titulo as string} onChange={(v) => onArgs({ titulo: v })} placeholder="(opcional)" /></Row>
    </>
  );
}

export default function GraficadorForm({ graf, onArgs }: Props) {
  switch (graf.graficador) {
    case "p_barras_agrupadas":
    case "p_barras_apiladas":
      return <FormBarras graf={graf} onArgs={onArgs} />;
    case "p_pie":
    case "p_donut":
      return <FormPieDonut graf={graf} onArgs={onArgs} />;
    case "p_numerico":
      return <FormNumerico graf={graf} onArgs={onArgs} />;
    case "p_boxplot":
    case "p_media_rango":
      return <FormBoxMedia graf={graf} onArgs={onArgs} />;
    default:
      return <div style={{ fontSize: 12, color: "#c00" }}>Graficador no soportado aún: {graf.graficador}</div>;
  }
}
