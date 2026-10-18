// Piezas comunes de la ficha del Constructor: el bloque con su rótulo, el campo de texto que crece con su contenido
// (sin asa, C9) y el botón que lleva a otra pestaña.

import { useId, type ReactNode } from "react";
import { ArrowRight } from "../../../../vendor/lucide-react";
import type { ColumnaRegla, LecturaRegla } from "../../reglas/piezas";
import { PiezasLectura } from "../../kit/CuerpoPanelMarca";

export function BloqueFicha({ titulo, accion, children, className }: { titulo: string; accion?: ReactNode; children: ReactNode; className?: string }) {
  const id = useId();
  return (
    <section className={className ? `xfh-bloque ${className}` : "xfh-bloque"} aria-labelledby={id}>
      <h3 className="xfh-bloque__tit">
        <span id={id}>{titulo}</span>
        {accion}
      </h3>
      {children}
    </section>
  );
}

export function CampoTexto({
  etiqueta,
  valor,
  onCambio,
  grande,
  multilinea,
  placeholder,
  ayuda,
}: {
  etiqueta: string;
  valor: string;
  onCambio: (v: string) => void;
  grande?: boolean;
  multilinea?: boolean;
  placeholder?: string;
  ayuda?: ReactNode;
}) {
  const id = useId();
  return (
    <div className="xfh-campo">
      <label htmlFor={id}>{etiqueta}</label>
      {multilinea ? (
        <textarea
          id={id}
          className={grande ? "xfh-texto is-grande" : "xfh-texto"}
          value={valor}
          rows={1}
          placeholder={placeholder}
          onChange={(e) => onCambio(e.target.value)}
        />
      ) : (
        <input id={id} className="xfh-texto" value={valor} placeholder={placeholder} onChange={(e) => onCambio(e.target.value)} />
      )}
      {ayuda ? <small className="xfh-campo__ayuda">{ayuda}</small> : null}
    </div>
  );
}

export function BotonIr({ children, onClick, primario }: { children: ReactNode; onClick: () => void; primario?: boolean }) {
  return (
    <button type="button" className={primario ? "xfh-boton is-primario" : "xfh-boton"} onClick={onClick}>
      {children}
      <ArrowRight size={13} aria-hidden="true" className="xfh-boton__flecha" />
    </button>
  );
}

export function EnlaceIr({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button type="button" className="xfh-enlace" onClick={onClick}>
      {children}
      <ArrowRight size={12} aria-hidden="true" className="xfh-boton__flecha" />
    </button>
  );
}

/** La frase del motor; si no la traduce lo dice, sin inventar una. */
export function Lectura({ lectura, corta }: { lectura: LecturaRegla; corta?: boolean }) {
  if (lectura.tecnica) {
    return <span className="xfh-lectura__tecnica">{corta ? "El motor todavía no traduce esta regla" : "El motor todavía no traduce esta regla."}</span>;
  }
  return <PiezasLectura piezas={lectura.piezas} />;
}

const NOMBRE_COLUMNA: Readonly<Record<ColumnaRegla, string>> = {
  relevant: "relevant",
  constraint: "constraint",
  calculation: "calculation",
  choice_filter: "choice_filter",
  required: "required",
};

/** Código XLSForm plegado; abierto de entrada si el motor no tradujo la regla. */
export function CodigoXlsform({ lineas, abierto }: { lineas: { columna: ColumnaRegla | string; raw: string }[]; abierto?: boolean }) {
  if (!lineas.length) return null;
  return (
    <details className="xfh-codigo" open={abierto || undefined}>
      <summary>Ver código XLSForm</summary>
      {lineas.map((l, i) => (
        <code key={i}>{`${NOMBRE_COLUMNA[l.columna as ColumnaRegla] ?? l.columna}: ${l.raw}`}</code>
      ))}
    </details>
  );
}
