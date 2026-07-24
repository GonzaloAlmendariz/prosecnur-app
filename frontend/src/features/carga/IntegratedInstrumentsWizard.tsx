import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle, CheckCircle2, Cloud, Database, FileSpreadsheet, FileUp,
  FileText, GitMerge, Layers, Loader2, Plus, RefreshCw, Search, Trash2,
} from "lucide-react";
import {
  apiMultiIntegratedAudit,
  apiMultiIntegratedDecisionsDocx,
  apiMultiIntegratedDraftClear,
  apiMultiIntegratedDraftGet,
  apiMultiIntegratedDraftSave,
  apiMultiIntegratedImport,
  apiSurveyMonkeyMultibaseListSurveys,
  apiUpload,
  EstudioPayload,
  MultiIntegratedAudit,
  MultiIntegratedDecisions,
  MultiIntegratedDiff,
  MultiIntegratedDraft,
  MultiIntegratedOrigin,
  SurveyMonkeyMultibaseListItem,
  uploadKindForDataFile,
} from "../../api/client";
import { ErrorBlock } from "../../components/States";
import { GlidingTabList } from "../../components/GlidingTabList";

type CanonicalOption = {
  fileId: string;
  label: string;
};

type DraftOrigin = MultiIntegratedOrigin & {
  localId: string;
  xlsformFileName?: string;
  dataFileName?: string;
  surveyTitle?: string;
};

type Props = {
  canonicalOptions: CanonicalOption[];
  disabled?: boolean;
  onImported: (payload: EstudioPayload) => Promise<void>;
};

type IntegratedSourceMode = "manual" | "surveymonkey";

function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function aliasesForToken(token: string) {
  const map: Record<string, string[]> = {
    sello: ["certificada", "certificadas", "certificacion", "igualdad", "genero"],
    mujer: ["genero", "igualdad", "certificada", "certificadas"],
    mujeres: ["genero", "igualdad", "certificada", "certificadas"],
    trabajador: ["personal trabajador", "trabajador"],
    trabajadores: ["personal trabajador", "trabajador"],
    directivo: ["representantes directivos", "directivo"],
    directivos: ["representantes directivos", "directivos"],
  };
  return [token, ...(map[token] ?? [])].map(normalizeSearch).filter(Boolean);
}

function surveyTitle(item: SurveyMonkeyMultibaseListItem) {
  return item.nickname || item.title || item.id;
}

function surveyMatchesQuery(item: SurveyMonkeyMultibaseListItem, query: string) {
  const tokens = normalizeSearch(query).split(" ").filter(Boolean);
  if (!tokens.length) return true;
  const haystack = normalizeSearch([
    item.id,
    item.title,
    item.nickname ?? "",
    item.pais_guess ?? "",
  ].join(" "));
  return tokens.every((token) => aliasesForToken(token).some((alias) => haystack.includes(alias)));
}

function makeManualOrigin(): DraftOrigin {
  return {
    localId: `manual-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    source_kind: "manual",
    key_value: "",
    label: "",
  };
}

function makeSurveyMonkeyOrigin(item: SurveyMonkeyMultibaseListItem): DraftOrigin {
  return {
    localId: `sm-${item.id}`,
    source_kind: "surveymonkey",
    key_value: item.pais_guess || "",
    label: surveyTitle(item),
    survey_id: item.id,
    surveyTitle: surveyTitle(item),
  };
}

function compactOrigins(rows: DraftOrigin[]): MultiIntegratedOrigin[] {
  return rows
    .map((row) => ({
      source_kind: row.source_kind,
      key_value: (row.key_value ?? "").trim(),
      label: (row.label ?? "").trim(),
      xlsform_file_id: (row.xlsform_file_id ?? "").trim(),
      data_file_id: (row.data_file_id ?? "").trim(),
      survey_id: (row.survey_id ?? "").trim(),
    }))
    .filter((row) => {
      if (!row.key_value) return false;
      if (row.source_kind === "manual") return !!row.xlsform_file_id && !!row.data_file_id;
      return !!row.survey_id;
    });
}

function draftRows(rows: MultiIntegratedDraft["rows"] | undefined): DraftOrigin[] {
  if (!rows?.length) return [];
  return rows.map((row, index) => ({
    localId: row.localId || row.local_id || `${row.source_kind ?? "origin"}-${row.survey_id || row.xlsform_file_id || index}-${index}`,
    source_kind: row.source_kind === "surveymonkey" ? "surveymonkey" : "manual",
    key_value: row.key_value ?? "",
    label: row.label ?? "",
    xlsform_file_id: row.xlsform_file_id ?? "",
    data_file_id: row.data_file_id ?? "",
    survey_id: row.survey_id ?? "",
    xlsformFileName: row.xlsformFileName || row.xlsform_file_name || "",
    dataFileName: row.dataFileName || row.data_file_name || "",
    surveyTitle: row.surveyTitle || row.survey_title || "",
  }));
}

function draftGuideOptions(options: MultiIntegratedDraft["guide_options"] | undefined): CanonicalOption[] {
  if (!options?.length) return [];
  return options
    .map((option) => ({
      fileId: option.fileId || option.file_id || "",
      label: option.label || option.fileId || option.file_id || "XLSForm",
    }))
    .filter((option) => option.fileId);
}

function draftHasWork(draft: MultiIntegratedDraft) {
  if (draft.source_mode === "surveymonkey") return true;
  if (draft.guide_xlsform_file_id) return true;
  if (draft.audit) return true;
  if ((draft.decisions?.resolved_ids ?? []).length > 0) return true;
  if ((draft.origin_key_name ?? "origen") !== "origen") return true;
  if ((draft.base_name ?? "base_integrada") !== "base_integrada") return true;
  return (draft.rows ?? []).some((row) => (
    !!row.key_value ||
    !!row.label ||
    !!row.xlsform_file_id ||
    !!row.data_file_id ||
    !!row.survey_id
  ));
}

function pendingDiffs(audit: MultiIntegratedAudit | null, decisions: MultiIntegratedDecisions) {
  if (!audit) return [];
  const resolved = new Set(decisions.resolved_ids ?? []);
  return audit.diffs.filter((diff) => diff.needs_decision && !resolved.has(diff.id));
}

type DiffGroup = {
  id: string;
  kind: "wording" | "multi" | "single";
  representative: MultiIntegratedDiff;
  diffs: MultiIntegratedDiff[];
};

function isWordingDiff(diff: MultiIntegratedDiff) {
  return diff.kind === "wording" || diff.kind === "surveymonkey_wording";
}

function groupedDiffKey(diff: MultiIntegratedDiff) {
  if (isWordingDiff(diff)) return `wording:${diff.suggested_name || diff.variable || diff.pos || diff.id}`;
  if (
    diff.kind.includes("company_list") ||
    diff.kind.includes("options") ||
    diff.kind.includes("structure") ||
    diff.kind.includes("extra_question")
  ) {
    return `${diff.kind}:${diff.variable || diff.pos || diff.id}`;
  }
  return "";
}

function groupAuditDiffs(diffs: MultiIntegratedDiff[]): DiffGroup[] {
  const groups: DiffGroup[] = [];
  const grouped = new Map<string, DiffGroup>();
  for (const diff of diffs) {
    const key = groupedDiffKey(diff);
    if (!key) {
      groups.push({ id: `single:${diff.id}`, kind: "single", representative: diff, diffs: [diff] });
      continue;
    }
    const existing = grouped.get(key);
    if (existing) {
      existing.diffs.push(diff);
    } else {
      const group = { id: key, kind: isWordingDiff(diff) ? "wording" as const : "multi" as const, representative: diff, diffs: [diff] };
      grouped.set(key, group);
      groups.push(group);
    }
  }
  return groups;
}

function groupResolved(group: DiffGroup, decisions: MultiIntegratedDecisions) {
  const resolved = new Set(decisions.resolved_ids ?? []);
  return group.diffs.every((diff) => !diff.needs_decision || resolved.has(diff.id));
}

function groupNeedsDecision(group: DiffGroup) {
  return group.diffs.some((diff) => diff.needs_decision);
}

function commonAffixes(a: string, b: string) {
  let start = 0;
  const maxStart = Math.min(a.length, b.length);
  while (start < maxStart && a[start] === b[start]) start += 1;
  let end = 0;
  while (
    end < a.length - start &&
    end < b.length - start &&
    a[a.length - 1 - end] === b[b.length - 1 - end]
  ) {
    end += 1;
  }
  return { start, end };
}

function TextDiff({ value, against }: { value: string; against: string }) {
  if (!value || !against || value === against) return <>{value || "Sin fraseo"}</>;
  const { start, end } = commonAffixes(value, against);
  const before = value.slice(0, start);
  const middle = value.slice(start, value.length - end);
  const after = end ? value.slice(value.length - end) : "";
  return (
    <>
      {before}
      <mark>{middle || value}</mark>
      {after}
    </>
  );
}

function diffKindLabel(diff: MultiIntegratedDiff) {
  if (diff.kind === "wording" || diff.kind === "surveymonkey_wording") return "Fraseo";
  if (diff.kind === "extra_question") return "Pregunta diferencial";
  if (diff.kind === "options_variant" || diff.kind === "surveymonkey_options") return "Categorías distintas";
  if (diff.kind === "structure_variant" || diff.kind === "surveymonkey_structure") return "Estructura distinta";
  if (diff.kind === "missing_in_origin") return "Ausente";
  if (diff.kind === "surveymonkey_company_list" || diff.kind === "surveymonkey_company_other_logic") return "Especial";
  if (diff.kind.startsWith("surveymonkey_")) return "SurveyMonkey";
  return diff.kind;
}

function diffStatusLabel(diff: MultiIntegratedDiff, resolved: boolean) {
  if (diff.severity === "blocking") return "Bloqueo";
  if (resolved) return "Resuelta";
  if (diff.needs_decision) return "Decidir";
  return "Info";
}

function diffActionText(diff: MultiIntegratedDiff) {
  if (diff.severity === "blocking") return "Impide importar hasta corregir la condición indicada.";
  if (diff.kind === "wording" || diff.kind === "surveymonkey_wording") {
    return "Define el texto final que quedará en el XLSForm integrado.";
  }
  if (diff.kind === "extra_question" || diff.kind === "missing_in_origin") {
    return "Se agregará como pregunta parcial para los orígenes donde exista.";
  }
  if (diff.kind === "options_variant" || diff.kind === "structure_variant") {
    return "Se creará una variable diferenciada para no mezclar estructuras distintas.";
  }
  if (diff.kind.startsWith("surveymonkey_")) return "Confirma que esta diferencia puede integrarse contra el XLSForm guía.";
  return "Confirma la decisión para continuar.";
}

function diffRefOriginLabel(diff: MultiIntegratedDiff) {
  return diff.ref_origin_key || "Referencia";
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function auditStatusText(audit: MultiIntegratedAudit, unresolvedCount: number) {
  if (audit.n_blocking > 0) return "Corrige los bloqueos antes de importar.";
  if (unresolvedCount > 0) return "Revisa las decisiones o acepta las sugeridas.";
  return "La integración está lista.";
}

function diffSummary(groups: DiffGroup[]) {
  const out = { wording: 0, variants: 0, special: 0, blocking: 0 };
  for (const group of groups) {
    const diff = group.representative;
    if (diff.severity === "blocking") out.blocking += 1;
    else if (diff.severity === "special") out.special += 1;
    else if (isWordingDiff(diff)) out.wording += 1;
    else if (diff.kind.includes("options") || diff.kind.includes("structure") || diff.kind.includes("extra")) out.variants += 1;
  }
  return out;
}

export function IntegratedInstrumentsWizard({ canonicalOptions, disabled, onImported }: Props) {
  const canonicalSignature = canonicalOptions.map((option) => `${option.fileId}:${option.label}`).join("|");
  const [sourceMode, setSourceMode] = useState<IntegratedSourceMode>("manual");
  const [guideOptions, setGuideOptions] = useState<CanonicalOption[]>(canonicalOptions);
  const [guideFileId, setGuideFileId] = useState(canonicalOptions[0]?.fileId ?? "");
  const [guideSurveyId, setGuideSurveyId] = useState("");
  const [originKeyName, setOriginKeyName] = useState("origen");
  const [baseName, setBaseName] = useState("base_integrada");
  const [rows, setRows] = useState<DraftOrigin[]>([makeManualOrigin(), makeManualOrigin()]);
  const [surveys, setSurveys] = useState<SurveyMonkeyMultibaseListItem[] | null>(null);
  const [surveyMeta, setSurveyMeta] = useState<{ totalRecent: number; months: number } | null>(null);
  const [query, setQuery] = useState("");
  const [audit, setAudit] = useState<MultiIntegratedAudit | null>(null);
  const [decisions, setDecisions] = useState<MultiIntegratedDecisions>({ resolved_ids: [] });
  const [activeWordingTabs, setActiveWordingTabs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [draftStatus, setDraftStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [draftError, setDraftError] = useState("");
  const draftLoadedRef = useRef(false);
  const latestDraftRef = useRef<MultiIntegratedDraft | null>(null);
  const draftSavingRef = useRef(false);
  const draftQueuedRef = useRef(false);
  const draftEpochRef = useRef(0);
  const hasGuide = guideOptions.length > 0;
  const orderedRows = useMemo(() => {
    if (!guideSurveyId) return rows;
    return [...rows].sort((a, b) => {
      if (a.survey_id === guideSurveyId) return -1;
      if (b.survey_id === guideSurveyId) return 1;
      return 0;
    });
  }, [rows, guideSurveyId]);
  const origins = useMemo(() => compactOrigins(orderedRows), [orderedRows]);
  const hasIncompleteOrigins = rows.length > 0 && origins.length !== rows.length;
  const needsGuideSurveyLink = sourceMode === "surveymonkey" && rows.some((row) => row.source_kind === "surveymonkey") && !guideSurveyId;
  const canAudit = hasGuide && origins.length > 0 && !hasIncompleteOrigins && !needsGuideSurveyLink && !busy && !disabled;
  const unresolved = pendingDiffs(audit, decisions);
  const canImport = !!audit?.ok && unresolved.length === 0 && origins.length > 0 && !hasIncompleteOrigins && !needsGuideSurveyLink && !busy && !disabled;
  const selectedSurveyIds = useMemo(() => new Set(rows.map((row) => row.survey_id).filter(Boolean)), [rows]);
  const guideSurvey = useMemo(() => rows.find((row) => row.survey_id === guideSurveyId), [rows, guideSurveyId]);
  const selectedGuideLabel = guideOptions.find((option) => option.fileId === guideFileId)?.label ?? "Sin guía";
  const visibleSurveys = useMemo(
    () => (surveys ?? []).filter((item) => surveyMatchesQuery(item, query)),
    [surveys, query],
  );
  const sortedDiffs = useMemo(() => {
    if (!audit) return [];
    const severityRank: Record<string, number> = { blocking: 0, review: 1, special: 2, info: 3 };
    return [...audit.diffs].sort((a, b) => {
      const ar = severityRank[a.severity] ?? 4;
      const br = severityRank[b.severity] ?? 4;
      if (ar !== br) return ar - br;
      if (a.needs_decision !== b.needs_decision) return a.needs_decision ? -1 : 1;
      return (a.pos ?? 9999) - (b.pos ?? 9999);
    });
  }, [audit]);
  const groupedDiffs = useMemo(() => groupAuditDiffs(sortedDiffs), [sortedDiffs]);
  const unresolvedGroups = useMemo(
    () => groupedDiffs.filter((group) => groupNeedsDecision(group) && !groupResolved(group, decisions)),
    [groupedDiffs, decisions],
  );
  const groupedSummary = useMemo(() => diffSummary(groupedDiffs), [groupedDiffs]);
  const draftPayload = useMemo<MultiIntegratedDraft>(() => ({
    version: 1,
    source_mode: sourceMode,
    guide_xlsform_file_id: guideFileId,
    guide_options: guideOptions.map((option) => ({ file_id: option.fileId, label: option.label })),
    guide_survey_id: guideSurveyId,
    origin_key_name: originKeyName,
    base_name: baseName,
    query,
    rows: rows.map((row) => ({
      source_kind: row.source_kind,
      key_value: row.key_value,
      label: row.label ?? "",
      xlsform_file_id: row.xlsform_file_id ?? "",
      data_file_id: row.data_file_id ?? "",
      survey_id: row.survey_id ?? "",
      local_id: row.localId,
      xlsform_file_name: row.xlsformFileName ?? "",
      data_file_name: row.dataFileName ?? "",
      survey_title: row.surveyTitle ?? "",
    })),
    audit,
    decisions,
  }), [audit, baseName, decisions, guideFileId, guideOptions, guideSurveyId, originKeyName, query, rows, sourceMode]);
  const draftFingerprint = useMemo(() => JSON.stringify(draftPayload), [draftPayload]);

  async function persistDraft(draft: MultiIntegratedDraft) {
    if (!draftHasWork(draft)) return;
    if (draftSavingRef.current) {
      draftQueuedRef.current = true;
      return;
    }
    draftSavingRef.current = true;
    const epoch = draftEpochRef.current;
    setDraftStatus("saving");
    setDraftError("");
    try {
      const result = await apiMultiIntegratedDraftSave(draft, false);
      if (epoch !== draftEpochRef.current) {
        await apiMultiIntegratedDraftClear(false).catch(() => undefined);
        return;
      }
      if (result.project?.error) throw new Error(result.project.error);
      setDraftStatus("saved");
    } catch (e) {
      setDraftStatus("error");
      setDraftError((e as Error).message);
    } finally {
      draftSavingRef.current = false;
      if (draftQueuedRef.current) {
        draftQueuedRef.current = false;
        const latest = latestDraftRef.current;
        if (draftLoadedRef.current && latest && draftHasWork(latest)) void persistDraft(latest);
      }
    }
  }

  useEffect(() => {
    setGuideOptions((prev) => {
      const custom = prev.filter((option) => option.fileId && !canonicalOptions.some((base) => base.fileId === option.fileId));
      return [...canonicalOptions, ...custom];
    });
    setGuideFileId((current) => (current || canonicalOptions[0]?.fileId) ?? "");
    // canonicalOptions se reconstruye en el parent; la firma evita sincronizar en cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canonicalSignature]);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const draft = await apiMultiIntegratedDraftGet();
        if (!alive) return;
        if (draft && draftHasWork(draft)) {
          const savedGuideOptions = draftGuideOptions(draft.guide_options);
          if (savedGuideOptions.length) {
            setGuideOptions((prev) => {
              const merged = [...prev];
              for (const option of savedGuideOptions) {
                if (!merged.some((item) => item.fileId === option.fileId)) merged.push(option);
              }
              return merged;
            });
          }
          setSourceMode(draft.source_mode ?? "manual");
          setGuideFileId(draft.guide_xlsform_file_id || canonicalOptions[0]?.fileId || "");
          setGuideSurveyId(draft.guide_survey_id ?? "");
          setOriginKeyName(draft.origin_key_name || "origen");
          setBaseName(draft.base_name || "base_integrada");
          setQuery(draft.query ?? "");
          const savedRows = draftRows(draft.rows);
          setRows(savedRows.length ? savedRows : (draft.source_mode === "surveymonkey" ? [] : [makeManualOrigin(), makeManualOrigin()]));
          setAudit(draft.audit ?? null);
          setDecisions(draft.decisions ?? { resolved_ids: [] });
          setDraftStatus("saved");
        }
      } catch (e) {
        if (!alive) return;
        setDraftStatus("error");
        setDraftError((e as Error).message);
      } finally {
        if (alive) {
          draftLoadedRef.current = true;
          setDraftLoaded(true);
        }
      }
    })();
    return () => {
      alive = false;
    };
    // Solo se hidrata una vez al montar el wizard; luego canonicalSignature se sincroniza arriba.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    draftLoadedRef.current = draftLoaded;
  }, [draftLoaded]);

  useEffect(() => {
    latestDraftRef.current = draftPayload;
  }, [draftFingerprint, draftPayload]);

  useEffect(() => {
    if (!draftLoaded || !draftHasWork(draftPayload)) return;
    const timer = window.setTimeout(() => {
      void persistDraft(draftPayload);
    }, 900);
    return () => window.clearTimeout(timer);
    // persistDraft coordina concurrencia con refs; no necesita participar en deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftFingerprint, draftLoaded, draftPayload]);

  useEffect(() => {
    const flushDraft = () => {
      const draft = latestDraftRef.current;
      if (!draftLoadedRef.current || !draft || !draftHasWork(draft)) return;
      void persistDraft(draft);
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flushDraft();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", flushDraft);
    return () => {
      flushDraft();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", flushDraft);
    };
    // persistDraft coordina concurrencia con refs; no necesita participar en deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (sourceMode !== "surveymonkey" || surveys) return;
    void loadSurveys();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceMode]);

  function resetAudit() {
    setAudit(null);
    setDecisions({ resolved_ids: [] });
    setActiveWordingTabs({});
  }

  function selectSourceMode(mode: IntegratedSourceMode) {
    if (mode === sourceMode) return;
    setSourceMode(mode);
    setGuideSurveyId("");
    setRows(mode === "manual" ? [makeManualOrigin(), makeManualOrigin()] : []);
    resetAudit();
  }

  function patchRow(localId: string, patch: Partial<DraftOrigin>) {
    setRows((prev) => prev.map((row) => row.localId === localId ? { ...row, ...patch } : row));
    resetAudit();
  }

  async function attachFile(localId: string, role: "xlsform" | "data", file?: File) {
    if (!file) return;
    setError("");
    setBusy(`Subiendo ${file.name}...`);
    try {
      const up = await apiUpload(file, role === "xlsform" ? "xlsform" : uploadKindForDataFile(file));
      patchRow(localId, role === "xlsform"
        ? { xlsform_file_id: up.file_id, xlsformFileName: file.name }
        : { data_file_id: up.file_id, dataFileName: file.name });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  async function attachGuideFile(file?: File) {
    if (!file) return;
    setError("");
    setBusy(`Subiendo ${file.name}...`);
    try {
      const up = await apiUpload(file, "xlsform");
      setGuideOptions((prev) => [
        ...prev.filter((option) => option.fileId !== up.file_id),
        { fileId: up.file_id, label: file.name },
      ]);
      setGuideFileId(up.file_id);
      resetAudit();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  async function loadSurveys(forceRefresh = false) {
    setError("");
    setBusy(forceRefresh ? "Actualizando catálogo SurveyMonkey..." : "Leyendo catálogo local SurveyMonkey...");
    try {
      const result = await apiSurveyMonkeyMultibaseListSurveys("", 500, 6, { forceRefresh });
      setSurveys(result.surveys);
      setSurveyMeta({ totalRecent: result.total_recent, months: result.months });
      if (!result.surveys.length) setError("No encontré encuestas modificadas en los últimos 6 meses.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  function toggleSurvey(item: SurveyMonkeyMultibaseListItem) {
    resetAudit();
    const alreadySelected = rows.some((row) => row.survey_id === item.id);
    setRows((prev) => {
      if (prev.some((row) => row.survey_id === item.id)) return prev.filter((row) => row.survey_id !== item.id);
      return [...prev.filter((row) => row.source_kind === "surveymonkey"), makeSurveyMonkeyOrigin(item)];
    });
    setGuideSurveyId((current) => {
      if (alreadySelected && current === item.id) return "";
      if (!alreadySelected && !current) return item.id;
      return current;
    });
  }

  async function runAudit() {
    setError("");
    setBusy("Auditando instrumentos hermanos...");
    try {
      const result = await apiMultiIntegratedAudit({
        guide_xlsform_file_id: guideFileId,
        origin_key_name: originKeyName,
        origins,
      });
      setAudit(result);
      setDecisions({ resolved_ids: [] });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  function acceptSuggestedDecisions() {
    if (!audit) return;
    const pending = audit.diffs.filter((diff) => diff.needs_decision && diff.severity !== "blocking");
    const variantNames: Record<string, string> = {};
    for (const diff of pending) {
      if (diff.suggested_name && diff.suggested_name !== diff.variable) variantNames[diff.id] = diff.suggested_name;
    }
    setDecisions({
      resolved_ids: pending.map((diff) => diff.id),
      variant_names: variantNames,
      label_overrides: decisions.label_overrides ?? {},
    });
  }

  function updateDecisionGroup(group: DiffGroup, patch: { variantName?: string; label?: string }) {
    setDecisions((prev) => {
      const ids = group.diffs.filter((diff) => diff.needs_decision).map((diff) => diff.id);
      const representative = group.representative;
      let variant_names = prev.variant_names;
      if (patch.variantName !== undefined) {
        variant_names = { ...(prev.variant_names ?? {}) };
        for (const id of ids) variant_names[id] = patch.variantName;
      }
      return {
        ...prev,
        resolved_ids: Array.from(new Set([...(prev.resolved_ids ?? []), ...ids])),
        variant_names,
        label_overrides: patch.label === undefined || !representative.suggested_name
          ? prev.label_overrides
          : { ...(prev.label_overrides ?? {}), [representative.suggested_name]: patch.label },
      };
    });
  }

  async function runImport() {
    if (!audit) return;
    setError("");
    setBusy("Importando base integrada...");
    try {
      draftEpochRef.current += 1;
      const result = await apiMultiIntegratedImport({
        guide_xlsform_file_id: guideFileId,
        origin_key_name: originKeyName,
        origins,
        base_name: baseName,
        decisions,
      });
      setAudit(result.audit);
      await onImported(result.estudio);
      draftLoadedRef.current = false;
      setDraftLoaded(false);
      latestDraftRef.current = null;
      setDraftStatus("idle");
      void apiMultiIntegratedDraftClear(false).catch(() => undefined);
    } catch (e) {
      setError((e as Error).message);
      void persistDraft(draftPayload);
    } finally {
      setBusy("");
    }
  }

  async function runExportDocx() {
    if (!audit) return;
    setError("");
    setBusy("Generando Word de diferencias...");
    try {
      const blob = await apiMultiIntegratedDecisionsDocx({ audit, decisions });
      const ts = new Date().toISOString().replace(/[:.]/g, "").slice(0, 15);
      downloadBlob(blob, `diferencias_integracion_${ts}.docx`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  return (
    <section className="pulso-integrated-panel">
      <header className="pulso-integrated-head">
        <span className="pulso-sm-multibase-icon" aria-hidden="true"><GitMerge size={18} /></span>
        <div>
          <div className="pulso-sm-multibase-kicker">Integración</div>
          <h3>Integrar instrumentos hermanos</h3>
          <p>Audita, resuelve diferencias y genera una base integrada.</p>
        </div>
      </header>

      {!hasGuide && (
        <div className="pulso-sm-multibase-warning">
          <AlertTriangle size={15} />
          Selecciona un XLSForm guía.
        </div>
      )}

      <div className="pulso-integrated-setup" aria-label="Configuración de integración">
        <div className="pulso-integrated-field is-guide">
          <span>XLSForm guía</span>
          <div className="pulso-integrated-guide-control">
            <select value={guideFileId} disabled={!hasGuide || !!busy} onChange={(e) => { setGuideFileId(e.target.value); resetAudit(); }}>
              {guideOptions.map((option) => (
                <option key={option.fileId || "session"} value={option.fileId}>{option.label}</option>
              ))}
            </select>
            <label className="pulso-sm-file pulso-integrated-upload-guide">
              <FileSpreadsheet size={12} />
              Subir
              <input type="file" accept=".xlsx,.xls" onChange={(e) => void attachGuideFile(e.target.files?.[0])} />
            </label>
          </div>
        </div>
        <label className="pulso-integrated-field">
          <span>Llave de origen</span>
          <input value={originKeyName} onChange={(e) => { setOriginKeyName(e.target.value); resetAudit(); }} placeholder="origen" />
        </label>
        <label className="pulso-integrated-field">
          <span>Nombre base integrada</span>
          <input value={baseName} onChange={(e) => setBaseName(e.target.value)} placeholder="base_integrada" />
        </label>
      </div>

      <div className="pulso-integrated-sourcebar">
        <GlidingTabList
          activeKey={sourceMode}
          mode="tabs"
          className="pulso-integrated-source-tabs"
          role="radiogroup"
          aria-label="Fuente de instrumentos hermanos"
        >
          <button
            type="button"
            role="radio"
            aria-checked={sourceMode === "manual"}
            data-gliding-key="manual"
            className={sourceMode === "manual" ? "is-active" : ""}
            title="Archivos manuales"
            onClick={() => selectSourceMode("manual")}
            onKeyDown={(event) => {
              if (event.key === "Home") selectSourceMode("manual");
              else if (event.key === "End" || event.key === "ArrowLeft" || event.key === "ArrowRight") {
                selectSourceMode("surveymonkey");
              }
            }}
          >
            <FileSpreadsheet size={14} />
            <span className="pulso-integrated-source-label">Archivos manuales</span>
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={sourceMode === "surveymonkey"}
            data-gliding-key="surveymonkey"
            className={sourceMode === "surveymonkey" ? "is-active" : ""}
            title="SurveyMonkey"
            onClick={() => selectSourceMode("surveymonkey")}
            onKeyDown={(event) => {
              if (event.key === "End") selectSourceMode("surveymonkey");
              else if (event.key === "Home" || event.key === "ArrowLeft" || event.key === "ArrowRight") {
                selectSourceMode("manual");
              }
            }}
          >
            <Cloud size={14} />
            <span className="pulso-integrated-source-label">SurveyMonkey</span>
          </button>
        </GlidingTabList>

        {sourceMode === "surveymonkey" && (
          <div className={`pulso-integrated-link${guideSurveyId ? " is-linked" : ""}`}>
            <span className="pulso-integrated-link-node">
              <small>XLSForm guía</small>
              <strong title={selectedGuideLabel}>{selectedGuideLabel}</strong>
            </span>
            <GitMerge size={14} aria-hidden="true" />
            <span className="pulso-integrated-link-node">
              <small>Encuesta origen</small>
              <strong title={guideSurvey?.label || guideSurveyId || ""}>{guideSurvey?.label || guideSurveyId || "Sin vincular"}</strong>
            </span>
          </div>
        )}
      </div>

      {sourceMode === "manual" ? (
        <div className="pulso-integrated-manual">
          {rows.map((row, index) => (
            <div className="pulso-integrated-origin-row" key={row.localId}>
              <span className="pulso-sm-survey-index">{index + 1}</span>
              <input
                value={row.key_value}
                onChange={(e) => patchRow(row.localId, { key_value: e.target.value })}
                placeholder="Valor de llave"
                aria-label={`Llave origen ${index + 1}`}
              />
              <input
                value={row.label ?? ""}
                onChange={(e) => patchRow(row.localId, { label: e.target.value })}
                placeholder="Etiqueta opcional"
                aria-label={`Etiqueta origen ${index + 1}`}
              />
              <label className="pulso-sm-file">
                <FileSpreadsheet size={12} />
                {row.xlsformFileName ? "XLSForm listo" : "Subir XLSForm"}
                <input type="file" accept=".xlsx,.xls" onChange={(e) => void attachFile(row.localId, "xlsform", e.target.files?.[0])} />
              </label>
              <label className="pulso-sm-file">
                <Database size={12} />
                {row.dataFileName ? "Data lista" : "Subir data"}
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv,.sav,application/x-spss-sav,application/octet-stream"
                  onChange={(e) => void attachFile(row.localId, "data", e.target.files?.[0])}
                />
              </label>
              <button
                type="button"
                className="pulso-icon pulso-icon-danger"
                onClick={() => { setRows((prev) => prev.filter((r) => r.localId !== row.localId)); resetAudit(); }}
                aria-label={`Quitar origen ${index + 1}`}
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
          <button type="button" className="pulso-sm-secondary" onClick={() => { setRows((prev) => [...prev, makeManualOrigin()]); resetAudit(); }}>
            <Plus size={13} /> Agregar origen
          </button>
        </div>
      ) : (
        <div className="pulso-integrated-sm">
          <div className="pulso-sm-survey-picker">
            <label className="pulso-sm-search">
              <Search size={14} />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filtrar por nombre o ID" />
            </label>
            <button type="button" className="pulso-sm-secondary" onClick={() => loadSurveys(true)} disabled={!!busy || disabled}>
              {busy ? <Loader2 size={13} className="pulso-spin" /> : <RefreshCw size={13} />}
              Actualizar lista
            </button>
          </div>
          {surveys && (
            <>
              <div className="pulso-sm-list-caption">
                {visibleSurveys.length} de {surveyMeta?.totalRecent ?? surveys.length} encuestas modificadas en los últimos {surveyMeta?.months ?? 6} meses
              </div>
              <div className="pulso-sm-survey-list" aria-label="Encuestas SurveyMonkey">
                {visibleSurveys.map((item) => {
                  const selected = selectedSurveyIds.has(item.id);
                  const isGuide = guideSurveyId === item.id;
                  const title = surveyTitle(item);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={`pulso-sm-survey-card${selected ? " is-selected" : ""}`}
                      onClick={() => toggleSurvey(item)}
                      title={title}
                    >
                      <span>
                        <strong>{title}</strong>
                        <small>{item.id}{item.date_modified ? ` · ${item.date_modified.slice(0, 10)}` : ""}</small>
                      </span>
                      <em>{isGuide ? "Guía" : selected ? "Seleccionada" : "Seleccionar"}</em>
                    </button>
                  );
                })}
                {!visibleSurveys.length && (
                  <div className="pulso-sm-empty">
                    No hay coincidencias con el filtro actual.
                  </div>
                )}
              </div>
            </>
          )}
          <div className="pulso-sm-selected-head">
            <strong>Orígenes seleccionados</strong>
            <button
              type="button"
              className="pulso-sm-secondary"
              onClick={() => setRows((prev) => [...prev, {
                localId: `sm-manual-${Date.now()}`,
                source_kind: "surveymonkey",
                key_value: "",
                label: "",
                survey_id: "",
              }])}
            >
              <Plus size={13} /> Agregar por ID
            </button>
          </div>
          {rows.length ? (
            <div className="pulso-sm-multibase-grid">
              {orderedRows.map((row, index) => (
                <div className={`pulso-sm-survey-row${row.survey_id === guideSurveyId ? " is-guide" : ""}`} key={row.localId}>
                  <span className="pulso-sm-survey-index">{index + 1}</span>
                  <input value={row.key_value} onChange={(e) => patchRow(row.localId, { key_value: e.target.value })} placeholder="Llave" />
                  <input
                    value={row.survey_id ?? ""}
                    onChange={(e) => {
                      const nextId = e.target.value;
                      patchRow(row.localId, { survey_id: nextId });
                      if (row.survey_id === guideSurveyId) setGuideSurveyId(nextId);
                    }}
                    placeholder="Survey ID"
                  />
                  <input value={row.label ?? ""} onChange={(e) => patchRow(row.localId, { label: e.target.value })} placeholder="Etiqueta" />
                  <button
                    type="button"
                    className={`pulso-sm-mini${row.survey_id === guideSurveyId ? " is-active" : ""}`}
                    disabled={!row.survey_id?.trim()}
                    onClick={() => {
                      setGuideSurveyId(row.survey_id ?? "");
                      resetAudit();
                    }}
                  >
                    {row.survey_id === guideSurveyId ? "Guía" : "Marcar guía"}
                  </button>
                  <label className="pulso-sm-file">
                    <FileUp size={12} />
                    {row.dataFileName ? "Archivo subido" : "Subir respuestas"}
                    <input
                      type="file"
                      accept=".xlsx,.xls,.csv,.sav,application/x-spss-sav,application/octet-stream"
                      onChange={(e) => void attachFile(row.localId, "data", e.target.files?.[0])}
                    />
                  </label>
                  <button
                    type="button"
                    className="pulso-icon pulso-icon-danger"
                    onClick={() => {
                      setRows((prev) => prev.filter((r) => r.localId !== row.localId));
                      if (row.survey_id === guideSurveyId) setGuideSurveyId("");
                      resetAudit();
                    }}
                    aria-label={`Quitar origen ${index + 1}`}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="pulso-sm-empty">Selecciona una o más encuestas.</div>
          )}
          {needsGuideSurveyLink && (
            <div className="pulso-sm-empty">Marca la encuesta origen del XLSForm guía.</div>
          )}
          {hasIncompleteOrigins && rows.length > 0 && (
            <div className="pulso-sm-empty">Completa la llave de cada origen seleccionado.</div>
          )}
        </div>
      )}

      <div className="pulso-sm-multibase-actions">
        {draftLoaded && draftStatus !== "idle" && (
          <span className={`pulso-integrated-draft-status is-${draftStatus}`} title={draftError || "El borrador se guarda con el proyecto."}>
            {draftStatus === "saving" && <Loader2 size={13} className="pulso-spin" />}
            {draftStatus === "saved" && <CheckCircle2 size={13} />}
            {draftStatus === "error" && <AlertTriangle size={13} />}
            {draftStatus === "saving" ? "Guardando borrador" : draftStatus === "saved" ? "Borrador guardado" : "No se guardó"}
          </span>
        )}
        <button type="button" className="pulso-sm-secondary" disabled={!canAudit} onClick={runAudit}>
          {busy ? <Loader2 size={13} className="pulso-spin" /> : <RefreshCw size={13} />}
          Auditar integración
        </button>
        <button type="button" className="pulso-sm-secondary" disabled={!audit || !!busy || disabled} onClick={runExportDocx}>
          <FileText size={14} />
          Exportar Word
        </button>
        <button type="button" className="pulso-sm-primary" disabled={!canImport} onClick={runImport}>
          <Layers size={14} />
          Importar base integrada
        </button>
      </div>

      {busy && <div className="pulso-sm-status"><Loader2 size={13} className="pulso-spin" /> {busy}</div>}
      {error && <ErrorBlock label="No se pudo completar la integración" detail={error} />}

      {audit && (
        <div className="pulso-integrated-audit">
          <div className={`pulso-sm-audit-banner ${audit.ok && !unresolved.length ? "is-ok" : "is-blocked"}`}>
            {audit.ok && !unresolved.length ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
            <strong>{audit.ok && !unresolved.length ? "Lista para importar" : "Revisión pendiente"}</strong>
            <span>
              {audit.n_origins} orígenes · {unresolvedGroups.length} decisiones visibles · {audit.n_blocking} bloqueos · llave <code>{audit.origin_key_name}</code>
            </span>
          </div>
          <div className={`pulso-integrated-help${audit.n_blocking > 0 ? " is-blocking" : ""}`}>
            <strong>{auditStatusText(audit, unresolved.length)}</strong>
            <span><b>Decidir</b>: aceptar una forma de integrar.</span>
            <span><b>Bloqueo</b>: requiere corrección antes de importar.</span>
          </div>
          <div className="pulso-integrated-summary-chips" aria-label="Resumen de diferencias">
            <span><b>{groupedSummary.wording}</b> fraseo</span>
            <span><b>{groupedSummary.variants}</b> variantes</span>
            <span><b>{groupedSummary.special}</b> especiales</span>
            <span><b>{groupedSummary.blocking}</b> bloqueos</span>
          </div>

          {audit.diffs.some((diff) => diff.needs_decision) && (
            <div className="pulso-integrated-decisions-head">
              <div>
                <strong>Diferencias por decidir</strong>
                <span>{unresolvedGroups.length ? `${unresolvedGroups.length} pendiente(s)` : "Todas resueltas"} · bloqueos: {audit.n_blocking}</span>
              </div>
              <button type="button" className="pulso-sm-secondary" onClick={acceptSuggestedDecisions} title="Marca como resueltas las decisiones no bloqueantes usando los nombres y fraseos sugeridos.">
                <CheckCircle2 size={13} /> Aceptar sugeridas
              </button>
            </div>
          )}

          <div className="pulso-integrated-diff-list">
            {groupedDiffs.slice(0, 24).map((group, groupIndex) => {
              const diff = group.representative;
              const resolved = groupResolved(group, decisions);
              const activeId = activeWordingTabs[group.id] ?? group.diffs[0]?.id ?? "";
              const activeDiff = group.diffs.find((item) => item.id === activeId) ?? group.diffs[0] ?? diff;
              const activeDiffIndex = Math.max(0, group.diffs.findIndex((item) => item.id === activeDiff.id));
              const hasOriginTabs = group.diffs.length > 1;
              const originPanelId = `integrated-origin-panel-${groupIndex}`;
              const activeOriginTabId = `integrated-origin-tab-${groupIndex}-${activeDiffIndex}`;
              return (
                <div key={group.id} className={`pulso-integrated-diff is-${diff.severity}${group.kind !== "single" ? " is-wording" : ""}`}>
                  <div>
                    <strong>
                      <span>{diffKindLabel(diff)}{group.diffs.length > 1 ? ` · ${group.diffs.length} orígenes` : ` · ${diff.origin_key}`}</span>
                      <em>{diffStatusLabel(diff, resolved)}</em>
                    </strong>
                    <span>{diff.message}</span>
                    <span className="pulso-integrated-action">{diffActionText(diff)}</span>
                    <small>
                      <code>{diff.variable}</code>
                      {group.kind === "single" && diff.ref && ` · ${diffRefOriginLabel(diff)}: ${diff.ref}`}
                      {group.kind === "single" && diff.current && ` · origen: ${diff.current}`}
                    </small>
                    {group.kind !== "single" && (
                      <div className="pulso-integrated-wording-review">
                        {group.diffs.length > 1 && (
                          <GlidingTabList activeKey={activeDiff.id} className="pulso-integrated-origin-tabs" role="tablist" aria-label={`Orígenes ${diff.variable}`}>
                            {group.diffs.map((item, itemIndex) => (
                              <button
                                key={item.id}
                                id={`integrated-origin-tab-${groupIndex}-${itemIndex}`}
                                type="button"
                                role="tab"
                                aria-selected={item.id === activeDiff.id}
                                aria-controls={originPanelId}
                                data-gliding-key={item.id}
                                className={item.id === activeDiff.id ? "is-active" : ""}
                                onClick={() => setActiveWordingTabs((prev) => ({ ...prev, [group.id]: item.id }))}
                              >
                                {item.origin_key || "Origen"}
                              </button>
                            ))}
                          </GlidingTabList>
                        )}
                        {group.kind === "wording" ? (
                          <div
                            id={hasOriginTabs ? originPanelId : undefined}
                            className="pulso-integrated-wording-grid"
                            role={hasOriginTabs ? "tabpanel" : undefined}
                            aria-labelledby={hasOriginTabs ? activeOriginTabId : undefined}
                            tabIndex={hasOriginTabs ? 0 : undefined}
                          >
                            <span>
                              <b>{diffRefOriginLabel(activeDiff)}</b>
                              <small><TextDiff value={activeDiff.ref} against={activeDiff.current} /></small>
                            </span>
                            <span>
                              <b>{activeDiff.origin_key || "Origen"}</b>
                              <small><TextDiff value={activeDiff.current} against={activeDiff.ref} /></small>
                            </span>
                          </div>
                        ) : (
                          <div
                            id={hasOriginTabs ? originPanelId : undefined}
                            className="pulso-integrated-wording-grid is-compact"
                            role={hasOriginTabs ? "tabpanel" : undefined}
                            aria-labelledby={hasOriginTabs ? activeOriginTabId : undefined}
                            tabIndex={hasOriginTabs ? 0 : undefined}
                          >
                            <span>
                              <b>{diffRefOriginLabel(activeDiff)}</b>
                              <small>{activeDiff.ref || "Sin detalle"}</small>
                            </span>
                            <span>
                              <b>{activeDiff.origin_key || "Origen"}</b>
                              <small>{activeDiff.current || "Sin detalle"}</small>
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  {groupNeedsDecision(group) && (
                    <div className="pulso-integrated-decision-fields">
                      {diff.suggested_name && diff.suggested_name !== diff.variable && (
                        <label>
                          <span>Nombre final</span>
                          <input
                            value={(decisions.variant_names ?? {})[diff.id] ?? diff.suggested_name}
                            onChange={(e) => updateDecisionGroup(group, { variantName: e.target.value })}
                            aria-label={`Nombre final ${diff.variable}`}
                          />
                        </label>
                      )}
                      {diff.suggested_label && (
                        <label>
                          <span>Fraseo final</span>
                          <input
                            value={(decisions.label_overrides ?? {})[diff.suggested_name] ?? diff.suggested_label}
                            onChange={(e) => updateDecisionGroup(group, { label: e.target.value })}
                            aria-label={`Fraseo final ${diff.variable}`}
                          />
                        </label>
                      )}
                      <button type="button" className="pulso-sm-secondary" onClick={() => updateDecisionGroup(group, {})}>
                        {resolved ? "Resuelta" : "Aceptar sugerencia"}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
