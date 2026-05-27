import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  },
}));

vi.mock("bcryptjs", () => ({
  default: { hash: vi.fn().mockResolvedValue("hashed-password") },
}));

import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";
import { POST } from "@/app/api/auth/register/route";

function jsonRequest(body: unknown): Request {
  return new Request("http://localhost/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/auth/register", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects invalid email", async () => {
    const res = await POST(jsonRequest({ email: "not-an-email", password: "abcdefgh" }));
    expect(res.status).toBe(400);
  });

  it("rejects too-short password", async () => {
    const res = await POST(jsonRequest({ email: "ok@example.com", password: "short" }));
    expect(res.status).toBe(400);
  });

  it("rejects when email is already taken", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({ id: "u1" } as never);

    const res = await POST(
      jsonRequest({ email: "taken@example.com", password: "validpass1" })
    );
    expect(res.status).toBe(409);
  });

  it("hashes password and creates the user", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null);
    vi.mocked(prisma.user.create).mockResolvedValueOnce({
      id: "u-new",
      email: "new@example.com",
      name: "New User",
    } as never);

    const res = await POST(
      jsonRequest({ email: "NEW@Example.com", password: "validpass1", name: "New User" })
    );

    expect(res.status).toBe(200);
    expect(bcrypt.hash).toHaveBeenCalledWith("validpass1", 10);
    expect(prisma.user.create).toHaveBeenCalledWith({
      data: {
        email: "new@example.com", // normalized lowercase
        name: "New User",
        passwordHash: "hashed-password",
      },
      select: { id: true, email: true, name: true },
    });

    const body = await res.json();
    expect(body.user.email).toBe("new@example.com");
  });
});
