import { describe, expect, it } from "vitest";
import { SHARED_PACKAGE_NAME } from "./index.js";

describe("@gw/shared", () => {
  it("exports its package name", () => {
    expect(SHARED_PACKAGE_NAME).toBe("@gw/shared");
  });
});
