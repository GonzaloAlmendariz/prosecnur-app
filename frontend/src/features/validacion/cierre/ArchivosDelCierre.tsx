/**
 * "Archivos" de Cierre (prototipo `pp-archivos`, `archivo` de shell.js): los
 * cuatro archivos que publica el motor (M5), cada uno con su tesela de
 * formato, su estado en una línea (al día con la fecha, desactualizado con la
 * causa, sin generar) y sus acciones del kit de entregables (Abrir, Mostrar en
 * la carpeta, Más; o Descargar fuera del escritorio).
 *
 * La base limpia, el registro y la revisión se generan al cerrar la base. El
 * paquete metodológico (informe en PDF y script en R, en un ZIP) se genera
 * aquí, con la misma generación que antes estaba en `PaqueteMetodologico.tsx`.
 */
import { Folder, Loader2, RefreshCw } from "../../../vendor/lucide-react";
import { AccionesArchivo } from "../../../components/entregables/AccionesArchivo";
import { TileFormato } from "../../../components/entregables/TileFormato";
import type { ArchivoEntregable } from "../../../components/entregables/tipos";
import { PanelDeMesa } from "../../../components/procesamiento/PanelDeMesa";
import { PulsoButton } from "../../../components/PulsoButton";
import type { ArchivoDelCierre } from "../../../api/validacionCierre";
import type { EntregaInstrumento } from "../entregas/useEntregasInstrumento";
import { MODULO_PROCESAMIENTO } from "../entregas/modeloEntrega";
import { archivoAlAlcance, formatoDeArchivo, lineaDeArchivo } from "./modeloCierre";

function comoEntregable(a: ArchivoDelCierre): ArchivoEntregable | null {
  if (!a.file_id) return null;
  return {
    fileId: a.file_id,
    nombre: a.archivo ?? a.nombre,
    formato: formatoDeArchivo(a),
    guardadoEn: a.guardado_en,
    modulo: MODULO_PROCESAMIENTO,
    rotulo: a.nombre,
  };
}

function AccionDelPaquete({ archivo, paquete, causaSinPlan, onGenerar }: {
  archivo: ArchivoDelCierre;
  paquete: EntregaInstrumento;
  causaSinPlan: string | null;
  onGenerar: () => void;
}) {
  if (paquete.enCurso) {
    return (
      <PulsoButton variant="secondary" size="sm" disabled>
        <Loader2 size={14} className="pulso-spin" aria-hidden="true" />
        Generando
      </PulsoButton>
    );
  }
  const fallo = paquete.estado.fase === "fallo";
  const rotulo = fallo ? "Reintentar" : archivo.estado === "no_generado" || archivo.estado === null ? "Generar" : "Volver a generar";
  if (archivo.estado === "al_dia" && !fallo) return null;
  return (
    <PulsoButton variant="secondary" size="sm" disabled={!!causaSinPlan} title={causaSinPlan ?? undefined} onClick={onGenerar}>
      {rotulo === "Generar" ? null : <RefreshCw size={14} aria-hidden="true" />}
      {rotulo}
    </PulsoButton>
  );
}

export function ArchivosDelCierre({ archivos, paquete, causaSinPlan, onGenerarPaquete, ocupado }: {
  archivos: readonly ArchivoDelCierre[];
  paquete: EntregaInstrumento;
  /** Por qué el paquete no se puede generar (sin plan de reglas); `null` si se puede. */
  causaSinPlan: string | null;
  onGenerarPaquete: () => void;
  ocupado: boolean;
}) {
  return (
    <PanelDeMesa zona="archivos" titulo="Archivos" icono={<Folder size={15} />} ocupado={ocupado}>
      <ul className="pulso-ci-archivos" data-qa-geometry-group="validacion/cierre-archivos" data-qa-geometry-contract="intrinsic">
        {archivos.map((a) => {
          const esPaquete = a.clave === "paquete_metodologico";
          const fallo = esPaquete && paquete.estado.fase === "fallo" ? paquete.estado.causa : null;
          const linea = esPaquete && paquete.enCurso
            ? { texto: "Generando el informe en PDF y el script en R", tono: "neutro" as const }
            : fallo
              ? { texto: `No se pudo generar: ${fallo}`, tono: "aviso" as const }
              : lineaDeArchivo(a);
          const entregable = archivoAlAlcance(a) ? comoEntregable(a) : null;
          return (
            <li key={a.clave} className="pulso-ci-archivo" data-estado={a.estado ?? "sin-estado"}>
              <span className="pulso-ci-tesela" data-generado={a.estado === "no_generado" ? "no" : undefined}>
                <TileFormato formato={formatoDeArchivo(a)} />
              </span>
              <div className="pulso-ci-archivo-cuerpo">
                <b>{a.nombre}</b>
                <span data-tono={linea.tono}>{linea.texto}</span>
              </div>
              <div className="pulso-ci-archivo-acciones">
                {esPaquete ? (
                  <AccionDelPaquete archivo={a} paquete={paquete} causaSinPlan={causaSinPlan} onGenerar={onGenerarPaquete} />
                ) : null}
                {entregable ? <AccionesArchivo archivo={entregable} sinDescargar /> : null}
              </div>
            </li>
          );
        })}
      </ul>
    </PanelDeMesa>
  );
}
