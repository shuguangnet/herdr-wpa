/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchSnapshot } from "./App";

const httpUrl = (path: string) => `http://bridge${path}`;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchSnapshot", () => {
  it("includes the bridge error body so daemon failures can be classified", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ error: "herdr daemon socket not found" }), {
          status: 502,
          headers: { "content-type": "application/json" },
        }),
      ),
    );
    await expect(fetchSnapshot(httpUrl)).rejects.toThrow(/herdr daemon socket not found/);
  });

  it("keeps the status code when the body is not JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("bad gateway", { status: 502 })),
    );
    await expect(fetchSnapshot(httpUrl)).rejects.toThrow(/502: bad gateway/);
  });

  it("returns null for a 304 and the payload with its etag otherwise", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 304 })));
    await expect(fetchSnapshot(httpUrl, '"v1"')).resolves.toBeNull();

    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({ workspaces: [], tabs: [], panes: [], layouts: [] }),
            { status: 200, headers: { etag: 'W/"v2"' } },
          ),
      ),
    );
    await expect(fetchSnapshot(httpUrl)).resolves.toMatchObject({ etag: 'W/"v2"' });
  });
});
