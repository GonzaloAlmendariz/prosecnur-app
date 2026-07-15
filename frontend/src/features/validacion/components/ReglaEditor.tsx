import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, ChevronLeft, ChevronRight, Save, X as XIcon } from "lucide-react";
import {
  apiV2ExplorarValores,
  type ExplorarValoresResult,
} from "../../../api/client";
import type {
  ExploradorVariable,
  ExploradorVariablesList,
  ReglaCustom,
  ReglaCustomHallazgoKind,
  ReglaTreatmentActionType,
  ReglaTreatmentScope,
  ReglaCustomTipo,
  ReglaGateCondition,
} from "../types";
import { RuleNarrative } from "./v2";
import type { VariableHoverData } from "./v2";
import { draftCustomToRule } from "../customRuleNarrative";

// =============================================================================
// ReglaEditor — wizard de 3 pasos para crear / editar una ReglaCustom
// =============================================================================
//  Paso 1: Criterio de revisión de campo.
//  Paso 2: Variable(s) involucrada(s).
//  Paso 3: Parámetros específicos del tipo + nombre + mensaje.
//
// Onsubmit entrega un payload listo para POST /api/validacion/v2/reglas_custom
// o PUT /.../<id> (si inicial trae id).

type Props = {
  inv: ExploradorVariablesList;
  baseNombre?: string | null;
  inicial?: ReglaCustom | null;
  onSubmit: (payload: Omit<ReglaCustom, "id" | "created_at"> & { id?: string }) => Promise<void>;
  onCancel: () => void;
};

type TipoMeta = {
  key: ReglaCustomTipo;
  label: string;
  descripcion: string;
  nVars: number | [number, number];
  grupo: "respuesta" | "coherencia" | "seleccion";
  pregunta: string;
  ejemplo: string;
  resultado: string;
  variableHint: string;
  badge?: string;
  legacyHidden?: boolean;
};

const TIPOS: TipoMeta[] = [
  {
    key: "no_nulo",
    label: "Respuesta obligatoria",
    descripcion: "Encuentra respuestas vacías donde esperas una respuesta.",
    nVars: 1,
    grupo: "respuesta",
    pregunta: "¿Esta pregunta debe tener respuesta cuando aplica?",
    ejemplo: "Ej. si la persona aceptó participar, el consentimiento no puede quedar vacío.",
    resultado: "Detecta vacíos para tratamiento posterior.",
    variableHint: "Elige la pregunta que no debería quedar vacía.",
    badge: "Completitud",
    legacyHidden: true,
  },
  {
    key: "rango_num",
    label: "Duración o métrica sospechosa",
    descripcion: "Encuentra tiempos, conteos o métricas operativas que merecen revisión.",
    nVars: 1,
    grupo: "respuesta",
    pregunta: "¿La entrevista fue demasiado corta o una métrica operativa no parece plausible?",
    ejemplo: "Ej. encuesta cerrada en 2 minutos, número de visitas improbable o cantidad operativa fuera de lo esperable.",
    resultado: "Detecta registros fuera de un umbral operativo.",
    variableHint: "Elige duración, conteo o una variable operativa numérica.",
    badge: "Operativo",
  },
  {
    key: "rango_fecha",
    label: "Fecha fuera del operativo",
    descripcion: "Encuentra fechas que no pertenecen al periodo real de levantamiento.",
    nVars: 1,
    grupo: "respuesta",
    pregunta: "¿La fecha cae fuera de las fechas esperadas del trabajo de campo?",
    ejemplo: "Ej. fecha de encuesta antes del inicio del operativo o después del cierre.",
    resultado: "Detecta fechas fuera del periodo definido.",
    variableHint: "Elige la fecha de entrevista, envío, registro u otra fecha operativa.",
    badge: "Operativo",
  },
  {
    key: "outliers_iqr",
    label: "Outliers (IQR)",
    descripcion: "Alerta valores extremos respecto a la distribución de la variable.",
    nVars: 1,
    grupo: "respuesta",
    pregunta: "¿Qué valores extremos deben aparecer como señal?",
    ejemplo: "Ej. ingresos muy alejados del resto de respuestas.",
    resultado: "Detecta outliers estadísticos para análisis avanzado.",
    variableHint: "Elige una pregunta numérica.",
    legacyHidden: true,
  },
  {
    key: "outliers_z",
    label: "Outliers (Z-score)",
    descripcion: "Alerta valores muy alejados del comportamiento histórico.",
    nVars: 1,
    grupo: "respuesta",
    pregunta: "¿Qué valores con z-score alto deben aparecer como señal?",
    ejemplo: "Ej. conteos muy alejados de la media.",
    resultado: "Detecta outliers estadísticos para análisis avanzado.",
    variableHint: "Elige una pregunta numérica.",
    legacyHidden: true,
  },
  {
    key: "duplicados",
    label: "Duplicados operativos",
    descripcion: "Encuentra personas o casos que parecen repetidos por identificadores prácticos.",
    nVars: [1, 5],
    grupo: "coherencia",
    pregunta: "¿Hay casos que parecen la misma persona, hogar o atención?",
    ejemplo: "Ej. mismo documento, mismo teléfono o misma combinación de identificadores.",
    resultado: "Detecta filas candidatas para excluir o documentar.",
    variableHint: "Elige una o más columnas que juntas identifican un caso.",
    badge: "Duplicados",
  },
  {
    key: "fuera_catalogo",
    label: "Respuesta fuera de lista",
    descripcion: "Encuentra valores que no pertenecen al catálogo permitido.",
    nVars: 1,
    grupo: "respuesta",
    pregunta: "¿La respuesta debe estar dentro de una lista cerrada?",
    ejemplo: "Ej. distrito, estado o código que no existe en el catálogo.",
    resultado: "Detecta valores para recodificar por mapa o corregir.",
    variableHint: "Elige la pregunta con catálogo cerrado.",
    badge: "Catálogo",
    legacyHidden: true,
  },
  {
    key: "coherencia_2v",
    label: "Coherencia o plausibilidad contextual",
    descripcion: "Compara respuestas que deben tener sentido juntas dentro del operativo.",
    nVars: 2,
    grupo: "coherencia",
    pregunta: "¿Una respuesta vuelve sospechosa otra respuesta?",
    ejemplo: "Ej. marcó “Solo fui una vez” pero reportó todos los servicios, o tiene menos de 60 y marca atención OMAPED.",
    resultado: "Detecta registros para limpieza o transformación.",
    variableHint: "Elige la variable de contexto y la variable objetivo.",
    badge: "Plausibilidad",
  },
  {
    key: "select_multiple_hierarchy",
    label: "Completar opciones asumidas",
    descripcion: "Encuentra selección múltiple donde falta una opción que debería acompañar a otra.",
    nVars: 1,
    grupo: "seleccion",
    pregunta: "¿Marcar una opción implica que otras también deberían estar marcadas?",
    ejemplo: "Ej. si marcó “Magíster”, quizá también debe marcar “Bachiller” y “Titulado/a”.",
    resultado: "Detecta candidatos para completar jerarquías desde Limpieza.",
    variableHint: "Elige la pregunta de selección múltiple que necesita un mapa manual.",
    badge: "Selección múltiple",
  },
  {
    key: "select_multiple_exclusive",
    label: "Opciones incompatibles",
    descripcion: "Encuentra opciones de selección múltiple que no deberían marcarse juntas.",
    nVars: 1,
    grupo: "seleccion",
    pregunta: "¿Hay opciones que excluyen a las demás?",
    ejemplo: "Ej. “Ninguno” marcado junto con servicios específicos.",
    resultado: "Detecta candidatos para quitar opciones, anular campos o documentar.",
    variableHint: "Elige la pregunta de selección múltiple y luego indica las opciones excluyentes.",
    badge: "Exclusividad",
  },
  {
    key: "select_multiple_cardinality",
    label: "Cantidad de opciones marcada",
    descripcion: "Encuentra respuestas con demasiadas o muy pocas opciones elegidas.",
    nVars: 1,
    grupo: "seleccion",
    pregunta: "¿La persona no debería marcar tantas o tan pocas opciones?",
    ejemplo: "Ej. si fue una sola vez, revisar cuando aparecen 8 servicios marcados.",
    resultado: "Detecta respuestas con demasiadas o muy pocas opciones marcadas.",
    variableHint: "Elige la pregunta de selección múltiple y define mínimo o máximo.",
    badge: "Cantidad",
  },
  {
    key: "select_multiple_selection",
    label: "Opciones esperadas o prohibidas",
    descripcion: "Encuentra respuestas que deberían incluir o evitar ciertas opciones.",
    nVars: 1,
    grupo: "seleccion",
    pregunta: "¿Qué opciones específicas deben generar una señal?",
    ejemplo: "Ej. debe contener “servicio principal” o no debe contener “otro”.",
    resultado: "Detecta registros para ajustar selección múltiple o documentar.",
    variableHint: "Elige la pregunta de selección múltiple y luego indica las opciones.",
    badge: "Opciones",
  },
];

export default function ReglaEditor({ inv, baseNombre, inicial, onSubmit, onCancel }: Props) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [saving, setSaving] = useState(false);
  const [tipo, setTipo] = useState<ReglaCustomTipo | null>(
    inicial?.tipo ?? null,
  );
  const [variables, setVariables] = useState<string[]>(inicial?.variables ?? []);
  const [nombre, setNombre] = useState(inicial?.nombre ?? "");
  const [mensaje, setMensaje] = useState(inicial?.mensaje ?? "");
  const [params, setParams] = useState<Record<string, unknown>>(
    inicial?.params ?? {},
  );
  const [hallazgoKind] = useState<ReglaCustomHallazgoKind>(
    inicial?.hallazgo_kind ?? "caso_validar",
  );
  const [gateConditions, setGateConditions] = useState<ReglaGateCondition[]>(
    inicial?.gate_conditions ?? [],
  );
  const initialTreatment = treatmentDefaultFor(inicial?.tipo ?? null);
  const [plannedAction, setPlannedAction] = useState<ReglaTreatmentActionType>(
    normalizeTreatmentAction(inicial?.planned_action_type, initialTreatment.action),
  );
  const [recommendedScope, setRecommendedScope] = useState<ReglaTreatmentScope>(
    normalizeTreatmentScope(inicial?.recommended_scope, initialTreatment.scope),
  );
  const [treatmentTouched, setTreatmentTouched] = useState<boolean>(
    Boolean(inicial?.planned_action_type || inicial?.recommended_scope),
  );
  const [activa, setActiva] = useState<boolean>(inicial?.activa ?? true);
  const [error, setError] = useState<string>("");

  const tiposDisponibles = useMemo(
    () => TIPOS.filter((t) => !t.legacyHidden || t.key === inicial?.tipo),
    [inicial?.tipo],
  );
  const tipoMeta = tiposDisponibles.find((t) => t.key === tipo) ?? null;
  // flatVars estabilizado: sin useMemo se recalcula en cada keystroke y
  // dispara re-renders en cascada que acumulan portals de los hovercards
  // de variable (crashes en bases grandes).
  const flatVars: ExploradorVariable[] = useMemo(
    () => inv.secciones.flatMap((s) => s.variables),
    [inv.secciones],
  );

  // Plano variable → sección para el hover lookup del preview.
  const varSections = useMemo(() => {
    const map = new Map<string, string>();
    for (const sec of inv.secciones) {
      for (const v of sec.variables) map.set(v.name, sec.nombre);
    }
    return map;
  }, [inv.secciones]);

  // Regla draft (para preview narrativo). Se actualiza reactivamente cuando
  // el usuario avanza por los pasos o cambia cualquier parámetro.
  const draftRule = useMemo(
    () => draftCustomToRule({
      tipo,
      variables,
      nombre,
      mensaje,
      params: { ...params, gate_conditions: gateConditions },
    }),
    [tipo, variables, nombre, mensaje, params, gateConditions],
  );

  const variableHoverLookup = useMemo(
    () => (varName: string): VariableHoverData | undefined => {
      const v = flatVars.find((x) => x.name === varName);
      if (!v) return undefined;
      return { label: v.label ?? null, seccion: varSections.get(varName) ?? null };
    },
    [flatVars, varSections],
  );

  const labelLookup = useMemo(
    () => (v: string) => flatVars.find((x) => x.name === v)?.label ?? null,
    [flatVars],
  );

  useEffect(() => {
    if (!tipo || treatmentTouched) return;
    const defaults = treatmentDefaultFor(tipo);
    setPlannedAction(defaults.action);
    setRecommendedScope(defaults.scope);
  }, [tipo, treatmentTouched]);

  function pickTipo(nextTipo: ReglaCustomTipo) {
    setTipo(nextTipo);
    if (!treatmentTouched) {
      const defaults = treatmentDefaultFor(nextTipo);
      setPlannedAction(defaults.action);
      setRecommendedScope(defaults.scope);
    }
  }

  function validateStep(s: number): string {
    if (s === 1 && !tipo) return "Elige un tipo de regla.";
    if (s === 2) {
      if (!tipoMeta) return "Tipo no definido.";
      const needed = typeof tipoMeta.nVars === "number" ? tipoMeta.nVars : tipoMeta.nVars[0];
      if (variables.length < needed) return `Necesitas al menos ${needed} variable${needed === 1 ? "" : "s"}.`;
    }
    if (s === 3) {
      if (!nombre.trim()) return "Agrega un nombre descriptivo a la regla.";
      // Validaciones por tipo.
      if (tipo === "rango_num") {
        const mn = params.min as string | undefined;
        const mx = params.max as string | undefined;
        if (!mn && !mx) return "Define al menos un límite mínimo o máximo.";
      }
      if (tipo === "rango_fecha") {
        const mn = params.min as string | undefined;
        const mx = params.max as string | undefined;
        if (!mn && !mx) return "Define al menos fecha mínima o máxima (YYYY-MM-DD).";
        if (mn && mx && mn > mx) return "El inicio del operativo no puede ser posterior al cierre.";
        const timezone = String(params.timezone ?? "America/Lima").trim();
        if (!isValidTimeZone(timezone)) return "La zona horaria no es válida. Usa un identificador como America/Lima.";
      }
      if (tipo === "outliers_iqr" || tipo === "outliers_z") {
        const k = Number(params.k);
        if (!isFinite(k) || k <= 0) return "k debe ser un número > 0.";
      }
      if (tipo === "fuera_catalogo") {
        const vals = (params.valores as string[] | undefined) ?? [];
        if (!vals.length) return "Añade al menos un valor permitido.";
      }
      if (tipo === "coherencia_2v") {
        if (!params.op_x || !params.op_y) return "Define operadores para ambas variables.";
        if (params.valor_x === undefined || params.valor_y === undefined) {
          return "Define la condición de ambas variables.";
        }
      }
      if (tipo === "select_multiple_hierarchy") {
        const map = hierarchyMapFromRows(hierarchyRowsFromParams(params));
        if (Object.keys(map).length === 0) {
          return "Agrega al menos una relación: si marcó una opción, qué opciones deberían acompañarla.";
        }
      }
      if (tipo === "select_multiple_exclusive") {
        const codes = paramList(params.exclusive_codes);
        if (!codes.length) return "Define al menos una opción excluyente.";
      }
      if (tipo === "select_multiple_cardinality") {
        const min = nullableNumber(params.min);
        const max = nullableNumber(params.max);
        if (min === null && max === null) return "Define mínimo, máximo o ambos.";
        if (min !== null && max !== null && min > max) return "El mínimo no puede ser mayor que el máximo.";
      }
      if (tipo === "select_multiple_selection") {
        const op = String(params.op ?? "");
        const codes = paramList(params.codes);
        if (!op) return "Define el operador de selección múltiple.";
        if (!codes.length) return "Define al menos una opción.";
      }
      const gateError = validateGateConditions(gateConditions);
      if (gateError) return gateError;
    }
    return "";
  }

  function goNext() {
    const err = validateStep(step);
    if (err) {
      setError(err);
      return;
    }
    setError("");
    if (step < 3) setStep((step + 1) as 1 | 2 | 3);
    else void handleSave();
  }

  function goBack() {
    setError("");
    if (step > 1) setStep((step - 1) as 1 | 2 | 3);
  }

  async function handleSave() {
    if (!tipo) return;
    const err = validateStep(3);
    if (err) { setError(err); return; }
    setSaving(true);
    try {
      const submitParams = normalizeParamsForSubmit(tipo, params);
      const gateExpr = gateExprFromConditions(gateConditions);
      await onSubmit({
        id: inicial?.id,
        activa,
        nombre,
        tipo,
        variables,
        params: submitParams,
        mensaje: mensaje || nombre,
        severidad: (inicial?.severidad ?? "error"),
        hallazgo_kind: hallazgoKind,
        planned_action_type: plannedAction,
        recommended_scope: recommendedScope,
        gate_expr: gateExpr,
        gate_conditions: gateConditions.filter((cond) => cond.variable && cond.op),
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="pulso-regla-editor">
      <div className="pulso-regla-editor-head">
        <div style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: "var(--pulso-text)" }}>
            {inicial ? "Editar criterio de revisión" : "Nuevo criterio de revisión"}
          </div>
          <div style={{ fontSize: 11, color: "var(--pulso-text-soft)" }}>
            Paso {step} de 3 · {stepTitle(step)}
          </div>
        </div>
        <label
          className={`pulso-regla-execution-toggle${activa ? " is-on" : ""}`}
          title={activa ? "Incluido al ejecutar criterios." : "Omitido al ejecutar criterios."}
        >
          <input
            type="checkbox"
            checked={activa}
            onChange={(e) => setActiva(e.target.checked)}
          />
          <span className="pulso-regla-execution-switch" aria-hidden="true">
            <span />
          </span>
          <span className="pulso-regla-execution-copy">
            <strong>{activa ? "Incluido" : "Omitido"}</strong>
            <small>en ejecución</small>
          </span>
        </label>
        <button
          type="button"
          onClick={onCancel}
          className="pulso-icon"
          aria-label="Cerrar"
          title="Cerrar"
        >
          <XIcon size={13} />
        </button>
      </div>

      <div className="pulso-regla-editor-scroll">
        <StepIndicator step={step} />
        <WizardIntro step={step} tipoMeta={tipoMeta} />

        {/* Preview narrativo en vivo: aparece en cuanto hay tipo + ≥1 variable.
            Visibilidad: step 2 y 3. En step 1 aún no hay datos suficientes y
            sería ruido. */}
        {step >= 2 && draftRule && (
          <NarrativePreview
            rule={draftRule}
            variableHoverLookup={variableHoverLookup}
            labelLookup={labelLookup}
          />
        )}

        {/* Contenido del paso */}
        {step === 1 && (
          <Step1 tipo={tipo} setTipo={pickTipo} tipos={tiposDisponibles} />
        )}
        {step === 2 && tipoMeta && (
          <Step2
            tipoMeta={tipoMeta}
            variables={variables}
            setVariables={setVariables}
            inv={inv}
            flatVars={flatVars}
          />
        )}
        {step === 3 && tipo && (
          <Step3
            tipo={tipo}
            tipoMeta={tipoMeta}
            nombre={nombre}
            setNombre={setNombre}
            mensaje={mensaje}
            setMensaje={setMensaje}
            params={params}
            setParams={setParams}
            variables={variables}
            flatVars={flatVars}
            baseNombre={baseNombre}
            gateConditions={gateConditions}
            setGateConditions={setGateConditions}
            plannedAction={plannedAction}
            setPlannedAction={(value) => {
              setTreatmentTouched(true);
              setPlannedAction(value);
            }}
            recommendedScope={recommendedScope}
            setRecommendedScope={(value) => {
              setTreatmentTouched(true);
              setRecommendedScope(value);
            }}
          />
        )}

        {error && (
          <div
            style={{
              fontSize: 11,
              color: "var(--pulso-danger-fg)",
              background: "var(--pulso-danger-bg)",
              border: "1px solid var(--pulso-danger-border)",
              padding: "6px 10px",
              borderRadius: 6,
            }}
          >
            {error}
          </div>
        )}
      </div>

      <div
        className="pulso-regla-editor-footer"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 10,
        }}
      >
        <button
          type="button"
          onClick={goBack}
          disabled={step === 1}
          style={{
            fontSize: 12,
            padding: "7px 14px",
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            opacity: step === 1 ? 0.4 : 1,
          }}
        >
          <ChevronLeft size={12} /> Anterior
        </button>

        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            onClick={onCancel}
            style={{ fontSize: 12, padding: "7px 14px" }}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="pulso-primary"
            onClick={goNext}
            disabled={saving}
            style={{
              fontSize: 12,
              padding: "7px 14px",
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
            }}
          >
            {step === 3 ? (
              <>
                <Save size={12} /> Guardar criterio
              </>
            ) : (
              <>
                Siguiente <ChevronRight size={12} />
              </>
            )}
          </button>
        </div>
      </div>
    </section>
  );
}

// =============================================================================
// Step indicator
// =============================================================================
function StepIndicator({ step }: { step: number }) {
  return (
    <div style={{ display: "flex", gap: 6 }}>
      {[1, 2, 3].map((s) => (
        <div
          key={s}
          style={{
            flex: 1,
            height: 4,
            borderRadius: 2,
            background: s <= step ? "var(--pulso-primary)" : "var(--pulso-border)",
          }}
        />
      ))}
    </div>
  );
}

function stepTitle(step: number) {
  if (step === 1) return "tipo de señal";
  if (step === 2) return "ámbito y variables";
  return "criterio y tratamiento";
}

function WizardIntro({
  step,
  tipoMeta,
}: {
  step: number;
  tipoMeta: TipoMeta | null;
}) {
  const copy =
    step === 1
      ? {
          title: "Configura una señal adicional",
          body: "Define patrones operativos, coherencias interpretativas o transformaciones que conviene dejar disponibles en la cola de limpieza.",
        }
      : step === 2
        ? {
            title: tipoMeta ? `Ámbito: ${tipoMeta.label}` : "Elige las variables",
            body: tipoMeta?.variableHint ?? "Selecciona las variables que participan en el criterio.",
          }
        : {
            title: tipoMeta ? `Parámetros: ${tipoMeta.label}` : "Define el criterio",
            body: "Configura la señal, su ámbito y el tratamiento que quedará preparado para Limpieza.",
          };

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 14,
        padding: "12px 14px",
        borderRadius: 10,
        background: "var(--pulso-surface-2)",
        border: "1px solid var(--pulso-border)",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: "var(--pulso-text)" }}>
          {copy.title}
        </div>
        <div style={{ fontSize: 11.5, color: "var(--pulso-text-soft)", lineHeight: 1.45 }}>
          {copy.body}
        </div>
      </div>
      {tipoMeta?.badge && step >= 2 && (
        <span
          style={{
            alignSelf: "flex-start",
            flexShrink: 0,
            fontSize: 10,
            fontWeight: 800,
            color: "var(--pulso-primary)",
            background: "white",
            border: "1px solid var(--pulso-primary-border)",
            borderRadius: 999,
            padding: "4px 9px",
          }}
        >
          {tipoMeta.badge}
        </span>
      )}
    </div>
  );
}

// =============================================================================
// Step 1 — tipo
// =============================================================================
function Step1({
  tipo,
  setTipo,
  tipos,
}: {
  tipo: ReglaCustomTipo | null;
  setTipo: (t: ReglaCustomTipo) => void;
  tipos: TipoMeta[];
}) {
  const grupos: Array<{
    key: TipoMeta["grupo"];
    label: string;
    hint: string;
  }> = [
    {
      key: "respuesta",
      label: "Operativo y plausibilidad",
      hint: "Duración, fechas de campo y métricas sospechosas.",
    },
    {
      key: "coherencia",
      label: "Coherencia de encuesta",
      hint: "Cruces entre respuestas, contexto y duplicados prácticos.",
    },
    {
      key: "seleccion",
      label: "Preguntas de selección múltiple",
      hint: "Opciones acumuladas, incompatibles o demasiadas marcas.",
    },
  ];
  const briefItems = [
    {
      label: "Señal",
      body: "Patrón que debe quedar disponible.",
    },
    {
      label: "Ámbito",
      body: "Registros donde aplica el criterio.",
    },
    {
      label: "Salida",
      body: "Texto y parámetros que viajarán a limpieza.",
    },
  ];

  return (
    <div className="pulso-regla-step1">
      <section className="pulso-regla-design-brief" aria-label="Cómo elegir un criterio">
        <div className="pulso-regla-design-copy">
          <span className="pulso-section-eyebrow">Cómo elegir</span>
          <strong>Configura una señal adicional sobre la base.</strong>
          <p>
            Úsalo para patrones operativos, coherencias interpretativas, selección múltiple y
            transformaciones que deben quedar disponibles en Limpieza.
          </p>
        </div>
        <div className="pulso-regla-design-steps">
          {briefItems.map((item, idx) => (
            <div key={item.label} className="pulso-regla-design-step">
              <span>{idx + 1}</span>
              <div>
                <strong>{item.label}</strong>
                <p>{item.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="pulso-regla-settings-list">
        {grupos.map((grupo) => {
          const groupTipos = tipos.filter((t) => t.grupo === grupo.key);
          if (!groupTipos.length) return null;
          return (
            <section key={grupo.key} className={`pulso-regla-settings-group is-${grupo.key}`}>
              <header className="pulso-regla-settings-group-head">
                <div>
                  <strong>{grupo.label}</strong>
                  <p>{grupo.hint}</p>
                </div>
                <span>{groupTipos.length} criterio{groupTipos.length === 1 ? "" : "s"}</span>
              </header>
              <div className="pulso-regla-settings-rows">
                {groupTipos.map((t) => {
                  const active = tipo === t.key;
                  return (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => setTipo(t.key)}
                      className={`pulso-regla-setting-row${active ? " is-active" : ""}`}
                    >
                      <span className="pulso-regla-setting-badge">{t.badge ?? grupo.label}</span>
                      <span className="pulso-regla-setting-main">
                        <strong>{t.label}</strong>
                        <span>{t.pregunta}</span>
                      </span>
                      <span className="pulso-regla-setting-example">{t.ejemplo}</span>
                      <span className="pulso-regla-setting-status" aria-hidden="true">
                        {active ? <CheckCircle2 size={16} /> : <ChevronRight size={15} />}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

// =============================================================================
// Step 2 — variables
// =============================================================================
function Step2({
  tipoMeta,
  variables,
  setVariables,
  flatVars,
}: {
  tipoMeta: TipoMeta;
  variables: string[];
  setVariables: (v: string[]) => void;
  inv: ExploradorVariablesList;
  flatVars: ExploradorVariable[];
}) {
  const [query, setQuery] = useState("");
  const needed = typeof tipoMeta.nVars === "number" ? tipoMeta.nVars : tipoMeta.nVars[0];
  const max = typeof tipoMeta.nVars === "number" ? tipoMeta.nVars : tipoMeta.nVars[1];

  const candidatas = flatVars
    .filter((v) => !query || v.name.toLowerCase().includes(query.toLowerCase()) || v.label.toLowerCase().includes(query.toLowerCase()))
    .slice(0, 300);

  function toggle(name: string) {
    if (variables.includes(name)) {
      setVariables(variables.filter((x) => x !== name));
    } else {
      if (variables.length >= max) {
        // En vez de reemplazar, ignoramos — el usuario primero debe quitar.
        return;
      }
      setVariables([...variables, name]);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 12,
          padding: "10px 12px",
          borderRadius: 10,
          border: "1px solid var(--pulso-border)",
          background: "white",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: "var(--pulso-text)" }}>
            {tipoMeta.label}
          </div>
          <div style={{ fontSize: 11.5, color: "var(--pulso-text-soft)", lineHeight: 1.4 }}>
            {tipoMeta.variableHint}
          </div>
        </div>
        <span
          style={{
            flexShrink: 0,
            fontSize: 10,
            fontWeight: 800,
            color: variables.length >= needed ? "var(--pulso-success-fg)" : "var(--pulso-text-soft)",
            background: variables.length >= needed ? "var(--pulso-success-bg)" : "var(--pulso-surface-2)",
            border: `1px solid ${variables.length >= needed ? "var(--pulso-success-border)" : "var(--pulso-border)"}`,
            borderRadius: 999,
            padding: "4px 9px",
          }}
        >
          {variables.length} / {needed === max ? needed : `${needed}-${max}`}
        </span>
      </div>
      <input
        type="text"
        placeholder="Buscar pregunta por nombre o texto..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        style={{
          fontSize: 12,
          padding: "7px 10px",
          borderRadius: 6,
          border: "1px solid var(--pulso-border)",
          outline: "none",
        }}
      />
      <div
        style={{
          maxHeight: 260,
          overflowY: "auto",
          border: "1px solid var(--pulso-border)",
          borderRadius: 6,
        }}
      >
        {candidatas.map((v) => {
          const checked = variables.includes(v.name);
          return (
            <label
              key={v.name}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "6px 10px",
                borderBottom: "1px solid var(--pulso-surface-2)",
                cursor: "pointer",
                background: checked ? "var(--pulso-primary-soft)" : "white",
              }}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggle(v.name)}
              />
              <code style={{ fontSize: 11, fontFamily: "ui-monospace, monospace", color: "var(--pulso-text)" }}>
                {v.name}
              </code>
              <span style={{ fontSize: 10, color: "var(--pulso-text-soft)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {v.label}
              </span>
              <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 4, background: "var(--pulso-surface-2)", color: "var(--pulso-text-soft)", fontFamily: "ui-monospace, monospace" }}>
                {variableTipoLabel(v.tipo)}
              </span>
            </label>
          );
        })}
      {!candidatas.length && (
        <div style={{ padding: 20, textAlign: "center", fontSize: 11, color: "var(--pulso-text-soft)", fontStyle: "italic" }}>
            No encontramos variables con ese filtro.
        </div>
      )}
      </div>

      {/* Chips de variables seleccionadas */}
      {variables.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {variables.map((v, i) => (
            <span
              key={v}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                fontSize: 11,
                fontWeight: 600,
                padding: "3px 8px",
                borderRadius: 999,
                background: "var(--pulso-primary-soft)",
                color: "var(--pulso-primary)",
                fontFamily: "ui-monospace, monospace",
              }}
            >
              {i + 1}. {v}
              <button
                type="button"
                onClick={() => toggle(v)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "inherit",
                  cursor: "pointer",
                  display: "inline-flex",
                  padding: 2,
                }}
              >
                <XIcon size={10} />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Step 3 — parámetros específicos
// =============================================================================
function Step3({
  tipo,
  tipoMeta,
  nombre,
  setNombre,
  mensaje,
  setMensaje,
  params,
  setParams,
  variables,
  flatVars,
  baseNombre,
  gateConditions,
  setGateConditions,
  plannedAction,
  setPlannedAction,
  recommendedScope,
  setRecommendedScope,
}: {
  tipo: ReglaCustomTipo;
  tipoMeta: TipoMeta | null;
  nombre: string;
  setNombre: (v: string) => void;
  mensaje: string;
  setMensaje: (v: string) => void;
  params: Record<string, unknown>;
  setParams: (p: Record<string, unknown>) => void;
  variables: string[];
  flatVars: ExploradorVariable[];
  baseNombre?: string | null;
  gateConditions: ReglaGateCondition[];
  setGateConditions: (v: ReglaGateCondition[]) => void;
  plannedAction: ReglaTreatmentActionType;
  setPlannedAction: (v: ReglaTreatmentActionType) => void;
  recommendedScope: ReglaTreatmentScope;
  setRecommendedScope: (v: ReglaTreatmentScope) => void;
}) {
  const setParam = (k: string, v: unknown) => setParams({ ...params, [k]: v });
  const labelVar = (v: string) => flatVars.find((x) => x.name === v)?.label ?? v;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {tipoMeta && <RuleIntentCard tipoMeta={tipoMeta} />}

      <FieldRow label="Nombre corto del caso">
        <input
          type="text"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder={
            tipo === "no_nulo" ? `${variables[0]} no puede estar vacío` :
            tipo === "rango_num" ? `${variables[0]} sospechosa` :
            tipoMeta ? tipoMeta.label : `Regla ${tipo}`
          }
          style={inputStyle}
        />
      </FieldRow>
      <div className="pulso-regla-detection-note">
        <strong>Salida del criterio.</strong>
        <span>
          Los registros detectados quedan disponibles para documentar, corregir, completar,
          anular o excluir en una etapa posterior.
        </span>
      </div>

      <FieldRow label="Detalle" hint="Texto visible junto a los registros detectados.">
        <input
          type="text"
          value={mensaje}
          onChange={(e) => setMensaje(e.target.value)}
          placeholder="Ej. Completar opciones previas asociadas a grados superiores."
          style={inputStyle}
        />
      </FieldRow>

      <GateConditionsEditor
        conditions={gateConditions}
        setConditions={setGateConditions}
        flatVars={flatVars}
        baseNombre={baseNombre}
      />

      <TreatmentPlanner
        tipo={tipo}
        action={plannedAction}
        scope={recommendedScope}
        onAction={setPlannedAction}
        onScope={setRecommendedScope}
      />

      {/* Parámetros por tipo */}
      {(tipo === "rango_num" || tipo === "rango_fecha") && (
        <>
          <FieldRow label={tipo === "rango_num" ? "Mínimo esperado (opcional)" : "Inicio del operativo"}>
            <input
              type={tipo === "rango_num" ? "number" : "date"}
              value={(params.min as string) ?? ""}
              onChange={(e) => setParam("min", e.target.value)}
              style={inputStyle}
            />
          </FieldRow>
          <FieldRow label={tipo === "rango_num" ? "Máximo esperado (opcional)" : "Cierre del operativo"}>
            <input
              type={tipo === "rango_num" ? "number" : "date"}
              value={(params.max as string) ?? ""}
              onChange={(e) => setParam("max", e.target.value)}
              style={inputStyle}
            />
          </FieldRow>
          {tipo === "rango_num" && (
            <FieldRow label="Inclusivo (marca x < min o x > max)">
              <label style={{ fontSize: 12 }}>
                <input
                  type="checkbox"
                  checked={(params.inclusive as boolean) ?? true}
                  onChange={(e) => setParam("inclusive", e.target.checked)}
                />{" "}
                Inclusivo — los límites están permitidos.
              </label>
            </FieldRow>
          )}
          {tipo === "rango_fecha" && (
            <FieldRow
              label="Zona horaria"
              hint="Identificador IANA usado para interpretar los límites del operativo."
            >
              <input
                type="text"
                value={(params.timezone as string) ?? "America/Lima"}
                onChange={(e) => setParam("timezone", e.target.value)}
                placeholder="America/Lima"
                style={inputStyle}
              />
            </FieldRow>
          )}
        </>
      )}

      {(tipo === "outliers_iqr" || tipo === "outliers_z") && (
        <FieldRow
          label={`k (${tipo === "outliers_iqr" ? "típico 1.5" : "típico 3"})`}
          hint={tipo === "outliers_iqr"
            ? "Detecta fuera de [Q1 − k·IQR, Q3 + k·IQR]."
            : "Detecta |z-score| > k."}
        >
          <input
            type="number"
            step="0.1"
            min="0"
            value={(params.k as number) ?? (tipo === "outliers_iqr" ? 1.5 : 3)}
            onChange={(e) => setParam("k", parseFloat(e.target.value))}
            style={inputStyle}
          />
        </FieldRow>
      )}

      {tipo === "fuera_catalogo" && (
        <FieldRow label="Valores permitidos (uno por línea)">
          <textarea
            rows={4}
            value={((params.valores as string[]) ?? []).join("\n")}
            onChange={(e) => setParam("valores", e.target.value.split(/\r?\n/).map((x) => x.trim()).filter(Boolean))}
            placeholder={`1\n2\n3`}
            style={{ ...inputStyle, resize: "vertical", fontFamily: "ui-monospace, monospace" }}
          />
        </FieldRow>
      )}

      {tipo === "coherencia_2v" && (
        <>
          <div style={{ fontSize: 11, color: "var(--pulso-text-soft)", lineHeight: 1.5 }}>
            Si <code>{variables[0]}</code> ({labelVar(variables[0])}) cumple la condición X,
            entonces <code>{variables[1]}</code> ({labelVar(variables[1])}) debe cumplir la condición Y.
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <OpValor
              title={`Condición sobre ${variables[0]}`}
              variableMeta={flatVars.find((x) => x.name === variables[0])}
              baseNombre={baseNombre}
              op={params.op_x as string}
              valor={params.valor_x as string | string[]}
              onOp={(o) => setParam("op_x", o)}
              onValor={(v) => setParam("valor_x", v)}
            />
            <OpValor
              title={`Entonces ${variables[1]}`}
              variableMeta={flatVars.find((x) => x.name === variables[1])}
              baseNombre={baseNombre}
              op={params.op_y as string}
              valor={params.valor_y as string | string[]}
              onOp={(o) => setParam("op_y", o)}
              onValor={(v) => setParam("valor_y", v)}
            />
          </div>
        </>
      )}

      {tipo === "select_multiple_hierarchy" && (
        <HierarchyMapEditor
          params={params}
          setParams={setParams}
          variableName={variables[0]}
          baseNombre={baseNombre}
        />
      )}

      {tipo === "select_multiple_exclusive" && (
        <OptionCodesField
          label="Opciones excluyentes"
          hint="Selecciona las opciones que no deberían combinarse con otras marcas."
          variableName={variables[0]}
          baseNombre={baseNombre}
          value={paramList(params.exclusive_codes)}
          onChange={(values) => setParam("exclusive_codes", values)}
          fallbackPlaceholder={`99\nninguno`}
        />
      )}

      {tipo === "select_multiple_cardinality" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <FieldRow label="Mínimo de opciones">
            <input
              type="number"
              min="0"
              value={(params.min as string | number | undefined) ?? ""}
              onChange={(e) => setParam("min", e.target.value)}
              style={inputStyle}
            />
          </FieldRow>
          <FieldRow label="Máximo de opciones">
            <input
              type="number"
              min="0"
              value={(params.max as string | number | undefined) ?? ""}
              onChange={(e) => setParam("max", e.target.value)}
              style={inputStyle}
            />
          </FieldRow>
        </div>
      )}

      {tipo === "select_multiple_selection" && (
        <>
          <FieldRow label="Operador sobre las opciones">
            <select
              value={(params.op as string) ?? "contains_any"}
              onChange={(e) => setParam("op", e.target.value)}
              style={inputStyle}
            >
              <option value="contains">contiene</option>
              <option value="not_contains">no contiene</option>
              <option value="contains_any">contiene cualquiera</option>
              <option value="contains_all">contiene todas</option>
              <option value="contains_none">no contiene ninguna</option>
            </select>
          </FieldRow>
          <OptionCodesField
            label="Opciones"
            hint="Selecciona las opciones que participan en el criterio."
            variableName={variables[0]}
            baseNombre={baseNombre}
            value={paramList(params.codes)}
            onChange={(values) => setParam("codes", values)}
            fallbackPlaceholder={`1\n2\n5`}
          />
        </>
      )}

      {tipo === "no_nulo" && (
        <div style={{ fontSize: 11, color: "var(--pulso-text-soft)", fontStyle: "italic" }}>
          Sin parámetros adicionales: cada caso con NA o vacío se marca como hallazgo.
        </div>
      )}
      {tipo === "duplicados" && (
        <div className="pulso-regla-detection-note">
          <strong>Política de claves incompletas.</strong>
          <span>
            Se marcan todas las filas cuya tupla ({variables.join(", ")}) aparezca más de una vez.
            Las tuplas con alguna clave vacía se ignoran y se revisan con una regla de completitud separada.
          </span>
        </div>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
function TreatmentPlanner({
  tipo,
  action,
  scope,
  onAction,
  onScope,
}: {
  tipo: ReglaCustomTipo;
  action: ReglaTreatmentActionType;
  scope: ReglaTreatmentScope;
  onAction: (v: ReglaTreatmentActionType) => void;
  onScope: (v: ReglaTreatmentScope) => void;
}) {
  const actions = treatmentActionsForTipo(tipo);
  const activeAction = actions.some((item) => item.value === action)
    ? action
    : actions[0]?.value ?? "ignore_rule";

  useEffect(() => {
    if (activeAction !== action) onAction(activeAction);
  }, [activeAction, action, onAction]);

  return (
    <section className="pulso-treatment-planner">
      <header className="pulso-treatment-planner-head">
        <div>
          <span className="pulso-section-eyebrow">Tratamiento previsto</span>
          <strong>Deja preparada la forma de resolver los hallazgos.</strong>
          <p>
            Es una pauta inicial: Limpieza la mostrará lista para confirmar,
            ajustar por selección o revisar registro por registro.
          </p>
        </div>
      </header>

      <div className="pulso-treatment-grid" role="radiogroup" aria-label="Tratamiento previsto">
        {actions.map((item) => (
          <button
            key={item.value}
            type="button"
            role="radio"
            aria-checked={activeAction === item.value}
            className={`pulso-treatment-card${activeAction === item.value ? " is-active" : ""}`}
            onClick={() => onAction(item.value)}
          >
            <span className="pulso-treatment-card-check" aria-hidden="true">
              {activeAction === item.value && <CheckCircle2 size={14} />}
            </span>
            <span>
              <strong>{item.label}</strong>
              <small>{item.description}</small>
            </span>
          </button>
        ))}
      </div>

      <div className="pulso-scope-selector" role="radiogroup" aria-label="Alcance sugerido">
        <span>Alcance sugerido</span>
        {TREATMENT_SCOPES.map((item) => (
          <button
            key={item.value}
            type="button"
            role="radio"
            aria-checked={scope === item.value}
            className={scope === item.value ? "is-active" : ""}
            onClick={() => onScope(item.value)}
          >
            <strong>{item.label}</strong>
            <small>{item.description}</small>
          </button>
        ))}
      </div>
    </section>
  );
}

// -----------------------------------------------------------------------------
function RuleIntentCard({ tipoMeta }: { tipoMeta: TipoMeta }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(min(260px, 100%), 1fr))",
        gap: 10,
        padding: "12px",
        borderRadius: 10,
        border: "1px solid var(--pulso-primary-border)",
        background: "var(--pulso-primary-soft)",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <div style={{ fontSize: 10, fontWeight: 800, color: "var(--pulso-primary)", textTransform: "uppercase", letterSpacing: 0.4 }}>
          Criterio elegido
        </div>
        <div style={{ fontSize: 13, fontWeight: 800, color: "var(--pulso-text)" }}>
          {tipoMeta.label}
        </div>
        <div style={{ fontSize: 11.5, color: "var(--pulso-text-soft)", lineHeight: 1.45 }}>
          {tipoMeta.resultado}
        </div>
      </div>
      <div
        style={{
          fontSize: 11,
          lineHeight: 1.4,
          color: "var(--pulso-text-soft)",
          background: "rgba(255,255,255,0.76)",
          border: "1px solid var(--pulso-primary-border)",
          borderRadius: 8,
          padding: "9px 10px",
        }}
      >
        <strong style={{ color: "var(--pulso-text)" }}>Caso típico:</strong>{" "}
        {tipoMeta.ejemplo}
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
type HierarchyRow = {
  trigger: string;
  required: string;
};

type CatalogOption = ExplorarValoresResult["opciones"][number];

function HierarchyMapEditor({
  params,
  setParams,
  variableName,
  baseNombre,
}: {
  params: Record<string, unknown>;
  setParams: (p: Record<string, unknown>) => void;
  variableName?: string;
  baseNombre?: string | null;
}) {
  const rows = hierarchyRowsFromParams(params);
  const visibleRows = rows.length ? rows : [{ trigger: "", required: "" }];
  const { options, loading } = useVariableOptions(variableName, baseNombre);
  const hasOptions = options.length > 0;
  const optionsByCode = useMemo(
    () => new Map(options.map((option) => [option.code, option])),
    [options],
  );

  function commit(nextRows: HierarchyRow[]) {
    const { hierarchy_map_text: _legacyText, ...rest } = params;
    setParams({
      ...rest,
      hierarchy_rows: nextRows,
      hierarchy_map: hierarchyMapFromRows(nextRows),
    });
  }

  function update(idx: number, patch: Partial<HierarchyRow>) {
    commit(visibleRows.map((row, i) => i === idx ? { ...row, ...patch } : row));
  }

  function remove(idx: number) {
    const next = visibleRows.filter((_, i) => i !== idx);
    commit(next.length ? next : [{ trigger: "", required: "" }]);
  }

  return (
    <section className="pulso-hierarchy-editor">
      <header className="pulso-hierarchy-editor-head">
        <div>
          <span className="pulso-section-eyebrow">Relación de opciones</span>
          <strong>Configura qué marcas deben aparecer juntas.</strong>
          <p>
            Cada fila se lee así: cuando la respuesta incluye la opción de la izquierda,
            también debe incluir las opciones de la derecha.
          </p>
        </div>
        <button
          type="button"
          onClick={() => commit([...visibleRows, { trigger: "", required: "" }])}
          style={secondarySmallButtonStyle}
        >
          Agregar relación
        </button>
      </header>

      <div className="pulso-hierarchy-rows">
        {visibleRows.map((row, idx) => {
          const triggerLabel = hierarchyOptionLabel(row.trigger, optionsByCode, "elige la opción marcada");
          const requiredLabel = hierarchyOptionsLabel(
            paramList(row.required),
            optionsByCode,
            "elige las opciones esperadas",
          );
          return (
            <div key={idx} className="pulso-hierarchy-row">
              <FieldRow
                label="Cuando la respuesta incluye"
                hint="La opción que aparece marcada en la selección múltiple."
              >
                {hasOptions ? (
                  <OptionSelect
                    options={options}
                    value={row.trigger}
                    onChange={(value) => update(idx, { trigger: value })}
                    placeholder={loading ? "Cargando opciones..." : "Elegir opción"}
                  />
                ) : (
                  <input
                    type="text"
                    value={row.trigger}
                    onChange={(e) => update(idx, { trigger: e.target.value })}
                    placeholder={loading ? "Cargando opciones..." : "Ej. Magíster o 5"}
                    style={inputStyle}
                  />
                )}
              </FieldRow>
              <FieldRow
                label="También debe incluir"
                hint={hasOptions ? "Opciones que deberían estar marcadas junto con la anterior." : "Una por línea o separadas por coma. Usa la etiqueta o el código real de la opción."}
              >
                {hasOptions ? (
                  <OptionChecklist
                    options={options.filter((option) => option.code !== row.trigger)}
                    value={paramList(row.required)}
                    onChange={(values) => update(idx, { required: values.join("\n") })}
                    compact
                  />
                ) : (
                  <textarea
                    rows={2}
                    value={row.required}
                    onChange={(e) => update(idx, { required: e.target.value })}
                    placeholder={loading ? "Cargando opciones..." : "Ej. Bachiller\nTitulado/a"}
                    style={{ ...inputStyle, resize: "vertical" }}
                  />
                )}
              </FieldRow>
              <button
                type="button"
                className="pulso-icon"
                onClick={() => remove(idx)}
                aria-label="Quitar relación"
                title="Quitar relación"
              >
                <XIcon size={12} />
              </button>
              <div className="pulso-hierarchy-sentence">
                <span>Cuando incluye</span>
                <strong>{triggerLabel}</strong>
                <span>también debe incluir</span>
                <strong>{requiredLabel}</strong>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// -----------------------------------------------------------------------------
function OptionCodesField({
  label,
  hint,
  variableName,
  baseNombre,
  value,
  onChange,
  fallbackPlaceholder,
}: {
  label?: string;
  hint?: string;
  variableName?: string;
  baseNombre?: string | null;
  value: string[];
  onChange: (value: string[]) => void;
  fallbackPlaceholder?: string;
}) {
  const { options, loading } = useVariableOptions(variableName, baseNombre);
  const control = options.length > 0 ? (
    <OptionChecklist options={options} value={value} onChange={onChange} />
  ) : (
    <textarea
      rows={4}
      value={value.join("\n")}
      onChange={(e) => onChange(parseListText(e.target.value))}
      placeholder={loading ? "Cargando opciones..." : fallbackPlaceholder}
      style={{ ...inputStyle, resize: "vertical", fontFamily: "ui-monospace, monospace" }}
    />
  );

  if (!label) return control;
  return (
    <FieldRow label={label} hint={hint}>
      {control}
    </FieldRow>
  );
}

function OptionSelect({
  options,
  value,
  onChange,
  placeholder = "Elegir opción",
}: {
  options: CatalogOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} style={inputStyle}>
      <option value="">{placeholder}</option>
      {options.map((option) => (
        <option key={option.code} value={option.code}>
          {option.label || option.code}{option.code !== option.label ? ` · ${option.code}` : ""}{option.n != null ? ` · n=${option.n}` : ""}
        </option>
      ))}
    </select>
  );
}

function OptionChecklist({
  options,
  value,
  onChange,
  compact = false,
}: {
  options: CatalogOption[];
  value: string[];
  onChange: (value: string[]) => void;
  compact?: boolean;
}) {
  const [query, setQuery] = useState("");
  const selected = new Set(value);
  const filtered = options
    .filter((option) => {
      const q = query.trim().toLowerCase();
      if (!q) return true;
      return option.code.toLowerCase().includes(q) || option.label.toLowerCase().includes(q);
    })
    .slice(0, compact ? 80 : 140);

  function toggle(code: string) {
    const next = new Set(selected);
    if (next.has(code)) next.delete(code);
    else next.add(code);
    onChange(Array.from(next));
  }

  return (
    <div className={`pulso-option-picker${compact ? " is-compact" : ""}`}>
      {options.length > 8 && (
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar opción..."
          style={inputStyle}
        />
      )}
      <div className="pulso-option-picker-list">
        {filtered.map((option) => {
          const checked = selected.has(option.code);
          return (
            <label key={option.code} className={`pulso-option-picker-row${checked ? " is-selected" : ""}`}>
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggle(option.code)}
              />
              <span>
                <strong>{option.label || option.code}</strong>
                {option.code !== option.label && <small>{option.code}</small>}
              </span>
              <em>n={option.n}</em>
            </label>
          );
        })}
        {!filtered.length && (
          <div className="pulso-option-picker-empty">Sin opciones con ese filtro.</div>
        )}
      </div>
    </div>
  );
}

function hierarchyOptionLabel(
  code: string,
  optionsByCode: Map<string, CatalogOption>,
  fallback: string,
) {
  const clean = code.trim();
  if (!clean) return fallback;
  const option = optionsByCode.get(clean);
  if (!option) return clean;
  const label = option.label || option.code;
  return option.code && option.code !== label ? `${label} (${option.code})` : label;
}

function hierarchyOptionsLabel(
  codes: string[],
  optionsByCode: Map<string, CatalogOption>,
  fallback: string,
) {
  const labels = codes
    .map((code) => hierarchyOptionLabel(code, optionsByCode, ""))
    .filter(Boolean);
  if (!labels.length) return fallback;
  return labels.join(", ");
}

function useVariableOptions(variableName?: string | null, baseNombre?: string | null) {
  const [state, setState] = useState<{ loading: boolean; options: CatalogOption[] }>({
    loading: false,
    options: [],
  });

  useEffect(() => {
    if (!variableName) {
      setState({ loading: false, options: [] });
      return;
    }
    let cancel = false;
    setState((prev) => ({ ...prev, loading: true }));
    apiV2ExplorarValores(variableName, baseNombre)
      .then((res) => {
        if (!cancel) setState({ loading: false, options: res.opciones ?? [] });
      })
      .catch(() => {
        if (!cancel) setState({ loading: false, options: [] });
      });
    return () => {
      cancel = true;
    };
  }, [variableName, baseNombre]);

  return state;
}

function GateConditionsEditor({
  conditions,
  setConditions,
  flatVars,
  baseNombre,
}: {
  conditions: ReglaGateCondition[];
  setConditions: (v: ReglaGateCondition[]) => void;
  flatVars: ExploradorVariable[];
  baseNombre?: string | null;
}) {
  const varsByName = useMemo(() => new Map(flatVars.map((v) => [v.name, v])), [flatVars]);

  function update(idx: number, patch: Partial<ReglaGateCondition>) {
    setConditions(conditions.map((cond, i) => i === idx ? { ...cond, ...patch } : cond));
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 800, color: "var(--pulso-text-soft)", textTransform: "uppercase", letterSpacing: 0.4 }}>
            Ámbito
          </div>
          <div style={{ fontSize: 10.5, color: "var(--pulso-text-soft)", lineHeight: 1.35 }}>
            Opcional. Limita el criterio a registros con una condición previa.
          </div>
        </div>
        <button
          type="button"
          onClick={() => setConditions([...conditions, emptyGateCondition(flatVars)])}
          style={{ ...secondarySmallButtonStyle, flexShrink: 0 }}
        >
          Agregar condición
        </button>
      </div>

      {conditions.length === 0 ? (
        <div style={{ ...emptyInlineStyle, padding: "8px 10px" }}>
          Sin filtro: el criterio aplica sobre toda la base.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {conditions.map((cond, idx) => {
            const selectedVar = varsByName.get(cond.variable);
            const options = operatorOptionsForVariable(selectedVar);
            const valueIsList = isListOperator(cond.op);
            return (
              <div
                key={idx}
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(0, 1fr) 150px minmax(0, 1fr) 32px",
                  gap: 8,
                  alignItems: "start",
                }}
              >
                <select
                  value={cond.variable}
                  onChange={(e) => {
                    const nextVar = e.target.value;
                    const nextMeta = varsByName.get(nextVar);
                    const nextOp = operatorOptionsForVariable(nextMeta)[0]?.value ?? "==";
                    update(idx, { variable: nextVar, op: nextOp, value: isListOperator(nextOp) ? [] : "" });
                  }}
                  style={inputStyle}
                >
                  <option value="">Variable</option>
                  {flatVars.map((v) => (
                    <option key={v.name} value={v.name}>
                      {formatVariableOption(v)}
                    </option>
                  ))}
                </select>
                <select
                  value={cond.op}
                  onChange={(e) => {
                    const nextOp = e.target.value as ReglaGateCondition["op"];
                    update(idx, {
                      op: nextOp,
                      value: isListOperator(nextOp) ? paramList(cond.value) : paramList(cond.value)[0] ?? "",
                    });
                  }}
                  style={inputStyle}
                >
                  {options.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <GateValueControl
                  variableMeta={selectedVar}
                  baseNombre={baseNombre}
                  op={cond.op}
                  value={cond.value}
                  valueIsList={valueIsList}
                  onChange={(value) => update(idx, { value })}
                />
                <button
                  type="button"
                  onClick={() => setConditions(conditions.filter((_, i) => i !== idx))}
                  className="pulso-icon"
                  aria-label="Quitar condición"
                  title="Quitar condición"
                  style={{ width: 30, height: 30, marginTop: 1 }}
                >
                  <XIcon size={12} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function GateValueControl({
  variableMeta,
  baseNombre,
  op,
  value,
  valueIsList,
  onChange,
}: {
  variableMeta?: ExploradorVariable;
  baseNombre?: string | null;
  op: ReglaGateCondition["op"];
  value: unknown;
  valueIsList: boolean;
  onChange: (value: string | string[]) => void;
}) {
  const { options, loading } = useVariableOptions(variableMeta?.name, baseNombre);
  const hasCatalog = !!variableMeta && (variableMeta.tipo === "so" || variableMeta.tipo === "sm") && options.length > 0;

  if (hasCatalog && valueIsList) {
    return (
      <OptionChecklist
        options={options}
        value={paramList(value)}
        onChange={onChange}
        compact
      />
    );
  }

  if (hasCatalog) {
    return (
      <OptionSelect
        options={options}
        value={typeof value === "string" ? value : paramList(value)[0] ?? ""}
        onChange={onChange}
        placeholder={loading ? "Cargando opciones..." : "Elegir opción"}
      />
    );
  }

  if (valueIsList) {
    return (
      <textarea
        rows={2}
        value={listText(value)}
        onChange={(e) => onChange(parseListText(e.target.value))}
        placeholder={loading ? "Cargando opciones..." : "Un valor por línea"}
        style={{ ...inputStyle, resize: "vertical" }}
      />
    );
  }

  return (
    <input
      type={variableMeta?.tipo === "fecha" ? "date" : variableMeta?.tipo === "num" ? "number" : "text"}
      value={typeof value === "string" ? value : paramList(value)[0] ?? ""}
      onChange={(e) => onChange(e.target.value)}
      placeholder={loading ? "Cargando opciones..." : "valor"}
      style={inputStyle}
    />
  );
}

// -----------------------------------------------------------------------------
function OpValor({
  title,
  variableMeta,
  baseNombre,
  op,
  valor,
  onOp,
  onValor,
}: {
  title: string;
  variableMeta?: ExploradorVariable;
  baseNombre?: string | null;
  op: string | undefined;
  valor: string | string[] | undefined;
  onOp: (o: string) => void;
  onValor: (v: string | string[]) => void;
}) {
  const conditionOp = (op ?? "") as ReglaGateCondition["op"];
  const isList = isListOperator(conditionOp);
  const operators = operatorOptionsForVariable(variableMeta);
  return (
    <div
      style={{
        padding: "10px 12px",
        border: "1px solid var(--pulso-border)",
        borderRadius: 8,
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--pulso-text-soft)", textTransform: "uppercase", letterSpacing: 0.4 }}>
        {title}
      </div>
      <select
        value={op ?? ""}
        onChange={(e) => {
          const nextOp = e.target.value;
          onOp(nextOp);
          if (isListOperator(nextOp as ReglaGateCondition["op"]) && typeof valor === "string") {
            onValor(paramList(valor));
          }
          if (!isListOperator(nextOp as ReglaGateCondition["op"]) && Array.isArray(valor)) {
            onValor(valor[0] ?? "");
          }
        }}
        style={inputStyle}
      >
        <option value="">Operador</option>
        {operators.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <GateValueControl
        variableMeta={variableMeta}
        baseNombre={baseNombre}
        op={conditionOp}
        value={valor}
        valueIsList={isList}
        onChange={onValor}
      />
    </div>
  );
}

// -----------------------------------------------------------------------------
function FieldRow({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: "var(--pulso-text-soft)", textTransform: "uppercase", letterSpacing: 0.4 }}>
        {label}
      </span>
      {children}
      {hint && <span style={{ fontSize: 10, color: "var(--pulso-text-soft)", lineHeight: 1.4 }}>{hint}</span>}
    </label>
  );
}

function hierarchyMapText(params: Record<string, unknown>) {
  const rawText = params.hierarchy_map_text;
  if (typeof rawText === "string") return rawText;
  const rawMap = params.hierarchy_map;
  if (rawMap && typeof rawMap === "object") {
    return JSON.stringify(rawMap, null, 2);
  }
  return "";
}

function hierarchyRowsFromParams(params: Record<string, unknown>): HierarchyRow[] {
  const rawRows = params.hierarchy_rows;
  if (Array.isArray(rawRows)) {
    return rawRows.map((raw) => {
      const row = raw as Record<string, unknown>;
      return {
        trigger: String(row.trigger ?? "").trim(),
        required: Array.isArray(row.required)
          ? row.required.map((value) => String(value).trim()).filter(Boolean).join("\n")
          : String(row.required ?? "").trim(),
      };
    });
  }

  const rawMap = params.hierarchy_map;
  if (rawMap && typeof rawMap === "object" && !Array.isArray(rawMap)) {
    return Object.entries(rawMap as Record<string, unknown>).map(([trigger, raw]) => ({
      trigger,
      required: paramList(raw).join("\n"),
    }));
  }

  const text = hierarchyMapText(params);
  if (text) {
    const parsed = parseHierarchyMapText(text);
    if (parsed.ok) {
      return Object.entries(parsed.value).map(([trigger, values]) => ({
        trigger,
        required: values.join("\n"),
      }));
    }
  }

  return [{ trigger: "", required: "" }];
}

function hierarchyMapFromRows(rows: HierarchyRow[]): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const row of rows) {
    const trigger = row.trigger.trim();
    const required = paramList(row.required).filter((value) => value !== trigger);
    if (trigger && required.length) out[trigger] = Array.from(new Set(required));
  }
  return out;
}

function parseHierarchyMapText(text: string): { ok: true; value: Record<string, string[]> } | { ok: false; error: string } {
  const trimmed = text.trim();
  if (!trimmed) return { ok: false, error: "Define el mapa manual en formato JSON." };
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return { ok: false, error: "El mapa manual debe ser JSON válido." };
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { ok: false, error: "El mapa debe ser un objeto JSON: cada clave activa una lista de códigos." };
  }
  const out: Record<string, string[]> = {};
  for (const [trigger, raw] of Object.entries(parsed as Record<string, unknown>)) {
    const key = String(trigger).trim();
    const values = Array.isArray(raw) ? raw : typeof raw === "string" ? raw.split(/[,\s]+/) : [];
    const clean = values.map((value) => String(value).trim()).filter((value) => value && value !== key);
    if (key && clean.length) out[key] = Array.from(new Set(clean));
  }
  return { ok: true, value: out };
}

function normalizeParamsForSubmit(tipo: ReglaCustomTipo, params: Record<string, unknown>) {
  const rest = { ...params };
  if (tipo === "rango_fecha") {
    return { ...rest, timezone: String(params.timezone ?? "America/Lima").trim() || "America/Lima" };
  }
  if (tipo === "duplicados") {
    return { ...rest, missing_key_policy: "ignore_missing" };
  }
  if (tipo === "select_multiple_hierarchy") {
    const map = hierarchyMapFromRows(hierarchyRowsFromParams(params));
    delete rest.hierarchy_map_text;
    return { ...rest, hierarchy_map: map };
  }
  if (tipo === "select_multiple_exclusive") {
    return { ...rest, exclusive_codes: paramList(params.exclusive_codes) };
  }
  if (tipo === "select_multiple_cardinality") {
    const min = nullableNumber(params.min);
    const max = nullableNumber(params.max);
    return {
      ...rest,
      ...(min === null ? {} : { min }),
      ...(max === null ? {} : { max }),
    };
  }
  if (tipo === "select_multiple_selection") {
    return { ...rest, op: String(params.op ?? "contains_any"), codes: paramList(params.codes) };
  }
  return params;
}

function paramList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((x) => String(x).trim()).filter(Boolean);
  if (typeof value === "string") return parseListText(value);
  if (value === null || value === undefined) return [];
  return [String(value).trim()].filter(Boolean);
}

function parseListText(text: string): string[] {
  return text
    .split(/\r?\n|,/)
    .map((x) => x.trim())
    .filter(Boolean);
}

function listText(value: unknown): string {
  return paramList(value).join("\n");
}

function nullableNumber(value: unknown): number | null {
  if (value === "" || value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function isValidTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("es-PE", { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

function variableTipoLabel(tipo: ExploradorVariable["tipo"]) {
  if (tipo === "sm") return "selección múltiple";
  if (tipo === "so") return "opción única";
  if (tipo === "num") return "número";
  if (tipo === "fecha") return "fecha";
  if (tipo === "texto") return "texto";
  return "mixta";
}

function formatVariableOption(variable: ExploradorVariable): string {
  const label = variable.label && variable.label !== variable.name
    ? `${variable.label} · ${variable.name}`
    : variable.name;
  return `${label} · ${variableTipoLabel(variable.tipo)}`;
}

function emptyGateCondition(flatVars: ExploradorVariable[]): ReglaGateCondition {
  const first = flatVars[0];
  const op = operatorOptionsForVariable(first)[0]?.value ?? "==";
  return { variable: first?.name ?? "", op, value: isListOperator(op) ? [] : "" };
}

function operatorOptionsForVariable(variable?: ExploradorVariable): Array<{ value: ReglaGateCondition["op"]; label: string }> {
  if (variable?.tipo === "sm") {
    return [
      { value: "contains", label: "incluye" },
      { value: "not_contains", label: "no incluye" },
      { value: "contains_any", label: "incluye alguna" },
      { value: "contains_all", label: "incluye todas" },
      { value: "contains_none", label: "excluye todas" },
    ];
  }
  if (variable?.tipo === "so") {
    return [
      { value: "==", label: "es" },
      { value: "!=", label: "no es" },
      { value: "in", label: "está entre" },
      { value: "not_in", label: "no está entre" },
    ];
  }
  const base: Array<{ value: ReglaGateCondition["op"]; label: string }> = [
    { value: "==", label: "es" },
    { value: "!=", label: "no es" },
    { value: "in", label: "está en" },
    { value: "not_in", label: "no está en" },
  ];
  if (variable?.tipo === "num" || variable?.tipo === "fecha") {
    return [
      ...base,
      { value: ">", label: "mayor que" },
      { value: ">=", label: "mayor o igual" },
      { value: "<", label: "menor que" },
      { value: "<=", label: "menor o igual" },
    ];
  }
  return base;
}

function isListOperator(op: ReglaGateCondition["op"]): boolean {
  return ["in", "not_in", "contains_any", "contains_all", "contains_none"].includes(op);
}

function validateGateConditions(conditions: ReglaGateCondition[]): string {
  for (const cond of conditions) {
    if (!cond.variable) return "Cada condición debe tener variable.";
    if (!cond.op) return "Cada condición debe tener operador.";
    const values = paramList(cond.value);
    if (!values.length) return "Cada condición debe tener valor u opción.";
  }
  return "";
}

type TreatmentActionMeta = {
  value: ReglaTreatmentActionType;
  label: string;
  description: string;
};

const TREATMENT_ACTIONS: Record<ReglaTreatmentActionType, TreatmentActionMeta> = {
  ignore_rule: {
    value: "ignore_rule",
    label: "Registrar sin cambios",
    description: "Conserva la señal como evidencia para la cola.",
  },
  replace_value: {
    value: "replace_value",
    label: "Corregir valor",
    description: "Cambia un valor observado por otro.",
  },
  set_value: {
    value: "set_value",
    label: "Asignar valor",
    description: "Completa un valor definido para el campo.",
  },
  recode_map: {
    value: "recode_map",
    label: "Recodificar equivalencias",
    description: "Convierte valores por un mapa de correspondencias.",
  },
  complete_select_multiple_hierarchy: {
    value: "complete_select_multiple_hierarchy",
    label: "Completar selección múltiple",
    description: "Agrega opciones esperadas cuando falta una marca asociada.",
  },
  adjust_select_multiple: {
    value: "adjust_select_multiple",
    label: "Agregar o quitar opciones",
    description: "Ajusta marcas específicas en una selección múltiple.",
  },
  nullify_fields: {
    value: "nullify_fields",
    label: "Anular campos",
    description: "Vacía un campo o un bloque de variables.",
  },
  exclude_cases: {
    value: "exclude_cases",
    label: "Excluir registros",
    description: "Retira registros de la base final.",
  },
};

const TREATMENT_SCOPES: Array<{
  value: ReglaTreatmentScope;
  label: string;
  description: string;
}> = [
  {
    value: "all",
    label: "Todos",
    description: "Mismo tratamiento para todos los hallazgos.",
  },
  {
    value: "selected",
    label: "Selección",
    description: "Elegir registros antes de aplicar.",
  },
  {
    value: "single",
    label: "Uno por uno",
    description: "Decidir registro por registro.",
  },
];

function treatmentActionsForTipo(tipo: ReglaCustomTipo): TreatmentActionMeta[] {
  const values: ReglaTreatmentActionType[] =
    tipo === "select_multiple_hierarchy"
      ? ["complete_select_multiple_hierarchy", "adjust_select_multiple", "ignore_rule", "nullify_fields", "exclude_cases"]
      : tipo === "select_multiple_exclusive" || tipo === "select_multiple_cardinality" || tipo === "select_multiple_selection"
        ? ["adjust_select_multiple", "nullify_fields", "ignore_rule", "exclude_cases"]
        : tipo === "duplicados"
          ? ["exclude_cases", "ignore_rule", "nullify_fields"]
          : tipo === "fuera_catalogo"
            ? ["recode_map", "replace_value", "ignore_rule", "nullify_fields", "exclude_cases"]
            : tipo === "no_nulo"
              ? ["set_value", "ignore_rule", "nullify_fields", "exclude_cases"]
              : ["ignore_rule", "replace_value", "set_value", "nullify_fields", "exclude_cases"];
  return values.map((value) => TREATMENT_ACTIONS[value]);
}

function treatmentDefaultFor(tipo: ReglaCustomTipo | null): {
  action: ReglaTreatmentActionType;
  scope: ReglaTreatmentScope;
} {
  switch (tipo) {
    case "select_multiple_hierarchy":
      return { action: "complete_select_multiple_hierarchy", scope: "all" };
    case "select_multiple_exclusive":
    case "select_multiple_cardinality":
    case "select_multiple_selection":
      return { action: "adjust_select_multiple", scope: "selected" };
    case "duplicados":
      return { action: "exclude_cases", scope: "selected" };
    case "fuera_catalogo":
      return { action: "recode_map", scope: "all" };
    case "no_nulo":
      return { action: "set_value", scope: "selected" };
    case "rango_num":
    case "rango_fecha":
    case "coherencia_2v":
    default:
      return { action: "ignore_rule", scope: "single" };
  }
}

function normalizeTreatmentAction(
  value: unknown,
  fallback: ReglaTreatmentActionType,
): ReglaTreatmentActionType {
  const raw = String(value ?? "");
  return raw in TREATMENT_ACTIONS ? (raw as ReglaTreatmentActionType) : fallback;
}

function normalizeTreatmentScope(
  value: unknown,
  fallback: ReglaTreatmentScope,
): ReglaTreatmentScope {
  const raw = String(value ?? "");
  return raw === "all" || raw === "selected" || raw === "single"
    ? raw
    : fallback;
}

function gateExprFromConditions(conditions: ReglaGateCondition[]): string {
  const parts = conditions
    .filter((cond) => cond.variable && cond.op && paramList(cond.value).length)
    .map((cond) => gateConditionToExpr(cond))
    .filter(Boolean);
  return parts.join(" and ");
}

function gateConditionToExpr(cond: ReglaGateCondition): string {
  const values = paramList(cond.value);
  const varRef = `\${${cond.variable}}`;
  if (cond.op === "contains") {
    return `selected(${varRef}, ${quoteGateValue(values[0] ?? "")})`;
  }
  if (cond.op === "not_contains") {
    return `not(selected(${varRef}, ${quoteGateValue(values[0] ?? "")}))`;
  }
  if (cond.op === "contains_all") {
    return values.map((value) => `selected(${varRef}, ${quoteGateValue(value)})`).join(" and ");
  }
  if (cond.op === "contains_any") {
    return values.map((value) => `selected(${varRef}, ${quoteGateValue(value)})`).join(" or ");
  }
  if (cond.op === "contains_none") {
    return values.map((value) => `not(selected(${varRef}, ${quoteGateValue(value)}))`).join(" and ");
  }
  if (cond.op === "in" || cond.op === "not_in") {
    const joined = values.map(quoteGateValue).join(", ");
    const fn = cond.op === "in" ? "in" : "not_in";
    return `${fn}(${varRef}, ${joined})`;
  }
  const op = cond.op === "==" ? "=" : cond.op;
  return `${varRef} ${op} ${quoteGateValue(values[0] ?? "")}`;
}

function quoteGateValue(value: string): string {
  return `"${String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

const inputStyle: React.CSSProperties = {
  fontSize: 12,
  padding: "7px 10px",
  borderRadius: 6,
  border: "1px solid var(--pulso-border)",
  outline: "none",
  width: "100%",
  boxSizing: "border-box",
};

const secondarySmallButtonStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  padding: "5px 10px",
  borderRadius: 6,
  border: "1px solid var(--pulso-border)",
  background: "white",
  color: "var(--pulso-text)",
  cursor: "pointer",
};

const emptyInlineStyle: React.CSSProperties = {
  border: "1px dashed var(--pulso-border)",
  borderRadius: 8,
  background: "var(--pulso-surface)",
  color: "var(--pulso-text-soft)",
  fontSize: 11,
};

// =============================================================================
// NarrativePreview — "Así se va a leer esta regla" en tiempo real.
// Usa RuleNarrative en variant hero para que el usuario vea el mismo
// formato con el que aparecerá en listas / cola de limpieza / drills.
// =============================================================================
function NarrativePreview({
  rule,
  variableHoverLookup,
  labelLookup,
}: {
  rule: ReturnType<typeof draftCustomToRule>;
  variableHoverLookup: (varName: string) => VariableHoverData | undefined;
  labelLookup: (varName: string) => string | null;
}) {
  if (!rule) return null;
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 6,
        padding: "10px 12px 12px",
        background: "var(--pulso-surface)",
        borderRadius: 10,
        border: "1px dashed var(--pulso-primary-border)",
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 800,
          textTransform: "uppercase",
          letterSpacing: 0.5,
          color: "var(--pulso-primary)",
        }}
      >
        Así se va a leer esta regla
      </div>
      <RuleNarrative
        rule={rule}
        variant="hero"
        variableHoverLookup={variableHoverLookup}
        labelLookup={labelLookup}
        // Hovercards de variable desactivados en el preview: con cada
        // keystroke el preview se re-renderiza y los portals del hover
        // hacían que la app se cayera en bases grandes (acumulación de
        // listeners + re-pos calcs en scroll). Además no aportan info
        // aquí — el usuario está justo eligiendo las variables en el
        // mismo wizard.
        disableVariableHover
      />
    </div>
  );
}
