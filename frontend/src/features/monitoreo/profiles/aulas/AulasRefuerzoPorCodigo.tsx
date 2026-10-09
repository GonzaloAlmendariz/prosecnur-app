import { useMemo, useState } from "react";

import type { MonitoreoAulasPlanRow } from "../../../../api/monitoreo";
import { Check, CircleAlert, Plus } from "../../../../vendor/lucide-react";
import { diagnostica, tipoSegunDestino } from "./refuerzoPorCodigo";
import { useMarcarRefuerzo } from "./useMarcarRefuerzo";
import "./aulasRefuerzoPorCodigo.css";

/**
 * **Pedir un refuerzo escribiendo su código.**
 *
 * Gonzalo, 2026-09-18: «la app también debería poder permitir aplicar refuerzos
 * manuales por código de CH como por ejemplo R 23.4, y esa se verifique que
 * esté disponible y se clasifique como escogida para refuerzo».
 *
 * El reparto del techo, aquí encima, elige por él cuando no sabe cuál pedir.
 * Esto es para cuando ya lo sabe: conoce al docente, el aula le viene bien al
 * aplicador, o lo habló con la facultad. La app no tiene que adivinarlo, sólo
 * comprobar que se puede y dejarlo registrado.
 *
 * **Contesta mientras se escribe, no después de pulsar.** El diagnóstico sale
 * del plan que esta pantalla ya tiene, así que dice «disponible, 42 elegibles»
 * o «ya está comprometida (AGENDADA)» sin ir a la red. El servidor vuelve a
 * validar al guardar y su palabra es la que manda: esto adelanta la respuesta,
 * no la decide.
 */
export function AulasRefuerzoPorCodigo({ plan, onGuardado }: {
  plan: ReadonlyArray<MonitoreoAulasPlanRow>;
  onGuardado?: () => void;
}) {
  const [codigo, setCodigo] = useState("");
  const [para, setPara] = useState("");
  const [motivo, setMotivo] = useState("");
  const marca = useMarcarRefuerzo(onGuardado);

  const v = useMemo(
    () => diagnostica(codigo, plan as unknown as Array<Record<string, unknown>>),
    [codigo, plan],
  );
  // El destino por defecto es su facultad: el caso C es el que más se pide y
  // así no hay que teclearla. Sigue siendo editable.
  const destino = para || v.facultad;
  const tipo = tipoSegunDestino(destino);
  const ocupado = marca.marcando === v.codigo;

  const pedir = () => {
    if (!v.puede) return;
    void Promise.resolve(marca.marcar(v.codigo, tipo, destino, motivo)).then(() => {
      setCodigo("");
      setPara("");
      setMotivo("");
    });
  };

  return (
    <div className="aulas-refcod">
      <div className="aulas-refcod-campos">
        <label className="aulas-refcod-campo">
          <span>Curso-horario</span>
          <input
            type="text" value={codigo} placeholder="R 23.4"
            autoComplete="off" spellCheck={false}
            onChange={(e) => setCodigo(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && v.puede && !ocupado) pedir(); }}
          />
        </label>
        <label className="aulas-refcod-campo">
          <span>A quién ayuda</span>
          <input
            type="text" value={destino} placeholder="su facultad, o un CH"
            autoComplete="off"
            onChange={(e) => setPara(e.target.value)}
          />
        </label>
        <label className="aulas-refcod-campo es-ancho">
          <span>Por qué (opcional)</span>
          <input
            type="text" value={motivo} placeholder="lo que quieras dejar dicho"
            autoComplete="off"
            onChange={(e) => setMotivo(e.target.value)}
          />
        </label>
        <button
          type="button" className="aulas-refcod-pedir"
          disabled={!v.puede || ocupado}
          onClick={pedir}
        >
          <Plus size={14} aria-hidden="true" />
          {ocupado ? "Pidiendo…" : "Pedir como refuerzo"}
        </button>
      </div>

      {/* El veredicto SIEMPRE ocupa su sitio: sin él, la caja daba un salto al
          escribir la primera letra. Vacío cuando no hay nada que decir. */}
      <p className={`aulas-refcod-veredicto${v.codigo ? ` es-${v.puede ? "ok" : "no"}` : ""}`}>
        {v.motivo ? (
          <>
            {v.puede ? <Check size={13} aria-hidden="true" />
              : <CircleAlert size={13} aria-hidden="true" />}
            {v.curso ? <strong>{v.codigo} · {v.curso}</strong> : null}
            {v.motivo}
            {v.docente ? <em>{v.docente}</em> : null}
          </>
        ) : null}
      </p>

      {/* Lo que contestó el motor. Puede contradecir al veredicto de arriba
          —alguien más marcó esa aula entre medias— y entonces manda éste. */}
      {marca.aviso ? <p className="aulas-refcod-aviso">{marca.aviso}</p> : null}
      {marca.fallos.length ? (
        <ul className="aulas-refcod-fallos">
          {marca.fallos.map((f) => (
            <li key={f.codigo}><strong>{f.codigo}</strong> {f.motivo}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export default AulasRefuerzoPorCodigo;
