---
description: How to deploy (publish) the webapp to Firebase Hosting
---

// turbo-all

## Steps to deploy

1. Build the production bundle:
```bash
cd d:\NKSSS\webapp && npm run build
```

2. Deploy to Firebase Hosting:
```bash
cd d:\NKSSS\webapp && npx firebase deploy --only hosting
```

## Notes
- The hosting site name is `nksss` (configured in `firebase.json`)
- Build output goes to `dist/` directory
- Firebase rewrites all routes to `index.html` (SPA)
