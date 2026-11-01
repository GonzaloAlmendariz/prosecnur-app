// Planner › Estudio: identidad, perfiles de recojo e insumos del cliente
// (ADR 0122 §1). Los perfiles son lo que más pesa: de ellos sale el modo de
// Cálculo de muestra, Material de campo y Monitoreo.

import { useEffect, useState } from "react";

import {
  PLANNER_TIPOS_PERFIL,
  type PlannerDiseno,
  type PlannerInsumo,
  type PlannerPerfil,
  type PlannerTipoPerfil,
} from "../../../api/planner";
import { PulsoSwitch } from "../../../components/PulsoSwitch";
import { PULSO_TABLE_ALTO_FILA, PulsoTable, type PulsoTableColumna } from "../../../components/PulsoTable";
import { Plus, Trash2 } from "../../../vendor/lucide-react";
import { PlannerAvisos, PlannerCabecera } from "./PlannerCabecera";
import { DETALLE_PERFIL, ETIQUETA_DISENO, ETIQUETA_PERFIL, modosDelPerfil } from "./plannerCopia";
import { PlannerFaseActiva } from "./PlannerFaseActiva";
import { usePlannerCalendario } from "./usePlannerCalendario";
import type { ControlPlanner } from "./usePlanner";

type Props = { control: ControlPlanner; pestana: string };

export function PlannerEstudio({ control, pestana }: Props) {
  if (pestana === "perfiles") return <PlannerPerfiles control={control} />;
  if (pestana === "insumos") return <PlannerInsumos control={control} />;
  return <PlannerIdentidad control={control} />;
}

// --- Identidad -----------------------------------------------------------------

function PlannerIdentidad({ control }: { control: ControlPlanner }) {
  const { estado, declarar, guardando } = control;
  const base = estado?.planner.estudio;
  const [form, setForm] = useState({ nombre: "", codigo: "", cliente: "" });
  const cal = usePlannerCalendario(estado?.revision);
  useEffect(() => {
    if (base) setForm(base);
  }, [base]);
  if (!estado || !base) return null;
  const cambio = form.nombre !== base.nombre || form.codigo !== base.codigo || form.cliente !== base.cliente;
  const declarable = cambio;

  return (
    <div className="planner-seccion">
      <PlannerCabecera
        titulo="Identidad del estudio"
        lead="El nombre, el código y el cliente con que todos los módulos nombran este estudio."
        origen={estado.origen.estudio}
        declaradoEn={estado.declaradoEn.estudio}
        acciones={(
          <button
            type="button"
            className="plan-button plan-button--primary"
            disabled={!declarable || guardando === "estudio" || !form.nombre.trim()}
            onClick={() => void declarar("estudio", form)}
          >
            {guardando === "estudio" ? "Guardando…" : "Guardar"}
          </button>
        )}
      />
      <div className="planner-form">
        <label className="planner-campo planner-campo--ancho">
          <span>Nombre</span>
          <input value={form.nombre} maxLength={160} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
        </label>
        <label className="planner-campo">
          <span>Código</span>
          <input value={form.codigo} maxLength={40} onChange={(e) => setForm({ ...form, codigo: e.target.value })} />
        </label>
        <label className="planner-campo">
          <span>Cliente</span>
          <input value={form.cliente} maxLength={160} onChange={(e) => setForm({ ...form, cliente: e.target.value })} />
        </label>
      </div>
      <PlannerFaseActiva cal={cal} />
    </div>
  );
}

// --- Perfiles de recojo ------------------------------------------------------------

function perfilNuevo(tipo: PlannerTipoPerfil): PlannerPerfil {
  return {
    tipo,
    seleccion: tipo === "aulas" ? "conglomerados" : tipo === "territorial" ? "ump_aleatoria" : null,
    diseno: tipo === "territorial" ? "hojas-ruta" : "calc-muestra",
    canales: [],
    poblaciones: [{ id: "principal", etiqueta: tipo === "aulas" ? "Estudiantes" : "Población", bases: [], representatividad: null }],
  };
}

function idDeEtiqueta(etiqueta: string, i: number) {
  const id = etiqueta.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return id || `poblacion-${i + 1}`;
}

function PlannerPerfiles({ control }: { control: ControlPlanner }) {
  const { estado, declarar, guardando } = control;
  const [perfiles, setPerfiles] = useState<PlannerPerfil[]>([]);
  useEffect(() => {
    if (estado) setPerfiles(estado.planner.perfiles);
  }, [estado]);
  if (!estado) return null;

  const activos = new Set(perfiles.map((p) => p.tipo));
  const conCalc = perfiles.filter((p) => p.diseno === "calc-muestra");
  const sinCambios = JSON.stringify(perfiles) === JSON.stringify(estado.planner.perfiles);
  const declarable = (!sinCambios || estado.origen.perfiles === "vacio") && perfiles.length > 0 && conCalc.length <= 1;

  const alternar = (tipo: PlannerTipoPerfil) => {
    setPerfiles((prev) => (prev.some((p) => p.tipo === tipo)
      ? prev.filter((p) => p.tipo !== tipo)
      : [...prev, perfilNuevo(tipo)].sort((a, b) => PLANNER_TIPOS_PERFIL.indexOf(a.tipo) - PLANNER_TIPOS_PERFIL.indexOf(b.tipo))));
  };
  const editar = (tipo: PlannerTipoPerfil, cambio: Partial<PlannerPerfil>) => {
    setPerfiles((prev) => prev.map((p) => (p.tipo === tipo ? { ...p, ...cambio } : p)));
  };

  return (
    <div className="planner-seccion">
      <PlannerCabecera
        titulo="Perfiles de recojo"
        lead="Cómo se recoge este estudio. Cada perfil fija el modo de Cálculo de muestra, Material de campo y Monitoreo."
        origen={estado.origen.perfiles}
        declaradoEn={estado.declaradoEn.perfiles}
        acciones={(
          <button
            type="button"
            className="plan-button plan-button--primary"
            disabled={!declarable || guardando === "perfiles"}
            onClick={() => void declarar("perfiles", perfiles)}
          >
            {guardando === "perfiles" ? "Guardando…" : estado.origen.perfiles === "vacio" ? "Declarar perfiles" : "Guardar"}
          </button>
        )}
      />
      <PlannerAvisos avisos={estado.conflictos} tono="conflicto" />
      <PlannerAvisos avisos={estado.avisos} tono="aviso" />
      {conCalc.length > 1 ? (
        <PlannerAvisos tono="conflicto" avisos={[{ mensaje: "Sólo un perfil puede diseñar su muestra en Cálculo de muestra." }]} />
      ) : null}

      <div className="planner-tipos" role="group" aria-label="Perfiles del estudio">
        {PLANNER_TIPOS_PERFIL.map((tipo) => (
          <div key={tipo} className={`planner-tipo${activos.has(tipo) ? " is-activo" : ""}`}>
            <PulsoSwitch
              checked={activos.has(tipo)}
              onCheckedChange={() => alternar(tipo)}
              label={ETIQUETA_PERFIL[tipo]}
              description={DETALLE_PERFIL[tipo]}
            />
          </div>
        ))}
      </div>

      {perfiles.length === 0 ? (
        <p className="planner-vacio">Marca al menos un perfil: sin él, ningún módulo sabe en qué modo abrir.</p>
      ) : (
        <div className="planner-perfiles">
          {perfiles.map((p) => (
            <PerfilTarjeta key={p.tipo} perfil={p} onCambio={(c) => editar(p.tipo, c)} />
          ))}
        </div>
      )}
    </div>
  );
}

function PerfilTarjeta({ perfil, onCambio }: { perfil: PlannerPerfil; onCambio: (c: Partial<PlannerPerfil>) => void }) {
  const modos = modosDelPerfil(perfil);
  const editarPoblacion = (i: number, etiqueta: string) => {
    onCambio({ poblaciones: perfil.poblaciones.map((x, j) => (j === i ? { ...x, etiqueta } : x)) });
  };
  const agregarPoblacion = () => {
    const i = perfil.poblaciones.length;
    onCambio({ poblaciones: [...perfil.poblaciones, { id: idDeEtiqueta(`poblacion ${i + 1}`, i), etiqueta: `Población ${i + 1}`, bases: [], representatividad: null }] });
  };
  const quitarPoblacion = (i: number) => onCambio({ poblaciones: perfil.poblaciones.filter((_, j) => j !== i) });

  return (
    <article className="planner-perfil" aria-label={ETIQUETA_PERFIL[perfil.tipo]}>
      <h3>{ETIQUETA_PERFIL[perfil.tipo]}</h3>
      <div className="planner-form">
        <label className="planner-campo">
          <span>Diseña la muestra</span>
          {perfil.tipo === "territorial" ? (
            <output>{ETIQUETA_DISENO[perfil.seleccion === "conveniencia" ? "cuotas" : "hojas-ruta"]}</output>
          ) : (
            <select value={perfil.diseno} onChange={(e) => onCambio({ diseno: e.target.value as PlannerDiseno })}>
              <option value="calc-muestra">{ETIQUETA_DISENO["calc-muestra"]}</option>
              <option value="cliente">{ETIQUETA_DISENO.cliente}</option>
            </select>
          )}
        </label>
        {perfil.tipo === "territorial" ? (
          <label className="planner-campo">
            <span>Selección</span>
            <select
              value={perfil.seleccion === "conveniencia" ? "conveniencia" : "ump_aleatoria"}
              onChange={(e) => onCambio({
                seleccion: e.target.value as PlannerPerfil["seleccion"],
                diseno: e.target.value === "conveniencia" ? "cuotas" : "hojas-ruta",
              })}
            >
              <option value="ump_aleatoria">UMP aleatoria con hoja de ruta</option>
              <option value="conveniencia">Por conveniencia o cuotas</option>
            </select>
          </label>
        ) : null}
        {perfil.tipo === "aulas" ? (
          <label className="planner-campo">
            <span>Selección</span>
            <select value={perfil.seleccion ?? "conglomerados"} onChange={(e) => onCambio({ seleccion: e.target.value as PlannerPerfil["seleccion"] })}>
              <option value="conglomerados">Cursos-horario (conglomerados)</option>
              <option value="marco">Personas de un marco</option>
            </select>
          </label>
        ) : null}
      </div>

      <div className="planner-poblaciones">
        <span className="planner-subtitulo">Poblaciones</span>
        {perfil.poblaciones.map((x, i) => (
          <div key={`${x.id}-${i}`} className="planner-poblacion">
            <input
              aria-label={`Nombre de la población ${i + 1}`}
              value={x.etiqueta}
              maxLength={80}
              onChange={(e) => editarPoblacion(i, e.target.value)}
            />
            {x.bases.length ? <span className="planner-chip" title={`Base: ${x.bases.join(", ")}`}>Base: {x.bases.join(", ")}</span> : null}
            <button
              type="button"
              className="plan-icon-button"
              aria-label={`Quitar ${x.etiqueta}`}
              disabled={perfil.poblaciones.length === 1}
              onClick={() => quitarPoblacion(i)}
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
        <button type="button" className="plan-button" onClick={agregarPoblacion}>
          <Plus size={14} /> <span>Agregar población</span>
        </button>
      </div>

      <dl className="planner-modos">
        <div><dt>Cálculo de muestra</dt><dd>{modos.calc}</dd></div>
        <div><dt>Hojas de ruta</dt><dd>{modos.hojas}</dd></div>
        <div><dt>Material de campo</dt><dd>{modos.material}</dd></div>
        <div><dt>Monitoreo</dt><dd>{modos.monitoreo}</dd></div>
      </dl>
    </article>
  );
}

// --- Insumos del cliente --------------------------------------------------------

// Alto con la tabla entera a la vista: la sección ya está dentro de un panel
// que es el único dueño del desplazamiento (No Scroll Jail).
function altoSinScrollPropio(filas: number) {
  return 32 + PULSO_TABLE_ALTO_FILA.comoda * Math.max(filas, 1) + 4;
}

const TIPOS_INSUMO: Record<string, string> = { padron: "Padrón", listado: "Listado", marco: "Marco muestral", otro: "Otro" };

function columnasInsumos(quitar: (id: string) => void): PulsoTableColumna<PlannerInsumo>[] {
  return [
    { id: "etiqueta", encabezado: "Insumo", ancho: 210, celda: (k) => k.etiqueta, valor: (k) => k.etiqueta },
    { id: "tipo", encabezado: "Tipo", ancho: 110, celda: (k) => TIPOS_INSUMO[k.tipo] ?? k.tipo, valor: (k) => k.tipo },
    {
      id: "archivo", encabezado: "Archivo", ancho: 210, valor: (k) => k.archivo_nombre ?? "",
      // El archivo se queda donde está: el Planner sólo dice a cuál apunta.
      celda: (k) => (k.archivo_estado === "en_proyecto"
        ? <span title={k.archivo_nombre}>{k.archivo_nombre}</span>
        : k.archivo_estado === "falta"
          ? <span className="planner-insumo-falta">Ya no está en el proyecto</span>
          : <span className="planner-insumo-externo">Fuera del proyecto</span>),
    },
    { id: "origen", encabezado: "Origen", ancho: 150, celda: (k) => k.origen || "—", valor: (k) => k.origen },
    { id: "registrado", encabezado: "Registrado", ancho: 100, celda: (k) => k.registrado_en || "—", valor: (k) => k.registrado_en },
    {
      id: "acciones", encabezado: "", ancho: 50, celda: (k) => (
        <button type="button" className="plan-icon-button" aria-label={`Quitar ${k.etiqueta}`} onClick={() => quitar(k.id)}>
          <Trash2 size={14} />
        </button>
      ),
    },
  ];
}

function PlannerInsumos({ control }: { control: ControlPlanner }) {
  const { estado, declarar, guardando } = control;
  const [insumos, setInsumos] = useState<PlannerInsumo[]>([]);
  const [nuevo, setNuevo] = useState({ tipo: "padron", etiqueta: "", origen: "", archivo: "" });
  useEffect(() => {
    if (estado) setInsumos(estado.planner.insumos);
  }, [estado]);
  if (!estado) return null;
  const sinCambios = JSON.stringify(insumos) === JSON.stringify(estado.planner.insumos);

  const agregar = () => {
    const etiqueta = nuevo.etiqueta.trim();
    if (!etiqueta) return;
    const archivo = estado.archivos.find((f) => f.file_id === nuevo.archivo);
    setInsumos([...insumos, {
      id: idDeEtiqueta(etiqueta, insumos.length), tipo: nuevo.tipo, etiqueta, archivo: nuevo.archivo, origen: nuevo.origen.trim(),
      registrado_en: new Date().toISOString().slice(0, 10),
      archivo_nombre: archivo?.nombre ?? "", archivo_estado: archivo ? "en_proyecto" : "externo",
    }]);
    setNuevo({ tipo: nuevo.tipo, etiqueta: "", origen: "", archivo: "" });
  };

  return (
    <div className="planner-seccion">
      <PlannerCabecera
        titulo="Insumos del cliente"
        lead="Padrones, listados y marcos que entrega el cliente: qué es cada uno, de dónde vino y qué archivo es. El archivo se queda donde está."
        origen={estado.origen.insumos}
        declaradoEn={estado.declaradoEn.insumos}
        acciones={(
          <button
            type="button"
            className="plan-button plan-button--primary"
            disabled={(sinCambios && estado.origen.insumos === "declarado") || guardando === "insumos"}
            onClick={() => void declarar("insumos", insumos)}
          >
            {guardando === "insumos" ? "Guardando…" : "Guardar"}
          </button>
        )}
      />
      <PulsoTable
        ariaLabel="Insumos del cliente"
        columnas={columnasInsumos((id) => setInsumos(insumos.filter((x) => x.id !== id)))}
        filas={insumos}
        idDeFila={(k) => k.id}
        densidad="comoda"
        altoMaximo={altoSinScrollPropio(insumos.length)}
        vacio={<p className="planner-vacio">Este estudio todavía no registra insumos del cliente.</p>}
      />
      <div className="planner-form planner-form--fila" aria-label="Agregar insumo">
        <label className="planner-campo">
          <span>Tipo</span>
          <select value={nuevo.tipo} onChange={(e) => setNuevo({ ...nuevo, tipo: e.target.value })}>
            {Object.entries(TIPOS_INSUMO).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        <label className="planner-campo">
          <span>Archivo</span>
          <select
            value={nuevo.archivo}
            onChange={(e) => {
              const archivo = estado.archivos.find((f) => f.file_id === e.target.value);
              setNuevo({ ...nuevo, archivo: e.target.value, etiqueta: nuevo.etiqueta || archivo?.nombre || "" });
            }}
          >
            <option value="">Fuera del proyecto</option>
            {estado.archivos.map((f) => <option key={f.file_id} value={f.file_id}>{f.nombre}</option>)}
          </select>
        </label>
        <label className="planner-campo planner-campo--ancho">
          <span>Nombre</span>
          <input value={nuevo.etiqueta} maxLength={120} onChange={(e) => setNuevo({ ...nuevo, etiqueta: e.target.value })} />
        </label>
        <label className="planner-campo">
          <span>Origen</span>
          <input value={nuevo.origen} maxLength={160} placeholder="Quién lo entregó" onChange={(e) => setNuevo({ ...nuevo, origen: e.target.value })} />
        </label>
        <button type="button" className="plan-button" disabled={!nuevo.etiqueta.trim()} onClick={agregar}>
          <Plus size={14} /> <span>Agregar</span>
        </button>
      </div>
    </div>
  );
}
