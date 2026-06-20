import { Plus, Trash2 } from "lucide-react";
import { useCalcMuestraStore } from "../store/calcMuestraStore";
import type {
  CalcMuestraActorCategoria,
  CalcMuestraCanalRecojo,
  CalcMuestraComponente,
  CalcMuestraMacroFamilia,
  CalcMuestraTecnica,
} from "../../../api/client";
import { Panel } from "../../../components/Panel";
import { NaturalezaBadge } from "../components/Badges";

const TECNICAS_DISPONIBLES: { id: CalcMuestraTecnica; label: string; fase: 1 | 2 }[] = [
  { id: "prob_aleatorio_simple", label: "Muestreo aleatorio simple (MAS)", fase: 1 },
  { id: "prob_conglomerado_multietapico", label: "Conglomerados multietápico", fase: 1 },
  { id: "intencion_censal", label: "Intención censal", fase: 1 },
  { id: "barrido", label: "Barrido operativo", fase: 1 },
  { id: "no_prob_cuotas", label: "Cuotas no probabilísticas", fase: 1 },
  { id: "no_prob_conveniencia", label: "Conveniencia", fase: 1 },
  { id: "prob_estratificado", label: "Estratificado (próximamente)", fase: 2 },
  { id: "sistematico", label: "Sistemático (próximamente)", fase: 2 },
  { id: "medicion_recurrente", label: "Medición recurrente (próximamente)", fase: 2 },
];

function generarId() {
  return `cmp-${Math.random().toString(36).slice(2, 10)}`;
}

type PlantillaComponente = {
  label: string;
  actor: string;
  actor_id: string;
  actor_categoria: CalcMuestraActorCategoria;
  canal_recojo: CalcMuestraCanalRecojo;
  tecnica: CalcMuestraTecnica;
};

const PLANTILLAS_VACIAS: PlantillaComponente = {
  label: "Componente",
  actor: "Componente nuevo",
  actor_id: "",
  actor_categoria: "otros",
  canal_recojo: "sin_definir",
  tecnica: "intencion_censal",
};

const PLANTILLAS_POR_TIPO: Record<CalcMuestraMacroFamilia, PlantillaComponente[]> = {
  acreditacion: [
    {
      label: "Administrativos",
      actor: "Personal administrativo",
      actor_id: "administrativos",
      actor_categoria: "administrativos",
      canal_recojo: "online_email",
      tecnica: "intencion_censal",
    },
    {
      label: "Docentes",
      actor: "Docentes",
      actor_id: "docentes",
      actor_categoria: "docentes",
      canal_recojo: "online_email",
      tecnica: "intencion_censal",
    },
    {
      label: "Estudiantes",
      actor: "Estudiantes pregrado",
      actor_id: "estudiantes",
      actor_categoria: "estudiantes",
      canal_recojo: "aula_qr",
      tecnica: "intencion_censal",
    },
    {
      label: "Egresados",
      actor: "Egresados",
      actor_id: "egresados",
      actor_categoria: "egresados",
      canal_recojo: "telefonico",
      tecnica: "intencion_censal",
    },
    {
      label: "Empleadores",
      actor: "Empleadores",
      actor_id: "empleadores",
      actor_categoria: "empleadores",
      canal_recojo: "online_email",
      tecnica: "no_prob_conveniencia",
    },
  ],
  encuesta_estudiantes: [
    {
      label: "Estudiantes universitarios",
      actor: "Estudiantes universitarios",
      actor_id: "estudiantes",
      actor_categoria: "estudiantes",
      canal_recojo: "aula_qr",
      tecnica: "prob_conglomerado_multietapico",
    },
    {
      label: "Docentes",
      actor: "Docentes",
      actor_id: "docentes",
      actor_categoria: "docentes",
      canal_recojo: "online_email",
      tecnica: "intencion_censal",
    },
    {
      label: "Administrativos",
      actor: "Personal administrativo",
      actor_id: "administrativos",
      actor_categoria: "administrativos",
      canal_recojo: "online_email",
      tecnica: "intencion_censal",
    },
  ],
  hsvg_universitario: [
    {
      label: "Estudiantes universitarios",
      actor: "Estudiantes universitarios",
      actor_id: "estudiantes",
      actor_categoria: "estudiantes",
      canal_recojo: "aula_qr",
      tecnica: "prob_conglomerado_multietapico",
    },
    {
      label: "Docentes",
      actor: "Docentes",
      actor_id: "docentes",
      actor_categoria: "docentes",
      canal_recojo: "online_email",
      tecnica: "intencion_censal",
    },
    {
      label: "Administrativos",
      actor: "Personal administrativo",
      actor_id: "administrativos",
      actor_categoria: "administrativos",
      canal_recojo: "online_email",
      tecnica: "intencion_censal",
    },
  ],
  territorial: [
    {
      label: "Hogares",
      actor: "Hogares",
      actor_id: "hogares",
      actor_categoria: "otros",
      canal_recojo: "presencial",
      tecnica: "prob_conglomerado_multietapico",
    },
    {
      label: "Personas adultas",
      actor: "Personas adultas",
      actor_id: "personas",
      actor_categoria: "otros",
      canal_recojo: "presencial",
      tecnica: "prob_conglomerado_multietapico",
    },
  ],
  linea_base_servicios: [
    {
      label: "Usuarios / atenciones",
      actor: "Usuarios / atenciones de servicios",
      actor_id: "usuarios",
      actor_categoria: "otros",
      canal_recojo: "presencial",
      tecnica: "prob_aleatorio_simple",
    },
    {
      label: "Personal",
      actor: "Personal del servicio",
      actor_id: "personal",
      actor_categoria: "otros",
      canal_recojo: "presencial",
      tecnica: "intencion_censal",
    },
  ],
  listado_telefonico: [],
  estudio_propio: [],
};

function nuevoComponente(tpl: PlantillaComponente = PLANTILLAS_VACIAS): CalcMuestraComponente {
  return {
    id: generarId(),
    actor: tpl.actor,
    actor_id: tpl.actor_id,
    actor_categoria: tpl.actor_categoria,
    canal_recojo: tpl.canal_recojo,
    tecnica: tpl.tecnica,
    naturaleza: "operativo",
    origen_tamano: "cobertura_esperada",
    nivel_respaldo: "representatividad_operacional",
    marco: {
      universo_bruto: 0,
      marco_validado: 0,
      marco_contactable: 0,
      estado: "no_definido",
      notas: "",
    },
    parametros: {
      z: 1.96, p: 0.5, e: 0.05, deff: 1.5, tau: 0.7, oversample_pct: 0.1,
      tasa_contacto: 0.5, tasa_elegibilidad: 0.9, tasa_respuesta: 0.6,
      cobertura_objetivo: 0.5, promedio_conglomerado: 25,
      n_minimo_estrato: 30, tope_operativo: 150,
    },
    meta: { tipo: "objetivo", valor: 0, variable_control: "", sub_cuotas: {} },
  };
}

export function ComponentesPane() {
  const {
    estudio,
    componenteActivoId,
    setComponenteActivo,
    upsertComponente,
    removerComponente,
  } = useCalcMuestraStore();

  const plantillas = PLANTILLAS_POR_TIPO[estudio.macro_familia] ?? [];

  function agregarComponente(tpl: PlantillaComponente = PLANTILLAS_VACIAS) {
    const comp = nuevoComponente(tpl);
    upsertComponente(comp);
    setComponenteActivo(comp.id);
  }

  const idsExistentes = new Set(estudio.componentes.map((c) => c.actor_id).filter(Boolean));

  return (
    <Panel
      eyebrow="Estudio multi-componente"
      title="Componentes"
      hint="Cada componente representa un actor o subgrupo con su propio diseño muestral. Un estudio puede combinar técnicas distintas según el marco disponible."
      actions={
        <button
          type="button"
          onClick={() => agregarComponente()}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "6px 10px",
            fontSize: 12,
            fontWeight: 700,
            borderRadius: 8,
            border: "1px solid var(--pulso-border)",
            background: "var(--pulso-surface)",
            color: "var(--pulso-text)",
            cursor: "pointer",
          }}
          title="Agregar componente vacío"
        >
          <Plus size={14} />
          Componente vacío
        </button>
      }
    >
      {plantillas.length > 0 && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 6,
            marginBottom: 12,
            padding: "10px 12px",
            background: "var(--pulso-bg)",
            border: "1px solid var(--pulso-border)",
            borderRadius: 8,
          }}
        >
          <span
            style={{
              fontSize: 10,
              fontWeight: 800,
              color: "var(--pulso-text-soft)",
              textTransform: "uppercase",
              letterSpacing: 0.4,
              alignSelf: "center",
              marginRight: 4,
            }}
          >
            Agregar rápido:
          </span>
          {plantillas.map((tpl) => {
            const yaExiste = tpl.actor_id !== "" && idsExistentes.has(tpl.actor_id);
            return (
              <button
                key={tpl.label}
                type="button"
                onClick={() => agregarComponente(tpl)}
                disabled={yaExiste}
                title={
                  yaExiste
                    ? `Ya existe un componente "${tpl.actor}". Crearás otro.`
                    : `Crear componente "${tpl.actor}" (${tpl.canal_recojo.replace("_", " ")})`
                }
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  padding: "5px 10px",
                  fontSize: 11,
                  fontWeight: 700,
                  borderRadius: 6,
                  border: "1px solid var(--pulso-primary)",
                  background: yaExiste ? "var(--pulso-surface)" : "var(--pulso-primary)",
                  color: yaExiste ? "var(--pulso-text-soft)" : "white",
                  cursor: yaExiste ? "default" : "pointer",
                  opacity: yaExiste ? 0.55 : 1,
                }}
              >
                <Plus size={11} />
                {tpl.label}
                {yaExiste && <span style={{ fontSize: 9, marginLeft: 2 }}>✓</span>}
              </button>
            );
          })}
        </div>
      )}

      {estudio.componentes.length === 0 ? (
        <div
          style={{
            padding: "28px 24px",
            background: "var(--pulso-primary-soft)",
            border: "1px dashed var(--pulso-primary-border)",
            borderRadius: 10,
            textAlign: "center",
            color: "var(--pulso-text)",
            fontSize: 13,
            display: "grid",
            gap: 10,
            justifyItems: "center",
          }}
        >
          <Plus size={28} color="var(--pulso-primary)" />
          <div style={{ fontWeight: 800, fontSize: 14, color: "var(--pulso-primary)" }}>
            Aún no hay componentes
          </div>
          <p style={{ margin: 0, color: "var(--pulso-text-soft)", lineHeight: 1.55, maxWidth: 460 }}>
            {plantillas.length > 0
              ? "Usa los botones de arriba para agregar los actores del tipo de estudio o vuelve a la pestaña Estudio para iniciar con la plantilla completa."
              : "Agrega un componente vacío y configura actor, canal y técnica desde el editor."}
          </p>
          <button
            type="button"
            onClick={() => agregarComponente()}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 14px",
              fontSize: 13,
              fontWeight: 700,
              borderRadius: 8,
              border: "1px solid var(--pulso-primary)",
              background: "var(--pulso-primary)",
              color: "white",
              cursor: "pointer",
              marginTop: 4,
            }}
          >
            <Plus size={14} />
            Componente vacío
          </button>
        </div>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 6 }}>
          {estudio.componentes.map((comp) => {
            const active = comp.id === componenteActivoId;
            const tecnica = TECNICAS_DISPONIBLES.find((t) => t.id === comp.tecnica)?.label ?? comp.tecnica;
            return (
              <li key={comp.id}>
                <div
                  onClick={() => setComponenteActivo(comp.id)}
                  style={{
                    padding: "10px 12px",
                    border: "1px solid",
                    borderColor: active ? "var(--pulso-primary)" : "var(--pulso-border)",
                    borderRadius: 8,
                    background: active ? "var(--pulso-primary-soft)" : "var(--pulso-surface)",
                    cursor: "pointer",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  <div style={{ display: "grid", gap: 4, minWidth: 0 }}>
                    <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                      <strong style={{ fontSize: 13, color: "var(--pulso-primary)" }}>{comp.actor}</strong>
                      <NaturalezaBadge naturaleza={comp.naturaleza} />
                    </div>
                    <div style={{ fontSize: 11, color: "var(--pulso-text-soft)" }}>
                      {tecnica}
                      {typeof comp.marco?.marco_validado === "number" && comp.marco.marco_validado > 0 && (
                        <span> · N = {comp.marco.marco_validado.toLocaleString()}</span>
                      )}
                      {typeof comp.resultado?.n_objetivo === "number" && Number.isFinite(comp.resultado.n_objetivo) && (
                        <span> · n objetivo = {comp.resultado.n_objetivo.toLocaleString()}</span>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`¿Eliminar el componente "${comp.actor}"?`)) {
                        removerComponente(comp.id);
                      }
                    }}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      padding: "5px 9px",
                      fontSize: 11,
                      fontWeight: 600,
                      borderRadius: 6,
                      border: "1px solid var(--pulso-border)",
                      background: "var(--pulso-surface)",
                      color: "var(--pulso-danger-fg)",
                      cursor: "pointer",
                    }}
                    aria-label={`Eliminar ${comp.actor}`}
                  >
                    <Trash2 size={12} />
                    Eliminar
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

export { TECNICAS_DISPONIBLES };
