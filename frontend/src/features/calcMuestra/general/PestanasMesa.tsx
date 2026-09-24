import { useEffect, useRef, type ReactNode } from "react";

import { ContextTabRail } from "../../../components/ContextTabRail";
import { UniversityTabHeader } from "../universidad/ui/UniversityTabHeader";
import { idPanelMesa, idTabMesa, type PestanaMesa } from "./modeloPestanas";
import "./mesa.css";

/**
 * Rail de pestañas de una sección de Muestra general o Acreditación: el mismo
 * rail (`ContextTabRail`, tabs reales con roving tabindex) y la misma
 * cabecera de pestaña (`UniversityTabHeader`) que aulas. Cada pestaña hace una
 * pregunta; el panel es un `tabpanel` nombrado por su tab y declara su grupo
 * de geometría (C1) y su readiness.
 */
export function PestanasMesa({
  grupo,
  seccion,
  tituloSeccion,
  pestanas,
  activa,
  onElegir,
  listo,
  children,
}: {
  /** Prefijo del grupo de geometría: `general` o `acreditacion`. */
  grupo: "general" | "acreditacion";
  seccion: string;
  tituloSeccion: string;
  pestanas: readonly PestanaMesa[];
  activa: string;
  onElegir: (id: string) => void;
  listo: boolean;
  children: ReactNode;
}) {
  const meta = pestanas.find((p) => p.id === activa) ?? pestanas[0];
  const panelRef = useRef<HTMLDivElement>(null);
  const anterior = useRef(activa);
  // Cambiar de pestaña abre la nueva desde arriba: el dueño de scroll es
  // `.cmv2-main` y, sin esto, conservaba el desplazamiento de la anterior.
  useEffect(() => {
    if (anterior.current === activa) return;
    anterior.current = activa;
    const main = panelRef.current?.closest(".cmv2-main");
    if (main && main.scrollTop > 0) main.scrollTop = 0;
  }, [activa]);
  if (!meta) return <>{children}</>;
  return (
    <div className="cmg-pestanas" data-seccion={seccion}>
      <ContextTabRail
        ariaLabel={`Pestañas de ${tituloSeccion}`}
        activeKey={meta.id}
        items={pestanas.map((p) => ({ key: p.id, label: p.label, description: p.detail, icon: p.icon }))}
        panelId={idPanelMesa(seccion)}
        tabId={(key) => idTabMesa(seccion, key)}
        onChange={onElegir}
        className="cmg-pestanas-rail"
      />
      <div
        ref={panelRef}
        id={idPanelMesa(seccion)}
        className="cmg-pestana-panel"
        role="tabpanel"
        aria-labelledby={idTabMesa(seccion, meta.id)}
        data-pestana={meta.id}
        data-audit-ready={listo ? "true" : "false"}
      >
        {/* La cabecera de la pestaña queda FUERA del grupo medido, como en
            aulas: dentro, su padding contaba como capacidad ociosa (2.36 px
            sobre 2 de tolerancia en las 18 pestañas; QA E15). */}
        <UniversityTabHeader tab={{ id: meta.id, label: meta.label, detail: meta.detail, icon: meta.icon, status: "ready" }} />
        <div
          className="cmg-pestana-cuerpo"
          data-qa-geometry-group={`calc-muestra/${grupo}-pestana-${meta.id}`}
          data-qa-geometry-contract="intrinsic"
        >
          {children}
        </div>
      </div>
    </div>
  );
}
