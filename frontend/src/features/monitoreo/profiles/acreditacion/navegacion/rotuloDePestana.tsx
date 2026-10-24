import { createContext, useContext, type ReactNode } from "react";

/**
 * El rótulo «SECCIÓN · GRUPO · Pestaña» ya no ocupa una fila propia (estándar
 * §2a-bis, Gonzalo: «esta sección ocupa toda una fila de forma innecesaria y se
 * ve fuera»). Va en el encabezado de la primera tarjeta de la pestaña, con los
 * chips de contexto y el selector de sub-vistas a la derecha. La página lo
 * publica por contexto; solo la tarjeta marcada `primera` lo lee.
 */
export type RotuloDePestana = {
  antetitulo: string;
  chips: readonly string[];
  control?: ReactNode;
};

export const RotuloDePestanaContexto = createContext<RotuloDePestana | null>(null);

export function EncabezadoDeTarjeta({
  titulo,
  detalle,
  acciones,
  primera = false,
  className,
}: {
  titulo: ReactNode;
  detalle?: ReactNode;
  acciones?: ReactNode;
  /** La primera tarjeta de la pestaña lleva el rótulo. */
  primera?: boolean;
  className?: string;
}) {
  const contexto = useContext(RotuloDePestanaContexto);
  const rotulo = primera ? contexto : null;
  const derecha = (
    <>
      {rotulo?.control}
      {rotulo?.chips.map((chip) => <span key={chip} className="acr-enc-chip">{chip}</span>)}
      {acciones}
    </>
  );
  const conDerecha = Boolean(rotulo?.control || rotulo?.chips.length || acciones);
  return (
    <header className={`acr-av-panel-cabecera${rotulo ? " is-con-rotulo" : ""}${className ? ` ${className}` : ""}`}>
      <div className="acr-enc-copia">
        {rotulo ? <span className="acr-av-antetitulo acr-enc-rotulo">{rotulo.antetitulo}</span> : null}
        <h3>{titulo}{detalle ? <span className="acr-av-tenue">{detalle}</span> : null}</h3>
      </div>
      {conDerecha ? <div className="acr-enc-derecha">{derecha}</div> : null}
    </header>
  );
}

/** Para una barra de herramientas que ya es la primera fila: el rótulo a su izquierda. */
export function RotuloEnBarra() {
  const rotulo = useContext(RotuloDePestanaContexto);
  if (!rotulo) return null;
  return (
    <span className="acr-enc-barra">
      <span className="acr-av-antetitulo acr-enc-rotulo">{rotulo.antetitulo}</span>
      {rotulo.control}
      {rotulo.chips.map((chip) => <span key={chip} className="acr-enc-chip">{chip}</span>)}
    </span>
  );
}

/**
 * La cabecera de una tarjeta que, si es la primera de la pestaña, lleva arriba
 * la línea del rótulo (antetítulo, chips y selector) y debajo su propio título
 * y acciones, sin cambiarlos.
 */
export function CabeceraDeTarjeta({
  primera = false,
  className,
  children,
}: {
  primera?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const contexto = useContext(RotuloDePestanaContexto);
  const rotulo = primera ? contexto : null;
  return (
    <header className={`acr-av-panel-cabecera${rotulo ? " is-con-rotulo" : ""}${className ? ` ${className}` : ""}`}>
      {rotulo ? (
        <div className="acr-enc-linea">
          <span className="acr-av-antetitulo acr-enc-rotulo">{rotulo.antetitulo}</span>
          {rotulo.control || rotulo.chips.length ? (
            <span className="acr-enc-derecha">
              {rotulo.control}
              {rotulo.chips.map((chip) => <span key={chip} className="acr-enc-chip">{chip}</span>)}
            </span>
          ) : null}
        </div>
      ) : null}
      {children}
    </header>
  );
}
