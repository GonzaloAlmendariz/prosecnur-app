import type { ComponentPropsWithoutRef, ReactNode } from "react";

import { Panel } from "../../../components/Panel";
import "./bloqueDeMonitoreo.css";

/**
 * **Un bloque con marco de Monitoreo es el `Panel` del kit** (P2 de la pasada de formato, 4 nov 2026).
 *
 * Antes cada vista armaba su caja: `<section className="mon-profile-panel">` con una cabecera propia
 * (`mon-profile-panel-head`, un `h3` y una bajada en `span`), o en territorial una clase de panel por
 * vista que repetía padding, borde, radio, fondo y sombra. La medición del 2 nov contó 375 `h2–h4`
 * sueltos frente a 7 `Panel`. Este componente pone el título, la bajada, el antetítulo y las acciones
 * en la cabecera del kit.
 *
 * Dos marcos:
 * - `perfil` (por defecto): el bloque conserva `mon-profile-panel`, porque el reparto de las pilas, los
 *   `:last-child` y los gráficos de los perfiles viejos cuelgan de esa clase.
 * - `kit`: el material es el del `Panel`; la clase de la vista sólo pone su layout.
 *
 * La guarda `cajasPropias.contract.test.ts` impide que vuelvan a crecer los títulos sueltos.
 */
type Props = {
  titulo: ReactNode;
  /** El `id` del título, para el `aria-labelledby` del bloque o de una tabla de dentro. */
  tituloId?: string;
  /** Lo que va sobre el título: el rótulo de la pestaña en el primer bloque (§2a-bis). */
  antetitulo?: ReactNode;
  /** La bajada del título: qué cuenta el bloque o su conteo. Va junto al título. */
  bajada?: ReactNode;
  /** Una frase que se lee antes del contenido (qué mide el bloque y cómo). Va bajo la cabecera. */
  lectura?: ReactNode;
  acciones?: ReactNode;
  marco?: "perfil" | "kit";
  className?: string;
  children: ReactNode;
} & Omit<ComponentPropsWithoutRef<"section">, "title" | "className" | "children">;

export function BloqueDeMonitoreo({
  titulo, tituloId, antetitulo, bajada, lectura, acciones, marco = "perfil", className, children, ...rest
}: Props) {
  const rotulo = tituloId ? <span id={tituloId}>{titulo}</span> : titulo;
  return (
    <Panel
      {...rest}
      className={[marco === "perfil" ? "mon-profile-panel" : "mon-bloque--kit", "mon-bloque", className].filter(Boolean).join(" ")}
      eyebrow={antetitulo}
      title={bajada ? <>{rotulo}<span className="mon-bloque-bajada">{bajada}</span></> : rotulo}
      actions={acciones}
      hint={lectura}
    >
      {children}
    </Panel>
  );
}
