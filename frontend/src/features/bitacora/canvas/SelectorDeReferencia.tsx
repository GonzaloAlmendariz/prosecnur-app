import { useMemo, useState } from "react";
import { Flag, Search, X } from "../../../vendor/lucide-react";

import type { BitacoraEstado } from "../../../api/bitacora";
import type { BitacoraTipoDestino } from "../../../api/planTrabajo";
import { identidadDeDestino, piezasDeLaApp } from "../identidadDeFase";
import "./canvas.css";

export type ReferenciaElegida = {
  target_type: Extract<BitacoraTipoDestino, "modulo" | "tarea" | "entrada">;
  target_id: string;
  /**
   * Título al momento de insertar. No se usa para pintar el nodo —eso lo hace
   * `resumenVivo` en cada render— sino como respaldo: si borran el destino, el
   * nodo puede decir «apuntaba a Campo» en vez de escupir un uuid.
   */
  titulo: string;
};

/**
 * Elegir qué referenciar en el lienzo (ADR 0047).
 *
 * Una sola lista con las tres familias —piezas de la app, hitos y entradas—
 * porque el usuario piensa "quiero poner Validación acá", no "quiero insertar
 * un nodo de tipo referencia a módulo". La familia se muestra como contexto.
 *
 * Las piezas de la app van primero: son lo que convierte el lienzo en un mapa
 * del estudio en vez de en un pizarrón de notas sueltas.
 */
export function SelectorDeReferencia({
  estado,
  onElegir,
  onCerrar,
}: {
  estado: BitacoraEstado;
  onElegir: (ref: ReferenciaElegida) => void;
  onCerrar: () => void;
}) {
  const [texto, setTexto] = useState("");

  const candidatos = useMemo(() => {
    const q = normalizar(texto);
    const piezas = piezasDeLaApp().map((p) => ({
      clave: `modulo:${p.destino}`,
      tipo: "modulo" as const,
      id: p.destino,
      titulo: p.label,
      contexto: p.grupo === p.label ? "módulo" : `${p.grupo} · sección`,
      identidad: identidadDeDestino(p.destino),
    }));

    const hitos = estado.plan.tasks
      .filter((t) => !t.archived_at)
      .map((t) => ({
        clave: `tarea:${t.id}`,
        tipo: "tarea" as const,
        id: t.id,
        titulo: t.activity,
        contexto: t.start_date || "hito sin fecha",
        identidad: null,
      }));

    const entradas = estado.bitacora
      .filter((e) => !e.archived_at)
      .map((e) => ({
        clave: `entrada:${e.id}`,
        tipo: "entrada" as const,
        id: e.id,
        titulo: e.title,
        contexto: `bitácora · ${e.tone}`,
        identidad: null,
      }));

    return [...piezas, ...hitos, ...entradas]
      .filter((c) => !q || normalizar(`${c.titulo} ${c.contexto}`).includes(q))
      .slice(0, 60);
  }, [estado, texto]);

  return (
    <div className="bcanvas-selector" role="dialog" aria-label="Referenciar en el lienzo">
      <div className="bcanvas-selector-cabecera">
        <label className="bcanvas-selector-busqueda">
          <Search size={13} aria-hidden="true" />
          <span className="pulso-sr-only">Buscar una parte de la app, un hito o una entrada</span>
          <input
            autoFocus
            type="search"
            value={texto}
            placeholder="Módulo, sección, hito o entrada"
            onChange={(event) => setTexto(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") onCerrar();
              event.stopPropagation();
            }}
          />
        </label>
        <button type="button" onClick={onCerrar} aria-label="Cerrar">
          <X size={14} />
        </button>
      </div>

      {candidatos.length === 0 ? (
        <p className="bcanvas-selector-vacio">Nada calza con esa búsqueda.</p>
      ) : (
        <ul className="bcanvas-selector-lista">
          {candidatos.map((c) => {
            const Icono = c.identidad?.icono ?? null;
            return (
              <li key={c.clave}>
                <button
                  type="button"
                  style={c.identidad?.vars}
                  onClick={() => onElegir({ target_type: c.tipo, target_id: c.id, titulo: c.titulo })}
                >
                  <span className="bcanvas-selector-sello" aria-hidden="true">
                    {Icono ? <Icono size={13} /> : c.tipo === "tarea" ? <Flag size={12} /> : null}
                  </span>
                  <span className="bcanvas-selector-titulo">{c.titulo}</span>
                  <small>{c.contexto}</small>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function normalizar(v: string): string {
  return (v ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}
