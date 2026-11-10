// Territorial › Catálogo › Códigos / Hoja de ruteo / Hoja de consolidados, y las
// mismas hojas para todas las UMP en Paquetes (checklist-formatos-campo D1). Es el
// juego de papel que campo ya usa: la app lo entrega con la cabecera llena y con los
// códigos de resultado del estudio (`collection_territorial_formatos.R`,
// `collection_territorial_papel.R`).
//
// Contrato de Superficie: cada pieza es una tarjeta con título (C1) que contiene su
// propio vacío y su error (C3); el scroll es del panel de la sección (C4).
//
// Los PDF se entregan por el kit de entregables (ADR 0133): el botón sólo se
// deshabilita y el contenedor (bloque) queda bajo las acciones de la tarjeta.

import { useCallback, useEffect, useState } from "react";

import {
  apiMaterialTerritorialFormatos,
  apiMaterialTerritorialGuardarFormatos,
  apiMaterialTerritorialPapel,
  type CambioDeFormatos,
  type FormatosTerritoriales,
  type PiezaDePapel,
  type UnidadesTerritoriales,
} from "../../../api/materialTerritorial";
import { ContenedorEntregable } from "../../../components/entregables/ContenedorEntregable";
import { useGeneracion } from "../../../components/entregables/useGeneracion";
import { GlidingRadioGroup } from "../../../components/GlidingRadioGroup";
import { PulsoButton } from "../../../components/PulsoButton";
import { PulsoInput } from "../../../components/PulsoInput";
import { PulsoSelect } from "../../../components/PulsoSelect";
import { PulsoSwitch } from "../../../components/PulsoSwitch";
import { Hash, ListOrdered, Printer, Table2 } from "../../../vendor/lucide-react";
import { CargaDeBloque } from "../../../components/CargaDeBloque";
import { MaquetaDeConsolidados, MaquetaDeRuteo } from "./MaquetaDeHoja";
import { MODULO_MATERIAL } from "../entregas/modeloEntrega";
import "./ficha.css";
import { Panel } from "../../../components/Panel";

const ROTULO_MAX = 60;
const CRITERIO_MAX = 40;
const CARAS = [[1, "Una cara"], [2, "Doble cara"]] as const;

function mensaje(e: unknown, porDefecto: string): string {
  return e instanceof Error ? e.message.replace(/ · E_[A-Z_]+$/, "") : porDefecto;
}

/** Los códigos del estudio: se leen al entrar y se guardan con la revisión leída. */
function useFormatos(campaignId: string) {
  const [formatos, setFormatos] = useState<FormatosTerritoriales | null>(null);
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);
  useEffect(() => {
    let vivo = true;
    apiMaterialTerritorialFormatos(campaignId)
      .then((f) => { if (vivo) setFormatos(f); })
      .catch((e: unknown) => { if (vivo) setError(mensaje(e, "No se pudieron leer los códigos.")); });
    return () => { vivo = false; };
  }, [campaignId]);
  const guardar = useCallback(async (cambio: CambioDeFormatos) => {
    if (!formatos) return false;
    setGuardando(true);
    setError("");
    try {
      setFormatos(await apiMaterialTerritorialGuardarFormatos(campaignId, cambio, formatos.revision));
      return true;
    } catch (e: unknown) {
      setError(mensaje(e, "No se pudieron guardar los códigos."));
      return false;
    } finally {
      setGuardando(false);
    }
  }, [campaignId, formatos]);
  return { formatos, error, guardando, guardar };
}

type ConCampana = { campaignId: string; unidades: UnidadesTerritoriales };

export function CodigosDeResultado({ campaignId }: { campaignId: string }) {
  const { formatos, error, guardando, guardar } = useFormatos(campaignId);
  const [rotulos, setRotulos] = useState<Record<string, string>>({});
  const [con99, setCon99] = useState(true);
  const [criterio, setCriterio] = useState("");
  useEffect(() => {
    if (!formatos) return;
    setRotulos({ ...formatos.rotulos });
    setCon99(formatos.con_99);
    setCriterio(formatos.columna_criterio);
  }, [formatos]);

  if (!formatos) {
    return (
      <article className="rec-terr-tarjeta" data-qa-geometry-member>
        <h3><Hash size={15} aria-hidden /> Códigos de resultado</h3>
        {error ? <p className="rec-terr-error" role="alert">{error}</p> : <CargaDeBloque label="Leyendo los códigos…" />}
      </article>
    );
  }
  const original = formatos.rotulos;
  const cambiados = Object.fromEntries(Object.entries(rotulos).filter(([k, v]) => v.trim() !== (original[k] ?? "")));
  // El 99 apagado no se imprime: su rótulo vacío no bloquea el guardado.
  const vacio = Object.entries(rotulos).some(([k, v]) => !v.trim() && !(k === "99" && !con99));
  const sucio = Object.keys(cambiados).length > 0 || con99 !== formatos.con_99 || criterio.trim() !== formatos.columna_criterio;
  // El 99 apagado no sale en el catálogo leído: se pinta con su rótulo guardado para poder volver a prenderlo.
  const delPlanner = formatos.origen_codigos === "planner";
  const filas = delPlanner || formatos.codigos.some((c) => c.codigo === "99") ? formatos.codigos : [...formatos.codigos, { codigo: "99", rotulo: rotulos["99"] ?? "", grupo: "manzana" as const, editable: true }];

  return (
    <article className="rec-terr-tarjeta" data-qa-geometry-member>
      <h3><Hash size={15} aria-hidden /> Códigos de resultado</h3>
      <p className="rec-terr-nota">
        El código con el que campo anota cada visita en la hoja de ruteo. Qué significa cada número es igual en todos los estudios (el 8
        es la efectiva); los rótulos se ajustan al papel del estudio.{delPlanner ? " Vienen de lo que el estudio declaró en el Planner; al guardar quedan en Material, que es su dueño." : ""}
      </p>
      <ul className="rec-terr-codigos" aria-label="Códigos de resultado del estudio">
        {filas.map((c) => (
          <li key={c.codigo} className={c.grupo === "efectiva" ? "es-efectiva" : undefined}>
            <span className="rec-terr-codigo" aria-hidden>{c.codigo}</span>
            {c.editable ? (
              <PulsoInput
                size="sm"
                aria-label={`Rótulo del código ${c.codigo}`}
                maxLength={ROTULO_MAX}
                value={rotulos[c.codigo] ?? ""}
                disabled={guardando || (c.codigo === "99" && !con99)}
                onChange={(ev) => setRotulos((r) => ({ ...r, [c.codigo]: ev.target.value }))}
              />
            ) : <span className="rec-terr-codigo-rotulo">{c.rotulo}</span>}
            {c.codigo === "99" && !delPlanner ? (
              <PulsoSwitch size="sm" ariaLabel="Usar el código 99" checked={con99} disabled={guardando} onCheckedChange={setCon99} />
            ) : null}
          </li>
        ))}
      </ul>
      <div className="rec-terr-campo rec-terr-criterio">
        <span aria-hidden>Criterio de elegibilidad</span>
        <PulsoInput
          size="sm"
          aria-label="Columna del criterio de elegibilidad"
          maxLength={CRITERIO_MAX}
          placeholder="Sin criterio"
          value={criterio}
          disabled={guardando}
          onChange={(ev) => setCriterio(ev.target.value)}
        />
        <small className="rec-terr-nota">
          Si el estudio filtra a quién se entrevista (por ejemplo, "Cursa estudios sup."), va como columna en la hoja de ruteo y en la de
          consolidados. Vacío, no sale.
        </small>
      </div>
      {formatos.extras_ruteo_disponibles.length ? (
        <div className="rec-terr-campo rec-terr-criterio">
          <span aria-hidden>Columnas de la hoja de ruteo</span>
          {formatos.extras_ruteo_disponibles.map((x) => (
            <PulsoSwitch
              key={x.id}
              size="sm"
              label={x.rotulo}
              checked={formatos.extras_ruteo.includes(x.id)}
              disabled={guardando}
              onCheckedChange={(v) => void guardar({
                extras_ruteo: v ? [...formatos.extras_ruteo, x.id] : formatos.extras_ruteo.filter((e) => e !== x.id),
              })}
            />
          ))}
          <small className="rec-terr-nota">Mz. y N.º de encuesta las usa la hoja de seguimiento de ACNUR. Se guardan al elegir.</small>
        </div>
      ) : null}
      {formatos.extras_disponibles.length ? (
        <div className="rec-terr-campo rec-terr-criterio">
          <span aria-hidden>Columnas del registro de consolidados</span>
          {formatos.extras_disponibles.map((x) => (
            <PulsoSwitch
              key={x.id}
              size="sm"
              label={x.rotulo}
              checked={formatos.extras_consolidado.includes(x.id)}
              disabled={guardando}
              onCheckedChange={(v) => void guardar({
                extras_consolidado: v ? [...formatos.extras_consolidado, x.id] : formatos.extras_consolidado.filter((e) => e !== x.id),
              })}
            />
          ))}
          <small className="rec-terr-nota">Las que usa el estudio, además de las fijas. Se guardan al elegir.</small>
        </div>
      ) : null}
      <div className="rec-terr-fila rec-terr-guardar">
        <PulsoButton
          variant="primary"
          size="sm"
          disabled={!sucio || vacio || guardando}
          onClick={() => void guardar({ rotulos: Object.fromEntries(Object.entries(cambiados).filter(([, v]) => v.trim())), con_99: con99, columna_criterio: criterio.trim() })}
        >
          {guardando ? "Guardando…" : "Guardar códigos"}
        </PulsoButton>
        {vacio ? <span className="rec-terr-nota">Cada código editable necesita un rótulo.</span> : null}
        {error ? <span className="rec-terr-error" role="alert">{error}</span> : null}
      </div>
    </article>
  );
}

/** Las hojas por UMP; la de conteo por zona vive en ZonasDeCuotas. */
type PiezaPorUmp = Exclude<PiezaDePapel, "conteo">;

const PIEZAS: Record<PiezaPorUmp, { titulo: string; icono: typeof ListOrdered; texto: string }> = {
  ruteo: {
    titulo: "Hoja de ruteo",
    icono: ListOrdered,
    texto: "Una por UMP, para anotar cada vivienda visitada: dirección, número, el código de resultado, y nombre, edad y sexo de quien responde. La cabecera sale con el distrito, la zona, la manzana, el rango de encuestas y el encuestador asignado.",
  },
  consolidados: {
    titulo: "Hoja de consolidados",
    icono: Table2,
    texto: "Una por UMP, para cerrar el recorrido: cuántas visitas tuvo cada código, las no aplicadas, las efectivas y el total de intentos, y el registro de encuestados ya numerado con los cuestionarios de la UMP.",
  },
};

export function HojaDePapel({ pieza, campaignId, unidades }: ConCampana & { pieza: PiezaPorUmp }) {
  const { formatos, error: errorFormatos, guardando, guardar } = useFormatos(campaignId);
  const [elegida, setElegida] = useState(unidades.units[0]?.unit_id ?? "");
  const p = PIEZAS[pieza];
  const Icono = p.icono;
  const gen = useGeneracion({ titulo: p.titulo, modulo: MODULO_MATERIAL, formato: "pdf", articulo: "la" });
  const generando = gen.estado.fase === "en_curso";
  const unidad = unidades.units.find((u) => u.unit_id === elegida) ?? unidades.units[0] ?? null;
  const generar = () => {
    void gen.ejecutar(() => apiMaterialTerritorialPapel(campaignId, pieza, { unidad: elegida }), {
      titulo: unidad ? `${p.titulo} de ${unidad.label}` : p.titulo,
    });
  };
  // Pasada de diseño (2 nov 2026): el esquema de Fichas —la hoja en maqueta a la izquierda y las
  // acciones al lado— en vez de una tarjeta delgada sobre 450 px vacíos.
  return (
    <div className="rec-terr-ficha" data-qa-geometry-member>
      <figure className="rec-terr-ficha-escenario" data-qa-geometry-capacity="owned">
        {unidad ? (
          pieza === "ruteo"
            ? <MaquetaDeRuteo unidad={unidad} caras={formatos?.caras_ruteo ?? 2} />
            : <MaquetaDeConsolidados unidad={unidad} />
        ) : null}
        <figcaption>{unidad ? `${unidad.label}, estructura de la ${p.titulo.toLocaleLowerCase("es-PE")}` : ""}</figcaption>
      </figure>
      <aside className="rec-terr-ficha-panel" aria-labelledby={`rec-terr-hoja-${pieza}`}>
        <div>
          <h2 id={`rec-terr-hoja-${pieza}`}><Icono size={18} aria-hidden /> {p.titulo}</h2>
          <p className="rec-terr-nota">{p.texto}</p>
        </div>
        {pieza === "ruteo" ? (
          <GlidingRadioGroup
            value={formatos?.caras_ruteo ?? 2}
            options={CARAS}
            getOptionValue={(o) => o[0]}
            onValueChange={(v) => void guardar({ caras_ruteo: v })}
            className="rec-terr-opciones"
            aria-label="Caras de la hoja de ruteo"
            getOptionProps={() => ({ disabled: !formatos || guardando })}
          >
            {(o) => <span>{o[1]}</span>}
          </GlidingRadioGroup>
        ) : null}
        <div className="rec-terr-campo">
          <span aria-hidden>UMP</span>
          <PulsoSelect
            size="sm"
            ariaLabel={`UMP de la ${p.titulo.toLocaleLowerCase("es-PE")}`}
            value={elegida || undefined}
            onValueChange={setElegida}
            options={unidades.units.map((u) => ({ value: u.unit_id, label: `${u.label}, ${u.distrito}${u.zona ? `, zona ${u.zona}` : ""}` }))}
          />
        </div>
        <div className="rec-terr-ficha-acciones">
          <PulsoButton variant="primary" disabled={!elegida || generando || unidades.stale} onClick={generar}>
            <Printer size={14} aria-hidden /> Generar el PDF
          </PulsoButton>
        </div>
        <ContenedorEntregable estado={gen.estado} forma="bloque" onCerrar={gen.cerrar} />
        <p className="rec-terr-nota">Para todas las UMP a la vez, en Paquetes.</p>
        {errorFormatos ? <p className="rec-terr-error" role="alert">{errorFormatos}</p> : null}
      </aside>
    </div>
  );
}

/** Paquetes: las dos hojas para todas las UMP, en un PDF cada una. */
export function HojasDelPaquete({ campaignId, unidades }: ConCampana) {
  const [conReemplazos, setConReemplazos] = useState(false);
  const gen = useGeneracion({ titulo: "Hojas de campo", modulo: MODULO_MATERIAL, formato: "pdf", articulo: "las" });
  const generando = gen.estado.fase === "en_curso";
  const titulares = unidades.units.filter((u) => u.role === "titular").length;
  const reemplazos = unidades.units.length - titulares;
  const total = conReemplazos ? unidades.units.length : titulares;
  const generar = (pieza: PiezaPorUmp) => {
    const titulo = pieza === "ruteo" ? "Hojas de ruteo" : "Hojas de consolidados";
    void gen.ejecutar(() => apiMaterialTerritorialPapel(campaignId, pieza, { alcance: conReemplazos ? "todas" : "titulares" }), { titulo });
  };
  return (
    <Panel
      data-qa-geometry-member
      aria-label="Hojas de campo"
      title={<><ListOrdered size={16} aria-hidden /> Hojas de ruteo y de consolidados</>}
      hint="Una de cada por UMP, con su encuestador y los códigos del estudio. Los reemplazos se imprimen cuando se activan; inclúyelos si quieres llevarlos de reserva."
    >
      <PulsoSwitch size="sm" label={`Incluir los reemplazos (${reemplazos.toLocaleString("es-PE")} UMP más)`} checked={conReemplazos} disabled={generando} onCheckedChange={setConReemplazos} />
      <div className="rec-terr-fila">
        <PulsoButton variant="secondary" size="sm" disabled={!total || generando || unidades.stale} onClick={() => generar("ruteo")}>
          <Printer size={14} aria-hidden /> Hojas de ruteo
        </PulsoButton>
        <PulsoButton variant="secondary" size="sm" disabled={!total || generando || unidades.stale} onClick={() => generar("consolidados")}>
          <Printer size={14} aria-hidden /> Hojas de consolidados
        </PulsoButton>
      </div>
      <ContenedorEntregable estado={gen.estado} forma="bloque" onCerrar={gen.cerrar} />
    </Panel>
  );
}
