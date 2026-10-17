// Columnas laterales de «Probar formulario» (M1, 2026-10-17): el recorrido por secciones a la izquierda y lo respondido
// a la derecha. Ocupan las franjas que antes quedaban vacías a los lados de la hoja; bajo 1180 px se ocultan y la
// prueba queda como antes.

import { ArrowRight, Check } from "../../../../vendor/lucide-react";
import { PanelCard, TypeIcon } from "../../kit";
import type { RespuestaDada, SeccionRecorrido } from "./modeloRecorrido";
import "./panelesPrueba.css";

const ROTULO: Record<SeccionRecorrido["estado"], string> = { actual: "Aquí", hecha: "Hecha", pendiente: "Pendiente", omitida: "No aparece" };

export function RecorridoPrueba({ secciones, onIr }: { secciones: readonly SeccionRecorrido[]; onIr: (indiceVisible: number) => void }) {
  const omitidas = secciones.filter((s) => s.estado === "omitida").length;
  return (
    <PanelCard title="Recorrido" meta={omitidas ? `${omitidas} no aparecen` : `${secciones.length} secciones`} className="xfsp-col">
      <ol className="xfsp-secciones" data-qa-geometry-group="xlsform/prueba-recorrido" data-qa-geometry-contract="intrinsic">
        {secciones.map((s) => (
          <li key={s.id} data-qa-geometry-member="">
            <button type="button" className={`xfsp-sec is-${s.estado}`} disabled={s.indiceVisible === null}
              aria-current={s.estado === "actual" ? "step" : undefined} onClick={() => s.indiceVisible !== null && onIr(s.indiceVisible)}>
              <span className="xfsp-sec__marca" aria-hidden="true">{s.estado === "hecha" ? <Check size={11} /> : null}</span>
              <span className="xfsp-sec__titulo" title={s.titulo}>{s.titulo}</span>
              <span className="xfsp-sec__dato">{s.estado === "omitida" ? ROTULO.omitida : s.total ? `${s.respondidas} de ${s.total}` : ROTULO[s.estado]}</span>
            </button>
          </li>
        ))}
      </ol>
    </PanelCard>
  );
}

export function RespuestasPrueba({ respuestas, onIrPregunta }: { respuestas: readonly RespuestaDada[]; onIrPregunta?: (name: string) => void }) {
  return (
    <PanelCard title="Respuestas" meta={respuestas.length ? String(respuestas.length) : undefined} className="xfsp-col">
      {respuestas.length ? (
        <ul className="xfsp-respuestas" data-qa-geometry-group="xlsform/prueba-respuestas" data-qa-geometry-contract="intrinsic">
          {respuestas.map((r) => (
            <li key={r.name} className="xfsp-resp" data-qa-geometry-member="">
              <span className="xfsp-resp__preg" title={r.enunciado}>
                <TypeIcon baseType={r.baseType} size={12} />
                <b>{r.numero}</b>
                <span>{r.enunciado}</span>
              </span>
              <span className="xfsp-resp__valor"><ArrowRight size={12} aria-hidden="true" />{r.texto}</span>
              {onIrPregunta ? <button type="button" className="xfsp-resp__ir" onClick={() => onIrPregunta(r.name)}>Ir</button> : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="xfsp-nota">Lo que respondas aparece aquí, en orden. Sirve para ver por qué una pregunta aparece o se salta.</p>
      )}
    </PanelCard>
  );
}
