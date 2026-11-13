/**
 * Las filas de "Patrón en una batería" en la caja "Condiciones" del panel de
 * regla: el patrón (misma respuesta, un código repetido o vacías), las
 * preguntas de la batería y el mínimo. Las preguntas se buscan por código o
 * rótulo y se eligen una por una o por grupo (su sección o la raíz del código,
 * `modeloBateria.ts`). La segunda condición ("y al menos 1 de 1 a 7") vale
 * para los tres patrones. Lo que se guarda lo arma `paramsDeBateria`.
 */
import { useState } from "react";
import { EstadoVacio } from "../../../../components/EstadoVacio";
import { PulsoButton } from "../../../../components/PulsoButton";
import { PulsoInput } from "../../../../components/PulsoInput";
import { PulsoSwitch } from "../../../../components/PulsoSwitch";
import { formatoConteo } from "../../../../lib/formatoNumero";
import { ListPlus, Search } from "../../../../vendor/lucide-react";
import type { ExploradorVariable } from "../../types";
import type { AccionDeBorrador, Borrador } from "../borradorDeRegla";
import { CampoOpciones } from "../campos/CampoOpciones";
import { buscarPreguntas, enOrdenDelFormulario, gruposDeBateria, type PreguntaConSeccion } from "../modeloBateria";
import { ademasDeBateria, paramList, patronDeBateria, type PatronDeBateria } from "../modeloRegla";
import { Fila } from "./FilaDeRegla";
import { Segmentado } from "./Segmentado";
import "./camposDeBateria.css";

const PATRONES: ReadonlyArray<{ valor: PatronDeBateria; rotulo: string }> = [
  { valor: "iguales", rotulo: "Misma respuesta" },
  { valor: "codigo", rotulo: "Un código repetido" },
  { valor: "vacias", rotulo: "Vacías" },
];

function rotuloDePregunta(v: ExploradorVariable | undefined, nombre: string): string {
  return v?.label && v.label !== nombre ? v.label : nombre;
}

function SelectorDePreguntas({
  elegidas,
  variables,
  onCambio,
}: {
  elegidas: readonly string[];
  variables: readonly PreguntaConSeccion[];
  onCambio: (siguientes: string[]) => void;
}) {
  const [busqueda, setBusqueda] = useState("");
  const porNombre = new Map(variables.map((v) => [v.name, v]));
  const set = new Set(elegidas);
  const encontradas = buscarPreguntas(busqueda, variables);
  // Con búsqueda, lo encontrado; sin ella, las elegidas (para poder quitarlas).
  const visibles = busqueda.trim() ? encontradas.map((v) => v.name) : [...elegidas];
  const grupos = gruposDeBateria(busqueda.trim() ? encontradas.map((v) => v.name) : elegidas, variables);
  const fijar = (nombres: Iterable<string>) => onCambio(enOrdenDelFormulario([...nombres], variables));
  const alternar = (nombre: string) => {
    const siguiente = new Set(set);
    if (siguiente.has(nombre)) siguiente.delete(nombre);
    else siguiente.add(nombre);
    fijar(siguiente);
  };
  const primera = elegidas[0];
  const ultima = elegidas[elegidas.length - 1];

  return (
    <div className="pulso-regla-bateria">
      <div className="pulso-regla-bateria-resumen" aria-live="polite">
        {elegidas.length ? (
          <span>
            <b>{formatoConteo(elegidas.length)}</b> {elegidas.length === 1 ? "pregunta" : "preguntas"}
            {elegidas.length > 1 ? (
              <>
                , de <code>{primera}</code> a <code>{ultima}</code>
              </>
            ) : null}
          </span>
        ) : (
          <span>Ninguna pregunta elegida</span>
        )}
        {elegidas.length ? (
          <PulsoButton variant="link" size="sm" onClick={() => onCambio([])}>
            Quitar todas
          </PulsoButton>
        ) : null}
      </div>
      <PulsoInput
        size="sm"
        type="search"
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        placeholder="Buscar por código o texto"
        aria-label="Buscar preguntas de la batería"
      />
      {grupos.length ? (
        <div className="pulso-regla-bateria-grupos">
          {grupos.map((g) => {
            const todas = g.preguntas.every((n) => set.has(n));
            return (
              <PulsoButton
                key={g.clave}
                variant="secondary"
                size="sm"
                disabled={todas}
                onClick={() => fijar([...set, ...g.preguntas])}
              >
                <ListPlus size={13} aria-hidden="true" />
                {todas ? `Elegidas las ${formatoConteo(g.preguntas.length)} de ${g.rotulo}` : `Elegir las ${formatoConteo(g.preguntas.length)} de ${g.rotulo}`}
              </PulsoButton>
            );
          })}
        </div>
      ) : null}
      {visibles.length ? (
        <ul className="pulso-regla-opciones-lista pulso-regla-bateria-lista" aria-label="Preguntas de la batería">
          {visibles.map((nombre) => {
            const v = porNombre.get(nombre);
            return (
              <li key={nombre} className="pulso-regla-opciones-fila" data-elegida={set.has(nombre) ? "" : undefined}>
                <PulsoSwitch
                  size="sm"
                  checked={set.has(nombre)}
                  onCheckedChange={() => alternar(nombre)}
                  label={v ? rotuloDePregunta(v, nombre) : nombre}
                  description={v ? (v.label && v.label !== nombre ? nombre : undefined) : "No está en esta base"}
                />
              </li>
            );
          })}
        </ul>
      ) : busqueda.trim() ? (
        <EstadoVacio tamano="compacto" icono={<Search size={16} />} titulo="Ninguna pregunta coincide con la búsqueda" />
      ) : null}
    </div>
  );
}

function textoDe(valor: number | null): string {
  return valor === null ? "" : String(valor);
}

/**
 * "Además": la segunda condición de la batería. Apagada no se guarda; encendida
 * pide un rango (uno de los límites puede faltar) o códigos, y en cuántas
 * preguntas de la batería.
 */
function filasDeAdemas(
  params: Record<string, unknown>,
  primera: string | undefined,
  k: number,
  setParam: (clave: string, valor: unknown) => void,
) {
  const ademas = ademasDeBateria(params);
  const crudo = (params.ademas ?? {}) as Record<string, unknown>;
  const set = (clave: string, valor: unknown) => setParam("ademas", { ...crudo, [clave]: valor });
  const filas = [
    <Fila key="ademas" variante="campo" rotulo="Además">
      <PulsoSwitch
        size="sm"
        checked={ademas !== null}
        onCheckedChange={(v) => setParam("ademas", v ? { minimo: 1 } : undefined)}
        label="Al menos una pregunta con una respuesta en un rango o con ciertos códigos"
      />
    </Fila>,
  ];
  if (!ademas) return filas;
  filas.push(
    <Fila key="ademas-rango" variante="campo" rotulo="Respuesta de">
      <span className="pulso-regla-bateria-rango">
        <PulsoInput type="number" value={textoDe(ademas.desde)} onChange={(e) => set("desde", e.target.value)} aria-label="Inicio del rango de la segunda condición" />
        <span>a</span>
        <PulsoInput type="number" value={textoDe(ademas.hasta)} onChange={(e) => set("hasta", e.target.value)} aria-label="Final del rango de la segunda condición" />
      </span>
    </Fila>,
    <Fila key="ademas-codigos" variante="campo" rotulo="O los códigos">
      <CampoOpciones
        variable={primera}
        valor={ademas.codigos}
        onCambio={(codigos) => set("codigos", codigos)}
        ariaLabel="Códigos de la segunda condición"
      />
    </Fila>,
    <Fila key="ademas-minimo" variante="campo" rotulo="En al menos">
      <span className="pulso-regla-bateria-minimo">
        <PulsoInput
          type="number"
          min={1}
          max={k || undefined}
          step={1}
          value={textoDe(ademas.minimo)}
          placeholder="1"
          onChange={(e) => set("minimo", e.target.value)}
          aria-label="Preguntas que deben cumplir la segunda condición"
        />
        <span>{k ? `de ${formatoConteo(k)} ${k === 1 ? "pregunta" : "preguntas"}` : "preguntas"}</span>
      </span>
    </Fila>,
  );
  return filas;
}

export function CamposDeBateria({
  borrador: b,
  despachar,
  variables,
}: {
  borrador: Borrador;
  despachar: (accion: AccionDeBorrador) => void;
  /** Las preguntas que puede revisar una batería (`preguntasDelTipo("bateria", …)`). */
  variables: readonly ExploradorVariable[];
}) {
  const patron = patronDeBateria(b.params.patron);
  const setParam = (clave: string, valor: unknown) => despachar({ tipo: "param", clave, valor });
  const elegidas = b.variables.filter(Boolean);
  const k = elegidas.length;
  const primera = elegidas[0];
  const minimo = typeof b.params.minimo === "number" || typeof b.params.minimo === "string" ? String(b.params.minimo) : "";
  const campoMinimo = (rotulo: string) => (
    <Fila key="minimo" variante="campo" rotulo={rotulo}>
      <span className="pulso-regla-bateria-minimo">
        <PulsoInput
          type="number"
          min={patron === "iguales" ? 2 : 1}
          max={k || undefined}
          step={1}
          value={minimo}
          placeholder={patron === "codigo" || !k ? "" : String(k)}
          onChange={(e) => setParam("minimo", e.target.value)}
          aria-label={rotulo}
        />
        <span>{k ? `de ${formatoConteo(k)} ${k === 1 ? "pregunta" : "preguntas"}` : "preguntas"}</span>
      </span>
    </Fila>
  );

  const filas = [
    <Fila key="patron" variante="campo" rotulo="Patrón">
      <Segmentado<PatronDeBateria>
        etiqueta="Patrón de la batería"
        valor={patron}
        opciones={PATRONES}
        ancho
        onCambio={(p) => despachar({ tipo: "params", valor: { patron: p } })}
      />
    </Fila>,
    <Fila key="preguntas" variante="campo" rotulo="Preguntas">
      <SelectorDePreguntas
        elegidas={elegidas}
        variables={variables as readonly PreguntaConSeccion[]}
        onCambio={(siguientes) => despachar({ tipo: "variables", valor: siguientes })}
      />
    </Fila>,
  ];
  if (patron === "iguales") {
    filas.push(campoMinimo("Respondidas"));
    filas.push(
      <Fila key="no-cuentan" variante="campo" rotulo="No cuentan">
        <CampoOpciones
          variable={primera}
          valor={paramList(b.params.no_cuentan)}
          onCambio={(codigos) => setParam("no_cuentan", codigos)}
          ariaLabel="Códigos que no cuentan como respuesta"
        />
      </Fila>,
      <Fila key="vacias" variante="campo" rotulo="Vacías">
        <PulsoSwitch
          size="sm"
          checked={b.params.vacias_cuentan === true}
          onCheckedChange={(v) => setParam("vacias_cuentan", v)}
          label="Una pregunta vacía cuenta como una respuesta más"
        />
      </Fila>,
    );
  } else if (patron === "codigo") {
    filas.push(
      <Fila key="codigos" variante="campo" rotulo="Código">
        <CampoOpciones
          variable={primera}
          valor={paramList(b.params.codigos)}
          onCambio={(codigos) => setParam("codigos", codigos)}
          ariaLabel="Código que se cuenta"
        />
      </Fila>,
      campoMinimo("En al menos"),
    );
  } else {
    filas.push(campoMinimo("Al menos"));
  }
  filas.push(...filasDeAdemas(b.params, primera, k, setParam));
  return <>{filas}</>;
}
