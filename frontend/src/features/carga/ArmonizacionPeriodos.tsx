// Orden de la serie de mediciones (contrato E4-E7, R3).
//
// `armonizacion_periodos` dice en qué orden se leen las bases como serie: es el
// eje de los gráficos comparativos y el orden de las columnas de Analítica. Son
// NOMBRES DE BASE, no años: es la única clave estable entre la matriz, Analítica
// y los entregables. Se guarda con la declaración, sin tocar sus filas.
//
// M7 (ronda de pulido): la vista lo resume en UNA línea —«b2024 → b2025 → …»— y
// la edición vive en un sideover direccionable (`?panel=orden-serie`). Con siete
// bases la tira de chips ocupaba tres líneas y, a 1024x600, empujaba la tabla
// fuera de vista. El resumen mide lo mismo con 3 bases que con 20.

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useInRouterContext } from "react-router-dom";
import { ArrowDown, ArrowDown01, ArrowUp, ListOrdered, Pencil, Save, X } from "../../vendor/lucide-react";
import {
  guardarEquivalencias,
  type EquivalenciasEstado,
  type EquivalenciasImportacion,
} from "../../api/equivalencias";
import {
  PANEL_ORDEN_SERIE,
  mismoOrden,
  moverEnLista,
  ordenEfectivo,
  resumenOrdenSerie,
} from "./armonizacionModel";
import { ordenPorAnio } from "./nombreDeSerie";
import { usePanelDireccionable } from "../../lib/navegacion/paneles";
import { CLASE_CHIP_CON_CONTROLES, ChipControl } from "../../components/ChipConControles";
import { SaveStatusIndicator, type SaveState } from "../../components/SaveStatusIndicator";
import "./ArmonizacionFilaEditor.css";
import { PulsoButton } from "../../components/PulsoButton";

export type ArmonizacionPeriodosProps = {
  estado: EquivalenciasEstado;
  onGuardado: (out: EquivalenciasImportacion, mensaje: string) => void;
};

export function ArmonizacionPeriodos(props: ArmonizacionPeriodosProps) {
  // El panel escribe en la dirección; sin router (render aislado) no hay panel.
  return useInRouterContext() ? <PeriodosConDireccion {...props} /> : null;
}

function PeriodosConDireccion({ estado, onGuardado }: ArmonizacionPeriodosProps) {
  const panel = usePanelDireccionable(PANEL_ORDEN_SERIE);
  const guardado = ordenEfectivo(estado.armonizacion_periodos ?? [], estado.bases);
  const declarado = (estado.armonizacion_periodos ?? []).length > 0;
  // F6: sin declaración el orden por defecto ya es cronológico si todas las bases nombran un año.
  const porAnio = ordenPorAnio(estado.bases) !== null;

  if (estado.bases.length < 2) return null;

  return (
    <div className="pulso-armon-periodos" role="group" aria-labelledby="pulso-armon-periodos-titulo">
      <span id="pulso-armon-periodos-titulo" className="pulso-armon-periodos-titulo">
        <ListOrdered size={13} aria-hidden="true" />
        Orden de la serie
      </span>
      <span className="pulso-armon-periodos-resumen" title={guardado.join(" → ")}>
        {resumenOrdenSerie(guardado)}
      </span>
      {!declarado && (
        <span className="pulso-armon-periodos-nota">
          {porAnio ? "Sin declarar: se propone el orden por año." : "Sin declarar: se usa el orden de las bases."}
        </span>
      )}
      <PulsoButton
        variant="secondary"
        size="sm"
        className="pulso-armon-periodos-editar"
        onClick={panel.abrir}
        aria-haspopup="dialog"
      >
        <Pencil size={13} aria-hidden="true" />
        Editar
      </PulsoButton>
      <EditorOrden
        abierto={panel.abierto}
        panelProps={panel.props}
        onCerrar={panel.cerrar}
        estado={estado}
        guardado={guardado}
        declarado={declarado}
        onGuardado={onGuardado}
      />
    </div>
  );
}

function EditorOrden({
  abierto,
  panelProps,
  onCerrar,
  estado,
  guardado,
  declarado,
  onGuardado,
}: {
  abierto: boolean;
  panelProps: { "data-pulso-panel": string };
  onCerrar: () => void;
  estado: EquivalenciasEstado;
  guardado: string[];
  declarado: boolean;
  onGuardado: (out: EquivalenciasImportacion, mensaje: string) => void;
}) {
  // El orden elegido vale para la revisión en que se eligió: si la declaración
  // cambia por otro camino, se vuelve a leer lo guardado sin un efecto.
  const [elegido, setElegido] = useState<{ revision: string; orden: string[] } | null>(null);
  const orden = elegido && elegido.revision === (estado.revision ?? "") ? elegido.orden : guardado;
  const [guardando, setGuardando] = useState(false);
  const [guardadoAhora, setGuardadoAhora] = useState(false);
  const [error, setError] = useState("");
  const cambiado = !mismoOrden(orden, guardado);
  // «Ordenar por año» sólo existe si todas las bases nombran un año (F6).
  const cronologico = ordenPorAnio(orden);
  // Sin declarar también es algo por guardar: el orden propuesto aún no es la serie.
  const pendiente = cambiado || !declarado;

  const mover = (i: number, delta: -1 | 1) => {
    setGuardadoAhora(false);
    setElegido({ revision: estado.revision ?? "", orden: moverEnLista(orden, i, delta) });
  };

  const ordenarPorAnio = () => {
    if (!cronologico) return;
    setGuardadoAhora(false);
    setElegido({ revision: estado.revision ?? "", orden: cronologico });
  };

  const guardar = async () => {
    setGuardando(true);
    setError("");
    try {
      const out = await guardarEquivalencias(estado.filas ?? [], orden);
      onGuardado(out, `Orden de la serie guardado: ${orden.join(", ")}.`);
      setElegido(null);
      setGuardadoAhora(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setGuardando(false);
    }
  };

  const estadoGuardado: SaveState = guardando ? "saving"
    : error ? "error"
    : pendiente ? "dirty"
    : guardadoAhora ? "saved" : "idle";

  return (
    <Dialog.Root
      open={abierto}
      onOpenChange={(siguiente) => {
        if (siguiente) return;
        setElegido(null);
        setError("");
        setGuardadoAhora(false);
        onCerrar();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="pulso-armon-velo" />
        <Dialog.Content
          className="pulso-armon is-angosto"
          {...panelProps}
          data-audit-ready="true"
          aria-describedby="pulso-orden-serie-ayuda"
        >
          <div className="pulso-armon-marco">
            <header className="pulso-armon-cabecera">
              <div className="pulso-armon-titular">
                <Dialog.Title className="pulso-armon-titulo">Orden de la serie</Dialog.Title>
                <Dialog.Close className="pulso-armon-cerrar" aria-label="Cerrar">
                  <X size={16} aria-hidden="true" />
                </Dialog.Close>
              </div>
              <p id="pulso-orden-serie-ayuda" className="pulso-armon-regla">
                Es el eje de los gráficos comparativos y el orden de las columnas en Analítica.
              </p>
            </header>

            {/* C4: un único dueño de scroll; la lista crece con N y se recorre aquí. */}
            <div className="pulso-armon-cuerpo">
              {cronologico && (
                <PulsoButton
                  variant="secondary"
                  size="sm"
                  className="pulso-armon-periodos-ordenar"
                  disabled={guardando || mismoOrden(orden, cronologico)}
                  onClick={ordenarPorAnio}
                >
                  <ArrowDown01 size={13} aria-hidden="true" />
                  Ordenar por año
                </PulsoButton>
              )}
              {/* C1: filas pares, mismo alto y ancho con cualquier N. */}
              <ol
                className="pulso-armon-periodos-lista is-vertical"
                aria-label="Bases en orden de la serie"
                data-qa-geometry-group="carga-orden-serie"
                data-qa-geometry-contract="equal"
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
            </div>

            <footer className="pulso-armon-pie">
              <div className="pulso-armon-pie-estado">
                <SaveStatusIndicator state={estadoGuardado} variant="badge" />
                {error && <span className="pulso-armon-error" role="alert"> {error}</span>}
              </div>
              <Dialog.Close asChild>
                <PulsoButton variant="secondary" className="pulso-armon-btn">
                  Cerrar
                </PulsoButton>
              </Dialog.Close>
              <PulsoButton
                variant="primary"
                className="pulso-armon-btn"
                disabled={guardando || !pendiente}
                onClick={() => void guardar()}
              >
                <Save size={14} aria-hidden="true" />
                Guardar orden
              </PulsoButton>
            </footer>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
