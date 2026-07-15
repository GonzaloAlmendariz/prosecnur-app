import { describe, expect, it } from "vitest";
import type { CargaUniverseVariable } from "../../api/client";
import {
  classifyUniverseValue,
  defaultUniverseFilterConfig,
  hasUniverseFilterChanges,
  normalizeUniverseFilterConfig,
  normalizeUniverseSummary,
  rankUniverseVariables,
  setUniverseValueClassification,
  summarizeUniverseValues,
  validateUniverseFilterConfig,
} from "./universeFilterModel";

describe("universe filter model", () => {
  it("normaliza resúmenes legacy vacíos sin romper la UI", () => {
    expect(normalizeUniverseSummary({})).toEqual({
      total: 0,
      included: 0,
      excluded_test: 0,
      excluded_unclassified: 0,
    });
  });

  it("starts disabled without silently selecting a variable or value", () => {
    expect(defaultUniverseFilterConfig()).toEqual({
      version: 1,
      enabled: false,
      variable: "",
      real_values: [],
      test_values: [],
      missing_policy: "exclude",
      unassigned_policy: "unclassified",
    });
  });

  it("normalizes classifications as disjoint sets", () => {
    const config = normalizeUniverseFilterConfig({
      enabled: true,
      variable: " testreal ",
      real_values: ["real", "real"],
      test_values: ["real", "test", ""],
    });
    expect(config.variable).toBe("testreal");
    expect(config.real_values).toEqual(["real"]);
    expect(config.test_values).toEqual(["test"]);
  });

  it("moves a value atomically between real, test and unclassified", () => {
    let config = defaultUniverseFilterConfig();
    config = setUniverseValueClassification(config, "1", "real");
    expect(classifyUniverseValue(config, "1")).toBe("real");
    config = setUniverseValueClassification(config, "1", "test");
    expect(config.real_values).toEqual([]);
    expect(classifyUniverseValue(config, "1")).toBe("test");
    config = setUniverseValueClassification(config, "1", "unclassified");
    expect(classifyUniverseValue(config, "1")).toBe("unclassified");
  });

  it("produces mutually exclusive counts that sum to the original total", () => {
    const config = {
      ...defaultUniverseFilterConfig(),
      enabled: true,
      variable: "testreal",
      real_values: ["real"],
      test_values: ["test"],
    };
    const summary = summarizeUniverseValues([
      { value: "real", count: 427 },
      { value: "test", count: 2 },
      { value: "", count: 1, missing: true },
    ], config);
    expect(summary).toEqual({ total: 430, included: 427, excluded_test: 2, excluded_unclassified: 1 });
    expect(summary.included + summary.excluded_test + summary.excluded_unclassified).toBe(summary.total);
  });

  it("validates enabled configs and compares multi-value order semantically", () => {
    const config = defaultUniverseFilterConfig();
    config.enabled = true;
    expect(validateUniverseFilterConfig(config)).toContain("variable");
    config.variable = "testreal";
    expect(validateUniverseFilterConfig(config)).toContain("real");
    config.real_values = ["2", "1"];
    const reordered = structuredClone(config);
    reordered.real_values.reverse();
    expect(validateUniverseFilterConfig(config)).toBeNull();
    expect(hasUniverseFilterChanges(config, reordered)).toBe(false);
  });

  it("only ranks suggestions and leaves selection to the user", () => {
    const variables: CargaUniverseVariable[] = [
      { variable: "notes", type: "character", n_distinct: 99 },
      { variable: "testreal", type: "character", n_distinct: 2 },
    ];
    expect(rankUniverseVariables(variables)[0]?.variable).toBe("testreal");
    expect(defaultUniverseFilterConfig().variable).toBe("");
  });
});
