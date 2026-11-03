import { memo, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { PlugZap } from "lucide-react";
import { EstadoVacio } from "../../../../../components/EstadoVacio";
import type { MonitoreoState, MonitoreoTerritorialDashboard, MonitoreoTerritorialPhase } from "../../../../../api/client";
import { construirConexiones } from "./conexionesModel";
import { construirTableroDeConexiones } from "./conexionesTablero";
import { FuenteDeConexion, MuestraDeCampo } from "./FuenteDeConexion";
import { RotuloDePestana } from "../navegacion/RotuloDePestana";
import { useMuestraEnviada } from "./useMuestraEnviada";
import "./insumos.css";
import "./conexiones.css";

/**
 * Insumos › Conexiones (territorial.md §3.1): un `Panel` por fuente con su
 * estado, lo que trajo y sus lecturas, y al costado la muestra que llega de
 * Hojas de ruta. «Traer nuevas» y «Traer todo de nuevo» son las del modo;
 * releer la ficha, cambiar o conectar un formulario siguen en «Administrar
 * fuentes» (`panel=consola`). Presentación en `conexionesTablero.ts`.
 *
 * Contrato de Superficie: C1 `territorial-insumos-conexiones` (intrínseco: la
 * vista mide lo que trae y desplaza con el área de trabajo); las fuentes son
 * una colección intrínseca porque cada una trae cifras y lecturas distintas.
 */
function ConexionesTabImpl({
  reports,
  avance = null,
  consultas = null,
  state,
  phase,
  ocupado,
  onTraerNuevas,
  onTraerTodo,
  onAdministrar,
}: {
  reports: MonitoreoTerritorialDashboard | null;
  avance?: MonitoreoTerritorialDashboard | null;
  consultas?: MonitoreoTerritorialDashboard | null;
  state: MonitoreoState | null;
  phase: MonitoreoTerritorialPhase;
  ocupado: boolean;
  onTraerNuevas?: () => void;
  onTraerTodo?: () => void;
  onAdministrar: () => void;
}) {
  const modelo = useMemo(() => construirConexiones(state, reports, phase, { avance, consultas }), [avance, consultas, phase, reports, state]);
  const tablero = useMemo(() => construirTableroDeConexiones(modelo), [modelo]);
  const navigate = useNavigate();
  const muestraEnviada = useMuestraEnviada(`${phase}:${reports?.generated_at ?? ""}`);

  if (!modelo.conFuenteDeCampo) {
    return (
      <section className="mon-ins mon-ins--vacio" data-audit-ready="vacio:sin-fuente" aria-label="Conexiones">
        <div className="mon-ins-panel">
          <RotuloDePestana />
          <EstadoVacio
            tamano="normal"
            icono={<PlugZap size={18} />}
            titulo="Sin formulario de Kobo para la fase Campo"
            descripcion="Conecta el formulario de Kobo de la fase para leer sus respuestas."
            accion={
              <button type="button" className="mon-ins-boton is-primario" onClick={onAdministrar}>Conectar Kobo</button>
            }
          />
        </div>
      </section>
    );
  }

  return (
    <section
      className="mon-con"
      aria-label="Conexiones"
      data-audit-ready="monitoreo-territorial-insumos-conexiones"
      data-qa-geometry-group="territorial-insumos-conexiones"
      data-qa-geometry-contract="intrinsic"
    >
      <div
        className="mon-con-fuentes"
        data-qa-geometry-member="fuentes"
        data-qa-geometry-group="territorial-insumos-conexiones-fuentes"
        data-qa-geometry-contract="intrinsic"
      >
        {tablero.fuentes.map((fuente, indice) => (
          <FuenteDeConexion
            key={fuente.clave}
            fuente={fuente}
            conRotulo={indice === 0}
            ocupado={ocupado}
            onTraerNuevas={fuente.traer ? onTraerNuevas : undefined}
            onTraerTodo={fuente.traer ? onTraerTodo : undefined}
            onAdministrar={fuente.administrar ? onAdministrar : undefined}
          />
        ))}
      </div>
      <MuestraDeCampo
        cifras={tablero.muestra}
        muestraEnviada={muestraEnviada}
        onAbrirHojas={() => navigate("/hojas-ruta?seccion=muestra")}
        onReenviar={() => navigate("/hojas-ruta?seccion=seleccion&panel=salidas")}
      />
    </section>
  );
}

export const ConexionesTab = memo(ConexionesTabImpl);
