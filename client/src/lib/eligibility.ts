// ─── §A Sandbox entry switch ────────────────────────────────────────────────
// GET /eligibility → runtimes.sandbox.available.
//
// When it is false every Sandbox surface is ABSENT — the nav section, the
// routes, the entry points. Not disabled with an explanation: an organisation
// that cannot use the runtime should not learn it exists from a greyed-out menu
// item, and a disabled control with no path forward is only an invitation to
// file a ticket nobody can resolve.
//
// One module so the flag has a single home; the prototype has no network layer,
// so this is where the response would land.
export const SANDBOX_AVAILABLE = true;
