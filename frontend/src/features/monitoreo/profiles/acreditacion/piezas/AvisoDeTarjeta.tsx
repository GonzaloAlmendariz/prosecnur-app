import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { Alert } from "../../../../../components/Alert";
import { EstadoVacio } from "../../../../../components/EstadoVacio";
import { CabeceraDeTarjeta } from "../navegacion/rotuloDePestana";
import "../avance/avance.css";
import "./avisos.css";

/**
 * Un solo tratamiento para avisos, trabas y vacíos en todo el perfil de
 * acreditación (estándar §2a-bis; C3 y C5 de `docs/ui-layout-grammar.md`):
 *
 * - **Aviso o traba** (algo que leer o resolver): el `Alert` del sistema,
 *   dentro de la tarjeta a la que pertenece, con el aire de su cuerpo.
 * - **Vacío de un bloque**: la receta `EstadoVacio` compacta dentro de su
 *   tarjeta, con el motivo en una línea.
 * - **Pestaña sin contenido** (cargando, sin corte, sin datos): una tarjeta con
 *   el rótulo de la pestaña y el motivo al centro; la tarjeta es la dueña del
 *   vacío y nunca queda una píldora suelta sobre el fondo.
 *
 * `vacio` clasifica el vacío (C5): `legitimo` (el proyecto no tiene ese dato),
 * `sin-coincidencias` (los filtros no dejan nada), `cargando` o `error`.
 */
export type ClaseDeVacio = "legitimo" | "sin-coincidencias" | "cargando" | "error";

export function AvisoDeTarjeta({
  kind = "info",
  accion,
  className,
  children,
}: {
  kind?: "info" | "warn" | "error";
  accion?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`acr-aviso${className ? ` ${className}` : ""}`} role={kind === "error" ? "alert" : undefined}>
      <Alert kind={kind}>{children}</Alert>
      {accion ? <div className="acr-aviso-accion">{accion}</div> : null}
    </div>
  );
}

/** Varios avisos seguidos en la misma tarjeta, con el mismo aire. */
export function AvisosDeTarjeta({ avisos }: { avisos: ReadonlyArray<{ kind?: "info" | "warn" | "error"; texto: string }> }) {
  if (!avisos.length) return null;
  return (
    <div className="acr-aviso is-varios">
      {avisos.map((aviso) => <Alert key={aviso.texto} kind={aviso.kind ?? "info"}>{aviso.texto}</Alert>)}
    </div>
  );
}

export function VacioDeBloque({
  icono,
  titulo,
  descripcion,
  accion,
  vacio = "legitimo",
}: {
  icono: ReactNode;
  titulo: ReactNode;
  descripcion?: ReactNode;
  accion?: ReactNode;
  vacio?: ClaseDeVacio;
}) {
  return (
    <div className="acr-aviso is-vacio" data-vacio={vacio} aria-busy={vacio === "cargando" || undefined}>
      <EstadoVacio tamano="compacto" icono={vacio === "cargando" ? <Loader2 size={15} className="pulso-spin" /> : icono} titulo={titulo} descripcion={descripcion} accion={accion} />
    </div>
  );
}

export function PestanaSinContenido({
  titulo,
  icono,
  motivo,
  descripcion,
  accion,
  vacio = "legitimo",
  detalle,
}: {
  /** Título de la tarjeta: lo que la pestaña muestra cuando tiene datos. */
  titulo: string;
  icono: ReactNode;
  /** Qué falta, en una frase. */
  motivo: ReactNode;
  /** Cómo se llena o qué hacer. */
  descripcion?: ReactNode;
  accion?: ReactNode;
  vacio?: ClaseDeVacio;
  /** Chip o aclaración a la derecha del título. */
  detalle?: ReactNode;
}) {
  const cargando = vacio === "cargando";
  return (
    <div className="acr-sin-contenido" data-vacio={vacio} aria-busy={cargando || undefined}>
      <section className="acr-av-panel acr-sin-contenido-tarjeta" aria-label={titulo}>
        <CabeceraDeTarjeta primera>
          <h3>{titulo}{detalle ? <span className="acr-av-tenue">{detalle}</span> : null}</h3>
        </CabeceraDeTarjeta>
        <div className={`acr-sin-contenido-cuerpo is-${vacio}`}>
          {vacio === "error" ? (
            <AvisoDeTarjeta kind="error" accion={accion}>{motivo}</AvisoDeTarjeta>
          ) : (
            <EstadoVacio
              tamano="normal"
              icono={cargando ? <Loader2 size={18} className="pulso-spin" /> : icono}
              titulo={motivo}
              descripcion={descripcion}
              accion={accion}
            />
          )}
        </div>
      </section>
    </div>
  );
}
