import { useEffect, useId, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";

import { Variable } from "../../../vendor/lucide-react";

export type CampoDelMenu = {
  key: string;
  label: string;
  /** Cómo sale en la plataforma: `*|CARRERA|*`, `[CustomData1]`… */
  etiqueta: string;
  /** El dato de la persona que se mira, si hay uno. */
  ejemplo?: string;
};

type Props = {
  campos: readonly CampoDelMenu[];
  /** Posición en el espacio de la capa (debajo del cursor). */
  estilo: CSSProperties;
  onElegir: (key: string) => void;
  onCerrar: () => void;
};

function sinTildes(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/**
 * Menú de campos de cada persona (combobox). Lo abre escribir `{{` en el
 * editor en línea o el botón «Campo»; nunca deja `{{` literal en el texto.
 * Flechas, Enter y Escape; al elegir, el editor inserta el chip donde estaba
 * el cursor.
 */
export function MenuDeCampos({ campos, estilo, onElegir, onCerrar }: Props) {
  const id = useId();
  const [filtro, setFiltro] = useState("");
  const [activo, setActivo] = useState(0);
  const entrada = useRef<HTMLInputElement | null>(null);
  const raiz = useRef<HTMLDivElement | null>(null);
  const visibles = useMemo(() => {
    const q = sinTildes(filtro.trim());
    if (!q) return campos;
    return campos.filter((c) => sinTildes(c.label).includes(q) || c.key.includes(q));
  }, [campos, filtro]);

  // El foco no hace saltar el lienzo: el menú se asoma sólo lo necesario.
  useEffect(() => {
    entrada.current?.focus({ preventScroll: true });
    raiz.current?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  }, []);
  useEffect(() => { setActivo(0); }, [filtro]);

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActivo((i) => (visibles.length ? (i + 1) % visibles.length : 0));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActivo((i) => (visibles.length ? (i - 1 + visibles.length) % visibles.length : 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const elegido = visibles[activo];
      if (elegido) onElegir(elegido.key);
    } else if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onCerrar();
    } else if (event.key === "Tab") {
      onCerrar();
    }
  };

  return (
    <div ref={raiz} className="rec-capa-pop rec-capa-campos" style={estilo} role="dialog" aria-label="Insertar un campo de cada persona">
      <div className="rec-capa-pop-cabeza">
        <Variable size={14} aria-hidden />
        <span>Campo de cada persona</span>
      </div>
      <input
        ref={entrada}
        className="rec-capa-pop-buscar"
        role="combobox"
        aria-expanded="true"
        aria-controls={`${id}-lista`}
        aria-activedescendant={visibles[activo] ? `${id}-${visibles[activo].key}` : undefined}
        aria-autocomplete="list"
        aria-label="Buscar un campo"
        placeholder="Buscar: carrera, código…"
        value={filtro}
        onChange={(event) => setFiltro(event.target.value)}
        onKeyDown={onKeyDown}
      />
      <ul className="rec-capa-campos-lista" id={`${id}-lista`} role="listbox" aria-label="Campos">
        {visibles.map((c, i) => (
          <li
            key={c.key}
            id={`${id}-${c.key}`}
            role="option"
            aria-selected={i === activo}
            className={`rec-capa-campo${i === activo ? " is-activo" : ""}`}
            onMouseEnter={() => setActivo(i)}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => onElegir(c.key)}
          >
            <span className="rec-capa-campo-nombre">{c.label}</span>
            <code className="rec-capa-campo-clave">{`{{${c.key}}}`}</code>
            <span className="rec-capa-campo-etiqueta">{c.etiqueta || "sin equivalente"}</span>
            {c.ejemplo ? <span className="rec-capa-campo-ejemplo">{c.ejemplo}</span> : null}
          </li>
        ))}
        {!visibles.length ? <li className="rec-capa-campos-nada" role="presentation">Ningún campo se llama así. Los campos se declaran en «Destinatarios».</li> : null}
      </ul>
      <p className="rec-capa-pop-pie">Se ve teñido en la vista previa y cambia por persona al enviar.</p>
    </div>
  );
}
