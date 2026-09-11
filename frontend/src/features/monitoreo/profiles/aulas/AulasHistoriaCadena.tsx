import { useMemo, useState, type ReactNode } from "react";

import type { MonitoreoAulasPlanRow } from "../../../../api/monitoreo";
import { facultadCorta } from "./facultadEnPalabras";
import { historiaDeCadena, type EslabonDeCadena, type HistoriaDeCadena } from "./historiaDeCadena";
import { fmt } from "./kpisDeAulas";
import "./aulasHistoriaCadena.css";

/**
 * **Cadena de reemplazos — una fila por cadena, con la tira a la derecha.**
 *
 * Ésta es la forma del ensayo de «Relevos de aula», y el motivo por el que
 * existe está en su propia nota: antes «CH 84» salía partido letra a letra en
 * doce columnas. Las cadenas de HSVG2026 tienen hasta once reservas y repartir
 * el ancho entre todas dejaba columnas de treinta píxeles.
 *
 * La rejilla es `218px | tira`:
 *
 * - **A la izquierda, quién cayó y por qué.** Código, dónde y cuándo, y la
 *   pastilla con lo que le pasó. Esa columna es fija, así que el código nunca
 *   se parte y las cadenas se comparan en vertical.
 * - **A la derecha, el recorrido.** La tira es horizontal y scrollea: **138 px
 *   de mínimo por eslabón**, tres a la vista y el resto contado. La cadena se
 *   recorre en orden —el primero vivo es el que se trabaja— y los de detrás
 *   importan como cuántos quedan, no como cuáles son.
 *
 * **El filo izquierdo dice el estado antes de leer nada**, y son cuatro
 * circunstancias distintas, no tres grados de una:
 *
 * - **abierta**: el titular cayó y hay reserva por delante. Es la que pide
 *   trabajo hoy.
 * - **seca**: el titular cayó y no queda nadie detrás. No hay a quién llamar;
 *   la salida es pedir aula adicional.
 * - **corta**: el titular se aplicó y rindió poco. Su cadena está intacta y lo
 *   que ofrece es COMPLEMENTAR. La misma superficie, otra circunstancia.
 * - **cerrada**: llegó a su meta, con el titular o con un reemplazo. Es
 *   registro, no trabajo, y va al final.
 *
 * No se agrupa en tres secciones con su título: agrupar obligaba a buscar la
 * cadena concreta en la sección que le tocara. Una sola lista ordenada por
 * urgencia, y el filo distingue.
 */

/** Cuántos eslabones se dibujan antes de contar el resto. */
const ESLABONES_A_LA_VISTA = 3;

/**
 * El estado de UN eslabón, en las palabras del operativo.
 *
 * Se dice el ESTADO y no el rol —«en reserva 3» lo dice ya su posición en la
 * tira— porque lo que decide si hay trabajo es si a esa reserva se la llamó.
 */
function puntoDelEslabon(eslabon: EslabonDeCadena): { texto: string; vivo: boolean; caido: boolean } {
  // El libro los manda con guion bajo —`sin_contactar`— y eso es transporte,
  // no vocabulario: en pantalla salía «Sin_contactar». Se normaliza el guion y
  // se respeta la palabra, que sí es suya.
  const s = String(eslabon.status ?? "").trim().toLowerCase().replace(/_/g, " ");
  if (eslabon.validas > 0) {
    return { texto: `${fmt(eslabon.validas)} de ${fmt(eslabon.meta)}`, vivo: true, caido: false };
  }
  if (s.startsWith("agendada") || s.startsWith("reagendada")) return { texto: "Agendado", vivo: true, caido: false };
  if (s.startsWith("en contacto")) return { texto: "En contacto", vivo: true, caido: false };
  if (s.startsWith("rechazo")) return { texto: "Rechazó", vivo: false, caido: true };
  if (s.startsWith("reemplazada")) return { texto: "Reemplazado", vivo: false, caido: true };
  if (s.startsWith("en reserva") || s.startsWith("sin contactar") || !s) {
    return { texto: eslabon.orden === 0 ? "Sin contactar" : "Sin contactar", vivo: false, caido: false };
  }
  return { texto: s.charAt(0).toUpperCase() + s.slice(1), vivo: false, caido: false };
}

type Circunstancia = "abierta" | "seca" | "corta" | "intacta" | "cerrada";

/** Qué le pasó a esta cadena, que es lo que decide su filo y su pastilla. */
function circunstanciaDe(h: HistoriaDeCadena): { clave: Circunstancia; pastilla: string } {
  if (h.desenlace === "titular") return { clave: "cerrada", pastilla: "Cerró con el titular" };
  if (h.desenlace === "reemplazo") return { clave: "cerrada", pastilla: `Cerró con ${h.cerro}` };

  const titular = h.eslabones.find((e) => e.orden === 0);
  const cayo = titular ? puntoDelEslabon(titular).caido : false;
  const hayQuienSiga = h.eslabones.some((e) => e.orden > 0 && !puntoDelEslabon(e).caido);

  if (cayo) {
    return hayQuienSiga
      ? { clave: "abierta", pastilla: "Rechazó el docente" }
      : { clave: "seca", pastilla: "Sin reserva por delante" };
  }
  // El titular no cayó: si ya rindió y se quedó corto, lo que ofrece es
  // complementar —su cadena sigue intacta—. Si aún no ha salido, sigue en pie.
  if (titular && titular.validas > 0) {
    return { clave: "corta", pastilla: "Rindió poco: complementar" };
  }
  // Su titular sigue agendado y aún no ha salido: no ha pasado nada, y por eso
  // no es una cadena en juego. Se cuenta, no se lista.
  return { clave: "intacta", pastilla: "El titular sigue en pie" };
}

/** El orden de la lista: primero lo que pide trabajo hoy. */
const URGENCIA: Record<Circunstancia, number> = { seca: 0, abierta: 1, corta: 2, cerrada: 3, intacta: 4 };

export function AulasHistoriaCadena({ filas }: { filas: ReadonlyArray<MonitoreoAulasPlanRow> }): ReactNode {
  // El hook va antes de cualquier salida temprana: uno bajo la guarda se llama
  // en unos renders y no en otros, y eso es el React #310 que ya tumbó esto.
  const [todas, setTodas] = useState(false);

  const {
    historias, sinReserva, cerraronEnTitular, cerraronEnReemplazo, abiertas,
    sinRespuestaAlguna,
  } = useMemo(() => historiaDeCadena(filas), [filas]);

  // El plan por código, para que cada cadena diga dónde y cuándo es su titular.
  const porCodigo = useMemo(() => {
    const m = new Map<string, MonitoreoAulasPlanRow>();
    for (const f of filas) {
      const c = String(f.operational_code ?? f.classroom_id ?? "").trim();
      if (c) m.set(c, f);
    }
    return m;
  }, [filas]);

  const ordenadas = useMemo(() => {
    const con = historias.map((h) => ({ h, c: circunstanciaDe(h) }));
    return con.sort((a, b) =>
      URGENCIA[a.c.clave] - URGENCIA[b.c.clave]
      || b.h.eslabones.length - a.h.eslabones.length
      || a.h.titular.localeCompare(b.h.titular));
  }, [historias]);

  if (!historias.length) {
    return (
      <p className="mon-profile-muted" data-qa-geometry-capacity="owned" data-qa-geometry-member="true">
        {sinReserva
          // No es lo mismo «no hay plan» que «el diseño no asignó reservas».
          // Decía «ninguno necesitó reemplazo», que suena a la mejor noticia
          // posible y es justo lo contrario: son los cursos-horario que, si
          // caen, no tienen con qué cubrirse.
          ? `Ninguno de los ${fmt(sinReserva)} cursos-horario titulares tiene reserva asignada.`
          : "El plan todavía no declara cadenas de reemplazo."}
      </p>
    );
  }

  // **Las cadenas que juntaron lo que pide el hueco sin que ninguna sola
  // llegara a la suya.** Las dos cosas son ciertas y la regla es deliberada:
  // una cadena cierra cuando UN curso-horario alcanza SU propia meta, porque el
  // resto del perfil calcula la brecha por curso-horario. Pero dos fuentes del
  // mismo hecho que no coinciden tienen que decirlo.
  const juntaronSinCerrar = historias.filter(
    (h) => h.desenlace === "abierta" && h.meta > 0 && h.validas >= h.meta,
  ).length;

  // El cero de la lectura susurra: «0 cerraron con el titular · 0 con un
  // reemplazo · 174 sin cerrar» ponía los tres al mismo peso, y los dos ceros
  // —que son la ausencia— competían con el 174.
  const Cuenta = ({ n }: { n: number }) => (
    n === 0 ? <strong className="es-cero">0</strong> : <strong>{fmt(n)}</strong>
  );

  // **Sólo lo que tiene algo que contar.** Una cadena intacta —su titular
  // sigue agendado y no ha salido— y una cerrada no piden nada; en el corte del
  // 2026-09-10 son 136 y 38 de 174, y listarlas enterraba las cuatro que sí.
  const piden = ordenadas.filter((x) => x.c.clave !== "cerrada" && x.c.clave !== "intacta");
  const intactas = ordenadas.filter((x) => x.c.clave === "intacta").length;
  const vistas = todas ? ordenadas : piden.slice(0, 25);
  const restantes = ordenadas.length - vistas.length;

  return (
    <div className="aulas-cadenas" data-qa-geometry-capacity="owned" data-qa-geometry-member="true">
      <p className="aulas-cadenas-lectura">
        <Cuenta n={cerraronEnTitular} /> cerraron con el titular ·{" "}
        <Cuenta n={cerraronEnReemplazo} /> con un reemplazo ·{" "}
        <Cuenta n={abiertas} /> sin cerrar
        {/* **La unidad, porque cambia a media frase.** Los tres números de antes
            son CADENAS y éste son CURSOS-HORARIO titulares. Sin nombrarlo,
            «24 cadenas · … · 146 sin reserva» se lee como 146 cadenas. */}
        {sinReserva
          ? ` · ${sinReserva} ${sinReserva === 1 ? "curso-horario titular" : "cursos-horario titulares"} sin reserva asignada`
          : ""}
        {sinRespuestaAlguna
          ? ` · ${fmt(sinRespuestaAlguna)} de las abiertas no han recibido ni una respuesta`
          : ""}
      </p>

      {/* Lo que se lista y lo que se cuenta, dicho antes de la lista: sin esto,
          «136 sin cerrar» arriba y cuatro tarjetas abajo se leen como un
          recorte silencioso. */}
      <p className="aulas-cadenas-alcance">
        Se {piden.length === 1 ? "lista la" : "listan las"} <strong>{fmt(piden.length)}</strong>{" "}
        {piden.length === 1 ? "que pide" : "que piden"} trabajo
        {intactas ? (
          <> · <strong>{fmt(intactas)}</strong>{" "}
            {intactas === 1 ? "sigue intacta, con su titular" : "siguen intactas, con su titular"} en pie</>
        ) : null}
        {cerraronEnTitular + cerraronEnReemplazo ? (
          <> · <strong>{fmt(cerraronEnTitular + cerraronEnReemplazo)}</strong>{" "}
            {cerraronEnTitular + cerraronEnReemplazo === 1 ? "ya cerró" : "ya cerraron"}</>
        ) : null}
      </p>

      {juntaronSinCerrar ? (
        <p className="aulas-cadenas-matiz">
          En <strong>{juntaronSinCerrar}</strong> de las abiertas la cadena ya juntó
          lo que pide el hueco, pero <strong>ningún curso-horario solo</strong> alcanzó su propia meta:
          por eso siguen contando como brecha en el resto del perfil.
        </p>
      ) : null}

      {piden.length === 0 && !todas ? (
        <p className="aulas-cadenas-vacio">
          Ninguna cadena pide trabajo hoy: nadie ha rechazado y ningún
          curso-horario aplicado se quedó corto.
          {intactas ? (
            <>{" "}{intactas === 1 ? "La" : "Las"} <strong>{fmt(intactas)}</strong>{" "}
              {intactas === 1 ? "que sigue intacta espera" : "que siguen intactas esperan"} a su titular.</>
          ) : null}
        </p>
      ) : null}

      <div
        className="aulas-cadenas-lista"
        data-qa-geometry-group="monitoring-aulas-cadenas"
        data-qa-geometry-contract="intrinsic"
      >
        {vistas.map(({ h, c }) => (
          <Cadena key={h.titular} h={h} c={c} titular={porCodigo.get(h.titular)} />
        ))}
      </div>

      {restantes > 0 || todas ? (
        <button type="button" className="aulas-cadenas-mas" onClick={() => setTodas((x) => !x)}>
          {todas
            ? "Ver sólo las que piden trabajo"
            : `Ver las ${fmt(ordenadas.length)} cadenas, cerradas incluidas`}
        </button>
      ) : null}
    </div>
  );
}

function Cadena({ h, c, titular }: {
  h: HistoriaDeCadena;
  c: { clave: Circunstancia; pastilla: string };
  titular: MonitoreoAulasPlanRow | undefined;
}): ReactNode {
  const [abierta, setAbierta] = useState(false);
  const detras = Math.max(0, h.eslabones.length - ESLABONES_A_LA_VISTA);
  const vistos = abierta ? h.eslabones : h.eslabones.slice(0, ESLABONES_A_LA_VISTA);
  // El primero que no se ha caído es el que se trabaja.
  const trabajando = h.eslabones.find((e) => e.orden > 0 && !puntoDelEslabon(e).caido)?.codigo ?? "";

  const cuando = String(titular?.sesiones_dia_hora ?? titular?.schedule ?? "").trim();
  const donde = String(titular?.venue ?? "").trim();
  const seña = [facultadCorta(h.facultad), cuando, donde].filter(Boolean).join(" · ");

  return (
    <article className={`aulas-cadena es-${c.clave}`}>
      <div className="aulas-cadena-quien">
        <span className="aulas-cadena-cod">{h.titular}</span>
        {seña ? <span className="aulas-cadena-meta">{seña}</span> : null}
        <span className={`aulas-cadena-pastilla es-${c.clave}`}>{c.pastilla}</span>
      </div>

      {/* La tira, horizontal y con scroll propio: 138 px de mínimo por eslabón.
          Comparar dos cadenas cuesta un arrastre; antes no se podía leer
          ninguna. */}
      <div className="aulas-cadena-tira">
        {vistos.map((e, i) => {
          const punto = puntoDelEslabon(e);
          const esCierre = h.cerro === e.codigo;
          return (
            <span key={e.codigo} className="aulas-cadena-paso">
              {i ? <i className="aulas-cadena-flecha" aria-hidden="true">›</i> : null}
              <span className={[
                "aulas-cadena-eslabon",
                e.orden === 0 ? "es-titular" : "",
                esCierre ? "es-cierre" : "",
                punto.caido ? "es-caido" : "",
                !esCierre && e.codigo === trabajando ? "es-activo" : "",
                !punto.vivo && !punto.caido && !esCierre && e.codigo !== trabajando ? "es-dormido" : "",
              ].filter(Boolean).join(" ")}>
                <b>{e.codigo}</b>
                <em>{punto.texto}</em>
              </span>
            </span>
          );
        })}
        {detras && !abierta ? (
          <button type="button" className="aulas-cadena-resto" onClick={() => setAbierta(true)}>
            + {fmt(detras)} {detras === 1 ? "reserva" : "reservas"}
            {c.clave === "cerrada" ? " intactas" : " por detrás"}
          </button>
        ) : null}
        {abierta && detras ? (
          <button type="button" className="aulas-cadena-resto" onClick={() => setAbierta(false)}>
            Plegar
          </button>
        ) : null}
      </div>
    </article>
  );
}
