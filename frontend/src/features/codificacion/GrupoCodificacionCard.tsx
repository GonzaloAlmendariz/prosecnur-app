import { useMemo, useState, type CSSProperties } from "react";
import { useDroppable } from "@dnd-kit/core";
import type { Grupo } from "../../api/client";
import { PulsoButton } from "../../components/PulsoButton";
import { PulsoInput } from "../../components/PulsoInput";
import { formatoConteo } from "../../lib/formatoNumero";
import { enumerar } from "../../lib/enumerar";
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2, X } from "../../vendor/lucide-react";
import { zonaDeCodigo } from "./codificar/asignacionEnLote";
import { cifrasDeTarjeta, type AvisoDelLote, type RespuestaParecida, type TarjetaDeCodigo } from "./codificar/modeloDeCodificar";

export type GrupoCodificacionCardProps = {
  tarjeta: TarjetaDeCodigo;
  /** Casos con texto de la pregunta: la base de la barra de proporción del código. */
  casosConTexto: number;
  /** Se está arrastrando un lote de respuestas: la tarjeta se ofrece como destino. */
  esDestino: boolean;
  /** Las personas del lote elegido o arrastrado que ya tenían marcada esta opción. */
  aviso?: AvisoDelLote | null;
  esPrimero: boolean;
  esUltimo: boolean;
  /** Se calcula al pedirlas: comparar textos cuesta y solo hace falta en la tarjeta que las abre. */
  buscarParecidas: () => RespuestaParecida[];
  onCambiar: (cambio: Partial<Grupo>) => void;
  onEliminar: () => void;
  onSubir: () => void;
  onBajar: () => void;
  onQuitarRespuesta: (clave: string) => void;
  onAgregarRespuesta: (clave: string) => void;
};

/** Cuántos textos del código se nombran como ejemplo bajo su barra. */
const EJEMPLOS = 4;

/**
 * La tarjeta de un código (`pp-codigo` del prototipo): la tesela con su número, su nombre y sus casos;
 * la barra de su proporción (casos del código sobre los casos con texto de la pregunta); dos renglones
 * de ejemplos y la tecla que lo asigna. Es donde se sueltan las respuestas que se arrastran.
 *
 * Un código del formulario muestra su número y su nombre fijos; uno creado aquí los deja editar y se
 * puede eliminar. Bajo la tarjeta, sin ocupar su marco, van el orden, "Respuestas" (las que lleva, para
 * quitarlas) y "Parecidas" (respuestas sin código que se le parecen). Respuestas y casos cuentan solo
 * los textos que la base trae hoy; los guardados que ya no trae se dicen aparte.
 */
export function GrupoCodificacionCard({
  tarjeta,
  casosConTexto,
  esDestino,
  aviso,
  esPrimero,
  esUltimo,
  buscarParecidas,
  onCambiar,
  onEliminar,
  onSubir,
  onBajar,
  onQuitarRespuesta,
  onAgregarRespuesta,
}: GrupoCodificacionCardProps) {
  const { grupo, codigo, respuestas } = tarjeta;
  const zona = useDroppable({ id: zonaDeCodigo(grupo.id) });
  const [abierto, setAbierto] = useState<"respuestas" | "parecidas" | null>(null);
  // Un código creado aquí se lee como los del formulario; su número y su nombre se editan a pedido. Sin
  // nombre todavía, abre editándose.
  const [editando, setEditando] = useState(() => grupo.origen !== "existente" && !grupo.etiqueta.trim());
  // Solo con el panel abierto: cada asignación cambia los grupos y obligaría a comparar todos los textos.
  const parecidas = useMemo(() => (abierto === "parecidas" ? buscarParecidas() : []), [abierto, buscarParecidas]);

  const delFormulario = grupo.origen === "existente";
  const vacia = respuestas.length === 0;
  const cifras = cifrasDeTarjeta(tarjeta);
  const ejemplos = respuestas.filter((r) => r.enBase).slice(0, EJEMPLOS).map((r) => r.texto);
  const estilo = {
    "--cv2-chip-accent": codigo.acento,
    "--cc-proporcion": String(casosConTexto > 0 ? Math.min(cifras.casos / casosConTexto, 1) : 0),
  } as CSSProperties;
  const detalleCifras = `${formatoConteo(cifras.casos)} ${cifras.casos === 1 ? "caso" : "casos"}, ${formatoConteo(cifras.respuestas)} ${cifras.respuestas === 1 ? "respuesta" : "respuestas"}`;
  const alternar = (panel: "respuestas" | "parecidas") => setAbierto((actual) => (actual === panel ? null : panel));

  return (
    <div className="pulso-cc-codigo-celda">
      <article
        ref={zona.setNodeRef}
        className="pulso-cv2-grupo pulso-cc-codigo"
        style={estilo}
        aria-label={`Código ${codigo.rotulo}, ${detalleCifras}`}
        data-destino={esDestino ? "" : undefined}
        data-sobre={esDestino && zona.isOver ? "" : undefined}
        data-vacio={vacia ? "" : undefined}
      >
        <header className="pulso-cc-codigo-cab">
          {delFormulario || !editando ? (
            <>
              {codigo.numero ? (
                <span className="pulso-ct-numero pulso-cc-codigo-ficha" title={delFormulario ? "Categoría que ya trae la pregunta" : "Código creado en Codificación"}>{codigo.numero}</span>
              ) : null}
              <h4 className="pulso-cc-codigo-titulo" title={codigo.rotulo}>{codigo.nombre}</h4>
            </>
          ) : (
            <>
              <PulsoInput
                size="sm"
                className="pulso-cc-codigo-numero"
                value={grupo.codigo}
                onChange={(evento) => onCambiar({ codigo: evento.target.value })}
                aria-label="Número del código"
                title="Código creado en Codificación"
                inputMode="numeric"
              />
              <PulsoInput
                size="sm"
                className="pulso-cc-codigo-nombre"
                value={grupo.etiqueta}
                onChange={(evento) => onCambiar({ etiqueta: evento.target.value })}
                placeholder="Nombre del código"
                aria-label={`Nombre del código ${grupo.codigo}`}
              />
            </>
          )}
          <strong className="pulso-cc-codigo-casos" title={detalleCifras}>{formatoConteo(cifras.casos)}</strong>
        </header>

        {/* La proporción del código: la cifra está en la cabecera, la barra no la repite. */}
        <span className="pulso-cc-codigo-proporcion" aria-hidden="true">
          <span />
        </span>

        <p className="pulso-cc-codigo-ejemplos" title={ejemplos.length ? enumerar(ejemplos) : undefined}>
          {ejemplos.length ? ejemplos.join(", ") : <span className="pulso-cc-codigo-sin">Sin respuestas</span>}
        </p>

        {cifras.fueraDeLaBase > 0 ? (
          <p className="pulso-cc-codigo-fuera">
            {cifras.fueraDeLaBase === 1
              ? "1 texto guardado no está en la base actual"
              : `${formatoConteo(cifras.fueraDeLaBase)} textos guardados no están en la base actual`}
          </p>
        ) : null}

        {aviso ? (
          <p className={`pulso-cc-codigo-marcada${aviso.todas ? " is-todas" : ""}`} title={aviso.detalle}>
            {aviso.frase}
          </p>
        ) : null}

        <footer className="pulso-cc-codigo-pie">
          {vacia ? null : (
            <span className="pulso-cc-codigo-enlaces">
              <PulsoButton variant="link" size="sm" aria-expanded={abierto === "respuestas"} onClick={() => alternar("respuestas")}>
                Respuestas
              </PulsoButton>
              <PulsoButton variant="link" size="sm" aria-expanded={abierto === "parecidas"} onClick={() => alternar("parecidas")}>
                Parecidas
              </PulsoButton>
            </span>
          )}
          <span className="pulso-cc-codigo-acciones">
            {delFormulario ? null : (
              <PulsoButton
                variant="icon"
                size="sm"
                aria-pressed={editando}
                onClick={() => setEditando((v) => !v)}
                aria-label={editando ? `Terminar de editar el código ${codigo.rotulo}` : `Editar el número y el nombre del código ${codigo.rotulo}`}
                title={editando ? "Terminar de editar" : "Editar número y nombre"}
              >
                <Pencil aria-hidden="true" />
              </PulsoButton>
            )}
            <PulsoButton variant="icon" size="sm" disabled={esPrimero} onClick={onSubir} aria-label={`Subir el código ${codigo.rotulo}`} title="Subir en el orden del archivo de salida">
              <ArrowUp aria-hidden="true" />
            </PulsoButton>
            <PulsoButton variant="icon" size="sm" disabled={esUltimo} onClick={onBajar} aria-label={`Bajar el código ${codigo.rotulo}`} title="Bajar en el orden del archivo de salida">
              <ArrowDown aria-hidden="true" />
            </PulsoButton>
            {delFormulario ? null : (
              <PulsoButton variant="icon" size="sm" intent="remove" onClick={onEliminar} aria-label={`Eliminar el código ${codigo.rotulo}`} title="Eliminar el código">
                <Trash2 aria-hidden="true" />
              </PulsoButton>
            )}
            {codigo.numero ? (
              <kbd className="pulso-cc-codigo-tecla" title={`Tecla ${codigo.numero}: asigna las respuestas elegidas a este código`}>{codigo.numero}</kbd>
            ) : null}
          </span>
        </footer>
      </article>

      {abierto === "respuestas" && !vacia ? (
        // C1: una línea por respuesta; cada una mide lo que su texto.
        <ul className="pulso-cc-codigo-respuestas" aria-label={`Respuestas del código ${codigo.rotulo}`} data-qa-geometry-group="codificacion/codigo-respuestas" data-qa-geometry-contract="intrinsic">
          {respuestas.map((r) => (
            <li key={r.clave} data-fuera-de-la-base={r.enBase ? undefined : ""}>
              <span className="pulso-cc-codigo-texto" title={r.enBase ? r.titulo : `${r.titulo} (no está en la base actual)`}>{r.texto}</span>
              {r.veces > 0 ? <span className="pulso-cc-codigo-veces">×{formatoConteo(r.veces)}</span> : null}
              <PulsoButton
                variant="icon"
                size="sm"
                intent="remove"
                onClick={() => onQuitarRespuesta(r.clave)}
                aria-label={`Quitar "${r.texto}" del código ${codigo.rotulo}`}
                title="Quitar del código"
              >
                <X aria-hidden="true" />
              </PulsoButton>
            </li>
          ))}
        </ul>
      ) : null}

      {abierto === "parecidas" && !vacia ? (
        parecidas.length === 0 ? (
          <p className="pulso-cc-codigo-nota">Ninguna respuesta sin código se parece a estas.</p>
        ) : (
          // C1: una propuesta por línea; el punteado es de lo que se puede agregar.
          <ul className="pulso-cc-codigo-parecidas" aria-label={`Respuestas parecidas al código ${codigo.rotulo}`} data-qa-geometry-group="codificacion/codigo-parecidas" data-qa-geometry-contract="intrinsic">
            {parecidas.map((p) => (
              <li key={p.clave}>
                <button
                  type="button"
                  className="pulso-cc-codigo-parecida"
                  onClick={() => onAgregarRespuesta(p.clave)}
                  aria-label={`Asignar "${p.texto}" al código ${codigo.rotulo}`}
                  title={p.titulo}
                >
                  <Plus size={12} aria-hidden="true" />
                  <span className="pulso-cc-codigo-texto">{p.texto}</span>
                  {p.veces > 0 ? <span className="pulso-cc-codigo-veces">×{formatoConteo(p.veces)}</span> : null}
                  <span className="pulso-cc-codigo-parecido">{Math.round(p.parecido * 100)} %</span>
                </button>
              </li>
            ))}
          </ul>
        )
      ) : null}
    </div>
  );
}
