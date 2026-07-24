import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  GlidingRadioGroup,
  commitGlidingRadioValue,
  resolveGlidingRadioValue,
} from "./GlidingRadioGroup";

const options = [
  { key: "auto", label: "Automática" },
  { key: "manual", label: "Manual" },
] as const;

describe("GlidingRadioGroup", () => {
  it("renders one exclusive, measurable radio per option", () => {
    const html = renderToStaticMarkup(
      <GlidingRadioGroup
        value="auto"
        options={options}
        getOptionValue={(option) => option.key}
        onValueChange={() => undefined}
        aria-label="Modo"
        className="mode-selector"
        getOptionProps={(option) => ({ disabled: option.key === "manual" })}
      >
        {(option) => option.label}
      </GlidingRadioGroup>,
    );

    expect(html).toContain('role="radiogroup"');
    expect(html).toContain('aria-label="Modo"');
    expect(html).toContain('class="pulso-gliding-tab-list mode-selector"');
    expect(html).toContain('role="radio"');
    expect(html).toContain('data-gliding-key="auto"');
    expect(html).toContain('aria-checked="true"');
    expect(html).toContain('class="is-active"');
    expect(html).toContain("disabled");
  });

  it("resolves string and boolean option values from roving keys", () => {
    expect(resolveGlidingRadioValue(options, (option) => option.key, "manual")).toBe("manual");
    expect(resolveGlidingRadioValue([true, false], (option) => option, "false")).toBe(false);
    expect(
      resolveGlidingRadioValue(
        [true, false],
        (option) => option,
        "warn",
        (option) => (option ? "enforce" : "warn"),
      ),
    ).toBe(false);
    expect(resolveGlidingRadioValue(options, (option) => option.key, "missing")).toBeNull();
  });

  it("does not notify when the selected value is already current", () => {
    const onValueChange = vi.fn();

    commitGlidingRadioValue("auto", "auto", onValueChange);
    expect(onValueChange).not.toHaveBeenCalled();

    commitGlidingRadioValue("auto", "manual", onValueChange);
    expect(onValueChange).toHaveBeenCalledOnce();
    expect(onValueChange).toHaveBeenCalledWith("manual");
  });
});
