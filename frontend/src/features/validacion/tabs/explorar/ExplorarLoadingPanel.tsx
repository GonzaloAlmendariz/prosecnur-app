import { Compass, ListChecks, Loader2, Search, SlidersHorizontal } from "../../../../vendor/lucide-react";

/** Carga del inventario: el esqueleto de la mesa mientras llegan las variables. */
export default function ExplorarLoadingPanel() {
  const steps = [
    { label: "Preguntas y campos", hint: "Ordenando secciones del formulario", icon: ListChecks },
    { label: "Distribuciones", hint: "Preparando lectura inicial", icon: Compass },
    { label: "Filtros", hint: "Detectando cortes disponibles", icon: SlidersHorizontal },
  ];

  return (
    <section className="pulso-validacion-explorar-loading" role="status" aria-live="polite" aria-busy="true">
      <div className="pulso-validacion-explorar-loading-head">
        <span className="pulso-validacion-explorar-loading-icon" aria-hidden="true">
          <Loader2 size={20} className="pulso-spin" />
        </span>
        <div>
          <span className="pulso-section-eyebrow">Explorador de respuestas</span>
          <h3>Inventariando variables</h3>
          <p>Estamos organizando preguntas, campos y cortes para abrir la primera vista de revisión.</p>
        </div>
      </div>

      <div className="pulso-validacion-explorar-loading-steps" aria-label="Tareas en preparación">
        {steps.map((step) => {
          const Icon = step.icon;
          return (
            <div className="pulso-validacion-explorar-loading-step" key={step.label}>
              <span aria-hidden="true"><Icon size={15} /></span>
              <strong>{step.label}</strong>
              <small>{step.hint}</small>
            </div>
          );
        })}
      </div>

      <div className="pulso-validacion-explorar-loading-body" aria-hidden="true">
        <aside className="pulso-validacion-explorar-loading-sidebar">
          <div className="pulso-validacion-explorar-loading-search">
            <Search size={14} />
            <i />
          </div>
          {[0, 1, 2, 3, 4].map((row) => (
            <div className="pulso-validacion-explorar-loading-row" key={row}>
              <span />
              <i />
            </div>
          ))}
        </aside>
        <main className="pulso-validacion-explorar-loading-preview">
          <div className="pulso-validacion-explorar-loading-line is-title" />
          <div className="pulso-validacion-explorar-loading-metrics">
            <i />
            <i />
            <i />
          </div>
          <div className="pulso-validacion-explorar-loading-chart">
            {[0, 1, 2, 3, 4].map((bar) => (
              <span key={bar} style={{ width: `${92 - bar * 12}%` }} />
            ))}
          </div>
        </main>
      </div>
    </section>
  );
}
