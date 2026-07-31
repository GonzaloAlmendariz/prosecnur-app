import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, BookOpen, Calculator, FileText, Library, ScrollText, Settings2 } from "lucide-react";
import {
  apiEnciclopediaCatalogo,
  type EnciclopediaFicha,
} from "../../api/client";
import { PageFrame } from "../../components/PageFrame";
import {
  TabStrip,
  tabPanelProps,
  type TabMeta,
} from "../../components/TabStrip";
import { Panel } from "../../components/Panel";
import { Alert } from "../../components/Alert";
import { LoadingBlock } from "../../components/States";
import { Math as KMath } from "../../components/Math";

type TabId = "definicion" | "formulas" | "parametros" | "decisiones" | "aplicaciones";

const NATURALEZA_META: Record<string, { label: string; color: string; bg: string }> = {
  prob: { label: "Probabilístico", color: "var(--pulso-info-fg)", bg: "var(--pulso-info-bg)" },
  operativo: { label: "Operativo", color: "var(--pulso-success-fg)", bg: "var(--pulso-success-bg)" },
  no_prob: { label: "No probabilístico", color: "var(--pulso-warn-fg)", bg: "var(--pulso-warn-bg)" },
};

export default function FichaMetodologica() {
  const { id } = useParams<{ id: string }>();
  const [ficha, setFicha] = useState<EnciclopediaFicha | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabId>("definicion");

  useEffect(() => {
    setFicha(null);
    setError(null);
    apiEnciclopediaCatalogo()
      .then((cat) => {
        const f = cat.metodologias.find((m) => m.id === id);
        if (!f) setError(`Metodología "${id}" no encontrada en el catálogo.`);
        else setFicha(f);
      })
      .catch((e) => setError(e.message ?? "Error cargando catálogo"));
  }, [id]);

  if (error) {
    return (
      <PageFrame title="Ficha no encontrada">
        <Alert kind="error">{error}</Alert>
        <p style={{ marginTop: 12 }}>
          <Link to="/enciclopedia" style={{ color: "var(--pulso-primary)" }}>← Volver al catálogo</Link>
        </p>
      </PageFrame>
    );
  }
  if (!ficha) {
    return (
      <PageFrame title="Cargando…">
        <LoadingBlock label="Cargando ficha metodológica…" />
      </PageFrame>
    );
  }

  const nat = NATURALEZA_META[ficha.naturaleza];

  const tabs: TabMeta<TabId>[] = [
    { key: "definicion", label: "Definición", icon: BookOpen, desc: "Y supuestos" },
    { key: "formulas", label: `Fórmulas (${ficha.formulas.length})`, icon: ScrollText, desc: "Expresiones técnicas" },
    { key: "parametros", label: "Parámetros", icon: Settings2, desc: "Rangos típicos" },
    { key: "decisiones", label: "Decisiones", icon: FileText, desc: "Trade-offs y referencias" },
    { key: "aplicaciones", label: `Aplicaciones (${ficha.aplicaciones_internas.length})`, icon: Library, desc: "Estudios documentados" },
  ];

  const meta = (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
      <span style={{ ...chipStyle, background: nat.bg, color: nat.color }}>{nat.label}</span>
      <span
        style={{
          ...chipStyle,
          background: ficha.permite_margen_error ? "var(--pulso-info-bg)" : "var(--pulso-warn-bg)",
          color: ficha.permite_margen_error ? "var(--pulso-info-fg)" : "var(--pulso-warn-fg)",
        }}
      >
        {ficha.permite_margen_error ? "Margen formal" : "Sin margen"}
      </span>
      {ficha.implementada_en_calculador ? (
        <span style={{ ...chipStyle, background: "var(--pulso-success-bg)", color: "var(--pulso-success-fg)" }}>
          En calculador
        </span>
      ) : (
        <span style={{ ...chipStyle, background: "var(--pulso-bg)", color: "var(--pulso-text-soft)" }}>
          Próximamente
        </span>
      )}
    </div>
  );

  const toolbar = ficha.implementada_en_calculador ? (
    <Link
      to="/calc-muestra"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "7px 12px",
        fontSize: 12,
        fontWeight: 700,
        borderRadius: 8,
        border: "1px solid var(--pulso-primary)",
        background: "var(--pulso-primary)",
        color: "white",
        textDecoration: "none",
      }}
    >
      <Calculator size={14} />
      Aplicar en calculador
    </Link>
  ) : undefined;

  return (
    <PageFrame title={ficha.nombre_tecnico} meta={meta} toolbar={toolbar}>
      <Link
        to="/enciclopedia"
        style={{
          color: "var(--pulso-text-soft)",
          textDecoration: "none",
          fontSize: 12,
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          fontWeight: 600,
        }}
      >
        <ArrowLeft size={12} />
        Volver al catálogo
      </Link>

      <TabStrip
        idBase="ficha-metodologica"
        tabs={tabs}
        active={tab}
        onChange={setTab}
        ariaLabel="Secciones de la ficha"
      />

      <section {...tabPanelProps("ficha-metodologica", tab)}>
        {tab === "definicion" && (
        <>
          <Panel eyebrow="Definición" title="¿Qué es esta técnica?">
            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: "var(--pulso-text)" }}>
              {ficha.definicion}
            </p>
          </Panel>
          <Panel eyebrow="Supuestos" title="Supuestos formales">
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: "var(--pulso-text)", lineHeight: 1.6 }}>
              {ficha.supuestos_formales.map((s, i) => <li key={i}>{s}</li>)}
            </ul>
          </Panel>
          <Panel eyebrow="Escenarios" title="Cuándo usar">
            <div style={{ display: "grid", gap: 8 }}>
              {ficha.escenarios_de_uso.map((e, i) => (
                <div key={i} style={{
                  padding: "10px 12px",
                  background: "var(--pulso-success-bg)",
                  borderRadius: 4,
                  borderLeft: "3px solid var(--pulso-success-fg)",
                }}>
                  <strong style={{ fontSize: 13, color: "var(--pulso-text)" }}>{e.contexto}</strong>
                  <div style={{ color: "var(--pulso-text-soft)", fontSize: 12, marginTop: 3, lineHeight: 1.5 }}>{e.porque_aplica}</div>
                </div>
              ))}
            </div>
          </Panel>
          <Panel eyebrow="Restricciones" title="Cuándo NO usar">
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: "var(--pulso-danger-fg)", lineHeight: 1.6 }}>
              {ficha.cuando_no_usar.map((c, i) => <li key={i}>{c}</li>)}
            </ul>
          </Panel>
        </>
      )}

        {tab === "formulas" && (
        <Panel eyebrow={`${ficha.formulas.length} fórmulas`} title="Expresiones técnicas">
          <div style={{ display: "grid", gap: 12 }}>
            {ficha.formulas.map((f, i) => (
              <article key={i} style={{
                padding: 14,
                background: "var(--pulso-bg)",
                borderRadius: 8,
                border: "1px solid var(--pulso-border)",
              }}>
                <div style={{ marginBottom: 10 }}>
                  <KMath expression={f.expresion} display />
                </div>
                <p style={{ margin: 0, fontSize: 12, lineHeight: 1.55, color: "var(--pulso-text)" }}>{f.descripcion}</p>
                {f.notas.length > 0 && (
                  <ul style={{ marginTop: 6, marginBottom: 0, paddingLeft: 18, fontSize: 11, color: "var(--pulso-text-soft)" }}>
                    {f.notas.map((n, j) => <li key={j}>{n}</li>)}
                  </ul>
                )}
              </article>
            ))}
          </div>
        </Panel>
      )}

        {tab === "parametros" && (
        <Panel eyebrow="Parámetros típicos" title="Rangos recomendados">
          <div style={{ overflowX: "auto" }}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Parámetro</th>
                  <th style={thStyle}>Rango</th>
                  <th style={thStyle}>Justificación</th>
                </tr>
              </thead>
              <tbody>
                {ficha.parametros_tipicos.map((p, i) => (
                  <tr key={i}>
                    <td style={{ ...tdStyle, fontWeight: 700, color: "var(--pulso-primary)" }}>{p.nombre}</td>
                    <td style={tdStyle}>{p.rango_recomendado}</td>
                    <td style={{ ...tdStyle, color: "var(--pulso-text-soft)" }}>{p.justificacion}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

        {tab === "decisiones" && (
        <>
          <Panel eyebrow="Decisiones" title="Decisiones técnicas">
            <div style={{ display: "grid", gap: 8 }}>
              {ficha.decisiones_tecnicas.map((d, i) => (
                <article key={i} style={{
                  padding: 10,
                  border: "1px solid var(--pulso-border)",
                  borderRadius: 6,
                  background: "var(--pulso-surface)",
                }}>
                  <strong style={{ fontSize: 13, color: "var(--pulso-primary)" }}>{d.titulo}</strong>
                  <p style={{ margin: "4px 0 0 0", fontSize: 12, color: "var(--pulso-text-soft)", lineHeight: 1.55 }}>
                    {d.detalle}
                  </p>
                </article>
              ))}
            </div>
          </Panel>
          <Panel eyebrow="Trade-offs" title="Ventajas y limitaciones">
            <div style={{ display: "grid", gap: 8 }}>
              {ficha.trade_offs.map((t, i) => (
                <div key={i} style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 10,
                  padding: 10,
                  background: "var(--pulso-surface-2)",
                  borderRadius: 6,
                  border: "1px solid var(--pulso-border)",
                }}>
                  <div>
                    <strong style={{ fontSize: 11, color: "var(--pulso-success-fg)", textTransform: "uppercase", letterSpacing: 0.4 }}>Ventaja</strong>
                    <p style={{ margin: "3px 0 0 0", fontSize: 12, lineHeight: 1.5 }}>{t.ventaja}</p>
                  </div>
                  <div>
                    <strong style={{ fontSize: 11, color: "var(--pulso-danger-fg)", textTransform: "uppercase", letterSpacing: 0.4 }}>Limitación</strong>
                    <p style={{ margin: "3px 0 0 0", fontSize: 12, lineHeight: 1.5 }}>{t.limitacion}</p>
                  </div>
                </div>
              ))}
            </div>
          </Panel>
          <Panel eyebrow="Referencias" title="Bibliografía">
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: "var(--pulso-text)" }}>
              {ficha.referencias_bibliograficas.map((r, i) => (
                <li key={i} style={{ marginBottom: 4, lineHeight: 1.5 }}>{r}</li>
              ))}
            </ul>
          </Panel>
        </>
      )}

        {tab === "aplicaciones" && (
        <Panel
          eyebrow="Aplicaciones internas"
          title={`${ficha.aplicaciones_internas.length} estudios documentados`}
          hint="Códigos internos, sin información contextual confidencial."
        >
          {ficha.aplicaciones_internas.length === 0 ? (
            <Alert kind="info">Sin aplicaciones registradas en la tabla maestra.</Alert>
          ) : (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {ficha.aplicaciones_internas.map((codigo) => (
                <span key={codigo} style={{
                  padding: "5px 10px",
                  background: "var(--pulso-primary-soft)",
                  color: "var(--pulso-primary)",
                  borderRadius: 6,
                  fontSize: 12,
                  fontFamily: "monospace",
                  fontWeight: 700,
                  border: "1px solid var(--pulso-primary-border)",
                }}>{codigo}</span>
              ))}
            </div>
          )}
        </Panel>
        )}
      </section>
    </PageFrame>
  );
}

const chipStyle: React.CSSProperties = {
  display: "inline-block",
  fontSize: 10,
  padding: "3px 8px",
  borderRadius: 10,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: 0.4,
};

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: 12,
};

const thStyle: React.CSSProperties = {
  background: "var(--pulso-primary)",
  color: "white",
  padding: "8px 10px",
  textAlign: "left",
  fontSize: 11,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: 0.3,
};

const tdStyle: React.CSSProperties = {
  padding: "8px 10px",
  border: "1px solid var(--pulso-border)",
  verticalAlign: "top",
  background: "var(--pulso-surface)",
};
