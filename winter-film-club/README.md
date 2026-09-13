# Winter Film Club

A simple one-page film club for Steph, Elliot, Dan and Wendy.

## How it works

1. Each person gets **2 guaranteed picks** = 8 films.
2. Anyone can suggest wildcard films.
3. Each person gets **5 bidding tokens**.
4. The two wildcard films with the most tokens become films 9 and 10.
5. Everyone marks films as watched individually.
6. When **all 4 people** have watched a film, its score/review panel unlocks.
7. Each person gives a score out of 10 and an optional short review.
8. The season table ranks films by current average score.

## Run it

Open `index.html` in a browser, or serve the folder with any simple web server.

For example in a Codespace terminal:

```bash
python3 -m http.server 8000
```

Then open port 8000.

## Important: current storage

This version uses `localStorage`, so it saves on **one browser/device only**.

That is deliberate for the first visual prototype. To let Steph, Elliot, Dan and Wendy all use the same live page on separate phones, the next step is to replace localStorage with a small shared database such as Supabase or Firebase, then deploy the static page on GitHub Pages / Netlify / Vercel.

The UI and data model are already arranged so that upgrade is straightforward.
