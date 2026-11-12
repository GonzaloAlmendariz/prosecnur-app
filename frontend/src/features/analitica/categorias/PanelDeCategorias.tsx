// La lista elegida (prototipo, panel central de Analítica › Categorías): sus
// categorías en el orden que usan las tablas y los gráficos, con "Invertir" y
// "Como en el formulario" arriba. Se reordenan arrastrando o con Alt y las
// flechas; los especiales que quedan atrás van bajo "Al final, fuera del orden".
// El orden se guarda por lista, así que vale para todas sus preguntas.

import { Fragment, useRef, useState, type KeyboardEvent } from "react";
import { closestCenter, DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";

import type { DataReviewOption } from "../../../api/analitica";
import { EstadoVacio } from "../../../components/EstadoVacio";
import { PanelDeMesa } from "../../../components/procesamiento/PanelDeMesa";
import { PulsoButton } from "../../../components/PulsoButton";
import { formatoConteoDe } from "../../../lib/formatoNumero";
import { textoPlano } from "../../../lib/textoPlano";
import { ArrowLeftRight, ListOrdered, RotateCcw } from "../../../vendor/lucide-react";
import { esValorEspecial } from "../panes/ordenCategoriasModel";
import { FilaDeCategoria } from "./FilaDeCategoria";
import { indiceDelSeparador, moverConTeclado } from "./modeloDeCategorias";

export function PanelDeCategorias({ listName, codes, opciones, fuente, hayOrdenPropio, onOrden, onInvertir, onComoElFormulario }: {
  listName: string | null;
  /** La secuencia que rige: la guardada o la del formulario con los especiales al final. */
  codes: readonly string[];
  opciones: readonly DataReviewOption[];
  /** La pregunta de la que salen los casos. */
  fuente: string | null;
  hayOrdenPropio: boolean;
  onOrden: (codes: string[]) => void;
  onInvertir: () => void;
  onComoElFormulario: () => void;
}) {
  const sensores = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const lista = useRef<HTMLOListElement | null>(null);
  const [anuncio, setAnuncio] = useState("");
  const porCodigo = new Map(opciones.map((o) => [o.code, o]));
  const maximo = Math.max(0, ...opciones.map((o) => o.count ?? 0));
  const separador = indiceDelSeparador(codes);
  const etiqueta = (code: string) => textoPlano(porCodigo.get(code)?.label ?? "");

  function alSoltar(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const desde = codes.indexOf(String(active.id));
    const hacia = codes.indexOf(String(over.id));
    if (desde < 0 || hacia < 0) return;
    onOrden(arrayMove([...codes], desde, hacia));
  }

  function conTeclado(indice: number, e: KeyboardEvent<HTMLButtonElement>) {
    const siguiente = moverConTeclado(codes, indice, e.key, e.altKey);
    if (!siguiente) return;
    e.preventDefault();
    const code = codes[indice];
    if (siguiente === codes || siguiente.join("\u0000") === codes.join("\u0000")) return;
    onOrden(siguiente);
    setAnuncio(`${code} ${etiqueta(code)}, posición ${siguiente.indexOf(code) + 1} de ${siguiente.length}`);
    // El asa sigue con el foco después de moverse.
    requestAnimationFrame(() => {
      lista.current?.querySelector<HTMLButtonElement>(`[data-codigo="${CSS.escape(code)}"] .categorias-asa`)?.focus();
    });
  }

  const acciones = listName ? (
    <>
      <PulsoButton variant="secondary" size="sm" onClick={onInvertir} disabled={codes.length < 2}>
        <ArrowLeftRight size={14} aria-hidden="true" />
        Invertir
      </PulsoButton>
      <PulsoButton
        variant="secondary"
        size="sm"
        onClick={onComoElFormulario}
        disabled={!hayOrdenPropio}
        title="Borra el orden propio de esta lista: vuelve al del formulario, con los especiales al final"
      >
        <RotateCcw size={14} aria-hidden="true" />
        Como en el formulario
      </PulsoButton>
    </>
  ) : undefined;

  return (
    <PanelDeMesa
      zona="categorias"
      titulo={listName ?? "Categorías"}
      etiquetaCuerpo={listName ? `Categorías de ${listName}` : "Categorías"}
      conteo={listName ? formatoConteoDe(codes.length, "categoría", "categorías") : undefined}
      acciones={acciones}
    >
      {!listName ? (
        <EstadoVacio icono={<ListOrdered size={16} />} titulo="Elige una lista" descripcion="Sus categorías se ordenan aquí." />
      ) : codes.length === 0 ? (
        <EstadoVacio
          icono={<ListOrdered size={16} />}
          titulo="Sin categorías en la base"
          descripcion="Ninguna pregunta de esta lista trae respuestas en la base cargada."
        />
      ) : (
        <div className="categorias-cuerpo">
          <div className="categorias-encabezado" aria-hidden="true">
            <span>Categoría</span>
            <span>{fuente ? `Casos en ${fuente}` : "Casos"}</span>
          </div>
          <DndContext sensors={sensores} collisionDetection={closestCenter} onDragEnd={alSoltar}>
            <SortableContext items={[...codes]} strategy={verticalListSortingStrategy}>
              {/* C1: cada categoría mide lo que su etiqueta; no son marcos pares. */}
              <ol
                ref={lista}
                className="categorias-orden"
                aria-label={`Orden de ${listName}`}
                data-qa-geometry-group="analitica/categorias-orden"
                data-qa-geometry-contract="intrinsic"
              >
                {codes.map((code, i) => (
                  <Fragment key={code}>
                    {separador === i ? <li className="categorias-separador" aria-hidden="true">Al final, fuera del orden</li> : null}
                    <FilaDeCategoria
                      code={code}
                      etiqueta={etiqueta(code)}
                      casos={porCodigo.get(code)?.count}
                      maximo={maximo}
                      posicion={i + 1}
                      total={codes.length}
                      especial={esValorEspecial(code)}
                      onTeclado={(e) => conTeclado(i, e)}
                    />
                  </Fragment>
                ))}
              </ol>
            </SortableContext>
          </DndContext>
          <p className="pulso-sr-only" role="status" aria-live="polite">{anuncio}</p>
        </div>
      )}
    </PanelDeMesa>
  );
}
