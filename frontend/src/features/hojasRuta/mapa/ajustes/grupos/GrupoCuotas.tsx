import type { HojasRutaAgeRange, HojasRutaIntegratedConfig } from "../../../../../api/hojasRuta";
import { PulsoSwitch } from "../../../../../components/PulsoSwitch";
import type { ResumenMatriz } from "../../poblacion/matriz";
import { PoblacionEstructura } from "../../poblacion/PoblacionPaneles";

type Props = {
  config: HojasRutaIntegratedConfig;
  rangosConfig: readonly HojasRutaAgeRange[];
  matriz: ResumenMatriz;
  bloqueado: boolean;
  guardando: boolean;
  onGuardarYCalcular: (cambios: Partial<HojasRutaIntegratedConfig>) => void;
  onGuardarCaracter: (caracter: NonNullable<HojasRutaIntegratedConfig["caracter_cuotas"]>) => void;
};

/**
 * Grupo 4 de «Ajustes del diseño», Cuotas y edades (M4): la edición de los rangos (manual o por cortes, con
 * sus presets), dividir por sexo y qué se exige en campo, mudados de Población. Los rangos van al borrador
 * (`rangosBorrador`/`cortesBorrador`) y se aplican con el pie; sexo y carácter se guardan al tocarlos, como
 * antes de la mudanza.
 */
export function GrupoCuotas({ config, rangosConfig, matriz, bloqueado, guardando, onGuardarYCalcular, onGuardarCaracter }: Props) {
  const sexo = config.subquota_var !== "ninguna";
  const caracter = config.caracter_cuotas ?? {};
  const declarar = (dim: "sexo" | "edad", referencial: boolean) => onGuardarCaracter({ ...caracter, [dim]: referencial ? "referencial" : "meta" });
  const ed = bloqueado || guardando;
  return (
    <div className="hr-ajustes-grupo-cuerpo">
      <section className="hr-ajustes-bloque hr-ajustes-rangos" aria-label="Rangos de edad">
        <PoblacionEstructura rangosConfig={rangosConfig} config={config} matriz={matriz} bloqueado={bloqueado} />
      </section>
      <section className="hr-ajustes-bloque" aria-label="Sexo">
        <h4>Sexo</h4>
        <PulsoSwitch label="Dividir por sexo" size="sm" checked={sexo} disabled={ed} onCheckedChange={(v) => onGuardarYCalcular({ subquota_var: v ? "sexo" : "ninguna" })} />
      </section>
      <section className="hr-ajustes-bloque" aria-label="Qué se exige en campo">
        {/* ADR 0126: qué de la cuota se exige y qué sólo se describe. El total de cada zona siempre se exige. */}
        <h4>Qué se exige en campo</h4>
        {sexo ? <PulsoSwitch label="Sexo como referencia, sin exigirlo" size="sm" checked={caracter.sexo === "referencial"} disabled={ed} onCheckedChange={(v) => declarar("sexo", v)} /> : null}
        <PulsoSwitch label="Edad como referencia, sin exigirla" size="sm" checked={caracter.edad === "referencial"} disabled={ed} onCheckedChange={(v) => declarar("edad", v)} />
        <p className="hr-mapa-nota">El total de cada zona siempre se exige.</p>
      </section>
    </div>
  );
}
