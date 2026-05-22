import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  ExternalLink,
  GraduationCap,
  Landmark,
  MapPin,
  Stethoscope,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import {
  apiCalcMuestraIniciarEstudio,
  type CalcMuestraEstudio,
  type CalcMuestraMacroFamilia,
  type CalcMuestraVarianteEstudio,
} from "../../../api/client";

type TipoCard = {
  id?: CalcMuestraMacroFamilia;
  label: string;
  pitch: string;
  detalle: string;
  icon: LucideIcon;
  action: "iniciar" | "handoff";
  cta: string;
  variante?: CalcMuestraVarianteEstudio;
  varianteSubLabel?: string;
};

const TIPOS: TipoCard[] = [
  {
    id: "acreditacion",
    label: "Acreditación universitaria",
    pitch: "Multi-actor: administrativos, docentes, estudiantes y egresados con técnica asignada por umbral.",
    detalle:
      "Aplica el cuadro maestro PUCP Marzo 2026. El sistema asigna técnica y mínimo automáticamente según el N de cada actor (cortes 250/251 docentes, 3000/3001 estudiantes, 300/301 egresados).",
    icon: Landmark,
    action: "iniciar",
    cta: "Usar plantilla",
  },
  {
    id: "hsvg_universitario",
    label: "Estudiantes universitarios",
    pitch: "Marco por facultad y sexo para estudios de opinión estudiantil universitaria.",
    detalle:
      "Diseño probabilístico con parámetros canónicos (p, e, deff, sobremuestra). Permite trabajar representatividad a nivel universidad y a nivel facultad, con el marco DTI 2025-II de PUCP como punto de partida.",
    icon: GraduationCap,
    action: "iniciar",
    cta: "Usar plantilla",
    variante: "plantilla_pucp",
    varianteSubLabel: "Pre-cargar marco PUCP 2026 (15 facultades)",
  },
  {
    id: "linea_base_servicios",
    label: "Servicios / línea de base",
    pitch: "Diseño desde marco operativo: atenciones, servicios, sedes o establecimientos.",
    detalle:
      "Para estudios ocasionales tipo GIZ, OPS o RET. Permite calcular n por territorio y distribuir cuotas por servicio cuando el marco son volúmenes operativos.",
    icon: Stethoscope,
    action: "iniciar",
    cta: "Diseñar desde matriz",
  },
  {
    id: "estudio_propio",
    label: "Diseñar desde marco disponible",
    pitch: "Para estudios nuevos que no encajan en una plantilla conocida.",
    detalle:
      "Empieza sin componentes y arma la propuesta desde unidad de análisis, marco, técnica y distribución. Útil para convocatorias ocasionales con marcos variables.",
    icon: Wrench,
    action: "iniciar",
    cta: "Armar desde cero",
  },
  {
    label: "Territorial / hogares",
    pitch: "El marco territorial, zonas y rutas se trabajan en Hojas de Ruta.",
    detalle:
      "Este calculador no duplica el diseño territorial. Para hogares o manzanas, entra a Hojas de Ruta y usa allí el cálculo y la selección de campo.",
    icon: MapPin,
    action: "handoff",
    cta: "Ir a Hojas de Ruta",
  },
];

export function OnboardingTipoEstudio({
  onIniciado,
}: {
  onIniciado: (estudio: CalcMuestraEstudio) => void;
}) {
  const navigate = useNavigate();
  const [iniciando, setIniciando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function iniciar(tipo: CalcMuestraMacroFamilia, variante: CalcMuestraVarianteEstudio = "vacio") {
    const clave = `${tipo}:${variante}`;
    setIniciando(clave);
    setError(null);
    try {
      const res = await apiCalcMuestraIniciarEstudio(tipo, variante);
      onIniciado(res.estudio);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error desconocido");
    } finally {
      setIniciando(null);
    }
  }

  return (
    <section className="cm-onboarding">
      <header className="cm-onboarding-head">
        <div className="cm-onboarding-eyebrow">Nuevo estudio</div>
        <h2 className="cm-onboarding-title">¿Qué tipo de estudio vas a diseñar?</h2>
        <p className="cm-onboarding-lead">
          Elige la macro-familia que corresponde al estudio. Cada tipo carga una estructura distinta de
          componentes y aplica la regla canónica del compendio metodológico PULSO. Puedes cambiar el tipo
          después; el contenido del estudio actual se reemplaza.
        </p>
      </header>

      {error && <div className="cm-onboarding-error">{error}</div>}

      <div className="cm-onboarding-grid">
        {TIPOS.map((t) => {
          const baseClave = t.id ? `${t.id}:vacio` : null;
          const varClave = t.id && t.variante ? `${t.id}:${t.variante}` : null;
          const cargando = iniciando === baseClave || iniciando === varClave;
          const Icon = t.icon;
          return (
            <article key={t.id} className={`cm-onboarding-card${cargando ? " is-loading" : ""}`}>
              <div className="cm-onboarding-card-head">
                <div className="cm-onboarding-card-icon">
                  <Icon size={22} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <h3 className="cm-onboarding-card-title">{t.label}</h3>
                  <p className="cm-onboarding-card-pitch">{t.pitch}</p>
                </div>
              </div>
              <p className="cm-onboarding-card-detail">{t.detalle}</p>
              <div className="cm-onboarding-card-actions">
                <button
                  type="button"
                  onClick={() => {
                    if (t.action === "handoff") {
                      navigate("/hojas-ruta");
                      return;
                    }
                    if (t.id) void iniciar(t.id, "vacio");
                  }}
                  disabled={!!iniciando}
                  className="cm-onboarding-btn-primary"
                >
                  {baseClave && iniciando === baseClave ? "Iniciando…" : t.cta}
                  {t.action === "handoff" ? <ExternalLink size={14} /> : <ArrowRight size={14} />}
                </button>
                {t.variante && (
                  <button
                    type="button"
                    onClick={() => t.id && iniciar(t.id, t.variante!)}
                    disabled={!!iniciando}
                    className="cm-onboarding-btn-ghost"
                    title={t.varianteSubLabel}
                  >
                    {iniciando === varClave ? "Cargando…" : t.varianteSubLabel}
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
