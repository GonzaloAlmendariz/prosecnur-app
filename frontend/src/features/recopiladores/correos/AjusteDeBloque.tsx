// Un ajuste del bloque (Alineación, Tamaño, Tono, Nivel, Relleno…) en el
// inspector: el rótulo arriba y debajo las opciones a todo el ancho, cada una
// con su ícono (o su muestra) sobre el rótulo, como en los editores de
// referencia. Todas las filas se acomodan igual, sin que unas vayan en línea y
// otras debajo según cuánto mida el texto.
//
// Es un radiogroup: una opción activa y su ayuda como `title`.

import type { CSSProperties, ReactNode } from "react";

import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  Heading1,
  Heading2,
  List,
  ListOrdered,
  Minus,
  Paintbrush,
  PanelLeft,
  Square,
  Type,
} from "../../../vendor/lucide-react";
import type { Ajuste } from "./ajustesDeBloque";
import "./correosAjusteDeBloque.css";

type Props = {
  ajuste: Ajuste;
  valor: string;
  onCambio: (valor: string) => void;
};

/** Lo que va sobre el rótulo de cada opción; sin entrada, solo el rótulo. */
function glifo(clave: string, valor: string): ReactNode {
  const i = { size: 16, "aria-hidden": true } as const;
  if (clave === "align") {
    if (valor === "left") return <AlignLeft {...i} />;
    if (valor === "justify") return <AlignJustify {...i} />;
    if (valor === "center") return <AlignCenter {...i} />;
    return <Paintbrush {...i} />;
  }
  if (clave === "size") {
    if (valor === "pequeno" || valor === "compacto") return <Type size={12} aria-hidden />;
    if (valor === "grande") return <Type size={19} aria-hidden />;
    return <Type {...i} />;
  }
  if (clave === "tone") return <span className={`rec-ajuste-muestra rec-ajuste-muestra--${valor}`} aria-hidden />;
  if (clave === "level") return valor === "subtitulo" ? <Heading2 {...i} /> : <Heading1 {...i} />;
  if (clave === "fill") return <span className={`rec-ajuste-boton rec-ajuste-boton--${valor}`} aria-hidden />;
  if (clave === "ordered") return valor === "si" ? <ListOrdered {...i} /> : <List {...i} />;
  if (clave === "variant") return valor === "bar" ? <PanelLeft {...i} /> : <Square {...i} />;
  if (clave === "style") return <Minus {...i} />;
  return null;
}

export function AjusteDeBloque({ ajuste, valor, onCambio }: Props) {
  const columnas = { "--rec-ajuste-columnas": String(ajuste.opciones.length) } as CSSProperties;
  return (
    <div className="rec-mail-ajuste rec-ajuste">
      <span className="rec-ajuste-rotulo">{ajuste.rotulo}</span>
      <span role="radiogroup" aria-label={`${ajuste.rotulo} del bloque`} className="rec-ajuste-opciones" style={columnas}>
        {ajuste.opciones.map((o) => {
          const on = o.valor === valor;
          const g = glifo(ajuste.clave, o.valor);
          return (
            <button
              key={o.valor}
              type="button"
              role="radio"
              aria-checked={on}
              title={o.ayuda ? `${o.rotulo}: ${o.ayuda}` : o.rotulo}
              className={`rec-ajuste-opcion${on ? " is-on" : ""}`}
              onClick={() => onCambio(o.valor)}
            >
              {g ? <span className="rec-ajuste-glifo">{g}</span> : null}
              <span className="rec-ajuste-texto">{o.rotulo}</span>
            </button>
          );
        })}
      </span>
    </div>
  );
}
