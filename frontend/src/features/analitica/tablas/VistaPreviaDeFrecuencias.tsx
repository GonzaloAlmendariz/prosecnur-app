// Zona izquierda de Frecuencias: las tablas del archivo tal como las devuelve
// la vista previa del motor, con los pesos ya aplicados. Cada estado ocupa el
// mismo contenedor: leyendo, lectura fallida (con el caso de una base sin
// preparar), archivo sin tablas, hoja y hoja de una lectura anterior,
// atenuada, mientras llega la nueva o mientras un cambio espera a guardarse.

import { useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";

import type { FrecuenciasPreview, VariableInstrumento } from "../../../api/analitica";
import { EstadoVacio } from "../../../components/EstadoVacio";
import { PulsoButton } from "../../../components/PulsoButton";
import { LoadingBlock } from "../../../components/States";
import { Table2 } from "../../../vendor/lucide-react";
import { DIRECCION_DATOS } from "../direccionesAnalitica";
import { AvisoDeGuardado } from "./AvisoDeGuardado";
import { FalloDeVistaPrevia } from "./FalloDeVistaPrevia";
import { HojaDeFrecuencias } from "./HojaDeFrecuencias";
import { IrAPregunta, type PreguntaParaIr } from "./IrAPregunta";
import { PanelDeZona } from "./PanelDeZona";
import { PieDeVistaPrevia } from "./PieDeVistaPrevia";
import type { VistaPreviaDeFrecuencias as Vista } from "./useVistaPreviaDeFrecuencias";
import { codigoDeLaTabla, esLaVariable, tienePie } from "./vistaPreviaModelo";

export function VistaPreviaDeFrecuencias({ vista, candidatas, causaDelVacio, elegida, onElegir }: {
  vista: Vista;
  /** Preguntas que se pueden pedir aparte cuando la hoja no las trae todas. */
  candidatas: readonly VariableInstrumento[];
  /** Por qué el archivo no tendría tablas. */
  causaDelVacio: (preview: FrecuenciasPreview) => string;
  elegida: string | null;
  onElegir: (variable: string | null) => void;
}) {
  const navegar = useNavigate();
  const cuerpo = useRef<HTMLDivElement>(null);
  const { hoja } = vista;
  const preview = hoja.datos;
  const tablas = preview?.tablas;

  // La tabla de la pregunta elegida, si se pidió aparte y es la vigente.
  const aparteDatos = vista.elegida?.datos ?? null;
  const aparte = elegida && aparteDatos ? aparteDatos.tablas.find((t) => esLaVariable(t, elegida)) ?? null : null;
  const sinTabla = useMemo(() => {
    // Un foco que perdió su tabla por un ajuste se suelta sin aviso: nadie la pidió.
    const deLaElegida = elegida && aparteDatos && !vista.focoPerdido ? aparteDatos.sin_tabla.filter((s) => s.variable === elegida) : [];
    return [...(preview?.sin_tabla ?? []), ...deLaElegida];
  }, [preview, aparteDatos, elegida, vista.focoPerdido]);

  // Se suelta el foco de la dirección (useFoco quita `foco`; no escribe alias).
  useEffect(() => {
    if (vista.focoPerdido) onElegir(null);
  }, [vista.focoPerdido, onElegir]);

  // Las preguntas del selector: las de la hoja, en su orden, y, si la hoja
  // está recortada, las demás que se pueden pedir aparte.
  const preguntas = useMemo<PreguntaParaIr[]>(() => {
    if (!tablas) return [];
    const enLaHoja = tablas.map((t) => ({ variable: t.variable, codigo: codigoDeLaTabla(t), etiqueta: t.etiqueta }));
    if (!preview?.recortado) return enLaHoja;
    const vistas = new Set(tablas.flatMap((t) => [t.variable, t.variable_origen ?? t.variable]));
    const resto = candidatas
      .filter((v) => !vistas.has(v.name))
      .map((v) => ({ variable: v.name, codigo: v.name, etiqueta: v.label?.trim() || v.name }));
    return [...enLaHoja, ...resto];
  }, [tablas, preview?.recortado, candidatas]);

  const fallo = hoja.fase === "error" ? hoja : null;
  const leyendo = !fallo && preview === null;
  const hayHoja = !fallo && preview !== null && preview.tablas.length > 0;
  const vacia = !fallo && preview !== null && preview.tablas.length === 0;

  // Saltar a la pregunta elegida: su tabla sube al tope de la hoja.
  useEffect(() => {
    if (!hayHoja || !elegida) return;
    const grupo = Array.from(cuerpo.current?.querySelectorAll<HTMLElement>("[data-variable]") ?? [])
      .find((el) => el.dataset.variable === elegida || el.dataset.origen === elegida);
    if (grupo && typeof grupo.scrollIntoView === "function") grupo.scrollIntoView({ block: "start" });
  }, [elegida, hayHoja, aparte]);

  return (
    <PanelDeZona
      zona="tabla"
      titulo="Vista previa"
      icono={<Table2 size={16} aria-hidden="true" />}
      ocupado={vista.releyendo}
      acciones={hayHoja ? (
        <IrAPregunta preguntas={preguntas} elegida={elegida} onElegir={(v) => onElegir(v || null)} />
      ) : undefined}
      pie={vista.errorGuardado || (preview && !fallo && tienePie(preview, sinTabla, vista.releyendo)) ? (
        <>
          {vista.errorGuardado ? <AvisoDeGuardado /> : null}
          {preview && !fallo && tienePie(preview, sinTabla, vista.releyendo) ? (
            <PieDeVistaPrevia preview={preview} sinTabla={sinTabla} limite={vista.limite} onMostrarMas={vista.mostrarMas} releyendo={vista.releyendo} />
          ) : null}
        </>
      ) : undefined}
    >
      <div ref={cuerpo} className="tablas-vista" data-qa-geometry-group="analitica/frecuencias-tablas" data-qa-geometry-contract="intrinsic">
        {fallo ? <FalloDeVistaPrevia fallo={fallo} /> : null}
        {leyendo ? <LoadingBlock label="Leyendo las tablas del archivo" /> : null}
        {vacia && preview ? (
          <EstadoVacio
            tamano="normal"
            icono={<Table2 size={20} />}
            titulo="Sin tablas en el archivo"
            descripcion={causaDelVacio(preview)}
            accion={<PulsoButton variant="secondary" nav onClick={() => navegar(DIRECCION_DATOS)}>Ir a Datos</PulsoButton>}
          />
        ) : null}
        {hayHoja && preview ? (
          <HojaDeFrecuencias
            tablas={preview.tablas}
            ponderado={preview.ponderado}
            elegida={elegida}
            aparte={aparte}
            releyendo={vista.releyendo}
          />
        ) : null}
      </div>
    </PanelDeZona>
  );
}
