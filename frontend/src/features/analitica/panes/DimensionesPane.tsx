import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { CargaDeBloque } from "../../../components/CargaDeBloque";
import { EstadoVacio } from "../../../components/EstadoVacio";
import { Panel } from "../../../components/Panel";
import { MesaDePestana, PilaDeMesa } from "../../../components/procesamiento/MesaDePestana";
import { PulsoButton } from "../../../components/PulsoButton";
import { ErrorBlock } from "../../../components/States";
import { conNivel } from "../../../lib/navegacion/direccion";
import { useSession } from "../../../lib/SessionContext";
import { ArrowLeft, Layers, Pencil, RefreshCw } from "../../../vendor/lucide-react";
import { CabeceraDeDimensiones, cifrasDeLaCabecera } from "../dimensiones/CabeceraDeDimensiones";
import { ComoSeCalcula } from "../dimensiones/ComoSeCalcula";
import { DimensionesWizard } from "../dimensiones/DimensionesWizard";
import { LoUsan } from "../dimensiones/LoUsan";
import {
  cifrasDeDimensiones,
  entradaElegida,
  entradasDeDimensiones,
  listasDeLaEntrada,
  preguntasSinBloque,
} from "../dimensiones/modeloDeDimensiones";
import { PanelDeIndices } from "../dimensiones/PanelDeIndices";
import { PanelDeLaDimension } from "../dimensiones/PanelDeLaDimension";
import { useDimensionesWizardStore, type WizardStep } from "../dimensiones/store";
import { useDimensionesCalculadas } from "../dimensiones/useDimensionesCalculadas";
import { useAnaliticaStore } from "../store";
import "../dimensiones/dimensiones.css";

// Analítica › Dimensiones con la forma del prototipo ("Analítica, Dimensiones"):
// la cabecera con las cifras de la estructura y, debajo, tres columnas que
// llegan al pie: "Índices" (puntaje medio de cada uno, bloques sin índice y
// preguntas de escala sin bloque), el índice elegido con su puntaje y sus
// bloques, y "Cómo se calcula" con "Lo usan". Lo elegido vive en `?foco=` con
// el nombre de su columna (`idx_*` o `sub_*`).
//
// Sin puntajes calculados, o al pulsar "Editar la estructura", la mesa cede al
// asistente de cinco pasos (`DimensionesWizard`), que guarda la estructura y la
// calcula. Las cifras salen de la cobertura del motor (`/dimensiones/preview`).

export function DimensionesPane() {
  const { state } = useSession();
  const dim = useAnaliticaStore((s) => s.config.dimensiones);
  const setWizardDraft = useDimensionesWizardStore((s) => s.setDraft);
  const goToWizardStep = useDimensionesWizardStore((s) => s.goTo);
  const resetWizard = useDimensionesWizardStore((s) => s.reset);
  const { lectura, releer, recalcular, calculando, errorDeCalculo } = useDimensionesCalculadas();
  const location = useLocation();
  const navigate = useNavigate();

  // "auto" sigue a la sesión; "asistente" lo pidió el usuario; "indices" vuelve de él.
  const [modo, setModo] = useState<"auto" | "asistente" | "indices">("auto");
  const conAsistente = modo === "asistente" || (modo === "auto" && !state?.analitica_dim_ok);

  const lista = lectura.fase === "lista" ? lectura : null;
  const escalas = lista?.escalas ?? null;
  const entradas = useMemo(() => entradasDeDimensiones(dim, lista?.cobertura ?? []), [dim, lista]);
  const foco = new URLSearchParams(location.search).get("foco");
  const elegida = entradaElegida(entradas, foco);
  function elegir(columna: string) {
    navigate({ pathname: location.pathname, search: conNivel(location.search, "foco", columna) }, { replace: true });
  }

  function abrirAsistente(paso: WizardStep) {
    setWizardDraft(dim);
    goToWizardStep(paso);
    setModo("asistente");
  }
  function alTerminarAsistente() {
    resetWizard();
    setModo("indices");
    releer();
  }

  const calculadas = lista?.calculadas ?? false;
  const cabecera = (
    <CabeceraDeDimensiones
      cifras={cifrasDeLaCabecera(cifrasDeDimensiones(dim, escalas))}
      estado={lista ? (calculadas ? { tono: "listo", texto: "Calculadas" } : { tono: "neutro", texto: "Sin calcular" }) : null}
      acciones={conAsistente ? (
        calculadas ? (
          <PulsoButton variant="secondary" onClick={() => setModo("indices")}>
            <ArrowLeft size={14} aria-hidden="true" /> Volver a los índices
          </PulsoButton>
        ) : null
      ) : (
        <>
          <PulsoButton variant="secondary" onClick={() => abrirAsistente(1)}>
            <Pencil size={14} aria-hidden="true" /> Editar la estructura
          </PulsoButton>
          <PulsoButton variant="secondary" onClick={() => void recalcular()} disabled={calculando || dim.subindices.length === 0}>
            <RefreshCw size={14} aria-hidden="true" /> {calculando ? "Calculando" : "Volver a calcular"}
          </PulsoButton>
        </>
      )}
    />
  );

  if (conAsistente) {
    return (
      <div className="dimensiones-superficie dimensiones-superficie--asistente" data-audit-ready="analitica-dimensiones">
        {cabecera}
        <Panel className="dimensiones-asistente">
          <DimensionesWizard onComplete={alTerminarAsistente} />
        </Panel>
      </div>
    );
  }

  if (lectura.fase === "error") {
    return (
      <div className="dimensiones-superficie" data-audit-ready="analitica-dimensiones">
        <ErrorBlock
          label="No se pudieron leer los índices"
          detail={lectura.mensaje}
          queda="La estructura guardada sigue en el proyecto."
          variante="enmarcado"
          acciones={<PulsoButton variant="secondary" onClick={releer}>Volver a leer</PulsoButton>}
        />
      </div>
    );
  }
  if (!lista) return <CargaDeBloque label="Leyendo los índices" />;

  if (!lista.calculadas) {
    return (
      <div className="dimensiones-superficie" data-audit-ready="analitica-dimensiones">
        {cabecera}
        <Panel className="dimensiones-asistente">
          <EstadoVacio
            icono={<Layers size={16} />}
            titulo="Sin puntajes calculados"
            descripcion="La base del proyecto no trae columnas de índices ni de bloques."
            accion={<PulsoButton variant="primary" onClick={() => abrirAsistente(1)}>Abrir el asistente</PulsoButton>}
          />
        </Panel>
      </div>
    );
  }

  return (
    <div className="dimensiones-superficie" data-audit-ready="analitica-dimensiones">
      <MesaDePestana
        grupo="analitica/dimensiones"
        columnas={3}
        cabecera={cabecera}
        avisos={errorDeCalculo ? (
          <ErrorBlock
            label="No se pudieron calcular los índices"
            detail={errorDeCalculo}
            queda="Los puntajes del cálculo anterior siguen en la base."
            variante="enmarcado"
          />
        ) : null}
      >
        <PanelDeIndices
          entradas={entradas}
          elegida={elegida?.columna ?? null}
          sinBloque={escalas ? preguntasSinBloque(dim, escalas) : null}
          onElegir={elegir}
          onCrearBloque={() => abrirAsistente(3)}
        />
        <PanelDeLaDimension entrada={elegida} etiquetas={lista.etiquetas} foco={foco} />
        <PilaDeMesa grupo="analitica/dimensiones">
          <ComoSeCalcula entrada={elegida} listas={elegida && escalas ? listasDeLaEntrada(elegida, escalas) : null} dim={dim} />
          <LoUsan columna={elegida?.columna ?? null} />
        </PilaDeMesa>
      </MesaDePestana>
    </div>
  );
}
