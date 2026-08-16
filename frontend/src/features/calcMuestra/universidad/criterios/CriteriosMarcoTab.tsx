/**
 * Suite de criterios de inclusión/exclusión POR CATEGORÍA (sección Marco del
 * desk universitario). Dos bloques dirigidos por el mapeo de variables:
 * "Criterios de alumno (población)" y "Criterios de aula (marco)". El académico
 * marca qué categorías/umbrales entran y en qué capa; el marco duro lo
 * reconstruye el motor R. La selección vive en workspace.aulas_config
 * (criterios_seleccion) y se autosalva con el resto del workspace.
 *
 * Principio (ADR 0035): cero categoría hardcodeada y cero preset automático.
 * Todo sale de `criterios_catalogo` que emite el motor a partir de la base y el
 * mapeo; la selección es 100% MANUAL: sin nada guardado arranca VACÍA (ningún
 * criterio asumido) y es el académico quien marca cada uno. No se inyecta ni
 * reconcilia a un canónico por heurística — el único canónico disponible es el
 * botón EXPLÍCITO "Partir de los criterios HST 2025", que precarga el borrador
 * (con resumen previo) y respeta el flujo confirmar-por-variable.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { GraduationCap, Loader2, RefreshCw, School, SlidersHorizontal } from "lucide-react";
import {
  normalizeCalcMuestraAulasCriteriosRadiografia,
  normalizeCalcMuestraAulasExploracion,
  normalizeCalcMuestraAulasParticularidades,
  normalizeCalcMuestraCriteriosAlumnoReporte,
  normalizeCalcMuestraSessionTypeImpacto,
  normalizeCriteriosCatalogo,
  type CalcMuestraAulasState,
  type CalcMuestraWorkspace,
  type CalcMuestraWorkspaceAulasConfig,
  type CriterioSeleccion,
  type CriteriosSeleccionMarco,
} from "../../../../api/client";
import {
  minEligibleThreshold,
  setMinEligible,
  setRangosFacultad,
  setSeleccionVariable,
} from "../../dominio";
import { ELEGIBLES_POR_AULA_ID } from "../../dominio";
import { fmtInt } from "../../sharedCore";
import { AvisoModulo } from "../shared/AvisoModulo";
import { marcoCriteriosDesactualizado } from "../shared/frame";
import { frameIntegrity, marcoFueConstruido } from "../shared/frameIntegrity";
import { normalizeUniversityAulasConfig } from "../shared/study";
import { CifraFila, CifraMotor } from "../ui";
import { useMotorStore } from "../../store";
import {
  copiarVariableCriterio,
  reconciliarBorradorCriterios,
  type TipoBorradorCriterio,
} from "./borradorCriterios";
import { CriterioCard } from "./CriterioCard";
import { recorteCriteriosAlumno } from "./recorteCriteriosAlumnoModel";
import { CriterioComposicionCard } from "./CriterioComposicionCard";
import { PresetCanonicoButton } from "./PresetCanonicoButton";
import type { PresetCanonicoPlan } from "./presetCanonicoModel";
import { MinElegiblesCard, type FacultadMinRef } from "./MinElegiblesCard";
import { setMinimoFacultad, setTasaAsistencia } from "./minElegiblesModel";
import type { FacultadRef } from "./facultades";
import {
  CriteriosRadiografiaConsola,
  useCriteriosRadiografiaInline,
} from "../marco/CriteriosRadiografiaConsola";
import "./criterios.css";

/** Slug estable para claves de facultad (sin tildes, minúsculas, guiones). */
function slugFacultad(nombre: string): string {
  return nombre
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function CriteriosMarcoTab({
  workspace,
  aulasState,
  facultades,
  onWorkspace,
  onReconstruir,
  puedeReconstruir,
  reconstruyendo,
  onNavigate,
  scope,
}: {
  workspace: CalcMuestraWorkspace;
  aulasState: CalcMuestraAulasState | null;
  /** Nombres de facultad del marco (para excepciones y rangos). */
  facultades: string[];
  onWorkspace: (workspace: CalcMuestraWorkspace) => void;
  onReconstruir?: () => void;
  puedeReconstruir?: boolean;
  reconstruyendo?: boolean;
  /** Navegación del desk (sección, pestaña). Opcional: sin ella, la tarjeta de
   *  tipo de sesión omite el link «Ver radiografía por facultad». */
  onNavigate?: (section: string, tab?: string) => void;
  /** Alcance a renderizar. "alumno" solo el bloque de criterios del estudiante
   *  (con la salida N elegibles); "aula" solo el bloque de curso-horario;
   *  sin scope, ambos (compatibilidad). La barra de aplicar se ve en los dos. */
  scope?: "alumno" | "aula";
}) {
  const catalogo = useMemo(
    () => normalizeCriteriosCatalogo(aulasState?.frame?.criterios_catalogo ?? null),
    [aulasState?.frame?.criterios_catalogo],
  );
  // Payloads críticos para la vista por facultad del tipo de sesión (reunión
  // §4). Todos retrocompatibles: sin los campos, la tarjeta se comporta como
  // hoy (sin barras de elegibles, sin aviso de impacto, sin señal DTI).
  const integridadFrame = useMemo(
    () => frameIntegrity(aulasState?.frame),
    [aulasState?.frame],
  );
  const exploracionNormalizada = useMemo(
    () => normalizeCalcMuestraAulasExploracion(aulasState?.frame?.exploracion ?? null),
    [aulasState?.frame?.exploracion],
  );
  const marcoPublicable = integridadFrame.status === "consistent";
  const marcoIncoherente = integridadFrame.status === "inconsistent";
  const exploracion = marcoPublicable ? exploracionNormalizada : null;
  const criteriosRadiografiaNormalizada = useMemo(
    () => normalizeCalcMuestraAulasCriteriosRadiografia(aulasState?.frame?.criterios_radiografia ?? null),
    [aulasState?.frame?.criterios_radiografia],
  );
  const criteriosRadiografia =
    marcoPublicable && criteriosRadiografiaNormalizada?.frame_hash === aulasState?.frame?.frame_hash
      ? criteriosRadiografiaNormalizada
      : null;
  const sessionTypeImpactoNormalizado = useMemo(
    () => normalizeCalcMuestraSessionTypeImpacto(aulasState?.frame?.session_type_impacto ?? null),
    [aulasState?.frame?.session_type_impacto],
  );
  const sessionTypeImpacto = marcoPublicable ? sessionTypeImpactoNormalizado : null;
  const sessionTypeDominanteNormalizado = useMemo(
    () =>
      normalizeCalcMuestraAulasParticularidades(aulasState?.frame?.particularidades ?? null)
        ?.session_type_dominante ?? null,
    [aulasState?.frame?.particularidades],
  );
  const sessionTypeDominante = marcoPublicable ? sessionTypeDominanteNormalizado : null;
  const config = useMemo(() => normalizeUniversityAulasConfig(workspace.aulas_config), [workspace.aulas_config]);
  const opcionalesActivosMotor = useMotorStore((s) => s.decisiones.opcionalesActivos);
  // Selección 100% MANUAL (ADR 0035): se muestra EXACTAMENTE lo confirmado en el
  // workspace, sin default canónico ni reconciliación silenciosa a un canónico.
  // Sin nada guardado arranca vacía (ningún criterio asumido). Persistir tal cual
  // evita que el marco recién construido quede "desactualizado" por un re-parcheo.
  const seleccion = useMemo<CriteriosSeleccionMarco>(
    () => config.criterios_seleccion ?? { byVariable: {} },
    [config.criterios_seleccion],
  );
  const [borrador, setBorrador] = useState<CriteriosSeleccionMarco>(() => seleccion);
  const [pendientes, setPendientes] = useState<Set<string>>(() => new Set());
  const pendientesRef = useRef(pendientes);
  const tiposBorrador = useMemo(() => {
    const tipos = new Map<string, TipoBorradorCriterio>();
    for (const variable of catalogo.variables) tipos.set(variable.id, variable.kind);
    tipos.set(ELEGIBLES_POR_AULA_ID, "minEligible");
    return tipos;
  }, [catalogo.variables]);

  useEffect(() => {
    pendientesRef.current = pendientes;
  }, [pendientes]);

  useEffect(() => {
    setBorrador((prev) =>
      reconciliarBorradorCriterios(seleccion, prev, pendientesRef.current, tiposBorrador),
    );
  }, [seleccion, tiposBorrador]);

  const facRefs: FacultadRef[] = useMemo(() => {
    const seen = new Set<string>();
    const out: FacultadRef[] = [];
    for (const nombre of facultades) {
      const key = slugFacultad(nombre);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push({ key, label: nombre });
    }
    return out;
  }, [facultades]);

  // Facultades para los mínimos por facultad del criterio 7: preferimos las
  // categorías del catálogo (claves normalizadas AUTORITATIVAS del motor, con
  // conteo de CH); si el catálogo no trae la variable, caemos a los nombres del
  // marco (mismas claves tras normalizar — el backend re-normaliza al leer).
  const facultadesMin: FacultadMinRef[] = useMemo(() => {
    const cats = catalogo.variables.find((v) => v.id === "faculty")?.categories ?? [];
    if (cats.length) {
      return cats.map((c) => ({ key: c.key, label: c.label, aulas: c.aulas > 0 ? c.aulas : null }));
    }
    return facRefs.map((f) => ({ key: f.key, label: f.label, aulas: null }));
  }, [catalogo.variables, facRefs]);

  const alumno = catalogo.variables.filter((v) => v.scope === "alumno");
  const aula = catalogo.variables.filter((v) => v.scope === "aula");
  const ready = catalogo.variables.length > 0;
  const showAlumno = scope !== "aula";
  const showAula = scope !== "alumno";

  // Salida visible del bloque de estudiante: suma de matrículas elegibles del
  // marco. null cuando la radiografía no es publicable.
  const elegiblesTotal = exploracion?.totales.elegibles_total ?? null;
  // Puente al Explorador desde la tarjeta de tipo de sesión. Depende de que el
  // desk pase `onNavigate`; sin él, el link no se muestra. En la vista integrada
  // (scope "aula") la radiografía ya está a la vista, así que se omite el link.
  const onVerExplorador =
    onNavigate && scope !== "aula" && marcoPublicable
      ? () => onNavigate("marco", "marco-ch-radiografia")
      : undefined;

  function patchSeleccion(next: CriteriosSeleccionMarco) {
    onWorkspace({ ...workspace, aulas_config: { ...config, criterios_seleccion: next } });
  }

  // ADR 0035: el orden de jerarquía de tipos de docente vive en su propio campo
  // del config (no en criterios_seleccion) y se autosalva de inmediato — no pasa
  // por el borrador/confirm de las variables (es un ranking, no un set opt-in).
  function patchTeacherTypeOrden(keys: string[]) {
    onWorkspace({ ...workspace, aulas_config: { ...config, teacher_type_orden: keys } });
  }

  function marcarPendiente(id: string) {
    setPendientes((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }

  function editarVariable(id: string, sel: CriterioSeleccion) {
    setBorrador((prev) => setSeleccionVariable(prev, id, sel));
    marcarPendiente(id);
  }

  function editarRango(variableId: string, facultad: string, rangos: Array<[number, number]>) {
    setBorrador((prev) => setRangosFacultad(prev, facultad, rangos));
    marcarPendiente(variableId);
  }

  function editarUmbralElegibles(value: number) {
    setBorrador((prev) => setMinEligible(prev, value));
    marcarPendiente(ELEGIBLES_POR_AULA_ID);
  }

  // Criterio 7: mínimo propio de una facultad (null = vuelve a heredar el
  // general) y tasa de asistencia esperada (solo informa la sugerencia).
  function editarMinimoFacultad(facultadKey: string, valor: number | null) {
    setBorrador((prev) => setMinimoFacultad(prev, facultadKey, valor, minEligibleThreshold(prev, config.min_elegibles_aula)));
    marcarPendiente(ELEGIBLES_POR_AULA_ID);
  }

  function editarTasaAsistencia(tasa: number | null) {
    setBorrador((prev) => setTasaAsistencia(prev, tasa, minEligibleThreshold(prev, config.min_elegibles_aula)));
    marcarPendiente(ELEGIBLES_POR_AULA_ID);
  }

  // Criterio 8 (y la métrica referencial legacy): viven en aulas_config, no en
  // criterios_seleccion — autosave inmediato, mismo patrón que teacher_type_orden.
  function patchAulasConfig(patch: Partial<CalcMuestraWorkspaceAulasConfig>) {
    onWorkspace({ ...workspace, aulas_config: { ...config, ...patch } });
  }

  function confirmarVariable(id: string, tipo: TipoBorradorCriterio) {
    patchSeleccion(copiarVariableCriterio(seleccion, borrador, id, tipo));
    setPendientes((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  function descartarVariable(id: string, tipo: TipoBorradorCriterio) {
    setBorrador((prev) => copiarVariableCriterio(prev, seleccion, id, tipo));
    setPendientes((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  // Preset explícito (reunión del diseño muestral): precarga SOLO el borrador
  // con la selección canónica; cada variable queda pendiente de confirmar y el
  // marco no cambia hasta recalcular. El plan reemplaza también los borradores
  // abiertos (el botón lo advierte y pide confirmación antes).
  function precargarPreset(plan: PresetCanonicoPlan) {
    setBorrador(plan.seleccion);
    setPendientes(new Set(plan.pendientes));
  }

  const totalPendientes = pendientes.size;

  // Máquina de estados del recálculo del marco (§4.1.4): el botón exige
  // reconstruir cuando (a) es la primera vez (aún no hay marco), o (b) los
  // criterios confirmados difieren de los que construyeron el marco vigente.
  const marcoConstruido = marcoFueConstruido(aulasState?.frame);
  const criteriosRadiografiaF1Lista = criteriosRadiografia?.schema === "calc_muestra_aulas_criterios_radiografia_v2";
  const criteriosRadiografiaF1Pendiente = marcoConstruido && !criteriosRadiografiaF1Lista;
  const criteriosRadiografiaF1Ausente = marcoConstruido && aulasState?.frame?.criterios_radiografia == null;
  const marcoNoVerificable = marcoConstruido && integridadFrame.status === "unverifiable";
  const marcoDesactualizado = marcoCriteriosDesactualizado(aulasState?.frame, config.criterios_seleccion, config.teacher_type_orden, {
    config,
    opcionalesActivos: opcionalesActivosMotor,
  });

  /*
   * Desglose de lo que recortó cada criterio de alumno en el marco EJECUTADO.
   *
   * La pantalla mostraba sólo el agregado —cuántos estudiantes quedan— y con
   * eso un criterio declarado que no deja fuera a nadie es indistinguible de
   * uno que muerde. En el proyecto real de 2025-2 `level` dejaba pasar las
   * 136.284 filas y sólo se detectó calculándolo a mano.
   */
  const recorteAlumno = useMemo(() => {
    if (!marcoPublicable) return null;
    return recorteCriteriosAlumno(
      normalizeCalcMuestraCriteriosAlumnoReporte(aulasState?.frame?.criterios_alumno_report ?? null),
    );
  }, [marcoPublicable, aulasState?.frame?.criterios_alumno_report]);
  const recorteDe = useMemo(() => {
    const porId = new Map((recorteAlumno?.criterios ?? []).map((c) => [c.id, c]));
    return (id: string) => porId.get(id) ?? null;
  }, [recorteAlumno]);

  const necesitaRecalculo = !marcoConstruido || marcoDesactualizado || !marcoPublicable || criteriosRadiografiaF1Pendiente;
  const listoParaRecalcular = Boolean(puedeReconstruir) && !reconstruyendo && totalPendientes === 0;
  // S1: el detalle de cada criterio se resuelve aquí una vez y se entrega a la
  // tarjeta que decide ese criterio, en vez de vivir en una consola aparte.
  const radiografiaInline = useCriteriosRadiografiaInline({
    catalogo,
    radiografia: criteriosRadiografia,
    scope: "alumno",
    i18bSource: {
      frame: marcoPublicable ? aulasState?.frame ?? null : null,
      config,
      borrador,
      previewEnabled: totalPendientes > 0 || marcoDesactualizado,
    },
  });
  // El haz de luz (Anexo A.2) solo cuando hace falta reconstruir y no hay nada
  // pendiente de confirmar (si hay pendientes, la acción primero es confirmar).
  const beam = necesitaRecalculo && listoParaRecalcular;
  const estadoResumen =
    marcoIncoherente
      ? "La radiografía no corresponde al marco ejecutado. Reconstruye el marco para recuperar cifras coherentes."
      : marcoNoVerificable
        ? "El marco ejecutado no es verificable contra su radiografía. Reconstruye el marco para recuperar cifras acreditables."
        : totalPendientes > 0
          ? `${totalPendientes} ${totalPendientes === 1 ? "variable pendiente de confirmar" : "variables pendientes de confirmar"}`
          : !marcoConstruido
            ? "Aún no has construido el marco: calcula la población y los cursos-horario elegibles."
            : criteriosRadiografiaF1Pendiente
              ? criteriosRadiografiaF1Ausente
                ? "El marco guardado aún no incluye la radiografía por facultad. Actualízalo para publicar el detalle analítico."
                : "La radiografía por facultad no cumple el contrato vigente. Reconstruye el marco para recuperarla."
            : marcoDesactualizado
              ? "Los criterios cambiaron — el marco vigente ya no los refleja. Recalcula para actualizarlo."
              : "El marco está al día con los criterios confirmados.";

  return (
    <div className="cmv2-crit" data-audit-ready={ready && marcoPublicable ? "true" : "false"}>
      {onReconstruir && (
        <div
          className="cmv2-crit-apply"
          role="group"
          aria-label="Calcular población y cursos-horario elegibles"
          data-attention={necesitaRecalculo ? "true" : "false"}
        >
          <AvisoModulo
            tone={totalPendientes > 0 || marcoDesactualizado || marcoIncoherente || marcoNoVerificable || criteriosRadiografiaF1Pendiente ? "warn" : !marcoConstruido ? "info" : "success"}
            role="status"
            compact
            className="cmv2-crit-draft-summary"
          >
            {estadoResumen}
          </AvisoModulo>
          <div className="cmv2-crit-apply-actions">
            {ready ? (
              <PresetCanonicoButton
                catalogo={catalogo}
                seleccion={seleccion}
                borradoresSinConfirmar={totalPendientes}
                onPrecargar={precargarPreset}
              />
            ) : null}
            <button
              type="button"
              className="cmv2-crit-apply-btn"
              data-beam={beam ? "true" : "false"}
              disabled={!listoParaRecalcular}
              onClick={onReconstruir}
              title={totalPendientes > 0 ? "Confirma o descarta cada variable antes de recalcular el marco" : undefined}
            >
              <span className="cmv2-crit-apply-btn-inner">
                {reconstruyendo ? (
                  <Loader2 size={15} className="pulso-spin" aria-hidden="true" />
                ) : (
                  <RefreshCw size={15} aria-hidden="true" />
                )}
                Calcular población y cursos-horario elegibles
              </span>
            </button>
          </div>
        </div>
      )}

      {showAlumno && elegiblesTotal != null && (
        <div className="cmv2-crit-elegibles" data-audit-ready="true">
          <CifraFila>
            <CifraMotor
              label="Suma de matrículas elegibles"
              value={fmtInt(elegiblesTotal)}
              detalle="en cursos-horario incluidos del último marco — una persona puede contar varias veces si está matriculada en más de uno"
              origen="motor"
              hero
            />
          </CifraFila>
        </div>
      )}

      {!ready ? (
        <div className="cmv2-crit-empty">
          <SlidersHorizontal size={22} aria-hidden="true" />
          <strong>Aún no hay catálogo de categorías.</strong>
          <p>
            La suite enumera las categorías reales de tu base (dirigida por el mapeo de variables) y su conteo por
            curso-horario. Construye el marco desde tus fuentes para poblarla; luego marca qué categorías entran, con
            excepciones por facultad y su capa.
          </p>
        </div>
      ) : (
        <>
          {/* S1: cuando el frame no publica radiografía, la recuperación sigue
              siendo un bloque propio; con radiografía viva, el detalle de cada
              criterio baja a su tarjeta y aquí no queda consola separada. */}
          {showAlumno && alumno.length > 0 && radiografiaInline.needsRecovery ? (
            <CriteriosRadiografiaConsola
              catalogo={catalogo}
              radiografia={criteriosRadiografia}
              i18bSource={{ frame: marcoPublicable ? aulasState?.frame ?? null : null, config, borrador, previewEnabled: totalPendientes > 0 || marcoDesactualizado }}
              scope="alumno"
              onReconstruir={onReconstruir}
              puedeReconstruir={listoParaRecalcular}
              reconstruyendo={reconstruyendo}
            />
          ) : null}
          {showAlumno && alumno.length > 0 && radiografiaInline.invalid.length ? (
            <div className="cmv2-crc-contract-alert" role="alert">
              Evidencia I18b inválida u obsoleta: {radiografiaInline.invalid.join(", ")}. React no sustituye esos datos con cálculos locales.
            </div>
          ) : null}
          {showAlumno && alumno.length > 0 && (
            <section className="cmv2-crit-section" data-scope="alumno">
              <header className="cmv2-crit-scope-head" data-scope="alumno">
                <span className="cmv2-crit-scope-bar" aria-hidden="true" />
                <span className="cmv2-crit-scope-icon" aria-hidden="true">
                  <GraduationCap size={18} />
                </span>
                <div className="cmv2-crit-scope-copy">
                  <h3>Criterios de estudiante</h3>
                  <p className="cmv2-crit-scope-hint">de la hoja de matrícula (una fila por estudiante)</p>
                </div>
              </header>
              {/* `intrinsic`: cada tarjeta de criterio mide lo que piden sus
                  categorías —Facultad lista decenas y Sexo dos—, así que su
                  alto es función de los datos de esa variable. */}
              <div
                className="cmv2-crit-grid"
                data-qa-geometry-group="calc-muestra/criterios"
                data-qa-geometry-contract="intrinsic"
              >
                {alumno.map((variable) => (
                  <CriterioCard
                    key={variable.id}
                    variable={variable}
                    seleccion={borrador}
                    facultades={facRefs}
                    onSel={(sel) => editarVariable(variable.id, sel)}
                    onRango={(facultad, rangos) => editarRango(variable.id, facultad, rangos)}
                    pendiente={pendientes.has(variable.id)}
                    onConfirmar={() => confirmarVariable(variable.id, variable.kind)}
                    onDescartar={() => descartarVariable(variable.id, variable.kind)}
                    radiografia={radiografiaInline.detalle(variable.id)}
                    aporte={(segmentKey) => radiografiaInline.aporte(variable.id, segmentKey)}
                    recorteMedido={recorteDe(variable.id)}
                    recorteDesactualizado={marcoDesactualizado}
                  />
                ))}
              </div>
            </section>
          )}

          {showAula && aula.length > 0 && (
            <section className="cmv2-crit-section" data-scope="aula">
              <header className="cmv2-crit-scope-head" data-scope="aula">
                <span className="cmv2-crit-scope-bar" aria-hidden="true" />
                <span className="cmv2-crit-scope-icon" aria-hidden="true">
                  <School size={18} />
                </span>
                <div className="cmv2-crit-scope-copy">
                  <h3>Criterios de curso-horario</h3>
                  <p className="cmv2-crit-scope-hint">de la hoja de catálogo de cursos y horarios</p>
                </div>
              </header>
              {/* `intrinsic`: cada tarjeta de criterio mide lo que piden sus
                  categorías —Facultad lista decenas y Sexo dos—, así que su
                  alto es función de los datos de esa variable. */}
              <div
                className="cmv2-crit-grid"
                data-qa-geometry-group="calc-muestra/criterios"
                data-qa-geometry-contract="intrinsic"
              >
                {aula.map((variable) => (
                  <CriterioCard
                    key={variable.id}
                    variable={variable}
                    seleccion={borrador}
                    facultades={facRefs}
                    onSel={(sel) => editarVariable(variable.id, sel)}
                    onRango={(facultad, rangos) => editarRango(variable.id, facultad, rangos)}
                    pendiente={pendientes.has(variable.id)}
                    onConfirmar={() => confirmarVariable(variable.id, variable.kind)}
                    onDescartar={() => descartarVariable(variable.id, variable.kind)}
                    teacherTypeOrden={config.teacher_type_orden}
                    onTeacherTypeOrden={patchTeacherTypeOrden}
                    exploracion={exploracion}
                    sessionTypeImpacto={sessionTypeImpacto}
                    sessionTypeDominante={sessionTypeDominante}
                    onVerExplorador={onVerExplorador}
                  />
                ))}

                <MinElegiblesCard
                  seleccion={borrador}
                  fallbackUmbral={config.min_elegibles_aula}
                  facultades={facultadesMin}
                  pendiente={pendientes.has(ELEGIBLES_POR_AULA_ID)}
                  onUmbral={editarUmbralElegibles}
                  onMinimoFacultad={editarMinimoFacultad}
                  onTasa={editarTasaAsistencia}
                  onConfirmar={() => confirmarVariable(ELEGIBLES_POR_AULA_ID, "minEligible")}
                  onDescartar={() => descartarVariable(ELEGIBLES_POR_AULA_ID, "minEligible")}
                />

                <CriterioComposicionCard config={config} onPatch={patchAulasConfig} />
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
