import { useRef, useState } from "react";
import { Upload, Trash2, Pencil, Check, ImageOff } from "lucide-react";
import { apiGraficosIconoUpload, downloadUrl } from "../../api/client";
import { usePlanStore, IconoConfig } from "./store";
import { EmptyState, ErrorBlock, SectionEyebrow } from "./ui/States";

// Editor de biblioteca de iconos PNG. Los iconos son parte esencial de
// los slides de población (p_slide_*_poblacion): aparecen centrados o
// junto al texto en p_slide_objetivo_icono. El analista los sube acá y
// los selecciona después desde el editor de cada slide.
//
// Flujo de upload:
//   - Usuario arrastra un PNG o clickea el área → FileReader lo lee a base64
//   - POST /api/graficos/icons/upload con {nombre, data_base64}
//   - El backend lo guarda en session/$sid/icons/<file_id>.png
//   - Recibimos {id, file_id, nombre} → agregamos al store
//   - Autosave persiste en el config

export function IconosEditor() {
  const iconos = usePlanStore((s) => s.iconos);
  const addIcono = usePlanStore((s) => s.addIcono);
  const renameIcono = usePlanStore((s) => s.renameIcono);
  const removeIcono = usePlanStore((s) => s.removeIcono);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError("");
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        if (!file.type.startsWith("image/")) {
          setError(`"${file.name}" no es imagen, ignorado.`);
          continue;
        }
        const dataBase64 = await readAsBase64(file);
        const nombre = file.name.replace(/\.[^.]+$/, "");
        const r = await apiGraficosIconoUpload(nombre, dataBase64);
        addIcono({
          id: r.id,
          nombre: r.nombre,
          file_id: r.file_id,
          uploaded_at: r.uploaded_at,
        });
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <SectionEyebrow
        label="Iconos para slides de población"
        hint="Sube PNGs que quieras usar como ícono central en slides de población (p_slide_*_poblacion) o como ícono lateral en p_slide_objetivo_icono. Formato recomendado: PNG con fondo transparente, ~500×500 px."
      />

      {/* Drop area */}
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          void handleFiles(e.dataTransfer.files);
        }}
        style={{
          padding: "22px 14px",
          border: `2px dashed ${dragOver ? "var(--pulso-primary)" : "var(--pulso-border)"}`,
          borderRadius: 8,
          background: dragOver ? "var(--pulso-primary-soft)" : "var(--pulso-surface)",
          cursor: uploading ? "wait" : "pointer",
          display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
          transition: "background 120ms ease, border-color 120ms ease",
        }}
      >
        <Upload size={22} color={dragOver ? "var(--pulso-primary)" : "var(--pulso-text-soft)"} />
        <div style={{ fontSize: 12, color: "var(--pulso-text)", fontWeight: 600 }}>
          {uploading ? "Subiendo…" : "Arrastra un PNG o haz click para seleccionar"}
        </div>
        <div style={{ fontSize: 11, color: "var(--pulso-text-soft)" }}>
          Se aceptan múltiples archivos. Solo PNG.
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png"
          multiple
          style={{ display: "none" }}
          onChange={(e) => handleFiles(e.target.files)}
        />
      </label>

      {error && <ErrorBlock label="Error al subir" detail={error} />}

      {/* Grid de iconos */}
      {iconos.length === 0 ? (
        <EmptyState
          variant="inline"
          icon={<ImageOff size={18} />}
          title="Sin iconos"
          hint="Los PNGs que subas aparecerán acá para reutilizar en cualquier slide de población."
        />
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
            gap: 10,
          }}
        >
          {iconos.map((ico) => (
            <IconoCard
              key={ico.id}
              icono={ico}
              onRename={(nombre) => renameIcono(ico.id, nombre)}
              onRemove={() => removeIcono(ico.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function IconoCard({
  icono,
  onRename,
  onRemove,
}: {
  icono: IconoConfig;
  onRename: (nombre: string) => void;
  onRemove: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(icono.nombre);

  function commit() {
    const clean = draft.trim();
    if (clean && clean !== icono.nombre) onRename(clean);
    setEditing(false);
  }

  return (
    <div
      style={{
        display: "flex", flexDirection: "column", gap: 6,
        padding: 8,
        border: "1px solid var(--pulso-border)",
        borderRadius: 8,
        background: "white",
      }}
    >
      <div
        style={{
          aspectRatio: "1 / 1",
          background: "var(--pulso-surface)",
          borderRadius: 6,
          display: "flex", alignItems: "center", justifyContent: "center",
          overflow: "hidden",
        }}
      >
        <img
          src={downloadUrl(icono.file_id)}
          alt={icono.nombre}
          style={{ maxWidth: "80%", maxHeight: "80%", objectFit: "contain" }}
        />
      </div>

      {editing ? (
        <div style={{ display: "flex", gap: 3 }}>
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit();
              if (e.key === "Escape") { setEditing(false); setDraft(icono.nombre); }
            }}
            style={{
              flex: 1, minWidth: 0,
              fontSize: 11, padding: "3px 5px", borderRadius: 4,
              border: "1px solid var(--pulso-primary)",
            }}
          />
          <button type="button" onClick={commit} className="pulso-icon" aria-label="Confirmar">
            <Check size={11} />
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", alignItems: "center", gap: 3, minWidth: 0 }}>
          <div
            style={{
              flex: 1, minWidth: 0,
              fontSize: 11, fontWeight: 600, color: "var(--pulso-text)",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}
            title={icono.nombre}
          >
            {icono.nombre}
          </div>
          <button
            type="button"
            onClick={() => { setDraft(icono.nombre); setEditing(true); }}
            className="pulso-icon"
            aria-label="Renombrar"
            title="Renombrar"
          >
            <Pencil size={10} />
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="pulso-icon pulso-icon-danger"
            aria-label="Eliminar"
            title="Eliminar"
          >
            <Trash2 size={10} />
          </button>
        </div>
      )}
    </div>
  );
}

// Lee un File como string base64 (sin prefijo data-url).
function readAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("FileReader no devolvió string"));
        return;
      }
      // Quitar prefijo "data:image/png;base64,"
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error ?? new Error("Error leyendo archivo"));
    reader.readAsDataURL(file);
  });
}
