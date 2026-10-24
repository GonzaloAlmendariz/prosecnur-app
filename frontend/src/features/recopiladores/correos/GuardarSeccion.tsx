// «Guardar sección» desde la barra del lienzo (GOAL editor profesional, L9;
// maqueta aprobada MisSecciones; ADR 0113): el nombre, lo que se guarda y el
// aviso de que usarla copia. Queda en «Mis secciones» de este estudio.

import { useEffect, useId, useRef, useState, type FormEvent } from "react";

import type { MailBlock } from "../../../api/materialMail";
import { PulsoButton } from "../../../components/PulsoButton";
import { Check } from "../../../vendor/lucide-react";
import { resumenDeBloque, rotuloDeBloque } from "./modeloCorreo";
import "./correosSecciones.css";

type Props = {
  block: MailBlock;
  /** Guarda y dice si se pudo (el error, si lo hay, lo muestra el store). */
  onGuardar: (name: string) => Promise<boolean>;
  onCerrar: () => void;
  error?: string | null;
};

const MAXIMO = 80;

/** El nombre que se sugiere: «Destacado · Sorteo de audífonos», recortado al tope. */
export function nombreSugerido(block: MailBlock): string {
  const resumen = resumenDeBloque(block).replace(/[[\]{}]/g, "").trim();
  const nombre = resumen ? `${rotuloDeBloque(block)} · ${resumen}` : rotuloDeBloque(block);
  return nombre.length > MAXIMO ? `${nombre.slice(0, MAXIMO - 1).trimEnd()}…` : nombre;
}

export function GuardarSeccion({ block, onGuardar, onCerrar, error = null }: Props) {
  const id = useId();
  const campo = useRef<HTMLInputElement | null>(null);
  const [nombre, setNombre] = useState(() => nombreSugerido(block));
  const [guardando, setGuardando] = useState(false);
  useEffect(() => { campo.current?.select(); }, []);

  const valido = nombre.trim().length > 0 && nombre.trim().length <= MAXIMO;
  const enviar = async (event: FormEvent) => {
    event.preventDefault();
    if (!valido || guardando) return;
    setGuardando(true);
    const ok = await onGuardar(nombre.trim());
    setGuardando(false);
    if (ok) onCerrar();
  };

  return (
    <form className="rec-capa-cambiar rec-sec-guardar" role="dialog" aria-label="Guardar sección" onSubmit={enviar}>
      <span className="rec-pieza-lado-titulo">Guardar sección</span>
      <label className="rec-sec-guardar-campo" htmlFor={`${id}-nombre`}>
        <span>Nombre</span>
        <input id={`${id}-nombre`} ref={campo} type="text" maxLength={MAXIMO} value={nombre} onChange={(e) => setNombre(e.target.value)} />
      </label>
      <span className="rec-sec-destino-ok"><Check size={12} aria-hidden /> Con su texto, imagen y estilo</span>
      <span className="rec-sec-destino-ok"><Check size={12} aria-hidden /> Los campos de persona, sin sus valores</span>
      {error ? <p className="rec-mail-problemas" role="alert">{error}</p> : null}
      <span className="rec-sec-agregar">
        <PulsoButton type="submit" variant="primary" size="sm" disabled={!valido || guardando}>
          {guardando ? "Guardando…" : "Guardar"}
        </PulsoButton>
        <PulsoButton type="button" variant="ghost" size="sm" onClick={onCerrar}>Cancelar</PulsoButton>
      </span>
      <p className="rec-capa-img-ayuda">Al usarla se copia: cambiarla después no toca los correos que ya la usan. Queda en «Mis secciones» de este estudio.</p>
    </form>
  );
}
