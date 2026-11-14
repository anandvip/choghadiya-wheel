# Choghadiya Wheel

**Live page:** https://anandvip.github.io/choghadiya-wheel/

A one-page choghadiya wheel. It reads your device's clock and shows which choghadiya is active right now, how long it has left, and whether a Vaar Vela, Kaal Vela, Kaal Ratri, Rahu Kaal, Yamaganda or Gulika falls on it. You can also look at any past or future date.

## How to use

- Open the live page. The needle points at the current time and the **current active slot** is outlined, with a card in the middle of the wheel and a fuller card beside or below it.
- Use **◀ / ▶** for the previous or next day, pick any date in the date box, or press **Today** to come back. On another date, the page shows the slot that matches the same clock time on that day.
- The default place is **Pipli, Kurukshetra** (29.9775 N, 76.8928 E, IST). **Use my location** reads your position once in the browser, for that visit only. It is never stored or sent anywhere.
- Below the wheel is a table of all 16 slots, with their overlays, and a **next clean slot** line.
- Times are shown in your device's time zone, rounded to the nearest minute, as Drik Panchang does. The page refreshes itself every 30 seconds and works offline once loaded.

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

## Sources

- Drik Panchang choghadiya tables and Vela conventions, used only to check results
- NOAA Solar Calculator equations (after Jean Meeus, *Astronomical Algorithms*)
- Chrome's HTML-in-Canvas documentation: https://developer.chrome.com/docs/web-platform/html-in-canvas/2d

## Disclaimer

For reference only; calculated, not scraped. Choghadiya is a traditional timing guide, not advice. Times can differ by a minute or two from printed panchangs because of rounding, exact location and the local horizon. At extreme latitudes, some dates have no sunrise or sunset, and choghadiya isn't defined then.

Created: 14 November 2026.
