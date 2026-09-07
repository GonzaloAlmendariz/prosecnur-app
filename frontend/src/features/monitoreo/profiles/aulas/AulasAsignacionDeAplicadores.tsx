import { useEffect, useState } from "react";

import { AlertTriangle, Check, CheckCircle2, Copy, Info, Pin, Shuffle } from "../../../../vendor/lucide-react";
import {
  avisoDistribucion, enlaceDeDistribucion,
  type DistribucionSheetsRecordada, type DistribucionVigente,
} from "./distribucionDeAplicadores";
import { ChipDato, ChipHora, ChipLugar, ChipPrep } from "./AulasSistemaPabellon";
import { AulasCroquisDeCampus } from "./AulasCroquisDeCampus";
import { hoyISO } from "./calendarioDeAgenda";
import { nombreDeAplicador } from "./nombreDeAplicador";
import { cadenasDelDia, tramoDeCadena } from "./cadenasDelDia";

/**
 * El comodín del operativo: lo aplica alguien de Pulso porque no hay
 * aplicador disponible (dictado 2026-09-04). Es el MISMO literal que el motor
 * reconoce (`MONITOREO_AULAS_INTERNO_PULSO`) para callarle la advertencia de
 * «fuera de su disponibilidad»: no es una persona con horario y decírselo
 * sería avisar de lo que ya se sabe.
 */
const INTERNO_PULSO = "INTERNO PULSO";
import AulasViajesSolitarios from "./AulasViajesSolitarios";
import {
  claveDeCita, salidasDeDescubiertos, salidasDeLibres, salidasDeViajesSolitarios,
  type VentanaDeCita,
} from "./salidasDelReparto";
import type { MallaDeOferta } from "./disponibilidadDeAplicadores";
import { Switch } from "../../../../components/Switch";
import { agendaDelAplicador, mapaDeFijaciones, textoDelDespliegue, veredictoDeEquidad, type RepartoVista } from "./repartoDeAplicadores";
import { fmt } from "./kpisDeAulas";

/**
 * El cuarto cuadro de Carga de campo: la pestaña de Asignación (dictado
 * 2026-09-02: «necesitaríamos una pestaña de asignación… para poder hacer una
 * asignación equitativa en base a lo que ya tenemos de momento, pero que sea
 * repetible por si llegan nuevas confirmaciones»).
 *
 * Es la hoja de trabajo del jefe de campo: cada fecha con sus citas repartidas
 * —qué cita, en qué ventana, con quién—, lo DESCUBIERTO destacado arriba de su
 * día (es el problema operativo, no un pie de página) y el rail de cargas por
 * aplicador al lado, con los de cero a la vista: estar libre es un dato del
 * reparto, no una ausencia.
 *
 * Hover o foco sobre un aplicador del rail resalta sus citas en los días —la
 * pregunta «¿qué le tocó a Ana?» se contesta sin leer la lista entera— y un
 * click lo deja fijado, el mismo gesto que las franjas de la malla.
 *
 * El reparto en sí es del MOTOR (greedy determinista, B29) y su vigencia es la
 * promesa del dictado: se recalcula con cada Recargar, sin memoria — una
 * confirmación nueva entra sola. Aquí no se reordena ni se recalcula nada.
 */

/**
 * Los códigos se listan COMPLETOS, sin techo (dictado 2026-09-02: «no pones
 * las cosas completas y actúas como si no tuvieras espacio cuando la pestaña
 * puede darle más espacio sin problema») y cada uno en su chip (veredicto del
 * mismo día: el sistema de chips es mandato transversal en Carga de campo).
 * La fila larga envuelve y crece hacia abajo; esconder quedó revocado.
 */
const chipsDeCodigos = (codigos: readonly string[]) =>
  codigos.map((c) => <ChipDato key={c}>{c}</ChipDato>);

/** La advertencia del motor, en palabras del operativo. */
const AVISO_LEGIBLE: Record<string, string> = {
  sin_disponibilidad: "fuera de su disponibilidad declarada",
  se_solapa: "se solapa con otra cita suya",
};

/**
 * B75 (dictado 2026-09-03): «quiero distribuir equitativamente entre de este
 * día a este día» — desplegar la semana 1 ahora y planear la 2 el jueves. El
 * rango vive en el config (sobrevive Recargar); declararlo re-particiona el
 * reparto y lo de fuera queda DECLARADO, no descartado.
 */
function RangoDeDespliegue({ rango, onDeclarar }: {
  rango: { desde: string; hasta: string } | null;
  onDeclarar: (rango: { desde: string; hasta: string } | null) => void | Promise<void>;
}) {
  const [desde, setDesde] = useState(rango?.desde ?? "");
  const [hasta, setHasta] = useState(rango?.hasta ?? "");
  // Feedback del dictado 2026-09-03 («no me permite ni aplicar ni resortear…
  // es poco intuitivo»): aplicar SÍ trabajaba, pero el refetch tarda segundos
  // sin ninguna señal y el botón gris de después se leía como roto. El botón
  // ahora narra su estado: Aplicando… mientras trabaja, Aplicado ✓ cuando el
  // rango tecleado es el que ya rige.
  const [ocupado, setOcupado] = useState<"" | "aplicando" | "limpiando">("");
  // Un Recargar puede traer el rango declarado desde otro lado: se adopta.
  useEffect(() => {
    setDesde(rango?.desde ?? "");
    setHasta(rango?.hasta ?? "");
  }, [rango?.desde, rango?.hasta]);
  const listo = desde !== "" && hasta !== "";
  const sinCambio = listo && rango !== null && desde === rango.desde && hasta === rango.hasta;
  const declarar = async (r: { desde: string; hasta: string } | null) => {
    setOcupado(r ? "aplicando" : "limpiando");
    try {
      await onDeclarar(r);
    } finally {
      setOcupado("");
    }
  };
  return (
    <div className="aulas-asigna-rango">
      <span className="aulas-asigna-rango-rotulo">Repartir solo del</span>
      <input
        type="date"
        value={desde}
        onChange={(e) => setDesde(e.target.value)}
        aria-label="Primer día del rango de despliegue"
      />
      <span className="aulas-asigna-rango-rotulo">al</span>
      <input
        type="date"
        value={hasta}
        onChange={(e) => setHasta(e.target.value)}
        aria-label="Último día del rango de despliegue"
      />
      <button
        type="button"
        className="aulas-asigna-rango-boton"
        disabled={!listo || sinCambio || ocupado !== ""}
        title={sinCambio
          ? "Este rango ya rige el reparto; cambia una fecha para mover el corte"
          : undefined}
        onClick={() => { if (listo) void declarar({ desde, hasta }); }}
      >
        {ocupado === "aplicando" ? "Aplicando…" : sinCambio ? "Aplicado ✓" : "Aplicar"}
      </button>
      {rango ? (
        <button
          type="button"
          className="aulas-asigna-rango-boton es-limpiar"
          disabled={ocupado !== ""}
          title="Quitar el rango y repartir todas las fechas pactadas"
          onClick={() => { void declarar(null); }}
        >
          {ocupado === "limpiando" ? "Volviendo…" : "Volver a todo el horizonte"}
        </button>
      ) : (
        /* Dictado 2026-09-04: «la asignación nunca va a ser total, siempre voy
           a tener que establecer una fecha de asignación… y la app también
           sepa que eso debe ser así». Sin fechas el motor reparte TODO el
           horizonte —que no es la forma de trabajar—, y dos casillas en
           blanco no lo dicen: el estado se declara, no se infiere. */
        <em className="aulas-asigna-rango-sin">sin fechas: se reparte todo el horizonte</em>
      )}
    </div>
  );
}

export function AulasAsignacionDeAplicadores({
  reparto,
  lugares,
  facultades,
  onFijar = null,
  onDeclararRango = null,
  onResortear = null,
  onConcentrar = null,
  oferta = null,
  ventanas = null,
  hoy = hoyISO(),
  distribucion = null,
  onPublicarDistribucion = null,
}: {
  /**
   * S7 (2026-09-07): el Sheets que leen los aplicadores —recordado en la
   * config— y la huella del reparto vigente, para decir si quedó viejo.
   */
  distribucion?: { recordado?: DistribucionSheetsRecordada; vigente?: DistribucionVigente } | null;
  /** Publica la distribución; con enlace lo recuerda. `null` = solo lectura. */
  onPublicarDistribucion?: ((enlace?: string) => void | Promise<void>) | null;
  /**
   * La facultad de cada cita, por código. Dictado 2026-09-04: «el cuadro no
   * muestra la facultad». Viene del PLAN porque el reparto no la trae.
   */
  facultades?: ReadonlyMap<string, string>;
  /** `null` = la sesión no cargó la disponibilidad; se declara, no se rompe. */
  reparto: RepartoVista | null;
  /**
   * Código → lugar de la cita (`lugaresDelPlan`): el bloque `reparto` viaja
   * sin lugares y el jefe de campo reparte por edificio. Opcional: sin mapa,
   * la columna calla en vez de inventar.
   */
  lugares?: ReadonlyMap<string, string>;
  /**
   * B36 (dictado 2026-09-02: «mecanismo propio de asignación y
   * reasignación, que sea equitativo»): recibe el mapa COMPLETO de
   * fijaciones tras fijar/soltar una cita. `null` = la superficie es de
   * solo lectura y los selectores no se pintan.
   */
  onFijar?: ((mapa: Record<string, string>) => void | Promise<void>) | null;
  /**
   * B75: declarar (o limpiar con `null`) el rango de despliegue del reparto.
   * `null` como prop = superficie de solo lectura, los controles no se pintan.
   */
  onDeclararRango?: ((rango: { desde: string; hasta: string } | null) => void | Promise<void>) | null;
  /**
   * B67 («no tengo una forma de hacer un resorteo»): pedir OTRO sorteo — se
   * persiste la semilla siguiente y el reparto rota su desempate. Las
   * fijaciones y la equidad no cambian.
   */
  onResortear?: ((semillaSiguiente: number) => void | Promise<void>) | null;
  /**
   * Dictado 2026-09-04: encender/apagar la concentración por día del reparto
   * («si un aplicador viene, que haga sus 2-4 el mismo día»). `null` = solo
   * lectura, el toggle no se pinta.
   */
  onConcentrar?: ((valor: boolean) => void | Promise<void>) | null;
  /**
   * La malla de OFERTA ya normalizada. Sin ella los avisos sólo pueden decir
   * el hecho («nadie llega»); con ella dicen la causa y a quién tocar
   * (dictado 2026-09-04). `null` = la sesión no cargó la disponibilidad.
   */
  oferta?: MallaDeOferta | null;
  /**
   * La ventana pactada de cada cita (`fecha` + código), del bloque `franjas`.
   * Es lo que da la HORA de una cita descubierta, que el reparto no trae.
   */
  ventanas?: ReadonlyMap<string, VentanaDeCita> | null;
  /** El día del operativo (`YYYY-MM-DD`); inyectable para el test. */
  hoy?: string;
}) {
  // El aplicador explorado desde el rail. Estado UI efímero de esta
  // superficie: no es un panel enlazable ni un foco de entidad — el mismo
  // criterio que la franja activa de la malla.
  const [enlaceDistribucion, setEnlaceDistribucion] = useState<string | null>(null);
  const [enFoco, setEnFoco] = useState<string | null>(null);
  // El resorteo en curso: mismo feedback que el rango («poco intuitivo» sin
  // señal de trabajo — el refetch tarda y el click parecía muerto).
  const [sorteando, setSorteando] = useState(false);
  const [concentrando, setConcentrando] = useState(false);
  const [fijado, setFijado] = useState(false);
  // El «copiado ✓» transitorio del botón de despliegue; efímero de superficie.
  const [copiado, setCopiado] = useState(false);
  // Si el portapapeles se niega (permiso, foco, webview restrictivo), el
  // texto se revela seleccionado para copiarlo a mano: el botón jamás muere
  // en silencio. "" = oculto.
  const [textoRevelado, setTextoRevelado] = useState("");

  if (!reparto) {
    return (
      <p className="aulas-carga-vacio" data-qa-geometry-member="true" data-qa-geometry-capacity="owned">
        El reparto sale de la disponibilidad de los aplicadores, que este estudio todavía no
        tiene cargada. Con el libro de disponibilidad del equipo (Excel) en la sesión, cada cita
        pactada recibe su aplicador: parejo, sin solapes y repetible con cada Recargar.
      </p>
    );
  }

  const resaltando = enFoco !== null;
  const claseDeFila = (aplicador: string): string | undefined => {
    if (!resaltando) return undefined;
    return aplicador === enFoco ? "es-resaltada" : "es-apagada";
  };

  // Los candidatos del selector: la equidad entera, con su carga a la vista —
  // reasignar mirando quién anda cargado es la mitad del «que sea equitativo».
  // El día QUE TOCA, compartido por los días, el rail y los KPIs: el primero
  // no pasado.
  const diaQueToca = reparto.dias.find((x) => x.fecha >= hoy) ?? null;
  const proximo = diaQueToca?.fecha ?? null;
  // La primera cita de cada aplicador en el día que toca — el rail deja de
  // ser solo un conteo y se vuelve la hoja de DESPLIEGUE (régimen 2026-09-02:
  // «cómo se va a desplegar a los aplicadores»): a qué hora y a qué pabellón
  // entra cada uno. Las asignaciones ya vienen en orden de hora.
  const despliegue = new Map<string, { inicio: string; codigo: string; recojo: string }>();
  for (const a of diaQueToca?.asignaciones ?? []) {
    if (!despliegue.has(a.aplicador)) {
      despliegue.set(a.aplicador, { inicio: a.inicio, codigo: a.codigo, recojo: a.recojo });
    }
  }

  // Dictado 2026-09-04: la agenda día a día de cada aplicador, del payload.
  const agenda = agendaDelAplicador(reparto);
  // Y las SALIDAS de los dos avisos que sólo describían: por qué una cita no
  // tiene quién la aplique, y qué cubre quien quedó sin nada.
  const mapaVentanas = ventanas ?? new Map<string, VentanaDeCita>();
  const salidas = new Map(
    salidasDeDescubiertos(reparto, oferta, mapaVentanas).map((s) => [claveDeCita(s.fecha, s.codigo), s]),
  );
  const libres = salidasDeLibres(reparto, oferta);
  // Y los viajes al campus por UNA sola aula, con la causa de cada uno: el
  // motor los baja hasta donde la física deja y los que quedan no son un
  // fallo suyo, así que se explican en vez de contarse.
  const solitarios = salidasDeViajesSolitarios(reparto, oferta);
  // Y el orden del rail: los SIN asignación al principio («deben estar al
  // principio»), después de mayor a menor carga, alfabeto al final.
  const equidadOrdenada = [...reparto.equidad].sort((a, b) =>
    (b.asignadas === 0 ? 1 : 0) - (a.asignadas === 0 ? 1 : 0)
    || b.asignadas - a.asignadas
    || a.aplicador.localeCompare(b.aplicador, "es"));

  // Dictado 2026-09-04: el nombre se escribe como se escribe un nombre. El
  // `value` sigue siendo el CRUDO —es la identidad con la que el motor arma
  // `fijadas`—; normalizarlo aquí rompería la fijación en el primer acento.
  //
  // Y al final, separado de las personas por un divisor, el comodín del
  // operativo: «una nueva opción llamada INTERNO PULSO, que es cuando no hay
  // aplicadores disponibles y lo termina haciendo alguien de Pulso» (dictado
  // 2026-09-04). Va en su propio grupo porque NO es una persona del libro de
  // disponibilidad: mezclarlo en la lista lo haría parecer uno más, y quien
  // busca a quién mandar tiene que ver que ahí se acaba el equipo.
  const opcionesDeAplicador = (
    <>
      {reparto.equidad.map((e) => (
        <option key={e.aplicador} value={e.aplicador}>
          {nombreDeAplicador(e.aplicador)} · {fmt(e.asignadas)}
        </option>
      ))}
      <optgroup label="Si no hay nadie del equipo">
        <option value={INTERNO_PULSO}>
          {INTERNO_PULSO}
          {(() => {
            const n = reparto.equidad.find((e) => e.aplicador === INTERNO_PULSO)?.asignadas ?? 0;
            return n > 0 ? ` · ${fmt(n)}` : "";
          })()}
        </option>
      </optgroup>
    </>
  );
  const fijar = (codigo: string, aplicador: string) => {
    void onFijar?.(mapaDeFijaciones(reparto.fijadas, codigo, aplicador));
  };
  // S7: el Sheets de los aplicadores. El estado DURO (enlace recordado y
  // huella de lo publicado) vive en la config; aquí sólo el borrador del
  // enlace que se está pegando, como en el campo del libro.
  const recordadoUrl = enlaceDeDistribucion(distribucion?.recordado);
  const escritoDistribucion = (enlaceDistribucion ?? "").trim();
  const hayDestinoDistribucion = Boolean(escritoDistribucion || recordadoUrl);
  const avisoSheets = avisoDistribucion(distribucion?.recordado, distribucion?.vigente);

  return (
    <div className="aulas-asigna">
      <div className="aulas-carga-controles" data-qa-geometry-capacity="owned" data-qa-geometry-member="true">
        {/* La promesa del dictado, en una línea sobria: qué es este reparto y
            hasta cuándo vale. */}
        {/* Dictado 2026-09-04: «le falta formato al texto de arriba». Eran
            tres frases distintas en un solo bloque gris corrido: qué es este
            reparto, quién manda cuando lo tocas, y el protocolo de horas. Ahora
            son dos renglones con jerarquía, y el protocolo lleva sus cifras en
            chip para que se lea de un vistazo en vez de leerse entero. */}
        <div className="aulas-asigna-vigencia">
          <p className="aulas-asigna-vigencia-que">
            Reparto <strong>vigente</strong> sobre lo agendado hasta hoy: se recalcula con cada
            Recargar y una confirmación nueva entra sola.
            {onFijar ? " Lo que pongas a mano manda sobre el automático y se conserva." : ""}
          </p>
          {/* B71 (dictado 2026-09-03): el protocolo del despliegue vive EN la
              app, no solo en el aviso copiado. */}
          <p className="aulas-asigna-protocolo">
            <span>Cada aplicador recoge materiales <strong>30 min antes</strong> de su cita</span>
            <span>sale al aula <strong>15 min antes</strong></span>
            <span>su hora completa queda reservada</span>
          </p>
        </div>
        {/* S7 (2026-09-07): el Sheets que leen los aplicadores. El día 1 quedó
            viejo (85 citas vigentes contra 83 publicadas) y nada lo decía: el
            aviso compara la huella de lo publicado con la del reparto vigente
            y dice causa y salida; el enlace se pega una vez y queda guardado. */}
        {onPublicarDistribucion ? (
          <div className="aulas-asigna-sheets">
            <p className="aulas-asigna-mandos-rotulo">Sheets de los aplicadores</p>
            <div className="aulas-aviso" data-tono={avisoSheets.tono}>
              {avisoSheets.tono === "ok" ? <CheckCircle2 size={16} /> : <Info size={16} />} {avisoSheets.texto}
            </div>
            <div className="aulas-asigna-rango aulas-asigna-sheets-campo">
              <input
                type="url"
                value={enlaceDistribucion ?? recordadoUrl}
                onChange={(e) => setEnlaceDistribucion(e.target.value)}
                placeholder="Pega el enlace del Google Sheets de los aplicadores"
                aria-label="Enlace del Sheets de los aplicadores"
              />
              <button
                type="button"
                className="aulas-asigna-rango-boton"
                disabled={!hayDestinoDistribucion}
                title={hayDestinoDistribucion
                  ? "Escribe el reparto vigente en el Sheets de los aplicadores"
                  : "Pega el enlace del Sheets de los aplicadores: sin él no hay dónde publicar"}
                onClick={() => { void onPublicarDistribucion(escritoDistribucion || undefined); }}
              >
                Publicar distribución
              </button>
              {recordadoUrl ? (
                <a className="aulas-asigna-sheets-enlace" href={recordadoUrl} target="_blank" rel="noreferrer">
                  Abrir el Sheets
                </a>
              ) : null}
            </div>
          </div>
        ) : null}
        {onDeclararRango || onResortear || onConcentrar ? (
          <div className="aulas-asigna-mandos">
            {/* Dictado 2026-09-04: «le falta formato a este box». Tres
                instrumentos dentro de una caja sin nombre; ahora la caja dice
                qué gobierna. */}
            <p className="aulas-asigna-mandos-rotulo">Cómo se reparte</p>
            {onDeclararRango ? (
              <RangoDeDespliegue
                rango={reparto.rango}
                onDeclarar={(r) => onDeclararRango(r)}
              />
            ) : null}
            {onResortear ? (
              <span className="aulas-asigna-resorteo">
                <button
                  type="button"
                  className="aulas-asigna-rango-boton"
                  disabled={sorteando}
                  title="Otro sorteo con las mismas reglas: rota quién gana los empates; la equidad y lo fijado a mano no cambian"
                  onClick={() => {
                    void (async () => {
                      setSorteando(true);
                      try {
                        await onResortear(reparto.semilla + 1);
                      } finally {
                        setSorteando(false);
                      }
                    })();
                  }}
                >
                  {sorteando ? "Sorteando…" : "Resortear"}
                </button>
                {reparto.semilla > 0 ? (
                  <em>sorteo n.º {fmt(reparto.semilla + 1)}</em>
                ) : null}
              </span>
            ) : null}
            {/* Dictado 2026-09-04: «es mejor que un aplicador haga sus
                aplicaciones [el mismo día]… seleccionable, y sí quiero que se
                active». El eco viene del MOTOR: el checkbox dice el criterio
                con el que se armó el reparto de abajo, no un deseo local. */}
            {onConcentrar ? (
              /* Dictado 2026-09-04: «no debe ser un check, debe ser un
                 switch». Y con razón: una casilla dice «marqué esto en un
                 formulario»; esto es un criterio que QUEDA PUESTO y reescribe
                 el reparto de abajo en cuanto se toca. */
              <span
                className="aulas-asigna-concentrar"
                title="Llena la jornada de quien ya viene ese día antes de abrir otra persona. La equidad total y lo que pusiste a mano siguen mandando."
              >
                <Switch
                  checked={reparto.concentrado}
                  disabled={concentrando}
                  ariaLabel="Concentrar el día del aplicador: sus aplicaciones en uno o dos días en vez de repartidas por la semana"
                  onToggle={() => {
                    void (async () => {
                      setConcentrando(true);
                      try {
                        await onConcentrar(!reparto.concentrado);
                      } finally {
                        setConcentrando(false);
                      }
                    })();
                  }}
                />
                <span className="aulas-asigna-concentrar-texto">
                  <strong>Concentrar el día del aplicador</strong>
                  <em>{concentrando ? "aplicando…" : "sus citas en uno o dos días, no sueltas por la semana"}</em>
                </span>
              </span>
            ) : null}
          </div>
        ) : null}
        {reparto.fueraDeRango.length > 0 ? (
          /* B75: lo aplazado se DECLARA — cuántas citas esperan su tanda y en
             qué días; descartarlo en silencio sería el defecto. */
          <p className="aulas-carga-aviso aulas-asigna-aplazadas">
            Fuera del rango elegido: {(() => {
              const pactadas = reparto.fueraDeRango.reduce((n, f) => n + f.codigos.length, 0);
              const sinHora = reparto.fueraDeRango.reduce((n, f) => n + f.porConfirmar.length, 0);
              const dias = reparto.fueraDeRango.length;
              return `${fmt(pactadas)} ${pactadas === 1 ? "aplicación pactada" : "aplicaciones pactadas"}` +
                `${sinHora ? ` y ${fmt(sinHora)} por confirmar` : ""}` +
                ` en ${fmt(dias)} ${dias === 1 ? "día" : "días"}` +
                ` (${reparto.fueraDeRango[0].etiqueta} → ${reparto.fueraDeRango[dias - 1].etiqueta})`;
            })()}. Esperan su tanda; nada se descarta.
          </p>
        ) : null}
        <dl className="aulas-carga-kpis">
          {diaQueToca ? (
            /* El KPI del despliegue va PRIMERO: cuánta gente mueve el día que
               toca es la cifra con la que se abre la vista. */
            <div>
              <dt>{diaQueToca.etiqueta} · próxima salida</dt>
              <dd>{fmt(diaQueToca.asignaciones.length)}</dd>
            </div>
          ) : null}
          <div>
            <dt>Aplicaciones repartidas</dt>
            <dd>{fmt(reparto.citas)}</dd>
          </div>
          <div>
            <dt>Sin nadie que llegue</dt>
            <dd className={reparto.sinCubrir > 0 ? "es-descubierto" : undefined}>{fmt(reparto.sinCubrir)}</dd>
          </div>
          <div>
            <dt>Por confirmar</dt>
            <dd>{fmt(reparto.porConfirmar)}</dd>
          </div>
          <div>
            <dt>Aplicadores con carga</dt>
            <dd>
              {fmt(reparto.conCarga)}
              <span className="aulas-asigna-de"> de {fmt(reparto.equidad.length)}</span>
            </dd>
          </div>
        </dl>
      </div>

      <div className="aulas-asigna-cuerpo" data-qa-geometry-member data-qa-geometry-capacity="owned">
        <div className="aulas-asigna-dias">
          {reparto.dias.length === 0 ? (
            <p className="aulas-asigna-sin-dias">
              Nada que repartir todavía: ninguna cita pactada con fecha y hora. En cuanto se
              agende la primera, aparece aquí con su aplicador.
            </p>
          ) : (
            (() => {
              // El día QUE TOCA (calculado arriba, compartido con el rail):
              // en una lista donde todas las fechas pesan igual, la del
              // despliegue inminente no salta.
              return reparto.dias.map((d) => {
                const esPasado = d.fecha < hoy;
                const esElQueToca = d.fecha === proximo;
                return (
              <section
                key={d.fecha}
                className={`aulas-asigna-dia${esElQueToca ? " es-el-que-toca" : ""}${esPasado ? " es-pasado" : ""}`}
              >
                <h4>
                  {d.etiqueta}
                  <span className="aulas-asigna-conteo">
                    {" "}· {fmt(d.asignaciones.length)}{" "}
                    {d.asignaciones.length === 1 ? "aplicación repartida" : "aplicaciones repartidas"}
                  </span>
                  {esElQueToca ? (
                    <span className="aulas-asigna-toca">
                      {d.fecha === hoy ? "hoy, salida de campo" : "próxima salida"}
                    </span>
                  ) : null}
                  {esElQueToca && d.asignaciones.length > 0 ? (
                    /* El despliegue viaja por WhatsApp: una línea por cita,
                       en orden de hora, con su lugar — y lo descubierto
                       declarado al final (textoDelDespliegue). */
                    <button
                      type="button"
                      className="aulas-asigna-copiar"
                      title="Copia la lista del día (hora, aula y aplicador de cada cita), lista para pegar en el chat del equipo"
                      aria-label={`Copiar el aviso de ${d.etiqueta}: hora, aula y aplicador de cada cita, para pegarlo en el chat del equipo`}
                      onClick={() => {
                        const texto = textoDelDespliegue(d, lugares);
                        const marca = () => {
                          setCopiado(true);
                          setTimeout(() => setCopiado(false), 2200);
                        };
                        // El async clipboard puede rechazar (permiso, foco);
                        // el fallback de textarea copia igual y el botón
                        // nunca se queda mudo tras un click.
                        const aMano = () => setTextoRevelado(texto);
                        if (!navigator.clipboard?.writeText) { aMano(); return; }
                        navigator.clipboard.writeText(texto).then(() => {
                          setTextoRevelado("");
                          marca();
                        }).catch(aMano);
                      }}
                    >
                      {copiado
                        ? <><Check size={12} aria-hidden="true" /> copiado</>
                        : <><Copy size={12} aria-hidden="true" /> copiar aviso del día</>}
                    </button>
                  ) : null}
                  {esPasado ? <em className="aulas-asigna-ya-paso"> · ya pasó</em> : null}
                </h4>
                {esElQueToca && textoRevelado ? (
                  /* El peldaño manual: el portapapeles se negó y el texto se
                     entrega seleccionado — un Cmd/Ctrl+C y listo. */
                  <div className="aulas-asigna-revelado">
                    <p>El portapapeles no dio permiso. El despliegue está listo abajo: selecciónalo y cópialo.</p>
                    <textarea
                      readOnly
                      value={textoRevelado}
                      rows={Math.min(12, textoRevelado.split("\n").length + 1)}
                      ref={(el) => el?.select()}
                      aria-label="Despliegue del día para copiar a mano"
                    />
                  </div>
                ) : null}
                {d.noCubiertos.length > 0 ? (
                  /* Destacado y ARRIBA de su día: la cita descubierta es lo que
                     el jefe de campo tiene que resolver antes de esa fecha — y
                     con onFijar la resuelve AQUÍ: elegir a alguien la fija,
                     aunque su disponibilidad no la respalde (queda advertida). */
                  <div className="aulas-asigna-descubiertos">
                    <p>
                      <AlertTriangle size={14} aria-hidden="true" />
                      <strong>
                        {fmt(d.noCubiertos.length)}{" "}
                        {d.noCubiertos.length === 1 ? "aplicación pactada" : "aplicaciones pactadas"} sin nadie
                        que llegue:
                      </strong>
                    </p>
                    <span className="aulas-asigna-resolver">
                      {d.noCubiertos.map((c) => {
                        // Dictado 2026-09-04: «¿por qué no hay disponibilidad
                        // a esa hora? ¿quiénes tienen disponibilidad a esa
                        // hora?». La causa se dice y, cuando la salida existe,
                        // se nombra a quién soltar para abrirla.
                        const s = salidas.get(claveDeCita(d.fecha, c));
                        return (
                          <span key={c} className="aulas-asigna-resolver-item">
                            <ChipDato>{c}</ChipDato>
                            {s?.inicio ? (
                              <ChipHora>{s.inicio}{s.fin ? ` a ${s.fin}` : ""}</ChipHora>
                            ) : null}
                            {onFijar ? (
                              <select
                                className="aulas-asigna-selector"
                                value=""
                                aria-label={`Fijar aplicador para ${c}: nadie libre la cubre; elegir a alguien la fija igual y queda advertida`}
                                onChange={(e) => { if (e.target.value) fijar(c, e.target.value); }}
                              >
                                <option value="">fijar a…</option>
                                {opcionesDeAplicador}
                              </select>
                            ) : null}
                            {s ? (
                              <span className="aulas-asigna-causa">
                                {s.causa === "sin-oferta"
                                  ? `nadie está libre desde las ${s.desdeRecojo}, que es cuando empieza su recojo: hay que mover la cita o sumar gente`
                                  : s.causa === "sin-hora"
                                    ? "sin hora legible en el libro, no se puede decir quién podría"
                                    : (() => {
                                      // Los nombres se separan con · y no con
                                      // coma: un nombre YA lleva su coma
                                      // («Castillo Solorsano, Leidy Viviana»)
                                      // y la lista se leía como el doble de
                                      // personas de las que hay.
                                      const n = s.ocupados.length;
                                      const lista = s.ocupados
                                        .map((o) => `${nombreDeAplicador(o.aplicador)} (${o.porCodigo})`)
                                        .join(" · ");
                                      const desde = `libres desde las ${s.desdeRecojo}`;
                                      return n === 0
                                        ? `${fmt(s.conHorario.length)} ${desde}: ${s.conHorario.map(nombreDeAplicador).join(" · ")}`
                                        : `${fmt(s.conHorario.length)} ${desde}, ${n === 1 ? "y está" : "y están"} en otra aplicación a esa hora: ${lista}. Soltando una de ésas se abre.`;
                                    })()}
                              </span>
                            ) : null}
                          </span>
                        );
                      })}
                    </span>
                  </div>
                ) : null}
                {d.asignaciones.length > 0 ? (() => {
                  // Dictado 2026-09-04: «una raíz o conexión cuando la misma
                  // persona hace más de una aplicación seguida en el día, para
                  // mapear esas secuencias». La tabla va por HORA, así que sus
                  // citas casi nunca son filas contiguas; la cadena las une.
                  const { cadenas, carriles } = cadenasDelDia(d);
                  return (
                  <table className={`aulas-asigna-tabla${carriles ? " es-con-cadenas" : ""}`}>
                    <thead>
                      <tr>
                        {carriles ? (
                          <th scope="col" style={{ width: `${carriles * 14 + 6}px` }}>
                            <span className="pulso-sr-only">Secuencias del día</span>
                          </th>
                        ) : null}
                        <th scope="col">Cita</th>
                        <th scope="col">Facultad</th>
                        <th scope="col">Lugar</th>
                        <th scope="col">Horario</th>
                        <th scope="col">Aplicador</th>
                      </tr>
                    </thead>
                    <tbody>
                      {d.asignaciones.map((a, iFila) => {
                        const lugar = lugares?.get(a.codigo) ?? "";
                        return (
                          <tr key={a.codigo} className={claseDeFila(a.aplicador)}>
                            {carriles ? (
                              /* El canalón: un carril por cadena que conviva en
                                 este tramo. La línea CRUZA las filas de otros
                                 (parada=false) porque cortarla en los huecos
                                 diría «aquí termina», que es lo contrario de lo
                                 que se quiere leer. */
                              <td className="aulas-asigna-canalon" aria-hidden="true">
                                {cadenas.map((c) => {
                                  const t = tramoDeCadena(c, iFila);
                                  if (!t) return null;
                                  return (
                                    <i
                                      key={c.aplicador}
                                      /* Absoluto y no inline-block: dentro de
                                         una celda sin alto propio, un
                                         `height: 100%` no resuelve y el carril
                                         medía CERO — se veían los nodos
                                         sueltos, sin la línea que los une. */
                                      style={{ left: `${c.carril * 14}px` }}
                                      className={`aulas-asigna-carril es-tono-${c.tono}${
                                        t.parada ? " es-parada" : ""}${
                                        t.cabeza ? " es-cabeza" : ""}${
                                        t.cola ? " es-cola" : ""}${
                                        enFoco === c.aplicador ? " es-enfoco" : ""}`}
                                      title={`${nombreDeAplicador(c.aplicador)}: ${fmt(c.filas.length)} aplicaciones seguidas este día`}
                                    />
                                  );
                                })}
                              </td>
                            ) : null}
                            <th scope="row">{a.codigo}</th>
                            {/* La facultad del curso-horario: sin ella, «CH 7»
                                no dice a qué corte pertenece y había que ir a
                                buscarlo a otra pestaña. Calla si el plan no la
                                trae, en vez de inventar un guion. */}
                            <td className="aulas-asigna-facultad">
                              {facultades?.get(a.codigo) ?? ""}
                            </td>
                            {/* El chip del lugar con el color de su letra
                                (dictado 2026-09-02); sin lugar conocido la
                                columna calla, no inventa. */}
                            <td>{lugar ? <ChipLugar lugar={lugar} /> : ""}</td>
                            <td>
                              {/* Dictado 2026-09-03 (2.ª ronda): «distinguir
                                  bien en boxes el tiempo de preparación de la
                                  hora en la que se agendó con el docente». La
                                  preparación habla en tenue; la cita pactada
                                  conserva su chip firme. */}
                              {/* Dictado 2026-09-04: «rango de aplicación
                                  quizás necesite mejores etiquetas y mejor
                                  claridad sobre cómo se está aplicando». Las
                                  tres horas eran dos chips donde sólo una
                                  decía qué era: ahora cada una lleva su verbo
                                  y se leen como la secuencia del día
                                  (recoge, sale, aplica). El ancho sobraba. */}
                              <span
                                className="aulas-asigna-horas"
                                title={a.recojo
                                  ? `Recoge materiales ${a.recojo}${a.salida ? `, sale al aula ${a.salida}` : ""}; la aplicación pactada con el docente es de ${a.inicio}${a.fin ? ` a ${a.fin}` : ""}`
                                  : undefined}
                              >
                                {a.recojo ? <ChipPrep>recoge {a.recojo}</ChipPrep> : null}
                                {a.salida ? <ChipPrep>sale {a.salida}</ChipPrep> : null}
                                {a.inicio && a.fin
                                  ? <ChipHora>aplica {a.inicio} a {a.fin}</ChipHora>
                                  : a.inicio ? <ChipHora>aplica {a.inicio}</ChipHora>
                                  : <span className="aulas-asigna-sin-hora">sin hora pactada</span>}
                              </span>
                            </td>
                            <td>
                              {onFijar ? (
                                /* B36: elegir a alguien lo FIJA (manda sobre el
                                   automático y sobrevive cada Recargar).
                                   Dictado 2026-09-04: «automático no necesita
                                   una palabra grandota y un guion, eso es muy
                                   AI slop; necesita tener el nombre». Así que
                                   la casilla enseña el NOMBRE y de quién fue
                                   la decisión lo dice un sello al lado, que
                                   cambia de automática a manual al tocarla. */
                                <span className="aulas-asigna-quien">
                                  <select
                                    className="aulas-asigna-selector"
                                    value={a.fijada ? a.aplicador : ""}
                                    aria-label={`Aplicador de ${a.codigo}: ${nombreDeAplicador(a.aplicador)}, ${
                                      a.fijada ? "puesto a mano" : "decidido por el reparto"
                                    }. Elegir a otra persona lo pone a mano`}
                                    onChange={(e) => fijar(a.codigo, e.target.value)}
                                  >
                                    <option value="">{nombreDeAplicador(a.aplicador)}</option>
                                    {opcionesDeAplicador}
                                  </select>
                                  {a.fijada ? (
                                    /* El sello manual ES el camino de vuelta:
                                       sin él, deshacer obligaba a buscar una
                                       opción «Automático» en una lista de 31. */
                                    <button
                                      type="button"
                                      className="aulas-asigna-sello es-manual"
                                      title="La pusiste tú y sobrevive cada Recargar. Toca para devolverla al reparto automático."
                                      aria-label={`${a.codigo}: puesto a mano. Devolver al reparto automático`}
                                      onClick={() => fijar(a.codigo, "")}
                                    >
                                      <Pin size={10} aria-hidden="true" /> manual
                                    </button>
                                  ) : (
                                    <span
                                      className="aulas-asigna-sello es-auto"
                                      title="La decidió el reparto; elegir a otra persona la pone a mano"
                                    >
                                      <Shuffle size={10} aria-hidden="true" /> automática
                                    </span>
                                  )}
                                  {a.advertencia ? (
                                    <span className="aulas-asigna-advertencia">
                                      <AlertTriangle size={11} aria-hidden="true" />
                                      {AVISO_LEGIBLE[a.advertencia] ?? a.advertencia}
                                    </span>
                                  ) : null}
                                </span>
                              ) : (
                                nombreDeAplicador(a.aplicador)
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  );
                })() : null}
                {d.porConfirmar.length > 0 ? (
                  /* El vocabulario de B11: la fecha sin hora pactada no pide
                     gente todavía. Se declara para que el día no parezca más
                     resuelto de lo que está; asignarle a alguien sería
                     inventar una cita. */
                  <p className="aulas-asigna-pendientes">
                    Por confirmar: {chipsDeCodigos(d.porConfirmar)}. Fecha sin hora pactada; no
                    piden gente todavía.
                  </p>
                ) : null}
              </section>
                );
              });
            })()
          )}
          {/* El diagnóstico de los viajes por una sola aula va AQUÍ y no en el
              rail: cada línea nombra a quién está ocupado y en qué cita, y en
              los 250px del rail eso se partía en cinco renglones por ítem
              —1.194px de alto para doce viajes—. Con el ancho de la columna
              cabe en una línea cada uno. */}
          <AulasViajesSolitarios viajes={solitarios} />
        </div>

        <aside
          className="aulas-asigna-equidad"
          onMouseLeave={() => { if (!fijado) setEnFoco(null); }}
        >
          <h4>Cargas por aplicador</h4>
          {reparto.equidad.length === 0 ? (
            <p className="aulas-asigna-sin-dias">
              La disponibilidad cargada no trae aplicadores que listar.
            </p>
          ) : (
            <>
              {(() => {
                /* B66: el veredicto de equidad DICHO, no inferido de barras
                   (dictado 2026-09-03: «no tengo ninguna forma de ver porque
                   esto es equitativo»). */
                const v = veredictoDeEquidad(reparto);
                if (!v) return null;
                return (
                  <p className={`aulas-asigna-veredicto${v.parejo ? " es-parejo" : " es-desparejo"}`}>
                    {v.texto}
                  </p>
                );
              })()}
              {libres.length > 0 ? (
                /* Dictado 2026-09-04: «no me estás dando soluciones ni formas
                   de poder yo resolver las cosas». Quien quedó sin nada dice
                   QUÉ CUBRE, que es con lo que se decide si conviene mover una
                   cita hacia sus horas o dejarlo fuera de esta tanda. */
                <details className="aulas-asigna-libres">
                  <summary>
                    {fmt(libres.length)} sin ninguna aplicación: qué horas cubren
                  </summary>
                  <ul>
                    {libres.map((l) => (
                      <li key={l.aplicador}>
                        <strong>{nombreDeAplicador(l.aplicador)}</strong>{" "}
                        {l.cubre.length === 0
                          ? oferta === null
                            ? "sin la malla de disponibilidad cargada no se puede decir qué cubre"
                            : "no declaró ninguna hora en el libro de disponibilidad"
                          : l.cubre
                            .map((c) => `${c.dia} ${c.desde} a ${c.hasta}`)
                            .join(" · ")}
                      </li>
                    ))}
                  </ul>
                </details>
              ) : null}
              <p className="aulas-asigna-nota">
                Con 0 también se listan: estar libre es un dato del reparto.
              </p>
              <ul>
                {equidadOrdenada.map((e) => {
                  const activo = enFoco === e.aplicador;
                  const dias = agenda.get(e.aplicador) ?? [];
                  return (
                    <li key={e.aplicador}>
                      <button
                        type="button"
                        className={`aulas-asigna-carga${activo ? " es-activo" : ""}${
                          e.asignadas === 0 ? " es-libre" : ""}`}
                        aria-pressed={fijado && activo}
                        aria-label={`${nombreDeAplicador(e.aplicador)}: ${fmt(e.asignadas)} ${
                          e.asignadas === 1 ? "aplicación asignada" : "aplicaciones asignadas"}${
                          dias.length ? ` en ${fmt(dias.length)} ${dias.length === 1 ? "día" : "días"}` : ""
                        }. Resalta sus aplicaciones en el reparto`}
                        onMouseEnter={() => { if (!fijado) setEnFoco(e.aplicador); }}
                        onFocus={() => { if (!fijado) setEnFoco(e.aplicador); }}
                        onClick={() => {
                          if (fijado && activo) { setFijado(false); return; }
                          setEnFoco(e.aplicador);
                          setFijado(true);
                        }}
                      >
                        <span className="aulas-asigna-nombre">{nombreDeAplicador(e.aplicador)}</span>
                        {/* La carga como badge del MISMO sistema de chips
                            (veredicto 2026-09-02): un solo componente, y el
                            estado «libre» lo atenúa por contexto. */}
                        <span className="aulas-asigna-cifra">
                          <ChipDato>{fmt(e.asignadas)}</ChipDato>
                          {/* En cuántos días cae su asignación (dictado
                              2026-09-04): la señal de dispersión de un
                              vistazo, y la que enseña si el criterio de
                              concentración funcionó. «1 día» se dice igual —
                              es la meta cumplida, y callarla obligaba a
                              inferir que un hueco significa un solo día. */}
                          {dias.length ? (
                            <em className="aulas-asigna-ndias">
                              {fmt(dias.length)} {dias.length === 1 ? "día" : "días"}
                            </em>
                          ) : null}
                        </span>
                        {/* Su entrada del día que toca: hora y a qué cita —
                            el «a dónde va cada uno» del despliegue, sin abrir
                            la tabla. Quien no sale ese día no lleva línea. */}
                        {(() => {
                          const cita = despliegue.get(e.aplicador);
                          if (!cita) return null;
                          return (
                            <span className="aulas-asigna-despliegue">
                              {/* La misma distinción del box de la tabla: el
                                  recojo en tenue, la hora pactada en chip. */}
                              {cita.recojo ? (
                                <ChipPrep>recojo {cita.recojo}</ChipPrep>
                              ) : null}
                              {cita.inicio ? <ChipHora>{cita.inicio}</ChipHora> : null}
                              {(() => {
                                const lugar = lugares?.get(cita.codigo) ?? "";
                                return lugar
                                  ? <ChipLugar lugar={lugar} />
                                  : <ChipDato>{cita.codigo}</ChipDato>;
                              })()}
                            </span>
                          );
                        })()}
                        {/* El desglose al hacer CLIC (dictado 2026-09-04:
                            «si yo le doy clic a un aplicador, me diga: él
                            tiene que aplicar este día y este otro, o él
                            aplica tres veces este día, en estos horarios»).
                            Va con `fijado`, no con el hover: abrir al pasar
                            el mouse crece la fila y empuja las de abajo bajo
                            el propio cursor — el rail temblaría al recorrerlo. */}
                        {fijado && activo && dias.length ? (
                          <span className="aulas-asigna-agenda">
                            {dias.map((d) => (
                              <span key={d.fecha} className="aulas-asigna-agenda-dia">
                                <strong>{d.etiqueta}</strong>
                                {/* La jornada de punta a punta: cuándo entra a
                                    la oficina y cuándo termina. Es el «qué días
                                    tiene que estar en oficina» del dictado
                                    2026-09-04, que sin esto había que deducir
                                    restándole media hora a la primera cita. */}
                                {d.oficina || d.termina ? (
                                  <em className="aulas-asigna-agenda-jornada">
                                    {/* «oficina 11:00 a 13:00» se leía como si
                                        estuviera DOS HORAS en la oficina; las
                                        dos puntas son cosas distintas y cada
                                        una lleva su verbo. */}
                                    {d.oficina ? `en oficina ${d.oficina}` : ""}
                                    {d.oficina && d.termina ? " · " : ""}
                                    {d.termina ? `termina ${d.termina}` : ""}
                                  </em>
                                ) : null}
                                <span className="aulas-asigna-agenda-horas">
                                  {d.horas.join(" · ")}
                                </span>
                              </span>
                            ))}
                          </span>
                        ) : null}
                        <i
                          className="aulas-asigna-barra"
                          style={{
                            width: `${reparto.cargaMax > 0
                              ? Math.round((e.asignadas / reparto.cargaMax) * 100)
                              : 0}%`,
                          }}
                          aria-hidden="true"
                        />
                      </button>
                    </li>
                  );
                })}
              </ul>
              {/* B32 (la mitad de app, componente de la sesión hermana): el
                  croquis del campus con el pabellón de la persona explorada —
                  hover o click en el rail pinta A DÓNDE entra en la próxima
                  salida; sin exploración, el campus queda neutro. */}
              <AulasCroquisDeCampus
                lugarResaltado={(() => {
                  if (!enFoco) return null;
                  const cita = despliegue.get(enFoco);
                  return cita ? (lugares?.get(cita.codigo) ?? null) : null;
                })()}
              />
            </>
          )}
        </aside>
      </div>

      {reparto.fijadasSinCita.length > 0 ? (
        /* La fijación cuya cita perdió fecha u hora: se declara y se conserva
           por si la cita vuelve — descartarla en silencio sería el defecto.
           Soltar es una decisión del usuario, no una limpieza automática. */
        <p className="aulas-carga-aviso aulas-asigna-huerfanas">
          Fijaciones sin cita pactada (la cita perdió fecha u hora; se conservan por si vuelve):{" "}
          {reparto.fijadasSinCita.map((c) => (
            <span key={c} className="aulas-asigna-resolver-item">
              <ChipDato>{c}</ChipDato>
              {onFijar ? (
                <button
                  type="button"
                  className="aulas-asigna-soltar"
                  onClick={() => fijar(c, "")}
                  aria-label={`Soltar la fijación de ${c}`}
                >
                  soltar
                </button>
              ) : null}
            </span>
          ))}
        </p>
      ) : null}

      {reparto.ilegibles > 0 ? (
        <p className="aulas-carga-aviso">
          {reparto.ilegibles === 1
            ? "1 entrada del reparto llegó ilegible y no se lista."
            : `${fmt(reparto.ilegibles)} entradas del reparto llegaron ilegibles y no se listan.`}
        </p>
      ) : null}
    </div>
  );
}
