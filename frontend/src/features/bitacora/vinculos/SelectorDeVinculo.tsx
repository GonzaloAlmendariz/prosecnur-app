import { useMemo, useState } from "react";
import { Link2, Search } from "../../../vendor/lucide-react";

import type { BitacoraEstado } from "../../../api/bitacora";
import type { BitacoraRelacion, BitacoraVinculo } from "../../../api/planTrabajo";
import "./vinculos.css";

const RELACIONES: ReadonlyArray<{ id: BitacoraRelacion; label: string }> = [
  { id: "menciona", label: "menciona" },
  { id: "documenta", label: "documenta" },
  { id: "deriva_de", label: "deriva de" },
  { id: "bloquea", label: "bloquea" },
];

type Candidato = { tipo: "tarea" | "entrada"; id: string; titulo: string; contexto: string };

/**
 * Elegir con qué enlazar (ADR 0047).
 *
 * Busca sobre hitos y entradas en una sola lista porque el usuario piensa "esto
 * tiene que ver con aquello", no "quiero enlazar con una entidad de tipo hito".
 * El tipo se muestra como contexto, no como filtro previo.
 */
export function SelectorDeVinculo({
  estado,
  origenTipo,
  origenId,
  yaEnlazados,
  onElegir,
  onCerrar,
}: {
  estado: BitacoraEstado;
  origenTipo: string;
  origenId: string;
  yaEnlazados: ReadonlyArray<{ target_type: string; target_id: string }>;
  onElegir: (vinculo: BitacoraVinculo) => void;
  onCerrar: () => void;
}) {
  const [texto, setTexto] = useState("");
  const [relacion, setRelacion] = useState<BitacoraRelacion>("menciona");

  const candidatos = useMemo<Candidato[]>(() => {
    const propia = `${origenTipo}:${origenId}`;
    const ocupados = new Set(yaEnlazados.map((v) => `${v.target_type}:${v.target_id}`));

    const hitos: Candidato[] = estado.plan.tasks
      .filter((t) => !t.archived_at)
      .map((t) => ({
        tipo: "tarea" as const,
        id: t.id,
        titulo: t.activity,
        contexto: t.start_date || "sin fecha",
      }));

    const entradas: Candidato[] = estado.bitacora
      .filter((e) => !e.archived_at)
      .map((e) => ({
        tipo: "entrada" as const,
        id: e.id,
        titulo: e.title,
        contexto: (e.occurred_at || "").slice(0, 10),
      }));

    const q = normalizar(texto);
    return [...hitos, ...entradas]
      .filter((c) => `${c.tipo}:${c.id}` !== propia)
      .filter((c) => !ocupados.has(`${c.tipo}:${c.id}`))
      .filter((c) => !q || normalizar(c.titulo).includes(q))
      .slice(0, 40);
  }, [estado, origenTipo, origenId, yaEnlazados, texto]);

  return (
    <div className="bit-selector" role="dialog" aria-label="Enlazar con">
      <div className="bit-selector-cabecera">
        <label className="bit-selector-busqueda">
          <Search size={13} aria-hidden="true" />
          <span className="pulso-sr-only">Buscar hito o entrada</span>
          <input
            autoFocus
            type="search"
            value={texto}
            placeholder="Buscar hito o entrada"
            onChange={(event) => setTexto(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") onCerrar();
            }}
          />
        </label>
        <label className="bit-selector-relacion">
          <span className="pulso-sr-only">Tipo de relación</span>
          <select value={relacion} onChange={(event) => setRelacion(event.target.value as BitacoraRelacion)}>
            {RELACIONES.map((r) => (
              <option key={r.id} value={r.id}>{r.label}</option>
            ))}
          </select>
        </label>
      </div>

      {candidatos.length === 0 ? (
        <p className="bit-selector-vacio">
          {texto
            ? "Nada calza con esa búsqueda."
            : "No queda nada con qué enlazar: o ya está enlazado, o el proyecto todavía no tiene hitos ni entradas."}
        </p>
      ) : (
        <ul className="bit-selector-lista">
          {candidatos.map((c) => (
            <li key={`${c.tipo}:${c.id}`}>
              <button
                type="button"
                onClick={() =>
                  onElegir({ target_type: c.tipo, target_id: c.id, relation: relacion })
                }
              >
                <Link2 size={12} aria-hidden="true" />
                <span className="bit-selector-titulo">{c.titulo}</span>
                <small>{c.tipo === "tarea" ? "hito" : "bitácora"} · {c.contexto}</small>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function normalizar(v: string): string {
  return (v ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}
