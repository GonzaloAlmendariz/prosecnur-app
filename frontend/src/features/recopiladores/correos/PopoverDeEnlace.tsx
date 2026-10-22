import { useEffect, useId, useRef, useState, type CSSProperties, type FormEvent, type KeyboardEvent } from "react";

import { PulsoButton } from "../../../components/PulsoButton";
import { Link2, Unlink } from "../../../vendor/lucide-react";

type Props = {
  /** URL actual (al editar un enlace que ya existe). */
  url: string;
  /** Texto seleccionado; vacío si se inserta un enlace nuevo en el cursor. */
  texto: string;
  /** ¿Se edita un enlace existente? Ofrece «Quitar el enlace». */
  existente: boolean;
  estilo: CSSProperties;
  onAplicar: (url: string, texto: string) => void;
  onQuitar: () => void;
  onCerrar: () => void;
};

/** https://, http://, mailto: o una URL que empieza con un campo (`{{enlace}}`). */
export function problemaDeUrl(url: string): string | null {
  const u = url.trim();
  if (!u) return "Escribe la dirección del enlace.";
  if (/\s/.test(u)) return "La dirección no lleva espacios.";
  if (/[()]/.test(u)) return "La dirección no puede llevar paréntesis.";
  if (/^\{\{\s*[a-z][a-z0-9_]*\s*\}\}/.test(u)) return null;
  if (/^(https?:\/\/[^/\s]+|mailto:[^\s@]+@[^\s@]+)/i.test(u)) return null;
  return "Empieza con https://, mailto: o un campo de cada persona, como el enlace a la encuesta.";
}

/**
 * Enlace dentro del texto (`[texto](url)`): Cmd+K en el editor en línea, o el
 * botón de su barra. Sólo existe en las propiedades que el render admite
 * (párrafo, recuadro, lista, firma y pie).
 */
export function PopoverDeEnlace({ url, texto, existente, estilo, onAplicar, onQuitar, onCerrar }: Props) {
  const id = useId();
  const [valor, setValor] = useState(url || "https://");
  const [rotulo, setRotulo] = useState(texto);
  const [intento, setIntento] = useState(false);
  const entrada = useRef<HTMLInputElement | null>(null);
  const raiz = useRef<HTMLFormElement | null>(null);
  const problema = problemaDeUrl(valor);
  const sinTexto = !texto && !rotulo.trim();

  useEffect(() => {
    entrada.current?.focus({ preventScroll: true });
    entrada.current?.select();
    raiz.current?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  }, []);

  const aplicar = (event: FormEvent) => {
    event.preventDefault();
    setIntento(true);
    if (problema || sinTexto) return;
    onAplicar(valor.trim(), texto || rotulo.trim());
  };

  const onKeyDown = (event: KeyboardEvent<HTMLFormElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onCerrar();
    }
  };

  return (
    <form ref={raiz} className="rec-capa-pop rec-capa-enlace-pop" style={estilo} onSubmit={aplicar} onKeyDown={onKeyDown} aria-label="Enlace del texto">
      <div className="rec-capa-pop-cabeza">
        <Link2 size={14} aria-hidden />
        <span>{existente ? "Editar el enlace" : "Enlazar"}</span>
        {texto ? <span className="rec-capa-pop-cita">«{texto.length > 32 ? `${texto.slice(0, 32)}…` : texto}»</span> : null}
      </div>
      {!texto ? (
        <label className="rec-capa-pop-campo" htmlFor={`${id}-texto`}>
          <span>Texto que se lee</span>
          <input id={`${id}-texto`} value={rotulo} onChange={(e) => setRotulo(e.target.value)} placeholder="aquí" />
        </label>
      ) : null}
      <label className="rec-capa-pop-campo" htmlFor={`${id}-url`}>
        <span>Dirección</span>
        <input
          ref={entrada}
          id={`${id}-url`}
          className="is-mono"
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          aria-invalid={intento && Boolean(problema) ? true : undefined}
          aria-describedby={`${id}-ayuda`}
          spellCheck={false}
        />
      </label>
      <p id={`${id}-ayuda`} className={`rec-capa-pop-ayuda${intento && (problema || sinTexto) ? " is-error" : ""}`} role={intento && problema ? "alert" : undefined}>
        {intento && sinTexto ? "Escribe el texto del enlace." : intento && problema ? problema : "Puede llevar campos de cada persona, como su código."}
      </p>
      <div className="rec-capa-pop-acciones">
        {existente ? (
          <PulsoButton variant="ghost" size="sm" onClick={onQuitar}>
            <Unlink size={14} aria-hidden /> Quitar el enlace
          </PulsoButton>
        ) : <span />}
        <span className="rec-capa-pop-acciones-fin">
          <PulsoButton variant="secondary" size="sm" onClick={onCerrar}>Cancelar</PulsoButton>
          <PulsoButton variant="primary" size="sm" type="submit">Aplicar</PulsoButton>
        </span>
      </div>
    </form>
  );
}
