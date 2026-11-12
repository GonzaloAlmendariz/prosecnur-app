// Procesamiento cuando el motor de la app no responde (ADR 0142, etapa P7;
// `procesamiento-sin-motor` del prototipo). Un solo aviso en lugar de la
// sección abierta, común a las cinco: dice la causa, qué sigue guardado y
// vuelve a probar solo; al responder el motor, la sección se monta de nuevo y
// relee sus datos.
//
// Sin esto cada pestaña pintaba su propio error con el mensaje del navegador
// ("Failed to fetch"), uno por pedido, sin decir que la causa era una sola.

import { useCallback, useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { PlugZap, RefreshCw } from "lucide-react";

import { apiHealth } from "../../../api/core";
import { leerEstadoDelMotor, suscribirEstadoDelMotor } from "../../../api/motorDisponible";
import { PageFrame } from "../../../components/PageFrame";
import { Panel } from "../../../components/Panel";
import { PulsoButton } from "../../../components/PulsoButton";
import { ErrorBlock } from "../../../components/States";
import { CabeceraDePestana } from "../../../components/procesamiento/CabeceraDePestana";
import { esperaDelIntento, LATIDO_DEL_MOTOR_MS, seccionSinMotor, textoDeEspera } from "./modeloSinMotor";
import "./sin-motor.css";

export function useMotorSinRespuesta(): boolean {
  return useSyncExternalStore(suscribirEstadoDelMotor, () => leerEstadoDelMotor().sinRespuesta);
}

/** Envuelve la sección de Procesamiento: con el motor caído, la cambia por el aviso. */
export function GuardaDelMotor({ children }: { children: ReactNode }) {
  const sinRespuesta = useMotorSinRespuesta();
  // Latido: con la app quieta ningún pedido falla y el aviso no salía. Con la pestaña a la vista,
  // cada LATIDO_DEL_MOTOR_MS se toca /api/system/health; si falla, `apiFetch` lo publica y la guarda
  // cambia la sección por el aviso. Con el aviso a la vista, los reintentos son los del aviso.
  useEffect(() => {
    if (sinRespuesta) return undefined;
    const id = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      apiHealth().catch(() => undefined);
    }, LATIDO_DEL_MOTOR_MS);
    return () => window.clearInterval(id);
  }, [sinRespuesta]);
  return sinRespuesta ? <ProcesamientoSinMotor /> : <>{children}</>;
}

export function ProcesamientoSinMotor() {
  const { pathname } = useLocation();
  const [intento, setIntento] = useState(0);
  const [restante, setRestante] = useState(() => esperaDelIntento(0));
  const [probando, setProbando] = useState(false);

  // Si responde, `apiFetch` lo publica y la guarda vuelve a montar la sección.
  const probar = useCallback(() => {
    setProbando(true);
    apiHealth().then(
      () => undefined,
      () => {
        setProbando(false);
        setIntento((n) => {
          const siguiente = n + 1;
          setRestante(esperaDelIntento(siguiente));
          return siguiente;
        });
      },
    );
  }, []);

  useEffect(() => {
    if (probando) return undefined;
    if (restante <= 0) {
      probar();
      return undefined;
    }
    const reloj = window.setTimeout(() => setRestante((s) => s - 1), 1000);
    return () => window.clearTimeout(reloj);
  }, [probando, restante, probar]);

  return (
    <PageFrame
      title="Procesamiento"
      headerMode="sr-only"
      density="compact"
      bodyMode="fill"
      layout="workbench"
      scrollOwner="panels"
      auditReady="procesamiento-sin-motor"
    >
      <div className="pulso-mesa-pestana-superficie pulso-sin-motor">
        <div className="pulso-mesa-pestana-marco">
          <CabeceraDePestana
            seccion="Procesamiento"
            titulo={seccionSinMotor(pathname)}
            icono={PlugZap}
            estado={{ tono: "parcial", texto: "Sin conexión" }}
          />
          <Panel className="pulso-sin-motor-panel">
            <ErrorBlock
              label="Se perdió la conexión con el motor de la app"
              causa="El motor de cálculo dejó de responder. Si no vuelve en un minuto, cierra la app y ábrela de nuevo."
              queda="Lo que ya estaba guardado en el proyecto no cambia."
              acciones={(
                <>
                  <span className="pulso-sin-motor-espera" role="status" data-intento={intento}>
                    <span className="pulso-states-spinner" aria-hidden="true" />
                    {textoDeEspera(restante, probando)}
                  </span>
                  <PulsoButton variant="primary" size="lg" disabled={probando} onClick={probar}>
                    <RefreshCw size={14} aria-hidden="true" />
                    Reintentar ahora
                  </PulsoButton>
                </>
              )}
            />
          </Panel>
        </div>
      </div>
    </PageFrame>
  );
}
