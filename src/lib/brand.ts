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
 * name is clear within interview prep, but run a trademark check in the
 * edtech/software class before launch spend. The product is served from
 * `aloud.sevenlabs.tech` (subdomain of the owned `sevenlabs.tech`); change the
 * handle here in one line if the brand domain moves.
 */
export const BRAND = {
  name: "Aloud",
  tagline: "Interview prep, out loud",
  supportEmail: "support@sevenlabs.tech",
} as const;
