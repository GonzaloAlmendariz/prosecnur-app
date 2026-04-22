import { useEffect, useState } from "react";
import {
  ArrowLeft, Check, Database, FileSpreadsheet, Layers, Plus, RefreshCw,
  Trash2, Upload, Pencil, X as XIcon,
} from "lucide-react";
import {
  apiEstudioAddBase,
  apiEstudioDowngradeToSingle,
  apiEstudioGet,
  apiEstudioRemoveBase,
  apiEstudioRenameBase,
  apiEstudioReplaceBaseFiles,
  apiEstudioSetNombre,
  apiUpload,
  EstudioBase,
  EstudioPayload,
} from "../../api/client";
import { ErrorBlock } from "../../components/States";

// Panel de bases del estudio (multi-base nativo).
//
// Se renderiza cuando la sesión ya tiene un estudio con ≥ 1 base real
// (ej. tras cargar un demo multi-base como Acreditación, o tras crear
// un estudio manualmente con `apiEstudioAddBase`). Reemplaza a los
// UploadCards single-base de CargaPage en ese caso.
//
// Acciones:
//  - Renombrar el estudio completo y cada base.
//  - Quitar cada base del estudio.
//  - Reemplazar los archivos (XLSForm y/o data) de una base existente.
//  - Agregar una base nueva subiendo su par (XLSForm + data). Nombre
//    opcional — si no se provee, el backend lo auto-nombra (base_N).
//  - "Volver a carga simple" cuando queda 1 sola base: degrada el
//    estudio y restaura el flujo single-base sin perder los archivos.
//
// Las bases tienen nombre único que se usa como prefijo en la notación
// `"fuente$variable"` de los slides — por eso el rename tiene impacto
// downstream que el usuario verá inmediatamente en Gráficos.

type Props = {
  estudio: EstudioPayload;
  onChanged: (payload: EstudioPayload) => Promise<void>;
  /** Si `true`, abre automáticamente el form "Agregar base" al montar.
      Útil cuando el usuario llega acá tras un "+ Agregar otra base" en
      la carga simple y queremos evitarle un click extra. */
  autoOpenAdd?: boolean;
  /** Callback que disparamos una vez que consumimos el auto-open, para
      que el parent lo resetee (ej. React.StrictMode no vuelva a abrir). */
  onAutoOpenConsumed?: () => void;
  /** Callback tras degradar multi-base → single-base. El parent debe
      refrescar el state de sesión y limpiar la referencia al estudio. */
  onDowngraded?: () => Promise<void>;
};

export function BasesPanel({
  estudio, onChanged, autoOpenAdd, onAutoOpenConsumed, onDowngraded,
}: Props) {
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [adding, setAdding] = useState(false);
  const [replacingFiles, setReplacingFiles] = useState<string | null>(null);
  const [busy, setBusy] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [editingEstudioNombre, setEditingEstudioNombre] = useState(false);
  const [estudioDraft, setEstudioDraft] = useState("");

  // Consumir la señal de auto-open una sola vez al montar/recibir true.
  useEffect(() => {
    if (autoOpenAdd) {
      setAdding(true);
      onAutoOpenConsumed?.();
    }
  }, [autoOpenAdd]); // eslint-disable-line react-hooks/exhaustive-deps

  const bases = Object.values(estudio.bases);
  const maxReached = estudio.n_bases >= estudio.max_bases;

  async function handleRemoveBase(nombre: string) {
    if (!window.confirm(
      `¿Quitar la base "${nombre}"?\n\nSus datos y su instrumento se descartan. Si un slide de gráficos usa variables con prefijo "${nombre}$", van a quedar huérfanas.`
    )) return;
    setError(""); setBusy(`Quitando ${nombre}…`);
    try {
      await apiEstudioRemoveBase(nombre);
      const p = await apiEstudioGet();
      await onChanged(p);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  async function handleRenameBase(nombreActual: string) {
    const nuevo = renameDraft.trim();
    if (!nuevo || nuevo === nombreActual) {
      setRenaming(null);
      return;
    }
    setError(""); setBusy(`Renombrando ${nombreActual} → ${nuevo}…`);
    try {
      const p = await apiEstudioRenameBase(nombreActual, nuevo);
      await onChanged(p);
      setRenaming(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  async function handleDowngrade() {
    // Volver a carga simple: disponible con 0 o 1 bases.
    if (bases.length > 1) return;
    // Con 0 bases no hay nada que confirmar — solo apaga el modo.
    if (bases.length === 1 && !window.confirm(
      `¿Volver al modo de carga simple?\n\nEl estudio con varias bases se cierra. ` +
      `Los archivos (XLSForm + data) quedan como carga simple y puedes ` +
      `seguir trabajando normalmente.`
    )) return;
    setError(""); setBusy("Volviendo a carga simple…");
    try {
      await apiEstudioDowngradeToSingle();
      await onDowngraded?.();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  async function handleDiscardEstudio() {
    // Destruir el estudio cuando hay >1 bases — es irreversible, así
    // que pedimos confirmación fuerte con el nombre escrito.
    const confirm1 = window.confirm(
      `¿Descartar el estudio completo?\n\n` +
      `Se quitarán las ${bases.length} bases y sus datos. ` +
      `Esto NO se puede deshacer.\n\n¿Continuar?`
    );
    if (!confirm1) return;
    setError(""); setBusy("Descartando estudio…");
    try {
      // Quitar todas las bases una a una. El backend se encarga del
      // cleanup de estudio cuando la última base sale.
      for (const b of bases) {
        await apiEstudioRemoveBase(b.nombre);
      }
      await onDowngraded?.();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  async function handleEstudioNombre() {
    const nuevo = estudioDraft.trim();
    if (!nuevo || nuevo === (typeof estudio.nombre === "string" ? estudio.nombre : null)) {
      setEditingEstudioNombre(false);
      return;
    }
    setError(""); setBusy(`Guardando nombre…`);
    try {
      const p = await apiEstudioSetNombre(nuevo);
      await onChanged(p);
      setEditingEstudioNombre(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  return (
    <section style={{ marginBottom: 28 }}>
      {/* Header del estudio — nombre editable + chip de bases */}
      <header
        style={{
          display: "flex", alignItems: "center", gap: 12,
          padding: "14px 18px",
          borderRadius: 10,
          background: "var(--pulso-primary-soft)",
          border: "1px solid var(--pulso-primary-border)",
          marginBottom: 16, flexWrap: "wrap",
        }}
      >
        <span
          aria-hidden="true"
          style={{
            width: 36, height: 36, borderRadius: 9,
            background: "white", color: "var(--pulso-primary)",
            border: "1px solid var(--pulso-primary-border)",
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Layers size={18} />
        </span>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: "var(--pulso-primary)" }}>
            Estudio multi-base
          </div>
          {editingEstudioNombre ? (
            <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 2 }}>
              <input
                autoFocus
                type="text"
                value={estudioDraft}
                onChange={(e) => setEstudioDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void handleEstudioNombre();
                  if (e.key === "Escape") setEditingEstudioNombre(false);
                }}
                onBlur={() => void handleEstudioNombre()}
                placeholder="Nombre del estudio"
                style={{
                  fontSize: 16, fontWeight: 700,
                  padding: "4px 8px", borderRadius: 6,
                  border: "1px solid var(--pulso-primary-border)",
                  background: "white", outline: "none",
                  minWidth: 220,
                }}
              />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                setEstudioDraft(typeof estudio.nombre === "string" ? estudio.nombre : "");
                setEditingEstudioNombre(true);
              }}
              title="Renombrar estudio"
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                fontSize: 16, fontWeight: 700, color: "var(--pulso-text)",
                padding: "2px 6px", borderRadius: 4,
                border: "1px solid transparent", background: "transparent",
                cursor: "pointer",
                transition: "background 120ms ease, border-color 120ms ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "white";
                e.currentTarget.style.borderColor = "var(--pulso-primary-border)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.borderColor = "transparent";
              }}
            >
              {(typeof estudio.nombre === "string" && estudio.nombre) || "Sin nombre"}
              <Pencil size={11} style={{ opacity: 0.6 }} />
            </button>
          )}
          <div style={{ fontSize: 11, color: "var(--pulso-text-soft)", marginTop: 2, lineHeight: 1.4 }}>
            Cada base tiene su propio XLSForm + datos. Los slides del reporte pueden mezclarlos con la notación{" "}
            <code style={{ fontFamily: "ui-monospace, monospace", fontSize: 10 }}>fuente$variable</code>.
          </div>
        </div>
        <span
          style={{
            fontSize: 11, fontWeight: 700,
            padding: "4px 10px", borderRadius: 999,
            background: "white",
            border: "1px solid var(--pulso-primary-border)",
            color: "var(--pulso-primary)",
            flexShrink: 0,
            fontFamily: "ui-monospace, monospace",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {estudio.n_bases} {estudio.n_bases === 1 ? "base" : "bases"}
        </span>

        {/* Acción de salida contextual:
            - 0 o 1 base: "Volver a carga simple" (no destructivo).
            - ≥2 bases: "Cerrar estudio" (destructivo, confirmación). */}
        {bases.length <= 1 ? (
          <button
            type="button"
            onClick={handleDowngrade}
            disabled={!!busy}
            title="Cerrar el modo multi-base — los archivos de esta base quedan en carga simple"
            style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              fontSize: 11, fontWeight: 600,
              padding: "6px 10px", borderRadius: 7,
              border: "1px solid var(--pulso-primary-border)",
              background: "white",
              color: "var(--pulso-primary)",
              cursor: busy ? "wait" : "pointer",
              flexShrink: 0,
              transition: "background 120ms ease",
            }}
            onMouseEnter={(e) => {
              if (busy) return;
              e.currentTarget.style.background = "var(--pulso-primary)";
              e.currentTarget.style.color = "white";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "white";
              e.currentTarget.style.color = "var(--pulso-primary)";
            }}
          >
            <ArrowLeft size={11} /> Volver a carga simple
          </button>
        ) : (
          <button
            type="button"
            onClick={handleDiscardEstudio}
            disabled={!!busy}
            title="Cerrar el estudio y descartar todas las bases"
            style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              fontSize: 11, fontWeight: 600,
              padding: "6px 10px", borderRadius: 7,
              border: "1px solid var(--pulso-border)",
              background: "white",
              color: "var(--pulso-text-soft)",
              cursor: busy ? "wait" : "pointer",
              flexShrink: 0,
              transition: "border-color 120ms ease, background 120ms ease, color 120ms ease",
            }}
            onMouseEnter={(e) => {
              if (busy) return;
              e.currentTarget.style.borderColor = "var(--pulso-danger-border)";
              e.currentTarget.style.background = "var(--pulso-danger-bg)";
              e.currentTarget.style.color = "var(--pulso-danger-fg)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "var(--pulso-border)";
              e.currentTarget.style.background = "white";
              e.currentTarget.style.color = "var(--pulso-text-soft)";
            }}
          >
            <XIcon size={11} /> Cerrar estudio
          </button>
        )}
      </header>

      {/* Lista de bases */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {bases.map((b) => (
          <div key={b.nombre}>
            <BaseRow
              base={b}
              isRenaming={renaming === b.nombre}
              renameDraft={renameDraft}
              onStartRename={() => { setRenameDraft(b.nombre); setRenaming(b.nombre); }}
              onRenameChange={setRenameDraft}
              onRenameCommit={() => handleRenameBase(b.nombre)}
              onRenameCancel={() => setRenaming(null)}
              onRemove={() => handleRemoveBase(b.nombre)}
              onStartReplace={() => setReplacingFiles(b.nombre)}
              isReplacing={replacingFiles === b.nombre}
              busy={!!busy}
            />
            {replacingFiles === b.nombre && (
              <ReplaceFilesForm
                baseNombre={b.nombre}
                onSubmit={async ({ xlsformFileId, dataFileId }) => {
                  setError(""); setBusy(`Reemplazando archivos de ${b.nombre}…`);
                  try {
                    const p = await apiEstudioReplaceBaseFiles(b.nombre, {
                      xlsform_file_id: xlsformFileId || undefined,
                      data_file_id:    dataFileId    || undefined,
                    });
                    await onChanged(p);
                    setReplacingFiles(null);
                  } catch (e) {
                    setError((e as Error).message);
                  } finally {
                    setBusy("");
                  }
                }}
                onCancel={() => setReplacingFiles(null)}
              />
            )}
          </div>
        ))}
      </div>

      {/* Agregar base */}
      {adding ? (
        <AddBaseForm
          existingNombres={bases.map((b) => b.nombre)}
          onSubmit={async ({ nombre, xlsformFileId, dataFileId }) => {
            setError(""); setBusy(`Agregando ${nombre}…`);
            try {
              await apiEstudioAddBase({
                nombre,
                xlsform_file_id: xlsformFileId,
                data_file_id: dataFileId,
              });
              const p = await apiEstudioGet();
              await onChanged(p);
              setAdding(false);
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy("");
            }
          }}
          onCancel={() => setAdding(false)}
        />
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          disabled={maxReached || !!busy}
          style={{
            marginTop: 12,
            display: "inline-flex", alignItems: "center", gap: 6,
            fontSize: 12, fontWeight: 600,
            padding: "8px 14px", borderRadius: 8,
            border: "1px dashed var(--pulso-primary-border)",
            background: "var(--pulso-primary-soft)",
            color: "var(--pulso-primary)",
            cursor: maxReached ? "not-allowed" : "pointer",
            opacity: maxReached ? 0.55 : 1,
            transition: "background 120ms ease, border-color 120ms ease",
          }}
          onMouseEnter={(e) => {
            if (maxReached || busy) return;
            e.currentTarget.style.borderStyle = "solid";
            e.currentTarget.style.background = "white";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderStyle = "dashed";
            e.currentTarget.style.background = "var(--pulso-primary-soft)";
          }}
        >
          <Plus size={13} />
          {maxReached
            ? `Límite de ${estudio.max_bases} bases alcanzado`
            : "Agregar otra base"}
        </button>
      )}

      {busy && (
        <div style={{ marginTop: 10, fontSize: 11, color: "var(--pulso-text-soft)", fontStyle: "italic" }}>
          {busy}
        </div>
      )}
      {error && (
        <div style={{ marginTop: 10 }}>
          <ErrorBlock label="No se pudo completar" detail={error} />
        </div>
      )}
    </section>
  );
}

// =====================================================================
// BaseRow — una base dentro del estudio
// =====================================================================
function BaseRow({
  base, isRenaming, renameDraft,
  onStartRename, onRenameChange, onRenameCommit, onRenameCancel,
  onRemove, onStartReplace, isReplacing, busy,
}: {
  base: EstudioBase;
  isRenaming: boolean;
  renameDraft: string;
  onStartRename: () => void;
  onRenameChange: (v: string) => void;
  onRenameCommit: () => void;
  onRenameCancel: () => void;
  onRemove: () => void;
  onStartReplace: () => void;
  isReplacing: boolean;
  busy: boolean;
}) {
  return (
    <div
      style={{
        display: "flex", alignItems: "center", gap: 14,
        padding: "14px 16px", borderRadius: 10,
        border: "1px solid var(--pulso-success-border)",
        background: "var(--pulso-success-bg)",
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 36, height: 36, borderRadius: 9,
          background: "white",
          color: "var(--pulso-success-fg)",
          border: "1px solid var(--pulso-success-border)",
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <Check size={18} />
      </span>

      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
        {isRenaming ? (
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <input
              autoFocus
              type="text"
              value={renameDraft}
              onChange={(e) => onRenameChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onRenameCommit();
                if (e.key === "Escape") onRenameCancel();
              }}
              onBlur={onRenameCommit}
              placeholder="nombre (sin $, sin espacios)"
              style={{
                fontSize: 14, fontWeight: 700,
                fontFamily: "ui-monospace, monospace",
                padding: "4px 8px", borderRadius: 5,
                border: "1px solid var(--pulso-primary-border)",
                background: "white", outline: "none",
                minWidth: 200,
              }}
            />
          </div>
        ) : (
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <code
              style={{
                fontSize: 14, fontWeight: 700,
                fontFamily: "ui-monospace, monospace",
                color: "var(--pulso-text)",
              }}
            >
              {base.nombre}
            </code>
            <button
              type="button"
              onClick={onStartRename}
              disabled={busy}
              title="Renombrar base"
              aria-label={`Renombrar base ${base.nombre}`}
              className="pulso-icon"
              style={{ minWidth: 22, minHeight: 22 }}
            >
              <Pencil size={10} />
            </button>
          </div>
        )}
        <div
          style={{
            display: "flex", alignItems: "center", gap: 14,
            fontSize: 11, color: "var(--pulso-text-soft)",
            flexWrap: "wrap",
          }}
        >
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            <FileSpreadsheet size={12} /> XLSForm cargado
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            <Database size={12} />
            {base.n_filas != null && base.n_columnas != null
              ? `${base.n_filas} filas · ${base.n_columnas} cols`
              : "Datos cargados"}
            {base.data_ext && ` · .${base.data_ext}`}
          </span>
        </div>
      </div>

      <div style={{ display: "inline-flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
        <button
          type="button"
          onClick={onStartReplace}
          disabled={busy || isReplacing}
          title={`Reemplazar el XLSForm o la data de ${base.nombre}`}
          aria-label={`Reemplazar archivos de ${base.nombre}`}
          style={{
            display: "inline-flex", alignItems: "center", gap: 4,
            fontSize: 11, fontWeight: 600,
            padding: "6px 10px", borderRadius: 6,
            border: "1px solid var(--pulso-border)",
            background: isReplacing ? "var(--pulso-primary-soft)" : "white",
            color: isReplacing ? "var(--pulso-primary)" : "var(--pulso-text-soft)",
            cursor: busy ? "wait" : "pointer",
            transition: "border-color 120ms ease, background 120ms ease, color 120ms ease",
          }}
          onMouseEnter={(e) => {
            if (busy || isReplacing) return;
            e.currentTarget.style.borderColor = "var(--pulso-primary-border)";
            e.currentTarget.style.color = "var(--pulso-primary)";
          }}
          onMouseLeave={(e) => {
            if (isReplacing) return;
            e.currentTarget.style.borderColor = "var(--pulso-border)";
            e.currentTarget.style.color = "var(--pulso-text-soft)";
          }}
        >
          <RefreshCw size={11} /> Reemplazar
        </button>

        <button
          type="button"
          onClick={onRemove}
          disabled={busy}
          title={`Quitar base ${base.nombre}`}
          aria-label={`Quitar base ${base.nombre}`}
          style={{
            display: "inline-flex", alignItems: "center", gap: 4,
            fontSize: 11, fontWeight: 600,
            padding: "6px 10px", borderRadius: 6,
            border: "1px solid var(--pulso-border)",
            background: "white",
            color: "var(--pulso-text-soft)",
            cursor: busy ? "wait" : "pointer",
            transition: "border-color 120ms ease, background 120ms ease, color 120ms ease",
          }}
          onMouseEnter={(e) => {
            if (busy) return;
            e.currentTarget.style.borderColor = "var(--pulso-danger-border)";
            e.currentTarget.style.background = "var(--pulso-danger-bg)";
            e.currentTarget.style.color = "var(--pulso-danger-fg)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "var(--pulso-border)";
            e.currentTarget.style.background = "white";
            e.currentTarget.style.color = "var(--pulso-text-soft)";
          }}
        >
          <Trash2 size={11} /> Quitar
        </button>
      </div>
    </div>
  );
}

// =====================================================================
// AddBaseForm — formulario inline para agregar base
// =====================================================================
function AddBaseForm({
  existingNombres, onSubmit, onCancel,
}: {
  existingNombres: string[];
  /** `nombre` viaja vacío al backend → auto-nombra `base_N`. */
  onSubmit: (args: { nombre: string; xlsformFileId: string; dataFileId: string }) => Promise<void>;
  onCancel: () => void;
}) {
  const [nombre, setNombre] = useState("");
  const [xlsformFile, setXlsformFile] = useState<File | null>(null);
  const [dataFile, setDataFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  // Sugerencia de auto-name que el backend asignará si se deja vacío.
  const autoName = (() => {
    let i = 1;
    while (existingNombres.includes(`base_${i}`)) i += 1;
    return `base_${i}`;
  })();

  // Validaciones solo si el usuario escribió algo. Nombre vacío = ok
  // (auto-name del backend).
  const nombreTocado = nombre.length > 0;
  const nombreValido = !nombreTocado || (!nombre.includes("$") && !/\s/.test(nombre));
  const nombreDuplicado = nombreTocado && existingNombres.includes(nombre.trim());
  const puedeAgregar = nombreValido && !nombreDuplicado && !!xlsformFile && !!dataFile && !uploading;

  async function handleSubmit() {
    if (!puedeAgregar || !xlsformFile || !dataFile) return;
    setError(""); setUploading(true);
    try {
      // Subir los dos archivos al file store.
      const upXls = await apiUpload(xlsformFile, "xlsform");
      const dataKind = xlsformFile.name.endsWith(".sav") ? "sav" : "data";
      const upData = await apiUpload(dataFile, dataFile.name.toLowerCase().endsWith(".sav") ? "sav" : dataKind);
      // Nombre vacío = backend auto-genera.
      await onSubmit({
        nombre: nombre.trim(),
        xlsformFileId: upXls.file_id,
        dataFileId: upData.file_id,
      });
      setNombre("");
      setXlsformFile(null);
      setDataFile(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div
      style={{
        marginTop: 14,
        padding: "18px 20px", borderRadius: 10,
        border: "1px solid var(--pulso-primary)",
        background: "white",
        boxShadow: "var(--pulso-shadow-med)",
        display: "flex", flexDirection: "column", gap: 14,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span
          aria-hidden="true"
          style={{
            width: 32, height: 32, borderRadius: 8,
            background: "var(--pulso-primary-soft)",
            color: "var(--pulso-primary)",
            border: "1px solid var(--pulso-primary-border)",
            display: "inline-flex", alignItems: "center", justifyContent: "center",
          }}
        >
          <Plus size={16} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--pulso-text)" }}>
            Agregar otra base al estudio
          </div>
          <div style={{ fontSize: 11, color: "var(--pulso-text-soft)", lineHeight: 1.5, marginTop: 2 }}>
            Sube el XLSForm y la base de datos. El nombre es opcional — si lo
            dejas vacío se llamará <code style={{ fontFamily: "ui-monospace, monospace" }}>{autoName}</code>{" "}
            y podrás renombrarla después.
          </div>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="pulso-icon"
          aria-label="Cancelar"
          title="Cancelar"
          disabled={uploading}
        >
          <XIcon size={13} />
        </button>
      </div>

      {/* Nombre (opcional — si vacío, backend auto-nombra). */}
      <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: "var(--pulso-text-soft)", textTransform: "uppercase", letterSpacing: 0.4 }}>
          Nombre de la base <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0, opacity: 0.7 }}>(opcional)</span>
        </span>
        <input
          type="text"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder={autoName}
          style={{
            fontSize: 13, fontFamily: "ui-monospace, monospace",
            padding: "8px 12px", borderRadius: 7,
            border: `1px solid ${
              nombreDuplicado ? "var(--pulso-danger-border)" :
              nombreTocado && !nombreValido ? "var(--pulso-warn-border)" :
              "var(--pulso-border)"
            }`,
            background: "white", outline: "none",
          }}
        />
        {nombreDuplicado && (
          <span style={{ fontSize: 10, color: "var(--pulso-danger-fg)" }}>
            Ya existe una base con ese nombre.
          </span>
        )}
        {nombreTocado && !nombreValido && !nombreDuplicado && (
          <span style={{ fontSize: 10, color: "var(--pulso-warn-fg)" }}>
            Usa letras, números y guiones. Sin espacios ni el símbolo $.
          </span>
        )}
      </label>

      {/* Uploaders */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 10,
        }}
      >
        <FilePicker
          icon={FileSpreadsheet}
          title="XLSForm"
          accept=".xlsx,.xls"
          acceptLabel="Excel (.xlsx)"
          file={xlsformFile}
          onPick={setXlsformFile}
        />
        <FilePicker
          icon={Database}
          title="Base de datos"
          accept=".xlsx,.xls,.csv,.sav"
          acceptLabel=".xlsx · .csv · .sav"
          file={dataFile}
          onPick={setDataFile}
        />
      </div>

      {error && <ErrorBlock label="Error al agregar base" detail={error} />}

      <div style={{ display: "flex", gap: 12, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
        {/* Hint explícito sobre qué falta — el botón deshabilitado
            solo no es affordance suficiente. */}
        <div style={{ fontSize: 11, color: "var(--pulso-text-soft)", flex: 1, minWidth: 200 }}>
          {!puedeAgregar && !uploading && (
            <>
              {!xlsformFile && !dataFile
                ? "Falta subir el XLSForm y la base de datos."
                : !xlsformFile
                ? "Falta subir el XLSForm."
                : !dataFile
                ? "Falta subir la base de datos."
                : nombreDuplicado
                ? "Cambia el nombre — ya existe una base así."
                : !nombreValido
                ? "El nombre tiene caracteres no permitidos."
                : ""}
            </>
          )}
        </div>
        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          <button
            type="button"
            onClick={onCancel}
            disabled={uploading}
            style={{ fontSize: 12, padding: "7px 14px" }}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="pulso-primary"
            onClick={handleSubmit}
            disabled={!puedeAgregar}
            style={{
              fontSize: 12, padding: "7px 14px",
              opacity: puedeAgregar ? 1 : 0.55,
              display: "inline-flex", alignItems: "center", gap: 6,
            }}
          >
            <Plus size={12} />
            {uploading ? "Subiendo…" : "Agregar base"}
          </button>
        </div>
      </div>
    </div>
  );
}

// =====================================================================
// ReplaceFilesForm — editor inline para cambiar XLSForm y/o data de una
// base existente. Al menos uno de los dos archivos debe ser provisto.
// =====================================================================
function ReplaceFilesForm({
  baseNombre, onSubmit, onCancel,
}: {
  baseNombre: string;
  onSubmit: (args: { xlsformFileId: string; dataFileId: string }) => Promise<void>;
  onCancel: () => void;
}) {
  const [xlsformFile, setXlsformFile] = useState<File | null>(null);
  const [dataFile, setDataFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const puedeReemplazar = (!!xlsformFile || !!dataFile) && !uploading;

  async function handleSubmit() {
    if (!puedeReemplazar) return;
    setError(""); setUploading(true);
    try {
      let xlsformFileId = "";
      let dataFileId = "";
      if (xlsformFile) {
        const up = await apiUpload(xlsformFile, "xlsform");
        xlsformFileId = up.file_id;
      }
      if (dataFile) {
        const kind = dataFile.name.toLowerCase().endsWith(".sav") ? "sav" : "data";
        const up = await apiUpload(dataFile, kind);
        dataFileId = up.file_id;
      }
      await onSubmit({ xlsformFileId, dataFileId });
      setXlsformFile(null);
      setDataFile(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div
      style={{
        marginTop: 8,
        padding: "14px 16px", borderRadius: 10,
        border: "1px solid var(--pulso-primary)",
        background: "white",
        boxShadow: "var(--pulso-shadow-med)",
        display: "flex", flexDirection: "column", gap: 12,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span
          aria-hidden="true"
          style={{
            width: 30, height: 30, borderRadius: 8,
            background: "var(--pulso-primary-soft)",
            color: "var(--pulso-primary)",
            border: "1px solid var(--pulso-primary-border)",
            display: "inline-flex", alignItems: "center", justifyContent: "center",
          }}
        >
          <RefreshCw size={14} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--pulso-text)" }}>
            Reemplazar archivos de <code style={{ fontFamily: "ui-monospace, monospace" }}>{baseNombre}</code>
          </div>
          <div style={{ fontSize: 11, color: "var(--pulso-text-soft)", lineHeight: 1.5, marginTop: 2 }}>
            Sube el XLSForm, la base de datos, o ambos. Lo que no toques se
            queda igual. La validación y el plan de analítica se invalidan.
          </div>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="pulso-icon"
          aria-label="Cancelar"
          title="Cancelar"
          disabled={uploading}
        >
          <XIcon size={13} />
        </button>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 10,
        }}
      >
        <FilePicker
          icon={FileSpreadsheet}
          title="Nuevo XLSForm"
          accept=".xlsx,.xls"
          acceptLabel="Excel (.xlsx) · opcional"
          file={xlsformFile}
          onPick={setXlsformFile}
        />
        <FilePicker
          icon={Database}
          title="Nueva base de datos"
          accept=".xlsx,.xls,.csv,.sav"
          acceptLabel=".xlsx · .csv · .sav · opcional"
          file={dataFile}
          onPick={setDataFile}
        />
      </div>

      {error && <ErrorBlock label="Error al reemplazar archivos" detail={error} />}

      <div style={{ display: "flex", gap: 12, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
        <div style={{ fontSize: 11, color: "var(--pulso-text-soft)", flex: 1, minWidth: 200 }}>
          {!puedeReemplazar && !uploading && "Sube al menos uno de los dos archivos para reemplazar."}
        </div>
        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          <button
            type="button"
            onClick={onCancel}
            disabled={uploading}
            style={{ fontSize: 12, padding: "7px 14px" }}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="pulso-primary"
            onClick={handleSubmit}
            disabled={!puedeReemplazar}
            style={{
              fontSize: 12, padding: "7px 14px",
              opacity: puedeReemplazar ? 1 : 0.55,
              display: "inline-flex", alignItems: "center", gap: 6,
            }}
          >
            <RefreshCw size={12} />
            {uploading ? "Reemplazando…" : "Reemplazar"}
          </button>
        </div>
      </div>
    </div>
  );
}

type IconCmp = typeof Database;

function FilePicker({
  icon: Icon, title, accept, acceptLabel, file, onPick,
}: {
  icon: IconCmp;
  title: string;
  accept: string;
  acceptLabel: string;
  file: File | null;
  onPick: (f: File | null) => void;
}) {
  const [dragOver, setDragOver] = useState(false);
  return (
    <label
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const f = e.dataTransfer.files?.[0];
        if (f) onPick(f);
      }}
      style={{
        display: "flex", flexDirection: "column", alignItems: "center",
        gap: 4, padding: "14px 12px", borderRadius: 8,
        border: `2px dashed ${
          file ? "var(--pulso-success-border)" :
          dragOver ? "var(--pulso-primary)" :
          "var(--pulso-border)"
        }`,
        background: file
          ? "var(--pulso-success-bg)"
          : dragOver ? "var(--pulso-primary-soft)" : "var(--pulso-surface)",
        cursor: "pointer",
        textAlign: "center",
        transition: "border-color 120ms ease, background 120ms ease",
        minWidth: 0,
      }}
    >
      {file ? (
        <Check size={18} color="var(--pulso-success-fg)" />
      ) : (
        <Upload size={18} color={dragOver ? "var(--pulso-primary)" : "var(--pulso-text-soft)"} />
      )}
      <span
        style={{
          fontSize: 12, fontWeight: 600,
          color: file ? "var(--pulso-success-fg)" : "var(--pulso-text)",
          display: "inline-flex", alignItems: "center", gap: 5,
          maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}
      >
        <Icon size={13} />
        {file ? file.name : title}
      </span>
      <span style={{ fontSize: 10, color: "var(--pulso-text-soft)", fontFamily: "ui-monospace, monospace" }}>
        {acceptLabel}
      </span>
      <input
        type="file"
        accept={accept}
        onChange={(e) => onPick(e.target.files?.[0] ?? null)}
        style={{ display: "none" }}
      />
    </label>
  );
}
