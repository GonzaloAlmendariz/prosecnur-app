// Pantalla de preparación de Preguntas: enseña los pasos y una silueta mientras llegan las preguntas.
// Salió de `PreguntasLanding.tsx` sin cambios (las clases `pulso-codificacion-loading*` están declaradas
// en `formatoDelModulo.contract.test.ts`).

import { LayoutGrid, Link2, Loader2, PencilLine } from "../../../vendor/lucide-react";

export function CargaPreguntas() {
  const steps = [
    { label: "Textos abiertos", hint: "Preguntas que necesitan categorías", icon: PencilLine },
    { label: "Vínculos con Otros", hint: "Relaciones entre opción y texto", icon: Link2 },
    { label: "Secciones listas", hint: "Grupos para revisar sin perder contexto", icon: LayoutGrid },
  ];

  return (
    <section className="pulso-codificacion-loading" role="status" aria-live="polite" aria-busy="true">
      <div className="pulso-codificacion-loading-hero">
        <span className="pulso-codificacion-loading-icon" aria-hidden="true">
          <Loader2 size={20} className="pulso-spin" />
        </span>
        <div className="pulso-codificacion-loading-copy">
          <span className="pulso-section-eyebrow">Preparando codificación</span>
          <h3>Detectando preguntas abiertas</h3>
          <p>
            Revisamos formulario y respuestas para ordenar textos libres, opciones "Otros" y preguntas listas para agrupar.
          </p>
        </div>
      </div>

      <div className="pulso-codificacion-loading-steps" aria-label="Tareas en preparación">
        {steps.map((step) => {
          const Icon = step.icon;
          return (
            <div className="pulso-codificacion-loading-step" key={step.label}>
              <span aria-hidden="true"><Icon size={15} /></span>
              <strong>{step.label}</strong>
              <small>{step.hint}</small>
            </div>
          );
        })}
      </div>

      <div className="pulso-codificacion-loading-grid" aria-hidden="true">
        {[0, 1, 2].map((section) => (
          <div className="pulso-codificacion-loading-section" key={section}>
            <div className="pulso-codificacion-loading-line is-title" />
            <div className="pulso-codificacion-loading-card">
              <div className="pulso-codificacion-loading-line is-short" />
              <div className="pulso-codificacion-loading-line" />
              <div className="pulso-codificacion-loading-line is-soft" />
            </div>
            <div className="pulso-codificacion-loading-card">
              <div className="pulso-codificacion-loading-line is-short" />
              <div className="pulso-codificacion-loading-line" />
              <div className="pulso-codificacion-loading-line is-soft" />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
