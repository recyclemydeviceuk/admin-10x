# 10X admin panel

Next.js admin interface for the 10X backend.

The panel has no database, local JSON store, credential vault, or integration-key editor. It authenticates against the backend and keeps the returned session in an HttpOnly cookie. All business reads and writes go through the backend API into MongoDB.

```bash
cp .env.example .env.local
npm install
npm run dev
```

The panel defaults to `http://localhost:3010`. Its environment contains only `SERVER_API_URL`; infrastructure credentials belong in `server/.env`.

Settings contains:

- Profile name, contact email, and S3-backed profile photo
- Font size, layout density, sidebar, and motion preferences
- Database backup status/history and manual backup
- Backend payment, shipment, tracking, and subscription syncing status
