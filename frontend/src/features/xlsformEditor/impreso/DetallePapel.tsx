// «Papel por pregunta» de la pestaña «Impreso» (ítem 50): las filas con ajustes `paper_*`. El clic en una fila abre
// ahí mismo sus ajustes de papel, editables (el mismo `PaperSettingsBlock` del Constructor, que escribe en el
// workbook con `onCampo`); una a la vez. Abierta, la fila ES la ficha: su cabecera y sus ajustes comparten contorno,
// sin una caja anidada. «Ajustar otra pregunta» abre la ficha de una fila que aún no tiene
// ajustes. La única salida al Constructor es «Editar en Constructor», al pie de la ficha.

import { useId } from "react";
import { ChevronRight } from "../../../vendor/lucide-react";
import { PaperSettingsBlock } from "../canvas/PaperSettingsBlock";
import { EditarEnConstructor } from "../shell/EditarEnConstructor";
import type { BuilderNode } from "../types";
import { rotuloAjustesPapel, type FilaConPapel } from "./modeloImpreso";
import { TarjetaImpreso } from "./TarjetaImpreso";

type Plano = (texto: string) => string;

function etiquetaCorta(fila: Pick<FilaConPapel, "label" | "name">, plano: Plano, largo = 90): string {
  const texto = plano(fila.label).replace(/\s+/g, " ").trim() || fila.name;
  return texto.length > largo ? `${texto.slice(0, largo - 1)}…` : texto;
}

/** «Etiqueta (código)»; si la etiqueta ya dice el código o no hay etiqueta, sólo una vez. */
function rotuloOpcion(fila: Pick<FilaConPapel, "label" | "name">, plano: Plano): string {
  const etiqueta = etiquetaCorta(fila, plano, 60);
  if (etiqueta === fila.name || etiqueta.toLowerCase().includes(fila.name.toLowerCase())) return etiqueta;
  return `${etiqueta} (${fila.name})`;
}

export type DetallePapelProps = {
  filas: readonly FilaConPapel[];
  /** Filas sin ajustes, para «Ajustar otra pregunta». */
  sinPapel: readonly Omit<FilaConPapel, "columnas">[];
  nodoDe: (rowIndex: number) => BuilderNode | undefined;
  abierta: number | null;
  onAbrir: (rowIndex: number | null) => void;
  onCampo: (rowIndex: number, campo: string, valor: string) => void;
  onEditar: (name: string) => void;
  /** Texto legible (sin markdown, `<br>` ni `${x}` crudos). */
  plano: Plano;
};

function OtraPregunta({ sinPapel, onAbrir, plano }: Pick<DetallePapelProps, "sinPapel" | "onAbrir" | "plano">) {
  const id = useId();
  if (sinPapel.length === 0) return null;
  return (
    <div className="pulso-xf-imp-papel-otra">
      <label htmlFor={id}>Ajustar otra pregunta</label>
      <select id={id} value="" onChange={(e) => { if (e.target.value) onAbrir(Number(e.target.value)); }}>
        <option value="">Elige una pregunta…</option>
        {sinPapel.map((f) => (
          <option key={f.rowIndex} value={f.rowIndex}>{rotuloOpcion(f, plano)}</option>
        ))}
      </select>
    </div>
  );
}

export function DetallePapel({ filas, sinPapel, nodoDe, abierta, onAbrir, onCampo, onEditar, plano }: DetallePapelProps) {
  if (filas.length === 0) {
    return (
      <TarjetaImpreso
        id="imp-papel"
        titulo="Papel por pregunta"
        ayuda="Ninguna fila trae ajustes de papel. El impreso numera, rotula y agrupa solo."
      >
        <OtraPregunta sinPapel={sinPapel} onAbrir={onAbrir} plano={plano} />
      </TarjetaImpreso>
    );
  }
  return (
    <TarjetaImpreso
      id="imp-papel"
      titulo={`Papel por pregunta (${filas.filter((f) => f.columnas.length > 0).length})`}
      ayuda="Filas con número, texto, salto o ancho propios del impreso. Elige una para editarla."
    >
      <ul className="pulso-xf-imp-papel" data-qa-geometry-group="xlsform/impreso-papel" data-qa-geometry-contract="intrinsic">
        {filas.map((f) => {
          const abiertaAqui = abierta === f.rowIndex;
          const nodo = abiertaAqui ? nodoDe(f.rowIndex) : undefined;
          const idFicha = `xf-imp-papel-${f.rowIndex}`;
          return (
            <li key={f.rowIndex} className={abiertaAqui ? "is-abierta" : undefined} data-qa-geometry-member="">
              <button type="button" id={`${idFicha}-cabeza`} className="pulso-xf-imp-papel-fila"
                onClick={() => onAbrir(abiertaAqui ? null : f.rowIndex)}
                aria-expanded={abiertaAqui} aria-controls={abiertaAqui ? idFicha : undefined}>
                <span className="pulso-xf-imp-papel-texto">
                  <code>{f.name}</code>
                  <span title={etiquetaCorta(f, plano)}>{etiquetaCorta(f, plano)}</span>
                </span>
                <span className="pulso-xf-imp-papel-columnas">{rotuloAjustesPapel(f.columnas)}</span>
                <ChevronRight size={14} aria-hidden="true" className="pulso-xf-imp-papel-chevron" />
              </button>
              {nodo && (
                <section id={idFicha} className="pulso-xf-imp-papel-cuerpo" aria-label={`Ajustes de papel de ${f.name}`}>
                  <PaperSettingsBlock key={nodo.rowIndex} node={nodo} plegable={false}
                    onFieldChange={(campo, valor) => onCampo(nodo.rowIndex, campo, valor)} />
                  <EditarEnConstructor onEditar={() => onEditar(nodo.name)} describedBy={`${idFicha}-cabeza`} />
                </section>
              )}
            </li>
          );
        })}
      </ul>
      <OtraPregunta sinPapel={sinPapel} onAbrir={onAbrir} plano={plano} />
    </TarjetaImpreso>
  );
}
