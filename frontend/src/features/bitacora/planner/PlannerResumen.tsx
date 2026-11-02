// Planner › Estudio › Resumen (ADR 0123 §1, Q5): qué falta definir y cómo abre
// cada módulo con lo definido. Es el landing del Planner. No lee el avance de
// nadie (eso es del Home): dice lo que el estudio declaró y lo que activa.
//
// Un proyecto anterior al Planner abre vacío (ADR 0123 §5): sus módulos siguen
// en el modo que ya tenían, que `/api/planner/modos` deduce sin mostrarlo aquí
// como si estuviera declarado.

import { useEffect } from "react";
import { Link } from "react-router-dom";

import type { PlannerModos } from "../../../api/planner";
import { Check } from "../../../vendor/lucide-react";
import { PlannerCabecera } from "./PlannerCabecera";
import { ETIQUETA_PERFIL } from "./plannerCopia";
import type { ControlPlanner } from "./usePlanner";
import { usePlannerCalendario } from "./usePlannerCalendario";
import { usePlannerModos } from "./usePlannerModos";

const MODO_CALC: Record<string, string> = {
  "territorial-handoff": "Lo diseña Hojas de ruta",
  "opinion-universitaria": "Opinión universitaria",
  "marco-disponible": "Marco disponible",
  acreditacion: "Acreditación",
};
const MODO_MONITOREO: Record<string, string> = {
  territorial: "Territorial",
  aulas: "Cursos-horario",
  telefonico: "Telefónico",
  acreditacion: "Acreditación",
};
const CAMPANA: Record<string, string> = {
  territorial: "Campaña territorial",
  aulas: "Campaña de aulas",
  telefonica: "Campaña telefónica",
  correo: "Campaña de correo",
};

function comoAbre(modos: PlannerModos): [string, string | null][] {
  const lista = (xs: string[], rotulo: Record<string, string>) => (xs.length ? xs.map((x) => rotulo[x] ?? x).join(" · ") : null);
  return [
    ["Cálculo de muestra", modos.calc.modo ? MODO_CALC[modos.calc.modo] ?? modos.calc.modo : null],
    ["Hojas de ruta", modos.hojasRuta.aplica ? "Mapa, marco y sorteo de manzanas" : null],
    ["Material de campo", lista(modos.material.campanas, CAMPANA)],
    ["Monitoreo", lista(modos.monitoreo.modos, MODO_MONITOREO)],
  ];
}

type Definicion = { n: number; titulo: string; detalle: string; hecha: boolean; obligatoria: boolean; href: string };

export function PlannerResumen({ control }: { control: ControlPlanner }) {
  const { estado } = control;
  const { modos, recargar } = usePlannerModos();
  const cal = usePlannerCalendario(estado?.revision);
  useEffect(() => {
    void recargar();
  }, [estado?.revision, recargar]);
  if (!estado) return null;

  const { estudio, perfiles } = estado.planner;
  const identificada = estado.origen.estudio === "declarado" && Boolean(estudio.nombre);
  const conTipos = estado.origen.perfiles === "declarado" && perfiles.length > 0;
  const cronograma = cal?.ventana.origen === "declarado" || cal?.etapa.origen === "declarado";
  const definiciones: Definicion[] = [
    { n: 1, titulo: "Identificación", hecha: identificada, obligatoria: true, href: "/planner?seccion=estudio&pestana=identidad",
      detalle: identificada ? estudio.nombre : "Nombre, cliente, código y objetivo" },
    { n: 2, titulo: "Tipos de estudio", hecha: conTipos, obligatoria: true, href: "/planner?seccion=estudio&pestana=perfiles",
      detalle: conTipos ? perfiles.map((p) => ETIQUETA_PERFIL[p.tipo]).join(" · ") : "Perfiles, su rama y quién diseña la muestra" },
    { n: 3, titulo: "Camino entre módulos", hecha: conTipos, obligatoria: false, href: "/planner?seccion=camino&pestana=recorrido",
      detalle: conTipos ? "Sale de los tipos de estudio" : "Se arma cuando declares los tipos" },
    { n: 4, titulo: "Cronograma", hecha: cronograma, obligatoria: false, href: "/planner?seccion=cronograma&pestana=gantt",
      detalle: cal?.ventana.origen === "declarado" ? `Campo del ${cal.ventana.inicio} al ${cal.ventana.fin}` : "Fases, ventana, etapa y registro de decisiones" },
  ];
  const obligatorias = definiciones.filter((d) => d.obligatoria);
  const hechas = obligatorias.filter((d) => d.hecha).length;
  const siguiente = obligatorias.find((d) => !d.hecha);

  return (
    <div className="planner-seccion" data-audit-ready="planner-resumen">
      <PlannerCabecera
        titulo={identificada ? estudio.nombre : "Estudio sin definir"}
        lead={estudio.objetivo || "El Planner define el estudio una vez: su nombre, sus tipos, el camino entre los módulos y, si quieres, el cronograma."}
        acciones={siguiente ? (
          <Link className="plan-button plan-button--primary" to={siguiente.href}>Seguir con {siguiente.titulo.toLowerCase()}</Link>
        ) : null}
      />

      <div className="planner-avance" aria-label="Definiciones obligatorias">
        <span className="planner-avance-cifra"><b>{hechas}</b> de {obligatorias.length} definiciones obligatorias</span>
        <span className="planner-avance-barra" aria-hidden="true"><i style={{ transform: `scaleX(${hechas / obligatorias.length})` }} /></span>
      </div>

      <div className="planner-definiciones">
        {definiciones.map((d) => (
          <Link key={d.n} to={d.href} className={`planner-definicion${d.hecha ? " is-hecha" : ""}${d === siguiente ? " is-siguiente" : ""}`}>
            <span className="planner-definicion-n">
              {d.hecha ? <Check size={13} aria-hidden="true" /> : d.n}
            </span>
            <span className="planner-definicion-texto">
              <b>{d.titulo}</b>
              <small>{d.detalle}</small>
            </span>
            <span className={`planner-definicion-estado${d.hecha ? " is-hecha" : ""}`}>
              {d.hecha ? "Definida" : d.obligatoria ? "Pendiente" : "Opcional"}
            </span>
          </Link>
        ))}
      </div>

      {modos ? (
        <section className="planner-comoabre" aria-label="Así abre cada módulo con este estudio">
          <h3>Así abre cada módulo con este estudio</h3>
          {modos.origen === "deducido" ? (
            <p className="planner-comoabre-nota">
              El estudio todavía no declara sus tipos. Cada módulo sigue en el modo que ya tenía; lo que declares aquí
              manda desde entonces.
            </p>
          ) : null}
          <dl>
            {comoAbre(modos).map(([modulo, modo]) => (
              <div key={modulo} className={modo ? undefined : "is-no"}>
                <dt>{modulo}</dt>
                <dd>{modo ?? "No participa"}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}
    </div>
  );
}
