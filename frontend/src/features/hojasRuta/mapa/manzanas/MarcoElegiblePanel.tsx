import { useEffect, useState } from "react";
import { GlidingRadioGroup } from "../../../../components/GlidingRadioGroup";
import { PulsoButton } from "../../../../components/PulsoButton";
import { apiHojasRutaBitacoraAnotar, apiHojasRutaDecisionCobertura, type HojasRutaMarcoElegible, type HojasRutaMarcoElegiblePreview, type SamplingMethod } from "../../../../api/hojasRuta";
import { nombreDistrito } from "../nombres";
import { useLienzoHojasRuta } from "../store";
import { ANCLA_MARCO, aLonLat, faltaEnArea, irAlMarcoElegible, MARCO_NUEVO, MOTIVOS, nuevaArea, pideEvidencia, tonoCobertura, type FormularioArea } from "./marcoElegible";

import { formatoDecimal } from "../../../../lib/formatoNumero";
import { LoadingBlock } from "../../../../components/States";
/**
 * Marco elegible en el inspector de Manzanas (U11d, ADR 0115). Con una corrida
 * legacy se ofrece adoptarlo mostrando antes lo que saca; adoptado, se ajusta el
 * mínimo de viviendas y se dibujan áreas en el mapa. Todo va al borrador del
 * sorteo: se guarda al sortear.
 */

const fmt = (n: number) => new Intl.NumberFormat("es-PE").format(Math.round(n));
const pct = (x: number) => `${formatoDecimal(x * 100, 1)} %`;
const ETIQUETA_MOTIVO = Object.fromEntries(MOTIVOS) as Record<string, string>;
const FORM_VACIO: FormularioArea = { motivo: "no_residencial", detalle: "", fuente: "", fecha: "" };

type Props = {
  marco: HojasRutaMarcoElegible | undefined;
  vista: HojasRutaMarcoElegiblePreview | null;
  cargando: boolean;
  deshabilitado: boolean;
  onCambiar: (me: HojasRutaMarcoElegible) => void;
  /** Entrevistas por ruta: el atajo «una ruta completa» usa este mínimo (B38). */
  ruta?: number;
  /** Método de sorteo vigente: con PPS una manzana sin viviendas no sale; con el sistemático, sí (ADR 0117). */
  metodo?: SamplingMethod;
};

export function MarcoElegiblePanel({ marco, vista, cargando, deshabilitado, onCambiar, ruta = 0, metodo }: Props) {
  const { dibujoArea, setDibujoArea } = useLienzoHojasRuta();
  const [form, setForm] = useState<FormularioArea>(FORM_VACIO);
  // ADR 0115 §4: con 10 % o más de población excluida en un distrito, el equipo decide y queda registrado (U17).
  const [decision, setDecision] = useState<"" | "redefinir" | "aceptar">("");
  const [justificacion, setJustificacion] = useState("");
  const [decidido, setDecidido] = useState("");
  const [errorDecision, setErrorDecision] = useState("");
  // La vigencia la decide el servidor (huella del marco guardado): al montar se lee, y
  // un cambio del marco en el borrador obliga a decidir de nuevo (ADR 0115 §4, enmienda U17).
  const huellaBorrador = JSON.stringify(marco ?? null);
  // F24: se llega con `#marco-elegible` desde las observaciones de Selección; el bloque está abajo del inspector.
  useEffect(() => {
    if (window.location.hash === `#${ANCLA_MARCO}`) irAlMarcoElegible(false);
  }, []);
  useEffect(() => {
    let vivo = true;
    setDecidido("");
    apiHojasRutaDecisionCobertura()
      .then((d) => {
        if (vivo && d.vigente != null && d.exigida.length) setDecidido(`decisión vigente para este marco (entrada ${d.vigente} de la bitácora).`);
      })
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, [huellaBorrador]);
  const declarado = marco?.declarado === true;
  const sumar = (k: "manzanas" | "viviendas" | "poblacion", campo: "total" | "elegible" | "excluida_minimo" | "excluida_area") => (vista?.por_distrito ?? []).reduce((a, d) => a + d[campo][k], 0);
  const totalPob = sumar("poblacion", "total");
  const excluidasMinimo = sumar("manzanas", "excluida_minimo");
  const sinConteo = (vista?.por_distrito ?? []).reduce((a, d) => a + d.excluida_minimo_sin_conteo, 0);
  const cubierta = totalPob ? sumar("poblacion", "elegible") / totalPob : null;
  // «Fuera» = total − elegibles; se desglosa para que cuadre con «Salen N» (sólo el mínimo) y con el piloto.
  const piloto = (vista?.por_distrito ?? []).reduce((a, d) => a + (d.excluida_piloto?.manzanas ?? 0), 0);
  const motivosFuera = [
    excluidasMinimo ? `${fmt(excluidasMinimo)} por el mínimo` : "",
    sumar("manzanas", "excluida_area") ? `${fmt(sumar("manzanas", "excluida_area"))} por áreas` : "",
    piloto ? `${fmt(piloto)} del piloto` : "",
  ].filter(Boolean).join(", ") || "manzanas";
  const cortas = (vista?.capacidad ?? []).filter((z) => z.falta);
  const decisiones = (vista?.por_distrito ?? []).filter((d) => tonoCobertura(d) === "decision");
  const vertices = dibujoArea ?? [];
  const lonlat = vertices.map(([x, y]) => aLonLat(x, y));
  const falta = dibujoArea ? faltaEnArea(form, lonlat) : null;

  if (!declarado) {
    return (
      <section id={ANCLA_MARCO} className="hr-muestra-grupo" aria-label="Marco elegible">
        <h3>Marco elegible</h3>
        {/* Con PPS una manzana sin viviendas tiene π = 0 (ADR 0117): «sortea sobre todas» hacía creer que podían salir. */}
        <p className="hr-mapa-nota">El marco de este estudio incluye todas las manzanas 2017, también las que no tienen viviendas registradas{metodo === "sistematico" ? " y que el sistemático puede sortear" : "; con PPS no salen sorteadas"}.</p>
        {vista ? (
          <p className="hr-mapa-nota">
            Adoptarlo saca <b>{fmt(excluidasMinimo)}</b> manzanas sin viviendas registradas{sinConteo ? ` (${fmt(sinConteo)} por falta de conteo en el censo)` : ""} y cubre el {cubierta == null ? "—" : pct(cubierta)} de la población.
          </p>
        ) : cargando ? <LoadingBlock variant="inline" label="Calculando lo que cambiaría…" /> : null}
        <div className="hr-mapa-acciones">
          {/* Adoptar es la acción del bloque; dibujar un área, la alternativa: no pesan igual. */}
          <PulsoButton variant="primary" size="sm" disabled={deshabilitado} onClick={() => onCambiar(MARCO_NUEVO)}>
            Adoptar el marco elegible
          </PulsoButton>
          {/* B39: dibujar a la vista. Declara el marco sólo con el área: mínimo 0, no saca manzanas sin viviendas. */}
          <PulsoButton
            variant="secondary"
            size="sm"
            disabled={deshabilitado}
            title="Declara el marco elegible sólo con las áreas que dibujes; no saca manzanas por viviendas"
            onClick={() => {
              onCambiar({ declarado: true, minimo_viviendas: 0, areas_excluidas: [] });
              setDibujoArea([]);
            }}
          >
            Dibujar un área a excluir
          </PulsoButton>
        </div>
      </section>
    );
  }

  const me = marco ?? MARCO_NUEVO;
  return (
    <section id={ANCLA_MARCO} className="hr-muestra-grupo" aria-label="Marco elegible">
      <h3>Marco elegible</h3>
      {/* B38: cada cifra dice sobre qué base se cuenta; todas salen de la vista previa del motor (por distrito). */}
      <div className="hr-mapa-cifras hr-me-cifras">
        <div><small>Elegibles</small><strong>{vista ? fmt(sumar("manzanas", "elegible")) : "—"}</strong><span>{vista ? `de ${fmt(sumar("manzanas", "total"))} manzanas` : ""}</span></div>
        <div><small>Fuera</small><strong>{vista ? fmt(sumar("manzanas", "total") - sumar("manzanas", "elegible")) : "—"}</strong><span>{vista ? motivosFuera : "manzanas"}</span></div>
        <div><small>Viviendas</small><strong>{vista && sumar("viviendas", "total") ? pct(sumar("viviendas", "elegible") / sumar("viviendas", "total")) : "—"}</strong><span>en manzanas elegibles</span></div>
      </div>
      {vista ? <p className="hr-mapa-nota">Cubre el {cubierta == null ? "—" : pct(cubierta)} de la población de los distritos del estudio.</p> : null}
      <div className="hr-muestra-campo">
        <small>Mínimo de viviendas por manzana</small>
        <span className="hr-muestra-pasos">
          <PulsoButton variant="icon" tone="framed" size="sm" aria-label="Una vivienda menos" disabled={deshabilitado || me.minimo_viviendas <= 0} onClick={() => onCambiar({ ...me, minimo_viviendas: me.minimo_viviendas - 1 })}>−</PulsoButton>
          <input type="number" min={0} aria-label="Mínimo de viviendas por manzana" value={me.minimo_viviendas} disabled={deshabilitado} onChange={(e) => e.target.value !== "" && onCambiar({ ...me, minimo_viviendas: Math.max(0, Math.round(Number(e.target.value) || 0)) })} />
          <PulsoButton variant="icon" tone="framed" size="sm" aria-label="Una vivienda más" disabled={deshabilitado} onClick={() => onCambiar({ ...me, minimo_viviendas: me.minimo_viviendas + 1 })}>+</PulsoButton>
        </span>
        <span className="hr-me-atajos" role="group" aria-label="Mínimos frecuentes">
          <button type="button" aria-pressed={me.minimo_viviendas === 1} disabled={deshabilitado} onClick={() => onCambiar({ ...me, minimo_viviendas: 1 })}>1, con viviendas</button>
          {ruta > 1 ? (
            <button type="button" aria-pressed={me.minimo_viviendas === ruta} disabled={deshabilitado} title={`Saca las manzanas con menos viviendas que las ${ruta} entrevistas de una ruta`} onClick={() => onCambiar({ ...me, minimo_viviendas: ruta })}>{ruta}, una ruta completa</button>
          ) : null}
        </span>
        <span className="hr-mapa-nota">
          {vista ? `Salen ${fmt(excluidasMinimo)} manzanas${sinConteo ? `, ${fmt(sinConteo)} de ellas sin conteo en el censo` : ""}.` : cargando ? "Calculando…" : ""}
          {me.minimo_viviendas > 1 ? " Con más de 1 la muestra deja de cubrir hogares reales: el informe lo declara." : ""}
        </span>
      </div>

      <div className="hr-muestra-campo">
        <small>Áreas excluidas</small>
        {me.areas_excluidas.length ? (
          <ul className="hr-me-areas">
            {me.areas_excluidas.map((a) => (
              <li key={a.id}>
                <span>
                  <strong>{ETIQUETA_MOTIVO[a.motivo]}</strong>
                  <small>{a.detalle || a.fuente || a.id}</small>
                </span>
                <PulsoButton variant="icon" intent="remove" size="sm" aria-label={`Quitar el área ${a.id}`} disabled={deshabilitado} onClick={() => onCambiar({ ...me, areas_excluidas: me.areas_excluidas.filter((x) => x.id !== a.id) })}>×</PulsoButton>
              </li>
            ))}
          </ul>
        ) : !dibujoArea ? <span className="hr-mapa-nota">Ninguna. Dibuja las zonas industriales, inaccesibles o de riesgo que el equipo no puede trabajar.</span> : null}
        {dibujoArea ? (
          <div className="hr-me-dibujo">
            <p className="hr-mapa-nota">Toca el mapa para marcar los vértices ({vertices.length} marcados). Toca el primero para cerrar.</p>
            <GlidingRadioGroup value={form.motivo} options={MOTIVOS} getOptionValue={(o) => o[0]} onValueChange={(motivo) => setForm({ ...form, motivo })} className="hr-muestra-opciones hr-me-motivos" aria-label="Motivo de la exclusión">
              {(o) => <span>{o[1]}</span>}
            </GlidingRadioGroup>
            <input className="hr-mapa-buscar" aria-label="Detalle del área" placeholder={form.motivo === "otro" ? "Detalle (obligatorio)" : "Detalle (opcional)"} value={form.detalle} onChange={(e) => setForm({ ...form, detalle: e.target.value })} />
            {pideEvidencia(form.motivo) ? (
              <div className="hr-muestra-dos">
                <input className="hr-mapa-buscar" aria-label="Fuente de la evidencia" placeholder="Fuente (p. ej., supervisión 2025)" value={form.fuente} onChange={(e) => setForm({ ...form, fuente: e.target.value })} />
                <input className="hr-mapa-buscar" type="date" aria-label="Fecha de la evidencia" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} />
              </div>
            ) : null}
            {falta ? <p className="hr-mapa-nota">{falta}.</p> : null}
            <div className="hr-mapa-acciones">
              <PulsoButton variant="secondary" size="sm" disabled={!vertices.length} onClick={() => setDibujoArea(vertices.slice(0, -1))}>Quitar el último punto</PulsoButton>
              <PulsoButton variant="secondary" size="sm" onClick={() => { setDibujoArea(null); setForm(FORM_VACIO); }}>Cancelar</PulsoButton>
              <PulsoButton
                variant="primary"
                size="sm"
                disabled={Boolean(falta)}
                onClick={() => {
                  onCambiar({ ...me, areas_excluidas: [...me.areas_excluidas, nuevaArea(form, lonlat, me.areas_excluidas, new Date())] });
                  setDibujoArea(null);
                  setForm(FORM_VACIO);
                }}
              >
                Guardar el área
              </PulsoButton>
            </div>
          </div>
        ) : (
          <PulsoButton variant="secondary" size="sm" disabled={deshabilitado} onClick={() => setDibujoArea([])}>Dibujar un área a excluir</PulsoButton>
        )}
      </div>

      {cortas.length ? (
        <div className="hr-me-cortas">
          <p className="hr-mapa-aviso">
            {cortas.length === 1 ? "1 zona no alcanza" : `${cortas.length} zonas no alcanzan`} con el marco elegible: {cortas.filter((z) => z.falta === "titulares").length} para sus titulares y {cortas.filter((z) => z.falta === "reemplazos").length} sólo para sus reemplazos.
          </p>
          <ul className="hr-me-zonas">
            {cortas.slice(0, 6).map((z) => (
              <li key={`${z.ubigeo}-${z.zona}`}>{nombreDistrito(z.distrito)}, zona {z.zona}: {z.manzanas} de {z.necesita} manzanas</li>
            ))}
          </ul>
        </div>
      ) : null}
      {decisiones.length ? (
        <div className="hr-me-decision">
          <p className="hr-mapa-aviso">
            {decisiones.map((d) => nombreDistrito(d.distrito)).join(", ")} {decisiones.length === 1 ? "pierde" : "pierden"} el 10 % o más de su población. Sortear sigue libre, pero antes de generar las hojas de campo el equipo decide si redefine la población objetivo o lo acepta con justificación.
          </p>
          {decidido ? (
            <p className="hr-mapa-nota">Registrado en la bitácora: {decidido}</p>
          ) : (
            <>
              <div className="hr-mapa-acciones">
                <PulsoButton variant={decision === "redefinir" ? "primary" : "secondary"} size="sm" onClick={() => setDecision("redefinir")}>Redefinir la población objetivo</PulsoButton>
                <PulsoButton variant={decision === "aceptar" ? "primary" : "secondary"} size="sm" onClick={() => setDecision("aceptar")}>Aceptar con justificación</PulsoButton>
              </div>
              {decision ? (
                <>
                  <p className="hr-mapa-nota">La justificación se publica tal cual en el informe de diseño muestral que recibe el cliente.</p>
                  <input className="hr-mapa-buscar" aria-label="Justificación de la decisión" placeholder={decision === "redefinir" ? "Cómo se redefine (p. ej., hogares fuera de zonas de riesgo)" : "Por qué se acepta la pérdida de cobertura"} value={justificacion} onChange={(e) => setJustificacion(e.target.value)} />
                  <PulsoButton
                    variant="secondary"
                    size="sm"
                    disabled={!justificacion.trim()}
                    onClick={() => {
                      const resumen = `${decision === "redefinir" ? "Se redefine la población objetivo" : "Se acepta la pérdida de cobertura"} en ${decisiones.map((d) => nombreDistrito(d.distrito)).join(", ")}: ${justificacion.trim()}`;
                      apiHojasRutaBitacoraAnotar("decision_cobertura", resumen, {
                        decision,
                        distritos: decisiones.map((d) => ({ ubigeo: d.ubigeo, cobertura_poblacion: d.cobertura_poblacion })),
                        marco_elegible: { minimo_viviendas: me.minimo_viviendas, areas_excluidas: me.areas_excluidas.length },
                      })
                        .then(() => {
                          setErrorDecision("");
                          setDecidido(resumen);
                        })
                        .catch((e: unknown) => setErrorDecision(`No se pudo registrar la decisión: ${e instanceof Error ? e.message : "error"}. Vuelve a intentarlo.`));
                    }}
                  >
                    Registrar la decisión
                  </PulsoButton>
                  {errorDecision ? <p className="hr-mapa-aviso" role="alert">{errorDecision}</p> : null}
                </>
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </section>
  );
}
