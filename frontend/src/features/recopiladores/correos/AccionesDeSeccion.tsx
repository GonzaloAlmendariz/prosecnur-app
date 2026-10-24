// Duplicar, Cambiar por y Estilo en la barra del bloque elegido del lienzo
// (GOAL editor profesional, L10; maqueta aprobada Barra). «Cambiar por» abre
// la misma lista que el inspector, con lo que queda guardado; «Estilo» abre la
// vista Estilo del inspector. «Guardar» (Mis secciones) espera a L9.

import { useEffect, useRef, useState } from "react";

import type { MailBlock, MailTemplate } from "../../../api/materialMail";
import { ArrowLeftRight, Copy, Palette } from "../../../vendor/lucide-react";
import { ListaDeDestinos } from "./CambiarPorSeccion";
import { puedeDuplicar } from "./estructuraCorreo";
import { admiteCaja } from "./modeloCaja";
import { esIntercambiable, type TipoIntercambiable } from "./modeloCambiarPor";

type Props = {
  template: MailTemplate;
  block: MailBlock;
  onDuplicar: (blockId: string) => void;
  onEditarBloque: (blockId: string, update: (b: MailBlock) => MailBlock) => void;
  onEstilo: (blockId: string) => void;
};

/** Cuántos botones suma a la barra (para estimar su ancho, `anchoDeLasAcciones`). */
export function botonesDeSeccion(template: MailTemplate, block: MailBlock | undefined): number {
  if (!block) return 0;
  return Number(puedeDuplicar(template, block.block_id)) + Number(esIntercambiable(block.type)) + Number(admiteCaja(block));
}

export function AccionesDeSeccion({ template, block, onDuplicar, onEditarBloque, onEstilo }: Props) {
  const [cambiando, setCambiando] = useState(false);
  const raiz = useRef<HTMLSpanElement | null>(null);

  // El menú se cierra con Escape o con un clic fuera.
  useEffect(() => {
    if (!cambiando) return;
    const fuera = (event: PointerEvent) => { if (!raiz.current?.contains(event.target as Node)) setCambiando(false); };
    const tecla = (event: KeyboardEvent) => { if (event.key === "Escape") setCambiando(false); };
    document.addEventListener("pointerdown", fuera, true);
    document.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("pointerdown", fuera, true);
      document.removeEventListener("keydown", tecla);
    };
  }, [cambiando]);

  return (
    <span ref={raiz} className="rec-capa-acciones-grupo">
      {puedeDuplicar(template, block.block_id) ? (
        <button type="button" className="rec-capa-accion" aria-label="Duplicar el bloque (⌘D)" title="Duplicar (⌘D)" onClick={() => onDuplicar(block.block_id)}>
          <Copy size={14} aria-hidden />
        </button>
      ) : null}
      {esIntercambiable(block.type) ? (
        <button
          type="button"
          className={`rec-capa-accion${cambiando ? " is-activa" : ""}`}
          aria-label="Cambiar por otra sección"
          aria-haspopup="dialog"
          aria-expanded={cambiando}
          title="Cambiar por"
          onClick={() => setCambiando(!cambiando)}
        >
          <ArrowLeftRight size={14} aria-hidden />
        </button>
      ) : null}
      {admiteCaja(block) ? (
        <button type="button" className="rec-capa-accion" aria-label="Estilo del bloque" title="Estilo" onClick={() => onEstilo(block.block_id)}>
          <Palette size={14} aria-hidden />
        </button>
      ) : null}
      {cambiando && esIntercambiable(block.type) ? (
        <div className="rec-capa-cambiar" role="dialog" aria-label="Cambiar por otra sección">
          <ListaDeDestinos
            block={block as MailBlock & { type: TipoIntercambiable }}
            onEditarBloque={(update) => onEditarBloque(block.block_id, update)}
            onElegido={() => setCambiando(false)}
          />
          <p className="rec-capa-img-ayuda">Lo que no se muestra queda guardado y vuelve al regresar. Se puede deshacer.</p>
        </div>
      ) : null}
    </span>
  );
}
