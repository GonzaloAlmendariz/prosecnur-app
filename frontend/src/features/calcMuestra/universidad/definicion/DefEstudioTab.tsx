/**
 * Pestaña "Estudio" de Definición: a la izquierda la identidad del estudio
 * (título, cliente, alcance, fuente y base esperada) y a la derecha el mapa
 * del recorrido muestral — universo → elegibles → población (N) → muestra (n)
 * → aulas M1 — con cifras vivas del motor cuando existen. La primera vez
 * (sin bases ni marco) abre con un hero que responde "¿con qué insumo
 * empiezas?" y el recorrido completo ilustrado; con avance, el recorrido se
 * compacta arriba del mapa con el "Estás aquí" según lo que ya esté listo.
 * La capa didáctica (contexto llano, ejemplo trabajado y respaldo citable)
 * vive en esta misma pestaña, dentro de UniversidadDesk.
 */
import { useState } from "react";
import { ArrowLeft, BookOpenText, ChevronDown, ClipboardList, Database, FileSpreadsheet } from "lucide-react";
import type {
  CalcMuestraAulasState,
  CalcMuestraComponente,
  CalcMuestraEstudio,
  CalcMuestraWorkspace,
  CalcMuestraWorkspaceSourceMode,
} from "../../../../api/client";
import { BadgeMotor, ContextoLlano, RespaldoMetodologico } from "../../didactica/PasoDidactico";
import { EJEMPLO_TRABAJADO } from "../../didactica/referencia/corpus";
import { fmtInt, safeNumber } from "../../sharedCore";
import { ensureUniversitySourceBindings } from "../shared/categorias";
import { UNIVERSITY_REQUIRED_VARIABLES, UNIVERSITY_SOURCE_MODE_OPTIONS } from "../shared/constants";
import { classroomM1RowsForState, frameAuditNumber } from "../shared/frame";
import { FlujoVertical, type FlujoEtapa } from "../ui";
import { MuestraFlowDiagram, type MuestraFlowNodeKey } from "../ui/MuestraFlowDiagram";
import "../../didactica/didactica.css";
import "./definicion.css";

export function DefEstudioTab({
  estudio,
  workspace,
  totalComp,
  aulasState,
  onTitulo,
  onContexto,
  onWorkspace,
}: {
  estudio: CalcMuestraEstudio;
  workspace: CalcMuestraWorkspace;
  totalComp: CalcMuestraComponente;
  aulasState: CalcMuestraAulasState | null;
  onTitulo: (titulo: string) => void;
  onContexto: (campo: "cliente" | "tipo_cliente" | "descripcion_libre", valor: string) => void;
  onWorkspace: (workspace: CalcMuestraWorkspace) => void;
}) {
  const frame = aulasState?.frame ?? null;
  const universo = frameAuditNumber(frame, "input_rows");
  const elegibles = frameAuditNumber(frame, "eligible_student_rows");
  const poblacion = frameAuditNumber(frame, "population_n") || safeNumber(totalComp.marco.marco_validado, 0);
  const muestra = safeNumber(totalComp.resultado?.n_objetivo, 0);
  const aulasM1 = classroomM1RowsForState(aulasState).length;
  const filasExcluidas = universo > 0 && elegibles > 0 ? Math.max(0, universo - elegibles) : 0;
  const hayCifrasMotor = universo > 0 || poblacion > 0 || muestra > 0 || aulasM1 > 0;

  // Recorrido completo: qué pasos ya rindieron resultado. Con nada cargado
  // (ni base ni marco) el tab abre con el hero de primera vez; con avance, el
  // recorrido se compacta y el "Estás aquí" apunta al primer paso pendiente.
  const hayBases = (workspace.source_bindings ?? []).some((binding) => binding.file_id);
  const variablesListas = UNIVERSITY_REQUIRED_VARIABLES
    .filter((row) => row.required)
    .every((row) => (workspace.variable_mappings ?? []).some((m) => m.role === row.role && m.column));
  const primeraVez = !hayBases && !hayCifrasMotor;
  const estadosRecorrido: Record<MuestraFlowNodeKey, "ready" | "pending"> = {
    definir: estudio.titulo.trim() ? "ready" : "pending",
    bases: hayBases ? "ready" : "pending",
    variables: hayBases && variablesListas ? "ready" : "pending",
    marco: poblacion > 0 ? "ready" : "pending",
    calcular: muestra > 0 ? "ready" : "pending",
    aulas: aulasM1 > 0 ? "ready" : "pending",
  };
  const highlightRecorrido: MuestraFlowNodeKey = !hayBases
    ? "bases"
    : !variablesListas
      ? "variables"
      : poblacion <= 0
        ? "marco"
        : muestra <= 0
          ? "calcular"
          : "aulas";

  const etapas: FlujoEtapa[] = [
    {
      id: "universo",
      label: "Universo",
      valor: universo > 0 ? fmtInt(universo) : undefined,
      detalle: universo > 0 ? "filas leídas del archivo" : "se conoce al leer la base",
      estado: universo > 0 ? "ready" : "pending",
      merma: filasExcluidas > 0 ? { n: filasExcluidas, label: "filas excluidas" } : undefined,
    },
    {
      id: "elegibles",
      label: "Elegibles",
      valor: elegibles > 0 ? fmtInt(elegibles) : undefined,
      detalle: elegibles > 0 ? "filas que cumplen los criterios" : "según criterios de inclusión",
      estado: elegibles > 0 ? "ready" : "pending",
    },
    {
      id: "poblacion",
      label: "Población",
      valor: poblacion > 0 ? fmtInt(poblacion) : undefined,
      detalle: poblacion > 0 ? "N · estudiantes únicos" : "N · estudiantes únicos por representar",
      estado: poblacion > 0 ? "ready" : "pending",
    },
    {
      id: "muestra",
      label: "Muestra",
      valor: muestra > 0 ? fmtInt(muestra) : undefined,
      detalle: muestra > 0 ? "n · objetivo calculado" : "n · se calcula en Cálculo",
      estado: muestra > 0 ? "ready" : "pending",
    },
    {
      id: "aulas",
      label: "Aulas M1",
      valor: aulasM1 > 0 ? fmtInt(aulasM1) : undefined,
      detalle: aulasM1 > 0 ? "aulas titulares sorteadas" : "se sortean en Aulas",
      estado: aulasM1 > 0 ? "ready" : "pending",
    },
  ];

  return (
    <div className="cmv2-did-stack">
      {primeraVez ? (
        <HeroPrimeraVez workspace={workspace} onWorkspace={onWorkspace} />
      ) : (
        <div className="cmv2-defi-flow-compact" aria-label="Avance del recorrido de la muestra">
          <MuestraFlowDiagram compacto highlight={highlightRecorrido} estados={estadosRecorrido} />
        </div>
      )}
      <ContextoLlano paso="definicion" />
      <div className="cmv2-defi-estudio-layout">
        <section className="cmv2-panel">
          <div className="cmv2-defi-form">
            <label className="cmv2-compact-field">
              <span>Título</span>
              <input
                value={estudio.titulo}
                placeholder="Encuesta a estudiantes"
                onChange={(e) => onTitulo(e.currentTarget.value)}
              />
            </label>
            <label className="cmv2-compact-field">
              <span>Cliente</span>
              <input
                value={estudio.contexto.cliente}
                placeholder="Institución o área solicitante"
                onChange={(e) => onContexto("cliente", e.currentTarget.value)}
              />
            </label>
            <label className="cmv2-compact-field cmv2-compact-field--wide">
              <span>Alcance o nota del estudio</span>
              <textarea
                value={estudio.contexto.descripcion_libre}
                placeholder="Qué población se busca representar, periodo académico, exclusiones acordadas o condiciones de campo."
                onChange={(e) => onContexto("descripcion_libre", e.currentTarget.value)}
              />
            </label>
            <label className="cmv2-compact-field">
              <span>Fuente institucional esperada</span>
              <input
                value={workspace.fuente_marco}
                placeholder="Registro académico, matrícula o sistema equivalente"
                onChange={(e) => onWorkspace({ ...workspace, fuente_marco: e.currentTarget.value })}
              />
            </label>
            <label className="cmv2-compact-field">
              <span>Base esperada</span>
              <input
                value={workspace.marco_disponible}
                placeholder="Base principal o bases institucionales equivalentes"
                onChange={(e) => onWorkspace({ ...workspace, marco_disponible: e.currentTarget.value })}
              />
            </label>
          </div>
        </section>
        <aside className="cmv2-panel cmv2-defi-mapa cmv2-defi-stagger" aria-label="Mapa del recorrido muestral">
          <div className="cmv2-defi-mapa-head">
            <span className="cmv2-eyebrow">Mapa del recorrido</span>
            {hayCifrasMotor && <BadgeMotor estado="validado" />}
          </div>
          <FlujoVertical etapas={etapas} ariaLabel="Del universo a las aulas titulares" />
        </aside>
      </div>
      <EjemploTrabajado />
      <RespaldoMetodologico paso="definicion" />
    </div>
  );
}

// -----------------------------------------------------------------------------
// HeroPrimeraVez — punto de entrada cuando no hay bases ni marco
// -----------------------------------------------------------------------------

const HERO_BADGES: Record<CalcMuestraWorkspaceSourceMode, string> = {
  base_madre: "Recomendado",
  dos_bases: "Equivalente",
  seleccion_existente: "Lectura histórica",
};

const HERO_ICONS: Record<CalcMuestraWorkspaceSourceMode, typeof FileSpreadsheet> = {
  base_madre: FileSpreadsheet,
  dos_bases: Database,
  seleccion_existente: ClipboardList,
};

/**
 * Hero compacto estilo EmptyHome: pregunta directa + una tarjeta por insumo
 * posible. Elegir una tarjeta declara el modo de fuente (onWorkspace); el
 * archivo se sube en la pestaña Bases del sidebar — este tab no navega, así
 * que la confirmación apunta con una flecha hacia esa pestaña. Debajo, el
 * recorrido completo con "Estás aquí" en Definir.
 */
function HeroPrimeraVez({
  workspace,
  onWorkspace,
}: {
  workspace: CalcMuestraWorkspace;
  onWorkspace: (workspace: CalcMuestraWorkspace) => void;
}) {
  const [modoElegido, setModoElegido] = useState<CalcMuestraWorkspaceSourceMode | null>(null);
  const sourceMode = workspace.source_mode ?? "base_madre";

  function elegirModo(next: CalcMuestraWorkspaceSourceMode) {
    onWorkspace({
      ...workspace,
      source_mode: next,
      source_bindings: ensureUniversitySourceBindings(next, workspace.source_bindings),
    });
    setModoElegido(next);
  }

  const etiquetaElegida = modoElegido
    ? UNIVERSITY_SOURCE_MODE_OPTIONS.find((option) => option.id === modoElegido)?.label
    : null;

  return (
    <section className="cmv2-panel cmv2-defi-hero" aria-label="Por dónde empezar">
      <span className="cmv2-eyebrow">Primer paso</span>
      <h3 className="cmv2-defi-hero-title">¿Con qué insumo empiezas?</h3>
      <p className="cmv2-defi-hero-lead">
        Todo el recorrido nace de un Excel institucional. Elige el que tienes a la mano;
        el resto — marco, cálculo y aulas — se construye aquí.
      </p>
      <div className="cmv2-defi-hero-cards cmv2-uni-stagger">
        {UNIVERSITY_SOURCE_MODE_OPTIONS.map((option) => {
          const Icon = HERO_ICONS[option.id];
          return (
            <button
              key={option.id}
              type="button"
              className="cmv2-defi-hero-card"
              aria-pressed={option.id === sourceMode}
              onClick={() => elegirModo(option.id)}
            >
              <span className="cmv2-defi-hero-card-top">
                <span className="cmv2-defi-hero-card-icon" aria-hidden="true">
                  <Icon size={17} />
                </span>
                <small className="cmv2-defi-chip" data-tone={option.id === "base_madre" ? "req" : undefined}>
                  {HERO_BADGES[option.id]}
                </small>
              </span>
              <strong>{option.label}</strong>
              <span>{option.detail}</span>
            </button>
          );
        })}
      </div>
      {etiquetaElegida ? (
        <p className="cmv2-defi-hero-nota" data-tone="ok" role="status">
          <ArrowLeft size={13} aria-hidden="true" />
          <span>
            Listo: quedó declarado <strong>{etiquetaElegida}</strong>. Sube tu Excel en la
            pestaña <strong>Bases</strong> del panel izquierdo.
          </span>
        </p>
      ) : (
        <p className="cmv2-defi-hero-nota">
          <ArrowLeft size={13} aria-hidden="true" />
          <span>
            Al elegir, el modo queda declarado y el archivo se sube en la pestaña{" "}
            <strong>Bases</strong> del panel izquierdo.
          </span>
        </p>
      )}
      <div className="cmv2-defi-hero-guide">
        <span className="cmv2-eyebrow">El recorrido completo</span>
        <p>
          Seis pasos encadenados, del estudio a las aulas que se visitan. Cada pestaña del
          panel izquierdo cubre un tramo; la calculadora valida cada resultado antes de avanzar.
        </p>
        <MuestraFlowDiagram highlight="definir" />
      </div>
    </section>
  );
}

/** Ejemplo numérico trabajado, plegable, destilado de los estudios de referencia. */
export function EjemploTrabajado() {
  return (
    <details className="cmv2-did-respaldo">
      <summary>
        <BookOpenText size={14} aria-hidden="true" />
        Ejemplo trabajado: del cálculo a la aplicación en un caso real
        <ChevronDown size={14} className="cmv2-did-respaldo-chevron" aria-hidden="true" />
      </summary>
      <div className="cmv2-did-respaldo-body">
        <p>{EJEMPLO_TRABAJADO.descripcion}</p>
        {EJEMPLO_TRABAJADO.narrativa.map((parrafo, i) => (
          <p key={i}>{parrafo}</p>
        ))}
      </div>
    </details>
  );
}
