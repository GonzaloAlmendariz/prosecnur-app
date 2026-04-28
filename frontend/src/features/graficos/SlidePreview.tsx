import { useMemo, useState } from "react";
import { Download, Eye, Loader2, AlertCircle, CheckCircle2, Image as ImageIcon } from "lucide-react";
import { apiGraficosPreviewSlide, downloadUrl, GraficadorRef, PreviewImage, Slide } from "../../api/client";
import { SLIDE_GRAF_SLOTS } from "./store";

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
  /** Cuando es true, oculta el texto descriptivo y se muestra como un
   *  card compacto (usado en el header del inspector V2). */
  compact?: boolean;
};

function hashSlide(slide: Slide): string {
  return JSON.stringify({ tipo: slide.tipo, payload: slide.payload });
}

export function SlidePreview({ slide, prepOk, compact = false }: Props) {
  const [busy, setBusy] = useState(false);
  const [fileId, setFileId] = useState<string | null>(null);
  const [images, setImages] = useState<PreviewImage[]>([]);
  const [error, setError] = useState("");
  const [lastHash, setLastHash] = useState<string | null>(null);

  const currentHash = hashSlide(slide);
  const isStale = fileId !== null && lastHash !== currentHash;

  // Pre-validación local. Detecta problemas comunes ANTES de llamar al
  // backend para evitar errores opacos. Cubre los 2 casos más frecuentes:
  // (a) un slot sin graficador (slide con barras_apiladas vacío); (b) un
  // graficador sin la variable principal (`var`) configurada.
  const preIssues = useMemo(() => preValidateSlide(slide), [slide]);
  const blocked = preIssues.length > 0;

  async function onGenerate() {
    if (blocked) return;
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
        {!compact && (
          <>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: "var(--pulso-text)" }}>
              <Eye size={14} /> Previsualizar este slide
            </span>
            <span style={{ flex: 1, fontSize: 11, color: "var(--pulso-text-soft)", lineHeight: 1.4 }}>
              Renderiza el slide con datos reales. El PPTX queda disponible para descarga.
            </span>
          </>
        )}

        <button
          type="button"
          className="pulso-primary"
          onClick={onGenerate}
          disabled={!prepOk || busy || blocked}
          title={
            !prepOk
              ? "Primero prepara los datos en Analítica"
              : blocked
                ? `Faltan datos: ${preIssues[0]}`
                : undefined
          }
          style={{
            fontSize: compact ? 12 : 12, padding: compact ? "6px 12px" : "6px 12px",
            display: "inline-flex", alignItems: "center", gap: 6,
            marginLeft: compact ? "auto" : undefined,
          }}
        >
          {busy ? <Loader2 size={13} className="pulso-spin" /> : <Eye size={13} />}
          {busy ? "Generando…" : fileId ? "Volver a previsualizar" : "Previsualizar"}
        </button>
      </header>

      {blocked && !error && (
        <div
          style={{
            display: "flex", alignItems: "flex-start", gap: 7,
            padding: "8px 10px", borderRadius: 6,
            background: "var(--pulso-warn-bg, rgba(217, 119, 6, 0.08))",
            border: "1px solid var(--pulso-warn-border, rgba(217, 119, 6, 0.4))",
            fontSize: 11, color: "var(--pulso-warn-fg, #92400e)", lineHeight: 1.45,
          }}
        >
          <AlertCircle size={13} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>
            <strong>Antes de previsualizar:</strong> {preIssues.join(" · ")}
          </span>
        </div>
      )}

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
            <strong>No pudimos generar la previsualización.</strong> {humanizePreviewError(error)}
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

// Pre-validación del slide antes de pegarle al backend. Detecta los
// problemas más comunes (slot vacío, var faltante) para que el usuario
// reciba feedback inmediato sin esperar el roundtrip + error opaco.
function preValidateSlide(slide: Slide): string[] {
  const issues: string[] = [];
  const slots = SLIDE_GRAF_SLOTS[slide.tipo] ?? [];
  for (const slot of slots) {
    const v = (slide.payload as Record<string, unknown>)[slot] as GraficadorRef | undefined | null;
    if (!v || !v.graficador) {
      issues.push(`elige un gráfico para "${slot}" en la pestaña Datos`);
      continue;
    }
    const args = (v.args ?? {}) as Record<string, unknown>;
    const hasVar = typeof args.var === "string" && args.var.length > 0;
    const hasVars = Array.isArray(args.vars) && (args.vars as unknown[]).length > 0;
    if (!hasVar && !hasVars) {
      issues.push(`configura la variable principal del gráfico "${slot}" en la pestaña Datos`);
    }
  }
  return issues;
}

// Convierte mensajes técnicos del backend en frases legibles. El backend
// devuelve cosas como "[E_PREVIEW_FAILED] La plantilla NO tiene el layout
// requerido: '1_Grafico_narrativo'" — el usuario no necesita ver códigos
// internos ni nombres de layout.
function humanizePreviewError(raw: string): string {
  // Quita códigos tipo [E_X] y prefijos genéricos del backend
  let cleaned = raw.replace(/^\s*\[[A-Z_]+\]\s*/i, "").trim();
  cleaned = cleaned.replace(/^No se pudo generar el preview:\s*/i, "");

  // Argumento requerido faltante (R: "argument 'var' is missing, with no default")
  const argMissing = cleaned.match(/argument ['"]?([a-z_]+)['"]?\s+is missing/i);
  if (argMissing) {
    const argName = argMissing[1];
    return `Falta configurar "${argName}" en la pestaña Datos. Es un valor requerido por este tipo de gráfico.`;
  }

  if (/layout requerido|template.*layout|layout.*not found/i.test(cleaned)) {
    return "La plantilla actual no incluye el diseño que este slide necesita. Si usas una plantilla custom, añade ese layout o elige otro tipo de slide.";
  }
  if (/rp_data|rp_inst|prepar.*datos|preparar/i.test(cleaned)) {
    return "Los datos no están listos. Ve a la fase 4 → Preparar datos y vuelve a intentarlo.";
  }
  if (/timeout|timed out/i.test(cleaned)) {
    return "El render tardó demasiado. Intenta de nuevo o simplifica el gráfico.";
  }
  if (/variable.*no existe|var.*unknown|variable inv/i.test(cleaned)) {
    return "Una de las variables del gráfico no existe en el instrumento. Revísala en la pestaña Datos.";
  }
  // Fallback: muestra el mensaje del backend pero sin el código de error
  return cleaned || "Algo salió mal al renderizar. Intenta de nuevo.";
}
