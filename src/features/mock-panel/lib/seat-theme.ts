import type { SignalLevel } from "@sevenlabs/shared-types";

/**
 * The panel's seniority climb IS the color: seat 0 amber (New Grad), seat 1
 * blue (SDE II), seat 2 emerald (Senior / Bar Raiser). Color signifies the
 * panel advancing through you, never decoration.
 */
export const SEAT_LEVELS: SignalLevel[] = ["NEW_GRAD", "SDE_II", "SENIOR"];

export const SIGNAL_CSS_VAR: Record<SignalLevel, string> = {
  NEW_GRAD: "var(--signal-newgrad)",
  SDE_II: "var(--signal-sde2)",
  SENIOR: "var(--signal-senior)",
};

export function seatLevel(index: number): SignalLevel {
  return SEAT_LEVELS[Math.min(index, SEAT_LEVELS.length - 1)] ?? "SDE_II";
}

/** Split a seeded persona name ("Maya — Builder (SDM)") into name + role. */
export function splitPersona(personaName: string): { name: string; role: string } {
  const [name, ...rest] = personaName.split("—");
  return { name: name?.trim() ?? personaName, role: rest.join("—").trim() };
}
