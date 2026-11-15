// Temporary coordinated cutover switch. Build and run Next with the same value;
// remove the legacy branch only after the Phase 2 end-to-end gates pass.
export const backendAuthEnabled = process.env.NEXT_PUBLIC_BACKEND_AUTH === "true";

export function safeAuthRedirect(value?: string) {
  if (!value?.startsWith("/") || value.startsWith("//") || /[\\\x00-\x20]/.test(value)) return "/dashboard";
  return value;
}
