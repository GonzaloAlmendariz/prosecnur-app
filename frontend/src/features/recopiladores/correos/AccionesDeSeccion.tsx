// Duplicar, Cambiar por y Estilo en la barra del bloque elegido del lienzo
// (GOAL editor profesional, L10; maqueta aprobada Barra). «Cambiar por» abre
// la misma lista que el inspector, con lo que queda guardado; «Estilo» abre la
// vista Estilo del inspector; «Guardar» la deja en «Mis secciones» del estudio
// (L9, ADR 0113).

import { useEffect, useRef, useState } from "react";

import { useMisSecciones } from "./misSeccionesStore";

import type { MailBlock, MailTemplate } from "../../../api/materialMail";
import { ArrowLeftRight, Bookmark, Copy, Palette } from "../../../vendor/lucide-react";
import { ListaDeDestinos } from "./CambiarPorSeccion";
import { GuardarSeccion } from "./GuardarSeccion";
import { puedeDuplicar } from "./estructuraCorreo";
import { admiteCaja } from "./modeloCaja";
import { esIntercambiable, type TipoIntercambiable } from "./modeloCambiarPor";

type Props = {
  template: MailTemplate;
  block: MailBlock;
  onDuplicar: (blockId: string) => void;
  onEditarBloque: (blockId: string, update: (b: MailBlock) => MailBlock) => void;
  onEstilo: (blockId: string) => void;
  /** «Guardar» en Mis secciones (L9); sin ella, la barra no lo ofrece. */
  onGuardarSeccion?: (blockId: string, name: string) => Promise<boolean>;
  errorAlGuardar?: string | null;
};

/** Cuántos botones suma a la barra (para estimar su ancho, `anchoDeLasAcciones`). */
export function botonesDeSeccion(template: MailTemplate, block: MailBlock | undefined, conGuardar = false): number {
  if (!block) return 0;
  return Number(puedeDuplicar(template, block.block_id)) + Number(esIntercambiable(block.type)) + Number(admiteCaja(block)) * (conGuardar ? 2 : 1);
}

export function AccionesDeSeccion({ template, block, onDuplicar, onEditarBloque, onEstilo, onGuardarSeccion, errorAlGuardar = null }: Props) {
  const [abierto, setAbierto] = useState<"cambiar" | "guardar" | null>(null);
  const cambiando = abierto === "cambiar";
  const setCambiando = (v: boolean) => setAbierto(v ? "cambiar" : null);
  const raiz = useRef<HTMLSpanElement | null>(null);
  const botonGuardar = useRef<HTMLButtonElement | null>(null);
  const limpiarError = useMisSecciones((s) => s.limpiarError);
  // Al cerrar «Guardar sección» el foco vuelve a su botón (no se pierde en el documento).
  const cerrarGuardar = () => { setAbierto(null); botonGuardar.current?.focus(); };

  // El menú se cierra con Escape o con un clic fuera.
  useEffect(() => {
    if (!abierto) return;
    const fuera = (event: PointerEvent) => { if (!raiz.current?.contains(event.target as Node)) setAbierto(null); };
    const tecla = (event: KeyboardEvent) => { if (event.key === "Escape") { if (abierto === "guardar") botonGuardar.current?.focus(); setAbierto(null); } };
    document.addEventListener("pointerdown", fuera, true);
    document.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("pointerdown", fuera, true);
      document.removeEventListener("keydown", tecla);
    };
  }, [abierto]);

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
      {admiteCaja(block) && onGuardarSeccion ? (
        <button
          type="button"
          className={`rec-capa-accion${abierto === "guardar" ? " is-activa" : ""}`}
          ref={botonGuardar}
          aria-label="Guardar en Mis secciones"
          aria-haspopup="dialog"
          aria-expanded={abierto === "guardar"}
          title="Guardar en Mis secciones"
          onClick={() => {
            // Un error de otra acción (borrar en la biblioteca) no se arrastra a este formulario.
            if (abierto !== "guardar") limpiarError();
            setAbierto(abierto === "guardar" ? null : "guardar");
          }}
        >
          <Bookmark size={14} aria-hidden />
        </button>
      ) : null}
      {abierto === "guardar" && onGuardarSeccion ? (
        <GuardarSeccion block={block} error={errorAlGuardar} onGuardar={(name) => onGuardarSeccion(block.block_id, name)} onCerrar={cerrarGuardar} />
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
