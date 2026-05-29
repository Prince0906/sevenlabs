/**
 * Single source of truth for brand identity.
 *
 * The product was renamed from "Seven Labs" (a leftover voice-cloning/TTS
 * identity) to "Aloud" — voice-first FAANG interview prep. Render the brand
 * through these constants and the <Logo /> component so a future rename or a
 * domain change is a one-line edit.
 *
 * NOTE: `aloud.com` (Bauer Media) and the Google "Aloud" dubbing tool already
 * exist in the broader audio space; the bare .com is unavailable. The product
 * name is clear within interview prep, but pick a modified domain handle
 * (aloud.ai / tryaloud.com / aloud.app) and run a trademark check in the
 * edtech/software class before launch spend. `supportEmail` is a placeholder
 * pending the final domain.
 */
export const BRAND = {
  name: "Aloud",
  tagline: "Interview prep, out loud",
  supportEmail: "support@aloud.app",
} as const;
