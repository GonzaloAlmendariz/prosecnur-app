import { useState } from "react";
import { NavLink } from "react-router-dom";
import * as Popover from "@radix-ui/react-popover";
import { MoreHorizontal } from "../vendor/lucide-react";
import { moduleChromeVars, type ActiveProsecnurModuleMeta } from "../lib/modules";

/**
 * «Más módulos»: el último peldaño del dock cuando el header no alcanza
 * (overflow con dignidad, ADR 0042 §4). Los módulos recogidos siguen siendo
 * links de navegación —una lista dentro de un `nav`, no un menú de acciones—,
 * así que conservan `aria-current` si alguno fuese el activo (no debería: el
 * activo nunca se recoge, ver `moduleDockModel.ts`).
 *
 * Radix Popover pone foco, Escape y retorno de foco; el panel se cierra al
 * elegir un destino porque el dock persiste entre rutas.
 */
export function ModuleDockOverflow({
  items,
  activo,
}: {
  items: readonly ActiveProsecnurModuleMeta[];
  activo: string;
}) {
  const [abierto, setAbierto] = useState(false);
  if (items.length === 0) return null;
  const nombre = `Más módulos (${items.length})`;

  return (
    <Popover.Root open={abierto} onOpenChange={setAbierto}>
      <Popover.Trigger asChild>
        <button
          type="button"
          className="pulso-module-tile pulso-module-tile-more"
          aria-label={nombre}
          data-state-open={abierto ? "true" : undefined}
        >
          <span className="pulso-module-tile-icon" aria-hidden="true">
            <MoreHorizontal size={16} strokeWidth={2.4} />
          </span>
          <span className="pulso-module-tile-label" aria-hidden="true">
            Más módulos
          </span>
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className="pulso-module-dock-more"
          align="end"
          sideOffset={8}
          collisionPadding={12}
        >
          <nav aria-label="Más módulos">
            <ul className="pulso-module-dock-more-list">
              {items.map((item) => {
                const Icon = item.icon;
                const isCurrent = item.to === activo;
                return (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      aria-current={isCurrent ? "page" : undefined}
                      style={moduleChromeVars(item)}
                      className="pulso-module-dock-more-link"
                      onClick={() => setAbierto(false)}
                    >
                      <span className="pulso-module-dock-more-icon" aria-hidden="true">
                        <Icon size={15} strokeWidth={2.25} />
                      </span>
                      <span>{item.title}</span>
                    </NavLink>
                  </li>
                );
              })}
            </ul>
          </nav>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
