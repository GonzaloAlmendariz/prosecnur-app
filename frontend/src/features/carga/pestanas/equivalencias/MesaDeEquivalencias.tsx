import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AlertTriangle, Check, GitCompare, Layers, Plus } from "../../../../vendor/lucide-react";
import { EstadoVacio } from "../../../../components/EstadoVacio";
import type { CifraDePestana } from "../../../../components/procesamiento/CifrasDePestana";
import { MesaDePestana } from "../../../../components/procesamiento/MesaDePestana";
import { PanelDeMesa } from "../../../../components/procesamiento/PanelDeMesa";
import { PulsoButton } from "../../../../components/PulsoButton";
import { SaveStatusIndicator } from "../../../../components/SaveStatusIndicator";
import { formatoConteo } from "../../../../lib/formatoNumero";
import { conNivel } from "../../../../lib/navegacion/direccion";
import { PANEL_ARMONIZACION, focoDeFila } from "../../armonizacionModel";
import { ArmonizacionPeriodos } from "../../ArmonizacionPeriodos";
import { useAbrirArmonizacion } from "../../ArmonizacionFilaEditor";
import { ImportarBloquesBoton } from "../../ImportarBloquesDialog";
import { AnadirIndicadorCompuestoBoton, useAbrirIndicadorCompuesto } from "../../IndicadorCompuestoEditor";
import { MapaBasesBoton } from "../../MapaBasesPanel";
import { nombreDeSerieDeBases } from "../../nombreDeSerie";
import { RecorridoSerie } from "../../recorridoSerie/RecorridoSerie";
import { SegmentosBoton } from "../../segmentos/SegmentosPanel";
import { CabeceraDeMesaDeCarga } from "../revision/CabeceraDeMesaDeCarga";
import {
  HUECOS_DEL_MOTOR_EQUIVALENCIAS,
  cifrasDeEquivalencias,
  resumenDeEscalas,
  enumerarConY,
  conteoPorFiltro,
  filaDeFoco,
  filaDelInspector,
  filasDeMesa,
  filasVisibles,
  type FiltroDeEquivalencias,
} from "./equivalenciasMesaModel";
import { InspectorDeEquivalencia } from "./InspectorDeEquivalencia";
import { TablaDeEquivalencias } from "./TablaDeEquivalencias";
import type { FilaEditor } from "../../equivalenciasEditorModel";
import type { MatrizDeEquivalencias } from "./useMatrizDeEquivalencias";
import "../../../../app/tokens-datos.css";
import "../revision/marcoDeMesa.css";
import "./equivalencias.css";

/**
 * Carga › Equivalencias con la forma del prototipo "carga-equivalencias": la
 * cabecera con las cifras de la matriz y sus acciones, el recorrido de la
 * serie, a la izquierda la misma pregunta en cada base y a la derecha la fila
 * elegida, donde se ve su escala y se edita. La fila elegida va en `foco`
 * (su id de bloque o su posición guardada), el mismo que usa la armonización.
 */
export function MesaDeEquivalencias({ matriz }: { matriz: MatrizDeEquivalencias }) {
  const {
    estado, filas, variablesPorBase, bases, basesDeTabla, basesDeSerie, error, aviso, ocupado, sucio, guardado,
  } = matriz;
  const location = useLocation();
  const navigate = useNavigate();
  const abrirArmonizacion = useAbrirArmonizacion();
  const abrirCompuesto = useAbrirIndicadorCompuesto();
  const raiz = useRef<HTMLDivElement>(null);
  const [filtro, setFiltro] = useState<FiltroDeEquivalencias>("todas");
  const [busqueda, setBusqueda] = useState("");
  const [elegidaLocal, setElegidaLocal] = useState<string | null>(null);
  const [pedidoDeVista, setPedidoDeVista] = useState(0);

  // `foco` nombra la fila solo sin panel o con la armonización abierta: con el
  // mapa o los segmentos abiertos, `foco` es de ellos (una base, un segmento).
  const params = new URLSearchParams(location.search);
  const panel = params.get("panel");
  const focoDeFilas = !panel || panel === PANEL_ARMONIZACION.id ? params.get("foco") : null;
  const filaEnFoco = filaDeFoco(filas, focoDeFilas);

  const serie = useMemo(() => nombreDeSerieDeBases(basesDeTabla), [basesDeTabla]);
  const todas = useMemo(() => filasDeMesa(filas, basesDeTabla, variablesPorBase, serie), [filas, basesDeTabla, variablesPorBase, serie]);
  const nBases = basesDeTabla.length;
  const conteo = useMemo(() => conteoPorFiltro(todas, nBases), [todas, nBases]);
  const visibles = useMemo(() => filasVisibles(todas, filtro, busqueda, nBases), [todas, filtro, busqueda, nBases]);
  const elegida = filaDelInspector(visibles, todas, filaEnFoco?.id ?? elegidaLocal);
  const cifras = cifrasDeEquivalencias(todas, nBases);
  const escalas = useMemo(() => resumenDeEscalas(todas), [todas]);

  const elegir = useCallback((id: string, lista: readonly FilaEditor[] = filas) => {
    setElegidaLocal(id);
    setPedidoDeVista((n) => n + 1);
    const fila = lista.find((f) => f.id === id);
    if (panel) return;
    navigate({ pathname: location.pathname, search: conNivel(location.search, "foco", fila ? focoDeFila(fila) : null) }, { replace: true });
  }, [filas, panel, navigate, location.pathname, location.search]);

  // A lo angosto la mesa apila la tabla y el inspector: la fila elegida se lee
  // bajo la tabla, fuera de la vista. Solo entonces se lleva a la vista.
  useEffect(() => {
    if (pedidoDeVista === 0) return;
    const mesa = raiz.current;
    const tabla = mesa?.querySelector<HTMLElement>(".pulso-panel-de-mesa--equivalencias");
    const derecha = mesa?.querySelector<HTMLElement>(".pulso-panel-de-mesa--inspector");
    if (!tabla || !derecha) return;
    const apilada = derecha.getBoundingClientRect().top >= tabla.getBoundingClientRect().bottom - 1;
    if (apilada) derecha.scrollIntoView?.({ block: "start" });
  }, [pedidoDeVista]);

  // La fila elegida (por enlace o con el ratón) queda a la vista. La tabla se virtualiza: si la fila no
  // está pintada, el scroll se lleva cerca de su posición (alto de una fila pintada) y se ajusta después.
  const idElegida = elegida?.fila.id ?? null;
  const visiblesRef = useRef(visibles);
  visiblesRef.current = visibles;
  useEffect(() => {
    if (!idElegida) return undefined;
    let marco = 0;
    let intentos = 0;
    // La tabla pinta sus filas un cuadro después de montarse: se reintenta hasta tener una fila que medir.
    const llevar = () => {
      const scroll = raiz.current?.querySelector<HTMLElement>(".pulso-panel-de-mesa--equivalencias .pulso-table-scroll");
      const pintada = scroll?.querySelector<HTMLElement>('tbody tr[data-selected="true"]');
      if (scroll && pintada) {
        // Solo dentro de la tabla: `scrollIntoView` movería también el área de Carga y recortaría la cabecera.
        const cabecera = scroll.querySelector<HTMLElement>("thead")?.offsetHeight ?? 0;
        const caja = scroll.getBoundingClientRect();
        const fila = pintada.getBoundingClientRect();
        const arriba = scroll.scrollTop + (fila.top - caja.top) - cabecera;
        const abajo = scroll.scrollTop + (fila.bottom - caja.top) - scroll.clientHeight;
        if (scroll.scrollTop > arriba + 1) scroll.scrollTop = arriba;
        // La tabla engancha el scroll al inicio de cada fila (scroll-snap): una fila cortada abajo sube a la primera posición.
        else if (scroll.scrollTop < abajo - 1) scroll.scrollTop = arriba;
        else return;
        // La tabla vuelve a medir sus filas al desplazarse: se comprueba otra vez en el cuadro siguiente.
        intentos += 1;
        if (intentos < 6) marco = requestAnimationFrame(llevar);
        return;
      }
      const alto = scroll?.querySelector<HTMLElement>("tbody tr")?.offsetHeight ?? 0;
      const indice = visiblesRef.current.findIndex((f) => f.fila.id === idElegida);
      if (scroll && alto > 0 && indice >= 0) scroll.scrollTop = Math.max(0, indice * alto - scroll.clientHeight / 3);
      intentos += 1;
      if (intentos < 6) marco = requestAnimationFrame(llevar);
    };
    marco = requestAnimationFrame(llevar);
    return () => cancelAnimationFrame(marco);
  }, [idElegida]);

  // Guardar rehace las filas (identidad nueva): la elegida se vuelve a encontrar por su contenido y queda elegida y a la vista.
  const guardar = async () => {
    const antes = elegida?.fila ?? null;
    const posicion = antes ? filas.findIndex((f) => f.id === antes.id) : -1;
    const nuevas = await matriz.onGuardar();
    if (!antes || !nuevas) return;
    const huella = (f: { etiqueta_estandar: string; variables: Record<string, string> }) => `${f.etiqueta_estandar}|${JSON.stringify(Object.entries(f.variables).sort())}`;
    const misma = nuevas.find((f) => huella(f) === huella(antes)) ?? nuevas[Math.min(posicion, nuevas.length - 1)];
    if (misma) elegir(misma.id, nuevas);
  };

  const agregar = () => {
    const id = matriz.onAgregarFila();
    setFiltro("todas");
    setBusqueda("");
    elegir(id);
  };

  const plural = (n: number, uno: string, varios: string) => (n === 1 ? uno : varios);
  const cifrasDeCabecera: CifraDePestana[] = filas.length > 0 ? [
    { clave: "emparejadas", valor: formatoConteo(cifras.emparejadas), rotulo: plural(cifras.emparejadas, "pregunta emparejada", "preguntas emparejadas"), rango: 1 },
    // "Con escalas distintas" del prototipo no va: es la misma cifra que el estado "N por armonizar" y el filtro.
    {
      clave: "en-todas",
      valor: formatoConteo(cifras.enTodas),
      base: formatoConteo(cifras.emparejadas),
      rotulo: `en las ${formatoConteo(nBases)} bases`,
      rango: 3,
    },
  ] : [];

  const cabecera = (
    <CabeceraDeMesaDeCarga
      pestana="equivalencias"
      titulo="Equivalencias"
      estado={cifras.porArmonizar > 0 ? { tono: "parcial", texto: `${formatoConteo(cifras.porArmonizar)} por armonizar` } : null}
      cifras={cifrasDeCabecera}
      pendientes={HUECOS_DEL_MOTOR_EQUIVALENCIAS}
      acciones={(
        <>
          <ImportarBloquesBoton disabled={ocupado !== ""} />
          {guardado !== "idle" ? <SaveStatusIndicator state={guardado} variant="badge" /> : null}
          <PulsoButton variant="primary" size="md" onClick={() => void guardar()} disabled={ocupado !== "" || !sucio}>
            <Check size={14} aria-hidden="true" />
            Guardar
          </PulsoButton>
        </>
      )}
    />
  );

  // Bases cuyo formulario cambió o que perdieron preguntas desde que se declaró la matriz.
  const desfasadas = estado?.desfasadas ?? [];
  const conHuerfanas = bases.filter((b) => (estado?.cobertura?.[b]?.huerfanas ?? []).length > 0);
  const hayAvisos = Boolean(error || aviso || desfasadas.length || conHuerfanas.length);
  const avisos = hayAvisos ? (
    <div className="pulso-equiv-mesa-avisos">
      {error ? <p className="pulso-equiv-mesa-aviso is-error" role="alert">{error}</p> : null}
      {aviso && !error ? <p className="pulso-equiv-mesa-aviso" role="status">{aviso}</p> : null}
      {desfasadas.map((b) => (
        <p key={`d-${b}`} className="pulso-equiv-mesa-aviso is-atencion">
          <AlertTriangle size={14} aria-hidden="true" />
          {`El formulario de ${b} cambió después de declarar la matriz: revisa su columna.`}
        </p>
      ))}
      {conHuerfanas.length > 0 ? (
        <p className="pulso-equiv-mesa-aviso is-atencion">
          <AlertTriangle size={14} aria-hidden="true" />
          {`La matriz nombra variables que el formulario ya no tiene: ${enumerarConY(conHuerfanas.map((b) => {
            const h = estado?.cobertura?.[b]?.huerfanas ?? [];
            return h.length === 1 ? `${h[0]} en ${b}` : `${formatoConteo(h.length)} en ${b}`;
          }))}.`}
        </p>
      ) : null}
    </div>
  ) : undefined;

  const declarada = Boolean(estado?.declarada);
  const ordenEditable = Boolean(estado) && declarada && bases.length > 1 && filas.length > 0;

  const accionesDeAnadir = (
    <>
      <PulsoButton variant="secondary" size="lg" onClick={agregar}>
        <Plus size={14} aria-hidden="true" />
        Añadir pregunta equivalente
      </PulsoButton>
      <AnadirIndicadorCompuestoBoton onAbrir={() => abrirCompuesto()} />
    </>
  );

  return (
    <div ref={raiz} className="pulso-carga-mesa-kit pulso-equiv-mesa" data-carga-surface="equivalencias">
      <MesaDePestana
        grupo="carga/equivalencias"
        columnas={2}
        cabecera={cabecera}
        avisos={avisos}
        franja={(
          <RecorridoSerie
            forma="franja"
            escalas={escalas}
            bases={basesDeSerie}
            ordenDeclarado={(estado?.armonizacion_periodos ?? []).length > 0}
            ordenEditable={ordenEditable}
            filas={matriz.filasGuardadas}
          />
        )}
      >
        <PanelDeMesa
          zona="equivalencias"
          titulo="La misma pregunta en cada base"
          icono={<GitCompare size={16} />}
          conteo={filas.length > 0 ? filas.length : undefined}
          ocupado={ocupado !== ""}
          acciones={basesDeTabla.length > 0 ? (
            <>
              <MapaBasesBoton />
              <SegmentosBoton />
            </>
          ) : undefined}
          pie={filas.length > 0 ? accionesDeAnadir : undefined}
        >
          {filas.length > 0 ? (
            <TablaDeEquivalencias
                bases={basesDeTabla}
                filas={visibles}
                conteo={conteo}
                filtro={filtro}
                onFiltro={setFiltro}
                busqueda={busqueda}
                onBuscar={setBusqueda}
                elegida={elegida?.fila.id ?? null}
                onElegir={elegir}
              />
          ) : (
            // C5 categoría 1: el estudio todavía no declara equivalencias. El vacío dice qué falta y cómo se llena.
            <EstadoVacio
              tamano="normal"
              icono={<Layers size={18} />}
              titulo={declarada ? "La matriz no tiene preguntas" : "Este estudio todavía no declara equivalencias"}
              descripcion="La matriz dice qué pregunta de cada base es la misma, para poder compararlas entre públicos."
              accion={<div className="pulso-equiv-mesa-anadir">{accionesDeAnadir}</div>}
            />
          )}
        </PanelDeMesa>
        <InspectorDeEquivalencia
          elegida={elegida}
          filas={filas}
          bases={basesDeTabla}
          variablesPorBase={variablesPorBase}
          onEditarNombre={matriz.onEditarNombre}
          onAsignar={matriz.onAsignar}
          onQuitar={matriz.onQuitar}
          onConfirmar={matriz.onConfirmar}
          onArmonizar={abrirArmonizacion}
          onIndicadorCompuesto={abrirCompuesto}
          onSegmento={matriz.abrirSegmento}
        />
      </MesaDePestana>
      {/* El orden de la serie se lee y se abre desde el paso "Bases" del recorrido (`panel=orden-serie`). */}
      {estado && ordenEditable ? <ArmonizacionPeriodos estado={estado} onGuardado={matriz.onArmonizacionGuardada} soloEditor /> : null}
    </div>
  );
}
