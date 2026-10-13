// Orden de la serie de mediciones (contrato E4-E7, R3).
//
// `armonizacion_periodos` dice en qué orden se leen las bases como serie: es el
// eje de los gráficos comparativos y el orden de las columnas de Analítica. Son
// NOMBRES DE BASE, no años: es la única clave estable entre la matriz, Analítica
// y los entregables. Se guarda con la declaración, sin tocar sus filas.

import { useState } from "react";
import { ArrowDown, ArrowUp, ListOrdered, Save } from "../../vendor/lucide-react";
import {
  guardarEquivalencias,
  type EquivalenciasEstado,
  type EquivalenciasImportacion,
} from "../../api/equivalencias";
import { mismoOrden, moverEnLista, ordenEfectivo } from "./armonizacionModel";
import { CLASE_CHIP_CON_CONTROLES, ChipControl } from "../../components/ChipConControles";
import "./ArmonizacionFilaEditor.css";
import { PulsoButton } from "../../components/PulsoButton";

export type ArmonizacionPeriodosProps = {
  estado: EquivalenciasEstado;
  onGuardado: (out: EquivalenciasImportacion, mensaje: string) => void;
};

export function ArmonizacionPeriodos({ estado, onGuardado }: ArmonizacionPeriodosProps) {
  const guardado = ordenEfectivo(estado.armonizacion_periodos ?? [], estado.bases);
  // El orden elegido vale para la revisión en que se eligió: si la declaración
  // cambia por otro camino, se vuelve a leer lo guardado sin un efecto.
  const [elegido, setElegido] = useState<{ revision: string; orden: string[] } | null>(null);
  const orden = elegido && elegido.revision === (estado.revision ?? "") ? elegido.orden : guardado;
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const declarado = (estado.armonizacion_periodos ?? []).length > 0;
  const cambiado = !mismoOrden(orden, guardado) || !declarado;

  const mover = (i: number, delta: -1 | 1) =>
    setElegido({ revision: estado.revision ?? "", orden: moverEnLista(orden, i, delta) });

  const guardar = async () => {
    setGuardando(true);
    setError("");
    try {
      const out = await guardarEquivalencias(estado.filas ?? [], orden);
      onGuardado(out, `Orden de la serie guardado: ${orden.join(", ")}.`);
      setElegido(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setGuardando(false);
    }
  };

  if (estado.bases.length < 2) return null;

  return (
    <div className="pulso-armon-periodos" role="group" aria-labelledby="pulso-armon-periodos-titulo">
      <span id="pulso-armon-periodos-titulo" className="pulso-armon-periodos-titulo">
        <ListOrdered size={13} aria-hidden="true" />
        Orden de la serie
      </span>
      {/* C1: una colección de chips del mismo tipo, cada uno de su ancho (el
          nombre de la base manda); todos con el mismo alto por el primitivo. */}
      <ol
        className="pulso-armon-periodos-lista"
        data-qa-geometry-group="carga-orden-serie"
        data-qa-geometry-contract="intrinsic"
      >
        {orden.map((base, i) => (
          <li key={base} className={CLASE_CHIP_CON_CONTROLES} data-qa-geometry-member>
            <span className="pulso-armon-periodos-pos" aria-hidden="true">{i + 1}</span>
            <span className="pulso-armon-periodos-base">{base}</span>
            <ChipControl
              aria-label={`Mover ${base} antes`}
              disabled={i === 0 || guardando}
              onClick={() => mover(i, -1)}
            >
              <ArrowUp size={12} aria-hidden="true" />
            </ChipControl>
            <ChipControl
              aria-label={`Mover ${base} después`}
              disabled={i === orden.length - 1 || guardando}
              onClick={() => mover(i, 1)}
            >
              <ArrowDown size={12} aria-hidden="true" />
            </ChipControl>
          </li>
        ))}
      </ol>
      {!declarado && (
        <span className="pulso-armon-periodos-nota">Sin declarar. Se usa el orden de las bases.</span>
      )}
      <PulsoButton
        variant="secondary"
        className="pulso-armon-btn"
        disabled={guardando || !cambiado}
        onClick={() => void guardar()}
      >
        <Save size={13} aria-hidden="true" />
        {guardando ? "Guardando…" : declarado ? "Guardar orden" : "Declarar este orden"}
      </PulsoButton>
      {error && <span className="pulso-armon-error" role="alert">{error}</span>}
    </div>
  );
}
