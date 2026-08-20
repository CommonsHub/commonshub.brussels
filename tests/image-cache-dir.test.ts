/**
 * @jest-environment node
 */

import path from "path";
import { afterEach, describe, expect, jest, test } from "@jest/globals";

describe("image cache dir fallback", () => {
  afterEach(() => {
    delete process.env.IMAGE_PROXY_CACHE_DIR;
    jest.resetModules();
    jest.clearAllMocks();
    jest.unmock("fs");
    jest.unmock("os");
    jest.unmock("sharp");
    jest.unmock("@/lib/data-paths");
  });

  // The cache lives under RUNTIME_DIR (never DATA_DIR, which is read-only).
  const PREFERRED_DIR = path.resolve("/tmp/commonshub/image-proxy");

  test("falls back to OS tmp when the preferred cache dir is not writable", async () => {
    const existsSync = jest.fn((target) => target === PREFERRED_DIR);
    const statSync = jest.fn(() => ({ isDirectory: () => true }));
    const mkdirSync = jest.fn<any>();
    const accessSync = jest.fn((target) => {
      if (target === PREFERRED_DIR) {
        const error = new Error("EROFS");
        (error as NodeJS.ErrnoException).code = "EROFS";
        throw error;
      }
    });

    jest.doMock("fs", () => ({
      __esModule: true,
      default: {
        existsSync,
        statSync,
        mkdirSync,
        accessSync,
        constants: { W_OK: 2 },
      },
    }));
    jest.doMock("os", () => ({
      __esModule: true,
      default: {
        tmpdir: () => "/tmp",
      },
    }));
    jest.doMock("sharp", () => ({
      __esModule: true,
      default: jest.fn<any>(),
    }));

    const { getImageCacheDir } = await import("@/lib/image-proxy-server");

    expect(getImageCacheDir()).toBe(path.resolve("/tmp/commonshub-image-proxy"));
    expect(mkdirSync).toHaveBeenCalledWith(
      path.resolve("/tmp/commonshub-image-proxy"),
      { recursive: true }
    );
  });

  test("still resizes when no cache dir is writable", async () => {
    const existsSync = jest.fn(() => false);
    const mkdirSync = jest.fn(() => {
      const error = new Error("EROFS");
      (error as NodeJS.ErrnoException).code = "EROFS";
      throw error;
    });
    const accessSync = jest.fn<any>();
    const sharpChain = {
      rotate: jest.fn<any>().mockReturnThis(),
      resize: jest.fn<any>().mockReturnThis(),
      jpeg: jest.fn<any>().mockReturnThis(),
      toBuffer: jest.fn<any>().mockResolvedValue(Buffer.from("resized-image")),
    };

    jest.doMock("fs", () => ({
      __esModule: true,
      default: {
        existsSync,
        mkdirSync,
        accessSync,
        constants: { W_OK: 2 },
      },
    }));
    jest.doMock("os", () => ({
      __esModule: true,
      default: {
        tmpdir: () => "/tmp",
      },
    }));
    jest.doMock("sharp", () => ({
      __esModule: true,
      default: jest.fn(() => sharpChain),
    }));

    const { resizeAndCacheImage } = await import("@/lib/image-proxy-server");

    const result = await resizeAndCacheImage(Buffer.from("source-image"), "image-id", "sm");

    expect(result).toEqual(Buffer.from("resized-image"));
    expect(sharpChain.rotate).toHaveBeenCalled();
    expect(sharpChain.resize).toHaveBeenCalled();
  });
});
