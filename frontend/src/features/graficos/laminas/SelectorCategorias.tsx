// Elegir categorías de la pregunta en lugar de escribir códigos (pedido de Gonzalo, 2026-10-15: «no le puedes pedir al
// analista que escriba en comas y en códigos; le tienes que mostrar las categorías una vez que escoja la variable»).
// Sirve a Excluir respuestas, Corte y Excluir grupos. Las categorías salen de /api/graficos/categorias
// (`useCategoriasGrafico`, el mismo de Orden). Sin pregunta se pide elegirla; el campo de texto de códigos queda sólo
// para la pregunta sin lista (oleada I2, ítem 1): con error se dice y se ofrece reintentar.
//
// Oleada I2 del inspector: quien lo monta puede dar la cifra de cada ficha (`cifraDe`), una línea de estado junto al
// resumen (`estado`, «Base 412 → 380») y otra debajo con el efecto de la ficha bajo el cursor o el foco (`efecto`, que
// sigue a `onSondear`).

import type { ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "../../../vendor/lucide-react";
import { codigosATexto, textoACodigos } from "./argsDatosGrafico";
import { useCategoriasGrafico } from "./useCategoriasGrafico";
import { rotuloVisible } from "./rotuloCortoDeLista";
import { useRotulosCortos } from "./useRotulosCortos";
import { fichaBloqueada, marcadas, RESPUESTA, resumenFichas, trasPulsar, type Sustantivo } from "./modeloSelectorCategorias";

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
  /** «elegir» donde guardar nada significa todos («Niveles que se muestran», H9): arranca con todas marcadas y quitar
   *  una ficha la saca (modeloSelectorCategorias.ts). */
  vacioEsTodos?: boolean;
  /** Con qué sustantivo concuerda el resumen («Ningún nivel elegido»); por defecto, «respuesta». */
  sustantivo?: Sustantivo;
  /** Emite la lista de códigos en el formato que espera el arg (lista o cadena unida por comas). */
  onCambio: (codigos: string[]) => void;
  nota: ReactNode;
  textoRespaldo: ReactNode;
  /** La cifra que lleva cada ficha en lugar de su n (el % de la lámina), o null para dejar el n. */
  cifraDe?: (codigo: string, etiqueta: string) => { texto: string; vigente: boolean } | null;
  /** La ficha bajo el cursor o con el foco (su clave), o null al salir. */
  onSondear?: (clave: string | null) => void;
  /** Estado junto al resumen. */
  estado?: ReactNode;
  /** Estado bajo las fichas (el efecto de la sondeada). */
  efecto?: ReactNode;
};

export function SelectorCategorias({
  id, etiqueta, variable, scope, graficador, valor, modo, porEtiqueta = false, vacioEsTodos = false, sustantivo = RESPUESTA, onCambio, nota, textoRespaldo,
  cifraDe, onSondear, estado: estadoCifra, efecto,
}: Props) {
  const estado = useCategoriasGrafico(variable, scope, graficador);
  // U14: con el rótulo corto del estudio la ficha dice lo que dirá la lámina; el completo queda en el title.
  const cortos = useRotulosCortos();
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
  if (estado.fase === "cargando") {
    return <div className="pulso-f6-dato is-apilado">{etiqueta}<span className="pulso-f6-dato-ayuda" role="status">Leyendo las categorías de la pregunta</span></div>;
  }
  if (estado.fase === "error") {
    return (
      <div className="pulso-f6-dato is-apilado">
        {etiqueta}
        <span className="pulso-f6-orden-estado is-error" role="alert">
          <AlertTriangle size={13} aria-hidden="true" />
          <span>No se pudieron leer las categorías: {estado.mensaje}</span>
          <button type="button" className="pulso-f6-texto-boton" onClick={estado.reintentar}>
            <RefreshCw size={12} aria-hidden="true" /> Reintentar
          </button>
        </span>
      </div>
    );
  }
  if (estado.fase !== "lista" || !estado.datos.categorias.length) return <>{textoRespaldo}</>;
  const cats = estado.datos.categorias;
  const claveDe = (c: (typeof cats)[number]) => (porEtiqueta ? c.etiqueta || c.codigo : c.codigo);
  const claves = cats.map(claveDe);
  const todos = vacioEsTodos && modo === "elegir";
  const visibles = marcadas(elegidos, claves, todos);
  const alternar = (clave: string) => {
    if (fichaBloqueada(clave, visibles, todos)) return;
    onCambio(trasPulsar(clave, elegidos, claves, modo, todos));
  };
  const n = cats.filter((c) => elegidos.has(claveDe(c))).length;
  const ajenas = porEtiqueta ? [...elegidos].filter((e) => !cats.some((c) => claveDe(c) === e)) : [];
  const resumen = resumenFichas(n, cats.length, modo, sustantivo, todos);
  return (
    <div className="pulso-f6-dato is-apilado">
      <span className="pulso-f6-cats-cabeza">{etiqueta}<span className="pulso-f6-cats-resumen">{resumen}{estadoCifra}</span></span>
      <div id={id} className={`pulso-f6-cats is-${modo === "una" ? "elegir" : modo}`} role="group"
        onMouseLeave={onSondear ? () => onSondear(null) : undefined}
        onBlur={onSondear ? (e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) onSondear(null); } : undefined}>
        {cats.map((c) => {
          const activo = visibles.has(claveDe(c));
          const bloqueada = fichaBloqueada(claveDe(c), visibles, todos);
          const r = rotuloVisible(cortos, c.etiqueta || c.codigo);
          const detalle = `Código ${c.codigo}${Number.isFinite(c.n) ? `, ${c.n} casos` : ""}${bloqueada ? `. Al menos ${sustantivo.femenino ? "una" : "uno"} queda` : ""}`;
          const cifra = cifraDe?.(c.codigo, c.etiqueta) ?? null;
          return (
            <button key={c.codigo} type="button" className={`pulso-f6-cat${activo ? " is-activa" : ""}${c.residual ? " is-residual" : ""}`}
              aria-pressed={activo} aria-disabled={bloqueada || undefined} onClick={() => alternar(claveDe(c))}
              onMouseEnter={onSondear ? () => onSondear(claveDe(c)) : undefined} onFocus={onSondear ? () => onSondear(claveDe(c)) : undefined}
              title={r.completo ? `${r.completo}. ${detalle}` : detalle}>
              <span className="pulso-f6-cat-texto">{r.texto}</span>
              {cifra
                ? <span className={`pulso-f6-cifra-pct${cifra.vigente ? "" : " is-anterior"}`} data-qa="cifra-ficha">{cifra.texto}</span>
                : Number.isFinite(c.n) && <span className="pulso-f6-cat-n">{c.n}</span>}
            </button>
          );
        })}
      </div>
      {efecto}
      {ajenas.length > 0 && (
        <span className="pulso-f6-dato-ayuda is-aviso" role="note">
          {ajenas.map((e) => `«${e}»`).join(", ")} no {ajenas.length === 1 ? "está" : "están"} entre las respuestas de la pregunta; se conserva.
        </span>
      )}
      {nota}
    </div>
  );
}
