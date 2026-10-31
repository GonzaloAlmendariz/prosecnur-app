// Planner › Códigos: con qué número anota campo cada visita y cada llamada
// (ADR 0122 §6). El catálogo sólo agrega: un código no se borra ni cambia de
// grupo; se retira, y sigue leyéndose en lo que ya volvió de campo.

import { useEffect, useState } from "react";

import type { PlannerCodigo, PlannerCodigos as Catalogos } from "../../../api/planner";
import { PulsoTable, type PulsoTableColumna } from "../../../components/PulsoTable";
import { Plus, Undo2 } from "../../../vendor/lucide-react";
import { PlannerCabecera } from "./PlannerCabecera";
import type { ControlPlanner } from "./usePlanner";

const GRUPO: Record<PlannerCodigo["grupo"], string> = {
  efectiva: "Efectiva",
  no_aplicada: "No aplicada",
  manzana: "Unidad no elegible",
  otro: "Otro",
};

type Catalogo = "resultado" | "status_barrido";

const COPIA: Record<Catalogo, { titulo: string; lead: string; vacio: string }> = {
  resultado: {
    titulo: "Resultado de la visita",
    lead: "El número con que campo anota qué pasó en cada visita. Sale impreso en la hoja de ruteo y se cuenta en la de consolidados.",
    vacio: "Este estudio todavía no tiene códigos de resultado.",
  },
  status_barrido: {
    titulo: "Status del barrido",
    lead: "El estado con que se anota cada llamada del barrido telefónico.",
    vacio: "Este estudio todavía no tiene status de barrido.",
  },
};

export function PlannerCodigos({ control, pestana }: { control: ControlPlanner; pestana: string }) {
  const { estado, declarar, guardando } = control;
  const catalogo: Catalogo = pestana === "barrido" ? "status_barrido" : "resultado";
  const [borrador, setBorrador] = useState<Catalogos | null>(null);
  const [nuevo, setNuevo] = useState<{ codigo: string; rotulo: string; grupo: PlannerCodigo["grupo"] }>({ codigo: "", rotulo: "", grupo: "no_aplicada" });
  useEffect(() => {
    if (estado) setBorrador(estado.planner.codigos);
  }, [estado]);
  if (!estado || !borrador) return null;

  const guardados = new Set(estado.planner.codigos[catalogo].map((k) => k.codigo));
  const filas = borrador[catalogo];
  const sinCambios = JSON.stringify(borrador) === JSON.stringify(estado.planner.codigos);
  const copia = COPIA[catalogo];
  const repetido = filas.some((k) => k.codigo === nuevo.codigo.trim());

  const editar = (codigo: string, cambio: Partial<PlannerCodigo>) => {
    setBorrador({ ...borrador, [catalogo]: filas.map((k) => (k.codigo === codigo ? { ...k, ...cambio } : k)) });
  };
  const columnas: PulsoTableColumna<PlannerCodigo>[] = [
    { id: "codigo", encabezado: "Código", ancho: 80, tipo: "cifra", celda: (k) => <span className="planner-codigo">{k.codigo}</span>, valor: (k) => k.codigo },
    {
      id: "rotulo", encabezado: "Rótulo", ancho: 290, valor: (k) => k.rotulo, celda: (k) => (
        <input
          className="planner-celda-input"
          aria-label={`Rótulo del código ${k.codigo}`}
          value={k.rotulo}
          maxLength={60}
          disabled={k.retirado_en_version != null}
          onChange={(e) => editar(k.codigo, { rotulo: e.target.value })}
        />
      ),
    },
    { id: "grupo", encabezado: "Grupo", ancho: 160, celda: (k) => GRUPO[k.grupo], valor: (k) => k.grupo },
    {
      id: "estado", encabezado: "Estado", ancho: 170, celda: (k) => (
        k.retirado_en_version != null
          ? `Retirado en la versión ${k.retirado_en_version}`
          : k.retirar ? "Se retira al guardar" : "Vigente"
      ),
    },
    {
      id: "acciones", encabezado: "", ancho: 110, celda: (k) => (
        k.retirado_en_version != null ? null : guardados.has(k.codigo) ? (
          <button type="button" className="plan-button" onClick={() => editar(k.codigo, { retirar: !k.retirar })}>
            {k.retirar ? <><Undo2 size={14} /> <span>Mantener</span></> : <span>Retirar</span>}
          </button>
        ) : (
          <button type="button" className="plan-button" onClick={() => setBorrador({ ...borrador, [catalogo]: filas.filter((x) => x.codigo !== k.codigo) })}>
            <span>Quitar</span>
          </button>
        )
      ),
    },
  ];
  const agregar = () => {
    const codigo = nuevo.codigo.trim();
    if (!codigo || repetido) return;
    setBorrador({ ...borrador, [catalogo]: [...filas, { codigo, rotulo: nuevo.rotulo.trim(), grupo: nuevo.grupo, retirado_en_version: null }] });
    setNuevo({ codigo: "", rotulo: "", grupo: nuevo.grupo });
  };

  return (
    <div className="planner-seccion">
      <PlannerCabecera
        titulo={copia.titulo}
        lead={copia.lead}
        origen={estado.origen.codigos}
        declaradoEn={estado.declaradoEn.codigos}
        acciones={(
          <>
            <span className="planner-chip">Versión {borrador.version}</span>
            <button
              type="button"
              className="plan-button plan-button--primary"
              disabled={(sinCambios && estado.origen.codigos === "declarado") || guardando === "codigos"}
              onClick={() => void declarar("codigos", borrador)}
            >
              {guardando === "codigos" ? "Guardando…" : "Guardar"}
            </button>
          </>
        )}
      />
      <PulsoTable
        ariaLabel={copia.titulo}
        columnas={columnas}
        filas={filas}
        idDeFila={(k) => k.codigo}
        densidad="comoda"
        vacio={<p className="planner-vacio">{copia.vacio}</p>}
      />
      <div className="planner-form planner-form--fila" aria-label="Agregar código">
        <label className="planner-campo planner-campo--corto">
          <span>Código</span>
          <input value={nuevo.codigo} maxLength={8} onChange={(e) => setNuevo({ ...nuevo, codigo: e.target.value })} />
        </label>
        <label className="planner-campo planner-campo--ancho">
          <span>Rótulo</span>
          <input value={nuevo.rotulo} maxLength={60} onChange={(e) => setNuevo({ ...nuevo, rotulo: e.target.value })} />
        </label>
        <label className="planner-campo">
          <span>Grupo</span>
          <select value={nuevo.grupo} onChange={(e) => setNuevo({ ...nuevo, grupo: e.target.value as PlannerCodigo["grupo"] })}>
            {Object.entries(GRUPO).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        <button type="button" className="plan-button" disabled={!nuevo.codigo.trim() || repetido} onClick={agregar}>
          <Plus size={14} /> <span>Agregar</span>
        </button>
      </div>
      {repetido ? <p className="planner-ayuda" role="status">Ese código ya existe en el catálogo.</p> : null}
    </div>
  );
}
