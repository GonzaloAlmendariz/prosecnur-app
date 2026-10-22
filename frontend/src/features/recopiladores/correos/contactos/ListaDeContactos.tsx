// La lista de contactos, paginada en el backend: correo, nombre, las columnas
// de control primero, estado, enlace y si respondió. La búsqueda, el estado,
// la respuesta y los filtros del tablero se aplican allá; aquí solo se pinta
// la página que llegó.
//
// No es dueña de scroll vertical: crece con su página (50 filas) dentro del
// panel, que es el único dueño. Las columnas que no caben se desplazan en
// horizontal dentro de la tabla, con la sombra que avisa que hay más.

import type { ColumnaDeContactos, FiltroDeEstado, FiltroDeRespuesta, PaginaDeContactos } from "../../../../api/mailContactos";
import { PulsoButton } from "../../../../components/PulsoButton";
import { formatoConteoDe } from "../../../../lib/formatoNumero";
import { ChevronLeft, ChevronRight, Search, Users } from "../../../../vendor/lucide-react";
import { TableScroll } from "../../TableScroll";
import { ETIQUETA_DE_ESTADO, columnasDeLaLista, paginas, rangoDePagina } from "./modeloContactos";
import { useContactosStore } from "./store";

type Props = {
  lista: PaginaDeContactos | null;
  control: readonly string[];
  respuestasLeidas: boolean;
  cargando: boolean;
  error: string;
  conFiltros: boolean;
};

const ESTADOS: { id: FiltroDeEstado; label: string }[] = [
  { id: "todos", label: "Todos los estados" },
  { id: "efectivo", label: "Efectivos" },
  { id: "sin_correo", label: "Sin correo" },
  { id: "correo_invalido", label: "Correo inválido" },
  { id: "repetido", label: "Repetidos" },
];

const RESPUESTAS: { id: FiltroDeRespuesta; label: string }[] = [
  { id: "todos", label: "Respondieron o no" },
  { id: "si", label: "Respondieron" },
  { id: "no", label: "No respondieron" },
];

function textoDeRespuesta(respondio: boolean | null): string {
  if (respondio === null) return "—";
  return respondio ? "Sí" : "No";
}

export function ListaDeContactos({ lista, control, respuestasLeidas, cargando, error, conFiltros }: Props) {
  const busqueda = useContactosStore((s) => s.busqueda);
  const estado = useContactosStore((s) => s.estado);
  const respondio = useContactosStore((s) => s.respondio);
  const pagina = useContactosStore((s) => s.pagina);
  const todas = useContactosStore((s) => s.todasLasColumnas);
  const st = useContactosStore.getState;
  const columnas: ColumnaDeContactos[] = lista ? columnasDeLaLista(lista.columnas, control, todas) : [];
  const total = lista?.total ?? 0;
  const ultima = lista ? paginas(lista.per_page, total) : 1;
  const hayCriterio = Boolean(busqueda.trim()) || estado !== "todos" || respondio !== "todos";
  const otrasColumnas = lista ? lista.columnas.length > columnas.length : false;

  return (
    <section className="rec-contactos-seccion" aria-labelledby="rec-contactos-lista-titulo" data-testid="contactos-lista">
      <header className="rec-contactos-seccion-cabecera">
        <h2 id="rec-contactos-lista-titulo" className="rec-contactos-titulo">
          <Users size={16} aria-hidden />
          Lista
          <span className="rec-contactos-titulo-cifra">
            {lista ? formatoConteoDe(total, "contacto") : ""}
            {conFiltros ? " con los filtros" : ""}
          </span>
        </h2>
        <div className="rec-contactos-herramientas" role="search" aria-label="Buscar en la lista">
          <label className="rec-contactos-buscar">
            <Search size={14} aria-hidden />
            <input
              type="search"
              aria-label="Buscar por correo o nombre"
              placeholder="Correo o nombre"
              value={busqueda}
              onChange={(e) => st().setBusqueda(e.target.value)}
            />
          </label>
          <select aria-label="Estado del contacto" value={estado} onChange={(e) => st().setEstado(e.target.value as FiltroDeEstado)}>
            {ESTADOS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
          <select
            aria-label="Si respondió"
            value={respondio}
            disabled={!respuestasLeidas}
            title={respuestasLeidas ? undefined : "Disponible cuando se lea quién respondió"}
            onChange={(e) => st().setRespondio(e.target.value as FiltroDeRespuesta)}
          >
            {RESPUESTAS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
          {otrasColumnas || todas ? (
            <label className="rec-contactos-casilla">
              <input type="checkbox" checked={todas} onChange={(e) => st().setTodasLasColumnas(e.target.checked)} />
              Todas las columnas
            </label>
          ) : null}
        </div>
      </header>

      {error ? (
        <div className="rec-contactos-vacio-caja is-error" role="alert" data-qa-geometry-capacity="owned">
          <p>{error}</p>
          <PulsoButton variant="secondary" size="sm" onClick={() => st().refrescar()}>Reintentar</PulsoButton>
        </div>
      ) : lista && lista.rows.length === 0 ? (
        <div className="rec-contactos-vacio-caja" data-qa-geometry-capacity="owned">
          <p>
            {busqueda.trim()
              ? `Ningún contacto coincide con «${busqueda.trim()}».`
              : hayCriterio || conFiltros
                ? "Ningún contacto cumple esta combinación."
                : "La lista está vacía."}
          </p>
          {hayCriterio ? (
            <PulsoButton
              variant="secondary"
              size="sm"
              onClick={() => { st().setBusqueda(""); st().setEstado("todos"); st().setRespondio("todos"); }}
            >
              Quitar búsqueda y estado
            </PulsoButton>
          ) : null}
        </div>
      ) : lista ? (
        <>
          <TableScroll className="rec-contactos-tabla-scroll" aria-busy={cargando || undefined}>
            <table className="rec-contactos-tabla rec-contactos-lista-tabla">
              <caption className="pulso-sr-only">Contactos, {rangoDePagina(lista.page, lista.per_page, total)}</caption>
              <thead>
                <tr>
                  <th scope="col">Correo</th>
                  <th scope="col">Nombre</th>
                  {columnas.map((c) => <th key={c.key} scope="col">{c.label}</th>)}
                  <th scope="col">Estado</th>
                  <th scope="col">Enlace</th>
                  <th scope="col">Respondió</th>
                </tr>
              </thead>
              <tbody>
                {lista.rows.map((fila) => (
                  <tr key={fila.fila}>
                    <td className="rec-contactos-correo">{fila.email || <span className="rec-contactos-sin">sin correo</span>}</td>
                    <td>{fila.nombre || <span className="rec-contactos-sin">—</span>}</td>
                    {columnas.map((c) => (
                      <td key={c.key}>{fila.valores[c.key] ?? <span className="rec-contactos-sin">—</span>}</td>
                    ))}
                    <td>
                      <span className={`rec-contactos-estado is-${fila.estado ?? "desconocido"}`}>
                        {fila.estado ? ETIQUETA_DE_ESTADO[fila.estado] : "—"}
                      </span>
                    </td>
                    <td>{fila.tiene_enlace ? "Sí" : <span className="rec-contactos-sin">—</span>}</td>
                    <td>{textoDeRespuesta(fila.respondio)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
          <nav className="rec-contactos-paginacion" aria-label="Páginas de la lista">
            <span className="rec-contactos-paginacion-rango">{rangoDePagina(lista.page, lista.per_page, total)}</span>
            <PulsoButton
              variant="ghost"
              size="sm"
              disabled={pagina <= 1 || cargando}
              onClick={() => st().setPagina(pagina - 1)}
            >
              <ChevronLeft size={14} aria-hidden />
              Anterior
            </PulsoButton>
            <span className="rec-contactos-paginacion-pagina">
              Página {pagina} de {ultima}
            </span>
            <PulsoButton
              variant="ghost"
              size="sm"
              disabled={pagina >= ultima || cargando}
              onClick={() => st().setPagina(pagina + 1)}
            >
              Siguiente
              <ChevronRight size={14} aria-hidden />
            </PulsoButton>
          </nav>
        </>
      ) : (
        <div className="rec-contactos-vacio-caja" data-qa-geometry-capacity="owned">
          <p>Leyendo la lista…</p>
        </div>
      )}
    </section>
  );
}
