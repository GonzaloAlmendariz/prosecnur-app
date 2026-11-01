// Planner › Equipo: quién hace el campo, con su código (ADR 0122 §10).
//
// Hasta que se declare aquí, se ve lo que ya cargaron Monitoreo y la
// disponibilidad de aulas. Los nombres se guardan y se muestran tal cual: el
// anonimizador sólo reescribe las copias de referencia del repo. El Planner no
// guarda DNI, teléfono ni correo como campo.

import { useEffect, useState } from "react";

import type { PlannerEquipo as Equipo, PlannerPersona, PlannerTipoPerfil } from "../../../api/planner";
import { PulsoSwitch } from "../../../components/PulsoSwitch";
import { PulsoTable, type PulsoTableColumna } from "../../../components/PulsoTable";
import { Plus, Trash2 } from "../../../vendor/lucide-react";
import { PlannerCabecera } from "./PlannerCabecera";
import { ETIQUETA_PERFIL } from "./plannerCopia";
import type { ControlPlanner } from "./usePlanner";

const ROL: Record<string, string> = {
  encuestador: "Encuestador",
  aplicador: "Aplicador",
  supervisor: "Supervisor",
  operador: "Operador",
};

// Fila con identidad estable mientras se edita: el código puede cambiar o faltar.
type Fila = PlannerPersona & { clave: string };

const conClave = (personas: PlannerPersona[]): Fila[] => personas.map((p, i) => ({ ...p, clave: `fila-${i}` }));
const sinClave = (filas: Fila[]): PlannerPersona[] => filas.map(({ clave: _clave, ...p }) => p);

export function PlannerEquipo({ control }: { control: ControlPlanner }) {
  const { estado, declarar, guardando } = control;
  const [filas, setFilas] = useState<Fila[]>([]);
  const [nueva, setNueva] = useState({ codigo: "", nombre: "", rol: "encuestador" });
  useEffect(() => {
    if (estado) setFilas(conClave(estado.planner.equipo.personas));
  }, [estado]);
  if (!estado) return null;

  const equipo: Equipo = estado.planner.equipo;
  const tipos = estado.planner.perfiles.map((p) => p.tipo);
  const sinCambios = JSON.stringify(sinClave(filas)) === JSON.stringify(equipo.personas);
  const codigos = filas.map((f) => f.codigo.trim()).filter(Boolean);
  const repetido = codigos.find((c, i) => codigos.indexOf(c) !== i) ?? null;
  const sinNombre = filas.some((f) => !f.nombre.trim());
  const declarable = (!sinCambios || estado.origen.equipo === "proyectado") && filas.length > 0 && !repetido && !sinNombre;

  const editar = (clave: string, cambio: Partial<PlannerPersona>) => {
    setFilas((prev) => prev.map((f) => (f.clave === clave ? { ...f, ...cambio } : f)));
  };
  const agregar = () => {
    const nombre = nueva.nombre.trim();
    if (!nombre) return;
    setFilas([...filas, { clave: `nueva-${Date.now()}`, codigo: nueva.codigo.trim(), nombre, rol: nueva.rol, perfiles: tipos.length === 1 ? [tipos[0]] : [], activo: true }]);
    setNueva({ codigo: "", nombre: "", rol: nueva.rol });
  };

  const columnas: PulsoTableColumna<Fila>[] = [
    {
      id: "codigo", encabezado: "Código", ancho: 110, valor: (f) => f.codigo, celda: (f) => (
        <input className="planner-celda-input" aria-label={`Código de ${f.nombre || "la persona"}`} value={f.codigo} maxLength={40}
          onChange={(e) => editar(f.clave, { codigo: e.target.value })} />
      ),
    },
    {
      id: "nombre", encabezado: "Nombre", ancho: 300, valor: (f) => f.nombre, celda: (f) => (
        <input className="planner-celda-input" aria-label={`Nombre de ${f.codigo || "la persona"}`} value={f.nombre} maxLength={120}
          onChange={(e) => editar(f.clave, { nombre: e.target.value })} />
      ),
    },
    {
      id: "rol", encabezado: "Rol", ancho: 150, valor: (f) => f.rol, celda: (f) => (
        <select className="planner-celda-input" aria-label={`Rol de ${f.nombre || "la persona"}`} value={f.rol}
          onChange={(e) => editar(f.clave, { rol: e.target.value })}>
          {Object.entries(ROL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      ),
    },
    {
      id: "perfiles", encabezado: "Perfil", ancho: 260, celda: (f) => (
        tipos.length ? (
          <div className="planner-chips">
            {tipos.map((t) => (
              <PulsoSwitch key={t} variant="chip" label={ETIQUETA_PERFIL[t]} checked={f.perfiles.includes(t)}
                onCheckedChange={(on) => editar(f.clave, { perfiles: on ? [...f.perfiles, t] : f.perfiles.filter((x) => x !== t) })} />
            ))}
          </div>
        ) : f.perfiles.map((t) => ETIQUETA_PERFIL[t as PlannerTipoPerfil] ?? t).join(", ") || "—"
      ),
    },
    {
      id: "activo", encabezado: "Activo", ancho: 80, celda: (f) => (
        <PulsoSwitch size="sm" ariaLabel={`${f.nombre || "Persona"} activo`} checked={f.activo}
          onCheckedChange={(on) => editar(f.clave, { activo: on })} />
      ),
    },
    {
      id: "acciones", encabezado: "", ancho: 56, celda: (f) => (
        <button type="button" className="plan-icon-button" aria-label={`Quitar a ${f.nombre || "la persona"}`}
          onClick={() => setFilas(filas.filter((x) => x.clave !== f.clave))}>
          <Trash2 size={14} />
        </button>
      ),
    },
  ];

  return (
    <div className="planner-seccion">
      <PlannerCabecera
        titulo="Equipo de campo"
        lead="Las personas que hacen el campo y el código con que cada módulo las reconoce."
        origen={estado.origen.equipo}
        declaradoEn={estado.declaradoEn.equipo}
        acciones={(
          <>
            {equipo.code_format ? <span className="planner-chip">Formato de código: {equipo.code_format}</span> : null}
            <button
              type="button"
              className="plan-button plan-button--primary"
              disabled={!declarable || guardando === "equipo"}
              onClick={() => void declarar("equipo", { code_format: equipo.code_format, personas: sinClave(filas) })}
            >
              {guardando === "equipo" ? "Guardando…" : estado.origen.equipo === "proyectado" ? "Declarar equipo" : "Guardar"}
            </button>
          </>
        )}
      />
      {repetido ? <p className="planner-ayuda" role="status">El código {repetido} está en dos personas.</p> : null}
      {sinNombre ? <p className="planner-ayuda" role="status">Cada persona necesita un nombre.</p> : null}
      <PulsoTable
        ariaLabel="Equipo de campo"
        columnas={columnas}
        filas={filas}
        idDeFila={(f) => f.clave}
        densidad="comoda"
        vacio={<p className="planner-vacio">Este estudio todavía no tiene equipo cargado.</p>}
      />
      <div className="planner-form planner-form--fila" aria-label="Agregar persona">
        <label className="planner-campo planner-campo--corto">
          <span>Código</span>
          <input value={nueva.codigo} maxLength={40} onChange={(e) => setNueva({ ...nueva, codigo: e.target.value })} />
        </label>
        <label className="planner-campo planner-campo--ancho">
          <span>Nombre</span>
          <input value={nueva.nombre} maxLength={120} onChange={(e) => setNueva({ ...nueva, nombre: e.target.value })} />
        </label>
        <label className="planner-campo">
          <span>Rol</span>
          <select value={nueva.rol} onChange={(e) => setNueva({ ...nueva, rol: e.target.value })}>
            {Object.entries(ROL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        <button type="button" className="plan-button" disabled={!nueva.nombre.trim()} onClick={agregar}>
          <Plus size={14} /> <span>Agregar</span>
        </button>
      </div>
    </div>
  );
}
