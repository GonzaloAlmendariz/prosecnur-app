/**
 * La columna central de Hallazgos (prototipo `HALL[k]`, `vistas.js:172`): el
 * título de la regla con su cuenta, el segmentado "Casos / Distribución" (o
 * "Distribución / Solo casos" en un rango), la cabecera del hallazgo y la
 * evidencia según su tipo: la tabla de casos, los dos sentidos de un salto, la
 * distribución con el límite o los pares de respuestas casi iguales.
 *
 * El segmentado solo aparece si hay una pregunta numérica que dibujar. Si los
 * casos no cargan, el error queda en este contenedor con su causa y lo que no
 * cambió (prototipo `validacion-hallazgos-error`).
 */
import type { ReactNode } from "react";
import { PanelDeMesa } from "../../../components/procesamiento/PanelDeMesa";
import { PulsoButton } from "../../../components/PulsoButton";
import { CargaDeBloque } from "../../../components/CargaDeBloque";
import { ErrorBlock } from "../../../components/States";
import { causaDelError, identificadorDelError } from "../../../components/errorPresentation";
import { RefreshCw } from "../../../vendor/lucide-react";
import { Segmentado } from "../reglas/panel/Segmentado";
import { conteo } from "./modeloHallazgos";

export type ModoDelCentro = "casos" | "distribucion";

export function CentroDelHallazgo({
  titulo,
  n,
  unidad,
  distribuible,
  modo,
  onModo,
  rango,
  cabecera,
  estado,
  mensajeError,
  onReintentar,
  onSiguiente,
  ocupado,
  children,
}: {
  titulo: string;
  n: number;
  unidad: "casos" | "respuestas";
  /** Hay una pregunta numérica que dibujar. */
  distribuible: boolean;
  modo: ModoDelCentro;
  onModo: (m: ModoDelCentro) => void;
  /** En un rango la distribución va primero ("Distribución / Solo casos"). */
  rango: boolean;
  cabecera: ReactNode;
  estado: "cargando" | "error" | "lista";
  mensajeError?: string;
  onReintentar: () => void;
  /** Pasar al siguiente hallazgo por decidir; sin otro, no se ofrece. */
  onSiguiente?: () => void;
  ocupado: boolean;
  children: ReactNode;
}) {
  const opciones = rango
    ? [{ valor: "distribucion" as const, rotulo: "Distribución" }, { valor: "casos" as const, rotulo: "Solo casos" }]
    : [{ valor: "casos" as const, rotulo: "Casos" }, { valor: "distribucion" as const, rotulo: "Distribución" }];
  return (
    <PanelDeMesa
      zona="hallazgo"
      titulo={titulo}
      etiquetaCuerpo="Casos del hallazgo"
      conteo={conteo(n, unidad === "respuestas" ? "respuesta" : "caso", unidad)}
      ocupado={ocupado}
      acciones={distribuible && estado === "lista" ? (
        <Segmentado<ModoDelCentro> etiqueta="Qué se ve del hallazgo" valor={modo} opciones={opciones} onCambio={onModo} />
      ) : undefined}
    >
      {estado === "error" ? (
        <div className="pulso-hz-error">
          <ErrorBlock
            label="No se pudieron cargar los casos de este hallazgo"
            causa={mensajeError ? causaDelError(mensajeError) : undefined}
            queda="La cola y las decisiones ya guardadas no cambiaron."
            identificador={mensajeError ? identificadorDelError(mensajeError) : undefined}
            acciones={(
              <>
                <PulsoButton variant="primary" size="lg" onClick={onReintentar}>
                  <RefreshCw size={14} aria-hidden="true" />
                  Reintentar
                </PulsoButton>
                {onSiguiente ? (
                  <PulsoButton variant="secondary" size="lg" onClick={onSiguiente}>Pasar al siguiente hallazgo</PulsoButton>
                ) : null}
              </>
            )}
          />
        </div>
      ) : (
        <>
          {cabecera}
          {estado === "cargando" ? <CargaDeBloque label="Leyendo los casos del hallazgo" /> : children}
        </>
      )}
    </PanelDeMesa>
  );
}
