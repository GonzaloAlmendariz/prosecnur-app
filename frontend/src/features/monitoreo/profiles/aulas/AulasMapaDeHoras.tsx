import { Fragment } from "react";

import { hoyISO } from "./calendarioDeAgenda";
import type { MonitoreoAulasFranjas } from "../../../../api/monitoreo";
import { mapaDeHoras, type MapaDia } from "./mapaDeHoras";
import { fmt } from "./kpisDeAulas";
import "./aulasMapaDeHoras.css";

/**
 * El «Mapa de horas»: por día agendado, un eje horario con la ventana de cada
 * cita y el PICO de carga simultánea como lectura protagonista.
 *
 * El pico es el porqué de la superficie (C5): «N citas a la vez ·
 * 19:00–19:05» es el número de aplicadores que el operativo necesita, contado
 * por el motor sobre el RANGO real de cada cita — por hora de inicio el mismo
 * plan decía 8 donde el rango daba 19. Se dice «citas» y no «aulas» por el
 * ratchet de vocabulario del perfil (la unidad es el curso-horario, ADR 0060).
 *
 * Barras en CSS a propósito, como la agenda por día: la sección no debe
 * arrastrar el bundle de Plotly por una lectura de diez filas. La geometría
 * la produce `mapaDeHoras` (helper puro con su suite); aquí sólo se pinta.
 *
 * Devuelve cabecera + cuerpo como fragmento: el panel `mon-profile-panel` que
 * lo envuelve (AulasSeccionModelo) es un grid de dos filas y cada pieza cae
 * en la suya.
 */
export function AulasMapaDeHoras({ franjas, hoy = hoyISO() }: {
  franjas?: MonitoreoAulasFranjas | null;
  /** El día del operativo (`YYYY-MM-DD`); inyectable para el test. */
  hoy?: string;
}) {
  const mapa = mapaDeHoras(franjas);

  const cabecera = (
    <div className="mon-profile-panel-head">
      <h3>Mapa de horas</h3>
      {mapa.disponible && mapa.picoMaximo ? (
        // La lectura que dimensiona el operativo entero: el día más cargado.
        // «Citas», no «aulas»: la unidad del perfil es el curso-horario (ADR
        // 0060, ratchet de vocabulario) y lo que coincide en el pico son citas
        // confirmadas — cada una pide su aplicador.
        <span>
          hasta {fmt(mapa.picoMaximo.aulas)} {mapa.picoMaximo.aulas === 1 ? "cita" : "citas"} a
          la vez · {mapa.picoMaximo.etiqueta}
        </span>
      ) : null}
    </div>
  );

  if (!mapa.disponible) {
    // Backend anterior al bloque: la ausencia se declara dentro del marco
    // (C3), con el mismo criterio que `dos_tasas`.
    return (
      <>
        {cabecera}
        {/* Miembro y dueño EXPLÍCITOS también en el vacío: sin ellos el
            auditor cae a los hijos del panel y mide la cabecera, que es el
            capacity-drift espurio que su propio comentario documenta. */}
        <p className="mon-profile-muted" data-qa-geometry-member data-qa-geometry-capacity="owned">
          El tablero cargado no trae el mapa de horas. Recarga el monitoreo
          para regenerarlo con el motor actual.
        </p>
      </>
    );
  }

  if (!mapa.dias.length) {
    return (
      <>
        {cabecera}
        <p className="mon-profile-muted" data-qa-geometry-member data-qa-geometry-capacity="owned">
          Ninguna cita tiene fecha agendada todavía. El mapa se dibuja cuando
          el libro fija días y horas.
        </p>
      </>
    );
  }

  return (
    <>
      {cabecera}
      <div className="aulas-mapa-horas" data-qa-geometry-capacity="owned" data-qa-geometry-member>
        {/* La familia del día que toca (B43/46/49/57): quinta superficie que
            lista días — el despliegue inminente lleva su sello y lo pasado
            se atenúa, la misma lectura en todo el perfil. */}
        {(() => {
          const proximo = mapa.dias.find((x) => x.fecha >= hoy)?.fecha ?? null;
          return mapa.dias.map((d) => (
            <DiaDelMapa
              key={d.fecha}
              dia={d}
              esElQueToca={d.fecha === proximo}
              esPasado={d.fecha < hoy}
            />
          ));
        })()}
        {mapa.personasFuente === "confirmadas" ? (
          <p className="aulas-mapa-nota">
            El pico cuenta solo citas confirmadas; la franja punteada es el
            rango del curso de una cita aún por pactar.
          </p>
        ) : null}
      </div>
    </>
  );
}

function DiaDelMapa({ dia, esElQueToca = false, esPasado = false }: {
  dia: MapaDia;
  esElQueToca?: boolean;
  esPasado?: boolean;
}) {
  return (
    <article className={`aulas-mapa-dia${esElQueToca ? " es-el-que-toca" : ""}${esPasado ? " es-pasado" : ""}`}>
      <header className="aulas-mapa-dia-cab">
        <h4>
          {dia.etiqueta}
          {esElQueToca ? <span className="aulas-carga-toca">toca</span> : null}
        </h4>
        {/* El pico del día, como texto y no como tooltip: es el dato que fija
            cuántos aplicadores hacen falta ese día. */}
        <p className="aulas-mapa-pico-lectura">
          {dia.picoAulas > 0 ? (
            <>
              <strong>
                {fmt(dia.picoAulas)} {dia.picoAulas === 1 ? "cita" : "citas"} a la vez
              </strong>
              {dia.pico ? <> · {dia.pico.inicio}–{dia.pico.fin}</> : null}
            </>
          ) : (
            <em>sin citas confirmadas</em>
          )}
        </p>
      </header>
      {dia.ventanas.length ? (
        <div className="aulas-mapa-lienzo">
          <span className="aulas-mapa-esquina" aria-hidden="true" />
          <div className="aulas-mapa-marcas" aria-hidden="true">
            {dia.marcas.map((m) => (
              <span key={m.minuto} style={{ left: `${m.posPct}%` }}>{m.etiqueta}</span>
            ))}
          </div>
          {dia.ventanas.map((v) => (
            <Fragment key={`${v.codigo}-${v.inicio}`}>
              {/* El código queda decorativo: el carril ya lo pronuncia junto
                  con su ventana, y leerlo dos veces es ruido. */}
              <span className="aulas-mapa-codigo" aria-hidden="true">{v.codigo}</span>
              <div
                className="aulas-mapa-carril"
                role="img"
                aria-label={`${v.codigo}: de ${v.inicio} a ${v.fin}${v.confirmada ? "" : ", por confirmar"}`}
              >
                {/* La banda del pico se repite por carril con la misma
                    geometría: alineada fila a fila se lee como una sola
                    columna, sin pelear con el auto-placement del grid. */}
                {dia.pico ? (
                  <i
                    className="aulas-mapa-banda"
                    style={{ left: `${dia.pico.desdePct}%`, width: `${dia.pico.anchoPct}%` }}
                    aria-hidden="true"
                  />
                ) : null}
                <i
                  className={`aulas-mapa-barra${v.confirmada ? "" : " es-tentativa"}`}
                  style={{ left: `${v.desdePct}%`, width: `${v.anchoPct}%` }}
                  title={`${v.codigo} · ${v.inicio}–${v.fin}${v.confirmada ? "" : " · franja del curso, por confirmar"}`}
                />
              </div>
            </Fragment>
          ))}
        </div>
      ) : null}
      {dia.porConfirmar.length ? (
        // C3: el pendiente del día vive en el marco del día, no en un tooltip.
        // COMPLETO, sin techo (dictado 2026-09-02: «no pones las cosas
        // completas y actúas como si no tuvieras espacio cuando la pestaña
        // puede darle más espacio sin problema»). El techo de 12 fue una
        // decisión revocada: la lista larga crece hacia abajo y la sección
        // scrollea — se organiza, jamás se esconde.
        <p className="aulas-mapa-pendientes">
          <strong>Por confirmar · {fmt(dia.porConfirmar.length)}:</strong>{" "}
          {dia.porConfirmar.join(", ")}
        </p>
      ) : null}
      {dia.ilegibles ? (
        <p className="aulas-mapa-pendientes es-aviso">
          {fmt(dia.ilegibles)} {dia.ilegibles === 1 ? "cita llegó" : "citas llegaron"} con hora
          ilegible en el libro y no se {dia.ilegibles === 1 ? "puede" : "pueden"} dibujar.
        </p>
      ) : null}
    </article>
  );
}
