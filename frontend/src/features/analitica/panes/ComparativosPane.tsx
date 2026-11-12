// Pestaña Comparativos de Analítica (contrato E4-E7, R4) con la forma del
// prototipo ("Analítica, Comparativos"): la cabecera con las cifras de la serie y
// "Generar Excel", la franja de la serie y dos columnas que llegan al pie. A la
// izquierda las preguntas armonizadas, una fila por pregunta y una columna por
// base; a la derecha las columnas del comparativo con sus ajustes y los dos
// archivos. Las variables de cruce, las notas al pie y el resumen de lo generado
// se abren en paneles laterales direccionables. La fila elegida va en `?foco=`.
//
// Readiness propia (`readinessPropia` en el catálogo): la pestaña lee la matriz
// aparte del `preparar` de la sección, así que publica su marca en sus tres
// estados terminales (cargada, sin serie que comparar y error).

import { useEffect, useMemo, useReducer, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import {
  apiAnaliticaComparativoCruces,
  apiAnaliticaComparativoFrecuencias,
  normalizarComparativoResultado,
  type ComparativoResultado,
  type ComparativoTipo,
} from "../../../api/analitica";
import { getEquivalencias, type EquivalenciasEstado } from "../../../api/equivalencias";
import { CargaDeBloque } from "../../../components/CargaDeBloque";
import { ContenedorEntregable } from "../../../components/entregables/ContenedorEntregable";
import { descargarDelServidor } from "../../../components/entregables/entregaArchivo";
import { useGeneracion } from "../../../components/entregables/useGeneracion";
import { EstadoVacio } from "../../../components/EstadoVacio";
import { MesaDePestana, PilaDeMesa } from "../../../components/procesamiento/MesaDePestana";
import { PulsoButton } from "../../../components/PulsoButton";
import { ErrorBlock } from "../../../components/States";
import { conNivel } from "../../../lib/navegacion/direccion";
import { usePanelDireccionable } from "../../../lib/navegacion/paneles";
import { rotuloDeMatriz } from "../../../lib/rotuloDeMatriz";
import { ArrowRight, Download, FileSpreadsheet, GitCompare } from "../../../vendor/lucide-react";
import { nombreDeSerie } from "../../carga/nombreDeSerie";
import { CabeceraDeComparativos } from "../comparativos/CabeceraDeComparativos";
import { FranjaDeLaSerie } from "../comparativos/FranjaDeLaSerie";
import {
  cifrasDeComparativos,
  cifrasDeLaCabecera,
  estadoDeArchivo,
  estadoDeComparativos,
  filasVisibles,
  filtroInicial,
  opcionesDeFiltro,
  type FiltroDeCobertura,
} from "../comparativos/modeloDeComparativos";
import { PanelDeArchivos } from "../comparativos/PanelDeArchivos";
import { PanelDeColumnas } from "../comparativos/PanelDeColumnas";
import { PanelDeCruces } from "../comparativos/PanelDeCruces";
import { PanelDeNotas } from "../comparativos/PanelDeNotas";
import { ResumenDelComparativo } from "../comparativos/ResumenDelComparativo";
import { TablaDelComparativo } from "../comparativos/TablaDelComparativo";
import { PANEL_COMPARATIVO_CRUCES, PANEL_COMPARATIVO_NOTAS, PANEL_COMPARATIVO_RESUMEN } from "../panelesAnalitica";
import { useAnaliticaStore } from "../store";
import { usePonderacionDeLaSerie } from "../usePonderacionDeLaSerie";
import { AvisoPonderacionSerie } from "./ComparativosPonderacion";
import {
  DIRECCION_EQUIVALENCIAS,
  accionParaError,
  bloqueoDeGeneracion,
  clavesCrucesPorDefecto,
  comparativosReducer,
  construirBody,
  errorDesde,
  estadoInicial,
  filasArmonizadas,
  motivoVacio,
  omitidasDe,
  opcionesDeNotaComparativo,
  periodosDeSerie,
  type MotivoVacio,
} from "./comparativosModel";
import "./ComparativosPane.css";
import "./ComparativosPonderacion.css";
import "../comparativos/comparativos.css";

type Carga =
  | { estado: "cargando" }
  | { estado: "error"; mensaje: string }
  | { estado: "lista"; equivalencias: EquivalenciasEstado };

const COPY_VACIO: Record<MotivoVacio, { titulo: string; pista: string }> = {
  "sin-equivalencias": {
    titulo: "Aún no hay matriz de equivalencias",
    pista: "Declara en Carga, pestaña Equivalencias, qué variable es la misma pregunta en cada base. Después vuelve aquí para generar el comparativo.",
  },
  "sin-armonizadas": {
    titulo: "Ninguna pregunta se puede comparar",
    pista: "Ninguna fila de la matriz tiene una escala común en sus bases. Ármala en Carga, pestaña Equivalencias.",
  },
  "sin-serie": {
    titulo: "La serie tiene menos de dos bases",
    pista: "Un comparativo necesita al menos dos bases en el orden de la serie. Revísalo en Carga, pestaña Equivalencias.",
  },
};

export function ComparativosPane() {
  const [carga, setCarga] = useState<Carga>({ estado: "cargando" });
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    let cancelado = false;
    setCarga({ estado: "cargando" });
    getEquivalencias()
      .then((equivalencias) => { if (!cancelado) setCarga({ estado: "lista", equivalencias }); })
      .catch((e: unknown) => { if (!cancelado) setCarga({ estado: "error", mensaje: e instanceof Error ? e.message : String(e) }); });
    return () => { cancelado = true; };
  }, [intento]);

  if (carga.estado === "cargando") return <CargaDeBloque label="Leyendo la matriz de equivalencias" />;
  if (carga.estado === "error") {
    return (
      <div data-audit-ready="analitica-comparativos" className="comparativos-superficie">
        <ErrorBlock
          label="No se pudo leer la matriz de equivalencias"
          detail={carga.mensaje}
          queda="La matriz sigue guardada en el proyecto."
          variante="enmarcado"
          acciones={<PulsoButton variant="secondary" onClick={() => setIntento((n) => n + 1)}>Volver a leer</PulsoButton>}
        />
      </div>
    );
  }
  const motivo = motivoVacio(carga.equivalencias);
  if (motivo) {
    return (
      <div data-audit-ready="analitica-comparativos" className="comparativos-superficie comparativos-superficie--vacia">
        <EstadoVacio
          tamano="normal"
          icono={<GitCompare size={18} />}
          titulo={COPY_VACIO[motivo].titulo}
          descripcion={COPY_VACIO[motivo].pista}
          accion={(
            <Link className="pulso-comparativos-enlace" to={DIRECCION_EQUIVALENCIAS}>
              Ir a Equivalencias <ArrowRight size={14} aria-hidden="true" />
            </Link>
          )}
        />
      </div>
    );
  }
  return <ComparativosMesa equivalencias={carga.equivalencias} />;
}

/** El código del motor viene en `ApiError` o al final del mensaje del job (`errorDesde`): el contenedor lo muestra aparte. */
function describirErrorComparativo(e: unknown) {
  const { mensaje, codigo } = errorDesde(e);
  return { causa: mensaje, codigo };
}

const TITULO_COMPARATIVO: Record<ComparativoTipo, string> = {
  frecuencias: "Comparativo simple",
  cruces: "Comparativo de cruces",
};

function ComparativosMesa({ equivalencias }: { equivalencias: EquivalenciasEstado }) {
  const filas = useMemo(() => filasArmonizadas(equivalencias), [equivalencias]);
  const periodos = useMemo(() => periodosDeSerie(equivalencias), [equivalencias]);
  const [ui, dispatch] = useReducer(comparativosReducer, undefined, () => estadoInicial(filas, periodos));
  const [filtro, setFiltro] = useState<FiltroDeCobertura>(() => filtroInicial(filas, periodos.length));
  const [consulta, setConsulta] = useState("");
  const [pedido, setPedido] = useState<ComparativoTipo | null>(null);
  const ponderacion = usePonderacionDeLaSerie(periodos);
  const conLetras = useAnaliticaStore((s) => s.config.cruces.show_sig);
  const setCruces = useAnaliticaStore((s) => s.setCruces);
  const panelCruces = usePanelDireccionable(PANEL_COMPARATIVO_CRUCES);
  const panelNotas = usePanelDireccionable(PANEL_COMPARATIVO_NOTAS);
  const panelResumen = usePanelDireccionable(PANEL_COMPARATIVO_RESUMEN);
  const location = useLocation();
  const navigate = useNavigate();
  const foco = new URLSearchParams(location.search).get("foco");

  const entrega = useGeneracion({
    titulo: TITULO_COMPARATIVO.frecuencias,
    modulo: "Procesamiento",
    formato: "xlsx",
    articulo: "el",
    describirError: describirErrorComparativo,
  });
  const enCurso = entrega.estado.fase === "en_curso";
  const bloqueo = { frecuencias: bloqueoDeGeneracion(ui, "frecuencias"), cruces: bloqueoDeGeneracion(ui, "cruces") };

  async function generar(tipo: ComparativoTipo) {
    if (bloqueo[tipo] || enCurso) return;
    setPedido(tipo);
    const body = construirBody(ui, tipo, filas, periodos);
    const r = await entrega.ejecutar(
      () => (tipo === "cruces" ? apiAnaliticaComparativoCruces(body) : apiAnaliticaComparativoFrecuencias(body)),
      { titulo: TITULO_COMPARATIVO[tipo] },
    );
    if (r.ok) dispatch({ tipo: "listo", comparativo: tipo, datos: normalizarComparativoResultado(r.datos) });
  }

  const segmentos = useMemo(() => clavesCrucesPorDefecto(filas), [filas]);
  const visibles = useMemo(() => filasVisibles(filas, filtro, periodos.length, consulta), [filas, filtro, periodos.length, consulta]);
  const nOmitidas = ui.resultado ? omitidasDe(ui.resultado.datos.resumen).length : 0;
  const estadoDe = (tipo: ComparativoTipo) => estadoDeArchivo(tipo, { pedido, enCurso, resultado: ui.resultado, nOmitidas, bloqueo: bloqueo[tipo] });
  const nombresDeCruce = filas.filter((f) => ui.cruces.includes(f.clave)).map((f) => rotuloDeMatriz(f.etiqueta));
  const nNotas = Object.values(ui.notasPregunta).filter((t) => t.trim()).length
    + ui.notasGenerales.split("\n").filter((l) => l.trim()).length;
  const serie = nombreDeSerie(periodos.map((p) => (ui.rotulos[p] ?? "").trim() || p));

  return (
    <div className="comparativos-superficie" data-audit-ready="analitica-comparativos">
      <MesaDePestana
        grupo="analitica/comparativos"
        columnas={2}
        cabecera={(
          <CabeceraDeComparativos
            cifras={cifrasDeLaCabecera(cifrasDeComparativos(equivalencias, filas, periodos))}
            estado={estadoDeComparativos(entrega.estado.fase, ui.resultado !== null)}
            acciones={(
              <PulsoButton
                variant="primary"
                disabled={enCurso || bloqueo.frecuencias !== null}
                aria-busy={(enCurso && pedido === "frecuencias") || undefined}
                title={bloqueo.frecuencias ?? undefined}
                onClick={() => { void generar("frecuencias"); }}
              >
                <FileSpreadsheet size={14} aria-hidden="true" /> Generar Excel
              </PulsoButton>
            )}
          />
        )}
        avisos={<FranjaDeLaSerie nBases={periodos.length} />}
      >
        <TablaDelComparativo
          visibles={visibles}
          opciones={opcionesDeFiltro(filas, periodos.length)}
          filtro={filtro}
          consulta={consulta}
          periodos={periodos}
          rotulos={ui.rotulos}
          elegidas={ui.preguntas}
          segmentos={segmentos}
          foco={foco}
          onFiltro={setFiltro}
          onBuscar={setConsulta}
          onAlternar={(clave) => dispatch({ tipo: "alternar-pregunta", clave })}
          onElegirVarias={(claves, valor) => dispatch({ tipo: "elegir-preguntas", claves, valor })}
          onFoco={(clave) => navigate({ pathname: location.pathname, search: conNivel(location.search, "foco", clave) }, { replace: true })}
        />
        <PilaDeMesa grupo="analitica/comparativos">
          <PanelDeColumnas
            periodos={periodos}
            rotulos={ui.rotulos}
            ponderacion={ponderacion}
            conLetras={conLetras}
            cruces={nombresDeCruce}
            notas={nNotas}
            onRotulo={(base, valor) => dispatch({ tipo: "rotulo", base, valor })}
            onLetras={() => setCruces({ show_sig: !conLetras })}
            onCruces={panelCruces.abrir}
            onNotas={panelNotas.abrir}
          />
          <PanelDeArchivos
            estados={{ frecuencias: estadoDe("frecuencias"), cruces: estadoDe("cruces") }}
            ocupado={enCurso}
            aviso={<AvisoPonderacionSerie lectura={ponderacion} />}
            contenedor={(
              <ContenedorEntregable
                estado={entrega.estado}
                forma="bloque"
                onCerrar={entrega.cerrar}
                pie={entrega.estado.fase === "fallo"
                  ? <AccionDelFallo codigo={entrega.estado.codigo ?? null} />
                  : entrega.estado.fase === "lista" && ui.resultado ? <ManifiestoAlPie datos={ui.resultado.datos} /> : undefined}
              />
            )}
            onGenerar={(tipo) => { void generar(tipo); }}
            onResumen={panelResumen.abrir}
          />
        </PilaDeMesa>
      </MesaDePestana>

      <PanelDeCruces
        filas={filas}
        elegidas={ui.cruces}
        marcadas={segmentos}
        periodos={periodos}
        rotulos={ui.rotulos}
        serie={serie}
        onAlternar={(clave) => dispatch({ tipo: "alternar-cruce", clave })}
      />
      <PanelDeNotas
        preguntas={opcionesDeNotaComparativo(filas, ui.preguntas)}
        notasPregunta={ui.notasPregunta}
        notasGenerales={ui.notasGenerales}
        onNota={(clave, valor) => dispatch({ tipo: "nota-pregunta", clave, valor })}
        onGenerales={(valor) => dispatch({ tipo: "notas-generales", valor })}
      />
      <ResumenDelComparativo resultado={ui.resultado} />
    </div>
  );
}

/** Dónde se resuelve el fallo (Equivalencias, Ponderación, Bases), como acción neutra al pie del contenedor. */
function AccionDelFallo({ codigo }: { codigo: string | null }) {
  const navegar = useNavigate();
  const accion = accionParaError(codigo);
  if (!accion) return null;
  return (
    <PulsoButton variant="secondary" size="sm" className="pulso-entregable-texto" onClick={() => navegar(accion.href)}>
      {accion.etiqueta}
    </PulsoButton>
  );
}

/** El manifiesto del comparativo (sus huellas y su configuración) acompaña al libro al pie del contenedor. */
function ManifiestoAlPie({ datos }: { datos: ComparativoResultado }) {
  const manifest = datos.artifacts.find((a) => a.role === "manifest");
  if (!manifest) return null;
  return (
    <PulsoButton
      variant="secondary"
      size="sm"
      className="pulso-entregable-texto"
      title={manifest.filename}
      onClick={() => descargarDelServidor(manifest.file_id, manifest.filename)}
    >
      <Download size={12} aria-hidden="true" /> Manifiesto
    </PulsoButton>
  );
}
