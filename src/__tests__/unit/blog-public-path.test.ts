import { describe, it, expect } from "vitest";
import { authConfig } from "@/auth.config";

type Authorized = (args: {
  auth: { user?: { id: string } } | null;
  request: { nextUrl: URL };
}) => boolean;

const authorized = authConfig.callbacks.authorized as unknown as Authorized;
const call = (pathname: string, signedIn = false) =>
  authorized({
    auth: signedIn ? { user: { id: "u1" } } : null,
    request: { nextUrl: new URL(`https://aloud.test${pathname}`) },
  });

describe("public paths", () => {
  it("lets signed-out visitors read the blog", () => {
    expect(call("/blog")).toBe(true);
    expect(call("/blog/voice-latency")).toBe(true);
  });

  it("still protects the app", () => {
    expect(call("/interview")).toBe(false);
    expect(call("/dashboard")).toBe(false);
    expect(call("/interview", true)).toBe(true);
  });
});
