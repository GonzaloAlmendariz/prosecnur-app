// Material › Entrega: qué encuestador de la lista de Monitoreo va a cada columna del
// calendario del plan (decisión I3, «la de Monitoreo»). Elegir asigna todas las UMP de
// esa columna; «Guardar asignación» lo persiste por UMP. Contrato en
// docs/qa/contrato-equipo-territorial-2026-10-31.md.

import { useCallback, useEffect, useState } from "react";

import {
  apiMaterialTerritorialAsignacion,
  apiMaterialTerritorialGuardarAsignacion,
  type AsignacionTerritorial,
  type EstadoDeclarado,
} from "../../../api/materialTerritorial";
import { PulsoButton } from "../../../components/PulsoButton";
import { PulsoSelect } from "../../../components/PulsoSelect";
import { AlertTriangle } from "../../../vendor/lucide-react";
import { ExcelDeAsignacion } from "./ExcelDeAsignacion";
import { asignarColumna, borradorDe, codigoDeColumna, cuerpoDelBorrador, hayCambios, motivoDeBloqueo, type Borrador } from "./modeloAsignacion";
import { CargaDeBloque } from "../../../components/CargaDeBloque";

const SIN_ASIGNAR = "__sin_asignar";

/** Lee la asignación de la campaña y mantiene el borrador del calendario. */
export function useAsignacionEquipo(campaignId: string | null) {
  const [datos, setDatos] = useState<AsignacionTerritorial | null>(null);
  const [borrador, setBorrador] = useState<Borrador>({});
  const [estado, setEstado] = useState<"" | "guardando" | "guardado">("");
  const [error, setError] = useState("");

  useEffect(() => {
    setDatos(null);
    setBorrador({});
    setEstado("");
    setError("");
    if (!campaignId) return;
    let vivo = true;
    apiMaterialTerritorialAsignacion(campaignId)
      .then((a) => {
        if (!vivo) return;
        setDatos(a);
        setBorrador(borradorDe(a));
      })
      .catch((e: unknown) => vivo && setError(e instanceof Error ? e.message : "No se pudo leer la asignación"));
    return () => {
      vivo = false;
    };
  }, [campaignId]);

  /** Guarda una asignación entera (la del calendario o la leída del Excel de campo). */
  const guardarCuerpo = useCallback(
    (cuerpo: { id_manzana: string; codigo: string }[], estados?: EstadoDeclarado[]): Promise<boolean> => {
      if (!campaignId || !datos) return Promise.resolve(false);
      setEstado("guardando");
      setError("");
      return apiMaterialTerritorialGuardarAsignacion(campaignId, cuerpo, datos.revision, estados)
        .then((a) => {
          setDatos(a);
          setBorrador(borradorDe(a));
          setEstado("guardado");
          // La barra de la campaña cuenta las asignadas: que se entere sin recargar.
          window.dispatchEvent(new CustomEvent("pulso:material-asignacion-guardada"));
          return true;
        })
        .catch((e: unknown) => {
          setError(e instanceof Error ? e.message : "No se pudo guardar la asignación");
          setEstado("");
          // Tras un 409/422 se relee lo guardado (revisión, bloqueo) sin perder el borrador.
          apiMaterialTerritorialAsignacion(campaignId).then(setDatos).catch(() => undefined);
          return false;
        });
    },
    [campaignId, datos],
  );
  const guardar = useCallback(() => void guardarCuerpo(cuerpoDelBorrador(borrador)), [guardarCuerpo, borrador]);

  const bloqueo = motivoDeBloqueo(datos);
  const cabeza = (k: number, umps: string[]) => {
    if (!datos || bloqueo) return null;
    const actual = codigoDeColumna(umps, borrador);
    return (
      <PulsoSelect
        size="sm"
        className="rec-asig-selector"
        ariaLabel={`Quién hace las jornadas del encuestador ${k + 1}`}
        value={actual === null ? undefined : actual || SIN_ASIGNAR}
        placeholder="Varios"
        disabled={!umps.length || estado === "guardando"}
        options={[
          { value: SIN_ASIGNAR, label: "Sin asignar" },
          ...datos.equipo.map((e) => ({ value: e.codigo, label: e.nombre ? `${e.nombre} (${e.codigo})` : e.codigo, textValue: `${e.codigo} ${e.nombre}` })),
        ]}
        onValueChange={(v) => {
          setBorrador((b) => asignarColumna(b, umps, v === SIN_ASIGNAR ? "" : v));
          setEstado("");
        }}
      />
    );
  };

  return { campaignId, datos, borrador, bloqueo, cabeza, estado, error, guardar, aplicar: guardarCuerpo, cambiado: hayCambios(borrador, datos) };
}

type Props = Omit<ReturnType<typeof useAsignacionEquipo>, "cabeza" | "borrador"> & {
  /** Qué se asigna: UMP (envío aleatorio) o zona (envío por cuotas, ADR 0125 A1). */
  unidad?: "ump" | "zona";
};

const ROTULO_UNIDAD = { ump: ["UMP asignada", "UMP asignadas"], zona: ["asignación de zona", "asignaciones de zona"] } as const;

/** Encabezado de la asignación: el motivo de bloqueo, lo que quedó fuera y el guardado. */
export function BarraAsignacion({ campaignId, datos, bloqueo, estado, error, guardar, aplicar, cambiado, unidad = "ump" }: Props) {
  if (error && !datos) return <p className="rec-terr-nota" role="alert">{error}</p>;
  // Revisión con ojo de usuario (1 nov 2026): la lista llegaba tarde y empujaba el plan bajo el cursor.
  // Mientras se lee, la tarjeta ya ocupa su lugar.
  if (!datos) {
    return campaignId ? (
      <div className="rec-asig" aria-label="Asignación de encuestadores" aria-busy="true">
        <div className="rec-asig-cab">
          <strong>Encuestadores</strong>
        </div>
        <CargaDeBloque label="Leyendo la lista de Monitoreo…" />
      </div>
    ) : null;
  }
  const asignadas = datos.asignacion.length;
  return (
    <div className="rec-asig" aria-label="Asignación de encuestadores">
      <div className="rec-asig-cab">
        <span>
          <strong>Encuestadores</strong>
          <small>
            {bloqueo
              ? "Se eligen de la lista de Monitoreo."
              : unidad === "zona"
                ? `${datos.equipo.length} en la lista de Monitoreo, ${asignadas} ${ROTULO_UNIDAD.zona[asignadas === 1 ? 0 : 1]}. Campo asigna en el Excel, una fila por encuestador y zona con su parte de la cuota.`
                : `${datos.equipo.length} en la lista de Monitoreo y ${asignadas} ${ROTULO_UNIDAD.ump[asignadas === 1 ? 0 : 1]}. Campo asigna en el Excel; también puedes elegir por columna del calendario.`}
          </small>
        </span>
        {!bloqueo ? (
          <PulsoButton size="sm" variant="primary" disabled={!cambiado || estado === "guardando"} onClick={guardar}>
            {estado === "guardando" ? "Guardando…" : estado === "guardado" && !cambiado ? "Asignación guardada" : "Guardar asignación"}
          </PulsoButton>
        ) : null}
      </div>
      {bloqueo ? <p className="rec-asig-aviso" role="status"><AlertTriangle size={14} aria-hidden /> {bloqueo}</p> : null}
      {!bloqueo ? <ExcelDeAsignacion campaignId={campaignId} deshabilitado={estado === "guardando"} aplicar={aplicar} /> : null}
      {datos.desactualizada && datos.huerfanas > 0 ? (
        <p className="rec-asig-aviso" role="status">
          <AlertTriangle size={14} aria-hidden /> {datos.huerfanas === 1 ? `1 ${ROTULO_UNIDAD[unidad][0]} ya no está` : `${datos.huerfanas} ${ROTULO_UNIDAD[unidad][1]} ya no están`} en la muestra reenviada; se descartan al guardar.
        </p>
      ) : null}
      {datos.codigos_fuera_del_equipo.length ? (
        <p className="rec-asig-aviso" role="status">
          <AlertTriangle size={14} aria-hidden /> {datos.codigos_fuera_del_equipo.join(", ")} ya no {datos.codigos_fuera_del_equipo.length === 1 ? "está" : "están"} en la lista de Monitoreo.
        </p>
      ) : null}
      {datos.descartadas > 0 && estado === "guardado" ? (
        <p className="rec-terr-nota">Se descartaron {datos.descartadas} asignaciones {unidad === "zona" ? "de zonas" : "de UMP"} que ya no están en la muestra.</p>
      ) : null}
      {error ? <p className="rec-terr-nota" role="alert">{error}</p> : null}
    </div>
  );
}
