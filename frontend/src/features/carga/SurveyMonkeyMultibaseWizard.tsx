import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle, Building2, CheckCircle2, Cloud, Database, FileUp,
  Layers, Loader2, Plus, RefreshCw, Search, Trash2, X,
} from "lucide-react";
import {
  apiSurveyMonkeyMultibaseAudit,
  apiSurveyMonkeyMultibaseImport,
  apiSurveyMonkeyMultibaseListSurveys,
  apiUpload,
  EstudioPayload,
  SurveyMonkeyMultibaseAudit,
  SurveyMonkeyMultibaseDiff,
  SurveyMonkeyMultibaseListItem,
  SurveyMonkeyMultibaseSurveyInput,
  uploadKindForDataFile,
} from "../../api/client";
import { ErrorBlock } from "../../components/States";

type SurveyDraft = SurveyMonkeyMultibaseSurveyInput & {
  localId: string;
  dataFileName?: string;
};

type CanonicalOption = {
  fileId: string;
  label: string;
};

type Props = {
  canonicalOptions: CanonicalOption[];
  disabled?: boolean;
  onImported: (payload: EstudioPayload) => Promise<void>;
  onClose?: () => void;
};

function compactSurveys(rows: SurveyDraft[]): SurveyMonkeyMultibaseSurveyInput[] {
  return rows
    .map((row) => ({
      survey_id: row.survey_id.trim(),
      pais: (row.pais ?? "").trim(),
      label: (row.label ?? "").trim(),
      data_file_id: (row.data_file_id ?? "").trim(),
    }))
    .filter((row) => row.survey_id);
}

function uniqueWordingDiffs(audit: SurveyMonkeyMultibaseAudit | null): SurveyMonkeyMultibaseDiff[] {
  if (!audit) return [];
  const seen = new Set<string>();
  const out: SurveyMonkeyMultibaseDiff[] = [];
  for (const diff of audit.diffs ?? []) {
    if (diff.kind !== "wording") continue;
    const key = `${diff.variable}:${diff.ref}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(diff);
  }
  return out;
}

function totalResponses(audit: SurveyMonkeyMultibaseAudit | null) {
  if (!audit) return 0;
  return audit.surveys.reduce((acc, row) => acc + (Number(row.n_responses) || 0), 0);
}

function surveyTitle(item: SurveyMonkeyMultibaseListItem) {
  return item.nickname || item.title || item.id;
}

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

function makeManualRow(): SurveyDraft {
  return {
    localId: `sm-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    survey_id: "",
    pais: "",
    label: "",
  };
}

function makeRowFromSurvey(item: SurveyMonkeyMultibaseListItem): SurveyDraft {
  return {
    localId: `sm-${item.id}`,
    survey_id: item.id,
    pais: item.pais_guess ?? "",
    label: surveyTitle(item),
  };
}

export function SurveyMonkeyMultiImportPanel({ canonicalOptions, disabled, onImported, onClose }: Props) {
  const [surveys, setSurveys] = useState<SurveyMonkeyMultibaseListItem[] | null>(null);
  const [query, setQuery] = useState("");
  const [surveyMeta, setSurveyMeta] = useState<{ totalRecent: number; months: number } | null>(null);
  const [rows, setRows] = useState<SurveyDraft[]>([]);
  const [audit, setAudit] = useState<SurveyMonkeyMultibaseAudit | null>(null);
  const [wording, setWording] = useState<Record<string, string>>({});
  const [baseName, setBaseName] = useState("survey_monkey_integrada");
  const [canonicalFileId, setCanonicalFileId] = useState(canonicalOptions[0]?.fileId ?? "");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const wordingDiffs = useMemo(() => uniqueWordingDiffs(audit), [audit]);
  const selectedIds = useMemo(() => new Set(rows.map((row) => row.survey_id)), [rows]);
  const visibleSurveys = useMemo(() => {
    return (surveys ?? []).filter((item) => surveyMatchesQuery(item, query));
  }, [surveys, query]);
  const hasCanonical = canonicalOptions.length > 0;
  const canAudit = hasCanonical && compactSurveys(rows).length > 0 && !busy && !disabled;
  const canImport = hasCanonical && !!audit?.ok && !busy && !disabled;

  function patchRow(localId: string, patch: Partial<SurveyDraft>) {
    setRows((prev) => prev.map((row) => row.localId === localId ? { ...row, ...patch } : row));
    setAudit(null);
  }

  function toggleSurvey(item: SurveyMonkeyMultibaseListItem) {
    setAudit(null);
    setRows((prev) => {
      if (prev.some((row) => row.survey_id === item.id)) {
        return prev.filter((row) => row.survey_id !== item.id);
      }
      return [...prev, makeRowFromSurvey(item)];
    });
  }

  useEffect(() => {
    void loadSurveys();
    // Cargar una sola vez al abrir el panel: el filtro posterior es local.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadSurveys() {
    setError("");
    setBusy("Leyendo encuestas recientes de SurveyMonkey...");
    try {
      const result = await apiSurveyMonkeyMultibaseListSurveys("", 500, 6);
      setSurveys(result.surveys);
      setSurveyMeta({ totalRecent: result.total_recent, months: result.months });
      if (!result.surveys.length) setError("No encontré encuestas modificadas en los últimos 6 meses.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  async function attachManualData(localId: string, file?: File) {
    if (!file) return;
    setError("");
    setBusy(`Subiendo ${file.name}...`);
    try {
      const up = await apiUpload(file, uploadKindForDataFile(file));
      patchRow(localId, { data_file_id: up.file_id, dataFileName: file.name });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  async function runAudit() {
    setError("");
    setBusy("Auditando compatibilidad...");
    try {
      const result = await apiSurveyMonkeyMultibaseAudit(compactSurveys(rows), canonicalFileId);
      setAudit(result);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  async function runImport() {
    setError("");
    setBusy("Importando encuestas SurveyMonkey...");
    try {
      const result = await apiSurveyMonkeyMultibaseImport({
        surveys: compactSurveys(rows),
        base_name: baseName,
        wording_decisions: wording,
        canonical_xlsform_file_id: canonicalFileId,
      });
      setAudit(result.audit);
      await onImported(result.estudio);
      onClose?.();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  return (
    <section className="pulso-sm-multibase-panel is-inline">
      <header className="pulso-sm-multibase-head">
        <span className="pulso-sm-multibase-icon" aria-hidden="true"><Cloud size={18} /></span>
        <div>
          <div className="pulso-sm-multibase-kicker">SurveyMonkey API</div>
          <h3>Importar encuestas a la base integrada</h3>
          <p>Selecciona encuestas de tu cuenta y Prosecnur las apila contra el XLSForm canonico elegido.</p>
        </div>
        {onClose && (
          <button type="button" className="pulso-icon" onClick={onClose} aria-label="Cerrar importador SurveyMonkey">
            <X size={14} />
          </button>
        )}
      </header>

      {!hasCanonical && (
        <div className="pulso-sm-multibase-warning">
          <AlertTriangle size={15} />
          Primero define un XLSForm canonico: puede ser la carga actual o el XLSForm de una base ya agregada.
        </div>
      )}

      <div className="pulso-sm-multibase-toolbar">
        <label className="pulso-sm-multibase-name">
          <span>XLSForm canonico</span>
          <select
            value={canonicalFileId}
            onChange={(e) => { setCanonicalFileId(e.target.value); setAudit(null); }}
            disabled={!hasCanonical || !!busy}
          >
            {canonicalOptions.map((option) => (
              <option key={option.fileId || "session"} value={option.fileId}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="pulso-sm-multibase-name">
          <span>Nombre base integrada</span>
          <input value={baseName} onChange={(e) => setBaseName(e.target.value)} />
        </label>
      </div>

      <div className="pulso-sm-survey-picker">
        <label className="pulso-sm-search">
          <Search size={14} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filtrar por nombre o ID"
          />
        </label>
        <button type="button" className="pulso-sm-secondary" onClick={loadSurveys} disabled={!!busy || disabled}>
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
              const selected = selectedIds.has(item.id);
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
                  <em>{selected ? "Seleccionada" : "Seleccionar"}</em>
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
        <strong>Encuestas seleccionadas</strong>
        <button type="button" className="pulso-sm-secondary" onClick={() => setRows((prev) => [...prev, makeManualRow()])}>
          <Plus size={13} /> Agregar por ID
        </button>
      </div>

      {rows.length > 0 ? (
        <div className="pulso-sm-multibase-grid">
          {rows.map((row, index) => (
            <div className="pulso-sm-survey-row" key={row.localId}>
              <span className="pulso-sm-survey-index">{index + 1}</span>
              <input
                value={row.pais ?? ""}
                onChange={(e) => patchRow(row.localId, { pais: e.target.value })}
                placeholder="Pais"
                aria-label={`Pais encuesta ${index + 1}`}
              />
              <input
                value={row.survey_id}
                onChange={(e) => patchRow(row.localId, { survey_id: e.target.value })}
                placeholder="Survey ID"
                aria-label={`Survey ID encuesta ${index + 1}`}
              />
              <input
                value={row.label ?? ""}
                onChange={(e) => patchRow(row.localId, { label: e.target.value })}
                placeholder="Nombre en base"
                aria-label={`Nombre encuesta ${index + 1}`}
              />
              <label className="pulso-sm-file">
                <FileUp size={12} />
                {row.dataFileName ? "Archivo subido" : "Subir respuestas"}
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv,.sav,application/x-spss-sav,application/octet-stream"
                  onChange={(e) => void attachManualData(row.localId, e.target.files?.[0])}
                />
              </label>
              <button
                type="button"
                className="pulso-icon pulso-icon-danger"
                onClick={() => { setRows((prev) => prev.filter((r) => r.localId !== row.localId)); setAudit(null); }}
                aria-label={`Quitar encuesta ${index + 1}`}
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="pulso-sm-empty">
          Selecciona una o más encuestas de la lista reciente de SurveyMonkey.
        </div>
      )}

      <div className="pulso-sm-multibase-actions">
        <button type="button" className="pulso-sm-secondary" disabled={!canAudit} onClick={runAudit}>
          {busy ? <Loader2 size={13} className="pulso-spin" /> : <RefreshCw size={13} />}
          Auditar compatibilidad
        </button>
        <button type="button" className="pulso-sm-primary" disabled={!canImport} onClick={runImport}>
          <Layers size={14} />
          Importar base integrada
        </button>
      </div>

      {busy && <div className="pulso-sm-status"><Loader2 size={13} className="pulso-spin" /> {busy}</div>}
      {error && <ErrorBlock label="No se pudo completar SurveyMonkey" detail={error} />}

      {audit && (
        <div className="pulso-sm-audit">
          <div className={`pulso-sm-audit-banner ${audit.ok ? "is-ok" : "is-blocked"}`}>
            {audit.ok ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
            <strong>{audit.ok ? "Compatible para importar" : "Requiere revision antes de importar"}</strong>
            <span>
              {audit.surveys.length} encuestas · {totalResponses(audit)} respuestas detectadas · {audit.n_review} fraseos · {audit.n_special} especiales · {audit.n_blocking} bloqueos
            </span>
          </div>

          <div className="pulso-sm-audit-table">
            {audit.surveys.map((survey) => (
              <div key={survey.survey_id} className="pulso-sm-audit-survey">
                <Database size={14} />
                <div>
                  <strong>{survey.pais || survey.label || survey.survey_id}</strong>
                  <span>{survey.n_pages} pags · {survey.n_questions} preguntas · {survey.n_responses ?? 0} respuestas</span>
                </div>
              </div>
            ))}
          </div>

          {audit.company_variables.length > 0 && (
            <div className="pulso-sm-company">
              <Building2 size={15} />
              Empresa se tratara como campo especial: {audit.company_variables.join(", ")}. Se guardan etiqueta, codigo de origen y empresa_uid.
            </div>
          )}

          {wordingDiffs.length > 0 && (
            <div className="pulso-sm-wording">
              <div className="pulso-sm-subhead">
                <strong>Fraseos por decidir</strong>
                <span>Deja vacio para mantener el label del XLSForm canonico.</span>
              </div>
              {wordingDiffs.slice(0, 10).map((diff) => (
                <label key={`${diff.variable}-${diff.pos}`} className="pulso-sm-wording-row">
                  <span>
                    <code>{diff.variable}</code>
                    <small>{diff.current || diff.ref}</small>
                  </span>
                  <input
                    value={wording[diff.variable] ?? ""}
                    onChange={(e) => setWording((prev) => ({ ...prev, [diff.variable]: e.target.value }))}
                    placeholder="Fraseo estandar opcional"
                  />
                </label>
              ))}
            </div>
          )}

          {audit.diffs.some((d) => d.severity === "blocking") && (
            <div className="pulso-sm-blockers">
              {audit.diffs.filter((d) => d.severity === "blocking").slice(0, 6).map((diff) => (
                <div key={`${diff.survey_id}-${diff.variable}-${diff.kind}`}>
                  <strong>{diff.variable}</strong>
                  <span>{diff.message}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
