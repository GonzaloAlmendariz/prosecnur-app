import { useCalcMuestraStore } from "../store/calcMuestraStore";
import {
  apiCalcMuestraIniciarEstudio,
  type CalcMuestraMacroFamilia,
  type CalcMuestraVarianteEstudio,
} from "../../../api/client";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ChevronDown,
  ChevronRight,
  ExternalLink,
  GraduationCap,
  Landmark,
  MapPin,
  Sparkles,
  Stethoscope,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { Panel } from "../../../components/Panel";

type TipoEstudio = {
  id: CalcMuestraMacroFamilia;
  label: string;
  resumen: string;
  detalle: string;
  icon: LucideIcon;
  componentes: string[];
  variantes?: { id: CalcMuestraVarianteEstudio; label: string; descripcion: string }[];
  legacy?: boolean;
};

const TIPOS_ESTUDIO: TipoEstudio[] = [
  {
    id: "acreditacion",
    label: "Acreditación universitaria",
    resumen: "Diseño multi-actor con técnica asignada por umbral de marco.",
    detalle:
      "Genera los 4 actores canónicos (administrativos, docentes, estudiantes, egresados) vacíos. El motor asigna técnica y mínimo automáticamente al completar N — umbrales canónicos PUCP Marzo 2026 (250/251 docentes, 3000/3001 estudiantes, 300/301 egresados).",
    icon: Landmark,
    componentes: ["Administrativos · online", "Docentes · online", "Estudiantes · aula QR", "Egresados · telefónico"],
  },
  {
    id: "encuesta_estudiantes",
    label: "Estudiantes universitarios",
    resumen: "Diseño de muestra y selección de aulas para encuestas a estudiantes.",
    detalle:
      "Genera la mesa de estudiantes con marco por dominio, sexo u otras variables de control, lista para construir marco de aulas, calcular escenarios y seleccionar titulares/reemplazos.",
    icon: GraduationCap,
    componentes: ["Estudiantes universitarios · aulas por curso y horario"],
    variantes: [
      { id: "vacio", label: "En blanco", descripcion: "Solo la estructura, tú agregas estratos y N." },
      {
        id: "plantilla_pucp",
        label: "Alias legacy PUCP",
        descripcion: "Carga estratos legacy solo si estas reabriendo un caso antiguo.",
      },
    ],
  },
  {
    id: "linea_base_servicios",
    label: "Servicios / línea de base",
    resumen: "Diseño desde marco operativo: atenciones, servicios, sedes o establecimientos.",
    detalle:
      "Genera 1 componente preparado para estudios ocasionales tipo GIZ, OPS o RET. Si agregas una matriz territorio x servicio, calcula n por territorio y distribuye cuotas operativas por servicio con piso mínimo.",
    icon: Stethoscope,
    componentes: ["Usuarios / atenciones · presencial", "Matriz territorio x servicio opcional"],
  },
  {
    id: "estudio_propio",
    label: "Diseñar desde marco disponible",
    resumen: "Arma una propuesta nueva cuando no hay plantilla conocida.",
    detalle:
      "No crea componentes automáticamente. Tú agregas cada actor o unidad de análisis y defines el cálculo según el marco disponible.",
    icon: Wrench,
    componentes: [],
  },
];

const TERRITORIAL_HANDOFF = {
  label: "Territorial / hogares",
  resumen: "El marco territorial se trabaja en Hojas de Ruta.",
  detalle:
    "Para estudios de hogares, manzanas, zonas o rutas, usa Hojas de Ruta. El calculador no duplica esa lógica territorial.",
  icon: MapPin,
};

const LEGACY_TIPOS: Partial<Record<CalcMuestraMacroFamilia, TipoEstudio>> = {
  listado_telefonico: {
    id: "listado_telefonico",
    label: "Fuera del calculador",
    resumen: "Este estudio parte de base, listado, muestra o meta ya cerrada.",
    detalle:
      "Se conserva por compatibilidad con sesiones antiguas, pero no se ofrece como nuevo flujo. Para una propuesta muestral nueva, elige una plantilla conocida o diseña desde marco disponible.",
    icon: Wrench,
    componentes: [],
    legacy: true,
  },
  territorial: {
    id: "territorial",
    label: TERRITORIAL_HANDOFF.label,
    resumen: TERRITORIAL_HANDOFF.resumen,
    detalle: TERRITORIAL_HANDOFF.detalle,
    icon: MapPin,
    componentes: [],
    legacy: true,
  },
};

const MACRO_FAMILIA_OPTS: { id: CalcMuestraMacroFamilia; label: string; descripcion: string }[] =
  TIPOS_ESTUDIO.map((t) => ({ id: t.id, label: t.label, descripcion: t.resumen }));

export function EstudioPane() {
  const navigate = useNavigate();
  const {
    estudio,
    setTitulo,
    setMacroFamilia,
    setModoSensible,
    setContexto,
    hydrate,
  } = useCalcMuestraStore();

  const [iniciandoTipo, setIniciandoTipo] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [showEthics, setShowEthics] = useState(false);

  const tipoActivo =
    TIPOS_ESTUDIO.find((t) => t.id === estudio.macro_familia) ??
    LEGACY_TIPOS[estudio.macro_familia] ??
    TIPOS_ESTUDIO[0];
  const macroOpts = MACRO_FAMILIA_OPTS.some((o) => o.id === estudio.macro_familia)
    ? MACRO_FAMILIA_OPTS
    : [
        {
          id: estudio.macro_familia,
          label: `${tipoActivo.label} (no disponible para nuevo cálculo)`,
          descripcion: tipoActivo.resumen,
        },
        ...MACRO_FAMILIA_OPTS,
      ];

  async function iniciarEstudio(tipo: CalcMuestraMacroFamilia, variante: CalcMuestraVarianteEstudio = "vacio") {
    const claveLoad = `${tipo}:${variante}`;
    setMensaje(null);
    setIniciandoTipo(claveLoad);
    try {
      const res = await apiCalcMuestraIniciarEstudio(tipo, variante);
      hydrate(res.estudio);
      const n = res.estudio.componentes.length;
      const tipoLabel = TIPOS_ESTUDIO.find((t) => t.id === tipo)?.label ?? tipo;
      if (n === 0) {
        setMensaje(`${tipoLabel}: estudio sin componentes. Agrega cada uno desde la pestaña Componentes.`);
      } else if (variante === "plantilla_pucp") {
        const estratos = res.estudio.componentes[0]?.marco.estratos?.length ?? 0;
        setMensaje(
          `${tipoLabel}: ${n} componente(s) con ${estratos} estratos pre-cargados. Edita lo que necesites.`,
        );
      } else {
        setMensaje(
          `${tipoLabel}: ${n} componente(s) listos. Completa el N de cada uno para que el motor infiera técnica y mínimo.`,
        );
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Error desconocido";
      setMensaje(`Error: ${msg}`);
    } finally {
      setIniciandoTipo(null);
    }
  }

  return (
    <div style={{ display: "grid", gap: 0 }}>
      <Panel
        eyebrow="Datos generales"
        title="Estudio"
        hint="El estudio es el contenedor. Cada componente representa un actor, unidad o subgrupo con su propio cálculo."
      >
        <div style={{ display: "grid", gap: 12 }}>
          <Field label="Título del estudio">
            <input
              type="text"
              value={estudio.titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ej. Acreditación Derecho 2026"
              style={inputStyle}
            />
          </Field>

          <Field label="Cliente / institución">
            <input
              type="text"
              value={estudio.contexto.cliente}
              onChange={(e) => setContexto("cliente", e.target.value)}
              placeholder="Ej. Carrera de Derecho"
              style={inputStyle}
            />
          </Field>

          <Field
            label="Tipo de estudio"
            hint={macroOpts.find((o) => o.id === estudio.macro_familia)?.descripcion}
          >
            <select
              value={estudio.macro_familia}
              onChange={(e) => setMacroFamilia(e.target.value as CalcMuestraMacroFamilia)}
              style={inputStyle}
            >
              {macroOpts.map((o) => (
                <option key={o.id} value={o.id}>{o.label}</option>
              ))}
            </select>
          </Field>

          <div style={{ marginTop: 4 }}>
            <button
              type="button"
              onClick={() => setShowEthics((v) => !v)}
              style={{
                background: "transparent",
                border: "none",
                padding: 0,
                color: "var(--pulso-text-soft)",
                fontSize: 11,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                fontWeight: 600,
              }}
            >
              {showEthics ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              Opciones avanzadas
            </button>
            {showEthics && (
              <label
                style={{
                  display: "flex",
                  gap: 8,
                  alignItems: "flex-start",
                  marginTop: 10,
                  padding: 10,
                  background: "var(--pulso-bg)",
                  border: "1px solid var(--pulso-border)",
                  borderRadius: 6,
                }}
              >
                <input
                  type="checkbox"
                  checked={estudio.modo_sensible}
                  onChange={(e) => setModoSensible(e.target.checked)}
                  style={{ marginTop: 3, accentColor: "var(--pulso-primary)" }}
                />
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--pulso-text)" }}>
                    Estudio con protocolos éticos especiales
                  </div>
                  <div style={{ fontSize: 11, color: "var(--pulso-text-soft)", marginTop: 2, lineHeight: 1.5 }}>
                    Consentimiento informado reforzado, anonimización estricta o rutas de derivación.
                    Se incluye como nota en el reporte metodológico.
                  </div>
                </div>
              </label>
            )}
          </div>
        </div>
      </Panel>

      <Panel
        eyebrow="Iniciar componentes"
        title={`Plantilla: ${tipoActivo.label}`}
        hint="Elige una plantilla conocida o diseña desde el marco disponible."
      >
        <article
          style={{
            padding: 14,
            border: "1px solid var(--pulso-border)",
            borderRadius: 8,
            background: "var(--pulso-surface)",
            display: "grid",
            gap: 12,
          }}
        >
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            <div
              style={{
                background: "var(--pulso-primary-soft)",
                color: "var(--pulso-primary)",
                borderRadius: 8,
                padding: 10,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <tipoActivo.icon size={20} />
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--pulso-text)" }}>
                {tipoActivo.label}
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: "var(--pulso-text-soft)",
                  marginTop: 4,
                  lineHeight: 1.55,
                }}
              >
                {tipoActivo.detalle}
              </div>
              {tipoActivo.componentes.length > 0 && (
                <ul
                  style={{
                    margin: "10px 0 0",
                    padding: "0 0 0 18px",
                    fontSize: 11,
                    color: "var(--pulso-text-soft)",
                    lineHeight: 1.6,
                  }}
                >
                  {tipoActivo.componentes.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {!tipoActivo.legacy && (tipoActivo.variantes ?? [{ id: "vacio", label: "Iniciar estudio", descripcion: "" }]).map((v) => {
              const key = `${tipoActivo.id}:${v.id}`;
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => iniciarEstudio(tipoActivo.id, v.id)}
                  disabled={iniciandoTipo === key}
                  title={v.descripcion}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "8px 14px",
                    fontSize: 12,
                    fontWeight: 700,
                    borderRadius: 8,
                    border: v.id === "plantilla_pucp"
                      ? "1px solid var(--pulso-border)"
                      : "1px solid var(--pulso-primary)",
                    background: v.id === "plantilla_pucp"
                      ? "var(--pulso-surface)"
                      : "var(--pulso-primary)",
                    color: v.id === "plantilla_pucp"
                      ? "var(--pulso-primary)"
                      : "white",
                    cursor: iniciandoTipo === key ? "wait" : "pointer",
                    opacity: iniciandoTipo === key ? 0.6 : 1,
                  }}
                >
                  <Sparkles size={13} />
                  {iniciandoTipo === key ? "Iniciando…" : v.label}
                </button>
              );
            })}
            {tipoActivo.legacy && (
              <button
                type="button"
                onClick={() => setMacroFamilia("estudio_propio")}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "8px 14px",
                  fontSize: 12,
                  fontWeight: 700,
                  borderRadius: 8,
                  border: "1px solid var(--pulso-border)",
                  background: "var(--pulso-surface)",
                  color: "var(--pulso-text)",
                  cursor: "pointer",
                }}
              >
                <Sparkles size={13} />
                Elegir otro flujo
              </button>
            )}
          </div>

          {tipoActivo.variantes && (
            <div
              style={{
                fontSize: 11,
                color: "var(--pulso-text-soft)",
                lineHeight: 1.5,
                background: "var(--pulso-bg)",
                padding: "8px 10px",
                borderRadius: 6,
                border: "1px solid var(--pulso-border)",
              }}
            >
              {tipoActivo.variantes.map((v) => (
                <div key={v.id} style={{ marginBottom: 2 }}>
                  <strong style={{ color: "var(--pulso-text)" }}>{v.label}:</strong> {v.descripcion}
                </div>
              ))}
            </div>
          )}
        </article>

        {mensaje && <MensajeBanner text={mensaje} />}
      </Panel>

      <Panel
        eyebrow="Territorial"
        title={TERRITORIAL_HANDOFF.label}
        hint={TERRITORIAL_HANDOFF.resumen}
      >
        <div
          style={{
            display: "flex",
            gap: 12,
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
          }}
        >
          <div style={{ minWidth: 0, flex: 1, fontSize: 12, color: "var(--pulso-text-soft)", lineHeight: 1.55 }}>
            {TERRITORIAL_HANDOFF.detalle}
          </div>
          <button
            type="button"
            onClick={() => navigate("/hojas-ruta")}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 14px",
              fontSize: 12,
              fontWeight: 700,
              borderRadius: 8,
              border: "1px solid var(--pulso-primary)",
              background: "var(--pulso-primary)",
              color: "white",
              cursor: "pointer",
            }}
          >
            <ExternalLink size={13} />
            Ir a Hojas de Ruta
          </button>
        </div>
      </Panel>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "grid", gap: 4 }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: "var(--pulso-text)", textTransform: "uppercase", letterSpacing: 0.3 }}>
        {label}
      </span>
      {children}
      {hint && (
        <span style={{ fontSize: 11, color: "var(--pulso-text-soft)", lineHeight: 1.4 }}>{hint}</span>
      )}
    </label>
  );
}

const inputStyle: React.CSSProperties = {
  padding: "7px 10px",
  border: "1px solid var(--pulso-border)",
  borderRadius: 6,
  fontSize: 13,
  background: "var(--pulso-surface)",
  color: "var(--pulso-text)",
  width: "100%",
  boxSizing: "border-box",
  fontFamily: "inherit",
};

function MensajeBanner({ text }: { text: string | null }) {
  if (!text) return null;
  const ok = !text.startsWith("Error");
  return (
    <div
      style={{
        marginTop: 10,
        padding: "8px 10px",
        background: ok ? "var(--pulso-success-bg)" : "var(--pulso-danger-bg)",
        color: ok ? "var(--pulso-success-fg)" : "var(--pulso-danger-fg)",
        border: `1px solid ${ok ? "var(--pulso-success-border)" : "var(--pulso-danger-border)"}`,
        borderRadius: 6,
        fontSize: 12,
        lineHeight: 1.5,
      }}
    >
      {text}
    </div>
  );
}
