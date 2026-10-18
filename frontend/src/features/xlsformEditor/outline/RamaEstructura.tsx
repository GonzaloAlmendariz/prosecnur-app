// Rama de la Estructura (2026-10-17): pinta las piezas de un contenedor (el formulario o una sección) y el hueco
// del arrastre donde caerá lo que se arrastra. Recursiva: una sección abierta pinta su propia rama adentro.

import { createContext, Fragment, useContext } from "react";
import type { BuilderStructure } from "../types";
import type { AbrirInsertar } from "./BotonInsertar";
import { contarPiezas, type Hueco, type NodoArbol } from "./modeloEstructura";
import { OutlineRow } from "./OutlineRow";
import type { AvisoFila } from "./PuntoAviso";
import { SeccionEstructura, type LimiteSeccion } from "./SeccionEstructura";

export type ArrastreEstructura = { fila: number; alto: number; hueco: Hueco | null };

export type ValorEstructura = {
  structure: BuilderStructure;
  seleccion: number | null;
  enRecorrido: number | null;
  arrastre: ArrastreEstructura | null;
  arrastrable: boolean;
  plegada: (fila: number) => boolean;
  avisos?: ReadonlyMap<number, readonly AvisoFila[]>;
  canMoveUp: boolean;
  canMoveDown: boolean;
  limite?: LimiteSeccion;
  onElegir: (fila: number) => void;
  onPlegar: (fila: number) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onInsertar?: AbrirInsertar;
};

export const ContextoEstructura = createContext<ValorEstructura | null>(null);

function HuecoArrastre({ alto }: { alto: number }) {
  return <div className="xfe-hueco" data-hueco="" style={{ height: alto }} aria-hidden="true" />;
}

export function RamaEstructura({
  hijos,
  contenedor,
  finSlot,
}: {
  hijos: readonly NodoArbol[];
  contenedor: number | null;
  finSlot: number;
}) {
  const c = useContext(ContextoEstructura);
  if (!c) return null;
  const hueco = c.arrastre?.hueco ?? null;
  const alto = c.arrastre?.alto ?? 0;
  const huecoEn = (indice: number) =>
    hueco && hueco.contenedor === contenedor && hueco.indice === indice ? <HuecoArrastre alto={alto} /> : null;

  return (
    <>
      {hijos.map((h) => {
        const fila = h.nodo.rowIndex;
        const active = c.seleccion === fila;
        const origen = c.arrastre?.fila === fila;
        if (h.tipo === "fila") {
          return (
            <Fragment key={fila}>
              {huecoEn(fila)}
              <OutlineRow
                node={h.nodo}
                contenedor={contenedor}
                active={active}
                origen={origen}
                enRecorrido={c.enRecorrido === fila}
                arrastrable={c.arrastrable}
                avisos={c.avisos?.get(fila)}
                canMoveUp={active && c.canMoveUp}
                canMoveDown={active && c.canMoveDown}
                onElegir={c.onElegir}
                onMoveUp={c.onMoveUp}
                onMoveDown={c.onMoveDown}
                onInsertar={c.onInsertar}
              />
            </Fragment>
          );
        }
        const abierta = !c.plegada(fila);
        return (
          <Fragment key={fila}>
            {huecoEn(fila)}
            <SeccionEstructura
              node={h.nodo}
              contenedor={contenedor}
              conteo={contarPiezas(h.hijos)}
              abierta={abierta}
              active={active}
              enRecorrido={c.enRecorrido === fila}
              arrastrable={c.arrastrable}
              origen={origen}
              avisos={c.avisos?.get(fila)}
              canMoveUp={active && c.canMoveUp}
              canMoveDown={active && c.canMoveDown}
              limite={active ? c.limite : undefined}
              onElegir={c.onElegir}
              onPlegar={c.onPlegar}
              onMoveUp={c.onMoveUp}
              onMoveDown={c.onMoveDown}
              onInsertar={c.onInsertar}
            >
              {abierta ? (
                h.hijos.length || hueco?.contenedor === fila ? (
                  <RamaEstructura hijos={h.hijos} contenedor={fila} finSlot={h.finSlot} />
                ) : (
                  <p className="xfe-seccion__vacia">Sin piezas todavía</p>
                )
              ) : null}
            </SeccionEstructura>
          </Fragment>
        );
      })}
      {huecoEn(finSlot)}
    </>
  );
}
