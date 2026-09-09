import { useMemo, useState } from "react";

import { COLOR_RESULTADO } from "../../coloresDeResultado";
import {
  buscarCursosHorario, claveDeBusqueda, fichaDeCursoHorario,
  type EstadoDeCursoHorario, type FichaDeCursoHorario,
} from "./fichaDeCursoHorario";
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

function Par({ clave, children }: { clave: string; children: React.ReactNode }) {
  return (
    <div className="aulas-ficha-par">
      <span className="aulas-ficha-clave">{clave}</span>
      <Valor>{children}</Valor>
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

      <Grupo titulo="Qué curso-horario es">
        <Par clave="Facultad">{f.facultad}</Par>
        <Par clave="Curso">{f.curso}</Par>
        <Par clave="Sección">{f.seccion}</Par>
        <Par clave="Docente">{f.docente}</Par>
      </Grupo>

      {esReserva ? (
        <Grupo titulo="Su lugar en la cadena">
          <Par clave="Reemplaza a">{f.reemplazaA}</Par>
          <Par clave="Orden en la cadena">{f.ordenEnLaCadena == null ? null : fmt(f.ordenEnLaCadena)}</Par>
        </Grupo>
      ) : null}

      <Grupo titulo="Cuándo y dónde">
        <Par clave="Fecha">{f.fecha}</Par>
        <Par clave="Hora">{f.hora}</Par>
        {/* «Salón» y no «aula», que es la palabra que este perfil ya usa para
            el espacio físico (`AulasCambioDeAula`: «se aplicaron en otro
            salón»). «Aula» está sobrecargada aquí —era la unidad de muestreo
            antes de llamarse curso-horario— y usarla para el sitio confunde
            justo lo que se separó. */}
        <Par clave="Salón">{f.local}</Par>
        <Par clave="Aplicador">{f.responsable}</Par>
      </Grupo>

      <Grupo titulo="Alumnos">
        <Par clave="Elegibles del plan">{f.elegibles == null ? null : fmt(f.elegibles)}</Par>
        {/* Los que de verdad estaban: sólo lo sabe el parte de campo. */}
        <Par clave="Asistentes (parte)">{f.asistentes == null ? null : fmt(f.asistentes)}</Par>
      </Grupo>

      <Grupo titulo="Encuestas">
        <Par clave="Esperadas por el diseño">{f.efectivasEsperadas == null ? null : fmt(Math.round(f.efectivasEsperadas))}</Par>
        {/* **Las dos fuentes, por separado y dichas.** No se reconcilian: la
            plataforma cuenta lo que llegó y pasó los filtros, el parte cuenta lo
            que anotó quien aplicó, y sobre HSVG2026 discrepan en catorce
            cursos-horario. Publicar una sola escondería la diferencia. */}
        <Par clave="Efectivas de plataforma">{f.efectivasObtenidas == null ? null : fmt(f.efectivasObtenidas)}</Par>
        <Par clave="Efectivas del parte">{f.efectivasDelParte == null ? null : fmt(f.efectivasDelParte)}</Par>
        <Par clave="Le faltan">{f.brecha == null ? null : fmt(f.brecha)}</Par>
      </Grupo>

      <Grupo titulo="Efectividad">
        {/* La prevista se LEE del plan; la obtenida se CALCULA sobre los
            elegibles. `tasa_efectividad_aula` es la prevista pese al nombre. */}
        <Par clave="Prevista del curso-horario">{pct(f.efectividadPrevista)}</Par>
        <Par clave="Obtenida">{pct(f.efectividadObtenida)}</Par>
        <Par clave="Prevista de su facultad">{pct(f.efectividadDeSuFacultad)}</Par>
        <Par clave="Contra su margen">{f.senal}</Par>
      </Grupo>
    </>
  );
}

export function AulasFichaDeCursoHorario({
  agenda, partes, bandas,
}: {
  /** El plan entero. */
  agenda: ReadonlyArray<Record<string, unknown>>;
  partes: ReadonlyArray<Record<string, unknown>>;
  /** `dos_tasas.aulas`: sólo los que el motor pudo contrastar. */
  bandas: ReadonlyArray<Record<string, unknown>>;
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

  const encontrados = useMemo(() => buscarCursosHorario(agenda, consulta), [agenda, consulta]);
  const fila = useMemo(() => {
    if (!encontrados.length) return null;
    const porElegido = encontrados.find((f) => claveDeBusqueda(f.operational_code) === elegido);
    return porElegido ?? encontrados[0];
  }, [encontrados, elegido]);

  const ficha = useMemo(() => {
    if (!fila) return null;
    const clave = claveDeBusqueda(fila.operational_code);
    return fichaDeCursoHorario(fila, porCodigo.get(clave), porBanda.get(clave));
  }, [fila, porCodigo, porBanda]);

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
