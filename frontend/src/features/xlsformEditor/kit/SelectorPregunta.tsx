import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ChevronDown, Search } from "../../../vendor/lucide-react";
import { TypeIcon } from "./TypeIcon";
import "./kit.css";

// Selector de pregunta del módulo (F3, 2026-10-16): lista buscable con el ícono del tipo, el número y el texto de
// cada pregunta. Reemplaza al <select> nativo, que no puede mostrar íconos ni buscar en formularios de 200 preguntas.

export type OpcionPregunta = { valor: string; numero: string; texto: string; baseType: string };

type Props = {
  opciones: readonly OpcionPregunta[];
  valor: string;
  onCambio: (valor: string) => void;
  placeholder: string;
  etiqueta: string;
  deshabilitado?: boolean;
};

export function SelectorPregunta({ opciones, valor, onCambio, placeholder, etiqueta, deshabilitado }: Props) {
  const id = useId();
  const [abierto, setAbierto] = useState(false);
  const [busca, setBusca] = useState("");
  const raiz = useRef<HTMLDivElement>(null);
  const elegida = opciones.find((o) => o.valor === valor) ?? null;
  const visibles = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return q ? opciones.filter((o) => `${o.numero} ${o.texto}`.toLowerCase().includes(q)) : opciones;
  }, [opciones, busca]);

  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: MouseEvent) => { if (!raiz.current?.contains(e.target as Node)) setAbierto(false); };
    document.addEventListener("mousedown", fuera);
    return () => document.removeEventListener("mousedown", fuera);
  }, [abierto]);

  const elegir = (v: string) => { onCambio(v); setAbierto(false); setBusca(""); };

  return (
    <div ref={raiz} className={abierto ? "xfk-selpreg is-abierto" : "xfk-selpreg"}>
      <button type="button" className="xfk-selpreg__boton" aria-label={etiqueta} aria-haspopup="listbox" aria-expanded={abierto}
        aria-controls={`${id}-lista`} disabled={deshabilitado} onClick={() => setAbierto((a) => !a)}>
        {elegida ? (
          <span className="xfk-selpreg__elegida">
            <TypeIcon baseType={elegida.baseType} size={14} />
            <b>{elegida.numero}</b>
            <span>{elegida.texto}</span>
          </span>
        ) : <span className="xfk-selpreg__vacio">{placeholder}</span>}
        <ChevronDown size={14} aria-hidden="true" />
      </button>
      {abierto ? (
        <div className="xfk-selpreg__panel">
          <label className="xfk-selpreg__busca">
            <Search size={13} aria-hidden="true" />
            <input autoFocus value={busca} placeholder="Buscar por número o texto" aria-label="Buscar pregunta"
              onChange={(e) => setBusca(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Escape") setAbierto(false); if (e.key === "Enter" && visibles[0]) elegir(visibles[0].valor); }} />
          </label>
          <ul id={`${id}-lista`} role="listbox" aria-label={etiqueta} className="xfk-selpreg__lista">
            {visibles.length ? visibles.map((o) => (
              <li key={o.valor} role="option" aria-selected={o.valor === valor}>
                <button type="button" className={o.valor === valor ? "xfk-selpreg__op is-on" : "xfk-selpreg__op"} onClick={() => elegir(o.valor)}>
                  <TypeIcon baseType={o.baseType} size={13} />
                  <b>{o.numero}</b>
                  <span>{o.texto}</span>
                </button>
              </li>
            )) : <li className="xfk-selpreg__nada">Ninguna pregunta coincide.</li>}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
