/**
 * "Casos que marca hoy" (prototipo `pp-rg-casos`): el conteo previo del motor
 * para el borrador, sin guardarlo (`POST /reglas_custom/probar`, contrato M1).
 *
 * La cifra es "`n_casos` de `n_base`": `n_base` son las filas que la auditoría
 * evalúa y que cumplen el "Solo revisar cuando"; por eso, con filtro, la base
 * lo dice. Los ejemplos (hasta 20) muestran las preguntas de la regla con el
 * valor que falla resaltado. Cada estado sin conteo tiene su vacío con la
 * causa (estados no dibujados: contrato M1, sección 1). En una regla de
 * fechas, bajo la cifra va cómo se leyó cada fecha u hora (formato, vacías,
 * ilegibles) y la tabla lleva lo leído en cada caso. En una regla de formato,
 * bajo la cifra van las respuestas que pasan y las que no (las más frecuentes,
 * con su motivo) y la tabla lleva la respuesta de cada caso con su motivo.
 */
import { rotuloDeCaso } from "../../rotuloDeCaso";
import { CifraHallazgo } from "../../../../components/procesamiento/CifraHallazgo";
import { EstadoVacio } from "../../../../components/EstadoVacio";
import { Panel } from "../../../../components/Panel";
import { PulsoButton } from "../../../../components/PulsoButton";
import { PulsoTable, type PulsoTableColumna } from "../../../../components/PulsoTable";
import { CargaDeBloque } from "../../../../components/CargaDeBloque";
import { ErrorBlock } from "../../../../components/States";
import { formatoConteo } from "../../../../lib/formatoNumero";
import { AlertTriangle, Compass, Inbox } from "../../../../vendor/lucide-react";
import type {
  EjemploDePrueba,
  EstadoDePrueba,
  LecturaDeFechas,
  LecturaDeFormato,
  PruebaDeRegla,
  ResumenDeBateria,
} from "../../../../api/validacionAuditoria";
import { textoDeFechas, textoDeLectura } from "../modeloFechas";
import { motivoEnTexto, textoDeFormato, textoDeLecturaDeFormato } from "../modeloFormato";
import { candidatosEnTexto, causaEnTexto, textoDeLecturaDeCatalogo } from "../modeloCombinacion";
import type { LecturaDeCatalogo, ResumenDeCatalogo } from "../../../../api/catalogoUbigeo";
import type { LecturaDeModa } from "../../../../api/modaDeGrupo";
import { causaDeModa, textoDeLecturaDeModa } from "../modeloModa";
import "./camposDeFechas.css";
import "./camposDeFormato.css";
import "./camposDeCombinacion.css";
import "./camposDeModa.css";
import type { ExploradorVariable } from "../../types";
import { etiquetaDeOpcion, useOpcionesDeVariables } from "../campos/opcionesDeVariable";
import { tieneOpciones } from "../campos/tipoDeFicha";
import { esEstadoInicial } from "../../estadoEsperado";
import type { EstadoDelConteo } from "./conteoPrevio";

/**
 * Cada estado sin conteo, con su causa en llano. El `motivo` del motor no se
 * muestra: llega en su propio formato (a veces el texto de R, en inglés).
 */
const SIN_EVALUAR: Record<Exclude<EstadoDePrueba, "evaluada" | "sin_datos">, { titulo: string; causa: string }> = {
  variable_excluida: {
    titulo: "La pregunta está fuera de la auditoría",
    causa: "La auditoría no la revisa. Vuelve a incluirla en el plan del formulario para contar esta regla.",
  },
  no_aplicable: {
    titulo: "La regla no se puede evaluar en esta base",
    causa: "Falta en la base alguna de sus preguntas.",
  },
  desalineada: {
    titulo: "El valor de la regla no aparece en los datos",
    causa: "Ninguna respuesta de la base tiene ese valor. Revisa el código elegido.",
  },
  no_evaluada: {
    titulo: "El motor no pudo evaluar la regla",
    causa: "Falló al leer los datos de esta base. Pasa al comparar preguntas cuyas respuestas no son números ni fechas.",
  },
};

/** El aviso de un error al contar, con su causa en llano y sin el texto técnico del pedido. */
export function errorDelConteo(codigo: string, mensaje: string): { titulo: string; causa: string } {
  if (!codigo) return { titulo: "Sin conexión con el motor de la app", causa: "El conteo no llegó. La regla sigue como la dejaste." };
  if (codigo.startsWith("E_REGLA")) return { titulo: "La regla todavía no se puede contar", causa: mensaje };
  return { titulo: "No se pudo contar la regla", causa: "El motor respondió con un error. La regla sigue como la dejaste." };
}

/** Filas de ejemplo a la vista: el marco no crece con la cantidad. */
export const MAX_FILAS_DE_EJEMPLO = 8;

const ANCHO_TABLA = 272;
const ANCHO_CASO = 88;
/** Lo mínimo que cabe una respuesta en su celda ("Fuertemente" entera); con más columnas, la tabla se desplaza. */
const ANCHO_MINIMO_DE_VALOR = 132;
const MAX_COLUMNAS = 3;

/** El caso se identifica por la llave del estudio cuando el motor la manda; sin llave, por su fila. */
export function conLlaveDelEstudio(ejemplos: readonly EjemploDePrueba[]): boolean {
  return ejemplos.length > 0 && ejemplos.every((ej) => !!ej.id_caso && rotuloDeCaso(ej.id_caso).texto === ej.id_caso);
}

/**
 * Lo que se ve de una batería en un caso: el patrón con su cifra, sobre las
 * preguntas de la batería ("Mucho en 14 de 14", "88 en 19 de 22", "14 de 14
 * vacías"). Sale del resumen que mide el motor, no se recuenta aquí.
 */
export function textoDeBateria(resumen: ResumenDeBateria, leerValor: (codigo: string) => string): string {
  const de = `de ${formatoConteo(resumen.n_items)}`;
  // Con segunda condición: ", y 2 de 1 a 7" (las preguntas del caso que la cumplen).
  const ademas = resumen.ademas && resumen.n_ademas !== undefined ? `, y ${formatoConteo(resumen.n_ademas)} ${resumen.ademas}` : "";
  if (resumen.patron === "vacias") return `${formatoConteo(resumen.n_vacias)} ${de} vacías${ademas}`;
  if (resumen.patron === "codigo") return `Con el código en ${formatoConteo(resumen.n_codigo)} ${de}${ademas}`;
  if (resumen.valor_comun === "") return `${formatoConteo(resumen.n_contadas)} ${de} vacías${ademas}`;
  const valor = resumen.valor_comun === null ? "Distintas" : leerValor(resumen.valor_comun);
  return `${valor} en ${formatoConteo(resumen.n_contadas)} ${de}${ademas}`;
}

/** Las preguntas que van de columna: las de la regla, sin las del filtro, en el orden en que llegan. */
export function columnasDeEjemplos(ejemplos: readonly EjemploDePrueba[]): string[] {
  const vistas: string[] = [];
  for (const ej of ejemplos) {
    for (const v of ej.valores) {
      if (v.papel === "filtro" || vistas.includes(v.variable)) continue;
      vistas.push(v.variable);
    }
  }
  return vistas.slice(0, MAX_COLUMNAS);
}

function TablaDeEjemplos({ prueba, variables }: { prueba: PruebaDeRegla; variables: readonly ExploradorVariable[] }) {
  const porNombre = new Map(variables.map((v) => [v.name, v]));
  // Una batería no cabe en columnas por pregunta: va su resumen por caso.
  const bateria = prueba.ejemplos.some((ej) => ej.bateria);
  // En fechas, lo leído en el caso reemplaza a las columnas por pregunta (el original va dentro).
  const fechas = prueba.ejemplos.some((ej) => ej.fechas);
  // En formato, la respuesta como texto con su motivo reemplaza a la columna de la pregunta.
  const formato = prueba.ejemplos.some((ej) => ej.formato);
  // En una combinación de catálogo, la causa (que nombra lo declarado) y la propuesta.
  const catalogo = prueba.ejemplos.some((ej) => ej.catalogo);
  // En el valor más frecuente por grupo, la causa nombra el valor, su grupo y el peso de la moda.
  const moda = prueba.ejemplos.some((ej) => ej.moda);
  const columnas = bateria || fechas || formato || catalogo || moda ? [] : columnasDeEjemplos(prueba.ejemplos);
  const primeraDeLaBateria = bateria ? prueba.ejemplos.find((ej) => ej.bateria)?.valores[0]?.variable ?? null : null;
  const opcionesDeLaBateria = useOpcionesDeVariables(
    primeraDeLaBateria && tieneOpciones(porNombre.get(primeraDeLaBateria)?.tipo) ? [primeraDeLaBateria] : [],
  );
  const opciones = useOpcionesDeVariables(columnas.filter((c) => tieneOpciones(porNombre.get(c)?.tipo)));
  const ancho = Math.max(ANCHO_MINIMO_DE_VALOR, Math.floor((ANCHO_TABLA - ANCHO_CASO) / Math.max(columnas.length, 1)));
  const conLlave = conLlaveDelEstudio(prueba.ejemplos);
  const definicion: PulsoTableColumna<EjemploDePrueba & { fila: number }>[] = [
    {
      id: "caso",
      encabezado: conLlave ? "Encuesta" : "Caso",
      ancho: ANCHO_CASO,
      celda: (ej) => (
        <code className="pulso-regla-caso" title={ej.id_caso ? rotuloDeCaso(ej.id_caso).titulo : `Fila ${ej.fila}`}>
          {ej.id_caso ? rotuloDeCaso(ej.id_caso).texto : `Fila ${ej.fila}`}
        </code>
      ),
      valor: (ej) => (ej.id_caso ? rotuloDeCaso(ej.id_caso).texto : `Fila ${ej.fila}`),
    },
    ...columnas.map((nombre) => {
      const meta = porNombre.get(nombre);
      const leer = (ej: EjemploDePrueba) => {
        const v = ej.valores.find((x) => x.variable === nombre);
        if (!v || v.valor === null) return { texto: "Vacía", falla: !!v?.falla };
        const lista = opciones.get(nombre);
        // Opción múltiple: los códigos llegan juntos ("1 96"); se leen uno por uno.
        const codigos = meta?.tipo === "sm" ? v.valor.split(/\s+/).filter(Boolean) : [v.valor];
        const textos = codigos.map((c) => {
          const opcion = lista?.find((o) => o.code === c);
          return opcion ? opcion.label || c : c;
        });
        return { texto: textos.join(", "), falla: v.falla };
      };
      return {
        id: nombre,
        encabezado: meta?.label && meta.label !== nombre ? meta.label : nombre,
        ancho,
        tipo: meta?.tipo === "num" ? ("cifra" as const) : ("texto" as const),
        celda: (ej: EjemploDePrueba) => {
          const { texto, falla } = leer(ej);
          return falla ? <b className="pulso-regla-falla">{texto}</b> : texto;
        },
        valor: (ej: EjemploDePrueba) => leer(ej).texto,
      };
    }),
  ];
  if (bateria) {
    const leerValor = (codigo: string) => {
      const opcion = primeraDeLaBateria ? opcionesDeLaBateria.get(primeraDeLaBateria)?.find((o) => o.code === codigo) : undefined;
      return opcion ? opcion.label || codigo : codigo;
    };
    definicion.push({
      id: "bateria",
      encabezado: "En la batería",
      ancho: ANCHO_TABLA - ANCHO_CASO,
      tipo: "texto" as const,
      celda: (ej: EjemploDePrueba) => (ej.bateria ? <b className="pulso-regla-falla">{textoDeBateria(ej.bateria, leerValor)}</b> : "Sin dato"),
      valor: (ej: EjemploDePrueba) => (ej.bateria ? textoDeBateria(ej.bateria, leerValor) : "Sin dato"),
    });
  }
  if (fechas) {
    definicion.push({
      id: "fechas",
      encabezado: "Leído",
      ancho: ANCHO_TABLA - ANCHO_CASO,
      tipo: "texto" as const,
      celda: (ej: EjemploDePrueba) => (ej.fechas ? <b className="pulso-regla-falla">{textoDeFechas(ej.fechas)}</b> : "Sin dato"),
      valor: (ej: EjemploDePrueba) => (ej.fechas ? textoDeFechas(ej.fechas) : "Sin dato"),
    });
  }
  if (formato) {
    definicion.push({
      id: "formato",
      encabezado: "Respuesta",
      ancho: ANCHO_TABLA - ANCHO_CASO,
      tipo: "texto" as const,
      celda: (ej: EjemploDePrueba) => (ej.formato ? <b className="pulso-regla-falla">{textoDeFormato(ej.formato)}</b> : "Sin dato"),
      valor: (ej: EjemploDePrueba) => (ej.formato ? textoDeFormato(ej.formato) : "Sin dato"),
    });
  }
  if (catalogo) {
    definicion.push({
      id: "catalogo",
      encabezado: "Causa",
      ancho: ANCHO_TABLA - ANCHO_CASO,
      tipo: "texto" as const,
      celda: (ej: EjemploDePrueba) => (ej.catalogo ? <CausaDeCatalogo resumen={ej.catalogo} /> : "Sin dato"),
      valor: (ej: EjemploDePrueba) => (ej.catalogo ? textoDeCausaDeCatalogo(ej.catalogo) : "Sin dato"),
    });
  }
  if (moda) {
    definicion.push({
      id: "moda",
      encabezado: "Causa",
      ancho: ANCHO_TABLA - ANCHO_CASO,
      tipo: "texto" as const,
      celda: (ej: EjemploDePrueba) => (ej.moda ? <b className="pulso-regla-falla">{causaDeModa(ej.moda)}</b> : "Sin dato"),
      valor: (ej: EjemploDePrueba) => (ej.moda ? causaDeModa(ej.moda) : "Sin dato"),
    });
  }
  return (
    <PulsoTable
      columnas={definicion}
      filas={prueba.ejemplos.slice(0, MAX_FILAS_DE_EJEMPLO).map((ej, i) => ({ ...ej, fila: i + 1 }))}
      idDeFila={(ej) => `${ej.id_caso ?? ""}-${ej.fila}`}
      ariaLabel="Casos que marca la regla"
      densidad="comoda"
      altoMaximo={MAX_FILAS_DE_EJEMPLO * 60 + 64}
    />
  );
}

/** "Error: Los Olivos no es un distrito de Sullana (Piura). Propuesta: Provincia Lima (Los Olivos está en ese lugar)". */
export function textoDeCausaDeCatalogo(r: ResumenDeCatalogo): string {
  const causa = causaEnTexto(r);
  const propuesta = candidatosEnTexto(r);
  return propuesta ? `${causa}. ${propuesta}` : causa;
}

function CausaDeCatalogo({ resumen }: { resumen: ResumenDeCatalogo }) {
  const propuesta = candidatosEnTexto(resumen);
  return (
    <span className="pulso-regla-catalogo-causa">
      <b className="pulso-regla-falla">{causaEnTexto(resumen)}</b>
      {propuesta ? <small>{propuesta}</small> : null}
    </span>
  );
}

/** Encuestas por estado en una combinación de catálogo, sobre las filas que evalúa la auditoría. */
export function LecturaDeCatalogoDeLaRegla({ lectura }: { lectura: LecturaDeCatalogo | undefined }) {
  if (!lectura) return null;
  return (
    <ul className="pulso-regla-formato-lectura" aria-label="Encuestas revisadas contra el catálogo">
      {textoDeLecturaDeCatalogo(lectura).map((l) => (
        <li key={l}>{l}</li>
      ))}
    </ul>
  );
}

/** Encuestas por estado y grupos sin referencia en el valor más frecuente por grupo, sobre las filas que evalúa la auditoría. */
export function LecturaDeModaDeLaRegla({ lectura }: { lectura: LecturaDeModa | undefined }) {
  if (!lectura) return null;
  return (
    <ul className="pulso-regla-formato-lectura" aria-label="Encuestas comparadas con el valor más frecuente de su grupo">
      {textoDeLecturaDeModa(lectura).map((l) => (
        <li key={l}>{l}</li>
      ))}
    </ul>
  );
}

const ROTULO_DE_MOMENTO: Record<LecturaDeFechas["momento"], string> = { fecha: "Fecha", inicio: "Inicio", fin: "Fin" };

/** Cómo se leyó cada fecha u hora, sobre las filas que evalúa la auditoría (`n_filas`). */
function LecturaDeLaRegla({ lectura }: { lectura: readonly LecturaDeFechas[] }) {
  if (!lectura.length) return null;
  return (
    <ul className="pulso-regla-nota pulso-regla-lectura" aria-label="Cómo se leyeron las respuestas">
      {lectura.map((l) => (
        <li key={l.momento}>
          <b>{ROTULO_DE_MOMENTO[l.momento]}</b>: {textoDeLectura(l)}
        </li>
      ))}
    </ul>
  );
}

/**
 * Lo que pasa y lo que no en una regla de formato, sobre las filas que evalúa
 * la auditoría: las cifras, si la columna llegó como número y las respuestas
 * más frecuentes de cada lado. Son de la base, no inventadas.
 */
export function LecturaDeFormatoDeLaRegla({ lectura }: { lectura: LecturaDeFormato | undefined }) {
  if (!lectura) return null;
  const lineas = textoDeLecturaDeFormato(lectura);
  return (
    <ul className="pulso-regla-formato-lectura" aria-label="Respuestas que pasan y que no pasan">
      {lineas.map((l) => (
        <li key={l}>{l}</li>
      ))}
      {lectura.pasan.length ? (
        <li>
          <b>Pasan</b>: {lectura.pasan.map((x) => `"${x.valor}" (${formatoConteo(x.n)} ${x.n === 1 ? "vez" : "veces"})`).join(", ")}
        </li>
      ) : null}
      {lectura.no_pasan.length ? (
        <li>
          <b>No pasan</b>:{" "}
          {lectura.no_pasan
            .map((x) => {
              const motivo = motivoEnTexto(x.motivo, x.n_digitos);
              return `"${x.valor}" (${motivo ? `${motivo}, ` : ""}${formatoConteo(x.n)} ${x.n === 1 ? "vez" : "veces"})`;
            })
            .join(", ")}
        </li>
      ) : null}
    </ul>
  );
}

/** La base no tiene respuestas: por el estado del conteo o porque el motor dice que aún no hay datos. */
export function conteoSinDatos(estado: EstadoDelConteo): boolean {
  if (estado.fase === "listo") return estado.prueba.estado === "sin_datos";
  return estado.fase === "error" && esEstadoInicial(estado.codigo);
}

export function CasosQueMarca({
  estado,
  onReintentar,
  inconsistencia,
  variables,
  onVerEnExplorar,
}: {
  estado: EstadoDelConteo;
  onReintentar: () => void;
  /** La clase elegida tiñe la cifra y lo resaltado. */
  inconsistencia: boolean;
  variables: readonly ExploradorVariable[];
  /** La pregunta revisada, en Explorar. `null` si la regla no tiene una. */
  onVerEnExplorar: (() => void) | null;
}) {
  const prueba = estado.fase === "listo" ? estado.prueba : null;
  const sinDatos = conteoSinDatos(estado);
  let cuerpo;
  let pie = null;

  if (estado.fase === "sin-regla") {
    cuerpo = <EstadoVacio tamano="compacto" icono={<Inbox size={20} />} titulo="Sin conteo todavía" descripcion="Se cuenta cuando la regla esté completa." />;
  } else if (estado.fase === "contando") {
    // La carga de bloque del kit retiene la readiness de la pestaña mientras cuenta
    // (readinessAnidada): la pestaña no se da por lista con el panel a medio cargar.
    cuerpo = <CargaDeBloque label="Contando los casos" />;
  } else if (sinDatos) {
    cuerpo = (
      <EstadoVacio
        icono={<Inbox size={20} />}
        titulo="La base todavía no tiene respuestas"
        descripcion="La regla se guarda y empieza a contar cuando cargues la base."
      />
    );
  } else if (estado.fase === "error") {
    const { titulo, causa } = errorDelConteo(estado.codigo, estado.mensaje);
    cuerpo = (
      <ErrorBlock
        label={titulo}
        causa={causa}
        acciones={
          <PulsoButton variant="secondary" size="sm" onClick={onReintentar}>
            Reintentar
          </PulsoButton>
        }
      />
    );
  } else if (prueba && prueba.estado !== "evaluada") {
    const sinEvaluar = SIN_EVALUAR[prueba.estado as keyof typeof SIN_EVALUAR];
    cuerpo = <EstadoVacio tamano="compacto" icono={<AlertTriangle size={20} />} titulo={sinEvaluar.titulo} descripcion={sinEvaluar.causa} />;
  } else if (prueba) {
    const nCasos = prueba.n_casos ?? 0;
    const nBase = prueba.n_base ?? 0;
    const base = `de ${formatoConteo(nBase)} ${nBase === 1 ? "caso" : "casos"}${prueba.filtro_previo ? " que cumplen el filtro" : ""}`;
    const aLaVista = Math.min(prueba.ejemplos.length, MAX_FILAS_DE_EJEMPLO);
    const recortados = aLaVista < nCasos;
    cuerpo = (
      <>
        <CifraHallazgo
          className="pulso-regla-cifra"
          cifra={nCasos}
          base={base}
          proporcion={prueba.proporcion ?? 0}
          detalle={prueba.proporcion === null ? "" : undefined}
          tono={inconsistencia ? "inconsistencia" : "aviso"}
        />
        <LecturaDeLaRegla lectura={prueba.lectura ?? []} />
        <LecturaDeFormatoDeLaRegla lectura={prueba.formato} />
        <LecturaDeCatalogoDeLaRegla lectura={prueba.catalogo} />
        <LecturaDeModaDeLaRegla lectura={prueba.moda} />
        {nCasos > 0 && prueba.ejemplos.length > 0 ? (
          <TablaDeEjemplos prueba={prueba} variables={variables} />
        ) : (
          <EstadoVacio tamano="compacto" icono={<Inbox size={20} />} titulo="Ningún caso cumple la regla" descripcion="Se contó sobre la base cargada." />
        )}
        {recortados ? (
          <p className="pulso-regla-nota">
            Se muestran {formatoConteo(aLaVista)} de {formatoConteo(nCasos)} casos.
          </p>
        ) : null}
      </>
    );
    pie = (
      <div className="pulso-regla-casos-pie">
        <p className="pulso-regla-nota">Contados en la base cargada, antes de la limpieza.</p>
        {onVerEnExplorar ? (
          <PulsoButton variant="secondary" size="lg" className="pulso-regla-ancho" onClick={onVerEnExplorar}>
            <Compass size={14} aria-hidden="true" />
            Ver en Explorar
          </PulsoButton>
        ) : null}
      </div>
    );
  }

  return (
    <Panel
      noPadding
      className="pulso-regla-caja pulso-regla-casos"
      data-tono={inconsistencia ? "inconsistencia" : "aviso"}
      aria-label={sinDatos ? "Casos que marca" : "Casos que marca hoy"}
      title={sinDatos ? "Casos que marca" : "Casos que marca hoy"}
    >
      <div className="pulso-regla-casos-cuerpo" data-qa-geometry-capacity="owned" aria-live="polite">
        {cuerpo}
      </div>
      {pie}
    </Panel>
  );
}
