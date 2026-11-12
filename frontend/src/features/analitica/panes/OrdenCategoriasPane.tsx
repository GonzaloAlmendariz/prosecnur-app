import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import {
  apiAnaliticaDataReview,
  apiAnaliticaVariables,
  type DataReviewOption,
  type DataReviewVariable,
  type VariableInstrumento,
} from "../../../api/analitica";
import { CargaDeBloque } from "../../../components/CargaDeBloque";
import { MesaDePestana, PilaDeMesa } from "../../../components/procesamiento/MesaDePestana";
import { PulsoButton } from "../../../components/PulsoButton";
import { ErrorBlock } from "../../../components/States";
import { conNivel } from "../../../lib/navegacion/direccion";
import { useAnaliticaStore } from "../store";
import { CabeceraDeCategorias, cifrasDeLaCabecera } from "../categorias/CabeceraDeCategorias";
import { LecturaDeLaLista } from "../categorias/LecturaDeLaLista";
import {
  cifrasDeCategorias,
  especialesAlFinal,
  especialesDelEstudio,
  especialesEnSuLugar,
  esPreguntaDeOpcion,
  listasQueCasan,
  opcionesDeLaLista,
} from "../categorias/modeloDeCategorias";
import { PanelDeCategorias } from "../categorias/PanelDeCategorias";
import { PanelDeListas } from "../categorias/PanelDeListas";
import { PreguntasDeLaLista } from "../categorias/PreguntasDeLaLista";
import {
  derivarCatalogoListas,
  enviarEspecialesAlFinal,
  esListaOrdinalEfectiva,
  esValorEspecial,
  ordinalAutoDeLista,
  sembrarOrden,
} from "./ordenCategoriasModel";
import "../categorias/categorias.css";

// Analítica › Orden de categorías con la forma del prototipo ("Analítica,
// Categorías"): la cabecera con las cifras de las listas; debajo, tres columnas
// que llegan al pie: "Listas" (buscador por lista o pregunta), la lista elegida
// con sus categorías en orden y, a la derecha, "Lectura de la lista" y las
// preguntas que la usan. La lista elegida vive en `?foco=`.
//
// El orden se guarda por lista en `orden_categorias[list_name]` (secuencia
// explícita; sin ella manda el formulario con los especiales al final) y la
// ordinalidad en `listas_ordinales[list_name]` (sin ella, la detección del
// motor). Los dos van por el store y el autoguardado.

/** Las opciones de una lista; se exporta con el nombre de siempre para quien lo importa desde aquí. */
export function resolverOpcionesLista(variablesLista: VariableInstrumento[], dataReview: DataReviewVariable[]): DataReviewOption[] {
  return opcionesDeLaLista(variablesLista, dataReview).opciones;
}

export function OrdenCategoriasPane() {
  const [variables, setVariables] = useState<VariableInstrumento[] | null>(null);
  const [dataReview, setDataReview] = useState<DataReviewVariable[] | null>(null);
  const [error, setError] = useState("");
  const [intento, setIntento] = useState(0);
  const [consulta, setConsulta] = useState("");
  const location = useLocation();
  const navigate = useNavigate();

  const ordenes = useAnaliticaStore((s) => s.config.orden_categorias);
  const ordinales = useAnaliticaStore((s) => s.config.listas_ordinales);
  const setOrdenCategorias = useAnaliticaStore((s) => s.setOrdenCategorias);
  const clearOrdenCategorias = useAnaliticaStore((s) => s.clearOrdenCategorias);
  const setListaOrdinal = useAnaliticaStore((s) => s.setListaOrdinal);
  const clearListaOrdinal = useAnaliticaStore((s) => s.clearListaOrdinal);

  useEffect(() => {
    let cancelado = false;
    setError("");
    (async () => {
      try {
        const [v, d] = await Promise.all([apiAnaliticaVariables(), apiAnaliticaDataReview()]);
        if (cancelado) return;
        setVariables(v.variables);
        setDataReview(d.variables);
      } catch (e) {
        if (!cancelado) setError((e as Error).message);
      }
    })();
    return () => { cancelado = true; };
  }, [intento]);

  const deOpcion = useMemo(() => (variables ?? []).filter(esPreguntaDeOpcion), [variables]);
  const catalogo = useMemo(
    () => (dataReview ? derivarCatalogoListas(deOpcion, dataReview, ordenes, ordinales) : []),
    [deOpcion, dataReview, ordenes, ordinales],
  );
  const especiales = useMemo(() => especialesDelEstudio(dataReview ?? []), [dataReview]);
  const visibles = useMemo(() => listasQueCasan(catalogo, deOpcion, consulta), [catalogo, deOpcion, consulta]);

  // La lista elegida va en la dirección; sin una pedida, la primera del catálogo.
  const pedida = new URLSearchParams(location.search).get("foco");
  const elegida = catalogo.find((e) => e.listName === pedida)?.listName ?? catalogo[0]?.listName ?? null;
  function elegir(listName: string) {
    navigate({ pathname: location.pathname, search: conNivel(location.search, "foco", listName) }, { replace: true });
  }

  const preguntas = useMemo(() => (elegida ? (variables ?? []).filter((v) => v.list_name === elegida) : []), [variables, elegida]);
  const { opciones, fuente } = useMemo(() => opcionesDeLaLista(preguntas, dataReview ?? []), [preguntas, dataReview]);
  const formulario = opciones.map((o) => o.code);
  const guardado = elegida ? ordenes[elegida] : undefined;
  const codes = sembrarOrden(formulario, guardado);
  const ordinalAuto = ordinalAutoDeLista(preguntas);
  const ordinal = elegida ? esListaOrdinalEfectiva(elegida, ordinales, { [elegida]: ordinalAuto }) : false;

  if (error) {
    return (
      <div className="categorias-superficie" data-audit-ready="analitica-orden">
        <ErrorBlock
          label="No se pudieron leer las listas de respuesta"
          detail={error}
          queda="El orden que ya guardaste sigue en el proyecto."
          variante="enmarcado"
          acciones={<PulsoButton variant="secondary" onClick={() => setIntento((n) => n + 1)}>Volver a leer</PulsoButton>}
        />
      </div>
    );
  }
  if (variables === null || dataReview === null) {
    return <CargaDeBloque label="Leyendo las listas de respuesta" />;
  }

  return (
    <div className="categorias-superficie" data-audit-ready="analitica-orden">
      <MesaDePestana
        grupo="analitica/categorias"
        columnas={3}
        cabecera={<CabeceraDeCategorias cifras={cifrasDeLaCabecera(cifrasDeCategorias(catalogo, especiales, variables))} />}
      >
        <PanelDeListas
          total={catalogo.length}
          listas={visibles}
          elegida={elegida}
          consulta={consulta}
          onBuscar={setConsulta}
          onElegir={elegir}
        />
        <PanelDeCategorias
          listName={elegida}
          codes={codes}
          opciones={opciones}
          fuente={fuente}
          hayOrdenPropio={!!guardado && guardado.length > 0}
          onOrden={(siguiente) => elegida && setOrdenCategorias(elegida, siguiente)}
          onInvertir={() => elegida && setOrdenCategorias(elegida, [...codes].reverse())}
          onComoElFormulario={() => elegida && clearOrdenCategorias(elegida)}
        />
        <PilaDeMesa grupo="analitica/categorias">
          <LecturaDeLaLista
            listName={elegida}
            ordinal={ordinal}
            ordinalAuto={ordinalAuto}
            ordinalPropio={elegida ? ordinales[elegida] !== undefined : false}
            conEspeciales={codes.some(esValorEspecial)}
            especialesAlFinal={especialesAlFinal(codes)}
            especiales={especiales}
            onOrdinal={(valor) => elegida && setListaOrdinal(elegida, valor)}
            onUsarDeteccion={() => elegida && clearListaOrdinal(elegida)}
            onEspecialesAlFinal={(alFinal) => elegida && setOrdenCategorias(
              elegida,
              alFinal ? enviarEspecialesAlFinal(codes) : especialesEnSuLugar(codes, formulario),
            )}
          />
          <PreguntasDeLaLista preguntas={elegida ? preguntas : []} />
        </PilaDeMesa>
      </MesaDePestana>
    </div>
  );
}
