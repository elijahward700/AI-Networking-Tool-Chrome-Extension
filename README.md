# AI Networking Tool Chrome Extension

A Chrome extension for capturing and analyzing web articles, matching them with contacts based on AI-generated tags.

## Project Structure

```
.
├── src/
│   ├── js/
│   │   ├── background.js    # Background service worker
│   │   ├── content.js       # Content scripts
│   │   └── popup.js         # Popup interface logic
│   ├── css/
│   │   └── popup.css        # Popup styles
│   └── html/
│       └── popup.html       # Popup interface
├── lib/
│   └── html2pdf.bundle.min.js  # PDF generation library
├── icons/                   # Extension icons
├── manifest.json            # Extension configuration
└── .gitignore              # Git ignore rules
```

## Setup

1. Clone the repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked" and select this directory
5. The extension should now be installed and ready to use

## Features

- Article content capture
- AI-powered content analysis and tagging
- Contact matching based on article content
- PDF generation
- Text summarization

## Development

- JavaScript files are in `src/js/`
- CSS styles are in `src/css/`
- HTML templates are in `src/html/`
- Third-party libraries are in `lib/` 