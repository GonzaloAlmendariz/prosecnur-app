// Un ajuste del bloque (Alineación, Tamaño, Tono, Nivel, Relleno…) en el
// inspector: el rótulo arriba y debajo las opciones a todo el ancho, cada una
// con su ícono (o su muestra) sobre el rótulo, como en los editores de
// referencia. Todas las filas se acomodan igual, sin que unas vayan en línea y
// otras debajo según cuánto mida el texto.
//
// Es un radiogroup: una opción activa y su ayuda como `title`. Si el bloque no
// fija la alineación, queda marcada la que hereda de Identidad y una línea lo dice.

import { useId, type CSSProperties, type ReactNode } from "react";

import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Heading1,
  Heading2,
  List,
  ListOrdered,
  Minus,
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
  /** El bloque no fija este ajuste y sigue la alineación de Identidad. */
  sigueAIdentidad?: boolean;
  /** `theme.accent` del correo, para la muestra del tono «Acento». */
  acento?: string;
};

/** La «T» del tamaño crece con el paso: de 11 px en el primero a 20 px en el último. */
function tamanoDeT(indice: number, total: number): number {
  return total > 1 ? Math.round(11 + (indice * 9) / (total - 1)) : 16;
}

/** Lo que va sobre el rótulo de cada opción; sin entrada, solo el rótulo. */
function glifo(ajuste: Ajuste, indice: number, acento: string | undefined): ReactNode {
  const { clave } = ajuste;
  const valor = ajuste.opciones[indice].valor;
  const i = { size: 16, "aria-hidden": true } as const;
  if (clave === "align") {
    if (valor === "left") return <AlignLeft {...i} />;
    if (valor === "justify") return <AlignJustify {...i} />;
    if (valor === "center") return <AlignCenter {...i} />;
    if (valor === "right") return <AlignRight {...i} />;
    return null;
  }
  if (clave === "size") return <Type size={tamanoDeT(indice, ajuste.opciones.length)} aria-hidden />;
  if (clave === "tone") {
    // El acento es el color real del correo (viene del tema, no es un token de la app).
    const estilo = valor === "acento" && acento ? { background: acento } : undefined;
    return <span className={`rec-ajuste-muestra rec-ajuste-muestra--${valor}`} style={estilo} aria-hidden />;
  }
  if (clave === "level") return valor === "subtitulo" ? <Heading2 {...i} /> : <Heading1 {...i} />;
  if (clave === "fill") return <span className={`rec-ajuste-boton rec-ajuste-boton--${valor}`} aria-hidden />;
  if (clave === "ordered") return valor === "si" ? <ListOrdered {...i} /> : <List {...i} />;
  if (clave === "variant") return valor === "bar" ? <PanelLeft {...i} /> : <Square {...i} />;
  if (clave === "style") return <Minus {...i} />;
  return null;
}

export function AjusteDeBloque({ ajuste, valor, onCambio, sigueAIdentidad = false, acento }: Props) {
  const aviso = useId();
  const columnas = { "--rec-ajuste-columnas": String(ajuste.opciones.length) } as CSSProperties;
  return (
    <div className="rec-mail-ajuste rec-ajuste">
      <span className="rec-ajuste-rotulo">{ajuste.rotulo}</span>
      <span
        role="radiogroup"
        aria-label={`${ajuste.rotulo} del bloque`}
        className="rec-ajuste-opciones"
        style={columnas}
        aria-describedby={sigueAIdentidad ? aviso : undefined}
      >
        {ajuste.opciones.map((o, indice) => {
          const on = o.valor === valor;
          const g = glifo(ajuste, indice, acento);
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
      {sigueAIdentidad ? (
        <span id={aviso} className="rec-ajuste-aviso">
          Sigue la alineación de Identidad.
        </span>
      ) : null}
    </div>
  );
}
