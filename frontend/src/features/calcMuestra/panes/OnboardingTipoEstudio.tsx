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
    pitch: "Para escuchar a administrativos, docentes, estudiantes y egresados sin perder ningún grupo clave.",
    detalle:
      "La mesa propone metas por actor y canal. Si necesitas defender el diseño, deja disponible el criterio que explica cada mínimo.",
    icon: Landmark,
    action: "iniciar",
    cta: "Usar plantilla",
  },
  {
    id: "encuesta_estudiantes",
    label: "Estudiantes universitarios",
    pitch: "Para pasar de una base de estudiantes a cuotas y aulas concretas para visitar.",
    detalle:
      "Primero ordena la base institucional, luego calcula la muestra y finalmente prepara aulas titulares y reservas para el seguimiento de campo.",
    icon: GraduationCap,
    action: "iniciar",
    cta: "Usar plantilla",
    variante: "vacio",
    varianteSubLabel: "Base madre o dos bases institucionales",
  },
  {
    id: "linea_base_servicios",
    label: "Servicios / línea de base",
    pitch: "Para estudios que parten de atenciones, servicios, sedes o establecimientos.",
    detalle:
      "Permite calcular cuántos casos necesitas y cómo repartirlos cuando el marco viene de registros operativos o volúmenes de atención.",
    icon: Stethoscope,
    action: "iniciar",
    cta: "Diseñar desde matriz",
  },
  {
    id: "estudio_propio",
    label: "Diseñar desde marco disponible",
    pitch: "Para estudios nuevos que no encajan en una plantilla ya preparada.",
    detalle:
      "Empieza por aclarar a quién representa el estudio, qué información existe y qué resultado necesita el equipo.",
    icon: Wrench,
    action: "iniciar",
    cta: "Armar desde cero",
  },
  {
    label: "Territorial / hogares",
    pitch: "El marco territorial, zonas y rutas se trabajan en Hojas de Ruta.",
    detalle:
      "Para hogares o manzanas, entra a Hojas de Ruta. Allí se resuelven zonas, recorridos, viviendas, reemplazos y salida de campo.",
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
          Elige el camino que mejor representa el estudio. Cada camino abre una mesa distinta: primero
          explica la decisión en simple, luego muestra los controles técnicos y finalmente deja el respaldo
          metodológico. Si necesitas otro camino más adelante, inicia una selección nueva para no mezclar avances.
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
