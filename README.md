# PUPASKO Schedule

Shows which cast and crew are out of class at any time, their next class, the best
practice windows, and an auto-scheduled audition plan for theater practice.

- `src/data.js` holds everyone's schedule. Edit it when a schedule changes.
- Audition rules (3+ directors, 6 actors an hour, 8 AM–8 PM) are at the top of the
  Auditions section in `src/logic.js`.
- Built with Vite + React and [glisse](https://github.com/0kzh/glisse) (iOS 26 Liquid Glass).

## Run locally

    npm install
    npm run dev

## Deploy

Push to GitHub; Vercel detects Vite and redeploys (build `npm run build`, output `dist`).
