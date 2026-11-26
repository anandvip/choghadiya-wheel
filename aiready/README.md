# Choghadiya Wheel · AI-ready preview

**Page:** https://wheel.vipulanand.in/aiready/

A copy of the live wheel (`../index.html`) with two additions. Nothing outside this folder changed, and the engine here is
byte-for-byte the live one (`aiready/test/aiready.test.mjs` fails if they ever differ).

## WebMCP tools for AI agents

In a browser with WebMCP (the W3C Community Group draft of 24 Nov 2026, `document.modelContext.registerTool`, with a fallback to
`navigator.modelContext` as in Chrome's origin trial), the page registers:

| Tool | What it answers |
|---|---|
| `get_current_choghadiya` | The choghadiya at a moment (default now): name, meaning, quality, start, end, minutes left, overlays, clean or not, and the next clean window |
| `get_choghadiya_for_date` | Sunrise, sunset and all 16 slots for a Vedic day, with Rahu Kaal, Yamaganda, Gulika, Vaar Vela, Kaal Vela and Kaal Ratri; `onlyClean` for just the clean windows |
| `find_next_clean_muhurat` | The next clean Amrit, Shubh or Labh windows, up to 7 Vedic days ahead, with optional minimum length and names |
| `show_on_wheel` | Points the visible wheel at a date and moment, so the person sees what the agent is talking about (changes only the view) |

All take optional `lat`, `lon` and `tzOffsetMinutes`; the default is Pipli, Kurukshetra (29.9775 N, 76.8928 E) in IST. The first three are
read-only. No tool makes a network call, reads the focus tasks or asks for location. Browsers without WebMCP skip registration and the page
works as before. For agents that only fetch HTML, the `<head>` has a JSON-LD summary and a link to `../api/index.json`.

Chrome only exposes WebMCP to sites in its origin trial, or with `chrome://flags/#enable-webmcp-testing` for local testing.

## Interactive wheel

- **Tap or drag** on the ring to look at any moment; the needle, centre card, slot card and next clean slot follow. Tap the centre, press
  **Esc** or **Back to now** to return.
- **Hover** (mouse) shows the slot under the pointer with its times and overlays.
- **Keyboard:** focus the wheel with Tab, then **↑ / ↓** step through the 16 slots. **← / →** and **T** work as on the main wheel.
- **Table rows** in "All 16 slots" are tappable and show that slot on the wheel.
- **Ask the wheel · AI tools** runs the same tools an agent would, for the moment and place on the wheel, and shows the JSON.

## Tests

`npm test` from the repo root runs these too: engine parity, every tool answer against every `api/` file, error handling, and the whole
page in a small fake DOM (tap, drag, keyboard, table rows, tools panel, `show_on_wheel`).
