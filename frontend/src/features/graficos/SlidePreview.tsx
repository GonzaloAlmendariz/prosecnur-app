import { useState } from "react";
import { Download, Eye, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { apiGraficosPreviewSlide, downloadUrl, Slide } from "../../api/client";

// Preview de un slide individual. El analista hace click en "Generar
// preview" y el backend produce un mini-PPTX con este único slide. Se
// muestra como botón de descarga directa.
//
// Por qué no PNG inline: prosecnur ensambla los slides con layouts de
// PPT/cowplot que no se pueden convertir a imagen sin LibreOffice (que
// puede no estar instalado). El PPTX es el output fiel y universal.
//
// Hash simple del slide: si el slide cambió desde el último preview,
// mostramos un badge "Preview desactualizado" en naranja para recordar
// re-generar. No auto-re-generamos porque corre en el servidor (2-3s).

type Props = {
  slide: Slide;
  prepOk: boolean;
};

// Hash determinístico de un slide. Dos slides con el mismo contenido
// → mismo hash, así el botón "Actualizar preview" solo se activa si
// hubo un cambio real.
function hashSlide(slide: Slide): string {
  return JSON.stringify({ tipo: slide.tipo, payload: slide.payload });
}

export function SlidePreview({ slide, prepOk }: Props) {
  const [busy, setBusy] = useState(false);
  const [fileId, setFileId] = useState<string | null>(null);
  const [error, setError] = useState("");
  // Snapshot del slide al momento del último render exitoso; nos deja
  // saber si el slide actual está desfasado.
  const [lastHash, setLastHash] = useState<string | null>(null);

  const currentHash = hashSlide(slide);
  const isStale = fileId !== null && lastHash !== currentHash;

  async function onGenerate() {
    setBusy(true);
    setError("");
    try {
      const r = await apiGraficosPreviewSlide(slide);
      setFileId(r.file_id);
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
          Genera un PPTX de 1 slide con la configuración actual para verlo en PowerPoint antes de exportar el plan completo.
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
            background: "#fef2f2", border: "1px solid #fecaca",
            fontSize: 11, color: "#991b1b", lineHeight: 1.45,
          }}
        >
          <AlertCircle size={13} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>
            <strong>No se pudo generar:</strong> {error}
          </span>
        </div>
      )}

      {fileId && !error && (
        <div
          style={{
            display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
            padding: "10px 12px", borderRadius: 6,
            background: "white",
            border: `1px solid ${isStale ? "#f59e0b" : "var(--pulso-border)"}`,
          }}
        >
          {isStale ? (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, color: "#b45309" }}>
              <AlertCircle size={12} /> Preview desactualizado (el slide cambió)
            </span>
          ) : (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, color: "#166534" }}>
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
            Ábrelo en PowerPoint o Keynote.
          </span>
        </div>
      )}
    </section>
  );
}
