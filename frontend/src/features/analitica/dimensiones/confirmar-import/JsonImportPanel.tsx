import { AlertCircle, Check, FileJson, Loader2, Upload, X } from "lucide-react";
import { useRef, useState } from "react";
import { ValidacionReporte } from "../../../../api/client";
import { DimensionesConfig } from "../../store";
import { useValidacionJson } from "./useValidacionJson";

// Modal/panel inline para el flujo "Confirmar contra instrumento". El
// usuario sube un JSON, vemos el reporte de validación, y deja al
// usuario decidir "Continuar con coincidencias" o "Cancelar".
//
// Se monta como overlay sobre Step 1 — no es un drawer separado, es un
// panel modal que toma el foco visual de la galería de plantillas.

export function JsonImportPanel({
  open,
  onClose,
  onApply,
}: {
  open: boolean;
  onClose: () => void;
  // Callback cuando el usuario confirma "Continuar con coincidencias".
  // El padre recibe la config parseada del JSON + las vars que el reporte
  // marcó como faltantes (para mostrar warnings en step 3).
  onApply: (parsed: DimensionesConfig, varsFaltantes: string[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { estado, validar, reset } = useValidacionJson();
  const [draggingOver, setDraggingOver] = useState(false);

  if (!open) return null;

  function handleClose() {
    reset();
    onClose();
  }

  function handleApply() {
    if (estado.kind !== "ok") return;
    const parsed = estado.parsedJson as { config?: { dimensiones?: DimensionesConfig } };
    const dim = parsed.config?.dimensiones;
    if (!dim) return;
    const faltantes = estado.reporte.subindices.flatMap((s) => s.vars_faltantes);
    onApply(dim, faltantes);
    reset();
  }

  return (
    <div
      role="dialog"
      aria-label="Confirmar JSON contra instrumento"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        background: "rgba(15, 23, 42, 0.45)",
        backdropFilter: "blur(2px)",
        animation: "pulso-lens-fade-in-kf var(--anim-dur-short) var(--anim-ease-smooth)",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div
        style={{
          background: "white",
          borderRadius: 14,
          width: "min(720px, 100%)",
          maxHeight: "calc(100vh - 48px)",
          display: "flex",
          flexDirection: "column",
          boxShadow: "var(--pulso-shadow-high, 0 24px 48px rgba(0,0,0,0.18))",
          animation: "pulso-lens-slide-in-kf var(--anim-dur-med) var(--anim-ease-expressive)",
        }}
      >
        <header
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "16px 20px",
            borderBottom: "1px solid var(--pulso-border)",
          }}
        >
          <FileJson size={18} color="var(--pulso-primary)" />
          <h3 style={{ margin: 0, flex: 1, fontSize: 15, fontWeight: 700 }}>
            Confirmar JSON contra el instrumento
          </h3>
          <button
            type="button"
            aria-label="Cerrar"
            onClick={handleClose}
            style={{
              border: "none",
              background: "transparent",
              cursor: "pointer",
              padding: 6,
              borderRadius: 4,
              color: "var(--pulso-text-soft)",
            }}
          >
            <X size={16} />
          </button>
        </header>

        <div style={{ flex: 1, overflowY: "auto", padding: "18px 22px", display: "flex", flexDirection: "column", gap: 16 }}>
          {estado.kind === "idle" && (
            <Dropzone
              draggingOver={draggingOver}
              setDraggingOver={setDraggingOver}
              onFile={validar}
              onClick={() => inputRef.current?.click()}
            />
          )}
          {estado.kind === "loading" && (
            <div
              style={{
                padding: 32,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 10,
                color: "var(--pulso-text-soft)",
              }}
            >
              <Loader2 size={26} className="pulso-spin" />
              <span style={{ fontSize: 12 }}>Validando contra el instrumento…</span>
            </div>
          )}
          {estado.kind === "error" && (
            <ErrorPanel message={estado.message} onRetry={() => reset()} />
          )}
          {estado.kind === "ok" && <ReportePanel reporte={estado.reporte} />}
          <input
            ref={inputRef}
            type="file"
            accept=".json,application/json"
            style={{ display: "none" }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) validar(f);
              if (inputRef.current) inputRef.current.value = "";
            }}
          />
        </div>

        <footer
          style={{
            padding: "14px 20px",
            borderTop: "1px solid var(--pulso-border)",
            display: "flex",
            gap: 10,
            justifyContent: "flex-end",
          }}
        >
          <button type="button" onClick={handleClose} style={{ padding: "6px 12px" }}>
            Cancelar
          </button>
          <button
            type="button"
            className="pulso-primary"
            disabled={estado.kind !== "ok"}
            onClick={handleApply}
          >
            Continuar con coincidencias
          </button>
        </footer>
      </div>
    </div>
  );
}

function Dropzone({
  draggingOver,
  setDraggingOver,
  onFile,
  onClick,
}: {
  draggingOver: boolean;
  setDraggingOver: (b: boolean) => void;
  onFile: (f: File) => void;
  onClick: () => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onClick()}
      onDragOver={(e) => {
        e.preventDefault();
        setDraggingOver(true);
      }}
      onDragLeave={() => setDraggingOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDraggingOver(false);
        const f = e.dataTransfer.files?.[0];
        if (f) onFile(f);
      }}
      style={{
        padding: "40px 24px",
        border: `2px dashed ${draggingOver ? "var(--pulso-primary)" : "var(--pulso-border)"}`,
        borderRadius: 12,
        background: draggingOver ? "var(--pulso-primary-soft)" : "var(--pulso-surface-2, #f4f5f9)",
        textAlign: "center",
        cursor: "pointer",
        transition: "background var(--anim-dur-short), border-color var(--anim-dur-short)",
      }}
    >
      <Upload size={28} color={draggingOver ? "var(--pulso-primary)" : "var(--pulso-text-soft)"} />
      <div style={{ marginTop: 10, fontSize: 13, fontWeight: 600 }}>
        Arrastra tu archivo <code>.json</code> aquí
      </div>
      <div style={{ marginTop: 4, fontSize: 11, color: "var(--pulso-text-soft)" }}>
        o haz click para elegirlo
      </div>
    </div>
  );
}

function ErrorPanel({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div
      style={{
        padding: 16,
        borderRadius: 8,
        border: "1px solid var(--pulso-danger-border)",
        background: "var(--pulso-danger-bg)",
        color: "var(--pulso-danger-fg)",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700 }}>
        <AlertCircle size={16} /> No se pudo validar el JSON
      </div>
      <div style={{ fontSize: 12, fontWeight: 400 }}>{message}</div>
      <button type="button" onClick={onRetry} style={{ alignSelf: "flex-start" }}>
        Probar otro archivo
      </button>
    </div>
  );
}

function ReportePanel({ reporte }: { reporte: ValidacionReporte }) {
  const { resumen } = reporte;
  // "Faltantes" reales = solo cuando el JSON pide vars/subcriterios que el
  // instrumento no puede satisfacer. Listas no usadas y subcriterios
  // resueltos NO cuentan como problemas — son informativos.
  const algoFalla =
    resumen.n_vars_faltantes > 0 ||
    resumen.n_subindices_parciales > 0 ||
    resumen.n_subcriterios_incompletos > 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <ResumenStrip resumen={resumen} algoFalla={algoFalla} />

      {reporte.listas.no_usadas.length > 0 && (
        <Block title="Listas no usadas en este instrumento" tone="neutral">
          <ChipList items={reporte.listas.no_usadas} icon="info" />
          <p style={{ fontSize: 11, color: "var(--pulso-text-soft)", margin: "8px 0 0" }}>
            Estas listas existen en el JSON pero tu XLSForm no tiene preguntas que las
            referencien. <strong>No es un problema</strong> — simplemente no aplican a
            este estudio y se ignorarán al construir.
          </p>
        </Block>
      )}

      {reporte.subcriterios.length > 0 && (
        <Block title="Subcriterios promediados" tone="neutral">
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {reporte.subcriterios.map((sc) => (
              <SubcriterioRow key={sc.nombre} sc={sc} />
            ))}
          </div>
          <p style={{ fontSize: 11, color: "var(--pulso-text-soft)", margin: "8px 0 0" }}>
            Variables derivadas que el sistema crea promediando otras al construir
            (ej. <code>p17_prom = avg(p17, p17.1)</code>). Se resuelven solo si todas
            las fuentes existen.
          </p>
        </Block>
      )}

      <Block title="Bloques (sub-índices)" tone="neutral">
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {reporte.subindices.map((s) => (
            <BloqueRow key={s.nombre} s={s} />
          ))}
        </div>
      </Block>

      {reporte.indices.length > 0 && (
        <Block title="Índices" tone="neutral">
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {reporte.indices.map((idx) => (
              <IndiceRow key={idx.nombre} idx={idx} />
            ))}
          </div>
        </Block>
      )}
    </div>
  );
}

function SubcriterioRow({ sc }: { sc: ValidacionReporte["subcriterios"][number] }) {
  // Si la etiqueta es distinta del código, mostramos la etiqueta primero
  // (en bold) y el código entre paréntesis para uso técnico. Si coinciden
  // (no había etiqueta en el JSON), mostramos solo el código.
  const tieneEtiqueta = sc.etiqueta && sc.etiqueta !== sc.nombre;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "8px 10px",
        borderRadius: 6,
        background: sc.ok ? "var(--pulso-success-bg, #f0fdf4)" : "var(--pulso-warn-bg, #fffbeb)",
        fontSize: 12,
        flexWrap: "wrap",
      }}
    >
      {sc.ok ? (
        <Check size={13} color="var(--pulso-success-fg, #15803d)" />
      ) : (
        <AlertCircle size={13} color="var(--pulso-warn-fg, #b45309)" />
      )}
      {tieneEtiqueta ? (
        <>
          <strong style={{ fontWeight: 700 }}>{sc.etiqueta}</strong>
          <code
            style={{
              fontFamily: "ui-monospace, monospace",
              fontSize: 10,
              color: "var(--pulso-text-soft)",
            }}
          >
            {sc.nombre}
          </code>
        </>
      ) : (
        <code style={{ fontFamily: "ui-monospace, monospace", fontWeight: 700 }}>
          {sc.nombre}
        </code>
      )}
      <span style={{ color: "var(--pulso-text-soft)" }}>= avg(</span>
      {sc.fuente.map((f, i) => (
        <span key={f}>
          {i > 0 && <span style={{ color: "var(--pulso-text-soft)" }}>, </span>}
          <code
            style={{
              fontFamily: "ui-monospace, monospace",
              color: sc.vars_fuente_faltantes.includes(f)
                ? "var(--pulso-warn-fg, #b45309)"
                : "var(--pulso-text)",
            }}
          >
            {f}
          </code>
        </span>
      ))}
      <span style={{ color: "var(--pulso-text-soft)" }}>)</span>
      {!sc.ok && sc.vars_fuente_faltantes.length > 0 && (
        <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--pulso-warn-fg, #b45309)" }}>
          falta {sc.vars_fuente_faltantes.join(", ")}
        </span>
      )}
    </div>
  );
}

function ResumenStrip({
  resumen,
  algoFalla,
}: {
  resumen: ValidacionReporte["resumen"];
  algoFalla: boolean;
}) {
  const totalVars = resumen.n_vars_ok + resumen.n_vars_faltantes;
  return (
    <div
      style={{
        padding: "12px 14px",
        borderRadius: 10,
        border: `1px solid ${algoFalla ? "var(--pulso-warn-border, #f59e0b)" : "var(--pulso-success-border, #86efac)"}`,
        background: algoFalla ? "var(--pulso-warn-bg, #fffbeb)" : "var(--pulso-success-bg, #f0fdf4)",
        display: "grid",
        gridTemplateColumns: "auto 1fr auto",
        gap: 12,
        alignItems: "center",
      }}
    >
      {algoFalla ? (
        <AlertCircle size={20} color="var(--pulso-warn-fg, #b45309)" />
      ) : (
        <Check size={20} color="var(--pulso-success-fg, #15803d)" />
      )}
      <div style={{ fontSize: 12, lineHeight: 1.5 }}>
        <strong>
          {algoFalla ? "Coincidencia parcial — puedes continuar" : "Coincidencia completa"}
        </strong>
        <div style={{ marginTop: 2, color: "var(--pulso-text-soft)" }}>
          {resumen.n_vars_ok} de {totalVars} variables disponibles ·{" "}
          {resumen.n_subindices_completos} bloques completos
          {resumen.n_subindices_parciales > 0 && `, ${resumen.n_subindices_parciales} parciales`}
          {resumen.n_subcriterios_resueltos > 0 &&
            ` · ${resumen.n_subcriterios_resueltos} subcriterios resueltos`}
          {resumen.n_listas_no_usadas > 0 &&
            ` · ${resumen.n_listas_no_usadas} listas no aplican a este instrumento`}
          .
        </div>
      </div>
    </div>
  );
}

function Block({
  title,
  tone,
  children,
}: {
  title: string;
  tone: "neutral" | "warn" | "ok";
  children: React.ReactNode;
}) {
  const borderColor =
    tone === "warn"
      ? "var(--pulso-warn-border, #f59e0b)"
      : tone === "ok"
        ? "var(--pulso-success-border, #86efac)"
        : "var(--pulso-border)";
  return (
    <section
      style={{
        padding: 12,
        borderRadius: 10,
        border: `1px solid ${borderColor}`,
        background: "white",
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: 0.4,
          color: "var(--pulso-text-soft)",
          marginBottom: 8,
        }}
      >
        {title}
      </div>
      {children}
    </section>
  );
}

function ChipList({ items, icon }: { items: string[]; icon: "ok" | "warn" | "err" | "info" }) {
  const tones = {
    ok: { bg: "var(--pulso-success-bg, #f0fdf4)", fg: "var(--pulso-success-fg, #15803d)", border: "var(--pulso-success-border, #86efac)", glyph: "✓" },
    warn: { bg: "var(--pulso-warn-bg, #fffbeb)", fg: "var(--pulso-warn-fg, #b45309)", border: "var(--pulso-warn-border, #fcd34d)", glyph: "⚠" },
    err: { bg: "var(--pulso-danger-bg)", fg: "var(--pulso-danger-fg)", border: "var(--pulso-danger-border)", glyph: "✗" },
    info: { bg: "var(--pulso-surface-2, #f4f5f9)", fg: "var(--pulso-text-soft)", border: "var(--pulso-border)", glyph: "·" },
  } as const;
  const t = tones[icon];
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
      {items.map((it) => (
        <span
          key={it}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            padding: "2px 8px",
            borderRadius: 999,
            fontSize: 11,
            fontFamily: "ui-monospace, monospace",
            background: t.bg,
            color: t.fg,
            border: `1px solid ${t.border}`,
          }}
        >
          {t.glyph} {it}
        </span>
      ))}
    </div>
  );
}

function BloqueRow({
  s,
}: {
  s: ValidacionReporte["subindices"][number];
}) {
  const tone: "ok" | "warn" | "err" = s.ok ? "ok" : s.n_ok > 0 ? "warn" : "err";
  return (
    <div
      style={{
        padding: 10,
        borderRadius: 8,
        border: "1px solid var(--pulso-border)",
        background: "var(--pulso-surface)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 6,
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 700 }}>{s.etiqueta}</span>
        <span style={{ fontSize: 10, color: "var(--pulso-text-soft)" }}>
          ({s.n_ok}/{s.n_solicitadas} variables)
        </span>
      </div>
      <ChipList items={s.vars_ok} icon={tone === "ok" ? "ok" : "ok"} />
      {s.vars_faltantes.length > 0 && (
        <div style={{ marginTop: 6 }}>
          <ChipList items={s.vars_faltantes} icon="warn" />
        </div>
      )}
    </div>
  );
}

function IndiceRow({ idx }: { idx: ValidacionReporte["indices"][number] }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: 8,
        borderRadius: 6,
        background: idx.ok ? "var(--pulso-success-bg, #f0fdf4)" : "var(--pulso-warn-bg, #fffbeb)",
      }}
    >
      {idx.ok ? <Check size={14} color="var(--pulso-success-fg, #15803d)" /> : <AlertCircle size={14} color="var(--pulso-warn-fg, #b45309)" />}
      <strong style={{ fontSize: 12 }}>{idx.etiqueta}</strong>
      <span style={{ fontSize: 11, color: "var(--pulso-text-soft)" }}>
        ← {idx.subindices_ok.join(", ") || "—"}
        {idx.subindices_faltantes.length > 0 && (
          <em style={{ color: "var(--pulso-warn-fg, #b45309)" }}>
            {" "}· faltan {idx.subindices_faltantes.join(", ")}
          </em>
        )}
      </span>
    </div>
  );
}
