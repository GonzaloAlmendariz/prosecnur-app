// Biblioteca de íconos de un capítulo del índice (A5 rebanada 2b, W2): diálogo direccionable `panel=iconos`. Ofrece
// «Automático» (lo que elige el motor por el título, con su motivo), «Sin ícono» y los íconos navy del recetario. Es un
// grupo de radios nativo (flechas para recorrerlo); nada se guarda hasta «Usar este ícono», Escape cancela.

import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { AlertTriangle, Ban, Loader2, RefreshCw, Search, Sparkles, X } from "../../../vendor/lucide-react";
import { apiGraficosElegirIconos, type EleccionIcono } from "../../../api/graficosRecursos";
import { PulsoButton } from "../../../components/PulsoButton";
import { usePanelDireccionable } from "../../../lib/navegacion/paneles";
import { PANEL_ICONOS } from "../panelesGraficos";
import { useLibraryDialogA11y } from "../useLibraryDialogA11y";
import { useIndiceUi } from "./indiceUiStore";
import { ICONO_AUTOMATICO, iconoEnBiblioteca, SIN_ICONO, type IndiceEditable } from "./modeloIndice";
import { useIconosRecetario } from "./useIconosRecetario";
import "../laminas/selectores/selectores.css";
import "./editorIndice.css";

type Props = {
  indice: IndiceEditable;
  onElegir: (capitulo: number, icono: string) => void;
};

/** Cómo se nombra un ícono guardado: «Automático», «Sin ícono» o su nombre de la biblioteca. */
export function rotuloIcono(icono: string): string {
  if (icono === ICONO_AUTOMATICO) return "Automático";
  if (icono === SIN_ICONO) return "Sin ícono";
  return iconoEnBiblioteca(icono).replace(/-/g, " ");
}

export function BibliotecaIconos({ indice, onElegir }: Props) {
  const panel = usePanelDireccionable(PANEL_ICONOS);
  const capituloIcono = useIndiceUi((s) => s.capituloIcono);
  // Por enlace (`?panel=iconos`) no hay capítulo elegido: se abre el primero.
  const k = capituloIcono !== null && capituloIcono < indice.capitulos.length ? capituloIcono : 0;
  const capitulo = indice.capitulos[k] ?? null;
  const abierto = panel.abierto;
  return (
    <Dialog.Root modal open={abierto} onOpenChange={(siguiente) => { if (!siguiente && abierto) panel.cerrar(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="pulso-f6-selector-velo" />
        {abierto && (
          <ContenidoBiblioteca
            key={`${k}-${capitulo?.icono ?? ""}`}
            panelProps={panel.props}
            numero={k + 1}
            titulo={capitulo?.titulo.trim() ?? ""}
            actual={capitulo ? capitulo.icono : null}
            onCerrar={panel.cerrar}
            onUsar={(icono) => { if (capitulo) onElegir(k, icono); panel.cerrar(); }}
          />
        )}
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function ContenidoBiblioteca({ panelProps, numero, titulo, actual, onCerrar, onUsar }: {
  panelProps: { "data-pulso-panel": string };
  numero: number;
  titulo: string;
  /** `null`: el índice no tiene capítulos. */
  actual: string | null;
  onCerrar: () => void;
  onUsar: (icono: string) => void;
}) {
  const id = useId();
  const buscarRef = useRef<HTMLInputElement>(null);
  const anclaRef = useRef<HTMLDivElement>(null);
  const a11y = useLibraryDialogA11y({ searchRef: buscarRef, fallbackFocusRef: anclaRef });
  const inicial = actual === null || actual === ICONO_AUTOMATICO || actual === SIN_ICONO ? (actual ?? ICONO_AUTOMATICO) : iconoEnBiblioteca(actual);
  const [eleccion, setEleccion] = useState(inicial);
  const [consulta, setConsulta] = useState("");
  const iconos = useIconosRecetario({ nombres: [], todos: true });
  const auto = useEleccionAutomatica(titulo);
  const filtrados = useMemo(() => {
    const q = consulta.trim().toLowerCase().replace(/\s+/g, "-");
    return (iconos.nombres ?? []).filter((n) => !q || n.includes(q));
  }, [consulta, iconos.nombres]);
  const desconocido = inicial !== ICONO_AUTOMATICO && inicial !== SIN_ICONO && iconos.nombres !== null && !iconos.nombres.includes(inicial);

  return (
    <Dialog.Content
      {...panelProps}
      {...a11y}
      className="pulso-f6-selector pulso-f6-iconos"
      data-audit-ready={iconos.nombres || iconos.error ? "f6-iconos-indice" : "false"}
      data-qa-surface="graficos/f6-iconos-indice"
      aria-modal="true"
    >
      <header className="pulso-f6-selector-cabecera">
        <div className="pulso-f6-selector-titulos" ref={anclaRef} tabIndex={-1}>
          <span className="pulso-f6-selector-antetitulo">Índice</span>
          <Dialog.Title className="pulso-f6-selector-titulo">
            {actual === null ? "Íconos del índice" : `Ícono del capítulo ${numero}`}
          </Dialog.Title>
          <Dialog.Description className="pulso-f6-selector-descripcion">
            {actual === null ? "El índice no tiene capítulos: añade uno para elegir su ícono." : titulo ? `«${titulo}»` : "Capítulo sin título"}
          </Dialog.Description>
        </div>
        <Dialog.Close className="pulso-f6-icono-boton pulso-f6-selector-cerrar" aria-label="Cerrar sin cambiar">
          <X size={16} aria-hidden="true" />
        </Dialog.Close>
      </header>

      <div className="pulso-f6-iconos-cuerpo" data-qa-geometry-group="graficos/f6-iconos-indice" data-qa-geometry-contract="intrinsic">
        <div className="pulso-f6-iconos-buscar">
          <Search size={14} aria-hidden="true" />
          <input
            ref={buscarRef}
            type="search"
            className="pulso-f6-input"
            aria-label="Buscar un ícono por su nombre"
            placeholder="Buscar: persona, gráfico, casa…"
            value={consulta}
            onChange={(e) => setConsulta(e.target.value)}
            disabled={actual === null}
          />
        </div>

        <fieldset className="pulso-f6-iconos-opciones" disabled={actual === null} data-qa-geometry-member data-qa-scroll-owner="f6-iconos-indice">
          <legend className="pulso-sr-only">Ícono del capítulo {numero}</legend>
          <div className="pulso-f6-iconos-especiales">
            <label className="pulso-f6-icono-opcion is-especial">
              <input type="radio" className="pulso-f6-radio-oculto" name={`${id}-icono`} checked={eleccion === ICONO_AUTOMATICO}
                onChange={() => setEleccion(ICONO_AUTOMATICO)} />
              <span className="pulso-f6-icono-muestra">
                {auto && iconos.imagenes.get(auto.icono)
                  ? <img src={iconos.imagenes.get(auto.icono)} alt="" />
                  : <Sparkles size={18} aria-hidden="true" />}
              </span>
              <span className="pulso-f6-icono-texto">
                <strong>Automático</strong>
                <small>{auto ? `El motor elige «${rotuloIcono(auto.icono)}»${auto.motivo ? `: ${auto.motivo}` : ""}` : "El motor lo elige por el título del capítulo."}</small>
              </span>
            </label>
            <label className="pulso-f6-icono-opcion is-especial">
              <input type="radio" className="pulso-f6-radio-oculto" name={`${id}-icono`} checked={eleccion === SIN_ICONO}
                onChange={() => setEleccion(SIN_ICONO)} />
              <span className="pulso-f6-icono-muestra"><Ban size={18} aria-hidden="true" /></span>
              <span className="pulso-f6-icono-texto">
                <strong>Sin ícono</strong>
                <small>El capítulo sale sólo con su número y su título.</small>
              </span>
            </label>
            {desconocido && (
              <label className="pulso-f6-icono-opcion is-especial">
                <input type="radio" className="pulso-f6-radio-oculto" name={`${id}-icono`} checked={eleccion === inicial}
                  onChange={() => setEleccion(inicial)} />
                <span className="pulso-f6-icono-muestra"><AlertTriangle size={18} aria-hidden="true" /></span>
                <span className="pulso-f6-icono-texto">
                  <strong>El actual: {actual}</strong>
                  <small>No está en la biblioteca de íconos.</small>
                </span>
              </label>
            )}
          </div>

          {iconos.error ? (
            <p className="pulso-f6-iconos-estado is-error" role="alert">
              <AlertTriangle size={14} aria-hidden="true" />
              <span>No se pudo leer la biblioteca: {iconos.error}</span>
              <button type="button" className="pulso-f6-texto-boton" onClick={iconos.reintentar}>
                <RefreshCw size={12} aria-hidden="true" /> Reintentar
              </button>
            </p>
          ) : iconos.nombres === null ? (
            <p className="pulso-f6-iconos-estado" role="status">
              <Loader2 size={14} className="pulso-spin" aria-hidden="true" /> Cargando íconos…
            </p>
          ) : filtrados.length === 0 ? (
            <p className="pulso-f6-iconos-estado" role="status">Ningún ícono se llama así. Prueba con otra palabra.</p>
          ) : (
            <div className="pulso-f6-iconos-rejilla" data-qa-geometry-group="graficos/f6-iconos-rejilla" data-qa-geometry-contract="equal">
              {filtrados.map((n) => {
                const img = iconos.imagenes.get(n);
                return (
                  <label key={n} className="pulso-f6-icono-opcion" title={n.replace(/-/g, " ")} data-qa-geometry-member>
                    <input type="radio" className="pulso-f6-radio-oculto" name={`${id}-icono`} value={n} checked={eleccion === n}
                      onChange={() => setEleccion(n)} aria-label={n.replace(/-/g, " ")} />
                    <span className="pulso-f6-icono-muestra">{img ? <img src={img} alt="" /> : null}</span>
                    <span className="pulso-f6-icono-nombre" aria-hidden="true">{n.replace(/-/g, " ")}</span>
                  </label>
                );
              })}
            </div>
          )}
        </fieldset>
      </div>

      <footer className="pulso-f6-iconos-pie">
        <PulsoButton variant="secondary" size="sm" onClick={onCerrar}>Cancelar</PulsoButton>
        <PulsoButton
          variant="primary"
          size="sm"
          disabled={actual === null}
          onClick={() => (eleccion === inicial ? onCerrar() : onUsar(eleccion))}
        >
          Usar este ícono
        </PulsoButton>
      </footer>
    </Dialog.Content>
  );
}

/** Lo que el motor elegiría para el título (`/iconos-recetario/elegir`); `null` mientras no se sabe o si falla. */
function useEleccionAutomatica(titulo: string): EleccionIcono | null {
  const [eleccion, setEleccion] = useState<{ titulo: string; e: EleccionIcono } | null>(null);
  useEffect(() => {
    if (!titulo) return;
    let vivo = true;
    apiGraficosElegirIconos("capitulo", [titulo])
      .then((r) => { if (vivo && r[0]) setEleccion({ titulo, e: r[0] }); })
      .catch(() => { /* Sin la elección del motor, «Automático» se explica por su regla general. */ });
    return () => { vivo = false; };
  }, [titulo]);
  return eleccion && eleccion.titulo === titulo ? eleccion.e : null;
}
