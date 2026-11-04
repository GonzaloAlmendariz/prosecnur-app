import type { ComponentPropsWithoutRef, ReactNode } from "react";

import { Panel } from "../../../components/Panel";
import "./bloqueDeMonitoreo.css";

/**
 * **Un bloque con marco de Monitoreo es el `Panel` del kit** (P2 de la pasada de formato, 4 nov 2026).
 *
 * Antes cada vista armaba su caja: `<section className="mon-profile-panel">` con una cabecera propia
 * (`mon-profile-panel-head`, un `h3` y una bajada en `span`), y la medición del 2 nov contó 375
 * `h2–h4` sueltos frente a 7 `Panel`. Este componente pone el título, la bajada y las acciones en la
 * cabecera del kit.
 *
 * El bloque conserva la clase `mon-profile-panel`: el reparto de las pilas, los `:last-child` y los
 * gráficos de cada perfil cuelgan de ella, y quitarla movería vistas que no se tocan. La guarda
 * `cajasPropias.contract.test.ts` impide que vuelvan a crecer los títulos sueltos.
 */
type Props = {
  titulo: ReactNode;
  /** La bajada del título: qué cuenta el bloque o su conteo. Va junto al título. */
  bajada?: ReactNode;
  /** Una frase que se lee antes del contenido (qué mide el bloque y cómo). Va bajo la cabecera. */
  lectura?: ReactNode;
  acciones?: ReactNode;
  className?: string;
  children: ReactNode;
} & Omit<ComponentPropsWithoutRef<"section">, "title" | "className" | "children">;

export function BloqueDeMonitoreo({ titulo, bajada, lectura, acciones, className, children, ...rest }: Props) {
  return (
    <Panel
      {...rest}
      className={["mon-profile-panel", "mon-bloque", className].filter(Boolean).join(" ")}
      title={bajada ? <>{titulo}<span className="mon-bloque-bajada">{bajada}</span></> : titulo}
      actions={acciones}
      hint={lectura}
    >
      {children}
    </Panel>
  );
}
