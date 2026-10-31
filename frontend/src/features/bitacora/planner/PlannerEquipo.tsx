// Planner › Equipo: quién hace el campo, con su código (ADR 0122 §10).
// En esta etapa es de lectura: se ve lo que ya cargaron Monitoreo y la
// disponibilidad de aulas. El Planner no muestra ni guarda el DNI.

import { PulsoTable, type PulsoTableColumna } from "../../../components/PulsoTable";
import { PlannerCabecera } from "./PlannerCabecera";
import { ETIQUETA_PERFIL } from "./plannerCopia";
import type { ControlPlanner } from "./usePlanner";
import type { PlannerPersona, PlannerTipoPerfil } from "../../../api/planner";

const ROL: Record<string, string> = {
  encuestador: "Encuestador",
  aplicador: "Aplicador",
  supervisor: "Supervisor",
  operador: "Operador",
};

const COLUMNAS: PulsoTableColumna<PlannerPersona>[] = [
  { id: "codigo", encabezado: "Código", ancho: 120, celda: (p) => <span className="planner-codigo">{p.codigo || "Sin código"}</span>, valor: (p) => p.codigo },
  { id: "nombre", encabezado: "Nombre", ancho: 360, celda: (p) => p.nombre || "—", valor: (p) => p.nombre },
  { id: "rol", encabezado: "Rol", ancho: 150, celda: (p) => ROL[p.rol] ?? p.rol, valor: (p) => p.rol },
  {
    id: "perfil", encabezado: "Perfil", ancho: 240,
    celda: (p) => p.perfiles.map((t) => ETIQUETA_PERFIL[t as PlannerTipoPerfil] ?? t).join(", ") || "—",
  },
];

export function PlannerEquipo({ control }: { control: ControlPlanner }) {
  const { estado } = control;
  if (!estado) return null;
  const { personas, code_format } = estado.planner.equipo;

  return (
    <div className="planner-seccion">
      <PlannerCabecera
        titulo="Equipo de campo"
        lead="Las personas que hacen el campo y el código con que cada módulo las reconoce. Se cargan en Monitoreo."
        origen={estado.origen.equipo}
        declaradoEn={estado.declaradoEn.equipo}
        acciones={code_format ? <span className="planner-chip">Formato de código: {code_format}</span> : null}
      />
      <PulsoTable
        ariaLabel="Equipo de campo"
        columnas={COLUMNAS}
        filas={personas}
        idDeFila={(p) => `${p.rol}-${p.codigo}-${p.nombre}`}
        densidad="compacta"
        vacio={<p className="planner-vacio">Este estudio todavía no tiene equipo cargado.</p>}
      />
    </div>
  );
}
