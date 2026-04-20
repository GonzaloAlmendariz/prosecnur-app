import { BookOpen } from "lucide-react";
import { Panel } from "../../../components/Panel";
import { useAnaliticaStore } from "../store";

// Codebook pane — inputs ricos del argumento `codigos_solo_si_presentes`
// de prosecnur::reporte_codebook. En B1 es mínimo; B3 agrega preview,
// validación y más args.

export function CodebookPane() {
  const codebook = useAnaliticaStore((s) => s.config.codebook);
  const setCodebook = useAnaliticaStore((s) => s.setCodebook);

  const codes = codebook.codigos_solo_si_presentes;

  function setCodes(list: number[]) {
    setCodebook({ codigos_solo_si_presentes: list });
  }

  function toggle(n: number) {
    setCodes(codes.includes(n) ? codes.filter((x) => x !== n) : [...codes, n].sort((a, b) => a - b));
  }

  return (
    <Panel
      eyebrow="Configuración"
      title={<span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><BookOpen size={14} /> Libro de códigos</span>}
      hint={<>Diccionario de variables con etiquetas y valores válidos. Los códigos marcados abajo solo se muestran si aparecen en la data (útiles para ocultar <code>NS/NR/No aplica</code> cuando nadie los marcó).</>}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div className="pulso-section-eyebrow">Códigos solo si presentes</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {[95, 96, 97, 98, 99].map((n) => (
            <label
              key={n}
              style={{
                display: "inline-flex", alignItems: "center", gap: 4,
                padding: "4px 10px", borderRadius: 999,
                border: `1px solid ${codes.includes(n) ? "var(--pulso-primary)" : "var(--pulso-border)"}`,
                background: codes.includes(n) ? "var(--pulso-primary-soft)" : "white",
                fontSize: 12, cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={codes.includes(n)}
                onChange={() => toggle(n)}
                style={{ margin: 0 }}
              />
              <code style={{ fontFamily: "monospace", fontWeight: 700 }}>{n}</code>
            </label>
          ))}
        </div>
        <div style={{ fontSize: 11, color: "var(--pulso-text-soft)", lineHeight: 1.4 }}>
          Convenciones comunes: 95 = No contesta · 96 = No aplica · 97 = No sabe · 98 = Otro · 99 = Otros.
        </div>
      </div>
    </Panel>
  );
}
