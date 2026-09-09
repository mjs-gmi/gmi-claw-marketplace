// ─── Review mode ────────────────────────────────────────────────────────────
// One switch for every annotation this prototype carries for *us* rather than
// for the person using the product: V2 (new in this change set), NO API (no
// endpoint behind it yet), the open-question "?", and the R0/R1/IND release
// tags.
//
// Why it exists: none of those advance an operator's job. Someone who opens
// My Agents wants to know whether their sandboxes are alive, get into one, move
// a file, or stop paying — and a label saying "this tab is new in V2" or "the
// swagger does not cover this" makes the tab strip harder to scan while
// answering a question they never asked. Stamped on every tab at once they
// stopped being information and became noise.
//
// They are still worth keeping for review, so they live behind a flag instead
// of being deleted: `?review=1` on any URL turns them on for the session, and
// the build board at docs/design/v1.2/README.md carries the same facts in a
// place built for that audience.
const KEY = "gmi:review-mode";

function readFlag(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const q = new URLSearchParams(window.location.search).get("review");
    if (q === "1" || q === "true") { window.sessionStorage.setItem(KEY, "1"); return true; }
    if (q === "0" || q === "false") { window.sessionStorage.removeItem(KEY); return false; }
    return window.sessionStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

/** True only when someone has explicitly asked to see the annotations. */
export const REVIEW_MODE = readFlag();
