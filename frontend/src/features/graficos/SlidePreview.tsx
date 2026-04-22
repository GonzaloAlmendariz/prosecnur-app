import { useState } from "react";
import { Download, Eye, Loader2, AlertCircle, CheckCircle2, Image as ImageIcon } from "lucide-react";
import { apiGraficosPreviewSlide, downloadUrl, PreviewImage, Slide } from "../../api/client";

// Preview de un slide individual. Al generar, el backend:
//   1. Crea un mini-PPTX con este slide (fuente de verdad, descargable).
//   2. Extrae los PNGs embebidos por `cowplot` en cada slot de graficador
//      (prosecnur con `usar_canvas=TRUE` los deja en ppt/media/*.png del
//      ZIP). Los manda al frontend como data-URL.
//
// Así el analista VE el gráfico dentro de la UI sin abrir PowerPoint —
// iteración rápida sobre datos, colores, etiquetas. Si quiere ver el
// slide completo con layout (título, pie, etc.) sigue teniendo el
// botón "Descargar .pptx".
//
// Slides estructurales (portada, índice, texto) no tienen gráficos —
// el backend devuelve `images: []` y pintamos solo el botón de descarga.

type Props = {
  slide: Slide;
  prepOk: boolean;
};

function hashSlide(slide: Slide): string {
  return JSON.stringify({ tipo: slide.tipo, payload: slide.payload });
}

export function SlidePreview({ slide, prepOk }: Props) {
  const [busy, setBusy] = useState(false);
  const [fileId, setFileId] = useState<string | null>(null);
  const [images, setImages] = useState<PreviewImage[]>([]);
  const [error, setError] = useState("");
  const [lastHash, setLastHash] = useState<string | null>(null);

  const currentHash = hashSlide(slide);
  const isStale = fileId !== null && lastHash !== currentHash;

  async function onGenerate() {
    setBusy(true);
    setError("");
    try {
      const r = await apiGraficosPreviewSlide(slide);
      setFileId(r.file_id);
      setImages(r.images ?? []);
      setLastHash(currentHash);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      style={{
        marginTop: 14,
        padding: 14,
        borderRadius: 8,
        border: "1px solid var(--pulso-border)",
        background: "var(--pulso-surface)",
        display: "flex", flexDirection: "column", gap: 10,
      }}
    >
      <header style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: "var(--pulso-text)" }}>
          <Eye size={14} /> Preview de este slide
        </span>
        <span style={{ flex: 1, fontSize: 11, color: "var(--pulso-text-soft)", lineHeight: 1.4 }}>
          Ejecuta el slide con los datos reales y muestra cada gráfico acá.
          El PPTX completo queda disponible para descarga.
        </span>

        <button
          type="button"
          className="pulso-primary"
          onClick={onGenerate}
          disabled={!prepOk || busy}
          title={!prepOk ? "Primero prepara los datos en Analítica" : undefined}
          style={{
            fontSize: 12, padding: "6px 12px",
            display: "inline-flex", alignItems: "center", gap: 6,
          }}
        >
          {busy ? <Loader2 size={13} className="pulso-spin" /> : <Eye size={13} />}
          {busy ? "Generando…" : fileId ? "Regenerar preview" : "Generar preview"}
        </button>
      </header>

      {!prepOk && (
        <div style={{ fontSize: 11, color: "var(--pulso-text-soft)", fontStyle: "italic" }}>
          Necesitas correr <strong>Fase 4 → Preparar datos</strong> antes de poder generar previews.
        </div>
      )}

      {error && (
        <div
          style={{
            display: "flex", alignItems: "flex-start", gap: 7,
            padding: "8px 10px", borderRadius: 6,
            background: "var(--pulso-danger-bg)", border: "1px solid var(--pulso-danger-border)",
            fontSize: 11, color: "var(--pulso-danger-fg)", lineHeight: 1.45,
          }}
        >
          <AlertCircle size={13} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>
            <strong>No se pudo generar:</strong> {error}
          </span>
        </div>
      )}

      {fileId && !error && (
        <>
          <div
            style={{
              display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
              padding: "10px 12px", borderRadius: 6,
              background: "white",
              border: `1px solid ${isStale ? "var(--pulso-warn-accent)" : "var(--pulso-border)"}`,
            }}
          >
            {isStale ? (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, color: "var(--pulso-warn-fg)" }}>
                <AlertCircle size={12} /> Preview desactualizado (el slide cambió)
              </span>
            ) : (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, color: "var(--pulso-success-fg)" }}>
                <CheckCircle2 size={12} /> Listo
              </span>
            )}

            <a
              href={downloadUrl(fileId)}
              style={{
                fontSize: 12, fontWeight: 600, textDecoration: "none",
                display: "inline-flex", alignItems: "center", gap: 5,
                padding: "5px 10px", borderRadius: 999,
                color: "var(--pulso-primary)",
                background: "var(--pulso-primary-soft)",
              }}
            >
              <Download size={12} /> preview.pptx
            </a>

            <span style={{ fontSize: 10, color: "var(--pulso-text-soft)", marginLeft: "auto" }}>
              Ábrelo en PowerPoint o Keynote para ver el layout completo.
            </span>
          </div>

          {images.length > 0 ? (
            <PreviewImagesGrid images={images} stale={isStale} />
          ) : (
            <div
              style={{
                display: "flex", alignItems: "center", gap: 7,
                padding: "10px 12px", borderRadius: 6,
                background: "white",
                border: "1px solid var(--pulso-border)",
                fontSize: 11, color: "var(--pulso-text-soft)",
                lineHeight: 1.5,
              }}
            >
              <ImageIcon size={12} />
              Este slide no tiene gráficos (es estructural o de texto).
              Abre el .pptx para ver el layout renderizado.
            </div>
          )}
        </>
      )}
    </section>
  );
}

// Grid de imágenes del preview. Para slides con 1 gráfico se ve grande
// (full width); con 2+ se lado a lado en responsive auto-fit.
function PreviewImagesGrid({ images, stale }: { images: PreviewImage[]; stale: boolean }) {
  const cols = images.length === 1 ? "1fr" : "repeat(auto-fit, minmax(260px, 1fr))";
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: cols,
        gap: 10,
        opacity: stale ? 0.55 : 1,
        transition: "opacity 120ms ease",
      }}
    >
      {images.map((img, i) => (
        <figure
          key={img.filename}
          style={{
            margin: 0, padding: 8,
            background: "white",
            border: "1px solid var(--pulso-border)",
            borderRadius: 6,
            display: "flex", flexDirection: "column", gap: 6,
          }}
        >
          <img
            src={img.png_base64}
            alt={`Gráfico ${i + 1}`}
            loading="lazy"
            style={{
              width: "100%", height: "auto",
              objectFit: "contain",
              borderRadius: 3,
              background: "white",
              maxHeight: 420,
            }}
          />
          <figcaption
            style={{
              fontSize: 10, color: "var(--pulso-text-soft)",
              display: "flex", justifyContent: "space-between", alignItems: "center",
            }}
          >
            <span>Gráfico {i + 1} de {images.length}</span>
            <span style={{ fontFamily: "ui-monospace, monospace" }}>
              {formatKb(img.size)}
            </span>
          </figcaption>
        </figure>
      ))}
    </div>
  );
}

function formatKb(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
