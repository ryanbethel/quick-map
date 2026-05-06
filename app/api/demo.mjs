// GET /demo — kitchen-sink page.
//
// Returns nothing meaningful in `json` (the page hardcodes its own demo
// state). Exists only so the file-based router has an `api` partner to the
// page template.

export async function get () {
  return { json: {} }
}
