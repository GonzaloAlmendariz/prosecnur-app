import { useEffect, useState, type ReactNode } from "react";
import { pctPerfil } from "./kpisDeAulas";

import {
  apiMonitoreoAulasAvanceTablas,
  type MonitoreoAulasAvanceTabla,
} from "../../../../api/monitoreo";
import { escalaDeColumna, tintaDeCelda, type ClaveDeSemaforo } from "./semaforoDeAvance";
import "./aulasTablasDeAvance.css";

/**
 * Las cinco tablas de «Avance de campo», en la app.
 *
 * Gonzalo, 2026-09-08, cuando se le preguntó si debían viajar del Sheets a la
 * app o al revés: «es que se supone que estas tablas se generan desde la app,
 * siendo que la app tiene toda esta info y la puede plasmar en una tabla, sheets
 * interno». Y antes, la regla general: «todo el contenido que se llena en la app
 * lo lee del Sheets, y todo el contenido que coge información de plataforma y
 * ordena toda esa información es la app, para nutrir la app y luego para nutrir
 * el Sheets interno».
 *
 * Las cinco ya se calculaban en el motor; lo que faltaba era la puerta. Aquí no
 * se recalcula nada ni se decide ningún formato: el endpoint publica los
 * rótulos, qué columna es porcentaje y qué escala de color le toca, y esta
 * pantalla lo pinta. **El contrato viaja con los datos a propósito**: si el
 * front decidiera, habría dos respuestas a la misma pregunta y una acabaría
 * mintiendo, que es lo que ya pasó con «Diferencia» publicada como «−3 500,0 %».
 *
 * Se pide en su propio endpoint y no en `/monitoreo/state`: estas cinco cruzan
 * las respuestas con el plan aula por aula, y el estado lo pide cada pantalla
 * del perfil en cada refresco.
 */
export function AulasTablasDeAvance(): ReactNode {
  const [tablas, setTablas] = useState<MonitoreoAulasAvanceTabla[] | null>(null);
  const [error, setError] = useState("");
  const [corte, setCorte] = useState("");

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const res = await apiMonitoreoAulasAvanceTablas();
        if (!vivo) return;
        setTablas(res.tablas ?? []);
        // **El CORTE primero, no el titular.** Se prefería el titular y salía la
        // misma frase dos veces con tres líneas de por medio: como línea de la
        // sección y como nota de «Avance general», que es de donde sale. Encima
        // tapaba lo único que no dice ninguna tabla, que es a qué día y a qué
        // hora corresponde lo que se está mirando. Visto en pantalla el
        // 2026-09-09; es la misma avería que Gonzalo señaló en Metas.
        setCorte(res.corte || res.titular || "");
      } catch (e) {
        if (vivo) setError((e as Error).message);
      }
    })();
    return () => { vivo = false; };
  }, []);

  if (error) {
    // El fallo se dice con su causa, no con un panel vacío: sin esto la vista
    // se leería como «este estudio no tiene tablas», que es otra cosa.
    return (
      <p className="mon-profile-muted aulas-tav-vacio" data-qa-geometry-capacity="owned" data-qa-geometry-member="true">
        No se pudieron leer las tablas de avance: {error}
      </p>
    );
  }
  if (!tablas) {
    // **Mientras llega, la vista no está lista** (Meta B, L10). Estas tablas se
    // piden en su propio endpoint, después del estado: la marca de la página ya
    // dice `monitoreo-aulas-avance-salidas` y el runner capturaba «Leyendo las
    // tablas de avance...» como si fuera la pestaña. Con las tablas, su vacío o
    // su error, la marca desaparece y manda la de la página.
    return (
      <p className="mon-profile-muted aulas-tav-vacio" aria-busy="true" data-qa-geometry-capacity="owned" data-qa-geometry-member="true">
        <span hidden data-audit-ready="false" />
        Leyendo las tablas de avance...
      </p>
    );
  }
  if (!tablas.length) {
    return (
      <p className="mon-profile-muted aulas-tav-vacio" data-qa-geometry-capacity="owned" data-qa-geometry-member="true">
        Todavía no hay tablas de avance. Aparecen cuando el estudio declara su
        plan de cursos-horario y llegan las primeras respuestas.
      </p>
    );
  }

  return (
    // El contenedor de datos del panel «Así se verá el libro». Sin declararlo,
    // el runner cae al ENCABEZADO del panel y canta `capacity-drift` sobre sus
    // 5 px de padding. Mismo patrón que «Respuestas», «Por facultad», «Avance
    // por facultad y sexo» y «Metas por facultad y sexo».
    <div className="aulas-tav" data-qa-geometry-capacity="owned" data-qa-geometry-member="true">
      {corte ? <p className="aulas-tav-corte">{corte}</p> : null}
      {tablas.map((t) => <Tabla key={t.clave} tabla={t} />)}
    </div>
  );
}

function Tabla({ tabla }: { tabla: MonitoreoAulasAvanceTabla }): ReactNode {
  const { cabecera, filas, tipos, semaforos, traspuesta } = tabla;
  // La escala de cada columna de diferencia se calcula UNA vez: gradúa la
  // intensidad del rojo y del verde contra el mayor desvío de esa columna, para
  // que un −2 no se vea igual de grave que un −180.
  const escalas = cabecera.map((_, j) => escalaDeColumna(filas, j));

  return (
    <section className="aulas-tav-bloque">
      <div className="aulas-tav-head">
        <h4>{tabla.titulo}</h4>
        {tabla.nota ? <p className="aulas-tav-nota">{tabla.nota}</p> : null}
      </div>
      {!filas.length ? (
        // El vacío lo redacta el motor, con su causa. No se inventa aquí uno
        // nuevo: la hoja y la pantalla dirían cosas distintas del mismo hueco.
        <p className="mon-profile-muted aulas-tav-vacio" data-qa-geometry-capacity="owned" data-qa-geometry-member="true">
          {tabla.vacio || "Sin filas que mostrar todavía."}
        </p>
      ) : (
        <div className="aulas-tav-marco">
          <table className="aulas-tav-tabla">
            <thead>
              <tr>
                {cabecera.map((c, j) => (
                  <th key={c} scope="col" className={j === 0 ? "" : "es-num"}>{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filas.map((fila, i) => (
                <tr key={String(fila[0] ?? i)}>
                  {fila.map((celda, j) => (
                    <Celda
                      key={j}
                      valor={celda}
                      // En la traspuesta manda la FILA: su rótulo decide si la
                      // celda es porcentaje y de qué color va, porque cada
                      // renglón es un concepto distinto.
                      tipo={traspuesta && j > 0
                        ? tabla.tipos_fila?.[i] ?? "numero"
                        : tipos?.[j] ?? (j === 0 ? "texto" : "numero")}
                      semaforo={(traspuesta && j > 0
                        ? tabla.semaforos_fila?.[i]
                        : semaforos?.[j]) ?? ""}
                      escala={escalas[j]}
                      encabeza={j === 0}
                    />
                  ))}
                </tr>
              ))}
            </tbody>
            {tabla.total?.length ? (
              <tfoot>
                <tr className="aulas-tav-total">
                  {tabla.total.map((celda, j) => (
                    <Celda
                      key={j}
                      valor={celda}
                      tipo={tipos?.[j] ?? (j === 0 ? "texto" : "numero")}
                      semaforo=""
                      escala={escalas[j]}
                      encabeza={j === 0}
                    />
                  ))}
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>
      )}
      {tabla.nota_pie ? <p className="aulas-tav-pie">{tabla.nota_pie}</p> : null}
    </section>
  );
}

function Celda({ valor, tipo, semaforo, escala, encabeza }: {
  valor: string | number | null;
  tipo: "texto" | "numero" | "porcentaje";
  semaforo: ClaveDeSemaforo;
  escala: number;
  encabeza: boolean;
}): ReactNode {
  const tinta = tintaDeCelda(semaforo, valor, escala);
  const contenido = formatear(valor, tipo);
  const estilo = tinta.fondo || tinta.texto
    ? { background: tinta.fondo, color: tinta.texto }
    : undefined;
  if (encabeza) {
    return <th scope="row" className="aulas-tav-rotulo">{contenido}</th>;
  }
  return <td className="aulas-tav-cifra es-num" style={estilo}>{contenido}</td>;
}

/**
 * Una celda sin dato viaja como `null` y se escribe «—» AQUÍ.
 *
 * El motor lo manda crudo a propósito: cada pantalla declara su propio vacío en
 * vez de heredar el del Sheets. Y un cero no es un vacío: «0» dice que se
 * midió y salió cero, «—» que no hay con qué medirlo.
 *
 * Los porcentajes llegan como proporción (0 a 1), no como 19.8: el tipo lo dice
 * y la conversión se hace una vez, aquí.
 */
function formatear(valor: string | number | null, tipo: "texto" | "numero" | "porcentaje"): string {
  // **El `null` de R no llega como `null`.** `jsonlite` serializa un `NULL`
  // dentro de una lista como `{}`, así que la celda vacía cruza la frontera
  // convertida en objeto y `String(valor)` la publicaba como «[object Object]»,
  // visto en pantalla el 2026-09-08 en las tres filas de aulas por sexo.
  //
  // Normalizador defensivo en la frontera, que es el patrón de la casa: el
  // motor tiene su contrato y esta pantalla no depende de que jsonlite no
  // cambie de opinión.
  if (valor !== null && typeof valor === "object") return "—";
  if (valor === null || valor === undefined || valor === "") return "—";
  if (tipo === "texto") return String(valor);
  const n = Number(valor);
  if (!Number.isFinite(n)) return String(valor);
  if (tipo === "porcentaje") {
    return pctPerfil(n * 100);
  }
  // Los conteos van sin decimal; lo fraccionario legítimo (tasas por aula) lo
  // trae ya redondeado el motor.
  return n.toLocaleString("es-PE", { maximumFractionDigits: 1 });
}
