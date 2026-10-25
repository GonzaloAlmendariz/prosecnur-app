// Tarjeta de aprobación de citas de `p_citas` (O3b-b, TXT-8/9). Lista las candidatas (las propuestas primero) y deja
// aprobar hasta cinco, ordenarlas, recortarlas por oraciones o fragmentos, corregir una errata y marcar «[sic]». Lo
// aprobado se guarda como objetos {id, texto, sic} en `citas_aprobadas`; la edición se valida antes de guardar con la
// regla del backend y, si no vale, se explica por qué. Los avisos del backend se muestran tal cual.

import { useId, useState } from "react";
import { ArrowDown, ArrowUp, Check, PencilLine, X } from "../../../../vendor/lucide-react";
import type { CitaCandidata } from "../../../../api/graficosCitas";
import {
  TOPE_CITAS,
  actualizar,
  aprobar,
  armarRecorte,
  emitirAprobadas,
  leerAprobadas,
  mover,
  quitar,
  segmentosCita,
  validarEdicion,
  type CitaAprobada,
} from "./modeloCitas";
import { useCitasCandidatas } from "./useCitasCandidatas";
import "./citasAprobadas.css";

type Props = {
  args: Record<string, unknown>;
  /** Pregunta calificada (`base$var`); vacía si aún no se eligió. */
  variable: string;
  onCambio: (patch: Record<string, unknown>) => void;
};

const POR_PAGINA = 8;

export function CitasAprobadas({ args, variable, onCambio }: Props) {
  const idTitulo = useId();
  const estado = useCitasCandidatas(variable, args.filtros, typeof args.var_persona === "string" ? args.var_persona : "");
  const aprobadas = leerAprobadas(args.citas_aprobadas);
  const [visibles, setVisibles] = useState(POR_PAGINA);
  const guardar = (l: CitaAprobada[]) => onCambio({ citas_aprobadas: emitirAprobadas(l) });
  const candidatas = estado.fase === "lista" ? estado.datos.candidatas : [];
  const porId = new Map(candidatas.map((c) => [c.id, c]));
  const libres = candidatas.filter((c) => !aprobadas.some((a) => a.id === c.id))
    .sort((a, b) => Number(b.propuesta) - Number(a.propuesta));
  const lleno = aprobadas.length >= TOPE_CITAS;

  return (
    <section className="pulso-f6-citas" aria-labelledby={idTitulo} data-qa-geometry-group="graficos/f6-citas" data-qa-geometry-contract="intrinsic">
      <header className="pulso-f6-citas-head">
        <h5 id={idTitulo} className="pulso-f6-dato-rotulo">Citas aprobadas</h5>
        <span className="pulso-f6-citas-n">{aprobadas.length} de {TOPE_CITAS}</span>
      </header>
      {estado.fase === "sin_pregunta" && <p className="pulso-f6-dato-ayuda">Elige primero la pregunta abierta.</p>}
      {estado.fase === "cargando" && <p className="pulso-f6-dato-ayuda" role="status">Leyendo los comentarios</p>}
      {estado.fase === "error" && <p className="pulso-f6-citas-aviso" role="alert">{estado.mensaje}</p>}
      {estado.fase === "lista" && (
        <>
          {estado.datos.avisos.map((a) => <p key={a} className="pulso-f6-citas-aviso" role="note">{a}</p>)}
          {aprobadas.length === 0 ? (
            <p className="pulso-f6-dato-ayuda">Sin citas aprobadas, la lámina sale como borrador. Aprueba de tres a cinco.</p>
          ) : (
            <ol className="pulso-f6-citas-lista" aria-label="Aprobadas, en el orden en que van"
              data-qa-geometry-group="graficos/f6-citas-aprobadas" data-qa-geometry-contract="intrinsic">
              {aprobadas.map((a, i) => (
                <CitaAprobadaFila key={a.id} cita={a} candidata={porId.get(a.id)} pos={i} total={aprobadas.length}
                  onCambiar={(c) => guardar(actualizar(aprobadas, a.id, c))}
                  onMover={(d) => guardar(mover(aprobadas, a.id, d))}
                  onQuitar={() => guardar(quitar(aprobadas, a.id))} />
              ))}
            </ol>
          )}
          <div className="pulso-f6-citas-sub">
            <span className="pulso-f6-dato-rotulo">Comentarios para elegir</span>
            <span className="pulso-f6-citas-n">{libres.length}</span>
          </div>
          {libres.length === 0 ? (
            <p className="pulso-f6-dato-ayuda">
              {candidatas.length ? "Ya aprobaste todos los comentarios que sirven como cita." : "Ningún comentario tiene el largo de una cita (de 40 a 280 letras)."}
            </p>
          ) : (
            <ul className="pulso-f6-citas-lista" aria-label="Comentarios para elegir"
              data-qa-geometry-group="graficos/f6-citas-candidatas" data-qa-geometry-contract="intrinsic">
              {libres.slice(0, visibles).map((c) => (
                <li key={c.id} className="pulso-f6-cita" data-qa-geometry-member="candidata">
                  <p className="pulso-f6-cita-texto">«{c.texto}»</p>
                  <div className="pulso-f6-cita-pie">
                    {c.propuesta && <span className="pulso-f6-cita-marca">Propuesta</span>}
                    {c.revision && <span className="pulso-f6-cita-marca is-revisar" title={c.revision}>Revisar</span>}
                    <span className="pulso-f6-citas-sp" />
                    <button type="button" className="pulso-f6-boton" disabled={lleno}
                      title={lleno ? `Ya hay ${TOPE_CITAS} aprobadas: quita una para aprobar otra` : undefined}
                      aria-label={`Aprobar la cita «${c.texto.slice(0, 60)}»`}
                      onClick={() => guardar(aprobar(aprobadas, c.id))}>
                      <Check size={13} aria-hidden="true" /> Aprobar
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {libres.length > visibles && (
            <button type="button" className="pulso-f6-boton pulso-f6-citas-mas" onClick={() => setVisibles((v) => v + POR_PAGINA)}>
              Mostrar {Math.min(POR_PAGINA, libres.length - visibles)} más
            </button>
          )}
        </>
      )}
    </section>
  );
}

type Modo = "ver" | "recortar" | "corregir";

function CitaAprobadaFila({ cita, candidata, pos, total, onCambiar, onMover, onQuitar }: {
  cita: CitaAprobada; candidata: CitaCandidata | undefined; pos: number; total: number;
  onCambiar: (c: Partial<Omit<CitaAprobada, "id">>) => void; onMover: (d: -1 | 1) => void; onQuitar: () => void;
}) {
  const [modo, setModo] = useState<Modo>("ver");
  const idSic = useId();
  if (!candidata) {
    return (
      <li className="pulso-f6-cita is-perdida" data-qa-geometry-member="aprobada">
        <p className="pulso-f6-cita-texto">Esta cita ya no está entre los comentarios (cambió el filtro o el texto).</p>
        <div className="pulso-f6-cita-pie">
          <span className="pulso-f6-citas-sp" />
          <button type="button" className="pulso-f6-boton" onClick={onQuitar}><X size={13} aria-hidden="true" /> Quitar</button>
        </div>
      </li>
    );
  }
  const original = candidata.texto;
  const actual = cita.texto ?? original;
  const v = cita.texto ? validarEdicion(original, cita.texto) : null;
  const palabrasSic = Array.isArray(cita.sic) ? cita.sic : [];
  const corto = original.slice(0, 40);
  return (
    <li className="pulso-f6-cita is-aprobada" data-qa-geometry-member="aprobada">
      <div className="pulso-f6-cita-cabeza">
        <span className="pulso-f6-cita-pos" aria-hidden="true">{pos + 1}</span>
        <p className="pulso-f6-cita-texto">«{actual}»{cita.sic && palabrasSic.length === 0 ? " [sic]" : ""}</p>
      </div>
      <div className="pulso-f6-cita-pie">
        {v?.tipo.includes("recorte") && <span className="pulso-f6-cita-marca">Recortada</span>}
        {v?.tipo.includes("correccion") && <span className="pulso-f6-cita-marca">Corregida</span>}
        {cita.sic && <span className="pulso-f6-cita-marca">[sic]{palabrasSic.length ? ` en ${palabrasSic.join(", ")}` : ""}</span>}
        {candidata.revision && <span className="pulso-f6-cita-marca is-revisar" title={candidata.revision}>Revisar</span>}
      </div>
      {v && !v.ok && <p className="pulso-f6-citas-aviso" role="note">La edición no vale ({v.motivo}): la lámina dibuja el original.</p>}
      {modo === "ver" && (
        <div className="pulso-f6-cita-acciones" role="group" aria-label={`Acciones de la cita ${pos + 1}`}>
          <button type="button" className="pulso-f6-icono-boton" aria-label={`Subir la cita ${pos + 1}`} disabled={pos === 0} onClick={() => onMover(-1)}><ArrowUp size={14} aria-hidden="true" /></button>
          <button type="button" className="pulso-f6-icono-boton" aria-label={`Bajar la cita ${pos + 1}`} disabled={pos === total - 1} onClick={() => onMover(1)}><ArrowDown size={14} aria-hidden="true" /></button>
          <button type="button" className="pulso-f6-boton" onClick={() => setModo("recortar")}>Recortar</button>
          <button type="button" className="pulso-f6-boton" onClick={() => setModo("corregir")}><PencilLine size={13} aria-hidden="true" /> Corregir</button>
          <button type="button" className={`pulso-f6-boton${cita.sic ? " is-activo" : ""}`} aria-pressed={!!cita.sic}
            title="Deja el texto como se escribió y avisa que el error es del original"
            onClick={() => onCambiar({ sic: cita.sic ? undefined : true })}>[sic]</button>
          <button type="button" className="pulso-f6-boton" aria-label={`Quitar la cita «${corto}»`} onClick={onQuitar}><X size={13} aria-hidden="true" /> Quitar</button>
        </div>
      )}
      {modo === "ver" && cita.sic && (
        <label className="pulso-f6-cita-sic" htmlFor={idSic}>
          <span className="pulso-f6-dato-ayuda">Detrás de qué palabras va «[sic]» (opcional; si no, al final)</span>
          <input id={idSic} className="pulso-f6-input" defaultValue={palabrasSic.join(", ")} placeholder="pdoer, adceso"
            onBlur={(e) => {
              const ps = e.target.value.split(/[,\s]+/).map((x) => x.trim()).filter(Boolean);
              onCambiar({ sic: ps.length ? ps : true });
            }} />
        </label>
      )}
      {modo === "recortar" && (
        <Recortar base={cita.texto && !cita.texto.includes("[…]") && v?.ok ? cita.texto : original}
          onGuardar={(t) => { onCambiar({ texto: t === original ? undefined : t }); setModo("ver"); }}
          onOriginal={() => { onCambiar({ texto: undefined }); setModo("ver"); }}
          onCancelar={() => setModo("ver")} />
      )}
      {modo === "corregir" && (
        <Corregir original={original} inicial={actual} conSic={!!cita.sic}
          onGuardar={(t) => { onCambiar({ texto: t === original ? undefined : t }); setModo("ver"); }}
          onCancelar={() => setModo("ver")} />
      )}
    </li>
  );
}

function Recortar({ base, onGuardar, onOriginal, onCancelar }: {
  base: string; onGuardar: (t: string) => void; onOriginal: () => void; onCancelar: () => void;
}) {
  const segmentos = segmentosCita(base);
  const [elegidos, setElegidos] = useState<boolean[]>(() => segmentos.map(() => true));
  const texto = armarRecorte(segmentos, elegidos);
  return (
    <div className="pulso-f6-cita-editor" role="group" aria-label="Recortar la cita">
      <p className="pulso-f6-dato-ayuda">Toca los fragmentos que no van. Donde se quite algo, la cita lleva «[…]».</p>
      <div className="pulso-f6-cita-fragmentos">
        {segmentos.map((s, i) => (
          <button key={`${i}-${s}`} type="button" aria-pressed={elegidos[i]}
            className={`pulso-f6-cita-fragmento${elegidos[i] ? " is-elegido" : ""}`}
            onClick={() => setElegidos((e) => e.map((x, j) => (j === i ? !x : x)))}>{s}</button>
        ))}
      </div>
      <p className="pulso-f6-cita-vista" aria-live="polite">{texto ? `«${texto}»` : "Elige al menos un fragmento."}</p>
      <div className="pulso-f6-cita-acciones">
        <button type="button" className="pulso-f6-boton is-activo" disabled={!texto} onClick={() => onGuardar(texto)}>Guardar recorte</button>
        <button type="button" className="pulso-f6-boton" onClick={onOriginal}>Volver al original</button>
        <button type="button" className="pulso-f6-boton" onClick={onCancelar}>Cancelar</button>
      </div>
    </div>
  );
}

function Corregir({ original, inicial, conSic, onGuardar, onCancelar }: {
  original: string; inicial: string; conSic: boolean; onGuardar: (t: string) => void; onCancelar: () => void;
}) {
  const id = useId();
  const [texto, setTexto] = useState(inicial);
  const v = validarEdicion(original, texto);
  const contradice = conSic && v.ok && v.tipo.includes("correccion");
  const motivo = !v.ok ? `No se puede guardar: ${v.motivo}. Sólo se aceptan tildes, mayúsculas o hasta dos letras en palabras de cuatro o más, sin palabras nuevas.`
    : contradice ? "Esta cita está marcada con «[sic]»: corregir y marcar el error a la vez se contradicen. Quita «[sic]» o deja el texto como está."
    : "";
  return (
    <div className="pulso-f6-cita-editor" role="group" aria-label="Corregir la cita">
      <label className="pulso-f6-dato-ayuda" htmlFor={id}>Corrige sólo erratas. El sentido de la cita no cambia.</label>
      <textarea id={id} className="pulso-f6-input pulso-f6-cita-area" rows={4} value={texto}
        aria-invalid={!!motivo} aria-describedby={motivo ? `${id}-motivo` : undefined}
        onChange={(e) => setTexto(e.target.value)} />
      {motivo && <p id={`${id}-motivo`} className="pulso-f6-citas-aviso" role="alert">{motivo}</p>}
      <div className="pulso-f6-cita-acciones">
        <button type="button" className="pulso-f6-boton is-activo" disabled={!!motivo} onClick={() => onGuardar(v.texto)}>Guardar corrección</button>
        <button type="button" className="pulso-f6-boton" onClick={onCancelar}>Cancelar</button>
      </div>
    </div>
  );
}
