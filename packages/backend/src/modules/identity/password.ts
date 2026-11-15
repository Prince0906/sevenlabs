import bcrypt from "bcryptjs";
import { hashPassword, verifyPassword } from "better-auth/crypto";

// Existing bcrypt hashes are copied byte-for-byte, never decoded or replaced
// during migration. New/reset passwords use Better Auth's current scrypt format.
export const hashIdentityPassword = hashPassword;

export async function verifyIdentityPassword(input: { hash: string; password: string }): Promise<boolean> {
  try {
    if (/^\$2[aby]\$/.test(input.hash)) return await bcrypt.compare(input.password, input.hash);
    return await verifyPassword(input);
  } catch {
    return false; // malformed stored hashes are authentication failures
  }
}
