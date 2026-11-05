// Elegir categorías de la pregunta en lugar de escribir códigos (pedido de Gonzalo, 2026-10-15: «no le puedes pedir al
// analista que escriba en comas y en códigos; le tienes que mostrar las categorías una vez que escoja la variable»).
// Sirve a Excluir respuestas, Corte y Excluir grupos. Las categorías salen de /api/graficos/categorias
// (`useCategoriasGrafico`, el mismo de Orden). Sin pregunta, sin lista o con error, queda el campo de texto de siempre.

import type { ReactNode } from "react";
import { codigosATexto, textoACodigos } from "./argsDatosGrafico";
import { useCategoriasGrafico } from "./useCategoriasGrafico";

type Props = {
  id: string;
  etiqueta: ReactNode;
  /** Pregunta calificada (`base$var`); vacía si aún no se eligió. */
  variable: string;
  scope: "active" | "consolidated";
  graficador: string;
  valor: unknown;
  /** «excluir»: lo marcado se quita del gráfico. «elegir»: lo marcado es lo que cuenta (el corte). «una»: como
   *  «elegir», pero sólo una (la respuesta que cuenta un hallazgo); marcar otra cambia la elegida. */
  modo: "excluir" | "elegir" | "una";
  /** El valor son etiquetas de respuesta, no códigos (`fila` de un hallazgo). Una etiqueta que la pregunta no tiene se
   *  conserva y se nombra. */
  porEtiqueta?: boolean;
  /** Emite la lista de códigos en el formato que espera el arg (lista o cadena unida por comas). */
  onCambio: (codigos: string[]) => void;
  nota: ReactNode;
  textoRespaldo: ReactNode;
};

export function SelectorCategorias({ id, etiqueta, variable, scope, graficador, valor, modo, porEtiqueta = false, onCambio, nota, textoRespaldo }: Props) {
  const estado = useCategoriasGrafico(variable, scope, graficador);
  // Una etiqueta puede llevar comas («Sí, siempre»): por etiqueta no se parte el texto.
  const elegidos = new Set(porEtiqueta
    ? (Array.isArray(valor) ? valor : [valor]).map((v) => (typeof v === "string" || typeof v === "number" ? String(v) : "")).filter(Boolean)
    : textoACodigos(codigosATexto(valor)));
  if (!variable) {
    return (
      <div className="pulso-f6-dato is-apilado">
        {etiqueta}
        <span className="pulso-f6-dato-ayuda">Elige primero la pregunta para ver sus categorías.</span>
      </div>
    );
  }
  if (estado.fase !== "lista" || !estado.datos.categorias.length) {
    return estado.fase === "cargando"
      ? <div className="pulso-f6-dato is-apilado">{etiqueta}<span className="pulso-f6-dato-ayuda" role="status">Leyendo las categorías de la pregunta</span></div>
      : <>{textoRespaldo}</>;
  }
  const cats = estado.datos.categorias;
  const claveDe = (c: (typeof cats)[number]) => (porEtiqueta ? c.etiqueta || c.codigo : c.codigo);
  const alternar = (clave: string) => {
    if (modo === "una") { onCambio(elegidos.has(clave) ? [] : [clave]); return; }
    const s = new Set(elegidos);
    if (s.has(clave)) s.delete(clave); else s.add(clave);
    onCambio(cats.map(claveDe).filter((c) => s.has(c)));
  };
  const n = cats.filter((c) => elegidos.has(claveDe(c))).length;
  const ajenas = porEtiqueta ? [...elegidos].filter((e) => !cats.some((c) => claveDe(c) === e)) : [];
  const resumen = n === 0 ? (modo === "excluir" ? "Se muestran todas" : "Ninguna elegida")
    : modo === "excluir" ? `${n === 1 ? "Una excluida" : `${n} excluidas`}` : `${n === 1 ? "Una elegida" : `${n} elegidas`}`;
  return (
    <div className="pulso-f6-dato is-apilado">
      <span className="pulso-f6-cats-cabeza">{etiqueta}<span className="pulso-f6-cats-resumen">{resumen}</span></span>
      <div id={id} className={`pulso-f6-cats is-${modo === "una" ? "elegir" : modo}`} role="group">
        {cats.map((c) => {
          const activo = elegidos.has(claveDe(c));
          return (
            <button key={c.codigo} type="button" className={`pulso-f6-cat${activo ? " is-activa" : ""}${c.residual ? " is-residual" : ""}`}
              aria-pressed={activo} onClick={() => alternar(claveDe(c))} title={`Código ${c.codigo}${Number.isFinite(c.n) ? `, ${c.n} casos` : ""}`}>
              <span className="pulso-f6-cat-texto">{c.etiqueta || c.codigo}</span>
              {Number.isFinite(c.n) && <span className="pulso-f6-cat-n">{c.n}</span>}
            </button>
          );
        })}
      </div>
      {ajenas.length > 0 && (
        <span className="pulso-f6-dato-ayuda is-aviso" role="note">
          {ajenas.map((e) => `«${e}»`).join(", ")} no {ajenas.length === 1 ? "está" : "están"} entre las respuestas de la pregunta; se conserva.
        </span>
      )}
      {nota}
    </div>
  );
}
