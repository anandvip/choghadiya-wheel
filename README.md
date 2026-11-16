# Choghadiya Wheel

**Live page:** https://anandvip.github.io/choghadiya-wheel/

A one-page choghadiya wheel. It reads your device's clock and shows which choghadiya is active right now, how long it has left, and whether a Vaar Vela, Kaal Vela, Kaal Ratri, Rahu Kaal, Yamaganda or Gulika falls on it. You can also look at any past or future date.

## How to use

- Open the live page. The needle points at the current time and the **current active slot** is outlined, with a card in the middle of the wheel and a fuller card beside or below it.
- Use **◀ / ▶** for the previous or next day, pick any date in the date box, or press **Today** to come back. On another date, the page shows the slot that matches the same clock time on that day.
- Keyboard: **← / →** for the previous or next day and **T** for today (ignored while you're typing in a field).
- Link parameters: `?date=YYYY-MM-DD` opens a date, and `&lat=..&lon=..` (decimal degrees) sets the place, for example `?date=2026-11-21&lat=26.9124&lon=75.7873`. Times stay in IST. Anything invalid falls back to today and Pipli. `?mode=fallback` still forces the fallback renderer.
- The default place is **Pipli, Kurukshetra** (29.9775 N, 76.8928 E, IST). **Use my location** reads your position once in the browser, for that visit only. It is never stored or sent anywhere.
- Below the wheel is a table of all 16 slots, with their overlays, and a **next clean slot** line.
- Times are shown in your device's time zone, rounded to the nearest minute, as Drik Panchang does. The page refreshes itself every 30 seconds and works offline once loaded.

## API for bots

Every date from 2026-11-16 to 2027-12-31 has a ready-made file for **Pipli**, so a bot can read today's choghadiya without opening a browser:

```sh
curl -s https://anandvip.github.io/choghadiya-wheel/api/$(TZ=Asia/Kolkata date +%F).txt
```

- `api/YYYY-MM-DD.txt` is a small readable table (about 700 bytes): sunrise, sunset, and the 16 slots with their overlays, with `clean` marking a clean slot.
- `api/YYYY-MM-DD.json` has the same data (about 3 KB): `date`, `weekday`, `location`, `tz` (`Asia/Kolkata`), `sunrise`, `sunset`, `nextSunrise`, 8 `day` and 8 `night` slots (`name`, `quality`, `start`, `end`, `overlays`, `isClean`), the `overlays` windows, and `generatedFrom` (the index.html commit and an engine hash). Times are ISO 8601 with `+05:30`.
- `api/index.json` lists the range and the URL pattern.
- **Before sunrise:** a Vedic day runs from sunrise to sunrise. If the time now is before that date's sunrise, use the **previous date's file** and its night slots.
- The location is **Pipli only** (29.9775 N, 76.8928 E). For anywhere else, open the page with `?lat=&lon=`.
- GitHub Pages caches files for about 10 minutes. That doesn't matter here, because a date's file never changes.
- The files are generated from the same engine as the page. To extend the range or rebuild after an engine change, run `node scripts/build-api.mjs` (about once a year; it needs only Node), commit `api/`, and push. `npm test` fails if the files no longer match the engine.

## Reading the wheel

- The wheel is a 24-hour clock: midnight at the bottom, noon at the top. The 8 day slots run from sunrise to sunset, and the 8 night slots from sunset to the next sunrise. Night slots are shaded darker.
- Colours: dark green = Amrit (best), green = Shubh and Labh (good), amber = Chal (neutral), red = Udveg, Kaal and Rog (avoid).
- A red inner arc and a short code under the name mark an overlay: **VV** Vaar Vela, **KV** Kaal Vela, **KR** Kaal Ratri, **RK** Rahu Kaal, **YG** Yamaganda, **GK** Gulika.
- A **clean slot** is Amrit, Shubh or Labh with none of these overlays, lasting at least 20 minutes. Chal is neutral and doesn't count as clean.
- A Vedic day runs from sunrise to sunrise. In the hours before sunrise, the active slot belongs to the **previous day's night**, including its Kaal Ratri, so the wheel shows the previous day then.

## Method

- **Sunrise and sunset** are calculated in the browser for the apparent upper limb of the Sun with standard refraction, the Drik Panchang convention, using the NOAA/Meeus solar formulas. Nothing is downloaded or scraped.
- **Choghadiya:** the day (sunrise to sunset) and the night (sunset to next sunrise) are each split into 8 equal parts. Each part is named by its planet lord in the hora order Sun, Venus, Mercury, Moon, Saturn, Jupiter, Mars, giving Udveg, Chal, Labh, Amrit, Kaal, Shubh, Rog. The day starts with the weekday's lord. The night starts with the lord of the fifth weekday from it and steps back two places each time.
- **Overlays**, by eighth of the day or night:

  | Weekday | Vaar Vela (day) | Kaal Vela (day) | Kaal Ratri (night) | Rahu Kaal | Yamaganda | Gulika |
  |---|---|---|---|---|---|---|
  | Sunday | 4 | 5 | 6 | 8 | 5 | 7 |
  | Monday | 7 | 2 | 4 | 2 | 4 | 6 |
  | Tuesday | 2 | 6 | 2 | 7 | 3 | 5 |
  | Wednesday | 5 | 3 | 7 | 5 | 2 | 4 |
  | Thursday | 8 | 7 | 5 | 6 | 1 | 3 |
  | Friday | 3 | 4 | 3 | 4 | 7 | 2 |
  | Saturday | 6 | 1 and 8 | 1 and 8 | 3 | 6 | 1 |

- **HTML-in-Canvas:** in Chrome or Edge 157 and later, the slot labels and the centre card are real HTML drawn into the canvas with `drawElementImage()`, so they stay selectable, translatable and readable by screen readers. Other browsers, such as Safari and Firefox, get a fallback: plain canvas text with the centre card floating over the wheel. A badge at the top says which mode is active.

## Checks

The logic is a direct port of the Swiss Ephemeris panchang engine used for the daily briefs, including the Vaar Vela, Kaal Vela and Kaal Ratri changes made on 14 Nov 2026. Before publishing, the page was compared with:

- **The engine, on 12 dates from 2025 to 2030** (including Saturdays, 21 June and 21 December). Sunrise, sunset, all 16 slot boundaries and every overlay agreed within 0.13 minutes, with no name or overlay mismatches.
- **Drik Panchang's choghadiya tables for Thanesar on 1, 2 and 4 Nov 2026.** All names and Vela/Kaal Ratri markers matched, and times agreed within 0.6 minutes. Drik shows whole minutes.

- **Automated tests** (`npm test`, no dependencies): the engine against frozen Swiss Ephemeris fixtures for 12 dates (sunrise, sunset and slot boundaries within 1 minute), every overlay against the table above, clean slots never overlapping an overlay, and every API file against a fresh engine run. Run them with `npm test` before pushing.

## Sources

- Drik Panchang choghadiya tables and Vela conventions, used only to check results
- NOAA Solar Calculator equations (after Jean Meeus, *Astronomical Algorithms*)
- Chrome's HTML-in-Canvas documentation: https://developer.chrome.com/docs/web-platform/html-in-canvas/2d

## Disclaimer

For reference only; calculated, not scraped. Choghadiya is a traditional timing guide, not advice. Times can differ by a minute or two from printed panchangs because of rounding, exact location and the local horizon. At extreme latitudes, some dates have no sunrise or sunset, and choghadiya isn't defined then.

Created: 14 November 2026.
