import { describe, expect, it } from "vitest";
import bcrypt from "bcryptjs";
import { hashIdentityPassword, verifyIdentityPassword } from "../modules/identity/password";

describe("password hash migration compatibility", () => {
  it("authenticates the existing bcrypt format without rewriting the hash", async () => {
    const hash = await bcrypt.hash("legacy-user-password", 10);
    expect(await verifyIdentityPassword({ hash, password: "legacy-user-password" })).toBe(true);
    expect(await verifyIdentityPassword({ hash, password: "wrong-password" })).toBe(false);
    expect(hash.startsWith("$2b$10$")).toBe(true);
  });

  it("uses the library format for new passwords", async () => {
    const hash = await hashIdentityPassword("new-user-password");
    expect(hash.startsWith("$2")).toBe(false);
    expect(await verifyIdentityPassword({ hash, password: "new-user-password" })).toBe(true);
    expect(await verifyIdentityPassword({ hash, password: "wrong-password" })).toBe(false);
  });

  it.each(["", "$2b$invalid", "not-a-password-hash"])("rejects malformed hash %s", async (hash) => {
    expect(await verifyIdentityPassword({ hash, password: "password" })).toBe(false);
  });
});
