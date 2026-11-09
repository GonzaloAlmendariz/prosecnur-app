// «Así se lee la lógica» en Impreso › Lógica (L36 · D-L36-20): cada condición, salto y salida tal como irá al
// papel, pregunta por pregunta, más los avisos de lógica del motor. Sale del mismo modelo que dibujan el Word y el
// PDF, así que se lee antes de imprimir lo que se imprimirá. Se vuelve a pedir tras una espera cuando cambian el
// formulario o las opciones.

import { useEffect, useMemo, useState } from "react";
import type { XlsformEditorWorkbook } from "../../../api/multiIntegrado";
import type { XlsformPaperExportOptions } from "../../../api/xlsformEditor";
import { apiLogicaImpresa, type InstruccionImpresa, type LogicaImpresa as Logica } from "../../../api/xlsformImpreso";
import { TarjetaImpreso } from "./TarjetaImpreso";

export const ESPERA_LOGICA_MS = 600;

type Estado =
  | { fase: "cargando" }
  | { fase: "lista"; logica: Logica }
  | { fase: "error"; causa: string };

export type GrupoDeLogica = { numero: string; nombre: string; instrucciones: InstruccionImpresa[] };

/** Agrupa por pregunta conservando el orden del cuestionario. */
export function agruparLogica(instrucciones: readonly InstruccionImpresa[]): GrupoDeLogica[] {
  const grupos: GrupoDeLogica[] = [];
  for (const i of instrucciones) {
    const ultimo = grupos.at(-1);
    if (ultimo && ultimo.nombre === i.nombre && ultimo.numero === i.numero) ultimo.instrucciones.push(i);
    else grupos.push({ numero: i.numero, nombre: i.nombre, instrucciones: [i] });
  }
  return grupos;
}

export function rotuloInstruccion(i: InstruccionImpresa): string {
  if (i.tipo === "condicion") return "Antes de la pregunta";
  if (i.tipo === "salida") return "Al terminar la pregunta";
  return i.opcion ? `Si responde "${i.opcion}"` : "En una opción";
}

export function ListaLogicaImpresa({ estado }: { estado: Estado }) {
  const grupos = useMemo(() => (estado.fase === "lista" ? agruparLogica(estado.logica.instrucciones) : []), [estado]);
  if (estado.fase === "cargando") return <p className="pulso-xf-imp-logica-nota" role="status">Leyendo la lógica del formulario…</p>;
  if (estado.fase === "error") return <p className="pulso-xf-imp-logica-nota" role="alert">No pude leer la lógica: {estado.causa}</p>;
  const { avisos } = estado.logica;
  return (
    <>
      {avisos.length ? (
        <ul className="pulso-xf-imp-logica-avisos" aria-label="Avisos de la lógica">
          {avisos.map((a) => <li key={a}>{a}</li>)}
        </ul>
      ) : null}
      {grupos.length ? (
        <ol className="pulso-xf-imp-logica-lista" aria-label="Lógica impresa por pregunta">
          {grupos.map((g) => (
            <li key={`${g.numero}-${g.nombre}`} className="pulso-xf-imp-logica-pregunta">
              <span className="pulso-xf-imp-logica-numero">{g.numero || "—"}</span>
              <div className="pulso-xf-imp-logica-cuerpo">
                <code className="pulso-xf-imp-logica-variable">{g.nombre}</code>
                {g.instrucciones.map((i, k) => (
                  <p key={k} className="pulso-xf-imp-logica-linea">
                    <span className="pulso-xf-imp-logica-cuando">{rotuloInstruccion(i)}:</span> {i.texto}
                  </p>
                ))}
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <p className="pulso-xf-imp-logica-nota">Este formulario no tiene saltos ni condiciones: el papel no lleva instrucciones de lógica.</p>
      )}
    </>
  );
}

export function LogicaImpresa({ workbook, opciones }: {
  workbook: XlsformEditorWorkbook;
  opciones: XlsformPaperExportOptions;
}) {
  const [estado, setEstado] = useState<Estado>({ fase: "cargando" });
  useEffect(() => {
    let vigente = true;
    const t = setTimeout(() => {
      apiLogicaImpresa(workbook, opciones)
        .then((logica) => { if (vigente) setEstado({ fase: "lista", logica }); })
        .catch((error: unknown) => {
          if (vigente) setEstado({ fase: "error", causa: error instanceof Error && error.message ? error.message : "el servidor no respondió" });
        });
    }, ESPERA_LOGICA_MS);
    return () => { vigente = false; clearTimeout(t); };
  }, [workbook, opciones]);
  const n = estado.fase === "lista" ? estado.logica.instrucciones.length : null;
  return (
    <TarjetaImpreso
      id="imp-logica-impresa"
      titulo="Así se lee la lógica"
      ayuda={n === null ? "Cada condición y salto, tal como irá al papel." : `${n} ${n === 1 ? "instrucción" : "instrucciones"}, tal como irán al papel.`}
    >
      <ListaLogicaImpresa estado={estado} />
    </TarjetaImpreso>
  );
}
