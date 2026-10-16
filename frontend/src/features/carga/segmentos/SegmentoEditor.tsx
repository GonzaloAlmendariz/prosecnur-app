// Editor de un segmento de cruce (ADR 0107): etiqueta y nombre estándar, la
// escala estándar y, por base, de dónde sale. Mismas secciones, campos y pie
// que «Variables de la base» y la armonización de una fila. La lógica
// (borrador, validación, cuerpo del POST) vive en `segmentosModel`.

import { useId, useMemo, useReducer, useState } from "react";
import type { BaseVariables } from "../../../api/baseVariables";
import type { VariableDeBase } from "../../../api/equivalencias";
import type { Segmento, SegmentoADeclarar } from "../../../api/segmentos";
import { PulsoButton } from "../../../components/PulsoButton";
import { Copy, Plus, Save, Trash2, Wand2, X } from "../../../vendor/lucide-react";
import { etiquetaLegible } from "../preguntaEquivalenteModel";
import { observadosListos, useCodigosObservadosPorBase } from "../useCodigosObservados";
import { BuscadorPreguntas } from "../variablesBase/SelectorPreguntas";
import { SegmentoEnBase } from "./SegmentoEnBase";
import {
  PREFIJO_SEGMENTO,
  atajosPartirDe,
  borradorDesde,
  codigosDeEntrada,
  escalaDeBorrador,
  mapasPorEtiqueta,
  opcionesDeOrigen,
  reducirSegmento,
  segmentoParaGuardar,
  textoEmparejarTodas,
  validarSegmento,
  type AtajoPartirDe,
  type CodigoDeOrigen,
} from "./segmentosModel";
import type { CatalogoSegmentos } from "./useSegmentos";

export type SegmentoEditorProps = {
  inicial: Segmento | null;
  bases: readonly string[];
  catalogo: CatalogoSegmentos;
  propias: Readonly<Record<string, BaseVariables>>;
  /** Nombres `cruce_*` de los segmentos del estudio: no se ofrecen como origen. */
  nombresSegmentos: readonly string[];
  /** Claves de los otros segmentos. */
  claves: readonly string[];
  guardando: boolean;
  error: string;
  onGuardar: (cuerpo: SegmentoADeclarar) => Promise<boolean>;
  onCancelar: () => void;
};

function anclaDeBase(id: string, base: string): string {
  return `${id}-base-${base.replace(/[^A-Za-z0-9_-]/g, "_")}`;
}

export function SegmentoEditor({
  inicial,
  bases,
  catalogo,
  propias,
  nombresSegmentos,
  claves,
  guardando,
  error,
  onGuardar,
  onCancelar,
}: SegmentoEditorProps) {
  const id = useId();
  const [b, despachar] = useReducer(reducirSegmento, inicial, (s) => borradorDesde(s, bases));
  const [intento, setIntento] = useState(false);
  const [partirDe, setPartirDe] = useState<string | null>(null);
  const escala = escalaDeBorrador(b);
  const errores = validarSegmento(b, bases, claves);

  const opcionesPorBase = useMemo(() => {
    const out: Record<string, VariableDeBase[] | null> = {};
    for (const base of bases) {
      out[base] = catalogo.tipo === "listo"
        ? opcionesDeOrigen(catalogo.variables[base] ?? [], propias[base], nombresSegmentos)
        : catalogo.tipo === "error" ? [] : null;
    }
    return out;
  }, [bases, catalogo, propias, nombresSegmentos]);

  // Los valores de cada origen se leen aquí, para todas las bases: cada sección
  // los pinta y el editor los usa en «Emparejar todas» y en los atajos de «Partir de…».
  const origenes = useMemo(
    () => Object.fromEntries(bases.map((base) => [base, b.porBase[base]?.origen ?? ""])),
    [bases, b.porBase],
  );
  const lecturas = useCodigosObservadosPorBase(origenes);
  const codigosPorBase: Record<string, CodigoDeOrigen[]> = {};
  for (const base of bases) {
    const entrada = b.porBase[base];
    if (!entrada?.origen) continue;
    const obs = observadosListos(lecturas[base]);
    // Una variable de texto no tiene códigos que emparejar ni copiar.
    if (obs?.tipo === "texto") continue;
    codigosPorBase[base] = codigosDeEntrada(opcionesPorBase[base] ?? null, entrada, inicial?.por_base[base], obs);
  }
  const emparejar = mapasPorEtiqueta(b, codigosPorBase, escala);
  const atajos = atajosPartirDe(bases, b.porBase, opcionesPorBase, codigosPorBase, etiquetaLegible);

  const partirDeAtajo = (a: AtajoPartirDe) => {
    despachar({ tipo: "partir-de", opciones: a.opciones, base: a.base, variable: a.variable });
    setPartirDe(null);
  };

  const guardar = async () => {
    setIntento(true);
    if (errores.length) return;
    await onGuardar(segmentoParaGuardar(b, bases));
  };

  const baseDePartida = partirDe ?? "";
  const conLista = (opcionesPorBase[baseDePartida] ?? []).filter((o) => (o.opciones?.length ?? 0) > 0);

  return (
    <div
      className="pulso-vb pulso-seg-editor"
      role="group"
      aria-labelledby={`${id}-titulo`}
      data-qa-geometry-group="carga/segmentos"
      data-qa-geometry-contract="intrinsic"
    >
      <section className="pulso-armon-seccion" aria-labelledby={`${id}-titulo`} data-qa-geometry-member>
        <div className="pulso-armon-seccion-head">
          <div className="pulso-armon-seccion-titulo">
            <h3 id={`${id}-titulo`}>{inicial ? `Editar «${inicial.nombre}»` : "Nuevo segmento"}</h3>
            <p className="pulso-armon-ayuda">Se llama igual y usa la misma escala en todas las bases.</p>
          </div>
        </div>
        <div className="pulso-vb-campos">
          <label className="pulso-compuesto-campo">
            <span>Etiqueta</span>
            <input
              value={b.etiqueta}
              placeholder="Edad, Sexo, Facultad…"
              onChange={(e) => despachar({ tipo: "etiqueta", valor: e.target.value })}
            />
          </label>
          <label className="pulso-compuesto-campo">
            <span>Nombre en todas las bases</span>
            <span className="pulso-seg-nombre">
              <span className="pulso-seg-prefijo" aria-hidden="true">{PREFIJO_SEGMENTO}</span>
              <input
                className="pulso-vb-mono"
                value={b.clave}
                placeholder="Se propone desde la etiqueta"
                aria-describedby={`${id}-nombre`}
                disabled={b.editando}
                spellCheck={false}
                autoComplete="off"
                onChange={(e) => despachar({ tipo: "clave", valor: e.target.value })}
              />
            </span>
            <span id={`${id}-nombre`} className="pulso-sr-only">Lleva delante «{PREFIJO_SEGMENTO}».</span>
          </label>
        </div>
      </section>

      <section className="pulso-armon-seccion" aria-labelledby={`${id}-escala`} data-qa-geometry-member>
        <div className="pulso-armon-seccion-head">
          <div className="pulso-armon-seccion-titulo">
            <h3 id={`${id}-escala`}>
              Escala estándar
              {escala.length > 0 && <small>{escala.length}</small>}
            </h3>
            <p className="pulso-armon-ayuda">Las categorías en que se lee el segmento en todas las bases.</p>
          </div>
          <span className="pulso-vb-subtitulo-acciones">
            {emparejar.codigos > 0 && (
              <PulsoButton
                variant="secondary"
                size="sm"
                className="pulso-armon-btn"
                title={textoEmparejarTodas(emparejar)}
                onClick={() => despachar({ tipo: "aplicar-mapas", mapas: emparejar.mapas })}
              >
                <Wand2 size={13} aria-hidden="true" />
                Emparejar todas por etiqueta
              </PulsoButton>
            )}
            <PulsoButton
              variant="ghost"
              size="sm"
              className="pulso-armon-btn"
              aria-expanded={partirDe !== null}
              onClick={() => setPartirDe(partirDe === null ? bases[0] ?? "" : null)}
            >
              <Copy size={13} aria-hidden="true" />
              Partir de las opciones de…
            </PulsoButton>
            <PulsoButton variant="secondary" size="sm" className="pulso-armon-btn" onClick={() => despachar({ tipo: "categoria-agregar" })}>
              <Plus size={13} aria-hidden="true" />
              Agregar categoría
            </PulsoButton>
          </span>
        </div>

        {partirDe !== null && (
          <div className="pulso-seg-partir" role="group" aria-label="Partir de las opciones de una variable">
            {atajos.length > 0 && (
              <fieldset className="pulso-seg-atajos">
                <legend>Orígenes ya elegidos</legend>
                <div className="pulso-seg-atajos-lista">
                  {atajos.map((a) => (
                    <PulsoButton
                      key={a.base}
                      variant="secondary"
                      size="sm"
                      className="pulso-armon-btn"
                      title={`Copiar las opciones de ${a.variable} en ${a.base}`}
                      onClick={() => partirDeAtajo(a)}
                    >
                      {a.rotulo}
                    </PulsoButton>
                  ))}
                </div>
              </fieldset>
            )}
            {atajos.length > 0 && <p className="pulso-seg-partir-otra">U otra variable:</p>}
            <div className="pulso-seg-partir-cabeza">
              <label className="pulso-compuesto-campo pulso-seg-partir-base">
                <span>Base</span>
                <select value={baseDePartida} onChange={(e) => setPartirDe(e.target.value)}>
                  {bases.map((base) => <option key={base} value={base}>{base}</option>)}
                </select>
              </label>
              <button type="button" className="pulso-icon" aria-label="Cerrar «Partir de las opciones de…»" onClick={() => setPartirDe(null)}>
                <X size={13} aria-hidden="true" />
              </button>
            </div>
            {opcionesPorBase[baseDePartida] === null ? (
              <p className="pulso-armon-nota" role="status">Leyendo las variables de {baseDePartida}…</p>
            ) : conLista.length === 0 ? (
              <p className="pulso-armon-nota">{baseDePartida} no tiene variables con lista de respuestas.</p>
            ) : (
              <BuscadorPreguntas
                opciones={conLista}
                elegidas={[]}
                etiqueta={`Buscar la variable de ${baseDePartida} cuyas opciones se copian`}
                onElegir={(nombre) => {
                  const v = conLista.find((o) => o.name === nombre);
                  if (!v) return;
                  despachar({
                    tipo: "partir-de",
                    opciones: (v.opciones ?? []).map((o) => ({ codigo: o.codigo, etiqueta: etiquetaLegible(o.etiqueta) || o.codigo })),
                    base: baseDePartida,
                    variable: v.name,
                  });
                  setPartirDe(null);
                }}
              />
            )}
          </div>
        )}

        {b.escala.length === 0 ? (
          // C3: el vacío es de la escala y dice cómo se llena.
          <p className="pulso-armon-vacio">Agrega las categorías o parte de las opciones de una variable.</p>
        ) : (
          <ol className="pulso-armon-escala">
            {b.escala.map((c, i) => (
              <li key={c.clave}>
                <span className="pulso-armon-escala-pos" aria-hidden="true">{i + 1}</span>
                <input
                  value={c.codigo}
                  aria-label={`Código de la categoría ${i + 1}`}
                  onChange={(e) => despachar({ tipo: "categoria-codigo", clave: c.clave, valor: e.target.value })}
                />
                <input
                  value={c.etiqueta}
                  placeholder="Etiqueta"
                  aria-label={`Etiqueta de la categoría ${i + 1}`}
                  onChange={(e) => despachar({ tipo: "categoria-etiqueta", clave: c.clave, valor: e.target.value })}
                />
                <button
                  type="button"
                  className="pulso-icon pulso-icon-danger"
                  aria-label={`Quitar la categoría ${c.etiqueta || c.codigo || i + 1}`}
                  onClick={() => despachar({ tipo: "categoria-quitar", clave: c.clave })}
                >
                  <Trash2 size={13} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ol>
        )}
      </section>

      {bases.map((base) => (
        <SegmentoEnBase
          key={base}
          base={base}
          anclaId={anclaDeBase(id, base)}
          opciones={opcionesPorBase[base] ?? null}
          catalogoError={catalogo.tipo === "error"}
          entrada={b.porBase[base] ?? { origen: "", mapa: {}, marcados: [] }}
          guardado={inicial?.por_base[base]}
          escala={escala}
          despachar={despachar}
          lectura={lecturas[base] ?? { tipo: "inactivo" }}
        />
      ))}

      <div className="pulso-vb-editor-pie pulso-seg-pie">
        <span className="pulso-vb-editor-estado" aria-live="polite">
          {error ? (
            <span className="pulso-armon-error" role="alert">{error}</span>
          ) : intento && errores.length ? (
            <span className="pulso-armon-error">{errores[0]}</span>
          ) : null}
        </span>
        <PulsoButton variant="secondary" size="sm" className="pulso-armon-btn" onClick={onCancelar}>
          Cancelar
        </PulsoButton>
        <PulsoButton
          variant="primary"
          size="sm"
          className="pulso-armon-btn"
          disabled={guardando || (intento && errores.length > 0)}
          onClick={() => void guardar()}
        >
          <Save size={14} aria-hidden="true" />
          {guardando ? "Guardando…" : "Guardar segmento"}
        </PulsoButton>
      </div>
    </div>
  );
}
