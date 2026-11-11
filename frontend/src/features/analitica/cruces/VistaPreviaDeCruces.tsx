// Zona izquierda de Cruces: las tablas cruzadas del archivo tal como las
// devuelve la vista previa del motor. Cada estado ocupa el mismo contenedor:
// leyendo, lectura fallida (con el caso de una base sin preparar), archivo sin
// tablas (sin variables a cruzar, con su acción), hoja y hoja de una lectura
// anterior, atenuada, mientras llega la nueva o mientras un cambio espera a
// guardarse. En la cabecera: qué variable de cruce se ve e "Ir a una pregunta".

import { useEffect, useMemo, useRef, useState } from "react";

import type { CrucesPreview, VariableInstrumento } from "../../../api/analitica";
import { EstadoVacio } from "../../../components/EstadoVacio";
import { PulsoSelect } from "../../../components/PulsoSelect";
import { LoadingBlock } from "../../../components/States";
import { formatoConteo } from "../../../lib/formatoNumero";
import { GitBranch, Table2 } from "../../../vendor/lucide-react";
import type { ResumenSecciones } from "../estructuraDeSecciones";
import { AvisoDeGuardado } from "../tablas/AvisoDeGuardado";
import { FalloDeVistaPrevia } from "../tablas/FalloDeVistaPrevia";
import { IrAPregunta, type PreguntaParaIr } from "../tablas/IrAPregunta";
import { PanelDeZona } from "../tablas/PanelDeZona";
import { PieDeLaHoja, type LineaDelPie } from "../tablas/PieDeLaHoja";
import { siguienteLimite } from "../tablas/vistaPreviaModelo";
import {
  avisosDeCruces, causaDelVacio, cruceVigente, CRUCES_POR_PEDIDO, esLaTablaDe, preguntasDeLaHoja, sinTablaDeLaElegida, TODAS_LAS_VARIABLES,
  TOPE_DE_CRUCES, variablesDeCruce,
} from "./crucesModelo";
import { ElegirVariableACruzar } from "./ElegirVariableACruzar";
import { HojaDeCruces } from "./HojaDeCruces";
import type { VistaPreviaDeCruces as Vista } from "./useVistaPreviaDeCruces";

import "./cruces.css";

/** El valor de "Todas" en el select: la cadena vacía es "sin selección" para el kit. */
const TODAS = "*todas*";

export function VistaPreviaDeCruces({ vista, candidatas, cruzables, resumen, etiquetaDe, etiquetaDeBase, elegida, onElegir, onAgregarCruce }: {
  vista: Vista;
  /** Preguntas que se pueden pedir aparte cuando la hoja no las trae todas. */
  candidatas: readonly VariableInstrumento[];
  /** Variables que se pueden agregar como variable de cruce desde el vacío. */
  cruzables: VariableInstrumento[];
  resumen: ResumenSecciones;
  /** La pregunta de una variable, por su nombre. */
  etiquetaDe: (variable: string) => string;
  /** El nombre que ve el usuario de una base, por su identificador. */
  etiquetaDeBase: (base: string) => string;
  elegida: string | null;
  onElegir: (variable: string | null) => void;
  onAgregarCruce: (variable: string) => void;
}) {
  const cuerpo = useRef<HTMLDivElement>(null);
  const { hoja } = vista;
  const preview = hoja.datos;
  const tablas = preview?.tablas;

  // La tabla de la pregunta elegida, si se pidió aparte y es la vigente.
  const aparteDatos = vista.elegida?.datos ?? null;
  const aparte = elegida && aparteDatos ? aparteDatos.tablas.find((t) => esLaTablaDe(t, elegida)) ?? null : null;

  // Se suelta el foco de la dirección (useFoco quita `foco`; no escribe alias).
  useEffect(() => {
    if (vista.focoPerdido) onElegir(null);
  }, [vista.focoPerdido, onElegir]);

  // Qué variable de cruce se ve. Es estado de la vista: no cambia el archivo ni pide nada.
  const variables = useMemo(() => (preview ? variablesDeCruce(preview) : []), [preview]);
  const [cruceElegido, elegirCruce] = useState<string | null>(null);
  const cruce = cruceVigente(variables, cruceElegido);

  const preguntas = useMemo<PreguntaParaIr[]>(() => {
    if (!tablas) return [];
    const enLaHoja = preguntasDeLaHoja(tablas);
    if (!preview?.recortado) return enLaHoja;
    const vistas = new Set(tablas.map((t) => t.variable));
    const resto = candidatas
      .filter((v) => !vistas.has(v.name))
      .map((v) => ({ variable: v.name, codigo: v.name, etiqueta: v.label?.trim() || v.name }));
    return [...enLaHoja, ...resto];
  }, [tablas, preview?.recortado, candidatas]);

  const fallo = hoja.fase === "error" ? hoja : null;
  const leyendo = !fallo && preview === null;
  const hayHoja = !fallo && preview !== null && preview.tablas.length > 0;
  const vacia = !fallo && preview !== null && preview.tablas.length === 0;
  const vacio = vacia && preview ? causaDelVacio(preview, resumen) : null;

  // Saltar a la pregunta elegida: su tabla sube al tope de la hoja.
  useEffect(() => {
    if (!hayHoja || !elegida) return;
    const grupo = Array.from(cuerpo.current?.querySelectorAll<HTMLElement>("[data-variable]") ?? [])
      .find((el) => el.dataset.variable === elegida);
    if (grupo && typeof grupo.scrollIntoView === "function") grupo.scrollIntoView({ block: "start" });
  }, [elegida, hayHoja, aparte]);

  // El pie: el recorte, los avisos con su causa y, con varias bases, de cuál es la vista previa.
  const lineas = useMemo<LineaDelPie[]>(() => {
    if (!preview || fallo) return [];
    const avisos = avisosDeCruces(preview, etiquetaDe).map((a) => ({ clave: a.clave, alerta: true, texto: a.texto }));
    const sinTabla = elegida && aparteDatos && !vista.focoPerdido ? sinTablaDeLaElegida(aparteDatos, elegida, etiquetaDe) : null;
    const deLaElegida = sinTabla ? [{ clave: "elegida", alerta: true, texto: sinTabla }] : [];
    const bases = !vista.releyendo && preview.base.n_bases > 1
      ? [{
        clave: "bases",
        alerta: false,
        texto: `Vista previa de la base "${etiquetaDeBase(preview.base.nombre)}". Al generar sale un archivo por cada una de las ${formatoConteo(preview.base.n_bases)} bases.`,
      }]
      : [];
    return [...deLaElegida, ...avisos, ...bases];
  }, [preview, fallo, etiquetaDe, etiquetaDeBase, elegida, aparteDatos, vista.focoPerdido, vista.releyendo]);
  const recorte = preview && !fallo && preview.recortado
    ? {
      devueltas: preview.devueltas,
      total: preview.total_variables,
      limite: vista.limite,
      siguiente: siguienteLimite(vista.limite, preview.total_variables, CRUCES_POR_PEDIDO, TOPE_DE_CRUCES),
      onMostrarMas: vista.mostrarMas,
    }
    : null;
  const conPie = Boolean(vista.errorGuardado || recorte || lineas.length > 0);

  return (
    <PanelDeZona
      zona="tabla"
      titulo="Vista previa"
      icono={<Table2 size={16} aria-hidden="true" />}
      ocupado={vista.releyendo}
      acciones={hayHoja ? (
        <>
          {variables.length > 1 ? (
            <div className="cruces-selector">
              <span className="cruces-selector-rotulo" aria-hidden="true">Columnas de</span>
              <PulsoSelect
                size="sm"
                ariaLabel="Columnas de"
                value={cruce || TODAS}
                options={[
                  ...variables.map((v) => ({ value: v.variable, label: v.etiqueta, textValue: v.etiqueta })),
                  { value: TODAS, label: "Todas las variables de cruce", textValue: "Todas las variables de cruce" },
                ]}
                onValueChange={(v) => elegirCruce(v === TODAS ? TODAS_LAS_VARIABLES : v)}
              />
            </div>
          ) : null}
          <IrAPregunta preguntas={preguntas} elegida={elegida} onElegir={(v) => onElegir(v || null)} />
        </>
      ) : undefined}
      pie={conPie ? (
        <>
          {vista.errorGuardado ? <AvisoDeGuardado /> : null}
          {recorte || lineas.length > 0 ? <PieDeLaHoja recorte={recorte} lineas={lineas} /> : null}
        </>
      ) : undefined}
    >
      <div ref={cuerpo} className="tablas-vista cruces-vista" data-qa-geometry-group="analitica/cruces-tablas" data-qa-geometry-contract="intrinsic">
        {fallo ? <FalloDeVistaPrevia fallo={fallo} /> : null}
        {leyendo ? <LoadingBlock label="Leyendo las tablas cruzadas del archivo" /> : null}
        {vacio ? (
          <EstadoVacio
            tamano="normal"
            icono={vacio.agregarVariable ? <GitBranch size={20} /> : <Table2 size={20} />}
            titulo={vacio.titulo}
            descripcion={vacio.descripcion}
            accion={vacio.agregarVariable && cruzables.length > 0 ? (
              <div className="cruces-vacio-accion">
                <ElegirVariableACruzar variables={cruzables} rotulo="Elegir variable a cruzar" onElegir={onAgregarCruce} />
              </div>
            ) : undefined}
          />
        ) : null}
        {hayHoja && preview ? (
          <HojaDeCruces
            tablas={preview.tablas}
            ponderado={preview.ponderado}
            cruce={cruce}
            elegida={elegida}
            aparte={aparte}
            releyendo={vista.releyendo}
            maxLetras={preview.significancia_regla?.max_letras ?? undefined}
          />
        ) : null}
      </div>
    </PanelDeZona>
  );
}
