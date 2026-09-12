import { useCallback, useEffect, useState, type ReactNode } from "react";

import { apiProjectStatus, apiProjectSave } from "../../../../api/workspace";
import { fmt } from "./kpisDeAulas";
import "./aulasRefuerzosSinGuardar.css";

/**
 * **Marcar un refuerzo no lo guarda, y perderlos cuesta una jornada.**
 *
 * El endpoint de marcar escribe el plan en la sesión y llama a
 * `.monitoreo_mark_project_dirty_if_open`: deja el proyecto en «sin guardar» y
 * espera a que alguien lo guarde. Si el backend se reinicia antes, las marcas
 * se van —medido el 2026-09-12 sobre el proyecto real: los 15 refuerzos
 * elegidos uno a uno el día anterior no estaban en el `.pulso`, sólo en el
 * Sheets—.
 *
 * El puntito «sin guardar» del header dice que ALGO cambió, no QUÉ, y con una
 * sesión larga de monitoreo está encendido casi siempre. Aquí se nombra lo que
 * se puede perder y se pone el botón al lado, que es donde se decide.
 */
export function AulasRefuerzosSinGuardar({ marcados }: {
  /** Cuántos refuerzos hay pedidos ahora mismo. Cero apaga el aviso. */
  marcados: number;
}): ReactNode {
  const [sucio, setSucio] = useState(false);
  const [ruta, setRuta] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [acuse, setAcuse] = useState("");

  const mirar = useCallback(async () => {
    try {
      const estado = await apiProjectStatus();
      setSucio(Boolean(estado.has_project && estado.dirty));
      setRuta(estado.path ?? null);
    } catch {
      // Un fallo al preguntar no debe inventar un «todo guardado»: se calla el
      // aviso pero tampoco se afirma lo contrario.
      setSucio(false);
    }
  }, []);

  useEffect(() => { void mirar(); }, [mirar, marcados]);

  const guardar = async () => {
    if (!ruta) return;
    setGuardando(true);
    setAcuse("");
    try {
      await apiProjectSave(ruta);
      setAcuse("Guardado.");
      await mirar();
    } catch (error) {
      // El motivo, no sólo el hecho: «no se pudo guardar» manda a adivinar.
      setAcuse(error instanceof Error ? `No se guardó: ${error.message}` : "No se pudo guardar.");
    } finally {
      setGuardando(false);
    }
  };

  if (!marcados || !sucio) return acuse ? <p className="mon-aulas-refuerzos-guardado">{acuse}</p> : null;

  return (
    <div className="mon-aulas-refuerzos-sin-guardar" role="status">
      <div>
        <strong>{fmt(marcados)} {marcados === 1 ? "refuerzo pedido" : "refuerzos pedidos"} sin guardar</strong>
        <em>Viven en la sesión. Si el backend se reinicia, se pierden: el Sheets los conserva sólo si ya los publicaste.</em>
      </div>
      <div className="mon-aulas-refuerzos-sin-guardar-accion">
        <button type="button" onClick={() => void guardar()} disabled={guardando || !ruta}>
          {guardando ? "Guardando…" : "Guardar proyecto"}
        </button>
        {acuse ? <span>{acuse}</span> : null}
      </div>
    </div>
  );
}
