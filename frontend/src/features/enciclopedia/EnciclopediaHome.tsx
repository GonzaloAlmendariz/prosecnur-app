import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { BookOpen, BookText, GitCompare, Layers, Library, Search } from "lucide-react";
import {
  apiEnciclopediaCatalogo,
  apiEnciclopediaGlosario,
  apiEnciclopediaEstudios,
  apiEnciclopediaTiposEstudio,
  type EnciclopediaCatalogo,
  type EnciclopediaGlosario,
  type EnciclopediaTablaEstudios,
  type EnciclopediaTiposEstudioCatalogo,
} from "../../api/client";
import { PageFrame } from "../../components/PageFrame";
import { TabStrip, type TabMeta } from "../../components/TabStrip";
import { Panel } from "../../components/Panel";
import { Alert } from "../../components/Alert";
import { LoadingBlock } from "../../components/States";
import { Math } from "./shared/components/Math";

type TabId = "catalogo" | "glosario" | "comparador" | "estudios" | "tipos";

const NATURALEZA_LABEL: Record<string, { label: string; color: string; bg: string }> = {
  prob: { label: "Probabilístico", color: "var(--pulso-info-fg)", bg: "var(--pulso-info-bg)" },
  operativo: { label: "Operativo", color: "var(--pulso-success-fg)", bg: "var(--pulso-success-bg)" },
  no_prob: { label: "No probabilístico", color: "var(--pulso-warn-fg)", bg: "var(--pulso-warn-bg)" },
};

const ACCION_EVALUADOR_LABEL: Record<string, string> = {
  calcular_muestra: "Calcular muestra",
  calcular_marco_cobertura: "Calcular marco",
  calcular_cuotas: "Calcular cuotas",
  fuera_calculador: "Fuera del calculador",
  evaluar_por_componente: "Por componente",
};

const REQUIERE_MUESTRA_LABEL: Record<string, string> = {
  si: "Sí",
  no: "No",
  parcial: "Parcial",
};

export default function EnciclopediaHome() {
  const [tab, setTab] = useState<TabId>("catalogo");
  const [catalogo, setCatalogo] = useState<EnciclopediaCatalogo | null>(null);
  const [glosario, setGlosario] = useState<EnciclopediaGlosario | null>(null);
  const [tabla, setTabla] = useState<EnciclopediaTablaEstudios | null>(null);
  const [tipos, setTipos] = useState<EnciclopediaTiposEstudioCatalogo | null>(null);
  const [seleccionComp, setSeleccionComp] = useState<string[]>([]);
  const [busqueda, setBusqueda] = useState("");

  useEffect(() => {
    apiEnciclopediaCatalogo().then(setCatalogo).catch((e) => console.warn(e));
    apiEnciclopediaGlosario().then(setGlosario).catch((e) => console.warn(e));
    apiEnciclopediaEstudios().then(setTabla).catch((e) => console.warn(e));
    apiEnciclopediaTiposEstudio().then(setTipos).catch((e) => console.warn(e));
  }, []);

  const tabs: TabMeta<TabId>[] = [
    { key: "catalogo", label: `Catálogo (${catalogo?.metodologias.length ?? "…"})`, icon: BookOpen, desc: "Fichas técnicas" },
    { key: "glosario", label: `Glosario (${glosario?.terminos.length ?? "…"})`, icon: BookText, desc: "Términos canónicos" },
    { key: "comparador", label: "Comparador", icon: GitCompare, desc: "Side-by-side" },
    { key: "estudios", label: `Estudios (${tabla?.estudios.length ?? "…"})`, icon: Library, desc: "Tabla de aplicaciones" },
    { key: "tipos", label: `Tipos (${tipos?.familias_estudio.length ?? "…"})`, icon: Layers, desc: "Rutas del evaluador" },
  ];

  return (
    <PageFrame
      title="Enciclopedia metodológica"
      lead="Catálogo de diez técnicas muestrales cuantitativas, glosario de términos, comparador y tabla de estudios aplicados."
    >
      <TabStrip tabs={tabs} active={tab} onChange={setTab} ariaLabel="Secciones de la enciclopedia" />

      {tab === "catalogo" && (catalogo ? (
        <CatalogoPane catalogo={catalogo} busqueda={busqueda} setBusqueda={setBusqueda} />
      ) : <LoadingBlock label="Cargando catálogo…" />)}
      {tab === "glosario" && (glosario ? <GlosarioPane glosario={glosario} /> : <LoadingBlock label="Cargando glosario…" />)}
      {tab === "comparador" && (catalogo ? (
        <ComparadorPane catalogo={catalogo} seleccion={seleccionComp} setSeleccion={setSeleccionComp} />
      ) : <LoadingBlock label="Cargando…" />)}
      {tab === "estudios" && (tabla ? <TablaEstudiosPane tabla={tabla} tipos={tipos} /> : <LoadingBlock label="Cargando estudios…" />)}
      {tab === "tipos" && (tipos ? <TiposEstudioPane tipos={tipos} /> : <LoadingBlock label="Cargando tipos…" />)}
    </PageFrame>
  );
}

function CatalogoPane({
  catalogo, busqueda, setBusqueda,
}: { catalogo: EnciclopediaCatalogo; busqueda: string; setBusqueda: (v: string) => void; }) {
  const filtradas = catalogo.metodologias.filter((m) => {
    if (!busqueda) return true;
    const q = busqueda.toLowerCase();
    return (
      m.nombre_tecnico.toLowerCase().includes(q) ||
      m.definicion.toLowerCase().includes(q) ||
      m.id.includes(q)
    );
  });
  return (
    <Panel
      eyebrow="Diez técnicas muestrales"
      title="Catálogo de metodologías"
    >
      <div style={{ position: "relative", marginBottom: 14 }}>
        <Search
          size={14}
          style={{
            position: "absolute",
            left: 10,
            top: "50%",
            transform: "translateY(-50%)",
            color: "var(--pulso-text-soft)",
          }}
        />
        <input
          type="search"
          placeholder="Buscar metodología…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          style={{
            padding: "8px 12px 8px 32px",
            border: "1px solid var(--pulso-border)",
            borderRadius: 6,
            fontSize: 13,
            width: "100%",
            boxSizing: "border-box",
            background: "var(--pulso-surface)",
          }}
        />
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(250px, 100%), 1fr))",
          gap: 10,
          minWidth: 0,
        }}
      >
        {filtradas.map((m) => {
          const natMeta = NATURALEZA_LABEL[m.naturaleza];
          return (
            <Link
              key={m.id}
              to={`/enciclopedia/metodologia/${m.id}`}
              style={{
                textDecoration: "none",
                color: "inherit",
                padding: 12,
                border: "1px solid var(--pulso-border)",
                borderRadius: 8,
                background: "var(--pulso-surface)",
                display: "grid",
                gap: 8,
                minWidth: 0,
                overflow: "hidden",
                transition: "border-color 160ms ease, box-shadow 160ms ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "var(--pulso-primary)";
                e.currentTarget.style.boxShadow = "var(--pulso-shadow-soft)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "var(--pulso-border)";
                e.currentTarget.style.boxShadow = "";
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start", minWidth: 0 }}>
                <h3 style={{ minWidth: 0, margin: 0, color: "var(--pulso-primary)", fontSize: 14, fontWeight: 700, overflowWrap: "anywhere" }}>{m.nombre_tecnico}</h3>
                {m.implementada_en_calculador && (
                  <span style={{ ...chip, flex: "0 1 auto", minWidth: 0, maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", background: "var(--pulso-success-bg)", color: "var(--pulso-success-fg)", whiteSpace: "nowrap" }}>
                    En calculador
                  </span>
                )}
              </div>
              <span style={{ ...chip, background: natMeta.bg, color: natMeta.color, width: "fit-content" }}>
                {natMeta.label}
              </span>
              <p style={{ margin: 0, fontSize: 12, color: "var(--pulso-text-soft)", lineHeight: 1.5 }}>
                {m.definicion.length > 160 ? m.definicion.slice(0, 160) + "…" : m.definicion}
              </p>
            </Link>
          );
        })}
      </div>
    </Panel>
  );
}

function GlosarioPane({ glosario }: { glosario: EnciclopediaGlosario }) {
  return (
    <Panel
      eyebrow={`${glosario.terminos.length} términos`}
      title="Glosario canónico"
      hint="Cada término referencia las metodologías relacionadas y los campos del calculador donde aparece."
    >
      <div style={{ display: "grid", gap: 8 }}>
        {glosario.terminos.map((t) => (
          <article key={t.id} style={{
            padding: 12, border: "1px solid var(--pulso-border)",
            borderRadius: 6, background: "var(--pulso-surface)",
          }}>
            <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
              <h3 style={{ margin: 0, color: "var(--pulso-primary)", fontSize: 14, fontWeight: 700 }}>{t.termino}</h3>
              <span style={{ fontSize: 12, color: "var(--pulso-text-soft)" }}>{t.nombre_completo}</span>
            </div>
            <p style={{ margin: "6px 0", fontSize: 12, lineHeight: 1.55, color: "var(--pulso-text)" }}>{t.definicion}</p>
            {t.formula && (
              <div style={{ margin: "6px 0", padding: 8, background: "var(--pulso-bg)", borderRadius: 4 }}>
                <Math expression={t.formula} display />
              </div>
            )}
            {t.metodologias_relacionadas.length > 0 && (
              <div style={{ marginTop: 6, fontSize: 11, color: "var(--pulso-text-soft)" }}>
                <strong style={{ fontWeight: 700 }}>Aplica en: </strong>
                {t.metodologias_relacionadas.map((mid, i) => (
                  <span key={mid}>
                    <Link to={`/enciclopedia/metodologia/${mid}`} style={{ color: "var(--pulso-primary)", textDecoration: "none" }}>
                      {mid.replace(/_/g, " ")}
                    </Link>
                    {i < t.metodologias_relacionadas.length - 1 ? " · " : ""}
                  </span>
                ))}
              </div>
            )}
          </article>
        ))}
      </div>
    </Panel>
  );
}

function ComparadorPane({
  catalogo, seleccion, setSeleccion,
}: { catalogo: EnciclopediaCatalogo; seleccion: string[]; setSeleccion: (v: string[]) => void; }) {
  function toggle(id: string) {
    if (seleccion.includes(id)) setSeleccion(seleccion.filter((x) => x !== id));
    else if (seleccion.length < 3) setSeleccion([...seleccion, id]);
  }
  const sel = catalogo.metodologias.filter((m) => seleccion.includes(m.id));
  return (
    <Panel
      eyebrow="Comparador"
      title="Hasta 3 metodologías side-by-side"
      hint="Selecciona 2 o 3 metodologías para compararlas en sus principales ejes."
    >
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
        {catalogo.metodologias.map((m) => {
          const active = seleccion.includes(m.id);
          const disabled = !active && seleccion.length >= 3;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => toggle(m.id)}
              disabled={disabled}
              style={{
                padding: "5px 10px",
                background: active ? "var(--pulso-primary)" : "var(--pulso-surface)",
                color: active ? "white" : "var(--pulso-primary)",
                border: "1px solid",
                borderColor: active ? "var(--pulso-primary)" : "var(--pulso-border)",
                borderRadius: 16,
                cursor: disabled ? "not-allowed" : "pointer",
                fontSize: 11,
                fontWeight: 600,
                opacity: disabled ? 0.4 : 1,
              }}
            >
              {active && "✓ "}{m.nombre_tecnico}
            </button>
          );
        })}
      </div>
      {sel.length < 2 ? (
        <Alert kind="info">Selecciona al menos 2 metodologías para ver la comparación.</Alert>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Eje</th>
                {sel.map((m) => <th key={m.id} style={thStyle}>{m.nombre_tecnico}</th>)}
              </tr>
            </thead>
            <tbody>
              <Row label="Naturaleza" sel={sel} get={(m) => NATURALEZA_LABEL[m.naturaleza].label} />
              <Row label="Permite margen de error" sel={sel} get={(m) => (m.permite_margen_error ? "Sí" : "No")} />
              <Row label="Definición" sel={sel} get={(m) => m.definicion} />
              <Row label="Salida principal" sel={sel} get={(m) => m.salida_principal.replace(/_/g, " ")} />
              <Row label="Cuándo usar" sel={sel} get={(m) => m.escenarios_de_uso.map((e) => `• ${e.contexto}`).join("\n")} />
              <Row label="Cuándo NO usar" sel={sel} get={(m) => m.cuando_no_usar.map((c) => `• ${c}`).join("\n")} />
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

function Row({ label, sel, get }: { label: string; sel: EnciclopediaCatalogo["metodologias"]; get: (m: EnciclopediaCatalogo["metodologias"][number]) => string; }) {
  return (
    <tr>
      <td style={{ ...tdStyle, fontWeight: 700, background: "var(--pulso-bg)", color: "var(--pulso-primary)" }}>{label}</td>
      {sel.map((m) => <td key={m.id} style={{ ...tdStyle, whiteSpace: "pre-wrap" }}>{get(m)}</td>)}
    </tr>
  );
}

function TablaEstudiosPane({
  tabla,
  tipos,
}: { tabla: EnciclopediaTablaEstudios; tipos: EnciclopediaTiposEstudioCatalogo | null }) {
  const [filtroMet, setFiltroMet] = useState("");
  const [filtroFamilia, setFiltroFamilia] = useState("");
  const [filtroAnio, setFiltroAnio] = useState<number | "">("");
  const familias = tipos?.familias_estudio ?? [];
  const familiasById = new Map(familias.map((f) => [f.id, f.nombre]));
  const filas = tabla.estudios.filter((e) => {
    if (filtroMet && e.metodologia_principal !== filtroMet) return false;
    if (filtroFamilia && e.familia_estudio !== filtroFamilia) return false;
    if (filtroAnio !== "" && e.anio !== filtroAnio) return false;
    return true;
  });
  const anios = Array.from(new Set(tabla.estudios.map((e) => e.anio))).sort();
  const metodos = Array.from(new Set(tabla.estudios.map((e) => e.metodologia_principal))).sort();

  return (
    <Panel
      eyebrow={`${tabla.estudios.length} estudios documentados`}
      title="Tabla maestra de aplicaciones"
      hint="Solo códigos internos. Información contextual de cada estudio es confidencial."
    >
      <Alert kind="warn">
        <strong>Confidencialidad:</strong> {tabla.nota_confidencialidad}
      </Alert>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12, alignItems: "center" }}>
        <select value={filtroMet} onChange={(e) => setFiltroMet(e.target.value)}
          style={{ ...selectFilter, minWidth: 200 }}>
          <option value="">Toda metodología</option>
          {metodos.map((m) => <option key={m} value={m}>{m.replace(/_/g, " ")}</option>)}
        </select>
        <select value={filtroFamilia} onChange={(e) => setFiltroFamilia(e.target.value)}
          style={{ ...selectFilter, minWidth: 220 }}>
          <option value="">Toda familia</option>
          {familias.map((f) => <option key={f.id} value={f.id}>{f.nombre}</option>)}
        </select>
        <select value={filtroAnio}
          onChange={(e) => setFiltroAnio(e.target.value === "" ? "" : Number(e.target.value))}
          style={{ ...selectFilter, minWidth: 130 }}>
          <option value="">Todos los años</option>
          {anios.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 11, color: "var(--pulso-text-soft)", fontWeight: 600 }}>
          {filas.length} de {tabla.estudios.length} estudios
        </span>
      </div>
      <div style={{ overflowX: "auto", marginTop: 12 }}>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>Código</th>
              <th style={thStyle}>Año</th>
              <th style={thStyle}>Familia</th>
              <th style={thStyle}>Metodología principal</th>
              <th style={thStyle}>Evaluador</th>
              <th style={thStyle}>Muestra</th>
              <th style={thStyle}>Secundarias</th>
              <th style={thStyle}>Dominio</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((e) => (
              <tr key={e.codigo}>
                <td style={{ ...tdStyle, fontFamily: "monospace", fontWeight: 700, color: "var(--pulso-primary)" }}>{e.codigo}</td>
                <td style={tdStyle}>{e.anio}</td>
                <td style={tdStyle}>{familiasById.get(e.familia_estudio) ?? e.familia_estudio.replace(/_/g, " ")}</td>
                <td style={tdStyle}>
                  <Link to={`/enciclopedia/metodologia/${e.metodologia_principal}`}
                    style={{ color: "var(--pulso-primary)", textDecoration: "none" }}>
                    {e.metodologia_principal.replace(/_/g, " ")}
                  </Link>
                </td>
                <td style={tdStyle}>
                  <span style={{ ...chip, background: "var(--pulso-info-bg)", color: "var(--pulso-info-fg)", textTransform: "none", letterSpacing: 0 }}>
                    {ACCION_EVALUADOR_LABEL[e.accion_evaluador_muestra] ?? e.accion_evaluador_muestra.replace(/_/g, " ")}
                  </span>
                </td>
                <td style={tdStyle}>
                  {REQUIERE_MUESTRA_LABEL[e.requiere_calculo_muestra] ?? e.requiere_calculo_muestra}
                  <br />
                  <span style={{ fontSize: 11, color: "var(--pulso-text-soft)" }}>
                    {e.origen_muestra.replace(/_/g, " ")}
                  </span>
                </td>
                <td style={tdStyle}>
                  {e.metodologias_secundarias.length === 0
                    ? "—"
                    : e.metodologias_secundarias.map((s) => s.replace(/_/g, " ")).join(", ")}
                </td>
                <td style={tdStyle}>{e.dominio.replace(/_/g, " ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function TiposEstudioPane({ tipos }: { tipos: EnciclopediaTiposEstudioCatalogo }) {
  const accionesById = new Map(tipos.acciones_evaluador_muestra.map((a) => [a.id, a]));

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <Panel
        eyebrow="Regla del evaluador"
        title="No todo estudio calcula muestra"
        hint={tipos.criterio_general}
      >
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 8 }}>
          {tipos.acciones_evaluador_muestra.map((accion) => (
            <article
              key={accion.id}
              style={{
                padding: 12,
                border: "1px solid var(--pulso-border)",
                borderRadius: 6,
                background: "var(--pulso-surface)",
              }}
            >
              <h3 style={{ margin: 0, fontSize: 13, color: "var(--pulso-primary)", fontWeight: 700 }}>
                {accion.nombre}
              </h3>
              <p style={{ margin: "6px 0 0", fontSize: 12, lineHeight: 1.5, color: "var(--pulso-text-soft)" }}>
                {accion.descripcion}
              </p>
              <span style={{ ...chip, marginTop: 8, background: "var(--pulso-bg)", color: "var(--pulso-text-soft)", textTransform: "none", letterSpacing: 0 }}>
                {accion.salida_principal.replace(/_/g, " ")}
              </span>
            </article>
          ))}
        </div>
      </Panel>

      <Panel
        eyebrow={`${tipos.familias_estudio.length} familias`}
        title="Familias de estudios 2024-2026"
      >
        <div style={{ display: "grid", gap: 10 }}>
          {tipos.familias_estudio.map((familia) => (
            <article
              key={familia.id}
              style={{
                padding: 12,
                border: "1px solid var(--pulso-border)",
                borderRadius: 6,
                background: "var(--pulso-surface)",
                display: "grid",
                gap: 8,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 14, color: "var(--pulso-primary)", fontWeight: 700 }}>
                    {familia.nombre}
                  </h3>
                  <p style={{ margin: "4px 0 0", fontSize: 12, lineHeight: 1.5, color: "var(--pulso-text-soft)" }}>
                    {familia.descripcion}
                  </p>
                </div>
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap", alignContent: "flex-start" }}>
                  {familia.acciones_evaluador_permitidas.map((accionId) => (
                    <span
                      key={accionId}
                      style={{ ...chip, background: "var(--pulso-info-bg)", color: "var(--pulso-info-fg)", textTransform: "none", letterSpacing: 0 }}
                    >
                      {accionesById.get(accionId)?.nombre ?? accionId.replace(/_/g, " ")}
                    </span>
                  ))}
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
                <div>
                  <strong style={{ fontSize: 11, color: "var(--pulso-text-soft)", textTransform: "uppercase", letterSpacing: 0.3 }}>
                    Criterios
                  </strong>
                  <ul style={{ margin: "6px 0 0", paddingLeft: 18, fontSize: 12, lineHeight: 1.55 }}>
                    {familia.criterios.map((criterio) => <li key={criterio}>{criterio}</li>)}
                  </ul>
                </div>
                <div>
                  <strong style={{ fontSize: 11, color: "var(--pulso-text-soft)", textTransform: "uppercase", letterSpacing: 0.3 }}>
                    Elementos
                  </strong>
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 6 }}>
                    {familia.elementos_comunes.map((item) => (
                      <span key={item} style={{ ...chip, background: "var(--pulso-bg)", color: "var(--pulso-text-soft)", textTransform: "none", letterSpacing: 0 }}>
                        {item.replace(/_/g, " ")}
                      </span>
                    ))}
                  </div>
                  <p style={{ margin: "8px 0 0", fontSize: 11, color: "var(--pulso-text-soft)" }}>
                    Ejemplos: {familia.ejemplos.join(", ")}
                  </p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </Panel>
    </div>
  );
}

const chip: React.CSSProperties = {
  display: "inline-block",
  fontSize: 10,
  padding: "2px 8px",
  borderRadius: 10,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: 0.4,
};

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: 12,
  background: "var(--pulso-surface)",
};

const thStyle: React.CSSProperties = {
  background: "var(--pulso-primary)",
  color: "white",
  padding: "8px 10px",
  textAlign: "left",
  border: "1px solid var(--pulso-primary)",
  fontSize: 11,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: 0.3,
};

const tdStyle: React.CSSProperties = {
  padding: "8px 10px",
  border: "1px solid var(--pulso-border)",
  verticalAlign: "top",
};

const selectFilter: React.CSSProperties = {
  padding: "6px 8px",
  border: "1px solid var(--pulso-border)",
  borderRadius: 6,
  fontSize: 12,
  background: "var(--pulso-surface)",
  color: "var(--pulso-text)",
};
