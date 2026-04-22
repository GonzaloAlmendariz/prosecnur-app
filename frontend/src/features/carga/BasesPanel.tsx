import { useState } from "react";
import {
  Check, Database, FileSpreadsheet, Layers, Plus, Trash2, Upload,
  Pencil, X as XIcon,
} from "lucide-react";
import {
  apiEstudioAddBase,
  apiEstudioGet,
  apiEstudioRemoveBase,
  apiEstudioRenameBase,
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
//  - Renombrar cada base.
//  - Quitar cada base del estudio.
//  - Agregar una base nueva subiendo su par (XLSForm + data) con nombre
//    único dentro del estudio.
//
// Las bases tienen nombre único (ej. "docentes") que se usa como
// prefijo en la notación `"fuente$variable"` de los slides de gráficos,
// por lo que cambiar el nombre tiene impacto downstream — el usuario
// lo verá inmediatamente.

type Props = {
  estudio: EstudioPayload;
  onChanged: (payload: EstudioPayload) => Promise<void>;
};

export function BasesPanel({ estudio, onChanged }: Props) {
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [editingEstudioNombre, setEditingEstudioNombre] = useState(false);
  const [estudioDraft, setEstudioDraft] = useState("");

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

  async function handleEstudioNombre() {
    const nuevo = estudioDraft.trim();
    if (!nuevo || nuevo === estudio.nombre) {
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
                setEstudioDraft(estudio.nombre ?? "");
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
              {estudio.nombre || "Sin nombre"}
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
          {estudio.n_bases} / {estudio.max_bases} bases
        </span>
      </header>

      {/* Lista de bases */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {bases.map((b) => (
          <BaseRow
            key={b.nombre}
            base={b}
            isRenaming={renaming === b.nombre}
            renameDraft={renameDraft}
            onStartRename={() => { setRenameDraft(b.nombre); setRenaming(b.nombre); }}
            onRenameChange={setRenameDraft}
            onRenameCommit={() => handleRenameBase(b.nombre)}
            onRenameCancel={() => setRenaming(null)}
            onRemove={() => handleRemoveBase(b.nombre)}
            busy={!!busy}
          />
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
  onRemove, busy,
}: {
  base: EstudioBase;
  isRenaming: boolean;
  renameDraft: string;
  onStartRename: () => void;
  onRenameChange: (v: string) => void;
  onRenameCommit: () => void;
  onRenameCancel: () => void;
  onRemove: () => void;
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
        <Trash2 size={11} /> Quitar
      </button>
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
  onSubmit: (args: { nombre: string; xlsformFileId: string; dataFileId: string }) => Promise<void>;
  onCancel: () => void;
}) {
  const [nombre, setNombre] = useState("");
  const [xlsformFile, setXlsformFile] = useState<File | null>(null);
  const [dataFile, setDataFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const nombreValido = nombre.trim().length > 0 && !nombre.includes("$") && !/\s/.test(nombre);
  const nombreDuplicado = existingNombres.includes(nombre.trim());
  const puedeAgregar = nombreValido && !nombreDuplicado && !!xlsformFile && !!dataFile && !uploading;

  async function handleSubmit() {
    if (!puedeAgregar || !xlsformFile || !dataFile) return;
    setError(""); setUploading(true);
    try {
      // Subir los dos archivos al file store.
      const upXls = await apiUpload(xlsformFile, "xlsform");
      const dataKind = xlsformFile.name.endsWith(".sav") ? "sav" : "data";
      const upData = await apiUpload(dataFile, dataFile.name.toLowerCase().endsWith(".sav") ? "sav" : dataKind);
      // Registrar la base.
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
            Dale un nombre identificador (ej. <code style={{ fontFamily: "ui-monospace, monospace" }}>docentes</code>,{" "}
            <code style={{ fontFamily: "ui-monospace, monospace" }}>estudiantes</code>) y sube su XLSForm + base.
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

      {/* Nombre */}
      <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: "var(--pulso-text-soft)", textTransform: "uppercase", letterSpacing: 0.4 }}>
          Nombre de la base
        </span>
        <input
          type="text"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="ej. docentes"
          style={{
            fontSize: 13, fontFamily: "ui-monospace, monospace",
            padding: "8px 12px", borderRadius: 7,
            border: `1px solid ${
              nombreDuplicado ? "var(--pulso-danger-border)" :
              nombre && !nombreValido ? "var(--pulso-warn-border)" :
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
        {nombre && !nombreValido && !nombreDuplicado && (
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

      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
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
