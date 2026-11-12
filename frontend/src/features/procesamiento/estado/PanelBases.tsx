import { EstadoVacio } from "../../../components/EstadoVacio";
import { PanelDeMesa } from "../../../components/procesamiento/PanelDeMesa";
import { PulsoButton } from "../../../components/PulsoButton";
import { Skeleton } from "../../../components/Skeleton";
import { ErrorBlock } from "../../../components/States";
import { Database, LayoutGrid } from "../../../vendor/lucide-react";
import type { BasesDelEstudio } from "./basesDelEstudioModel";
import { FilaBase } from "./FilaBase";
import { NOMBRE_DE_SECCION, SECCIONES_EN_ORDEN } from "./queSigueModel";

export type PanelBasesProps = {
  /** `null` mientras el estudio se lee. */
  bases: BasesDelEstudio | null;
  /** Por qué no se pudo leer el estudio; `null` si se leyó o se está leyendo. */
  errorDeLectura: string | null;
  activandoA: string | null;
  errorDeActivar: string | null;
  onActivar: (nombre: string) => void;
  onReintentar: () => void;
  onAbrirCarga: () => void;
};

const FILAS_DE_ESPERA = 4;

/** "Avance por base y por fase": una fila por base con sus cinco fases y la causa de cada una. */
export function PanelBases({
  bases,
  errorDeLectura,
  activandoA,
  errorDeActivar,
  onActivar,
  onReintentar,
  onAbrirCarga,
}: PanelBasesProps) {
  const conAccion = (bases?.filas.length ?? 0) > 1;
  const destino = activandoA ? bases?.filas.find((fila) => fila.nombre === activandoA) : undefined;

  return (
    <PanelDeMesa
      zona="estado-avance"
      titulo="Avance por base y por fase"
      icono={<LayoutGrid size={16} />}
      ocupado={activandoA !== null}
    >
      {errorDeLectura !== null ? (
        <div className="pulso-estado-estudio-cuerpo">
          <ErrorBlock
            label="No se pudieron leer las bases del estudio"
            detail={errorDeLectura}
            queda="El estudio sigue como estaba."
            acciones={
              <PulsoButton variant="secondary" onClick={onReintentar}>
                Reintentar
              </PulsoButton>
            }
          />
        </div>
      ) : bases === null ? (
        <div
          className="pulso-estado-estudio-cuerpo pulso-estado-estudio-espera"
          role="status"
          aria-busy="true"
        >
          <span className="pulso-sr-only">Cargando las bases del estudio</span>
          {Array.from({ length: FILAS_DE_ESPERA }, (_, i) => (
            <Skeleton forma="fila" key={i} />
          ))}
        </div>
      ) : bases.filas.length === 0 ? (
        <div className="pulso-estado-estudio-cuerpo">
          <EstadoVacio
            tamano="normal"
            icono={<Database size={20} />}
            titulo="Sin bases"
            descripcion="Las bases del estudio se agregan en Carga."
            accion={
              <PulsoButton variant="primary" nav onClick={onAbrirCarga}>
                Abrir Carga
              </PulsoButton>
            }
          />
        </div>
      ) : (
        <>
          {errorDeActivar !== null ? (
            <div className="pulso-estado-estudio-aviso">
              <ErrorBlock label="No se pudo activar la base" detail={errorDeActivar} />
            </div>
          ) : null}
          <div
            role="table"
            aria-label="Bases del estudio y sus fases"
            className="pulso-estado-bases"
            data-con-accion={conAccion ? "" : undefined}
          >
            <div role="rowgroup" className="pulso-estado-bases-encabezado">
              <div role="row" className="pulso-estado-bases-cabecera">
                <span role="columnheader">Base</span>
                {SECCIONES_EN_ORDEN.map((seccion) => (
                  <span role="columnheader" key={seccion}>
                    {NOMBRE_DE_SECCION[seccion]}
                  </span>
                ))}
                {conAccion ? (
                  <span role="columnheader">
                    <span className="pulso-sr-only">Base activa</span>
                  </span>
                ) : null}
              </div>
            </div>
            <div
              role="rowgroup"
              className="pulso-estado-bases-filas"
              data-qa-geometry-group="estado-estudio-bases"
              data-qa-geometry-contract="intrinsic"
            >
              {bases.filas.map((fila) => (
                <FilaBase
                  key={fila.nombre}
                  fila={fila}
                  conAccion={conAccion}
                  activandoA={activandoA}
                  onActivar={onActivar}
                />
              ))}
            </div>
          </div>
          {/* El cambio de base tarda en un estudio grande: se anuncia aunque el botón quede fuera de vista. */}
          <span className="pulso-sr-only" role="status" aria-live="polite">
            {activandoA ? `Activando ${destino?.etiqueta ?? activandoA}` : ""}
          </span>
        </>
      )}
    </PanelDeMesa>
  );
}
