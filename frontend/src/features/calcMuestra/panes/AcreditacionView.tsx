import { useMemo, useState } from "react";
import {
  GraduationCap,
  Mail,
  Phone,
  Plus,
  School,
  Settings2,
  Trash2,
  User,
  UserCog,
  Users,
  type LucideIcon,
} from "lucide-react";
import type {
  CalcMuestraActorCategoria,
  CalcMuestraCanalRecojo,
  CalcMuestraComponente,
} from "../../../api/client";
import { useCalcMuestraStore } from "../store/calcMuestraStore";
import { Panel } from "../../../components/Panel";

// ---------------------------------------------------------------------------
// Catálogo de actores soportados por Acreditación (cuadro maestro PUCP)
// ---------------------------------------------------------------------------

type ActorAcred = {
  categoria: CalcMuestraActorCategoria;
  label: string;
  actor: string;
  actor_id: string;
  icon: LucideIcon;
  canal_default: CalcMuestraCanalRecojo;
};

const ACTORES: ActorAcred[] = [
  { categoria: "administrativos", label: "Administrativos", actor: "Personal administrativo", actor_id: "administrativos", icon: UserCog, canal_default: "online_email" },
  { categoria: "docentes",        label: "Docentes",         actor: "Docentes",                actor_id: "docentes",        icon: School,  canal_default: "online_email" },
  { categoria: "estudiantes",     label: "Estudiantes",      actor: "Estudiantes pregrado",    actor_id: "estudiantes",     icon: GraduationCap, canal_default: "aula_qr" },
  { categoria: "egresados",       label: "Egresados",        actor: "Egresados",               actor_id: "egresados",       icon: User,    canal_default: "telefonico" },
  { categoria: "empleadores",     label: "Empleadores",      actor: "Empleadores",             actor_id: "empleadores",     icon: Users,   canal_default: "online_email" },
];

const CANAL_LABEL: Record<CalcMuestraCanalRecojo, string> = {
  aula_qr: "Aula con QR",
  telefonico: "Telefónico",
  online_email: "Online · email",
  presencial: "Presencial",
  mixto: "Mixto",
  sin_definir: "Sin definir",
};

const CANAL_ICON: Record<CalcMuestraCanalRecojo, LucideIcon> = {
  aula_qr: GraduationCap,
  telefonico: Phone,
  online_email: Mail,
  presencial: Users,
  mixto: Users,
  sin_definir: Users,
};

// ---------------------------------------------------------------------------
// Inferencia local del cuadro maestro PUCP Marzo 2026 — espejo de
// .cm_inferir_acreditacion() en api/R/calc_muestra_engine.R
// Permite mostrar técnica + mínimo "en vivo" mientras el usuario tipea, sin
// esperar al backend. El backend sigue siendo la verdad oficial al calcular.
// ---------------------------------------------------------------------------

type InferenciaLocal = {
  tecnica_label: string;
  tecnica_tono: "censal" | "cuotas" | "conglomerado" | "conveniencia" | "indef";
  minimo: number | null;
  minimo_label: string;
  regla_corta: string;
  justificacion: string;
};

function inferirLocal(actor: CalcMuestraActorCategoria, canal: CalcMuestraCanalRecojo, N: number): InferenciaLocal {
  if (actor === "administrativos") {
    const min = N > 0 ? Math.ceil(N * 0.8) : null;
    return {
      tecnica_label: "Intención censal",
      tecnica_tono: "censal",
      minimo: min,
      minimo_label: min != null ? `${min.toLocaleString()} (80% de N)` : "—",
      regla_corta: "Cobertura 80%",
      justificacion: "Administrativos: cobertura mínima 80% por alta disponibilidad.",
    };
  }
  if (actor === "docentes") {
    if (N === 0) {
      return {
        tecnica_label: "Pendiente",
        tecnica_tono: "indef",
        minimo: null,
        minimo_label: "—",
        regla_corta: "Define N",
        justificacion: "Ingresa el N de docentes para inferir técnica.",
      };
    }
    if (N <= 250) {
      const min = Math.ceil(N * 0.6);
      return {
        tecnica_label: "Intención censal",
        tecnica_tono: "censal",
        minimo: min,
        minimo_label: `${min.toLocaleString()} (60% de N)`,
        regla_corta: "N ≤ 250 → 60%",
        justificacion: "Docentes con N ≤ 250: cobertura mínima 60%.",
      };
    }
    return {
      tecnica_label: "Cuotas no aleatorias",
      tecnica_tono: "cuotas",
      minimo: 150,
      minimo_label: "150 (mínimo)",
      regla_corta: "N ≥ 251 → 150 cuotas",
      justificacion: "Docentes con N ≥ 251: 150 cuotas con control por dedicación.",
    };
  }
  if (actor === "estudiantes") {
    if (N === 0) {
      return {
        tecnica_label: "Pendiente",
        tecnica_tono: "indef",
        minimo: null,
        minimo_label: "—",
        regla_corta: "Define N",
        justificacion: "Ingresa el N de estudiantes para inferir técnica.",
      };
    }
    if (canal === "aula_qr" && N >= 3001) {
      return {
        tecnica_label: "Conglomerados multietápico",
        tecnica_tono: "conglomerado",
        minimo: 1800,
        minimo_label: "≈ 1,800 base (72 aulas × 25)",
        regla_corta: "N ≥ 3001 + aula → conglomerados",
        justificacion: "Estudiantes con N ≥ 3001 y aulas QR: conglomerados con parámetros canónicos PUCP (p=0.5, e=±2.5%, deff=2).",
      };
    }
    const min = Math.ceil(N * 0.6);
    return {
      tecnica_label: "Intención censal",
      tecnica_tono: "censal",
      minimo: min,
      minimo_label: `${min.toLocaleString()} (60% de N)`,
      regla_corta: "N ≤ 3000 → 60%",
      justificacion: "Estudiantes con N ≤ 3000 (o sin aulas): cobertura mínima 60%.",
    };
  }
  if (actor === "egresados") {
    if (N === 0) {
      return {
        tecnica_label: "Pendiente",
        tecnica_tono: "indef",
        minimo: null,
        minimo_label: "—",
        regla_corta: "Define N",
        justificacion: "Ingresa el N de egresados para inferir técnica.",
      };
    }
    if (N <= 300) {
      const min = Math.ceil(N * 0.5);
      return {
        tecnica_label: "Intención censal",
        tecnica_tono: "censal",
        minimo: min,
        minimo_label: `${min.toLocaleString()} (50% de N)`,
        regla_corta: "N ≤ 300 → 50%",
        justificacion: "Egresados con N ≤ 300: cobertura mínima 50%.",
      };
    }
    const min = Math.max(30, Math.min(Math.ceil(N * 0.5), 150));
    return {
      tecnica_label: "Conveniencia",
      tecnica_tono: "conveniencia",
      minimo: min,
      minimo_label: `${min.toLocaleString()} (clamp 30–150)`,
      regla_corta: "N ≥ 301 → clamp(50%, 30, 150)",
      justificacion: "Egresados con N ≥ 301: regla canónica clamp(N×50%, 30, 150).",
    };
  }
  return {
    tecnica_label: "Conveniencia",
    tecnica_tono: "conveniencia",
    minimo: null,
    minimo_label: "definir manualmente",
    regla_corta: "Sin regla canónica",
    justificacion: "Actor sin regla automática. Define técnica y meta manualmente en el detalle.",
  };
}

// ---------------------------------------------------------------------------
// Vista principal
// ---------------------------------------------------------------------------

export function AcreditacionView({ onAbrirDetalle }: { onAbrirDetalle: (id: string) => void }) {
  const { estudio, upsertComponente, removerComponente } = useCalcMuestraStore();
  const [agregando, setAgregando] = useState(false);

  const actoresPresentes = useMemo(
    () => new Set(estudio.componentes.map((c) => c.actor_id).filter(Boolean)),
    [estudio.componentes],
  );

  const actoresDisponibles = ACTORES.filter((a) => !actoresPresentes.has(a.actor_id));

  function actualizarN(comp: CalcMuestraComponente, N: number) {
    upsertComponente({
      ...comp,
      marco: {
        ...comp.marco,
        universo_bruto: N,
        marco_validado: N,
        marco_contactable: N,
        estado: N > 0 ? "validado" : "no_definido",
      },
    });
  }

  function actualizarCanal(comp: CalcMuestraComponente, canal: CalcMuestraCanalRecojo) {
    upsertComponente({ ...comp, canal_recojo: canal });
  }

  function agregarActor(a: ActorAcred) {
    setAgregando(false);
    const id = `cmp-${Math.random().toString(36).slice(2, 10)}`;
    upsertComponente({
      id,
      actor: a.actor,
      actor_id: a.actor_id,
      actor_categoria: a.categoria,
      canal_recojo: a.canal_default,
      tecnica: "intencion_censal",
      naturaleza: "operativo",
      origen_tamano: "cobertura_esperada",
      nivel_respaldo: "representatividad_operacional",
      marco: { universo_bruto: 0, marco_validado: 0, marco_contactable: 0, estado: "no_definido", notas: "" },
      parametros: {
        z: 1.96, p: 0.5, e: 0.05, deff: 1.5, tau: 0.7, oversample_pct: 0.1,
        tasa_contacto: 0.5, tasa_elegibilidad: 0.9, tasa_respuesta: 0.6,
        cobertura_objetivo: 0.5, promedio_conglomerado: 25,
        n_minimo_estrato: 30, tope_operativo: 150,
      },
      meta: { tipo: "objetivo", valor: 0, variable_control: "", sub_cuotas: {} },
    });
  }

  return (
    <Panel
      eyebrow="Acreditación universitaria · cuadro maestro PUCP"
      title="Actores del estudio"
      hint="Completa el N de marco validado para cada actor. El sistema infiere automáticamente la técnica y el mínimo a cumplir según el cuadro maestro Marzo 2026. Usa 'Refinar' para abrir el detalle con parámetros avanzados."
      actions={
        actoresDisponibles.length > 0 ? (
          <div style={{ position: "relative" }}>
            <button
              type="button"
              onClick={() => setAgregando((v) => !v)}
              className="cm-acr-btn-add"
            >
              <Plus size={14} />
              Agregar actor
            </button>
            {agregando && (
              <div className="cm-acr-add-menu">
                {actoresDisponibles.map((a) => {
                  const Icon = a.icon;
                  return (
                    <button
                      key={a.actor_id}
                      type="button"
                      onClick={() => agregarActor(a)}
                      className="cm-acr-add-menu-item"
                    >
                      <Icon size={14} /> {a.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ) : null
      }
    >
      <div className="cm-acr-grid">
        {estudio.componentes.map((comp) => {
          const N = comp.marco?.marco_validado ?? 0;
          const inf = inferirLocal(comp.actor_categoria, comp.canal_recojo, N);
          const cat = ACTORES.find((a) => a.actor_id === comp.actor_id);
          const Icon = cat?.icon ?? Users;
          const CanalIcon = CANAL_ICON[comp.canal_recojo] ?? Users;
          const calculado = typeof comp.resultado?.n_objetivo === "number" && Number.isFinite(comp.resultado.n_objetivo);
          return (
            <article key={comp.id} className={`cm-acr-card cm-acr-tono-${inf.tecnica_tono}`}>
              <header className="cm-acr-card-head">
                <div className="cm-acr-card-icon">
                  <Icon size={20} />
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <h3 className="cm-acr-card-title">{comp.actor}</h3>
                  <div className="cm-acr-card-canal">
                    <CanalIcon size={11} />
                    <select
                      value={comp.canal_recojo}
                      onChange={(e) => actualizarCanal(comp, e.target.value as CalcMuestraCanalRecojo)}
                      className="cm-acr-canal-select"
                      aria-label={`Canal de recojo para ${comp.actor}`}
                    >
                      {Object.entries(CANAL_LABEL).map(([id, label]) => (
                        <option key={id} value={id}>{label}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (confirm(`¿Eliminar el componente "${comp.actor}"?`)) removerComponente(comp.id);
                  }}
                  className="cm-acr-btn-del"
                  aria-label={`Eliminar ${comp.actor}`}
                >
                  <Trash2 size={13} />
                </button>
              </header>

              <div className="cm-acr-card-body">
                <label className="cm-acr-field">
                  <span>Marco validado (N)</span>
                  <input
                    type="number"
                    min={0}
                    value={N || ""}
                    placeholder="0"
                    onChange={(e) => actualizarN(comp, Number(e.target.value) || 0)}
                    className="cm-acr-input-n"
                  />
                </label>

                <div className="cm-acr-rule">
                  <div className="cm-acr-rule-label">Técnica inferida</div>
                  <div className={`cm-acr-rule-badge cm-acr-tono-${inf.tecnica_tono}`}>
                    {inf.tecnica_label}
                  </div>
                  <div className="cm-acr-rule-detail">{inf.regla_corta}</div>
                </div>

                <div className="cm-acr-min">
                  <div className="cm-acr-min-label">Mínimo a cumplir</div>
                  <div className="cm-acr-min-value">{inf.minimo_label}</div>
                  {calculado && comp.resultado?.n_objetivo !== inf.minimo && (
                    <div className="cm-acr-min-calc">
                      Cálculo backend: {comp.resultado!.n_objetivo!.toLocaleString()}
                    </div>
                  )}
                </div>
              </div>

              <footer className="cm-acr-card-foot">
                <p className="cm-acr-card-just">{inf.justificacion}</p>
                <button
                  type="button"
                  onClick={() => onAbrirDetalle(comp.id)}
                  className="cm-acr-btn-detail"
                  title="Abrir detalle para editar parámetros avanzados"
                >
                  <Settings2 size={12} />
                  Refinar
                </button>
              </footer>
            </article>
          );
        })}

        {estudio.componentes.length === 0 && (
          <div className="cm-acr-empty">
            No hay actores en el estudio. Agrega al menos uno con el botón "Agregar actor".
          </div>
        )}
      </div>
    </Panel>
  );
}
