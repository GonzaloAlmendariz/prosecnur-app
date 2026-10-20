// «Nuevo filtro» en tres pasos (E5, 2026-10-20): pregunta, forma y detalle. Si la pregunta ya tiene filtro ofrece
// abrirlo y no deja seguir: nunca reemplaza un filtro en silencio (defecto alto de la sonda E56). Escape cierra.

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import type { XlsformEditorWorkbook } from "../../../api/multiIntegrado";
import { escribirIntento, intentoCompleto, type Intento } from "./escrituraFiltros";
import { ConfigIntento, INTENCIONES, TarjetasIntencion, intentoInicial } from "./IntencionFiltro";
import { NOMBRE_TIPO, type TipoFiltro } from "./modeloFiltros";
import { SelectorPreguntaFiltro, type PreguntaElegible } from "./SelectorPreguntaFiltro";
import { PulsoButton } from "../../../components/PulsoButton";

export type PreguntaDestino = PreguntaElegible & { fila: number; lista: string; tipoFiltro: TipoFiltro | null };

type Props = {
  preguntas: readonly PreguntaDestino[];
  candidatasDe: (name: string) => PreguntaElegible[];
  workbook: XlsformEditorWorkbook;
  onCrear: (wb: XlsformEditorWorkbook, pregunta: string) => void;
  onAbrir: (pregunta: string) => void;
  onCerrar: () => void;
};

const PASOS = ["Pregunta", "Forma", "Detalle"] as const;

export function NuevoFiltroDialogo({ preguntas, candidatasDe, workbook, onCrear, onAbrir, onCerrar }: Props) {
  const [paso, setPaso] = useState(1);
  const [pregunta, setPregunta] = useState<string | null>(null);
  const [forma, setForma] = useState<TipoFiltro | null>(null);
  const [intento, setIntento] = useState<Intento | null>(null);
  const caja = useRef<HTMLDivElement>(null);
  const destino = preguntas.find((p) => p.name === pregunta) ?? null;
  const yaTiene = destino?.tieneFiltro ? destino : null;

  useEffect(() => {
    const previo = document.activeElement as HTMLElement | null;
    return () => previo?.focus?.();
  }, []);
  useEffect(() => {
    caja.current?.querySelector<HTMLElement>("input, [role='radio'][tabindex='0'], textarea")?.focus();
  }, [paso]);

  const elegirForma = (f: TipoFiltro) => {
    setForma(f);
    if (destino) setIntento(intentoInicial(f, null, destino.name, workbook.choices));
  };
  const puedeSeguir = paso === 1 ? !!destino && !yaTiene : paso === 2 ? !!forma : !!intento && intentoCompleto(intento);
  const seguir = () => {
    if (!puedeSeguir || !destino) return;
    if (paso < 3) { setPaso(paso + 1); return; }
    if (intento) onCrear(escribirIntento(workbook, destino.fila, destino.lista, intento), destino.name);
  };
  const tecla = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") { e.stopPropagation(); onCerrar(); return; }
    if (e.key !== "Tab" || !caja.current) return;
    // Foco atrapado en el diálogo.
    const focos = [...caja.current.querySelectorAll<HTMLElement>("button:not([disabled]), input, textarea, [tabindex='0']")];
    const primero = focos[0];
    const ultimo = focos[focos.length - 1];
    if (e.shiftKey && document.activeElement === primero) { e.preventDefault(); ultimo?.focus(); }
    else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primero?.focus(); }
  };

  return (
    <div className="xcf-velo" onMouseDown={(e) => { if (e.target === e.currentTarget) onCerrar(); }}>
      <div ref={caja} className="xcf-dialogo" role="dialog" aria-modal="true" aria-labelledby="xcf-nuevo-titulo" onKeyDown={tecla}>
        <header className="xcf-dialogo__cab">
          <h2 id="xcf-nuevo-titulo">Nuevo filtro</h2>
          <ol className="xcf-pasos" aria-label="Pasos">
            {PASOS.map((p, i) => (
              <li key={p} className={paso === i + 1 ? "is-actual" : paso > i + 1 ? "is-hecho" : undefined} aria-current={paso === i + 1 ? "step" : undefined}>
                {i + 1} · {p}
              </li>
            ))}
          </ol>
        </header>
        <div className="xcf-dialogo__cuerpo">
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
              <p className="xcf-nota">Filtro para <code>{destino.name}</code> · {INTENCIONES.find((x) => x.forma === forma)?.titulo.toLowerCase()}</p>
              <ConfigIntento intento={intento} onCambio={setIntento} candidatas={candidatasDe(destino.name)} choices={workbook.choices} />
            </>
          ) : null}
        </div>
        <footer className="xcf-dialogo__pie">
          <PulsoButton variant="secondary" size="md" onClick={paso === 1 ? onCerrar : () => setPaso(paso - 1)}>{paso === 1 ? "Cancelar" : "Atrás"}</PulsoButton>
          <PulsoButton variant="primary" size="md" disabled={!puedeSeguir} onClick={seguir}>{paso === 3 ? "Crear filtro" : "Continuar"}</PulsoButton>
        </footer>
      </div>
    </div>
  );
}
