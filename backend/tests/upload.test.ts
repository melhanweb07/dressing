import { describe, expect, it } from "vitest";
import { extensionFromMagic } from "../src/controllers/upload.controller.js";

describe("image magic-byte validation", () => {
  it("recognizes JPEG, PNG, and WebP files", () => {
    expect(extensionFromMagic(Buffer.from([0xff, 0xd8, 0xff, 0x00]))).toEqual({ mime: "image/jpeg", extension: "jpg" });
    expect(extensionFromMagic(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))).toEqual({ mime: "image/png", extension: "png" });
    expect(extensionFromMagic(Buffer.from("RIFF0000WEBP", "ascii"))).toEqual({ mime: "image/webp", extension: "webp" });
  });

  it("rejects unsupported or mismatched content", () => {
    expect(extensionFromMagic(Buffer.from("<svg></svg>"))).toBeNull();
    const jpeg = extensionFromMagic(Buffer.from([0xff, 0xd8, 0xff]));
    expect(jpeg?.mime).not.toBe("image/svg+xml");
  });
});
