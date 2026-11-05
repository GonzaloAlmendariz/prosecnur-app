// Identidad › Rótulos cortos (U3 del checklist de mandos del mazo, 2026-11-05). Una fila por respuesta acortada: el
// rótulo completo del formulario y el corto con que sale en todo el PPT y el Word. Se agrega buscando la respuesta entre
// las del formulario (el mismo catálogo que Colores de las respuestas), porque el motor sólo reemplaza el rótulo entero.
// Escribe `plan.rotulos_cortos` con `setRotulosCortos` del store del plan: un paso deshacible que guarda el autosave.

import { useId, useMemo, useState, type ReactNode } from "react";
import { PulsoButton } from "../../../components/PulsoButton";
import { PulsoInput } from "../../../components/PulsoInput";
import { Panel } from "../../../components/Panel";
import { formatoConteo } from "../../../lib/formatoNumero";
import { EmptyState, ErrorBlock, LoadingBlock } from "../../../components/States";
import { EstadoChip } from "../../../components/EstadoChip";
import { ArrowRight, Pencil, Search, Trash2, Type } from "../../../vendor/lucide-react";
import { usePlanStore } from "../store";
import { usePaletasRespuestas } from "./usePaletasRespuestas";
import {
  conRotuloCorto,
  errorCorto,
  filasRotulosCortos,
  opcionesDelInstrumento,
  sinRotuloCorto,
  sugerencias,
  type FilaRotuloCorto,
} from "./modeloRotulosCortos";
import "./rotulosCortos.css";

type Edicion = { largo: string; borrador: string };

function EditorCorto({ edicion, onCambio, onGuardar, onCancelar }: {
  edicion: Edicion;
  onCambio: (t: string) => void;
  onGuardar: () => void;
  onCancelar: () => void;
}) {
  const id = useId();
  const problema = edicion.borrador ? errorCorto(edicion.largo, edicion.borrador) : null;
  const puede = !errorCorto(edicion.largo, edicion.borrador);
  return (
    <div className="pulso-rc-editor">
      <label htmlFor={id} className="pulso-rc-editor-rotulo">Rótulo corto</label>
      <div className="pulso-rc-editor-fila">
        <PulsoInput
          id={id}
          size="sm"
          className="pulso-rc-input"
          value={edicion.borrador}
          autoFocus
          invalid={Boolean(problema)}
          aria-describedby={`${id}-ayuda`}
          onChange={(e) => onCambio(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && puede) onGuardar();
            if (e.key === "Escape") onCancelar();
          }}
        />
        <PulsoButton variant="primary" size="sm" onClick={onGuardar} disabled={!puede}>Guardar</PulsoButton>
        <PulsoButton variant="ghost" size="sm" onClick={onCancelar}>Cancelar</PulsoButton>
      </div>
      <p id={`${id}-ayuda`} className={problema ? "pulso-rc-ayuda is-error" : "pulso-rc-ayuda"} role={problema ? "alert" : undefined}>
        {problema ?? `${formatoConteo(edicion.borrador.trim().length)} de ${formatoConteo(edicion.largo.length)} caracteres.`}
      </p>
    </div>
  );
}

function FilaRotulo({ fila, edicion, onEditar, onQuitar, editor }: {
  fila: FilaRotuloCorto;
  edicion: Edicion | null;
  onEditar: () => void;
  onQuitar: () => void;
  editor: ReactNode;
}) {
  const editando = edicion?.largo === fila.largo;
  return (
    <li className={editando ? "pulso-rc-fila is-editando" : "pulso-rc-fila"} data-qa-geometry-member>
      <div className="pulso-rc-par">
        <span className="pulso-rc-largo">{fila.largo}</span>
        <ArrowRight size={16} aria-hidden="true" className="pulso-rc-flecha" />
        {editando ? editor : <strong className="pulso-rc-corto">{fila.corto}</strong>}
      </div>
      <div className="pulso-rc-lado">
        {fila.enFormulario === false ? <EstadoChip tone="warn" label="No está en el formulario" detail="Ninguna respuesta lleva hoy este rótulo: el corto no se aplica." /> : null}
        {editando ? null : (
          <>
            <PulsoButton variant="icon" size="sm" aria-label={`Editar el rótulo corto de ${fila.corto}`} onClick={onEditar}>
              <Pencil size={14} aria-hidden="true" />
            </PulsoButton>
            <PulsoButton variant="icon" size="sm" intent="remove" aria-label={`Quitar el rótulo corto de ${fila.corto}`} onClick={onQuitar}>
              <Trash2 size={14} aria-hidden="true" />
            </PulsoButton>
          </>
        )}
      </div>
    </li>
  );
}

export function RotulosCortos() {
  const mapa = usePlanStore((s) => s.plan.rotulos_cortos);
  const setRotulosCortos = usePlanStore((s) => s.setRotulosCortos);
  const { listas, error } = usePaletasRespuestas();
  const [consulta, setConsulta] = useState("");
  const [edicion, setEdicion] = useState<Edicion | null>(null);
  const tituloId = useId();
  const buscarId = useId();

  const opciones = useMemo(() => (listas ? opcionesDelInstrumento(listas) : null), [listas]);
  const filas = filasRotulosCortos(mapa, opciones);
  // Sin búsqueda sólo se sugieren las más largas mientras no haya ninguna acortada: luego la lista manda.
  const sugerir = !!consulta.trim() || !filas.length;
  const halladas = opciones && sugerir ? sugerencias(opciones, consulta, mapa) : [];
  // Una respuesta nueva que se está acortando: aún no está en el mapa, va arriba de la lista.
  const nueva = edicion && !Object.hasOwn(mapa ?? {}, edicion.largo) ? edicion : null;

  const guardar = () => {
    if (!edicion || errorCorto(edicion.largo, edicion.borrador)) return;
    setRotulosCortos(conRotuloCorto(mapa, edicion.largo, edicion.borrador));
    setEdicion(null);
    setConsulta("");
  };
  const editor = edicion ? (
    <EditorCorto edicion={edicion} onCambio={(t) => setEdicion({ ...edicion, borrador: t })} onGuardar={guardar} onCancelar={() => setEdicion(null)} />
  ) : null;

  return (
    <section className="pulso-rc" aria-labelledby={tituloId} data-seccion="rotulos-cortos">
      <header className="pulso-rc-cabecera">
        {/* H6: «del estudio» lo separa del «Nombre corto de un grupo» de las tarjetas, que vive en cada lámina. */}
        <h3 id={tituloId} className="pulso-rc-titulo">Rótulos cortos del estudio</h3>
        <p className="pulso-rc-bajada">
          Una respuesta con rótulo largo sale con su versión corta en todo el PPT y el Word: barras, leyendas, tarjetas y colores.
          El nombre corto de un grupo en las tarjetas de diferencias se escribe en su lámina, en Gráfico › Diferencias entre grupos.
        </p>
      </header>

      {error ? <ErrorBlock label="No se pudieron leer las respuestas" detail={error} /> : null}
      {!error && !listas ? <LoadingBlock label="Leyendo las respuestas del formulario…" /> : null}

      {opciones ? (
        <div className="pulso-rc-agregar">
          <label htmlFor={buscarId} className="pulso-rc-editor-rotulo">Acortar una respuesta</label>
          <span className="pulso-rc-buscar">
            <Search size={14} aria-hidden="true" />
            <input id={buscarId} type="search" value={consulta} onChange={(e) => setConsulta(e.target.value)}
              placeholder="Buscar una respuesta del formulario" aria-controls={sugerir ? `${buscarId}-lista` : undefined} />
          </span>
          {halladas.length ? (
            <ul id={`${buscarId}-lista`} className="pulso-rc-sugerencias" aria-label={consulta.trim() ? "Respuestas que coinciden" : "Las respuestas más largas"}>
              {halladas.map((o) => (
                <li key={o.rotulo}>
                  <button type="button" className="pulso-rc-sugerencia" aria-pressed={nueva?.largo === o.rotulo}
                    onClick={() => setEdicion({ largo: o.rotulo, borrador: "" })}>
                    <span className="pulso-rc-sugerencia-texto">{o.rotulo}</span>
                    <span className="pulso-rc-sugerencia-n">{formatoConteo(o.rotulo.length)} car.</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : !sugerir ? null : (
            <p id={`${buscarId}-lista`} className="pulso-rc-nada" role="status">
              {opciones.length ? (consulta.trim() ? "Ninguna respuesta coincide o ya tiene su corto." : "Todas las respuestas tienen su corto.") : "Este formulario no tiene listas de respuestas."}
            </p>
          )}
        </div>
      ) : null}

      {filas.length || nueva ? (
        <Panel noPadding aria-label="Rótulos cortos del estudio">
        <ul className="pulso-rc-lista"
          data-qa-geometry-group="graficos/identidad-rotulos-cortos" data-qa-geometry-contract="intrinsic">
          {nueva ? (
            <li className="pulso-rc-fila is-editando is-nueva" data-qa-geometry-member>
              <div className="pulso-rc-par">
                <span className="pulso-rc-largo">{nueva.largo}</span>
                <ArrowRight size={16} aria-hidden="true" className="pulso-rc-flecha" />
                {editor}
              </div>
            </li>
          ) : null}
          {filas.map((f) => (
            <FilaRotulo key={f.largo} fila={f} edicion={edicion} editor={editor}
              onEditar={() => setEdicion({ largo: f.largo, borrador: f.corto })}
              onQuitar={() => { setRotulosCortos(sinRotuloCorto(mapa, f.largo)); if (edicion?.largo === f.largo) setEdicion(null); }} />
          ))}
        </ul>
        </Panel>
      ) : (
        <EmptyState icon={<Type size={20} aria-hidden="true" />} title="Sin rótulos cortos"
          hint="Busca una respuesta larga y escribe cómo debe salir en las láminas." />
      )}
    </section>
  );
}
