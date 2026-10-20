// Respuesta de la pregunta en la ficha (C5, C6, C8). La ficha NO edita listas: muestra la lista elegida entera, deja
// cambiarla por otra o crear una nueva, y lleva a «Listas de opciones» para editarla. Si el formulario todavía no
// tiene listas, explica en dos líneas cómo funcionan.

import { useMemo, useState } from "react";
import { Search } from "../../../../vendor/lucide-react";
import { Sello, tipoPregunta } from "../../kit";
import type { BuilderNode, CatalogSummary, ChoiceItem } from "../../types";
import { esSeleccion, plural } from "./modeloFicha";
import { BotonIr, EnlaceIr } from "./piezasFicha";

/** Hasta aquí la lista se muestra entera; más larga, se abre a pedido. */
const VISIBLES = 24;

export type RespuestaFichaProps = {
  node: BuilderNode;
  choices: ChoiceItem[];
  catalogs: CatalogSummary[];
  usosDeLaLista: number;
  onAsignarLista: (lista: string) => void;
  onCrearLista: () => void;
  onIrListas: (lista: string | null) => void;
};

export function RespuestaFicha({ node, choices, catalogs, usosDeLaLista, onAsignarLista, onCrearLista, onIrListas }: RespuestaFichaProps) {
  const base = node.typeInfo.base;
  const [eligiendo, setEligiendo] = useState(false);
  const [todas, setTodas] = useState(false);
  if (!esSeleccion(base)) return <RespuestaCampo base={base} />;

  const lista = node.typeInfo.listName;
  const conOpciones = catalogs.filter((c) => c.items.length > 0);
  const elegir = eligiendo ? (
    <ElegirLista catalogs={conOpciones} actual={lista} onElegir={(l) => { onAsignarLista(l); setEligiendo(false); }} onCerrar={() => setEligiendo(false)} />
  ) : null;
  const vacia = !lista || choices.length === 0;
  const acciones = (
    <div className={vacia ? "xfh-acciones" : "xfh-lista__acc xfh-acciones"}>
      {conOpciones.length > 0 ? (
        <button type="button" className="xfh-boton" aria-expanded={eligiendo} onClick={() => setEligiendo((v) => !v)}>
          {lista ? "Cambiar de lista" : "Usar una lista existente"}
        </button>
      ) : null}
      <button type="button" className="xfh-boton" onClick={onCrearLista}>Crear lista nueva</button>
      {vacia && lista ? <BotonIr onClick={() => onIrListas(lista)}>Agregar opciones</BotonIr> : null}
    </div>
  );

  if (vacia) {
    const primera = conOpciones.length === 0;
    return (
      <div className="xfh-primera">
        <Sello baseType={base} size={22} />
        <div>
          <b>{lista ? `La lista «${lista}» todavía no tiene opciones` : "Esta pregunta necesita su lista de opciones"}</b>
          <p>
            {primera
              ? "Una lista guarda las respuestas posibles con un código para la base y un texto para el encuestado. Varias preguntas pueden usar la misma lista, como «Sí / No»."
              : "Elige una de las listas del formulario o crea una nueva. Las opciones se escriben en «Listas de opciones»."}
          </p>
          <div className="xfh-primera__acc">{acciones}</div>
          {elegir}
        </div>
      </div>
    );
  }

  const visibles = todas ? choices : choices.slice(0, VISIBLES);
  const ocultas = choices.length - visibles.length;
  return (
    <div className="xfh-lista">
      <div className="xfh-lista__cab">
        <Sello baseType={base} size={18} />
        <div className="xfh-lista__nom">
          <b>{lista}</b>
          <small>
            {plural(choices.length, "opción", "opciones")}
            {usosDeLaLista > 1 ? ` · la usan ${usosDeLaLista} preguntas` : " · sólo esta pregunta la usa"}
          </small>
        </div>
        <EnlaceIr onClick={() => onIrListas(lista)}>Editar en Listas de opciones</EnlaceIr>
      </div>
      <ul className="xfh-opciones" aria-label={`Opciones de ${lista}`} data-qa-geometry-group="xlsform/ficha-opciones" data-qa-geometry-contract="intrinsic">
        {visibles.map((o) => (
          <li key={o.rowIndex} data-qa-geometry-member="">
            <code>{o.name}</code>
            <span>{o.label || o.name}</span>
          </li>
        ))}
      </ul>
      {ocultas > 0 ? (
        <button type="button" className="xfh-lista__mas" onClick={() => setTodas(true)}>Mostrar las {choices.length} opciones</button>
      ) : null}
      {acciones}
      {elegir}
    </div>
  );
}

function RespuestaCampo({ base }: { base: string }) {
  return (
    <div className="xfh-respuesta-campo">
      <span className="xfh-input-falso" aria-hidden="true" />
      <small>{tipoPregunta(base).nombre}. Lo que acepta está en Reglas.</small>
    </div>
  );
}

function ElegirLista({ catalogs, actual, onElegir, onCerrar }: { catalogs: CatalogSummary[]; actual: string; onElegir: (l: string) => void; onCerrar: () => void }) {
  const [q, setQ] = useState("");
  const candidatas = useMemo(() => {
    const t = q.trim().toLowerCase();
    return catalogs
      .filter((c) => c.listName !== actual)
      .filter((c) => !t || c.listName.toLowerCase().includes(t) || c.title.toLowerCase().includes(t) || c.items.some((i) => i.label.toLowerCase().includes(t)));
  }, [catalogs, actual, q]);
  return (
    <div className="xfh-elegir" onKeyDown={(e) => { if (e.key === "Escape") { e.stopPropagation(); onCerrar(); } }}>
      <label className="xfh-elegir__buscar">
        <Search size={13} aria-hidden="true" />
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre u opción" aria-label="Buscar lista" />
      </label>
      <ul className="xfh-elegir__lista" aria-label="Listas del formulario">
        {candidatas.slice(0, 40).map((c) => (
          <li key={c.listName}>
            <button type="button" onClick={() => onElegir(c.listName)}>
              <span className="xfh-elegir__txt"><b>{c.listName}</b> · {c.items.map((i) => i.label || i.name).join(", ")}</span>
              <span className="xfh-elegir__n">{c.items.length}</span>
            </button>
          </li>
        ))}
        {candidatas.length === 0 ? <li className="xfh-elegir__vacio">Ninguna lista coincide.</li> : null}
      </ul>
    </div>
  );
}
