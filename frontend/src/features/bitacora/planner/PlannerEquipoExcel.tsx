// Planner › Equipo en Excel (figura vg-planner): descargar la plantilla con la
// lista vigente y subirla llenada. Subir no guarda: carga las personas en la
// tabla para revisarlas, y se guardan con «Guardar» como cualquier edición.

import { useState, type ReactNode } from "react";

import { apiPlannerEquipoExcel, apiPlannerEquipoImportar, type PlannerEquipoImportado } from "../../../api/planner";
import { downloadUrl } from "../../../api/core";
import { Download, Loader2, Upload } from "../../../vendor/lucide-react";

type Estado = { tipo: "leido"; leido: PlannerEquipoImportado } | { tipo: "error"; mensaje: string } | null;

/** Los botones van en la cabecera y el aviso debajo de ella: por eso es un hook. */
export function usePlannerEquipoExcel(onLeido: (leido: PlannerEquipoImportado) => void): { botones: ReactNode; aviso: ReactNode } {
  const [ocupado, setOcupado] = useState<"bajando" | "subiendo" | null>(null);
  const [estado, setEstado] = useState<Estado>(null);

  const bajar = async () => {
    setOcupado("bajando");
    try {
      const r = await apiPlannerEquipoExcel();
      window.open(downloadUrl(r.file_id), "_blank", "noopener,noreferrer");
    } catch (err) {
      setEstado({ tipo: "error", mensaje: err instanceof Error ? err.message : "No se pudo armar la plantilla." });
    } finally {
      setOcupado(null);
    }
  };
  const subir = async (archivo: File | undefined) => {
    if (!archivo) return;
    setOcupado("subiendo");
    try {
      const leido = await apiPlannerEquipoImportar(archivo);
      setEstado({ tipo: "leido", leido });
      if (leido.personas.length) onLeido(leido);
    } catch (err) {
      setEstado({ tipo: "error", mensaje: err instanceof Error ? err.message.replace(/ · E_[A-Z0-9_]+$/, "") : "No se pudo leer el Excel." });
    } finally {
      setOcupado(null);
    }
  };

  const botones = (
    <>
      <button type="button" className="plan-button" onClick={() => void bajar()} disabled={ocupado !== null}>
        {ocupado === "bajando" ? <Loader2 size={14} className="spin" /> : <Download size={14} />}
        <span>Plantilla del equipo</span>
      </button>
      <label className="plan-button" aria-disabled={ocupado !== null}>
        {ocupado === "subiendo" ? <Loader2 size={14} className="spin" /> : <Upload size={14} />}
        <span>Subir lista llenada</span>
        <input
          type="file"
          accept=".xlsx"
          disabled={ocupado !== null}
          onChange={(e) => {
            const archivo = e.currentTarget.files?.[0];
            e.currentTarget.value = "";
            void subir(archivo);
          }}
        />
      </label>
    </>
  );
  return { botones, aviso: estado ? <PlannerEquipoExcelAviso estado={estado} /> : null };
}

function PlannerEquipoExcelAviso({ estado }: { estado: NonNullable<Estado> }) {
  if (estado.tipo === "error") return <p className="planner-ayuda planner-equipo-excel-aviso" role="alert">{estado.mensaje}</p>;
  const { personas, problemas } = estado.leido;
  return (
    <div className="planner-ayuda planner-equipo-excel-aviso" role="status">
      <p>
        {personas.length
          ? `Del Excel salen ${personas.length} ${personas.length === 1 ? "persona" : "personas"}: revisa la tabla y guarda.`
          : "El Excel no trae ninguna persona con nombre: la tabla queda como estaba."}
      </p>
      {problemas.length ? (
        <ul>{problemas.map((p) => <li key={`${p.fila}-${p.motivo}`}>Fila {p.fila}: {p.motivo}</li>)}</ul>
      ) : null}
    </div>
  );
}
