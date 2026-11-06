// «Nuevo filtro» en tres pasos (E5, 2026-10-20): pregunta, forma y detalle. Si la pregunta ya tiene filtro ofrece
// abrirlo y no deja seguir: nunca reemplaza un filtro en silencio (defecto alto de la sonda E56). Monta el Dialog del
// kit (L1): foco atrapado, Escape, click fuera y foco de vuelta al disparador vienen de ahí.

import { useEffect, useRef, useState } from "react";
import { Dialog } from "../../../components/Dialog";
import type { XlsformEditorWorkbook } from "../../../api/multiIntegrado";
import { escribirIntento, intentoCompleto, type FormaIntento, type Intento } from "./escrituraFiltros";
import { ConfigIntento, INTENCIONES, TarjetasIntencion, intentoInicial } from "./IntencionFiltro";
import { NOMBRE_TIPO, type TipoFiltro } from "./modeloFiltros";
import { SelectorPreguntaFiltro, type PreguntaElegible } from "./SelectorPreguntaFiltro";
import { PulsoButton } from "../../../components/PulsoButton";

export type PreguntaDestino = PreguntaElegible & { fila: number; lista: string; tipoFiltro: TipoFiltro | null };

type Props = {
  preguntas: readonly PreguntaDestino[];
  candidatasDe: (name: string) => PreguntaElegible[];
  /** Preguntas numéricas anteriores a `name`, para el filtro «según un número». */
  numericasDe?: (name: string) => PreguntaElegible[];
  workbook: XlsformEditorWorkbook;
  onCrear: (wb: XlsformEditorWorkbook, pregunta: string) => void;
  onAbrir: (pregunta: string) => void;
  onCerrar: () => void;
};

const PASOS = ["Pregunta", "Forma", "Detalle"] as const;

export function NuevoFiltroDialogo({ preguntas, candidatasDe, numericasDe, workbook, onCrear, onAbrir, onCerrar }: Props) {
  const [paso, setPaso] = useState(1);
  const [pregunta, setPregunta] = useState<string | null>(null);
  const [forma, setForma] = useState<FormaIntento | null>(null);
  const [intento, setIntento] = useState<Intento | null>(null);
  const caja = useRef<HTMLDivElement>(null);
  const destino = preguntas.find((p) => p.name === pregunta) ?? null;
  const yaTiene = destino?.tieneFiltro ? destino : null;

  useEffect(() => {
    caja.current?.querySelector<HTMLElement>("input, [role='radio'][tabindex='0'], textarea")?.focus();
  }, [paso]);

  const elegirForma = (f: FormaIntento) => {
    setForma(f);
    if (destino) setIntento(intentoInicial(f, null, destino.name, workbook.choices));
  };
  const puedeSeguir = paso === 1 ? !!destino && !yaTiene : paso === 2 ? !!forma : !!intento && intentoCompleto(intento);
  const seguir = () => {
    if (!puedeSeguir || !destino) return;
    if (paso < 3) { setPaso(paso + 1); return; }
    if (intento) onCrear(escribirIntento(workbook, destino.fila, destino.lista, intento), destino.name);
  };
  return (
    <Dialog
      open
      onOpenChange={(abierto) => { if (!abierto) onCerrar(); }}
      size="md"
      title="Nuevo filtro"
      className="xcf-dialogo-kit"
      stepper={(
        <ol className="xcf-pasos" aria-label="Pasos">
          {PASOS.map((p, i) => (
            <li key={p} className={paso === i + 1 ? "is-actual" : paso > i + 1 ? "is-hecho" : undefined} aria-current={paso === i + 1 ? "step" : undefined}>
              {i + 1}. {p}
            </li>
          ))}
        </ol>
      )}
      footer={(
        <>
          <PulsoButton variant="secondary" size="md" onClick={paso === 1 ? onCerrar : () => setPaso(paso - 1)}>{paso === 1 ? "Cancelar" : "Atrás"}</PulsoButton>
          <PulsoButton variant="primary" size="md" disabled={!puedeSeguir} onClick={seguir}>{paso === 3 ? "Crear filtro" : "Continuar"}</PulsoButton>
        </>
      )}
    >
      <div ref={caja} className="xcf-dialogo-kit__cuerpo">
          {paso === 1 ? (
            <>
              <span className="xcf-campo__rot">¿Qué pregunta filtra sus opciones?</span>
              <SelectorPreguntaFiltro preguntas={preguntas} elegidas={pregunta ? [pregunta] : []} onElegir={(n) => { setPregunta(n); setForma(null); setIntento(null); }}
                etiqueta="Pregunta que filtra sus opciones" marcarConFiltro autoFocus />
              {yaTiene ? (
                <div className="xcf-llamado" role="status">
                  <span><code>{yaTiene.name}</code> ya tiene un filtro {yaTiene.tipoFiltro ? NOMBRE_TIPO[yaTiene.tipoFiltro].toLowerCase() : ""}. Uno nuevo lo reemplazaría.</span>
                  <PulsoButton variant="secondary" size="sm" onClick={() => onAbrir(yaTiene.name)}>Abrir ese filtro</PulsoButton>
                </div>
              ) : null}
            </>
          ) : null}
          {paso === 2 && destino ? (
            <>
              <p className="xcf-nota">Filtro para <code>{destino.name}</code> {destino.titulo}</p>
              <TarjetasIntencion valor={forma} onCambio={elegirForma} columnas={2} />
            </>
          ) : null}
          {paso === 3 && destino && intento ? (
            <>
              <p className="xcf-nota">Filtro para <code>{destino.name}</code>, {INTENCIONES.find((x) => x.forma === forma)?.titulo.toLowerCase()}</p>
              <ConfigIntento intento={intento} onCambio={setIntento} candidatas={candidatasDe(destino.name)} numericas={numericasDe?.(destino.name)} choices={workbook.choices} />
            </>
          ) : null}
      </div>
    </Dialog>
  );
}
