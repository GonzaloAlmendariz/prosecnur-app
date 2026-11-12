import { useEffect, useLayoutEffect, useRef, type KeyboardEvent, type MouseEvent } from "react";
import { FileSpreadsheet, ListPlus, Sigma } from "../../../../vendor/lucide-react";
import { PulsoButton } from "../../../../components/PulsoButton";
import { Switch } from "../../../../components/Switch";
import { formatoConteo } from "../../../../lib/formatoNumero";
import type { FilaDeVariable, GrupoConFilas } from "./variablesModel";

const ROTULO_ORIGEN: Record<FilaDeVariable["origen"], string> = {
  columna: "Columna de la base",
  calculada: "Calculada",
};

/**
 * Las variables que no vienen del formulario (prototipo "carga-variables",
 * columna izquierda): una rejilla con roles de tabla, agrupada por de dónde
 * sale cada variable, con una cabecera de grupo por bloque. La fila elegida es
 * la del inspector; las flechas recorren las filas y la elegida se trae a la
 * vista cuando cambia desde fuera (al guardar una calculada nueva).
 */
export function TablaDeVariables({
  grupos,
  elegida,
  onElegir,
  incorporando,
  onIncorporarTodas,
  marcadas,
  onMarcar,
  onIncorporarElegidas,
}: {
  grupos: readonly GrupoConFilas[];
  elegida: string | null;
  /** `puntero`: la eligió con el ratón; `teclado`: recorriendo con las flechas o Enter. */
  onElegir: (clave: string, origen: "puntero" | "teclado") => void;
  incorporando: boolean;
  /** Incorpora de una vez todas las columnas del grupo "Por incorporar", con las etiquetas editadas. */
  onIncorporarTodas: () => void;
  /** Columnas por incorporar elegidas a mano (código), del borrador de la mesa. */
  marcadas: readonly string[];
  onMarcar: (codigo: string, marcada: boolean) => void;
  /** Incorpora juntas las elegidas a mano que se ven. */
  onIncorporarElegidas: () => void;
}) {
  const raiz = useRef<HTMLDivElement>(null);
  const cabecera = useRef<HTMLDivElement>(null);

  // El rótulo de cada grupo se pega bajo la cabecera de columnas: su `top` es el alto medido de la cabecera.
  useLayoutEffect(() => {
    const nodo = cabecera.current;
    const tabla = raiz.current;
    if (!nodo || !tabla) return;
    const medir = () => tabla.style.setProperty("--pulso-variables-alto-cabecera", `${nodo.offsetHeight}px`);
    medir();
    if (typeof ResizeObserver === "undefined") return;
    const observador = new ResizeObserver(medir);
    observador.observe(nodo);
    return () => observador.disconnect();
  }, []);

  useEffect(() => {
    if (!elegida) return;
    const fila = raiz.current?.querySelector<HTMLElement>(`[data-clave="${CSS.escape(elegida)}"]`);
    fila?.scrollIntoView?.({ block: "nearest" });
  }, [elegida]);

  const moverFoco = (e: KeyboardEvent<HTMLDivElement>, clave: string) => {
    // Las teclas sobre un control de la fila (el interruptor) son de ese control.
    if (e.target !== e.currentTarget) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onElegir(clave, "teclado");
      return;
    }
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    const filas = [...(raiz.current?.querySelectorAll<HTMLElement>("[data-clave]") ?? [])];
    const i = filas.findIndex((f) => f.dataset.clave === clave);
    const siguiente = filas[e.key === "ArrowDown" ? i + 1 : i - 1];
    if (!siguiente) return;
    e.preventDefault();
    siguiente.focus();
    onElegir(siguiente.dataset.clave ?? clave, "teclado");
  };

  return (
    <div ref={raiz} className="pulso-variables-tabla" role="table" aria-label="Variables que no vienen del formulario">
      <div ref={cabecera} className="pulso-variables-cabecera" role="rowgroup">
        <div className="pulso-variables-fila" role="row">
          <span role="columnheader"><span className="pulso-sr-only">Elegir para incorporar</span></span>
          <span role="columnheader">Código</span>
          <span role="columnheader">Etiqueta</span>
          <span role="columnheader">Origen</span>
          <span role="columnheader">De dónde sale</span>
          <span role="columnheader" data-cifra="">Con dato</span>
        </div>
      </div>
      {grupos.map((g) => (
        <div
          key={g.grupo}
          className="pulso-variables-grupo"
          role="rowgroup"
          aria-label={g.rotulo}
          // C1: las filas de un grupo son una colección; su alto lo da el texto (una o dos líneas), no se iguala.
          data-qa-geometry-group={`carga/variables-filas-${g.grupo}`}
          data-qa-geometry-contract="intrinsic"
        >
          <div className="pulso-variables-grupo-titulo" role="row">
            <span role="rowheader" className="pulso-variables-grupo-rotulo">
              {g.rotulo}
              <em>{formatoConteo(g.filas.length)}</em>
            </span>
            {g.grupo === "pendientes" ? (() => {
              const elegidas = g.filas.filter((f) => marcadas.includes(f.codigo)).length;
              return (
                <span role="cell" className="pulso-variables-grupo-accion">
                  {elegidas > 0 ? (
                    <PulsoButton variant="primary" size="sm" disabled={incorporando} onClick={onIncorporarElegidas}>
                      <ListPlus size={14} aria-hidden="true" />
                      {elegidas === 1 ? "Incorporar la elegida" : `Incorporar las ${formatoConteo(elegidas)} elegidas`}
                    </PulsoButton>
                  ) : null}
                  <PulsoButton variant="secondary" size="sm" disabled={incorporando} onClick={onIncorporarTodas}>
                    <ListPlus size={14} aria-hidden="true" />
                    {g.filas.length === 1 ? "Incorporar la columna" : `Incorporar las ${formatoConteo(g.filas.length)}`}
                  </PulsoButton>
                </span>
              );
            })() : null}
          </div>
          {g.filas.map((f) => (
            <div
              key={f.clave}
              className="pulso-variables-fila"
              role="row"
              data-clave={f.clave}
              data-qa-geometry-member
              aria-selected={f.clave === elegida}
              tabIndex={f.clave === elegida ? 0 : -1}
              onClick={(e: MouseEvent<HTMLDivElement>) => {
                // Encender el interruptor de una fila no la elige ni mueve la pestaña.
                if (e.target instanceof Element && e.target.closest('[role="switch"]')) return;
                onElegir(f.clave, e.detail === 0 ? "teclado" : "puntero");
              }}
              onKeyDown={(e) => moverFoco(e, f.clave)}
            >
              <span role="cell" className="pulso-variables-elegir">
                {f.grupo === "pendientes" ? (
                  <Switch
                    checked={marcadas.includes(f.codigo)}
                    disabled={incorporando}
                    ariaLabel={`Elegir ${f.codigo} para incorporar`}
                    onToggle={() => onMarcar(f.codigo, !marcadas.includes(f.codigo))}
                  />
                ) : null}
              </span>
              <span role="cell"><code className="pulso-variables-codigo" title={f.codigo}>{f.codigo}</code></span>
              <span role="cell" className="pulso-variables-etiqueta">{f.etiqueta}</span>
              <span role="cell">
                <span className="pulso-variables-origen">
                  {f.origen === "calculada" ? <Sigma size={12} aria-hidden="true" /> : <FileSpreadsheet size={12} aria-hidden="true" />}
                  {ROTULO_ORIGEN[f.origen]}
                </span>
              </span>
              <span role="cell" className="pulso-variables-dedonde">{f.deDonde}</span>
              <span role="cell" data-cifra="">
                {f.conDato === null
                  ? <span className="pulso-variables-sin-cuenta" title="El motor publica esta cuenta al guardar la variable">Sin cuenta</span>
                  : formatoConteo(f.conDato)}
              </span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
