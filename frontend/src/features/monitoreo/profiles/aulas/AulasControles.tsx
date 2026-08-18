import { useMemo } from "react";

import { AlertCircle, CheckCircle2, ShieldAlert } from "../../../../vendor/lucide-react";
import { aulasCheckLabel, aulasStatusLabel, presentDetail } from "./aulasPresentation";

/**
 * Los controles de Validación, leídos como avisos y no como una tabla.
 *
 * Eran nueve filas de «Control · Estado · Detalle» en una tabla de tres
 * columnas, y el detalle es lo que de verdad se lee: frases enteras —«CH 31: 26
 * asistentes menos 1 rechazos y 3 duplicados dan 22, pero el parte declara 21
 * efectivas»— aplastadas en una celda, con los tres que piden decisión mezclados
 * entre los cinco que están bien.
 *
 * El patrón ya existe y está **en esta misma sección**: `CalidadDeCampo`, el
 * bloque compartido que el chrome pone arriba, agrupa sus alertas por severidad
 * y las escribe como avisos. Tener dos listas de señales de calidad, una encima
 * de la otra y en dos lenguajes visuales distintos, era la incoherencia.
 *
 * Lo que pide decisión va primero. Un control correcto no desaparece —el gate
 * es «verde por conformidad, no por ausencia»— pero se lee en un renglón.
 */

type Severidad = "revisar" | "advertencia" | "correcto";

const SEVERIDAD: Record<string, Severidad> = {
  review: "revisar",
  warning: "advertencia",
  ok: "correcto",
};

const ORDEN: Record<Severidad, number> = { revisar: 0, advertencia: 1, correcto: 2 };

const ICONO = {
  revisar: ShieldAlert,
  advertencia: AlertCircle,
  correcto: CheckCircle2,
} as const;

function clave(valor: unknown) {
  return typeof valor === "string" ? valor.trim().toLowerCase() : "";
}

/**
 * Los casos que trae un detalle, uno por fila.
 *
 * El motor escribe la evidencia como prosa corrida: «CH 31: 25 asistentes menos
 * 1 rechazos y 3 duplicados de 21, pero el parte declara 20 efectivas (faltan
 * 1). CH 112: 38 asistentes…». Son datos tabulares —un aula, una cuenta, una
 * discrepancia— aplastados en una oración, y es literalmente lo que se ve
 * «sin ningún tipo de formato»: para saber cuántas aulas fallan hay que leer el
 * párrafo entero contando comas.
 *
 * Esto NO inventa ni deriva nada: parte la MISMA frase por donde el motor ya
 * separa los casos, que es el código de aula seguido de dos puntos.
 */
const CODIGO_DE_CASO = /([A-ZÁÉÍÓÚÑ]{1,4}\s?\d+[A-Za-z0-9._-]*)\s*:\s+/g;

export type TramoDeControl = { codigo: string; texto: string };

export function tramosDeControl(detalle: string): TramoDeControl[] {
  const texto = (detalle ?? "").trim();
  if (!texto) return [];
  const marcas = [...texto.matchAll(CODIGO_DE_CASO)];
  // Con un solo caso no hay nada que tabular y partir la frase sólo añade
  // ruido; con ninguno, el detalle es una frase de verdad y se deja entera.
  if (marcas.length < 2) return [{ codigo: "", texto }];

  const tramos: TramoDeControl[] = [];
  const preambulo = texto.slice(0, marcas[0].index ?? 0).trim();
  if (preambulo) tramos.push({ codigo: "", texto: preambulo });
  marcas.forEach((marca, i) => {
    const desde = (marca.index ?? 0) + marca[0].length;
    const hasta = i + 1 < marcas.length ? marcas[i + 1].index ?? texto.length : texto.length;
    tramos.push({ codigo: marca[1].replace(/\s+/g, " "), texto: texto.slice(desde, hasta).trim() });
  });

  // La cola —«Y 1 discrepancia más.»— habla del conjunto, no del último caso.
  // Pegada a él decía que ESA aula tenía una discrepancia más, que es falso.
  const ultimo = tramos[tramos.length - 1];
  const cola = /\s(Y\s\d+\s[^.]*\.)\s*$/.exec(ultimo.texto);
  if (cola) {
    ultimo.texto = ultimo.texto.slice(0, cola.index).trim();
    tramos.push({ codigo: "", texto: cola[1] });
  }
  return tramos;
}

export type ControlDeAulas = {
  control: string;
  detalle: string;
  /** El detalle partido por caso; un solo tramo cuando es una frase corrida. */
  tramos: TramoDeControl[];
  estado: string;
  /** Un estado que el motor añada mañana no se pierde: cae en «advertencia». */
  severidad: Severidad;
};

export function controlesDeAulas(filas: ReadonlyArray<Record<string, unknown>>) {
  const controles: ControlDeAulas[] = filas.map((fila) => {
    const estado = clave(fila.status);
    return {
      // Por los MISMOS helpers que usaba la tabla. Pintar `check` y `detail` en
      // crudo devolvía a la pantalla «field_report_reconciliation» y «El tablero
      // agrega por aula/collector/link»: la jerga del motor que la traducción
      // existe para tapar. Cambiar de superficie no puede saltarse la capa de
      // presentación.
      control: aulasCheckLabel(fila.check ?? fila.control),
      detalle: presentDetail(fila.detail ?? fila.detalle ?? ""),
      tramos: tramosDeControl(presentDetail(fila.detail ?? fila.detalle ?? "")),
      // Un control SIN estado legible sí es algo que revisar: el control existe
      // y no se pudo leer su veredicto. `aulasStatusLabel` devuelve «—» para el
      // vacío porque en una tabla eso significa «no hay dato»; aquí significa
      // otra cosa, y lo dice quien conoce el contexto. La misma palabra servía
      // para las dos y por eso las 196 aulas decían «Estado de ficha: Por
      // revisar» sin que hubiera una sola ficha.
      estado: estado ? aulasStatusLabel(fila.status) : "Por revisar",
      // Lista cerrada con salida declarada: si el engine emite un estado nuevo,
      // se ve como advertencia en vez de desaparecer en silencio.
      severidad: SEVERIDAD[estado] ?? "advertencia",
    };
  });
  controles.sort((a, b) => ORDEN[a.severidad] - ORDEN[b.severidad]
    || a.control.localeCompare(b.control, "es"));
  return {
    controles,
    revisar: controles.filter((c) => c.severidad === "revisar").length,
    advertencias: controles.filter((c) => c.severidad === "advertencia").length,
    correctos: controles.filter((c) => c.severidad === "correcto").length,
  };
}

export function AulasControles({ filas, plan = [] }: {
  filas: ReadonlyArray<Record<string, unknown>>;
  /**
   * El plan, para poner la FACULTAD junto a cada aula citada.
   *
   * Los controles nombran las aulas por código —«CH 31: 25 asistentes…»— y el
   * operativo se dirige por facultad: sin ella hay que ir a otra pestaña a
   * averiguar si esa incidencia es de Derecho o de Arquitectura. Se une por el
   * código, que es la clave que las dos listas comparten.
   */
  plan?: ReadonlyArray<Record<string, unknown>>;
}) {
  const { controles, revisar, advertencias, correctos } = useMemo(
    () => controlesDeAulas(filas),
    [filas],
  );
  const facultadPorCodigo = useMemo(() => {
    const mapa = new Map<string, string>();
    for (const fila of plan) {
      const codigo = String(fila.operational_code ?? "").trim();
      const facultad = String(fila.faculty ?? "").trim();
      if (codigo && facultad && !mapa.has(codigo)) mapa.set(codigo, facultad);
    }
    return mapa;
  }, [plan]);

  if (!controles.length) {
    return <p className="mon-profile-muted">No hay controles de validación para este corte.</p>;
  }

  return (
    // C1: los avisos son el contenido de datos de este panel y su dueño de
    // capacidad. Sin declararlo el gate culpaba a la cabecera de 5 px que no
    // son suyos.
    <div className="aulas-controles" data-qa-geometry-capacity="owned" data-qa-geometry-member>
      <p className="aulas-controles-lectura">
        <strong>{revisar}</strong> piden revisión · <strong>{advertencias}</strong>{" "}
        {advertencias === 1 ? "advertencia" : "advertencias"} ·{" "}
        <strong>{correctos}</strong> {correctos === 1 ? "correcto" : "correctos"}
      </p>
      <ul className="aulas-controles-lista">
        {controles.map((control) => {
          const Icono = ICONO[control.severidad];
          return (
            <li key={control.control} className={`aulas-control es-${control.severidad}`}>
              <Icono size={15} aria-hidden="true" />
              <div>
                <p className="aulas-control-titulo">
                  {control.control}
                  <span>{control.estado}</span>
                </p>
                {/* Sin recorte: el detalle es la mitad que dice qué hacer, y un
                    dato operativo cortado es un rechazo del contrato (C4). Lo
                    que cambia es la FORMA: cuando el motor enumera casos, cada
                    uno ocupa su renglón con el aula por delante, que es como se
                    lee una lista de incidencias en el resto del perfil. */}
                {control.tramos.length > 1 ? (
                  <ul className="aulas-control-casos">
                    {control.tramos.map((tramo, i) => (
                      <li key={`${tramo.codigo}-${i}`} className={tramo.codigo ? "" : "es-nota"}>
                        {tramo.codigo ? (
                          <span className="aulas-control-caso">
                            {tramo.codigo}
                            {/* La facultad, cuando se sabe. Va DENTRO del chip
                                del aula porque es de esa aula, no del texto de
                                al lado, y se calla cuando el plan no la trae:
                                inventar «Sin facultad» aquí sería ruido. */}
                            {facultadPorCodigo.get(tramo.codigo)
                              ? <em>{facultadPorCodigo.get(tramo.codigo)}</em>
                              : null}
                          </span>
                        ) : null}
                        <span>{tramo.texto}</span>
                      </li>
                    ))}
                  </ul>
                ) : control.detalle ? (
                  <p className="aulas-control-detalle">{control.detalle}</p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
