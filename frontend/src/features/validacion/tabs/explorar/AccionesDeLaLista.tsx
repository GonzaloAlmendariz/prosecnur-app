import { ChevronsDownUp, ChevronsUpDown, Search } from "../../../../vendor/lucide-react";
import { PulsoButton } from "../../../../components/PulsoButton";
import type { ExploradorSeccion } from "../../types";
import { plegadasAlComprimir, todasAbiertas } from "./listaDePreguntasModelo";
import { useEstadoDeLaLista, useListaDePreguntasStore } from "./listaDePreguntasStore";

/** Id del campo de búsqueda de la lista, para `aria-controls` y para devolver el foco a la lupa. */
export const ID_BUSCADOR_DE_PREGUNTAS = "vx-buscador-preguntas";
export const ID_LUPA_DE_PREGUNTAS = "vx-lupa-preguntas";

/**
 * Los controles de la cabecera de "Preguntas": la lupa que abre el buscador y
 * el botón que expande o comprime todas las secciones (ítem 38).
 */
export default function AccionesDeLaLista({
  base,
  secciones,
  elegida,
}: {
  /** Clave del estado de la lista (la base explorada). */
  base: string;
  secciones: readonly ExploradorSeccion[];
  elegida: string | null;
}) {
  const { buscando, plegadas } = useEstadoDeLaLista(base);
  const abrirBuscador = useListaDePreguntasStore((s) => s.abrirBuscador);
  const cerrarBuscador = useListaDePreguntasStore((s) => s.cerrarBuscador);
  const fijarPlegadas = useListaDePreguntasStore((s) => s.fijarPlegadas);
  const abiertas = todasAbiertas(secciones, plegadas);
  const accion = abiertas ? "Comprimir todas" : "Expandir todas";

  return (
    <span className="vx-lista-acciones">
      <PulsoButton
        variant="icon"
        id={ID_LUPA_DE_PREGUNTAS}
        aria-label="Buscar preguntas"
        title="Buscar preguntas"
        aria-pressed={buscando}
        aria-controls={buscando ? ID_BUSCADOR_DE_PREGUNTAS : undefined}
        className={buscando ? "vx-lupa is-activa" : "vx-lupa"}
        disabled={!secciones.length}
        onClick={() => (buscando ? cerrarBuscador(base) : abrirBuscador(base))}
      >
        <Search size={16} aria-hidden />
      </PulsoButton>
      <PulsoButton
        variant="icon"
        aria-label={accion}
        title={accion}
        disabled={!secciones.length}
        onClick={() => fijarPlegadas(base, abiertas ? plegadasAlComprimir(secciones, elegida) : [])}
      >
        {abiertas ? <ChevronsDownUp size={16} aria-hidden /> : <ChevronsUpDown size={16} aria-hidden />}
      </PulsoButton>
    </span>
  );
}
