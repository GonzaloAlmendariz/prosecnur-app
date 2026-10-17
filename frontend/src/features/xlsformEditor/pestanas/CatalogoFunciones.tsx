import { useMemo, useState } from "react";
import type { LogicScope } from "../logic";
import { describeExpression } from "../canvas/reglasHumanas";
import { PanelCard } from "../kit";

// Catálogo de funciones XLSForm para escribir cálculos (revamp E6, 2026-10-16): firma, qué hace en una línea y un
// ejemplo que se lee con la misma voz que el resto del editor. Son las funciones que aparecen en el corpus real.

type Funcion = { id: string; grupo: string; firma: string; hace: string; ejemplo: string };

const D = "$";
const FUNCIONES: Funcion[] = [
  { id: "if", grupo: "Lógica", firma: "if(condición, si_sí, si_no)", hace: "Devuelve un valor u otro según una condición. Se anidan para más casos.", ejemplo: `if(${D}{edad} < 25, 'joven', 'adulto')` },
  { id: "selected", grupo: "Lógica", firma: "selected(pregunta, 'opción')", hace: "Verdadero si en una pregunta múltiple se marcó esa opción.", ejemplo: `selected(${D}{servicios}, 'salud')` },
  { id: "count-selected", grupo: "Lógica", firma: "count-selected(pregunta)", hace: "Cuántas opciones se marcaron en una pregunta múltiple.", ejemplo: `count-selected(${D}{servicios})` },
  { id: "coalesce", grupo: "Números", firma: "coalesce(valor, si_vacío)", hace: "Usa el segundo valor cuando el primero está vacío. Evita sumas que quedan vacías.", ejemplo: `coalesce(${D}{hijos}, 0) + coalesce(${D}{hijas}, 0)` },
  { id: "round", grupo: "Números", firma: "round(número, decimales)", hace: "Redondea a la cantidad de decimales indicada.", ejemplo: `round(${D}{puntaje} div 3, 1)` },
  { id: "int", grupo: "Números", firma: "int(número)", hace: "Se queda con la parte entera.", ejemplo: `int(${D}{meses} div 12)` },
  { id: "sum", grupo: "Grupos repetidos", firma: "sum(pregunta del grupo)", hace: "Suma una pregunta en todas las filas de un grupo repetido.", ejemplo: `sum(${D}{ingreso_miembro})` },
  { id: "count", grupo: "Grupos repetidos", firma: "count(grupo)", hace: "Cuántas filas tiene un grupo repetido.", ejemplo: `count(${D}{miembros})` },
  { id: "indexed-repeat", grupo: "Grupos repetidos", firma: "indexed-repeat(pregunta, grupo, fila)", hace: "Lee una respuesta de una fila concreta de un grupo repetido.", ejemplo: `indexed-repeat(${D}{nombre}, ${D}{miembros}, 1)` },
  { id: "concat", grupo: "Texto", firma: "concat(texto, texto, …)", hace: "Une varios textos en uno.", ejemplo: `concat(${D}{nombres}, ' ', ${D}{apellidos})` },
  { id: "string-length", grupo: "Texto", firma: "string-length(texto)", hace: "Cuántos caracteres tiene un texto.", ejemplo: `string-length(${D}{telefono})` },
  { id: "regex", grupo: "Texto", firma: "regex(texto, patrón)", hace: "Verdadero si el texto sigue un patrón (formato de DNI, correo, teléfono).", ejemplo: `regex(${D}{dni}, '^[0-9]{8}$')` },
  { id: "today", grupo: "Fechas", firma: "today()", hace: "La fecha del día en que se aplica la encuesta.", ejemplo: "today()" },
  { id: "once", grupo: "Fechas", firma: "once(valor)", hace: "Guarda el valor la primera vez y ya no cambia (hora de inicio).", ejemplo: "once(now())" },
  { id: "format-date", grupo: "Fechas", firma: "format-date(fecha, '%Y')", hace: "Saca el año (%Y), mes (%m) o día (%d) de una fecha.", ejemplo: `format-date(${D}{fecha_nac}, '%Y')` },
  { id: "decimal-date-time", grupo: "Fechas", firma: "decimal-date-time(fecha)", hace: "La fecha como número de días: sirve para restar fechas y medir duraciones.", ejemplo: `int((decimal-date-time(${D}{fin}) - decimal-date-time(${D}{inicio})) * 24 * 60)` },
  { id: "pulldata", grupo: "Tablas externas", firma: "pulldata('tabla', 'columna', 'clave', valor)", hace: "Trae un dato de una tabla CSV adjunta al formulario.", ejemplo: `pulldata('padron', 'sede', 'telefono', ${D}{telefono})` },
];

export function CatalogoFunciones({ scope }: { scope: LogicScope }) {
  const [busca, setBusca] = useState("");
  const [elegida, setElegida] = useState("if");
  const visibles = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return q ? FUNCIONES.filter((f) => `${f.id} ${f.hace} ${f.grupo}`.toLowerCase().includes(q)) : FUNCIONES;
  }, [busca]);
  const grupos = [...new Set(visibles.map((f) => f.grupo))];
  const actual = FUNCIONES.find((f) => f.id === elegida) ?? FUNCIONES[0];
  return (
    <aside className="xfp-catalogo" aria-label="Funciones para cálculos">
      <PanelCard title="Funciones" meta={`${FUNCIONES.length}`} flush fill>
        <div className="xfp-catalogo__busca">
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar función" aria-label="Buscar función" />
        </div>
        <div className="xfp-catalogo__lista" data-qa-geometry-group="xlsform/catalogo-funciones" data-qa-geometry-contract="intrinsic">
          {grupos.map((g) => (
            <div key={g} className="xfp-catalogo__grupo">
              <span className="xfp-catalogo__gtit">{g}</span>
              {visibles.filter((f) => f.grupo === g).map((f) => (
                <button key={f.id} type="button" className={f.id === actual.id ? "xfp-fn is-on" : "xfp-fn"} onClick={() => setElegida(f.id)} aria-pressed={f.id === actual.id}>
                  <code>{f.id}</code>
                </button>
              ))}
            </div>
          ))}
          {visibles.length === 0 ? <p className="xfp-nota xfp-nota--pad">Ninguna función coincide.</p> : null}
        </div>
      </PanelCard>
      <PanelCard title={actual.firma} flush>
        <div className="xfp-catalogo__doc">
          <p>{actual.hace}</p>
          <span className="xfk-over">Ejemplo</span>
          <code className="xfp-catalogo__ej">{actual.ejemplo}</code>
          <span className="xfp-catalogo__lee">{describeExpression(actual.ejemplo, scope).summary}</span>
        </div>
      </PanelCard>
    </aside>
  );
}
