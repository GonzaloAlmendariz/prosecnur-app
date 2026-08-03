import { useState, type ReactNode } from "react";
import { CheckCircle2, Database, Loader2, Plus } from "../../vendor/lucide-react";
import {
  apiEstudioAddBase,
  apiEstudioGet,
  apiUpload,
  uploadKindForDataFile,
  type EstudioBase,
  type EstudioPayload,
} from "../../api/client";
import { CargaBaseFilePicker } from "./CargaBaseFilePicker";

type LaneDraft = {
  nombre: string;
  xlsform: File | null;
  data: File | null;
  busy: boolean;
  error: string;
};

const EMPTY_DRAFT: LaneDraft = {
  nombre: "",
  xlsform: null,
  data: null,
  busy: false,
  error: "",
};

export function CargaManualBaseLanes({
  plannedInputCount,
  bases,
  disabled = false,
  onChanged,
  renderMaterializedBase,
}: {
  plannedInputCount: number;
  bases: EstudioBase[];
  disabled?: boolean;
  onChanged: (payload: EstudioPayload) => Promise<void>;
  renderMaterializedBase?: (base: EstudioBase) => ReactNode;
}) {
  const materializedBases = bases.filter((base) => (
    base.source_kind !== "kobo_repeat" && !base.parent_base
  ));
  const [drafts, setDrafts] = useState<Record<number, LaneDraft>>({});
  // Siempre queda un carril libre detrás de las bases ya materializadas. Sin él,
  // reabrir un proyecto congelaba el estudio en las bases que ya tenía:
  // `plannedInputCount` es estado efímero del store (default 1) y no se deriva
  // del .pulso, así que un estudio con N bases mostraba N carriles todos
  // ocupados y ningún destino nuevo. El tope real lo pone el estudio
  // (`max_bases`), que llega por `disabled`; el plan sólo previene, no limita.
  // El carril extra se renderiza aunque `disabled` esté activo para que la lista
  // no cambie de alto durante una materialización (C2).
  const lanes = Array.from(
    { length: Math.max(plannedInputCount, materializedBases.length + 1) },
    (_, index) => ({ index, base: materializedBases[index] ?? null }),
  );

  function draftAt(index: number): LaneDraft {
    return drafts[index] ?? EMPTY_DRAFT;
  }

  function patchDraft(index: number, patch: Partial<LaneDraft>) {
    setDrafts((current) => ({
      ...current,
      [index]: { ...EMPTY_DRAFT, ...current[index], ...patch },
    }));
  }

  async function materializeLane(index: number) {
    const draft = draftAt(index);
    if (!draft.xlsform || !draft.data || draft.busy) return;
    const nombre = draft.nombre.trim();
    const duplicated = nombre && materializedBases.some((base) => base.nombre === nombre);
    if (duplicated || nombre.includes("$") || /\s/u.test(nombre)) {
      patchDraft(index, {
        error: duplicated
          ? "Ya existe una base con ese nombre."
          : "Usa letras, números o guiones, sin espacios ni el símbolo $.",
      });
      return;
    }

    patchDraft(index, { busy: true, error: "" });
    try {
      const [xlsformUpload, dataUpload] = await Promise.all([
        apiUpload(draft.xlsform, "xlsform"),
        apiUpload(draft.data, uploadKindForDataFile(draft.data)),
      ]);
      await apiEstudioAddBase({
        nombre,
        xlsform_file_id: xlsformUpload.file_id,
        data_file_id: dataUpload.file_id,
      });
      await onChanged(await apiEstudioGet());
      setDrafts((current) => {
        const next = { ...current };
        delete next[index];
        return next;
      });
    } catch (reason) {
      patchDraft(index, { error: (reason as Error).message });
    } finally {
      patchDraft(index, { busy: false });
    }
  }

  return (
    <section className="pulso-carga-manual-lanes" aria-label="Entradas manuales planificadas">
      <div className="pulso-carga-manual-lanes-note" role="note">
        Cada carril se materializa por separado. Si una carga falla, las demás entradas no cambian.
      </div>
      <div className="pulso-carga-manual-lanes-list">
        {lanes.map(({ index, base }) => {
          const draft = draftAt(index);
          const canMaterialize = Boolean(draft.xlsform && draft.data && !draft.busy && !disabled);
          return (
            <div
              className={`pulso-carga-manual-lane${base ? " is-materialized" : " is-pending"}`}
              key={base?.nombre ?? `planned-${index}`}
            >
              <div className="pulso-carga-manual-lane-index" aria-hidden="true">{index + 1}</div>
              {base ? (
                <div className="pulso-carga-manual-lane-materialized">
                  <span className="pulso-carga-manual-lane-state">
                    <CheckCircle2 size={15} aria-hidden="true" /> Base materializada
                  </span>
                  {renderMaterializedBase ? renderMaterializedBase(base) : (
                    <span><strong>{base.nombre}</strong> · {base.n_filas ?? "—"} filas</span>
                  )}
                </div>
              ) : (
                <div className="pulso-carga-manual-lane-pending">
                  <label className="pulso-carga-manual-lane-name">
                    <span>Nombre de la base <em>(opcional)</em></span>
                    <input
                      value={draft.nombre}
                      disabled={disabled || draft.busy}
                      placeholder={`base_${index + 1}`}
                      onChange={(event) => patchDraft(index, { nombre: event.target.value, error: "" })}
                    />
                  </label>
                  <div className="pulso-carga-manual-lane-files">
                    <CargaBaseFilePicker
                      kind="xlsform"
                      file={draft.xlsform}
                      disabled={disabled || draft.busy}
                      onPick={(file) => patchDraft(index, { xlsform: file, error: "" })}
                    />
                    <CargaBaseFilePicker
                      kind="data"
                      file={draft.data}
                      disabled={disabled || draft.busy}
                      onPick={(file) => patchDraft(index, { data: file, error: "" })}
                    />
                  </div>
                  <button
                    type="button"
                    className="pulso-carga-manual-lane-action"
                    disabled={!canMaterialize}
                    onClick={() => void materializeLane(index)}
                  >
                    {draft.busy ? <Loader2 size={14} className="pulso-spin" /> : <Plus size={14} />}
                    {draft.busy ? "Materializando…" : "Crear esta base"}
                  </button>
                  {draft.error ? <span className="pulso-carga-manual-lane-error" role="alert">{draft.error}</span> : null}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {lanes.length === 0 ? (
        <div className="pulso-carga-manual-lanes-empty"><Database size={15} /> No hay entradas planificadas.</div>
      ) : null}
    </section>
  );
}
