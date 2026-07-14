/**
 * Tarjetas reutilizables de la sección Marco, desmontadas del antiguo
 * ClassroomFrameDashboard del monolito (F4). Cada tarjeta recibe los mismos
 * datos que recibía el dashboard (frame del motor R, componente total y
 * workspace) y calcula sus filas con los helpers de marcoCharts.tsx.
 * Composición final: MarcoPoblacionTab / MarcoAulasTab / MarcoConsistenciaTab.
 */
import { useState, type CSSProperties } from "react";
import {
  CheckCircle2,
  ClipboardList,
  Gauge,
  Grid3X3,
  Layers3,
  Target,
  Users,
} from "lucide-react";
import type {
  CalcMuestraAulasState,
  CalcMuestraComponente,
  CalcMuestraWorkspace,
  CalcMuestraWorkspaceAulasConfig,
} from "../../../../api/client";
import { fmtInt, fmtPct, fmtRatio, rowsFrom, safeNumber } from "../../sharedCore";
import { classroomRowNumber, classroomRowText } from "../shared/format";
import {
  universityCategoryProfileRows,
  workspaceCategoryLabel,
  type CategoryLabeler,
} from "../shared/categorias";
import { frameAuditNumber } from "../shared/frame";
import { UNIVERSITY_AULAS_SIZE_GROUPS } from "../shared/constants";
import {
  ClassroomBarPlot,
  ClassroomHeatmapPlot,
  ClassroomInsightGrid,
  ClassroomPlotCard,
  ClassroomStackedCrossPlot,
  DescriptiveEmptyNotice,
  UNIVERSITY_FACULTY_ROW_KEYS,
  UNIVERSITY_STUDENT_ROW_KEYS,
  buildCrossTable,
  buildWeightedCrossTable,
  classroomFacultySexCross,
  classroomRowBoolean,
  classroomSexRowsFromAulas,
  descriptiveMissingState,
  firstRowValue,
  frameCategoryProfileRows,
  frameCrossProfileTable,
  frameCrossSecondaryRows,
  safeShare,
  sumRowsByKeys,
  uniqueRowsByKeys,
  universityFacultyDiagnosticRows,
  universityFacultySexCross,
  weightedDistributionRows,
  type ClassroomInsight,
  type CrossTable,
  type DescriptiveEmptyState,
} from "./marcoCharts";
import "./marco.css";

type MarcoFrame = CalcMuestraAulasState["frame"] | null;

const WEIGHTED_KEYS = ["eligible_n", "elegibles", "n_elegibles", "students_n", "matriculados", "total"];

/** Filas base del marco: población deduplicada, aulas válidas y exclusiones. */
export function marcoFrameRows(frame: MarcoFrame, workspace?: CalcMuestraWorkspace) {
  const populationRowsRaw = rowsFrom<Record<string, unknown>>(frame?.population);
  const studentIdColumn = (workspace?.variable_mappings ?? []).find((row) => row.role === "student_id")?.column ?? "";
  const populationRows = uniqueRowsByKeys(populationRowsRaw, [studentIdColumn, ...UNIVERSITY_STUDENT_ROW_KEYS].filter(Boolean));
  const classroomRowsRaw = rowsFrom<Record<string, unknown>>(frame?.aula_frame);
  const classroomRows = classroomRowsRaw.filter((row) => classroomRowBoolean(row, "included") || classroomRowsRaw.every((item) => item.included === undefined));
  const exclusionRows = rowsFrom<Record<string, unknown>>(frame?.exclusions);
  return { populationRows, classroomRowsRaw, classroomRows, exclusionRows };
}

function labelerFor(workspace?: CalcMuestraWorkspace) {
  return (role: string): CategoryLabeler => (value, key) => workspaceCategoryLabel(workspace, role, value, key);
}

/** Cifras de población del marco (audit del motor + filas leídas). */
export function marcoPopulationFigures(frame: MarcoFrame, totalComp: CalcMuestraComponente, workspace?: CalcMuestraWorkspace) {
  const { populationRows, exclusionRows } = marcoFrameRows(frame, workspace);
  const marcoN = Math.max(safeNumber(totalComp.marco.marco_validado, 0), safeNumber(totalComp.marco.universo_bruto, 0));
  const inputRows = Math.max(frameAuditNumber(frame, "input_rows"), populationRows.length, marcoN);
  const eligibleRows = Math.max(frameAuditNumber(frame, "eligible_student_rows"), frameAuditNumber(frame, "population_n"), populationRows.length, marcoN);
  const populationN = Math.max(populationRows.length, frameAuditNumber(frame, "population_n"), safeNumber((frame as Record<string, unknown> | null)?.population_n, 0), marcoN);
  const excludedN = Math.max(exclusionRows.length, frameAuditNumber(frame, "excluded_rows"));
  const eligibilityRate = safeShare(eligibleRows, inputRows);
  const dedupeLoad = eligibleRows > 0 && populationN > 0 ? 1 - safeShare(populationN, eligibleRows) : Number.NaN;
  return { inputRows, eligibleRows, populationN, excludedN, eligibilityRate, dedupeLoad };
}

/**
 * Filas de facultad SIN recorte en origen: los datos llegan completos al
 * chart y es ClassroomBarPlot quien aplica la política "todas si caben,
 * top-N + fila 'y N más' si no" (ver marcoCharts.tsx).
 */
function populationFacultyRows(frame: MarcoFrame, totalComp: CalcMuestraComponente, workspace?: CalcMuestraWorkspace) {
  const { populationRows, classroomRows } = marcoFrameRows(frame, workspace);
  const labelFor = labelerFor(workspace);
  const profileFacultyRows = frameCategoryProfileRows(frame, "faculty", labelFor("faculty"), 99, "total");
  const facultyFromAulas = weightedDistributionRows(classroomRows, ["faculty", "facultad", "unidad_academica", "stratum"], ["eligible_n", "matriculados_poblacion", "enrolled_total"], 99, labelFor("faculty"), "total");
  const facultyFromMarco = populationRows.length
    ? universityFacultyDiagnosticRows(totalComp, populationRows, { sortMode: "total", maxRows: 99 })
    : profileFacultyRows.length
      ? profileFacultyRows
      : universityFacultyDiagnosticRows(totalComp, [], { sortMode: "total", maxRows: 99 });
  return facultyFromMarco.length ? facultyFromMarco : facultyFromAulas;
}

/* ============================================================================
   Población: lecturas rápidas (insight grid del dashboard, alcance población)
   ============================================================================ */

export function MarcoPoblacionInsights({
  frame,
  totalComp,
  workspace,
}: {
  frame: MarcoFrame;
  totalComp: CalcMuestraComponente;
  workspace: CalcMuestraWorkspace;
}) {
  const { populationRows, classroomRows } = marcoFrameRows(frame, workspace);
  const labelFor = labelerFor(workspace);
  const { eligibilityRate, dedupeLoad, populationN } = marcoPopulationFigures(frame, totalComp, workspace);
  const facultyPopulation = populationFacultyRows(frame, totalComp, workspace);
  const facultyPopulationTotal = facultyPopulation.reduce((sum, row) => sum + row.value, 0) || populationN;
  const largestFaculty = facultyPopulation.slice().sort((a, b) => b.value - a.value)[0];
  const largestFacultyShare = largestFaculty ? safeShare(largestFaculty.value, facultyPopulationTotal) : Number.NaN;
  const profileSexRows = frameCategoryProfileRows(frame, "sex", labelFor("sex"), 4, "total");
  const sexRows = populationRows.length
    ? universityCategoryProfileRows(populationRows, ["sex", "sexo", "genero"], totalComp.marco.estratos ?? [], labelFor("sex"))
    : profileSexRows.length
      ? profileSexRows
      : classroomRows.length
        ? classroomSexRowsFromAulas(classroomRows, 4, labelFor("sex"))
        : universityCategoryProfileRows([], ["sex", "sexo", "genero"], totalComp.marco.estratos ?? []);
  const sexTotal = sexRows.reduce((sum, row) => sum + row.value, 0);
  const dominantSex = sexRows.slice().sort((a, b) => b.value - a.value)[0];
  const dominantSexShare = dominantSex ? safeShare(dominantSex.value, sexTotal) : Number.NaN;
  const items: ClassroomInsight[] = [
    {
      label: "Elegibilidad",
      value: Number.isFinite(eligibilityRate) ? fmtPct(eligibilityRate) : "pendiente",
      detail: "filas que superan filtros de población",
      tone: Number.isFinite(eligibilityRate) && eligibilityRate >= 0.75 ? "good" : "warn",
      icon: CheckCircle2,
    },
    {
      label: "Repetición",
      value: Number.isFinite(dedupeLoad) ? fmtPct(dedupeLoad) : "pendiente",
      detail: "filas repetidas que se consolidan en estudiantes únicos",
      tone: "info",
      icon: Layers3,
    },
    {
      label: "Dominio mayor",
      value: largestFaculty?.label ?? "pendiente",
      detail: Number.isFinite(largestFacultyShare) ? `${fmtPct(largestFacultyShare)} de la población` : "requiere facultad",
      tone: Number.isFinite(largestFacultyShare) && largestFacultyShare > 0.25 ? "warn" : "neutral",
      icon: Target,
    },
    {
      label: "Cuotas sexo",
      value: dominantSex?.label ?? "pendiente",
      detail: Number.isFinite(dominantSexShare) ? `${fmtPct(dominantSexShare)} categoría dominante` : "requiere variable",
      tone: "neutral",
      icon: Users,
    },
  ];
  return <ClassroomInsightGrid items={items} />;
}

/* ============================================================================
   Población: facultades + carreras (drill por clic) y sexo agregado
   ============================================================================ */

export function MarcoPoblacionFacultades({
  frame,
  totalComp,
  workspace,
}: {
  frame: MarcoFrame;
  totalComp: CalcMuestraComponente;
  workspace: CalcMuestraWorkspace;
}) {
  const { populationRows, classroomRows } = marcoFrameRows(frame, workspace);
  const labelFor = labelerFor(workspace);
  const [programFocusFaculty, setProgramFocusFaculty] = useState("");
  const facultyPopulation = populationFacultyRows(frame, totalComp, workspace);
  const facultyPopulationTotal = facultyPopulation.reduce((sum, row) => sum + row.value, 0);
  // §4.2.5: la barra por facultad se apila por sexo (una barra por facultad).
  const populationSexTable = universityFacultySexCross(
    totalComp,
    populationRows,
    workspace,
    frameCrossProfileTable(frame, "faculty", "sex", workspace, 99, 4, "faculty", "label"),
  );
  const populationSexTableTotal = populationSexTable.rows.reduce(
    (sum, row) => sum + Object.values(row.values).reduce((inner, value) => inner + safeNumber(value, 0), 0),
    0,
  );
  const facultySexTable = populationSexTableTotal > 0
    ? populationSexTable
    : classroomFacultySexCross(totalComp, [], classroomRows, workspace);
  const facultySexTableHasData = facultySexTable.rows.length > 0 && facultySexTable.columns.length > 0;
  const populationGraphUsesClassrooms = !populationRows.length && classroomRows.length > 0;
  const populationPlotUnit = populationGraphUsesClassrooms ? "elegibles" : "personas";
  const defaultProgramFaculty = facultyPopulation[0]?.label ?? "";
  const programFocusAvailable = facultyPopulation.some((row) => row.label === programFocusFaculty);
  const activeProgramFaculty = programFocusAvailable ? programFocusFaculty : defaultProgramFaculty;
  const programPopulationRows = activeProgramFaculty
    ? populationRows.filter((row) => {
        const raw = firstRowValue(row, UNIVERSITY_FACULTY_ROW_KEYS);
        return raw ? workspaceCategoryLabel(workspace, "faculty", raw) === activeProgramFaculty : false;
      })
    : populationRows;
  const programRowsFromPopulation = programPopulationRows.length
    ? weightedDistributionRows(programPopulationRows, ["program", "programa", "career", "carrera", "especialidad"], [], 99, labelFor("program"))
    : [];
  const programRowsFromProfile = activeProgramFaculty
    ? frameCrossSecondaryRows(frame, "faculty", "program", activeProgramFaculty, workspace, 99)
    : [];
  const profileProgramRows = frameCategoryProfileRows(frame, "program", labelFor("program"), 99, "total");
  const populationCrossProfileRows = rowsFrom<Record<string, unknown>>((frame as Record<string, unknown> | null)?.population_cross_profiles);
  const legacyProgramFrame = Boolean(frame && classroomRows.length && !populationRows.length && !populationCrossProfileRows.length);
  const programRows = legacyProgramFrame
    ? []
    : programRowsFromPopulation.length
      ? programRowsFromPopulation
      : programRowsFromProfile.length
        ? programRowsFromProfile
        : !activeProgramFaculty
          ? profileProgramRows
          : [];
  const programRowsTotal = programRows.reduce((sum, row) => sum + row.value, 0);
  const missingAdministrativeProgramCross = Boolean(activeProgramFaculty) && !programRowsFromPopulation.length && !programRowsFromProfile.length;
  const hasPopulationSource = populationRows.length > 0 || classroomRows.length > 0 || Boolean(totalComp.marco.estratos?.length);
  const emptyStates: Record<"faculty" | "program", DescriptiveEmptyState> = {
    faculty: descriptiveMissingState(workspace, {
      role: "faculty",
      variable: "Facultad",
      source: populationGraphUsesClassrooms ? "marco de cursos-horario" : "base principal",
      hasSource: hasPopulationSource,
      impact: "Este gráfico necesita saber a qué facultad pertenece cada registro.",
      next: "Revisa Definición > Variables y vincula la columna Facultad.",
    }),
    program: legacyProgramFrame ? {
      badge: "Recalcular",
      title: "Reconstruye el marco para leer carreras",
      detail: "El marco guardado no permite confirmar la relación facultad-carrera.",
      next: "Vuelve a construirlo desde Definición > Bases.",
      chips: ["Marco guardado", "Recalcular"],
      tone: "waiting",
    } : missingAdministrativeProgramCross ? {
      badge: "Revisar",
      title: "Falta relación facultad-carrera",
      detail: "Este gráfico usa la carrera administrativa del estudiante. No se completa con cursos-horario para evitar mezclar cursos de otra facultad.",
      next: "Revisa Definición > Variables y confirma que Facultad y Carrera vienen de la base de estudiantes.",
      chips: ["Población", "No mezcla cursos-horario"],
      tone: "waiting",
    } : descriptiveMissingState(workspace, {
      role: "program",
      variable: "Programa o carrera",
      source: populationGraphUsesClassrooms ? "marco de cursos-horario" : "base principal",
      hasSource: hasPopulationSource,
      optional: true,
      impact: "Ayuda a leer concentraciones dentro de cada facultad.",
      next: "Si el archivo trae programa o carrera, asígnalo en Definición > Variables.",
    }),
  };
  return (
    <>
      <ClassroomPlotCard
        title={populationGraphUsesClassrooms ? "Elegibles por facultad" : "Población por facultad"}
        subtitle={populationGraphUsesClassrooms ? "alumnos elegibles en cursos-horario válidos, por sexo" : "estudiantes únicos elegibles del universo, por sexo"}
        wide
      >
        {facultySexTableHasData ? (
          <ClassroomStackedCrossPlot
            table={facultySexTable}
            ariaLabel="Población por facultad apilada por sexo"
            emptyState={emptyStates.faculty}
            sortByMaleSurplus
            showSegmentLabels
          />
        ) : (
          <ClassroomBarPlot
            rows={facultyPopulation}
            ariaLabel="Distribución de población por facultad"
            unit={populationPlotUnit}
            total={facultyPopulationTotal}
            emptyState={emptyStates.faculty}
            growOnMount
          />
        )}
      </ClassroomPlotCard>
      <ClassroomPlotCard
        title="Carreras por facultad"
        subtitle={activeProgramFaculty ? `carreras del alumnado en ${activeProgramFaculty}` : "elige una facultad para ver carreras"}
      >
        {facultyPopulation.length > 1 && (
          <label className="cmv2-marco-drill-select">
            <span>Facultad</span>
            <select value={activeProgramFaculty} onChange={(e) => setProgramFocusFaculty(e.currentTarget.value)}>
              {facultyPopulation.map((row) => (
                <option key={row.label} value={row.label}>{row.label}</option>
              ))}
            </select>
          </label>
        )}
        {/* key por facultad activa: el cambio remonta el contenido con un fade
            corto (150ms) en vez de swapear las barras en seco. */}
        <div key={activeProgramFaculty || "todas"} className="cmv2-marco-drill-swap">
          <ClassroomBarPlot rows={programRows} ariaLabel="Carreras o programas de la población" unit={populationPlotUnit} height={260} total={programRowsTotal} emptyState={emptyStates.program} />
        </div>
      </ClassroomPlotCard>
    </>
  );
}

export function MarcoPoblacionSexo({
  frame,
  totalComp,
  workspace,
}: {
  frame: MarcoFrame;
  totalComp: CalcMuestraComponente;
  workspace: CalcMuestraWorkspace;
}) {
  const { populationRows, classroomRows } = marcoFrameRows(frame, workspace);
  const labelFor = labelerFor(workspace);
  const populationGraphUsesClassrooms = !populationRows.length && classroomRows.length > 0;
  const profileSexRows = frameCategoryProfileRows(frame, "sex", labelFor("sex"), 4, "total");
  const sexRows = populationRows.length
    ? universityCategoryProfileRows(populationRows, ["sex", "sexo", "genero"], totalComp.marco.estratos ?? [], labelFor("sex"))
    : populationGraphUsesClassrooms
      ? classroomSexRowsFromAulas(classroomRows, 4, labelFor("sex"))
      : profileSexRows.length
        ? profileSexRows
        : universityCategoryProfileRows([], ["sex", "sexo", "genero"], totalComp.marco.estratos ?? []);
  const sexTotal = sexRows.reduce((sum, row) => sum + row.value, 0);
  // Una sola barra apilada (§4.2.4): la población entera como fila única,
  // segmentada por sexo. ClassroomStackedCrossPlot ordena las columnas y aplica
  // la pareja cromática canónica hombre/mujer con sortByMaleSurplus.
  const sexTable: CrossTable = {
    columns: sexRows.map((row) => row.label),
    rows: sexTotal > 0
      ? [{
          label: "Población",
          total: sexTotal,
          values: Object.fromEntries(sexRows.map((row) => [row.label, row.value])),
        }]
      : [],
  };
  const emptyState = descriptiveMissingState(workspace, {
    role: "sex",
    variable: "Sexo o género",
    source: populationGraphUsesClassrooms ? "marco de cursos-horario" : "base principal",
    hasSource: populationRows.length > 0 || classroomRows.length > 0 || Boolean(totalComp.marco.estratos?.length),
    impact: "Permite leer la composición esperada y auditar cuotas.",
    next: "Revisa Definición > Variables y vincula la columna Sexo o género.",
  });
  return (
    <ClassroomPlotCard
      title="Distribución por sexo"
      subtitle={populationGraphUsesClassrooms ? "composición esperada según cursos-horario válidos" : "estudiantes únicos elegibles"}
      wide
    >
      <ClassroomStackedCrossPlot
        table={sexTable}
        ariaLabel="Distribución por sexo de la población"
        height={132}
        emptyState={emptyState}
        sortByMaleSurplus
        showSegmentLabels
      />
    </ClassroomPlotCard>
  );
}

/* ============================================================================
   Población: estructura por controles (absorbe el antiguo marco-cruces)
   ============================================================================ */

export function MarcoEstructuraControles({
  frame,
  totalComp,
  workspace,
}: {
  frame: MarcoFrame;
  totalComp: CalcMuestraComponente;
  workspace: CalcMuestraWorkspace;
}) {
  const { populationRows, classroomRows } = marcoFrameRows(frame, workspace);
  const labelFor = labelerFor(workspace);
  const classroomLevelTable = buildWeightedCrossTable(classroomRows, ["faculty", "facultad", "unidad_academica", "stratum"], ["level", "nivel", "nivel_del_curso", "ciclo"], ["eligible_n"], 99, 99, { primary: labelFor("faculty"), secondary: labelFor("level"), rowSort: "faculty", columnSort: "ordinal" });
  const populationLevelProfileTable = frameCrossProfileTable(frame, "faculty", "level", workspace, 99, 99, "faculty", "ordinal");
  const levelTable = populationRows.length
    ? buildCrossTable(populationRows, ["faculty", "facultad", "unidad_academica"], ["level", "nivel", "ciclo", "anio"], 99, 99, { primary: labelFor("faculty"), secondary: labelFor("level"), rowSort: "faculty", columnSort: "ordinal" })
    : populationLevelProfileTable.rows.length
      ? populationLevelProfileTable
      : classroomLevelTable;
  const hasSource = populationRows.length > 0 || classroomRows.length > 0 || Boolean(totalComp.marco.estratos?.length);
  const levelEmptyState = descriptiveMissingState(workspace, {
    role: "level",
    variable: "Ciclo",
    source: "base principal",
    hasSource,
    optional: true,
    impact: "No bloquea el cálculo, pero muestra concentraciones por avance académico.",
    next: "Si existe ciclo, asígnalo en Definición > Variables.",
  });
  return (
    <div className="cmv2-dashboard-chart-grid">
      <ClassroomPlotCard title="Facultad por ciclo" subtitle="mapa de calor de estudiantes elegibles por avance académico" wide>
        <ClassroomHeatmapPlot table={levelTable} ariaLabel="Mapa de calor facultad por ciclo" minColumnWidth={56} emptyState={levelEmptyState} />
      </ClassroomPlotCard>
    </div>
  );
}

/* ============================================================================
   Aulas: capacidad del marco (embudo + lecturas del alcance "aulas")
   ============================================================================ */

export function MarcoAulasCapacidad({
  frame,
  workspace,
}: {
  frame: MarcoFrame;
  workspace: CalcMuestraWorkspace;
}) {
  const { classroomRowsRaw, classroomRows } = marcoFrameRows(frame, workspace);
  const classroomN = Math.max(classroomRows.length, frameAuditNumber(frame, "classroom_included_n"));
  const frameRecord = frame as Record<string, unknown> | null;
  const frameConfig = frameRecord?.config && typeof frameRecord.config === "object"
    ? frameRecord.config as Record<string, unknown>
    : {};
  const selectorConfig = frameConfig.selector && typeof frameConfig.selector === "object"
    ? frameConfig.selector as Record<string, unknown>
    : {};
  const requestedClassrooms = safeNumber(selectorConfig.n_aulas, 0);
  const validClassroomShare = safeShare(classroomN, classroomRowsRaw.length);
  const smallClassrooms = classroomRows.filter((row) => classroomRowNumber(row, WEIGHTED_KEYS) <= 20).length;
  const smallClassroomShare = safeShare(smallClassrooms, classroomRows.length);
  const contactRows = classroomRows.filter((row) =>
    firstRowValue(row, ["teacher", "docente", "profesor", "contacto", "teacher_email", "correo_docente", "correo_pucp"]),
  ).length;
  const contactCoverage = safeShare(contactRows, classroomRows.length);
  const reserveDepth = requestedClassrooms > 0 ? classroomN / requestedClassrooms : Number.NaN;
  const items: ClassroomInsight[] = [
    {
      label: "Profundidad",
      value: Number.isFinite(reserveDepth) ? fmtRatio(reserveDepth) : classroomN ? fmtInt(classroomN) : "pendiente",
      detail: requestedClassrooms ? `cursos-horario válidos / ${fmtInt(requestedClassrooms)} titulares` : "cursos-horario disponibles antes de seleccionar",
      tone: Number.isFinite(reserveDepth) && reserveDepth >= 3 ? "good" : "info",
      icon: Grid3X3,
    },
    {
      label: "Cursos-horario válidos",
      value: Number.isFinite(validClassroomShare) ? fmtPct(validClassroomShare) : "pendiente",
      detail: "cursos-horario que pasan al marco de aplicación",
      tone: Number.isFinite(validClassroomShare) && validClassroomShare >= 0.9 ? "good" : "warn",
      icon: CheckCircle2,
    },
    {
      label: "Cursos-horario pequeños",
      value: Number.isFinite(smallClassroomShare) ? fmtPct(smallClassroomShare) : "pendiente",
      detail: "cursos-horario con 20 o menos elegibles",
      tone: Number.isFinite(smallClassroomShare) && smallClassroomShare > 0.35 ? "warn" : "neutral",
      icon: Gauge,
    },
    {
      label: "Contacto",
      value: Number.isFinite(contactCoverage) ? fmtPct(contactCoverage) : "pendiente",
      detail: "cursos-horario con docente, contacto o correo operativo",
      tone: Number.isFinite(contactCoverage) && contactCoverage >= 0.8 ? "good" : "warn",
      icon: ClipboardList,
    },
  ];
  return <ClassroomInsightGrid items={items} />;
}

/* ============================================================================
   Aulas: histograma de tamaños con bandas G1-G4 y línea del mínimo
   ============================================================================ */

const MARCO_HISTO_BIN_WIDTH = 5;
const MARCO_HISTO_MAX = 60;

/** max ausente, 0 o no numérico = grupo abierto por arriba (ej. G4 "41+"). */
function marcoSizeGroupMax(raw: unknown) {
  const max = safeNumber(raw, Number.NaN);
  return Number.isFinite(max) && max > 0 ? max : Number.POSITIVE_INFINITY;
}

function marcoSizeGroupForValue(value: number, groups: CalcMuestraWorkspaceAulasConfig["grupos_tamano"]) {
  const group = (groups ?? []).find((item) =>
    value >= safeNumber(item.min, 0) && value <= marcoSizeGroupMax(item.max),
  );
  return group?.id ?? "";
}

/** Proyectos antiguos pueden conservar descripciones con “aula(s)”. La capa
 * visual normaliza el término y la concordancia sin migrar el `.pulso`. */
function courseScheduleGroupDescription(value: string) {
  return value
    .replace(/\b(?:aulas|cursos-horario) peque(?:ñ|n)as o especializadas\b/gi, "cursos-horario pequeños o especializados")
    .replace(/\b(?:aulas|cursos-horario) grandes o masivas\b/gi, "cursos-horario grandes o masivos")
    .replace(/\baulas peque(?:ñ|n)as\b/gi, "cursos-horario pequeños")
    .replace(/\baulas medianas\b/gi, "cursos-horario medianos")
    .replace(/\baulas est(?:á|a)ndar\b/gi, "cursos-horario estándar")
    .replace(/\baulas grandes\b/gi, "cursos-horario grandes")
    .replace(/\bcursos-horario peque(?:ñ|n)as\b/gi, "cursos-horario pequeños")
    .replace(/\bcursos-horario medianas\b/gi, "cursos-horario medianos")
    .replace(/\bcursos-horario est(?:á|a)ndar\b/gi, "cursos-horario estándar")
    .replace(/\baula peque(?:ñ|n)a\b/gi, "curso-horario pequeño")
    .replace(/\baula mediana\b/gi, "curso-horario mediano")
    .replace(/\baula est(?:á|a)ndar\b/gi, "curso-horario estándar")
    .replace(/\baula grande\b/gi, "curso-horario grande")
    .replace(/\baulas\b/gi, "cursos-horario")
    .replace(/\baula\b/gi, "curso-horario");
}

export function MarcoAulasHistograma({
  frame,
  workspace,
  minElegibles,
}: {
  frame: MarcoFrame;
  workspace: CalcMuestraWorkspace;
  minElegibles: number;
}) {
  const { classroomRowsRaw } = marcoFrameRows(frame, workspace);
  /** Banda resaltada desde la leyenda (hover): atenúa los bins de otros grupos. */
  const [grupoResaltado, setGrupoResaltado] = useState("");
  const groups = (workspace.aulas_config?.grupos_tamano?.length ? workspace.aulas_config.grupos_tamano : UNIVERSITY_AULAS_SIZE_GROUPS) ?? UNIVERSITY_AULAS_SIZE_GROUPS;
  const sizes = classroomRowsRaw
    .map((row) => classroomRowNumber(row, WEIGHTED_KEYS))
    .filter((value) => Number.isFinite(value) && value > 0);
  if (!sizes.length) {
    return (
      <DescriptiveEmptyNotice
        state={descriptiveMissingState(workspace, {
          role: "eligible_n",
          variable: "Elegibles por curso-horario",
          source: "marco de cursos-horario",
          hasSource: classroomRowsRaw.length > 0,
          impact: "Permite agrupar cursos-horario por tamaño operativo y ubicar el mínimo.",
          next: "Construye el marco de cursos-horario o revisa la columna de elegibles.",
        })}
      />
    );
  }
  const binCount = MARCO_HISTO_MAX / MARCO_HISTO_BIN_WIDTH + 1;
  const bins = Array.from({ length: binCount }, (_, index) => {
    const min = index * MARCO_HISTO_BIN_WIDTH;
    const last = index === binCount - 1;
    const max = last ? Number.POSITIVE_INFINITY : min + MARCO_HISTO_BIN_WIDTH - 1;
    return {
      min,
      max,
      label: last ? `${min}+` : `${min}–${max}`,
      grupo: marcoSizeGroupForValue(min + Math.floor(MARCO_HISTO_BIN_WIDTH / 2), groups) || (min + MARCO_HISTO_BIN_WIDTH - 1 < minElegibles ? "bajo" : ""),
      value: 0,
    };
  });
  sizes.forEach((size) => {
    const index = Math.min(Math.floor(size / MARCO_HISTO_BIN_WIDTH), binCount - 1);
    bins[index].value += 1;
  });
  const maxBin = bins.reduce((peak, bin) => Math.max(peak, bin.value), 0) || 1;
  const axisMax = MARCO_HISTO_MAX + MARCO_HISTO_BIN_WIDTH;
  const minLinePct = Math.max(0, Math.min(100, (minElegibles / axisMax) * 100));
  const underMin = sizes.filter((value) => value < minElegibles).length;
  return (
    <div
      className="cmv2-marco-histo"
      role="img"
      aria-label={`Tamaño de cursos-horario con bandas ${groups.map((g) => g.id).join(", ")} y mínimo de ${fmtInt(minElegibles)} elegibles por curso-horario`}
      data-resalta={grupoResaltado || undefined}
    >
      <div className="cmv2-marco-histo-track">
        {bins.map((bin, index) => (
          <div
            key={bin.label}
            className="cmv2-marco-histo-bin"
            data-grupo={bin.grupo || "bajo"}
            data-atenuada={grupoResaltado && (bin.grupo || "bajo") !== grupoResaltado ? "true" : undefined}
            title={`${bin.label} elegibles: ${fmtInt(bin.value)} cursos-horario`}
            style={{ "--marco-histo-i": index } as CSSProperties}
          >
            <div className="cmv2-marco-histo-col" aria-hidden="true">
              <i style={{ height: `${bin.value > 0 ? Math.max(8, (bin.value / maxBin) * 100) : 0}%` }} />
            </div>
            <span>{bin.label}</span>
          </div>
        ))}
        <div className="cmv2-marco-histo-minline" style={{ left: `${minLinePct}%` }} aria-hidden="true">
          <i />
          <em>mínimo por curso-horario: {fmtInt(minElegibles)}</em>
        </div>
      </div>
      <div className="cmv2-marco-histo-legend" aria-hidden="true" onMouseLeave={() => setGrupoResaltado("")}>
        <span data-grupo="bajo" onMouseEnter={() => setGrupoResaltado("bajo")}>
          <i />bajo el mínimo{underMin > 0 ? ` · ${fmtInt(underMin)} cursos-horario` : ""}
        </span>
        {groups.map((group) => {
          const max = marcoSizeGroupMax(group.max);
          return (
            <span key={group.id} data-grupo={group.id} onMouseEnter={() => setGrupoResaltado(group.id)}>
              <i />{group.label} · {fmtInt(safeNumber(group.min, 0))}{Number.isFinite(max) ? `–${fmtInt(max)}` : "+"} {group.descripcion ? `· ${courseScheduleGroupDescription(group.descripcion)}` : ""}
            </span>
          );
        })}
      </div>
      <p className="cmv2-marco-histo-nota">
        El mínimo de elegibles por curso-horario es solo lectura aquí: se decide en Selección → Objetivo.
      </p>
    </div>
  );
}
