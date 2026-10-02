import { describe, expect, it } from "vitest";
import { readTheme, themeKey } from "@/lib/theme";

describe("theme preferences", () => {
  it("defaults user pages to Sand and admin to Night", () => {
    expect(readTheme(false)).toBe("sand");
    expect(readTheme(true)).toBe("night");
  });
  it("keeps preferences separate and accepts saved values", () => {
    expect(themeKey(false)).not.toBe(themeKey(true));
    expect(readTheme(false, { getItem: () => "night" })).toBe("night");
    expect(readTheme(true, { getItem: () => "sand" })).toBe("sand");
  });
  it("ignores invalid or inaccessible storage", () => {
    expect(readTheme(false, { getItem: () => "invalid" })).toBe("sand");
    expect(readTheme(true, { getItem: () => { throw new Error("Storage blocked"); } })).toBe("night");
  });
});
