// Plain server-rendered directions form. No client JS, no geolocation.
// Server geocodes both addresses and asks Valhalla for the route.
export default function requestDirections ({ html, state }) {
  const directions = state.store?.directions
  const start = directions?.startAddress || ''
  const end = directions?.endAddress || ''

  return html`
<style>
  .directions-panel {
    background-color: rgba(255, 255, 255, 0.95);
    border: 1px solid #cccccc;
    border-radius: 8px;
    padding: 8px;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.2);
    width: 280px;
    max-width: calc(100dvw - 20px);
    box-sizing: border-box;
    color: #111111;
  }

  .directions-panel form {
    margin: 0;
    display: grid;
    grid-template-columns: 56px 1fr;
    gap: 6px;
    align-items: center;
  }

  .directions-panel label {
    font-size: 14px;
    color: #444444;
  }

  .directions-panel input {
    width: 100%;
    height: 32px;
    padding: 0 8px;
    box-sizing: border-box;
    background-color: #ffffff;
    color: #111111;
    border: 1px solid #cccccc;
    border-radius: 4px;
    font: inherit;
  }

  .directions-panel input::placeholder {
    color: #999999;
  }

  .directions-panel .actions {
    grid-column: 1 / -1;
    display: flex;
    gap: 6px;
    justify-content: flex-end;
    margin-top: 4px;
  }

  .directions-panel button {
    height: 32px;
    padding: 0 12px;
    background-color: #ffffff;
    color: #111111;
    border: 1px solid #cccccc;
    border-radius: 9999px;
    font: inherit;
    cursor: pointer;
  }

  .directions-panel button[type="submit"] {
    background-color: #0066ff;
    color: #ffffff;
    border-color: #0066ff;
  }

  .directions-panel button:hover {
    filter: brightness(0.95);
  }
</style>

<div class="directions-panel">
  <form action="/directions" method="POST" autocomplete="off">
    <label for="dir-start">Start</label>
    <input id="dir-start" name="start_address" type="text" placeholder="Starting address" value="${start}" required>

    <label for="dir-end">End</label>
    <input id="dir-end" name="end_address" type="text" placeholder="Destination address" value="${end}" required>

    <div class="actions">
      ${directions ? `<button type="submit" formaction="/directions/clear" formnovalidate>Clear</button>` : ''}
      <button type="submit">Get directions</button>
    </div>
  </form>
</div>
`
}
