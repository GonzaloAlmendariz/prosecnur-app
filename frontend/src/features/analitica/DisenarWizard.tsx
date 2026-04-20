import { useState } from "react";
import { BookOpen, BarChart2, Grid3x3, FileText, Users } from "lucide-react";
import { useSession } from "../../lib/SessionContext";
import { Alert } from "../../components/Alert";
import { CodebookPane } from "./panes/CodebookPane";
import { FrecuenciasPane } from "./panes/FrecuenciasPane";
import { CrucesPane } from "./panes/CrucesPane";
import { SpssPane } from "./panes/SpssPane";
import { EnumeradoresPane } from "./panes/EnumeradoresPane";

// Paso 2 — Diseñar.
// Sidebar con 5 reportes + panel central con la configuración específica
// del reporte activo. Mismo patrón que `CodificarWizard` en Fase 3.

type ReporteKey = "codebook" | "frecuencias" | "cruces" | "spss" | "enumeradores";

type ReporteItem = {
  key: ReporteKey;
  label: string;
  icon: typeof BookOpen;
  desc: string;
};

const REPORTES: ReporteItem[] = [
  { key: "codebook",    label: "Codebook",     icon: BookOpen,  desc: "Libro de códigos" },
  { key: "frecuencias", label: "Frecuencias",  icon: BarChart2, desc: "Tablas univariadas" },
  { key: "cruces",      label: "Cruces",       icon: Grid3x3,   desc: "Tablas 2D + significancia" },
  { key: "spss",        label: "SPSS",         icon: FileText,  desc: ".sav + .sps" },
  { key: "enumeradores",label: "Enumeradores", icon: Users,     desc: "PDF por encuestador" },
];

export function DisenarWizard() {
  const { state } = useSession();
  const [active, setActive] = useState<ReporteKey>("codebook");

  const prepOk = !!state?.analitica_prep_ok;

  if (!prepOk) {
    return (
      <Alert kind="warn">
        Prepara los datos primero en el paso <strong>1 · Preparar</strong> antes de diseñar los reportes.
      </Alert>
    );
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(220px, 260px) 1fr", gap: 16, alignItems: "flex-start" }}>
      {/* Sidebar */}
      <aside
        style={{
          position: "sticky", top: 96,
          display: "flex", flexDirection: "column", gap: 4,
          maxHeight: "calc(100vh - 120px)", overflowY: "auto",
        }}
      >
        <div
          style={{
            fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5,
            color: "var(--pulso-text-soft)", marginBottom: 6, padding: "0 6px",
          }}
        >
          5 reportes
        </div>
        {REPORTES.map((r) => (
          <SidebarItem
            key={r.key}
            item={r}
            active={active === r.key}
            onClick={() => setActive(r.key)}
          />
        ))}
      </aside>

      {/* Panel central */}
      <main style={{ minWidth: 0 }}>
        {active === "codebook"     && <CodebookPane />}
        {active === "frecuencias"  && <FrecuenciasPane />}
        {active === "cruces"       && <CrucesPane />}
        {active === "spss"         && <SpssPane />}
        {active === "enumeradores" && <EnumeradoresPane />}
      </main>
    </div>
  );
}

function SidebarItem({ item, active, onClick }: { item: ReporteItem; active: boolean; onClick: () => void }) {
  const Icon = item.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "grid",
        gridTemplateColumns: "16px 1fr",
        gap: 10,
        alignItems: "center",
        textAlign: "left",
        padding: "8px 10px",
        border: active ? "1px solid var(--pulso-primary)" : "1px solid var(--pulso-border)",
        borderRadius: 6,
        background: active ? "var(--pulso-primary-soft)" : "white",
        cursor: "pointer",
      }}
    >
      <Icon size={14} color={active ? "var(--pulso-primary)" : "var(--pulso-text-soft)"} />
      <div style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: active ? "var(--pulso-primary)" : "var(--pulso-text)" }}>
          {item.label}
        </span>
        <span style={{ fontSize: 10, color: "var(--pulso-text-soft)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {item.desc}
        </span>
      </div>
    </button>
  );
}
