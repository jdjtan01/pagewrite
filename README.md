# Pagewright

A browser-based PDF editor: fill forms, sign, edit text, annotate, rearrange pages, find text, and export to PDF, Word, images, text or HTML.

Everything runs in the browser tab. There is no build step and no backend.

## Files

```
index.html       page structure
css/styles.css   styles (light, dark and violet themes)
css/fonts.css    @font-face rules for the bundled fonts
js/app.js        application code
vendor/          PDF.js, pdf-lib, JSZip and Tesseract (OCR), with licences
icons/, manifest.webmanifest, sw.js   installable, offline-capable app
fonts/           bundled fonts (SIL Open Font License)
```

Everything is bundled, including the OCR engine and English language data, so the site makes no requests to other domains. After the first visit it works offline, and it can be installed from the browser's menu.

## Run locally

Open `index.html` in a browser, or serve the folder:

```
python3 -m http.server 8000
```

## Deploy on GitHub Pages

1. Push these files to a repository, keeping the folder layout.
2. In the repository, open **Settings > Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**, select your branch and the `/ (root)` folder, then save.
4. The site appears at `https://<your-username>.github.io/<repository>/`.

## Features worth knowing

- **Redact** removes content for good. On PDF export, any page with a redaction is converted to a flat image with the box burned in. Those pages lose selectable text and form fields. **Whiteout** only covers content visually; the text underneath stays in the file.
- **Autosave** stores your open document and edits in the browser's IndexedDB. The next time you open the site with nothing loaded, a button offers to restore it. Nothing leaves the browser.
- **Shapes** (rectangle, ellipse, line, arrow) and **stamps** (Approved, Paid, Draft and others) are in the tool rail.

## Notes

- Arial, Times New Roman and Courier New are exported using the matching standard PDF fonts (Helvetica, Times, Courier), which have the same letter widths.
- Saved signatures and the theme choice are stored in the browser's local storage.

## Privacy

Documents are processed entirely in the browser tab and are never uploaded. Autosave data, saved signatures and the theme choice stay in your browser's own storage. Clearing site data removes them.

## Updating the site

`sw.js` serves files from a cache and refreshes them in the background, so a new deploy appears on the next visit after the one that loads it. If you remove or rename a file, change the `CACHE` name at the top of `sw.js`.

## Licence

The app code is under the MIT licence (see `LICENSE`; put your own name in the copyright line). Bundled libraries and fonts keep their own licences: see `vendor/LICENSES.txt` and the font notes in `css/fonts.css`.
