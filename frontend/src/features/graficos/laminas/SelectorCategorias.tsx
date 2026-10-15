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
  /** «excluir»: lo marcado se quita del gráfico. «elegir»: lo marcado es lo que cuenta (el corte). */
  modo: "excluir" | "elegir";
  /** Emite la lista de códigos en el formato que espera el arg (lista o cadena unida por comas). */
  onCambio: (codigos: string[]) => void;
  nota: ReactNode;
  textoRespaldo: ReactNode;
};

export function SelectorCategorias({ id, etiqueta, variable, scope, graficador, valor, modo, onCambio, nota, textoRespaldo }: Props) {
  const estado = useCategoriasGrafico(variable, scope, graficador);
  const elegidos = new Set(textoACodigos(codigosATexto(valor)));
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
  const alternar = (codigo: string) => {
    const s = new Set(elegidos);
    if (s.has(codigo)) s.delete(codigo); else s.add(codigo);
    onCambio(cats.map((c) => c.codigo).filter((c) => s.has(c)));
  };
  const n = cats.filter((c) => elegidos.has(c.codigo)).length;
  const resumen = n === 0 ? (modo === "excluir" ? "Se muestran todas" : "Ninguna elegida")
    : modo === "excluir" ? `${n === 1 ? "Una excluida" : `${n} excluidas`}` : `${n === 1 ? "Una elegida" : `${n} elegidas`}`;
  return (
    <div className="pulso-f6-dato is-apilado">
      <span className="pulso-f6-cats-cabeza">{etiqueta}<span className="pulso-f6-cats-resumen">{resumen}</span></span>
      <div id={id} className={`pulso-f6-cats is-${modo}`} role="group">
        {cats.map((c) => {
          const activo = elegidos.has(c.codigo);
          return (
            <button key={c.codigo} type="button" className={`pulso-f6-cat${activo ? " is-activa" : ""}${c.residual ? " is-residual" : ""}`}
              aria-pressed={activo} onClick={() => alternar(c.codigo)} title={`Código ${c.codigo}${Number.isFinite(c.n) ? `, ${c.n} casos` : ""}`}>
              <span className="pulso-f6-cat-texto">{c.etiqueta || c.codigo}</span>
              {Number.isFinite(c.n) && <span className="pulso-f6-cat-n">{c.n}</span>}
            </button>
          );
        })}
      </div>
      {nota}
    </div>
  );
}
