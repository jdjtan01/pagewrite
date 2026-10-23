# Pagewright

A browser-based PDF editor: fill forms, sign, edit text, annotate, rearrange pages, find text, and export to PDF, Word, images, text or HTML.

Everything runs in the browser tab. There is no build step and no backend.

## Files

```
index.html       page structure
css/styles.css   styles (light, dark and violet themes)
js/app.js        application code
```

PDF.js, pdf-lib and JSZip load from cdnjs, and fonts load from Google Fonts. The app needs an internet connection the first time it loads.

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

## Notes

- Arial, Times New Roman and Courier New are exported using the matching standard PDF fonts (Helvetica, Times, Courier), which have the same letter widths.
- Saved signatures and the theme choice are stored in the browser's local storage.
