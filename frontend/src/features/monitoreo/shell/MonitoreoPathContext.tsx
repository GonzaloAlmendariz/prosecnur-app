import { Activity } from "lucide-react";
import type { MonitoreoModoDefinicion } from "../core/monitoreoRegistry";
import { MONITOREO_MODOS } from "../core/monitoreoRegistry";

// Indicador del camino de monitoreo activo, mostrando también los hermanos.
//
// Monitoreo tiene cuatro caminos —acreditación, territorial, cursos-horario,
// telefónico— y un proyecto usa exactamente uno, derivado del tipo de estudio.
// Hasta ahora el chrome solo pintaba el activo, así que desde la UI no había
// forma de saber que los otros tres existían: ni el analista al orientarse, ni
// un QA visual al decidir si una vista está completa o le falta algo.
//
// NO es una segunda barra de navegación —eso lo prohíbe la gramática de layout,
// el rail de secciones ya es el recorrido del módulo—. Los hermanos se pintan
// como `span` inertes, sin `href` ni `button`: son contexto, no destino. No se
// puede saltar entre caminos porque el camino lo define el estudio del
// proyecto, y cambiarlo no es una acción de navegación.
//
// Los `data-*` existen para que el QA visual pueda afirmar qué camino estaba
// activo sin depender de leer píxeles.

type Props = {
  route: MonitoreoModoDefinicion | null;
};

// El catálogo de caminos sale del registry y NO del prop `routes` del chrome.
// Cada perfil se monta por lazy import y pasa `routes={[route]}`: solo se
// conoce a sí mismo. Preguntarle a ese prop por los hermanos devuelve siempre
// una lista vacía, que es justamente el motivo por el que los otros caminos
// eran invisibles desde la UI.
export function MonitoreoPathContext({ route }: Props) {
  const activeFamily = route?.family ?? null;
  const activeLabel = route?.shortLabel ?? "Sin definir";
  const ActiveIcon = route?.icon ?? Activity;
  const siblings = MONITOREO_MODOS.filter((item) => item.family !== activeFamily);

  return (
    <span
      className="mon-command-token is-mode mon-path-context"
      data-monitoreo-active-family={activeFamily ?? "none"}
      data-monitoreo-path-count={MONITOREO_MODOS.length}
    >
      {/* El ícono del modo era decoración pura —el label de al lado ya dice cuál
          es— y la banda va limpia: solo sobreviven los íconos que SON el control
          (los chips de camino, que no tienen label visible) o que informan algo
          que el texto no dice (el spinner de sincronización). */}
      <span className="mon-command-token-copy">
        <small>Modo</small>
        <strong>{activeLabel}</strong>
      </span>

      {siblings.length > 0 ? (
        <span
          className="mon-path-siblings"
          role="list"
          aria-label={`Otros caminos de monitoreo: ${siblings.map((s) => s.shortLabel).join(", ")}. Los define el tipo de estudio del proyecto.`}
        >
          {siblings.map((item) => {
            const Icon = item.icon;
            return (
              <span
                key={item.family}
                role="listitem"
                className="mon-path-chip"
                data-monitoreo-family={item.family}
                data-monitoreo-path-state={item.status === "planned" ? "planned" : "unavailable"}
                title={
                  item.status === "planned"
                    ? `${item.label} — camino previsto, aún no disponible`
                    : `${item.label} — otro camino de monitoreo; lo define el tipo de estudio del proyecto`
                }
              >
                <Icon size={13} aria-hidden="true" />
                <span className="pulso-sr-only">{item.label}</span>
              </span>
            );
          })}
        </span>
      ) : null}
    </span>
  );
}
