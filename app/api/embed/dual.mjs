// GET /embed/dual — host page for the side-by-side editor + preview demo.
// No backend state of its own; just serves the parent shell. Both iframes
// hit /c/new (one in create mode, one with ?preview=1) and share the same
// session so they see the same draft pins.

export async function get () {
  return { json: {} }
}
