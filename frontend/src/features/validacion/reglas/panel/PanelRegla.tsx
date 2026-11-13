/**
 * El panel de regla propia (rebanada V2 del plan de fidelidad; prototipo
 * `panelRegla`, `vistas.js:529-604`). Un `Sideover` ancho con dos estados:
 *
 *   - "Qué quieres revisar": el tipo de una regla nueva y las sugeridas.
 *   - La regla: la frase, "Condiciones", "Resultado" y "Casos que marca hoy"
 *     con el conteo previo del motor; su nombre (editable) va en el pie, junto
 *     a Guardar y a "Guardar como nueva".
 *
 * Reemplaza al asistente de tres pasos de `components/ReglaEditor.tsx`. Lo que
 * guarda lo arma `borradorDeRegla.ts` y es, para las mismas entradas, lo que
 * guardaba el asistente. Quien lo monta decide dónde se abre (la dirección,
 * con `usePanelRegla`) y qué se hace al guardar.
 */
import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { FichaPregunta } from "../../../../components/procesamiento/FichaPregunta";
import { FraseRegla } from "../../../../components/procesamiento/FraseRegla";
import { Dialog } from "../../../../components/Dialog";
import { EstadoVacio } from "../../../../components/EstadoVacio";
import { CargaDeBloque } from "../../../../components/CargaDeBloque";
import { PulsoButton } from "../../../../components/PulsoButton";
import { PulsoInput } from "../../../../components/PulsoInput";
import { Sideover } from "../../../../components/Sideover";
import { AlertTriangle, Copy, Play, Trash2 } from "../../../../vendor/lucide-react";
import type { ExploradorVariable, ReglaSemilla } from "../../types";
import { fraseDeReglaPropia, type PiezaDeFrase } from "../../customRuleNarrative";
import {
  borradorComoNuevo,
  borradorInicial,
  cuerpoAGuardar,
  cuerpoParaProbar,
  lectorDeTipos,
  nombreDelBorrador,
  reducirBorrador,
  validarBorrador,
  variablesEfectivas,
} from "../borradorDeRegla";
import { etiquetaDeOpcion, OpcionesProvider, useOpcionesDeVariables } from "../campos/opcionesDeVariable";
import { ordenarValoresPorEscala } from "../escalaDeOpciones";
import { tieneOpciones, tipoDeFicha } from "../campos/tipoDeFicha";
import { metaDeTipo } from "../tiposDeRegla";
import type { ReglaPropia, ReglaPropiaAGuardar, TipoReglaPropia } from "../tiposDelMotor";
import { CasosQueMarca, conteoSinDatos } from "./CasosQueMarca";
import { Condiciones } from "./Condiciones";
import { ICONO_DE_TIPO, QueRevisar } from "./QueRevisar";
import { useEscapeDelMenu } from "./escapeDelMenu";
import { Resultado } from "./Resultado";
import { useConteoPrevio } from "./useConteoPrevio";
import { useCatalogoDeReglas } from "./useCatalogoDeReglas";
import { sinEvaluarDelFormulario } from "../../../../api/validacionCatalogo";
import "./panel.css";

/** Los tipos cuya frase lleva dos preguntas con sus valores: reservan más alto. */
const FRASES_LARGAS: ReadonlySet<string> = new Set(["condiciones", "coherencia_2v", "comparar_fechas", "combinacion_catalogo"]);

export type AlGuardarRegla = (cuerpo: ReglaPropiaAGuardar, opciones: { auditar: boolean }) => Promise<void>;

export type PanelReglaProps = {
  abierto: boolean;
  onCerrar: () => void;
  /** La regla que se edita; `null` para una nueva. */
  inicial: ReglaPropia | null;
  /** Se pidió editar una regla que no está en la lista de esta base. */
  focoInexistente?: string | null;
  /** El tipo de una nueva, si ya se eligió (`tipo=` en la dirección). */
  tipoElegido?: TipoReglaPropia | null;
  /** La pregunta con que llega armada una nueva (`pregunta=`). */
  pregunta?: string | null;
  /** Elegir el tipo de una nueva (lo escribe en la dirección); `null` vuelve a "Qué quieres revisar". */
  onElegirTipo?: (tipo: TipoReglaPropia | null) => void;
  variables: readonly ExploradorVariable[];
  baseNombre: string | null;
  semillas: readonly ReglaSemilla[];
  onGuardar: AlGuardarRegla;
  /** "Ver en Explorar": abre la pregunta revisada. */
  onVerEnExplorar?: (variable: string) => void;
  /** Para el QA y las pruebas: la raíz lleva `data-pulso-panel`. */
  panelProps?: { "data-pulso-panel": string };
  /** Las preguntas todavía se están leyendo. */
  cargandoPreguntas?: boolean;
  /** "Ver" en la fila de las reglas del formulario sin evaluar. */
  onVerSinEvaluar?: () => void;
  /**
   * Una sugerida con que se abre una regla nueva ya armada ("Añadir" en las
   * sugeridas de Reglas), igual que "Usar" dentro del panel.
   */
  semillaInicial?: ReglaSemilla | null;
  /** Borra la regla propia que se edita; sin esta función el pie no ofrece "Eliminar la regla". */
  onEliminar?: () => Promise<void>;
};

/** La clave que reinicia el borrador: otra regla, o una nueva con otro arranque. */
function claveDelBorrador(p: Pick<PanelReglaProps, "inicial" | "focoInexistente" | "pregunta">, semilla: ReglaSemilla | null) {
  return [p.inicial?.id ?? "nueva", p.focoInexistente ?? "", p.pregunta ?? "", semilla?.nombre ?? ""].join("\u0000");
}

export function PanelRegla(props: PanelReglaProps) {
  const [semilla, setSemilla] = useState<ReglaSemilla | null>(null);
  // "Usar" dentro del panel gana a la sugerida con que se abrió.
  const efectiva = semilla ?? (props.abierto && !props.inicial ? props.semillaInicial ?? null : null);
  // Cerrar y volver a abrir empieza de cero: la clave cambia y el borrador se rehace.
  const clave = props.abierto ? claveDelBorrador(props, efectiva) : "cerrado";
  if (!props.abierto && semilla) setSemilla(null);
  return (
    <OpcionesProvider baseNombre={props.baseNombre}>
      <EditorDelPanel key={clave} {...props} semilla={efectiva} onUsarSemilla={setSemilla} />
    </OpcionesProvider>
  );
}

function FraseDeLaRegla({ piezas, variables }: { piezas: readonly PiezaDeFrase[]; variables: readonly ExploradorVariable[] }) {
  const porNombre = new Map(variables.map((v) => [v.name, v]));
  return (
    <>
      {piezas.map((p, i) => {
        if (p.tipo === "pregunta") {
          const meta = porNombre.get(p.variable);
          // Sin etiqueta propia, el código una sola vez.
          const conEtiqueta = !!meta?.label && meta.label !== p.variable;
          return (
            <FichaPregunta
              key={i}
              tipo={tipoDeFicha(meta?.tipo)}
              codigo={conEtiqueta ? p.variable : undefined}
              etiqueta={conEtiqueta ? meta.label : p.variable}
            />
          );
        }
        // Un valor corto (una fecha, un número) no se parte entre dos líneas.
        if (p.tipo === "valor") {
          return (
            <strong key={i} className={p.texto.length <= 24 ? "pulso-panel-regla-valor-entero" : undefined}>
              {p.texto}
            </strong>
          );
        }
        if (p.tipo === "conector") return <em key={i}>{p.texto}</em>;
        return <span key={i}>{p.texto}</span>;
      })}
    </>
  );
}

function EditorDelPanel({
  abierto,
  panelProps,
  inicial,
  focoInexistente,
  tipoElegido = null,
  pregunta = null,
  onElegirTipo,
  variables,
  baseNombre,
  semillas,
  onGuardar,
  onCerrar,
  onVerEnExplorar,
  cargandoPreguntas = false,
  onVerSinEvaluar,
  onEliminar,
  semilla,
  onUsarSemilla,
}: PanelReglaProps & { semilla: ReglaSemilla | null; onUsarSemilla: (s: ReglaSemilla | null) => void }) {
  const [borrador, despachar] = useReducer(reducirBorrador, { inicial, tipo: tipoElegido, pregunta, semilla }, borradorInicial);
  const [eligiendoTipo, setEligiendoTipo] = useState(false);
  const [envio, setEnvio] = useState<{ guardando: boolean; error: string }>({ guardando: false, error: "" });
  const tipoDeVariable = useMemo(() => lectorDeTipos(variables), [variables]);
  // Escape con un desplegable abierto cierra el desplegable, no el panel.
  useEscapeDelMenu(abierto);

  // Sin tipo, o tras "Cambiar": "Qué quieres revisar". El tipo de una nueva
  // también se escribe en la dirección (`tipo=`), para que el enlace la reabra.
  const nueva = !inicial;
  const vistaTipo = !focoInexistente && (eligiendoTipo || !borrador.tipo);
  const meta = metaDeTipo(borrador.tipo);

  const cuerpoDeConteo = useMemo(
    () => (vistaTipo || focoInexistente ? null : cuerpoParaProbar(borrador, tipoDeVariable)),
    [borrador, tipoDeVariable, vistaTipo, focoInexistente],
  );
  const { estado: conteo, reintentar } = useConteoPrevio(cuerpoDeConteo, baseNombre);
  const sinDatos = conteoSinDatos(conteo);
  const catalogo = useCatalogoDeReglas(abierto && !cargandoPreguntas && nueva && vistaTipo, baseNombre);
  const sinEvaluar = catalogo ? sinEvaluarDelFormulario(catalogo) : null;

  // Cerrar con cambios pide confirmar. Esc con un desplegable abierto cierra solo
  // el desplegable (`escapeDelMenu.ts`).
  const [inicioDelBorrador] = useState(() => JSON.stringify(borrador));
  const conCambios = JSON.stringify(borrador) !== inicioDelBorrador;
  const [confirmar, setConfirmar] = useState(false);
  const [confirmarEliminar, setConfirmarEliminar] = useState(false);
  async function eliminar() {
    if (!onEliminar) return;
    setConfirmarEliminar(false);
    setEnvio({ guardando: true, error: "" });
    try {
      await onEliminar();
      setEnvio({ guardando: false, error: "" });
    } catch (e) {
      setEnvio({ guardando: false, error: e instanceof Error ? e.message : String(e) });
    }
  }
  function intentarCerrar() {
    if (conCambios) setConfirmar(true);
    else onCerrar();
  }

  const variablesDeLaRegla = variablesEfectivas(borrador);
  // Las etiquetas de las respuestas que nombra la frase: las de la regla y las del filtro.
  const conLista = [...new Set([...variablesDeLaRegla, ...borrador.gateConditions.map((g) => g.variable)])].filter((v) =>
    tieneOpciones(variables.find((x) => x.name === v)?.tipo),
  );
  const opciones = useOpcionesDeVariables(conLista);
  // Las opciones de cada lista, en el orden de su escala y no en el de los clics.
  const enEscala = ordenarValoresPorEscala(
    { variables: variablesDeLaRegla, params: borrador.params, gate_conditions: borrador.gateConditions },
    opciones,
  );
  const piezas = fraseDeReglaPropia(
    { tipo: borrador.tipo, variables: variablesDeLaRegla, params: enEscala.params, gate_conditions: enEscala.gate_conditions },
    (variable, codigo) => {
      const opcion = opciones.get(variable)?.find((o) => o.code === codigo);
      return opcion ? opcion.label || codigo : etiquetaDeOpcion(undefined, codigo);
    },
  );

  function elegirTipo(tipo: TipoReglaPropia) {
    despachar({ tipo: "elegir-tipo", valor: tipo });
    setEligiendoTipo(false);
    if (nueva) onElegirTipo?.(tipo);
  }

  async function guardar(auditar: boolean, comoNueva = false) {
    const error = validarBorrador(borrador);
    if (error) {
      setEnvio({ guardando: false, error });
      return;
    }
    // "Guardar como nueva": lo que hay en pantalla entra como regla aparte y la original queda igual.
    const cuerpo = comoNueva
      ? cuerpoAGuardar(borradorComoNuevo(borrador, inicial?.nombre ?? ""), null, tipoDeVariable, variables)
      : cuerpoAGuardar(borrador, inicial, tipoDeVariable, variables);
    if (!cuerpo) return;
    setEnvio({ guardando: true, error: "" });
    try {
      await onGuardar(cuerpo, { auditar });
      setEnvio({ guardando: false, error: "" });
    } catch (e) {
      setEnvio({ guardando: false, error: e instanceof Error ? e.message : String(e) });
    }
  }

  // "default" es el nombre interno de la base única: solo una base con nombre propio se nombra.
  const base = baseNombre && baseNombre !== "default" ? ` de ${baseNombre}` : "";
  const antetitulo = nueva && !focoInexistente ? `Nueva regla propia${base}` : `Regla propia${base}`;
  const Icono = borrador.tipo ? ICONO_DE_TIPO[borrador.tipo] : null;
  const revisada = variablesDeLaRegla[0] ?? null;

  // Sin escribir, el nombre es el que la regla se pone sola y sigue a sus preguntas.
  const nombre = nombreDelBorrador(borrador, variables);
  let titulo;
  let cuerpo;
  let pie;
  if (cargandoPreguntas) {
    titulo = <span className="pulso-panel-regla-titulo">{nueva ? "Tipo de regla" : "Regla propia"}</span>;
    // Retiene la readiness de la pestaña mientras llegan las preguntas (readinessAnidada).
    cuerpo = <CargaDeBloque label="Cargando las preguntas de la base" />;
    pie = (
      <PulsoButton variant="secondary" size="lg" onClick={onCerrar}>
        Cancelar
      </PulsoButton>
    );
  } else if (focoInexistente) {
    titulo = <span className="pulso-panel-regla-titulo">Regla no encontrada</span>;
    cuerpo = (
      <div className="pulso-panel-regla-vacio">
        <EstadoVacio
          icono={<AlertTriangle size={20} />}
          titulo={`La regla ${focoInexistente} no está en esta base`}
          descripcion="Puede ser de otra base o haberse eliminado."
        />
      </div>
    );
    pie = (
      <PulsoButton variant="secondary" size="lg" onClick={onCerrar}>
        Cerrar
      </PulsoButton>
    );
  } else if (vistaTipo) {
    titulo = <span className="pulso-panel-regla-titulo">Tipo de regla</span>;
    cuerpo = (
      <div className="pulso-panel-regla-tipo">
        <QueRevisar
          tipoActual={borrador.tipo}
          tipoDeLaRegla={inicial?.tipo ?? null}
          semillas={nueva ? semillas : null}
          sinEvaluar={nueva ? sinEvaluar : null}
          onVerSinEvaluar={onVerSinEvaluar}
          onElegir={elegirTipo}
          onUsarSemilla={(s) => onUsarSemilla(s)}
        />
      </div>
    );
    pie = (
      <PulsoButton variant="secondary" size="lg" onClick={eligiendoTipo ? () => setEligiendoTipo(false) : intentarCerrar}>
        {eligiendoTipo ? "Volver a la regla" : "Cancelar"}
      </PulsoButton>
    );
  } else {
    titulo = (
      <span className="pulso-panel-regla-titulo">
        <span className="pulso-panel-regla-titulo-texto">{nombre}</span>
      </span>
    );
    cuerpo = (
      <div className="pulso-panel-regla-dos" data-qa-geometry-group="validacion/regla-panel" data-qa-geometry-contract="intrinsic">
        <div className="pulso-panel-regla-col" data-qa-geometry-member="">
          <FraseRegla
            className={FRASES_LARGAS.has(borrador.tipo ?? "") ? "pulso-panel-regla-frase--larga" : undefined}
            tipo={meta?.rotulo ?? ""}
            icono={Icono ? <Icono size={15} /> : undefined}
            accion={
              <PulsoButton variant="link" size="sm" onClick={() => setEligiendoTipo(true)}>
                Cambiar
              </PulsoButton>
            }
          >
            {piezas ? <FraseDeLaRegla piezas={piezas} variables={variables} /> : <span className="pulso-panel-regla-frase-pendiente">{meta?.descripcion}</span>}
          </FraseRegla>
          <Condiciones borrador={borrador} despachar={despachar} variables={variables} />
          <Resultado borrador={borrador} despachar={despachar} />
        </div>
        <div className="pulso-panel-regla-col pulso-panel-regla-col--casos" data-qa-geometry-member="">
          <CasosQueMarca
            estado={conteo}
            onReintentar={reintentar}
            inconsistencia={borrador.hallazgoKind === "inconsistencia_usuario"}
            variables={variables}
            onVerEnExplorar={revisada && onVerEnExplorar ? () => onVerEnExplorar(revisada) : null}
          />
        </div>
      </div>
    );
    pie = (
      <>
        {!nueva && onEliminar ? (
          <PulsoButton variant="danger" size="lg" onClick={() => setConfirmarEliminar(true)} disabled={envio.guardando}>
            <Trash2 size={14} aria-hidden="true" />
            Eliminar la regla
          </PulsoButton>
        ) : null}
        <PulsoButton variant="secondary" size="lg" onClick={intentarCerrar} disabled={envio.guardando}>
          Cancelar
        </PulsoButton>
        {!nueva ? (
          <PulsoButton variant="secondary" size="lg" onClick={() => void guardar(false, true)} disabled={envio.guardando}>
            <Copy size={14} aria-hidden="true" />
            Guardar como nueva
          </PulsoButton>
        ) : null}
        <PulsoButton
          variant={sinDatos ? "primary" : "secondary"}
          size="lg"
          className={sinDatos ? "pulso-panel-regla-principal" : undefined}
          onClick={() => void guardar(false)}
          disabled={envio.guardando}
        >
          Guardar
        </PulsoButton>
        {sinDatos ? null : (
          <PulsoButton variant="primary" size="lg" className="pulso-panel-regla-principal" onClick={() => void guardar(true)} disabled={envio.guardando}>
            <Play size={14} aria-hidden="true" />
            Guardar y auditar
          </PulsoButton>
        )}
      </>
    );
  }

  // El nombre va en el pie, junto a Guardar: es lo último que se mira al guardar.
  const enElEditor = !cargandoPreguntas && !focoInexistente && !vistaTipo;
  const pista = enElEditor ? (
    <label className="pulso-panel-regla-nombre-pie">
      <span>Nombre</span>
      <PulsoInput
        value={nombre}
        aria-label="Nombre de la regla"
        onChange={(e) => despachar({ tipo: "nombre", valor: e.target.value })}
      />
    </label>
  ) : vistaTipo && !cargandoPreguntas && !focoInexistente ? (
    <span>Obligatorias, saltos, restricciones, filtros de opciones y valores calculados ya salen del formulario.</span>
  ) : null;
  const estado = envio.error ? (
    <span className="pulso-panel-regla-error" role="alert">
      {envio.error}
    </span>
  ) : enElEditor && sinDatos ? (
    // Sin respuestas no hay auditoría: por eso falta "Guardar y auditar".
    <span>Se audita cuando haya respuestas.</span>
  ) : undefined;

  return (
    <Sideover
      open={abierto}
      onOpenChange={(siguiente) => {
        if (!siguiente) intentarCerrar();
      }}
      title={titulo}
      subtitle={antetitulo}
      className="pulso-panel-regla"
      bodyClassName="pulso-panel-regla-cuerpo"
      closeLabel="Cerrar la regla"
      dismissible={!envio.guardando}
      footer={pie}
      footerHint={pista}
      footerStatus={estado}
    >
      <div className="pulso-panel-regla-contenido" data-pulso-panel={panelProps?.["data-pulso-panel"]}>
        {cuerpo}
      </div>
      <Dialog
        open={confirmar}
        onOpenChange={setConfirmar}
        size="sm"
        tono="aviso"
        title="Descartar los cambios de la regla"
        closeLabel="Cerrar la confirmación"
        footer={
          <>
            <PulsoButton variant="secondary" onClick={() => setConfirmar(false)}>
              Seguir editando
            </PulsoButton>
            <PulsoButton
              variant="danger"
              confirm
              onClick={() => {
                setConfirmar(false);
                onCerrar();
              }}
            >
              Descartar los cambios
            </PulsoButton>
          </>
        }
      >
        <p className="pulso-panel-regla-confirmar">Al cerrar se pierde lo que cambiaste desde que abriste la regla.</p>
      </Dialog>
      <Dialog
        open={confirmarEliminar}
        onOpenChange={setConfirmarEliminar}
        size="sm"
        tono="peligro"
        title="Eliminar la regla"
        closeLabel="Cerrar la confirmación"
        footer={(
          <>
            <PulsoButton variant="secondary" onClick={() => setConfirmarEliminar(false)}>
              Cancelar
            </PulsoButton>
            <PulsoButton variant="danger" confirm onClick={() => void eliminar()}>
              Eliminar la regla
            </PulsoButton>
          </>
        )}
      >
        <p className="pulso-panel-regla-confirmar">"{inicial?.nombre ?? ""}" se borra de las reglas propias. No se puede deshacer.</p>
      </Dialog>
    </Sideover>
  );
}
