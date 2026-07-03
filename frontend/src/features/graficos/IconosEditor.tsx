import { useRef, useState } from "react";
import { Upload, Trash2, Pencil, Check, ImageOff, Images, CheckCircle2, Sparkles } from "lucide-react";
import { apiGraficosIconoUpload, downloadUrl } from "../../api/client";
import { usePlanStore, IconoConfig } from "./store";
import { EmptyState, ErrorBlock } from "../../components/States";

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
  const lastIcon = iconos[iconos.length - 1];

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError("");
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        if (file.type !== "image/png") {
          setError(`"${file.name}" no es PNG, ignorado.`);
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
    <div className="pulso-gv2-iconos-editor">
      <section className="pulso-gv2-iconos-hero" aria-label="Biblioteca de iconos para slides">
        <div className="pulso-gv2-iconos-hero-main">
          <span className="pulso-gv2-iconos-hero-mark" aria-hidden="true">
            <Images size={18} />
          </span>
          <div className="pulso-gv2-iconos-hero-copy">
            <span>Biblioteca de assets</span>
            <strong>Iconos para slides de población</strong>
            <small>PNGs transparentes para objetivos, públicos, cobertura y láminas con apoyo visual.</small>
          </div>
        </div>
        <div className="pulso-gv2-iconos-hero-stats" aria-label="Estado de la biblioteca">
          <span>
            <strong>{iconos.length}</strong>
            <small>{iconos.length === 1 ? "icono" : "iconos"}</small>
          </span>
          <span>
            <strong>PNG</strong>
            <small>transparente</small>
          </span>
          <span>
            <strong>{lastIcon ? "Listo" : "Base"}</strong>
            <small>{lastIcon ? lastIcon.nombre : "sin assets"}</small>
          </span>
        </div>
      </section>

      <div className="pulso-gv2-iconos-workbench">
        <label
          className="pulso-gv2-iconos-dropzone"
          data-active={dragOver ? "true" : "false"}
          data-uploading={uploading ? "true" : "false"}
          aria-busy={uploading}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              fileInputRef.current?.click();
            }
          }}
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
        >
          <span className="pulso-gv2-iconos-drop-orbit" aria-hidden="true">
            <Upload size={20} />
          </span>
          <span className="pulso-gv2-iconos-drop-copy">
            <strong>{uploading ? "Subiendo assets..." : "Arrastra PNGs o selecciona archivos"}</strong>
            <small>Usa fondo transparente, borde limpio y aproximadamente 500 x 500 px.</small>
          </span>
          <span className="pulso-gv2-iconos-drop-pill">
            <Sparkles size={12} />
            Reutilizable
          </span>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png"
          multiple
          style={{ display: "none" }}
          onChange={(e) => handleFiles(e.target.files)}
        />
        </label>

        <aside className="pulso-gv2-iconos-guidance" aria-label="Guía de calidad de iconos">
          <span><CheckCircle2 size={13} /> Transparencia real</span>
          <span><CheckCircle2 size={13} /> Contraste sobre fondo claro</span>
          <span><CheckCircle2 size={13} /> Silueta legible a 32 px</span>
        </aside>
      </div>

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
        <div className="pulso-gv2-iconos-grid" aria-label="Iconos cargados">
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
    <article className="pulso-gv2-icon-card">
      <div className="pulso-gv2-icon-card-preview">
        <img
          src={downloadUrl(icono.file_id)}
          alt={icono.nombre}
        />
      </div>

      {editing ? (
        <div className="pulso-gv2-icon-card-edit">
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit();
              if (e.key === "Escape") { setEditing(false); setDraft(icono.nombre); }
            }}
          />
          <button type="button" onClick={commit} className="pulso-icon" aria-label="Confirmar">
            <Check size={11} />
          </button>
        </div>
      ) : (
        <div className="pulso-gv2-icon-card-footer">
          <span className="pulso-gv2-icon-card-name" title={icono.nombre}>
            <strong>{icono.nombre}</strong>
            <small>Asset PNG</small>
          </span>
          <span className="pulso-gv2-icon-card-actions">
            <button
              type="button"
              onClick={() => { setDraft(icono.nombre); setEditing(true); }}
              className="pulso-gv2-iconos-action"
              aria-label={`Renombrar ${icono.nombre}`}
              title="Renombrar"
            >
              <Pencil size={11} />
            </button>
            <button
              type="button"
              onClick={onRemove}
              className="pulso-gv2-iconos-action is-danger"
              aria-label={`Eliminar ${icono.nombre}`}
              title="Eliminar"
            >
              <Trash2 size={11} />
            </button>
          </span>
        </div>
      )}
    </article>
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
