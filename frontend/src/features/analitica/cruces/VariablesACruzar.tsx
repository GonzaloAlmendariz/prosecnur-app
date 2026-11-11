// Las variables de cruce, como en el prototipo: un chip por variable con sus
// columnas en el archivo y, al final, "Añadir". El orden de los chips es el de
// las columnas de las tablas: se cambia arrastrando un chip o con Alt y las
// flechas sobre él. Al elegir un chip, debajo van sus categorías para excluir
// las que no deben ser columna, con las excluidas tachadas.

import { useMemo, useState, type DragEvent, type KeyboardEvent } from "react";

import type { VariableInstrumento } from "../../../api/analitica";
import { ChipControl, CLASE_CHIP_CON_CONTROLES } from "../../../components/ChipConControles";
import { formatoConteo, formatoConteoDe } from "../../../lib/formatoNumero";
import { GripVertical, X } from "../../../vendor/lucide-react";
import type { CruceVarConfig } from "../store";
import { nombreCortoDeVariable } from "./crucesModelo";
import { CategoriasDeCruce } from "./CategoriasDeCruce";
import { ElegirVariableACruzar } from "./ElegirVariableACruzar";

/** La lista con un elemento movido de `desde` a `hasta`. */
export function mover<T>(lista: readonly T[], desde: number, hasta: number): T[] {
  if (desde === hasta || desde < 0 || hasta < 0 || desde >= lista.length || hasta >= lista.length) return [...lista];
  const copia = [...lista];
  const [elemento] = copia.splice(desde, 1);
  copia.splice(hasta, 0, elemento);
  return copia;
}

export function VariablesACruzar({ elegidas, cruzables, columnas, preguntasDeCruce, etiquetasDeCategorias, onAgregar, onQuitar, onExcluidas, onOrdenar }: {
  elegidas: readonly CruceVarConfig[];
  /** Las variables del formulario que pueden ser variable de cruce (selección única o múltiple). */
  cruzables: readonly VariableInstrumento[];
  /** Las columnas que cada variable tiene en el archivo, según la vista previa. */
  columnas: ReadonlyMap<string, number>;
  /** La pregunta de cada variable de cruce según la vista previa, que suele llegar antes que el formulario. */
  preguntasDeCruce: ReadonlyMap<string, string>;
  /** Por variable de cruce, el rótulo de cada categoría por su código, de las columnas de la vista previa. */
  etiquetasDeCategorias: ReadonlyMap<string, ReadonlyMap<string, string>>;
  onAgregar: (variable: string) => void;
  onQuitar: (variable: string) => void;
  onExcluidas: (variable: string, excluidas: string[]) => void;
  /** El orden nuevo de las variables de cruce. */
  onOrdenar: (ordenadas: CruceVarConfig[]) => void;
}) {
  const porNombre = useMemo(() => new Map(cruzables.map((v) => [v.name, v])), [cruzables]);
  const disponibles = useMemo(
    () => cruzables.filter((v) => !elegidas.some((e) => e.name === v.name)),
    [cruzables, elegidas],
  );
  // La pregunta: la de la vista previa o la del formulario. Sin ninguna, el nombre de la columna solo para nombrar controles.
  const preguntaDe = (nombre: string): string | null => preguntasDeCruce.get(nombre)?.trim() || porNombre.get(nombre)?.label?.trim() || null;
  const etiquetaDe = (nombre: string) => preguntaDe(nombre) ?? nombre;
  // La variable cuyas categorías se ven: la elegida si sigue en la lista; si no, la primera.
  const [vista, setVista] = useState<string | null>(null);
  const abierta = elegidas.find((e) => e.name === vista) ?? elegidas[0] ?? null;
  const [arrastrada, setArrastrada] = useState<number | null>(null);

  const moverConTeclado = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    if (!e.altKey || (e.key !== "ArrowLeft" && e.key !== "ArrowRight")) return;
    e.preventDefault();
    const hasta = e.key === "ArrowLeft" ? i - 1 : i + 1;
    if (hasta < 0 || hasta >= elegidas.length) return;
    onOrdenar(mover(elegidas, i, hasta));
    // El foco sigue al chip movido.
    const lista = e.currentTarget.closest("ul");
    requestAnimationFrame(() => lista?.querySelectorAll<HTMLButtonElement>(".cruces-chip-nombre")[hasta]?.focus());
  };
  const soltar = (e: DragEvent<HTMLLIElement>, i: number) => {
    e.preventDefault();
    if (arrastrada !== null && arrastrada !== i) onOrdenar(mover(elegidas, arrastrada, i));
    setArrastrada(null);
  };

  return (
    <div className="cruces-variables">
      <ul className="cruces-chips" aria-label="Variables de cruce" data-qa-geometry-group="analitica/cruces-variables" data-qa-geometry-contract="intrinsic">
        {elegidas.map((e, i) => {
          const etiqueta = etiquetaDe(e.name);
          const corto = nombreCortoDeVariable(preguntaDe(e.name));
          const n = columnas.get(e.name);
          const excluidas = e.excluidas?.length ?? 0;
          return (
            <li
              key={e.name}
              className={`${CLASE_CHIP_CON_CONTROLES} cruces-chip`}
              data-abierta={abierta?.name === e.name ? "" : undefined}
              data-arrastrada={arrastrada === i ? "" : undefined}
              draggable
              onDragStart={(ev) => { setArrastrada(i); ev.dataTransfer.effectAllowed = "move"; }}
              onDragOver={(ev) => { if (arrastrada !== null) ev.preventDefault(); }}
              onDrop={(ev) => soltar(ev, i)}
              onDragEnd={() => setArrastrada(null)}
            >
              <GripVertical size={12} aria-hidden="true" className="cruces-chip-asa" />
              <button
                type="button"
                className="cruces-chip-nombre"
                aria-pressed={abierta?.name === e.name}
                aria-keyshortcuts="Alt+ArrowLeft Alt+ArrowRight"
                title={`${etiqueta}${etiqueta !== e.name ? ` (${e.name})` : ""}. Alt y las flechas cambian su lugar.`}
                onClick={() => setVista(e.name)}
                onKeyDown={(ev) => moverConTeclado(ev, i)}
              >
                {corto
                  ? <span className="cruces-chip-etiqueta">{corto}</span>
                  : <span className="cruces-chip-etiqueta" data-leyendo="">Leyendo</span>}
                {n !== undefined ? (
                  <small className="cruces-chip-columnas" title={formatoConteoDe(n, "columna en el archivo", "columnas en el archivo")}>
                    {formatoConteo(n)}
                  </small>
                ) : null}
                {excluidas > 0 ? <span className="pulso-sr-only">, {formatoConteoDe(excluidas, "categoría excluida", "categorías excluidas")}</span> : null}
              </button>
              <ChipControl aria-label={`Quitar ${etiqueta}`} onClick={() => onQuitar(e.name)}>
                <X size={12} aria-hidden="true" />
              </ChipControl>
            </li>
          );
        })}
        <li className="cruces-chip-anadir">
          <ElegirVariableACruzar variables={disponibles} rotulo="Añadir variable de cruce" corto onElegir={onAgregar} />
        </li>
      </ul>

      {abierta ? (
        <div className="cruces-categorias-de">
          <p className="cruces-categorias-titulo">Categorías de &quot;{etiquetaDe(abierta.name)}&quot;</p>
          <CategoriasDeCruce
            key={abierta.name}
            variable={abierta.name}
            etiqueta={etiquetaDe(abierta.name)}
            excluidas={abierta.excluidas ?? []}
            etiquetas={etiquetasDeCategorias.get(abierta.name)}
            onCambio={(excluidas) => onExcluidas(abierta.name, excluidas)}
          />
          {/* La consecuencia de excluir no se ve hasta releer: se dice una vez. */}
          <p className="tablas-nota">Excluir una categoría quita sus casos de todas las tablas, también del Total.</p>
        </div>
      ) : null}
    </div>
  );
}
