// Cabecera de la ficha (C11, C19, C20): el sello, el tipo (que se cambia aquí mismo, avisando si la lista queda sin
// uso), dónde está la pieza, su código y las acciones: mover, duplicar, llevar a otra sección y eliminar.

import { useRef, useState, type CSSProperties } from "react";
import { ArrowDown, ArrowRightLeft, ArrowUp, ChevronDown, Copy, Trash2 } from "../../../../vendor/lucide-react";
import { Sello, TIPOS_PREGUNTA, TONO_FAMILIA, tipoPregunta } from "../../kit";
import { seccionesDestino, type SeccionDestino } from "../../state/accionesConstructor";
import { corto } from "../../kit/CuerpoPanelMarca";
import { etiquetaDeGrupo } from "../../logic";
import type { DatosFicha } from "./tiposFicha";
import { MenuFlotante } from "./MenuFlotante";
import { listaQueSePierde } from "./modeloFicha";
import type { BuilderNode, BuilderStructure } from "../../types";

/** Tipos a los que puede pasar una pregunta, nota o cálculo (las secciones cambian en «Se repite»). */
const CAMBIABLES = TIPOS_PREGUNTA.filter((t) => t.grupo !== "metadato" && (t.grupo !== "estructura" || t.base === "note" || t.base === "calculate"));

export type CabeceraFichaProps = {
  node: BuilderNode;
  /** Dónde está: «Pregunta 12 · en «Datos del hogar»». */
  posicion: string;
  usosDeLaLista: number;
  destinos: SeccionDestino[];
  puedeSubir: boolean;
  puedeBajar: boolean;
  onTipo?: (base: string) => void;
  onMover: (dir: "up" | "down") => void;
  onDuplicar: () => void;
  onMoverASeccion: (fila: number | null) => void;
  onEliminar: () => void;
};

export function CabeceraFicha({ node, posicion, usosDeLaLista, destinos, puedeSubir, puedeBajar, onTipo, onMover, onDuplicar, onMoverASeccion, onEliminar }: CabeceraFichaProps) {
  const base = node.kind === "repeat" ? "begin_repeat" : node.kind === "section" ? "begin_group" : node.typeInfo.base;
  const tipo = tipoPregunta(base);
  const [menu, setMenu] = useState<"tipo" | "mover" | null>(null);
  const [pendiente, setPendiente] = useState<string | null>(null);
  const botonTipo = useRef<HTMLButtonElement | null>(null);
  const botonMover = useRef<HTMLButtonElement | null>(null);
  const cerrar = () => setMenu(null);
  const pierde = pendiente ? listaQueSePierde(node, pendiente, usosDeLaLista) : null;

  const elegirTipo = (nuevo: string) => {
    setMenu(null);
    if (nuevo === base) return;
    if (listaQueSePierde(node, nuevo, usosDeLaLista)) setPendiente(nuevo);
    else onTipo?.(nuevo);
  };

  return (
    <header className="xfh-cab">
      <Sello baseType={base} size={44} />
      <div className="xfh-cab__txt">
        {onTipo ? (
          <span className="xfh-cab__tipo-wrap">
            <button
              ref={botonTipo}
              type="button"
              className="xfh-cab__tipo"
              style={{ "--xfh-c": TONO_FAMILIA[tipo.familia] } as CSSProperties}
              aria-haspopup="menu"
              aria-expanded={menu === "tipo"}
              title="Cambiar el tipo"
              onClick={() => setMenu((m) => (m === "tipo" ? null : "tipo"))}
            >
              {tipo.nombre}
              <ChevronDown size={12} aria-hidden="true" />
            </button>
            {menu === "tipo" ? (
              <MenuFlotante ancla={botonTipo} etiqueta="Cambiar el tipo" onCerrar={cerrar}>
                {CAMBIABLES.map((t) => (
                  <button key={t.base} type="button" role="menuitemradio" aria-checked={t.base === base} className="xfh-menu__item" onClick={() => elegirTipo(t.base)}>
                    <Sello baseType={t.base} size={18} />
                    <span>{t.nombre}</span>
                  </button>
                ))}
              </MenuFlotante>
            ) : null}
          </span>
        ) : (
          <span className="xfh-cab__tipo is-fijo" style={{ "--xfh-c": TONO_FAMILIA[tipo.familia] } as CSSProperties}>{tipo.nombre}</span>
        )}
        <span className="xfh-cab__pos">{posicion}</span>
      </div>
      <div className="xfh-cab__der">
        {node.name ? <code className="xfh-cab__code" title="Código en la base">{node.name}</code> : null}
        <div className="xfh-cab__acc" role="group" aria-label="Acciones">
          <button type="button" className="xfh-icono" onClick={() => onMover("up")} disabled={!puedeSubir} aria-label="Subir un lugar" title="Subir un lugar"><ArrowUp size={14} aria-hidden="true" /></button>
          <button type="button" className="xfh-icono" onClick={() => onMover("down")} disabled={!puedeBajar} aria-label="Bajar un lugar" title="Bajar un lugar"><ArrowDown size={14} aria-hidden="true" /></button>
          <button type="button" className="xfh-icono" onClick={onDuplicar} aria-label="Duplicar" title="Duplicar"><Copy size={14} aria-hidden="true" /></button>
          <span className="xfh-cab__mover">
            <button
              ref={botonMover}
              type="button"
              className="xfh-icono"
              disabled={destinos.length === 0}
              aria-haspopup="menu"
              aria-expanded={menu === "mover"}
              aria-label="Mover a otra sección"
              title="Mover a otra sección"
              onClick={() => setMenu((m) => (m === "mover" ? null : "mover"))}
            >
              <ArrowRightLeft size={14} aria-hidden="true" />
            </button>
            {menu === "mover" ? (
              <MenuFlotante ancla={botonMover} etiqueta="Mover a otra sección" onCerrar={cerrar} alinear="fin">
                <span className="xfh-menu__tit" aria-hidden="true">Mover al final de</span>
                {destinos.map((d) => (
                  <button
                    key={d.rowIndex ?? "raiz"}
                    type="button"
                    role="menuitem"
                    className="xfh-menu__item"
                    style={{ paddingInlineStart: `${10 + Math.min(d.profundidad, 4) * 12}px` }}
                    onClick={() => { setMenu(null); onMoverASeccion(d.rowIndex); }}
                  >
                    <Sello baseType="begin_group" size={16} />
                    <span>{d.etiqueta}</span>
                  </button>
                ))}
              </MenuFlotante>
            ) : null}
          </span>
          <button type="button" className="xfh-icono is-peligro" onClick={onEliminar} aria-label="Eliminar" title="Eliminar"><Trash2 size={14} aria-hidden="true" /></button>
        </div>
      </div>
      {pierde && pendiente ? (
        <div className="xfh-cab__aviso" role="alert">
          <p>
            Al pasar a «{tipoPregunta(pendiente).nombre}» la pregunta deja de usar la lista <code className="xfh-code">{pierde.lista}</code>.{" "}
            {pierde.quedaSinUso ? "Ninguna otra pregunta la usa, pero sigue en Listas de opciones." : `La siguen usando ${usosDeLaLista - 1} preguntas.`}
          </p>
          <div className="xfh-cab__aviso-acc">
            <button type="button" className="xfh-boton is-primario" onClick={() => { onTipo?.(pendiente); setPendiente(null); }}>Cambiar a {tipoPregunta(pendiente).nombre}</button>
            <button type="button" className="xfh-boton" onClick={() => setPendiente(null)}>Cancelar</button>
          </div>
        </div>
      ) : null}
    </header>
  );
}

/** Cabecera armada con los datos comunes de la ficha. */
export function CabeceraDesdeDatos({ datos, posicion, conTipo }: { datos: DatosFicha; posicion: string; conTipo: boolean }) {
  const { node, structure, usosPorLista, acciones } = datos;
  const destinos = structure ? seccionesDestino(structure, node.rowIndex) : [];
  return (
    <CabeceraFicha
      node={node}
      posicion={posicion}
      usosDeLaLista={usosPorLista.get(node.typeInfo.listName) ?? 0}
      destinos={destinos}
      puedeSubir={acciones.puedeSubir}
      puedeBajar={acciones.puedeBajar}
      onTipo={conTipo ? acciones.tipo : undefined}
      onMover={acciones.mover}
      onDuplicar={acciones.duplicar}
      onMoverASeccion={acciones.moverASeccion}
      onEliminar={acciones.eliminar}
    />
  );
}

/** «en «Datos del hogar»» para la sección que contiene la pieza; vacío si está fuera de toda sección. */
export function dondeEsta(node: BuilderNode, structure: BuilderStructure | null): string {
  if (!structure) return "";
  const propia = structure.sections.get(`section-${node.rowIndex}`);
  const id = propia ? propia.parentId : structure.rowToSectionId.get(node.rowIndex) ?? node.sectionId;
  const meta = id ? structure.sections.get(id) : undefined;
  if (!meta || meta.kind === "root") return "fuera de toda sección";
  return `en «${corto(etiquetaDeGrupo(meta, structure), 40)}»`;
}
