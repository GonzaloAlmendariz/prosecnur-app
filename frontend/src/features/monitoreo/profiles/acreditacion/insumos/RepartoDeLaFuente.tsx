import { useEffect, useState } from "react";
import { Check, Loader2, Split } from "lucide-react";
import { apiMonitoreoSource, type MonitoreoState } from "../../../../../api/client";
import { postMonitoreoCuotaProponer, type MonitoreoCuotaVariable } from "../../../../../api/monitoreoCuotas";
import { PulsoSelect } from "../../../../../components/PulsoSelect";
import { PulsoInput } from "../../../../../components/PulsoInput";
import { PulsoSwitch } from "../../../../../components/PulsoSwitch";
import { sourcePayloadFromExisting } from "../../telefonico/fuentes/payloadDeFuente";
import { fmt } from "../formato";
import type { FuenteDelMaestro } from "./fuentesModelo";
import "./repartoDeLaFuente.css";

/** Clave de un valor como la compara el motor (`.monitoreo_text_key`): sin mayúsculas ni tildes. */
export function claveDeValor(valor: string): string {
  return String(valor ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

/** El mapa guardado de la fuente (R lo serializa `[]` cuando está vacío; sus claves vuelven normalizadas). */
export function mapaGuardado(fuente: FuenteDelMaestro["fuente"]): Record<string, string> {
  const crudo = fuente.actor_map;
  if (!crudo || Array.isArray(crudo) || typeof crudo !== "object") return {};
  return Object.fromEntries(Object.entries(crudo).map(([valor, publico]) => [claveDeValor(valor), String(publico ?? "")]).filter(([, publico]) => publico));
}

type Valor = { valor: string; personas: number | null };

/**
 * Insumos › Fuentes: repartir un padrón entre dos públicos (Gonzalo, 30/10:
 * «CENTRUM y Campus son dos perfiles separados a pesar de que pertenecen a una
 * misma base»), y en una encuesta, que cada respuesta tome el público de su fila
 * en el padrón. Los dos se guardan en la fuente (`actor_var` + `actor_map`,
 * `actor_por_padron`) y se aplican al actualizar el corte.
 */
export function RepartoDeLaFuente({
  elegida,
  variables,
  onStateChange,
}: {
  elegida: FuenteDelMaestro;
  /** Variables del padrón de este público (las de Cuotas), para elegir la columna. */
  variables: readonly MonitoreoCuotaVariable[];
  onStateChange?: (state: MonitoreoState) => void;
}) {
  const { fuente } = elegida;
  const guardado = mapaGuardado(fuente);
  const [columna, setColumna] = useState(fuente.actor_var ?? "");
  const [publicoNuevo, setPublicoNuevo] = useState(Object.values(guardado)[0] ?? "");
  const [elegidos, setElegidos] = useState<string[]>(Object.keys(guardado));
  const [valores, setValores] = useState<Valor[] | null>(null);
  const [leyendo, setLeyendo] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<{ tono: "info" | "error"; texto: string } | null>(null);

  // Los valores de la columna, con sus personas, salen del mismo cálculo de Cuotas.
  useEffect(() => {
    if (elegida.papel !== "padron" || !columna) { setValores(null); return; }
    let vivo = true;
    setLeyendo(true);
    postMonitoreoCuotaProponer({ actor: elegida.publico, variable: columna })
      .then((propuesta) => { if (vivo) setValores(propuesta.categorias.map((item) => ({ valor: item.categoria, personas: item.universo }))); })
      .catch(() => { if (vivo) setValores([]); })
      .finally(() => { if (vivo) setLeyendo(false); });
    return () => { vivo = false; };
  }, [columna, elegida.papel, elegida.publico]);

  async function guardar(cambio: Parameters<typeof sourcePayloadFromExisting>[1], texto: string) {
    setGuardando(true);
    setMensaje(null);
    try {
      const result = await apiMonitoreoSource(sourcePayloadFromExisting(fuente, cambio));
      onStateChange?.(result.state);
      setMensaje({ tono: "info", texto });
    } catch (e) {
      setMensaje({ tono: "error", texto: (e as Error).message });
    } finally {
      setGuardando(false);
    }
  }

  if (elegida.papel === "respuestas") {
    return (
      <section className="acr-rp" aria-label="Público de cada respuesta">
        <span className="acr-av-antetitulo">Público de cada respuesta</span>
        <PulsoSwitch
          checked={Boolean(fuente.actor_por_padron)}
          disabled={guardando}
          onCheckedChange={(siguiente) => {
            void guardar(
              { actor_por_padron: siguiente },
              siguiente
                ? "Cada respuesta tomará el público de su fila en el padrón al actualizar el corte."
                : "Las respuestas vuelven a contar en el público de la encuesta al actualizar el corte.",
            );
          }}
          label="Sale de su fila en el padrón"
          description="Para una encuesta que responden dos públicos de un mismo padrón: cada respuesta cuenta en el público de la persona con que cruza."
        />
        {mensaje ? <p className={`acr-rp-mensaje${mensaje.tono === "error" ? " is-error" : ""}`} role="status">{mensaje.texto}</p> : null}
      </section>
    );
  }
  if (elegida.papel !== "padron") return null;

  const conCategorias = variables.filter((item) => item.categorias != null && item.categorias >= 2 && item.categorias <= 150);
  const nombreValido = publicoNuevo.trim().length > 0 && publicoNuevo.trim().toLocaleLowerCase("es") !== elegida.publico.trim().toLocaleLowerCase("es");
  const puedeGuardar = Boolean(columna) && nombreValido && elegidos.length > 0 && !guardando;
  const repartido = Object.keys(guardado).length > 0;

  return (
    <section className="acr-rp" aria-label="Repartir el padrón entre públicos">
      <span className="acr-av-antetitulo">Repartir el padrón entre públicos</span>
      <p className="acr-rp-ayuda">Para un padrón que reúne a dos públicos: los valores elegidos pasan al público nuevo y el resto queda en {elegida.publico}.</p>
      <div className="acr-rp-campos">
        <label className="acr-rp-campo">
          <span>Columna</span>
          <PulsoSelect
            value={columna || undefined}
            onValueChange={(valor) => { setColumna(valor); setElegidos([]); setMensaje(null); }}
            options={conCategorias.map((item) => ({ value: item.variable, label: item.variable }))}
            placeholder="Elige la columna"
            ariaLabel="Columna que reparte el padrón"
            size="sm"
          />
        </label>
        <label className="acr-rp-campo">
          <span>Público nuevo</span>
          <PulsoInput value={publicoNuevo} onChange={(event) => setPublicoNuevo(event.currentTarget.value)} placeholder="Nombre del público" aria-label="Nombre del público nuevo" size="sm" />
        </label>
      </div>
      {columna ? (
        leyendo ? <p className="acr-rp-ayuda" role="status"><Loader2 size={13} className="pulso-spin" aria-hidden="true" /> Leyendo los valores de {columna}.</p> : (
          <div className="acr-rp-valores" role="group" aria-label={`Valores de ${columna} que pasan al público nuevo`}>
            {(valores ?? []).map((item) => {
              // Lo elegido se guarda por su clave: el motor la devuelve normalizada («centrum»).
              const clave = claveDeValor(item.valor);
              const activo = elegidos.includes(clave);
              return (
                <button key={item.valor} type="button" className={`acr-rp-valor${activo ? " is-activo" : ""}`} aria-pressed={activo} onClick={() => setElegidos((previo) => (activo ? previo.filter((valor) => valor !== clave) : [...previo, clave]))}>
                  {activo ? <Check size={12} aria-hidden="true" /> : null}
                  <span>{item.valor}</span>
                  {item.personas == null ? null : <small className="acr-av-num">{fmt(item.personas)}</small>}
                </button>
              );
            })}
          </div>
        )
      ) : null}
      <div className="acr-rp-pie">
        {repartido ? (
          <button type="button" className="acr-av-boton" disabled={guardando} onClick={() => { void guardar({ actor_var: "", actor_map: {} }, `El padrón vuelve a ser sólo de ${elegida.publico} al actualizar el corte.`); }}>
            Quitar el reparto
          </button>
        ) : <span />}
        <button type="button" className="acr-av-boton is-primario" disabled={!puedeGuardar} onClick={() => {
          const nombre = publicoNuevo.trim();
          void guardar(
            { actor_var: columna, actor_map: Object.fromEntries(elegidos.map((valor) => [valor, nombre])) },
            `${(valores ?? []).filter((item) => elegidos.includes(claveDeValor(item.valor))).map((item) => item.valor).join(" y ") || "Los valores elegidos"} pasan a ${nombre} al actualizar el corte; el resto queda en ${elegida.publico}.`,
          );
        }}>
          {guardando ? <Loader2 size={14} className="pulso-spin" aria-hidden="true" /> : <Split size={14} aria-hidden="true" />} Guardar reparto
        </button>
      </div>
      {mensaje ? <p className={`acr-rp-mensaje${mensaje.tono === "error" ? " is-error" : ""}`} role="status">{mensaje.texto}</p> : null}
    </section>
  );
}
