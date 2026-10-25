import { createContext, useContext, type ReactNode } from "react";
import "./chromeTelefonico.css";

/**
 * El rótulo de la pestaña dentro de la propia pestaña (estándar §2a-bis,
 * Gonzalo 2026-10-24: «esta sección ocupa toda una fila de forma innecesaria y
 * se ve fuera»). «SECCIÓN · GRUPO / Pestaña» no ocupa una fila suelta: comparte
 * fila con la barra de herramientas de la pestaña o encabeza su primera
 * tarjeta. El rail ya marca la pestaña activa: no lleva ícono.
 *
 * La página publica el valor por contexto; cada pestaña decide dónde va con
 * `<RotuloDePestana />`. Sin proveedor (tests, vistas sueltas, la cabecera de
 * siempre mientras carga) no pinta nada.
 */
export type RotuloDePestanaValor = {
  antetitulo: string;
  titulo: string;
  /** Selector de sub-vistas (Respuestas, Cuotas y calendario) o null. */
  control?: ReactNode;
  /** Chips de contexto de la pestaña («631 de 2,296 casos llamados»). */
  chips: readonly string[];
};

const Contexto = createContext<RotuloDePestanaValor | null>(null);

export function RotuloDePestanaProvider({ valor, children }: { valor: RotuloDePestanaValor | null; children: ReactNode }) {
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

/** Si la pestaña tiene rótulo que pintar (para decidir la composición de su primera fila). */
export function useHayRotulo() {
  return useContext(Contexto) != null;
}

/**
 * El rótulo en línea: antetítulo en versalitas y nombre de la pestaña; a su
 * derecha el selector de sub-vistas y los chips. Va como primer hijo de la barra
 * de herramientas o del encabezado de la primera tarjeta.
 */
export function RotuloDePestana({ sinChips = false }: { sinChips?: boolean }) {
  const valor = useContext(Contexto);
  if (!valor) return null;
  const chips = sinChips ? [] : valor.chips;
  return (
    <span className="mon-tel-rotulo" data-rotulo-de-pestana="">
      <span className="mon-tel-rotulo-copia">
        <small>{valor.antetitulo}</small>
        <h2>{valor.titulo}</h2>
      </span>
      {valor.control || chips.length ? (
        <span className="mon-tel-rotulo-extra">
          {valor.control}
          {chips.map((chip) => <span key={chip} className="mon-tel-chip">{chip}</span>)}
        </span>
      ) : null}
    </span>
  );
}
