// Analítica › Entrega (ADR 0144, prototipo "Analítica, Entrega"): la síntesis de
// los entregables de la base. La cabecera dice cuántos se generaron de los que
// el motor sigue; a la izquierda, los entregables en tres grupos; al centro y a
// la derecha, el entregable elegido (`?foco=`, el libro por defecto) con su
// vista o sus ajustes, de qué se construye y sus archivos.
//
// Lo que el prototipo tiene y aquí falta, por causa 1 (el motor no lo da):
// "Al día" y "Desactualizado" con su fecha (pedido E1), el estado de la base
// final, el script, el formulario y el comparativo (E2), y las acciones
// "Generar lo que falta" y "Armar el paquete" (E3).

import type { ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { apiAnaliticaBasesInstrumento, apiAnaliticaBasesScriptR } from "../../../api/client";
import { CabeceraDePestana } from "../../../components/procesamiento/CabeceraDePestana";
import { MesaDePestana } from "../../../components/procesamiento/MesaDePestana";
import { useSession } from "../../../lib/SessionContext";
import { formatoConteo } from "../../../lib/formatoNumero";
import { conNivel } from "../../../lib/navegacion/direccion";
import { useDireccion } from "../../../lib/navegacion/useDireccion";
import { Package } from "../../../vendor/lucide-react";
import { comparativosDisponibles } from "../panes/comparativosModel";
import { EntregaDeBaseFinal } from "./EntregaDeBaseFinal";
import { EntregaDeLaFicha } from "./EntregaDeLaFicha";
import { EntregaDelLibro } from "./EntregaDelLibro";
import { EntregaDeUnArchivo } from "./EntregaDeUnArchivo";
import { ListaDeEntregables } from "./ListaDeEntregables";
import {
  ENTREGABLE_POR_DEFECTO,
  causaDeLaFicha,
  cifrasDeEntrega,
  entregablesDelEstudio,
  esEntregable,
  estadoDeEntregable,
  type EntregableId,
} from "./modeloDeEntrega";
import { useFichaTecnica } from "./useFichaTecnica";
import "../libro/libro.css";
import "../tablas/tablas.css";
import "./entrega.css";

export const PENDIENTE_DE_ENTREGA =
  "Al día o desactualizado, con su fecha, y el estado de la base final, el script, el formulario y el comparativo: el motor no los publica (pedidos E1 y E2 del ADR 0144)";

export function PestanaEntrega({ fuente }: { fuente: ReactNode }) {
  const { state } = useSession();
  const location = useLocation();
  const navigate = useNavigate();
  const ficha = useFichaTecnica();

  const entregables = entregablesDelEstudio({ conComparativo: comparativosDisponibles(state?.n_bases) });
  const pedido = useDireccion()?.foco ?? null;
  const elegido: EntregableId = esEntregable(pedido) && entregables.some((e) => e.id === pedido && !e.pestana)
    ? pedido
    : ENTREGABLE_POR_DEFECTO;
  const cifras = cifrasDeEntrega(entregables, state);
  const causaFicha = ficha.leyendo ? null : causaDeLaFicha(ficha.campos.length, ficha.completos);

  function elegir(id: EntregableId) {
    navigate({ pathname: location.pathname, search: conNivel(location.search, "foco", id === ENTREGABLE_POR_DEFECTO ? null : id) });
  }

  return (
    <div className="libro-superficie" data-entregable={elegido}>
      <MesaDePestana
        grupo="analitica/entrega"
        columnas={3}
        cabecera={(
          <CabeceraDePestana
            seccion="Analítica"
            titulo="Entrega"
            icono={Package}
            estado={cifras.porGenerar > 0 ? { tono: "parcial", texto: "Falta generar" } : null}
            ariaCifras="Cifras de la entrega"
            cifrasPendientes={PENDIENTE_DE_ENTREGA}
            cifras={cifras.conEstado === 0 ? [] : [
              {
                clave: "generados",
                valor: formatoConteo(cifras.generados),
                base: formatoConteo(cifras.conEstado),
                rotulo: cifras.generados === 1 ? "archivo generado" : "archivos generados",
                tono: cifras.generados === cifras.conEstado ? "ok" : undefined,
                rango: 1,
                titulo: "De los entregables cuyo estado publica el motor: libro de códigos, ficha técnica, frecuencias y cruces",
              },
              {
                clave: "por-generar",
                valor: formatoConteo(cifras.porGenerar),
                base: formatoConteo(cifras.conEstado),
                rotulo: "por generar",
                tono: cifras.porGenerar > 0 ? "alerta" : undefined,
              },
            ]}
          />
        )}
      >
        <ListaDeEntregables
          entregables={entregables}
          elegido={elegido}
          estadoDe={(id) => estadoDeEntregable(id, state)}
          causaDe={(id) => (id === "ficha" ? causaFicha : null)}
          onElegir={elegir}
        />
        {elegido === "libro" ? <EntregaDelLibro fuente={fuente} /> : null}
        {elegido === "base-final" ? <EntregaDeBaseFinal fuente={fuente} /> : null}
        {elegido === "ficha" ? <EntregaDeLaFicha lectura={ficha} /> : null}
        {elegido === "script" ? (
          <EntregaDeUnArchivo
            key="script"
            zona="script"
            titulo="Script de réplica"
            articulo="el"
            formato="r"
            nombreDelArchivo="replicar_base.R"
            contenido={[
              "Un script de R comentado que, corrido sobre las respuestas descargadas de la plataforma, reproduce esta misma base final.",
              "Quien lo recibe lo corre por su cuenta, sin Prosecnur.",
            ]}
            dependencias={[
              { clave: "base", titulo: "Versión de la base", detalle: fuente },
              { clave: "etiquetas", titulo: "Etiquetas y secciones", detalle: "Variables", pestana: "datos" },
            ]}
            generar={apiAnaliticaBasesScriptR}
          />
        ) : null}
        {elegido === "formulario" ? (
          <EntregaDeUnArchivo
            key="formulario"
            zona="formulario"
            titulo="Formulario final"
            articulo="el"
            formato="xlsx"
            nombreDelArchivo="Formulario en XLSForm"
            contenido={[
              "Las preguntas, las opciones y la estructura de la base, de la versión que se analiza (cargada o codificada).",
            ]}
            dependencias={[
              { clave: "base", titulo: "Versión de la base", detalle: fuente },
              { clave: "orden", titulo: "Orden de categorías", detalle: "Categorías", pestana: "orden" },
            ]}
            generar={apiAnaliticaBasesInstrumento}
          />
        ) : null}
      </MesaDePestana>
    </div>
  );
}
