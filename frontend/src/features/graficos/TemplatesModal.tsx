import { useState } from "react";
import * as Lucide from "lucide-react";
import { X, Sparkles } from "lucide-react";
import { PlanJson, Slide } from "../../api/client";
import { usePlanStore } from "./store";
import { useTemplates } from "./useTemplates";

// Modal para aplicar un template (plan pre-armado). Se abre desde un
// botón en el header o desde el timeline cuando está vacío. Al elegir:
//   - Regenera ids para todos los slides (evita colisión si el plan
//     actual tuviera ids iguales por accidente).
//   - Llama a `loadPlan` que reemplaza el plan actual y selecciona el
//     primer slide.
//
// Si el plan actual tiene slides, pide confirmación antes de reemplazar.
// El analista siempre puede deshacer con Cmd/Ctrl+Z.

type LucideIcon = (props: { size?: number; color?: string }) => JSX.Element;

function resolveLucide(name: string | undefined): LucideIcon {
  const registry = Lucide as unknown as Record<string, LucideIcon>;
  return (name && registry[name]) || registry["FileText"] || registry["Square"];
}

function regenIds(plan: PlanJson): PlanJson {
  return {
    slides: plan.slides.map((s) => ({
      ...s,
      id: `s-${Math.random().toString(36).slice(2, 10)}`,
    })) as Slide[],
  };
}

export function TemplatesModal({ onClose }: { onClose: () => void }) {
  const { templates, loading, error } = useTemplates();
  const loadPlan = usePlanStore((s) => s.loadPlan);
  const currentNSlides = usePlanStore((s) => s.plan.slides.length);
  const [confirming, setConfirming] = useState<string | null>(null);

  function apply(name: string) {
    const tpl = templates.find((t) => t.name === name);
    if (!tpl) return;
    loadPlan(regenIds(tpl.plan));
    onClose();
  }

  function handlePick(name: string) {
    if (currentNSlides > 0) {
      setConfirming(name);
    } else {
      apply(name);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Elegir plantilla"
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 100,
        background: "rgba(15, 23, 42, 0.4)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(820px, 100%)", maxHeight: "85vh",
          background: "white", borderRadius: 10,
          boxShadow: "var(--pulso-shadow-high)",
          display: "flex", flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <header
          style={{
            padding: "14px 18px",
            borderBottom: "1px solid var(--pulso-border)",
            display: "flex", alignItems: "center", gap: 10,
          }}
        >
          <Sparkles size={18} color="var(--pulso-primary)" />
          <div style={{ flex: 1 }}>
            <h2 style={{ margin: 0, fontSize: 15 }}>Elegir plantilla</h2>
            <p style={{ margin: "2px 0 0", fontSize: 11, color: "var(--pulso-text-soft)", lineHeight: 1.4 }}>
              Arranca desde un plan pre-armado. Vas a poder editar todo — los slots de gráfico
              vienen vacíos para que elijas las variables.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="pulso-icon"
            aria-label="Cerrar"
          >
            <X size={14} />
          </button>
        </header>

        <div style={{ padding: 18, overflowY: "auto", flex: 1 }}>
          {loading && (
            <div style={{ fontSize: 12, color: "var(--pulso-text-soft)", padding: 20, textAlign: "center" }}>
              Cargando plantillas…
            </div>
          )}
          {error && (
            <div style={{ fontSize: 12, color: "#991b1b", padding: 20 }}>
              Error cargando plantillas: {error}
            </div>
          )}
          {!loading && !error && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
                gap: 12,
              }}
            >
              {templates.map((t) => {
                const Icon = resolveLucide(t.icono_ui);
                return (
                  <button
                    key={t.name}
                    type="button"
                    onClick={() => handlePick(t.name)}
                    style={{
                      display: "flex", flexDirection: "column",
                      alignItems: "flex-start", gap: 8,
                      padding: 14, borderRadius: 9,
                      border: "1px solid var(--pulso-border)",
                      background: "white",
                      cursor: "pointer",
                      textAlign: "left",
                      transition: "border-color 120ms ease, transform 120ms ease, box-shadow 120ms ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = "var(--pulso-primary)";
                      e.currentTarget.style.boxShadow = "var(--pulso-shadow-med)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = "var(--pulso-border)";
                      e.currentTarget.style.boxShadow = "none";
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8, width: "100%" }}>
                      <span
                        style={{
                          width: 34, height: 34, borderRadius: 8,
                          background: "var(--pulso-primary-soft)",
                          color: "var(--pulso-primary)",
                          display: "inline-flex", alignItems: "center", justifyContent: "center",
                        }}
                      >
                        <Icon size={17} />
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--pulso-text)", lineHeight: 1.2 }}>
                          {t.titulo_humano}
                        </div>
                        <div style={{ fontSize: 10, color: "var(--pulso-text-soft)", marginTop: 2 }}>
                          {t.n_slides} {t.n_slides === 1 ? "slide" : "slides"}
                        </div>
                      </div>
                    </div>
                    <p
                      style={{
                        margin: 0, fontSize: 11,
                        color: "var(--pulso-text-soft)", lineHeight: 1.5,
                      }}
                    >
                      {t.descripcion}
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {confirming && (
          <ConfirmOverlay
            currentN={currentNSlides}
            onConfirm={() => { apply(confirming); setConfirming(null); }}
            onCancel={() => setConfirming(null)}
          />
        )}
      </div>
    </div>
  );
}

function ConfirmOverlay({
  currentN, onConfirm, onCancel,
}: {
  currentN: number;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      role="alertdialog"
      aria-modal="true"
      style={{
        position: "absolute", inset: 0,
        background: "rgba(255,255,255,0.95)",
        backdropFilter: "blur(2px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        style={{
          maxWidth: 420,
          padding: 20,
          border: "1px solid var(--pulso-border)",
          borderRadius: 10,
          background: "white",
          boxShadow: "var(--pulso-shadow-high)",
          display: "flex", flexDirection: "column", gap: 12,
        }}
      >
        <h3 style={{ margin: 0, fontSize: 14 }}>Reemplazar el plan actual</h3>
        <p style={{ margin: 0, fontSize: 12, color: "var(--pulso-text-soft)", lineHeight: 1.5 }}>
          Tu plan actual tiene <strong>{currentN} {currentN === 1 ? "slide" : "slides"}</strong>.
          Se van a reemplazar por la plantilla. Podés deshacer el cambio con Cmd/Ctrl+Z.
        </p>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button
            type="button"
            onClick={onCancel}
            style={{ fontSize: 12, padding: "6px 12px" }}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="pulso-primary"
            onClick={onConfirm}
            style={{ fontSize: 12, padding: "6px 12px" }}
          >
            Reemplazar plan
          </button>
        </div>
      </div>
    </div>
  );
}
