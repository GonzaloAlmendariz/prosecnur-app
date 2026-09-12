import { useMemo, useState } from "react";

import { COLOR_RESULTADO } from "../../coloresDeResultado";
import { ClipboardCheck, Gauge, Target, Users } from "../../../../vendor/lucide-react";
import {
  buscarCursosHorario, claveDeBusqueda, cuandoEnPalabras, fichaDeCursoHorario,
  type EstadoDeCursoHorario, type FichaDeCursoHorario,
} from "./fichaDeCursoHorario";
import { ChipDato, ChipLugar } from "./AulasSistemaPabellon";
import { porDondeEmpezarLaFicha } from "./porDondeEmpezarLaFicha";
import { fmt, pctPerfil } from "./kpisDeAulas";
import "./fichaDeCursoHorario.css";

/**
 * Buscar UN curso-horario por su código y ver su ficha entera.
 *
 * Gonzalo, el 2026-09-09: «una pestaña que nos permita consultar por CH o R, es
 * decir por códigos, el estado de un curso-horario: si está aplicado, si no, la
 * efectividad que obtuvo, la planificada, los elegibles esperados, los elegibles
 * obtenidos, etc». Las otras cuatro pestañas de Consultas contestan preguntas de
 * conjunto —la cadena, las brechas, el parte, los extras—; ésta contesta por una
 * fila concreta, que es lo que se pregunta cuando alguien llama por teléfono con
 * un código en la mano.
 *
 * Sobre el PLAN entero (`agenda`, 1 392 filas) y sin el filtro de facultad en
 * foco: quien busca un código quiere encontrarlo, y no hallarlo por un filtro
 * puesto en otra pestaña se lee como «no existe».
 */

const TONO: Record<EstadoDeCursoHorario, string> = {
  aplicado: COLOR_RESULTADO.efectiva,
  agendado: COLOR_RESULTADO.parcial,
  sin_agendar: COLOR_RESULTADO.pendiente,
  retirado: COLOR_RESULTADO.rechazo,
};

const NOMBRE: Record<EstadoDeCursoHorario, string> = {
  aplicado: "Aplicado",
  agendado: "Agendado",
  sin_agendar: "Sin agendar",
  retirado: "Retirado del plan",
};

/** La ausencia se DICE. Un hueco en una ficha se lee como un cero. */
function Valor({ children }: { children: React.ReactNode }) {
  const vacio = children == null || children === "" || children === false;
  return vacio
    ? <span className="aulas-ficha-valor aulas-ficha-vacio">sin dato</span>
    : <span className="aulas-ficha-valor">{children}</span>;
}

function Par({ clave, children, cifra }: {
  clave: string; children: React.ReactNode; cifra?: boolean;
}) {
  return (
    <div className={`aulas-ficha-par${cifra ? " es-cifra" : ""}`}>
      <span className="aulas-ficha-clave">{clave}</span>
      <Valor>{children}</Valor>
    </div>
  );
}

/**
 * La comparación que este panel existe para hacer: lo obtenido contra lo que el
 * diseño pedía. Dos porcentajes uno al lado del otro obligan a restar de cabeza;
 * una barra con la marca de lo previsto se lee de un vistazo, y es la misma
 * gramática que «Cumplimiento» usa en Metas.
 */
function Contraste({ obtenida, prevista }: { obtenida: number | null; prevista: number | null }) {
  if (obtenida == null) return null;
  const tope = Math.max(obtenida, prevista ?? 0, 0.01);
  const alcanza = prevista == null || obtenida >= prevista;
  return (
    <div className="aulas-ficha-contraste">
      <span className="aulas-ficha-pista-barra">
        <i
          style={{
            width: `${Math.min(100, (100 * obtenida) / tope)}%`,
            background: alcanza ? COLOR_RESULTADO.efectiva : COLOR_RESULTADO.parcial,
          }}
        />
        {prevista != null ? (
          // La marca de tinta: dónde estaba la meta de este curso-horario.
          <em style={{ left: `${Math.min(100, (100 * prevista) / tope)}%` }} />
        ) : null}
      </span>
      <span className="aulas-ficha-contraste-lectura">
        {prevista == null
          ? <>el diseño no le puso tasa</>
          : alcanza
            ? <>llega a lo que el diseño le pedía</>
            : <>le faltan {pctPerfil((prevista - obtenida) * 100)} para lo que el diseño le pedía</>}
      </span>
    </div>
  );
}

function Grupo({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="aulas-ficha-grupo">
      <p className="aulas-ficha-grupo-titulo">{titulo}</p>
      <div className="aulas-ficha-pares">{children}</div>
    </div>
  );
}

function pct(v: number | null): string | null {
  // Las tasas viajan en tanto por uno; `pctPerfil` espera puntos.
  return v == null ? null : pctPerfil(v * 100);
}

/**
 * La banda de cifras, con las MISMAS clases que la banda de Avance
 * (`aulas-kpi-band` / `aulas-kpi` / `aulas-kpi-rotulo` + `<strong>` + `<small>`).
 *
 * Gonzalo: «el formato sigue demasiado tosco, nada parecido a las demás
 * pestañas». Lo estaba porque me inventé una lista de pares en vez de usar el
 * vocabulario que el perfil ya tiene. Las cuatro cifras que se vienen a ver son
 * éstas; el resto es detalle y va debajo.
 */
function Banda({ f }: { f: FichaDeCursoHorario }) {
  const tarjetas = [
    { label: "Elegibles del plan", icono: Users, value: f.elegibles == null ? "—" : fmt(f.elegibles),
      pista: "el aforo con el que se dimensionó" },
    { label: "Esperadas por el diseño", icono: Target,
      value: f.efectivasEsperadas == null ? "—" : fmt(Math.round(f.efectivasEsperadas)),
      pista: "lo que este curso-horario debe traer" },
    { label: "Efectivas de plataforma", icono: ClipboardCheck,
      value: f.efectivasObtenidas == null ? "—" : fmt(f.efectivasObtenidas),
      pista: "llegaron y pasaron los filtros" },
    { label: "Efectividad obtenida", icono: Gauge,
      value: pct(f.efectividadObtenida) ?? "—",
      // La ausencia dice POR QUÉ: un «—» mudo se lee como un fallo.
      pista: f.efectividadObtenida == null ? "todavía no se aplica" : "efectivas sobre elegibles" },
  ];
  return (
    <div className="aulas-kpi-band" role="group" aria-label="Cifras del curso-horario"
      data-qa-geometry-group="monitoring-aulas-kpis" data-qa-geometry-contract="equal">
      {tarjetas.map((t) => {
        const Icono = t.icono;
        return (
          <div key={t.label} className="aulas-kpi aulas-kpi--neutral" title={t.pista}>
            <span className="aulas-kpi-rotulo"><Icono size={13} aria-hidden="true" />{t.label}</span>
            <strong>{t.value}</strong>
            <small>{t.pista}</small>
          </div>
        );
      })}
    </div>
  );
}

function Ficha({ f }: { f: FichaDeCursoHorario }) {
  const esReserva = f.rol !== "Titular";
  return (
    <>
      <div className="aulas-ficha-titulo">
        <span className="aulas-ficha-codigo">{f.codigo}</span>
        <span className="aulas-ficha-estado" style={{ ["--aulas-ficha-tono" as string]: TONO[f.estado] }}>
          {NOMBRE[f.estado]}
        </span>
        {/* El literal del plan al lado del estado derivado: si dicen cosas
            distintas —y lo hacen, `operational_status` no se actualiza— quien
            lee tiene que poder verlo, no descubrirlo por su cuenta. */}
        <span className="aulas-ficha-sub">{f.rol} · el plan lo declara «{f.estadoOperativo}»</span>
      </div>

      {/* **El estado y su fecha, en UNA frase.** Antes el chip decía AGENDADO y
          tres centímetros más allá, sin rótulo, había un «2026-09-08» crudo:
          Gonzalo, «si está agendada ¿para cuándo? no se explica eso». Un ISO sin
          su día de la semana tampoco dice si eso ya pasó. */}
      <p className="aulas-ficha-cuando">{cuandoEnPalabras(f.estado, f.fecha, f.hora)}</p>

      {/* La fila de chips del Sistema Pabellón: el salón con su color
          determinista por la letra (`tonoDePabellon`), que es lo que deja
          reconocer un pabellón de un vistazo, y la facultad como badge neutro.
          La fecha y la hora salieron de aquí: ya las dice la frase de arriba, y
          repetirlas era el ruido que las dejaba sin explicar. */}
      <div className="aulas-chips-fila aulas-ficha-chips">
        {f.local ? <ChipLugar lugar={f.local} /> : null}
        {f.facultad ? <ChipDato>{f.facultad}</ChipDato> : null}
      </div>

      <Banda f={f} />

      <Grupo titulo="Qué curso-horario es">
        <Par clave="Curso">{f.curso}</Par>
        <Par clave="Sección">{f.seccion}</Par>
        <Par clave="Docente">{f.docente}</Par>
        <Par clave="Tipo de docente">{f.docenteTipo}</Par>
        <Par clave="Aplicador">{f.responsable}</Par>
      </Grupo>

      {/* **Con qué llamar, sin salir de la ficha.** Estaba en el plan y había que
          ir a buscarlo a otra pestaña para marcar un teléfono. */}
      <Grupo titulo="Cómo se le contactó">
        <Par clave="Medio">{f.contactoMedio}</Par>
        <Par clave="Cuándo">{f.contactoFecha}</Par>
        <Par cifra clave="Intentos">{f.contactoIntentos == null ? null : fmt(f.contactoIntentos)}</Par>
        <Par clave="Resultado de la llamada">{f.estadoLlamada}</Par>
        <Par clave="Recibió el correo">{f.correoRecibido}</Par>
        <Par clave="Teléfono">{f.docenteTelefono}</Par>
        <Par clave="Correo">{f.docenteCorreo}</Par>
      </Grupo>

      {f.origenDeActivacion ? (
        <Grupo titulo="Por qué está en juego">
          <Par clave="Entró como">{f.origenDeActivacion}</Par>
          <Par clave="Ayuda a">{f.activadoPara}</Par>
        </Grupo>
      ) : null}

      {esReserva ? (
        <Grupo titulo="Su lugar en la cadena">
          <Par clave="Reemplaza a">{f.reemplazaA}</Par>
          <Par clave="Orden en la cadena">{f.ordenEnLaCadena == null ? null : fmt(f.ordenEnLaCadena)}</Par>
        </Grupo>
      ) : null}

      <Grupo titulo="El detalle del campo">
        <Par clave="Aplicado el">{f.aplicadoEn}</Par>
        <Par clave="Aplicado por">{f.aplicadoPor}</Par>
        {/* El aforo entero, que es lo que sitúa a los elegibles. */}
        <Par cifra clave="Matriculados">{f.matriculados == null ? null : fmt(f.matriculados)}</Par>
        <Par cifra clave="Observados en el aula">{f.observados == null ? null : fmt(f.observados)}</Par>
        <Par cifra clave="Rechazos">{f.rechazos == null ? null : fmt(f.rechazos)}</Par>
        <Par cifra clave="Duplicados">{f.duplicados == null ? null : fmt(f.duplicados)}</Par>
        {/* Los que de verdad estaban: sólo lo sabe el parte de campo. */}
        <Par cifra clave="Asistentes (parte)">{f.asistentes == null ? null : fmt(f.asistentes)}</Par>
        {/* **Las dos fuentes, por separado.** No se reconcilian: la plataforma
            cuenta lo que llegó y pasó los filtros, el parte lo que anotó quien
            aplicó, y sobre HSVG2026 discrepan en catorce cursos-horario. */}
        <Par cifra clave="Efectivas del parte">{f.efectivasDelParte == null ? null : fmt(f.efectivasDelParte)}</Par>
        <Par cifra clave="Le faltan">{f.brecha == null ? null : fmt(f.brecha)}</Par>
      </Grupo>

      <Grupo titulo="Contra lo que el diseño pedía">
        {/* La prevista se LEE del plan; la obtenida se CALCULA sobre los
            elegibles. `tasa_efectividad_aula` es la prevista pese al nombre. */}
        <Par cifra clave="Prevista del curso-horario">{pct(f.efectividadPrevista)}</Par>
        <Par cifra clave="Prevista de su facultad">{pct(f.efectividadDeSuFacultad)}</Par>
        <Par clave="Contra su margen">{f.senal}</Par>
      </Grupo>
      <Contraste obtenida={f.efectividadObtenida} prevista={f.efectividadPrevista} />

      {/* **Cuánto tardaron en responder.** No está en el plan: viene de la Base
          de control, que es una cuarta fuente. Sin ella, «sin dato» —no un cero
          que se leería como «respondieron al instante»—. */}
      {f.duracionMedia != null || f.duracionMin != null || f.duracionMax != null ? (
        <Grupo titulo="Cuánto duró responder">
          <Par cifra clave="Mediana (min)">{f.duracionMedia == null ? null : f.duracionMedia}</Par>
          <Par cifra clave="La más corta">{f.duracionMin == null ? null : f.duracionMin}</Par>
          <Par cifra clave="La más larga">{f.duracionMax == null ? null : f.duracionMax}</Par>
        </Grupo>
      ) : null}

      {/* Lo único que no está en ninguna cifra: lo que el aplicador escribió. */}
      {f.notaDeCampo ? (
        <div className="aulas-ficha-nota">
          <span>Lo que dijo el campo</span>
          <p>{f.notaDeCampo}</p>
        </div>
      ) : null}
    </>
  );
}

export function AulasFichaDeCursoHorario({
  agenda, partes, bandas, control = [],
}: {
  /** El plan entero. */
  agenda: ReadonlyArray<Record<string, unknown>>;
  partes: ReadonlyArray<Record<string, unknown>>;
  /** `dos_tasas.aulas`: sólo los que el motor pudo contrastar. */
  bandas: ReadonlyArray<Record<string, unknown>>;
  /** La Base de control: la CUARTA fuente, de donde sale la duración. */
  control?: ReadonlyArray<Record<string, unknown>>;
}) {
  const [consulta, setConsulta] = useState("");
  const [elegido, setElegido] = useState("");

  const porCodigo = useMemo(() => {
    const p = new Map<string, Record<string, unknown>>();
    for (const f of partes) p.set(claveDeBusqueda(f.operational_code), f);
    return p;
  }, [partes]);
  const porBanda = useMemo(() => {
    const b = new Map<string, Record<string, unknown>>();
    for (const f of bandas) b.set(claveDeBusqueda(f.codigo ?? f.operational_code), f);
    return b;
  }, [bandas]);
  // La Base de control nombra el curso-horario con su propia columna; se cruza
  // por la MISMA clave normalizada que el resto, no por igualdad de texto.
  const porControl = useMemo(() => {
    const c = new Map<string, Record<string, unknown>>();
    for (const f of control) {
      const clave = claveDeBusqueda(f.curso_horario ?? f.operational_code ?? f.codigo);
      if (clave) c.set(clave, f);
    }
    return c;
  }, [control]);

  const encontrados = useMemo(() => buscarCursosHorario(agenda, consulta), [agenda, consulta]);
  const fila = useMemo(() => {
    if (!encontrados.length) return null;
    const porElegido = encontrados.find((f) => claveDeBusqueda(f.operational_code) === elegido);
    return porElegido ?? encontrados[0];
  }, [encontrados, elegido]);

  const atajos = useMemo(
    () => porDondeEmpezarLaFicha(agenda as never, partes),
    [agenda, partes],
  );

  const ficha = useMemo(() => {
    if (!fila) return null;
    const clave = claveDeBusqueda(fila.operational_code);
    return fichaDeCursoHorario(fila, porCodigo.get(clave), porBanda.get(clave), porControl.get(clave));
  }, [fila, porCodigo, porBanda, porControl]);

  return (
    <div data-qa-geometry-capacity="owned" data-qa-geometry-member>
      <div className="aulas-ficha-buscador">
        <input
          type="search"
          value={consulta}
          onChange={(e) => { setConsulta(e.target.value); setElegido(""); }}
          placeholder="CH 43, R 1.1, 43…"
          aria-label="Buscar un curso-horario por su código"
        />
        <span className="aulas-ficha-pista">
          {fmt(agenda.length)} cursos-horario del plan · da igual el espacio y las mayúsculas
        </span>
      </div>

      {/* **Un buscador vacío no es un vacío legítimo.** Había mucho que ofrecer
          —lo que no cuadra, los refuerzos en cola— y la pestaña lo escondía tras
          saberse un código de memoria. Listas COMPLETAS: sin «…y N más». */}
      {!consulta.trim() && atajos.length ? (
        <div className="aulas-ficha-atajos" data-qa-geometry-capacity="owned" data-qa-geometry-member>
          {atajos.map((a) => (
            <section key={a.clave}>
              <p className="aulas-ficha-atajo-titulo">
                <strong>{a.titulo}</strong>
                <em>{fmt(a.codigos.length)} · {a.motivo}</em>
              </p>
              <div className="aulas-ficha-atajo-codigos">
                {a.codigos.map((c) => (
                  <button key={c} type="button" onClick={() => { setConsulta(c); setElegido(""); }}>
                    {c}
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : null}

      {consulta.trim() && !encontrados.length ? (
        <p className="mon-profile-muted" data-qa-geometry-capacity="owned" data-qa-geometry-member>
          Ningún curso-horario del plan tiene un código que se parezca a «{consulta.trim()}».
        </p>
      ) : null}

      {encontrados.length > 1 ? (
        // Se elige, no se adivina: «R 1» son varias reservas de la misma cadena
        // y quedarse con la primera escondería el resto.
        <ul className="aulas-ficha-opciones">
          {encontrados.map((f) => {
            const clave = claveDeBusqueda(f.operational_code);
            return (
              <li key={clave}>
                <button
                  type="button"
                  className="aulas-ficha-opcion"
                  aria-pressed={ficha?.codigo === String(f.operational_code)}
                  onClick={() => setElegido(clave)}
                >
                  {String(f.operational_code)}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}

      {ficha ? <Ficha f={ficha} /> : null}

      {!consulta.trim() ? (
        <p className="mon-profile-muted" data-qa-geometry-capacity="owned" data-qa-geometry-member>
          Teclea un código para ver su ficha: en qué punto está, qué encuestas trae y qué
          efectividad consiguió contra la que el diseño le pedía.
        </p>
      ) : null}
    </div>
  );
}
