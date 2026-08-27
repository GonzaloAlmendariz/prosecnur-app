/**
 * El editor de titulares por facultad, en la celda donde se lee el número.
 *
 * Decisión de Gonzalo (2026-08-27): «se muda a cálculo». Hasta hoy el único
 * editor del reparto vivía dentro de `aulas/CertificacionFacultadCard.tsx`,
 * cuya línea 130 corta la tarjeta entera cuando no hay certificación corrida:
 * sin certificación NO HABÍA forma de subir aulas desde la pantalla, y la
 * decisión volvía a ser manual —justo lo que él pidió que no pasara: «nada
 * puede ser manual y todo tiene que estar registrado en la aplicación».
 *
 * El mecanismo no es nuevo: escribe `aulas_base_fijas` del estrato, igual que
 * el stepper de la certificación. Lo que cambia es que ahora vive donde el
 * número se lee por primera vez, y no exige haber sorteado.
 *
 * Una fijación REEMPLAZA lo que la fórmula calcula, así que la celda lo dice
 * en vez de mostrar los dos números como si fueran el mismo: mientras no se
 * recalcule, el número de la tabla sigue siendo el de la fórmula y el fijado
 * está esperando. El aviso `FijasPendientesAviso` nombra la cadena completa.
 */
import { useState } from "react";
import { Pin } from "../../../../vendor/lucide-react";
import { fmtInt } from "../../sharedCore";
import "./titularesEditor.css";

export function TitularesFacultadEditor({
  facultad,
  calculadas,
  fijadas,
  origen,
  nota,
  onAjustar,
  onNota,
}: {
  facultad: string;
  /** Lo que publicó el motor para esta facultad en la corrida vigente. */
  calculadas: number;
  /** El override escrito en el estrato, si lo hay. */
  fijadas: number | null;
  /** De dónde sale la fijación. Vacío en proyectos anteriores al campo. */
  origen?: "" | "formula" | "certificacion" | "operativa";
  /** El motivo, cuando el origen es `operativa`. */
  nota?: string;
  onAjustar: (facultad: string, aulasActuales: number, delta: 1 | -1) => void;
  /** Sin este callback la nota se muestra pero no se puede escribir. */
  onNota?: (facultad: string, nota: string) => void;
}) {
  // El stepper opera sobre el número VIGENTE de la facultad: el fijado si
  // existe, y si no el calculado. Sumar sobre el calculado cuando ya hay una
  // fijación pendiente devolvería a la facultad al valor anterior +1 y se
  // comería la decisión sin decirlo.
  const vigente = fijadas ?? calculadas;
  const pendiente = fijadas != null && fijadas !== calculadas;

  // Sólo se declara operativa una fijación que de verdad se aparta de la
  // fórmula: fijar el mismo número que la fórmula calcula no es una decisión y
  // pintarla como tal atribuiría un juicio que nadie hizo.
  const esOperativa = origen === "operativa" && fijadas != null && fijadas !== calculadas;
  const notaEscrita = (nota ?? "").trim();
  const [editando, setEditando] = useState(false);
  const [borrador, setBorrador] = useState(notaEscrita);

  const guardar = () => {
    onNota?.(facultad, borrador);
    setEditando(false);
  };

  return (
    <span className="cmv2-titulares-editor" data-fijada={fijadas != null || undefined}>
      <span className="cmv2-titulares-valor">
        {fmtInt(pendiente ? fijadas! : calculadas)}
        {fijadas != null && (
          <Pin
            size={11}
            aria-label={`Titulares fijados a mano para ${facultad}`}
            className="cmv2-titulares-pin"
          />
        )}
      </span>
      <span className="cmv2-titulares-stepper">
        <button
          type="button"
          disabled={vigente <= 1}
          aria-label={`Un titular menos en ${facultad}`}
          title={`Fija ${vigente - 1} titulares para ${facultad}. Reemplaza lo que calcula la fórmula; recalcula la propuesta para aplicarlo.`}
          onClick={() => onAjustar(facultad, vigente, -1)}
        >−</button>
        <button
          type="button"
          aria-label={`Un titular más en ${facultad}`}
          title={`Fija ${vigente + 1} titulares para ${facultad}. Reemplaza lo que calcula la fórmula; recalcula la propuesta para aplicarlo.`}
          onClick={() => onAjustar(facultad, vigente, 1)}
        >+</button>
      </span>
      {pendiente && (
        <small className="cmv2-titulares-pendiente">
          la fórmula calcula {fmtInt(calculadas)}
          {origen === "certificacion" && " · lo pide la certificación"}
          {esOperativa && " · agregación operativa"}
        </small>
      )}
      {/* El motivo de una agregación operativa. Se declara faltante en vez de
          quedarse callado: sin él, dentro de tres meses esta cifra es
          indistinguible de un error de dedo. */}
      {esOperativa && (
        editando || (!notaEscrita && onNota) ? (
          <span className="cmv2-titulares-nota-edit">
            {/* El campo vacío NO declara que falta algo: parece opcional. Se
                marca como pendiente hasta que tenga texto, que es lo que hace
                la diferencia entre un vacío declarado y uno silencioso. */}
            <input
              type="text"
              data-falta={borrador.trim() ? undefined : ""}
              value={borrador}
              placeholder={`Por qué ${facultad} lleva ${fijadas} y no ${calculadas}`}
              aria-label={`Motivo de la agregación operativa en ${facultad}`}
              onChange={(event) => setBorrador(event.target.value)}
              onBlur={guardar}
              onKeyDown={(event) => {
                if (event.key === "Enter") guardar();
                if (event.key === "Escape") { setBorrador(notaEscrita); setEditando(false); }
              }}
            />
          </span>
        ) : (
          <button
            type="button"
            className="cmv2-titulares-nota"
            data-falta={notaEscrita ? undefined : ""}
            title={notaEscrita || "Esta agregación no sigue un criterio estadístico: escribe por qué"}
            onClick={() => { setBorrador(notaEscrita); setEditando(true); }}
            disabled={!onNota}
          >
            {notaEscrita || "falta el motivo"}
          </button>
        )
      )}
    </span>
  );
}
