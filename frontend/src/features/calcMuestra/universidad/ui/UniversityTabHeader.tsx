import type { CalcMuestraSidebarTab } from "../universidadTabs";

export function UniversityTabHeader({
  tab,
}: {
  tab: CalcMuestraSidebarTab;
}) {
  const Icon = tab.icon;

  return (
    <header className="cmv2-local-context" data-status={tab.status} aria-label={`Pestaña activa: ${tab.label}`}>
      <span className="cmv2-local-context-icon" aria-hidden="true">
        <Icon size={19} strokeWidth={1.8} />
      </span>
      <div className="cmv2-local-context-copy">
        <h2 id="cmv2-active-local-title">{tab.label}</h2>
        <p className="cmv2-local-context-detail">{tab.detail}</p>
      </div>
    </header>
  );
}
