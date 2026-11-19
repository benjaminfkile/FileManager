# FileManager

Web client for File Manager, a personal cloud drive: folders, uploads of any size, previews, sharing with other users or through public links, and a recycle bin. It talks to `file-manager-api` (separate repo) and uploads and downloads file bytes straight to and from S3 using signed URLs the API hands out.

## Stack

React 19 (Create React App, TypeScript), MUI 9, react-router 6, axios, `amazon-cognito-identity-js` for sign-in, `client-zip` for folder downloads.

## Routes

| Path | Page | Auth |
|------|------|------|
| `/login`, `/register`, `/forgot-password` | Cognito sign-in, sign-up (with email code), password reset | public |
| `/share/:token` | Public share link: preview or download a file, browse and zip a folder | public |
| `/` | My Drive (root folders and files) | signed in |
| `/folder/:id` | Folder contents with breadcrumb | signed in |
| `/shared` | Items other users shared with me | signed in |
| `/recycle-bin` | Restore or permanently delete | signed in |

Signed-in pages render inside `AppShell` (nav, profile menu, light/dark toggle, downloads tray).

## How it works

**Auth.** `src/lib/cognitoClient.ts` wraps the Cognito user pool. After sign-up and confirmation the user signs in and the register page calls `POST /api/users/register` to create the local user. `src/api/apiClient.ts` attaches the Cognito ID token to every request. `setupInterceptors.ts` handles 401s: a `Session expired` response sends the user to the login page with a session-expired message; any other 401 tries one token refresh and retry, then logs out.

**Demo accounts.** On the dev environment accounts last one hour. When `/api/users/me` returns an `expires_at`, `AppShell` shows `SessionExpiryBanner` with a countdown (red under five minutes).

**Uploads** (`src/hooks/useChunkedUpload.ts`, `src/api/chunkedUploadService.ts`, `src/utils/chunkFile.ts`). Files are split into 10 MB chunks. The client calls `initiate`, asks for presigned part URLs, PUTs chunks straight to S3 three at a time, then calls `complete` with the part ETags. Progress is saved in `localStorage` (keyed by a hash of the file, kept 24 hours), so if the same file is picked again after a refresh or failure the user is offered a resume, which skips parts S3 already has. `FolderUpload` keeps the folder structure by creating folders before uploading their files.

**Downloads.** Single files open the API's presigned download URL. Folder downloads (`useFolderDownload`, `src/utils/folderZipDownload.ts`) fetch a manifest of per-file URLs and zip in the browser with `client-zip`, streaming to disk through the File System Access API where available and falling back to an in-memory blob. Progress shows in the downloads tray (`DownloadsContext`, `DownloadsTray`). Share-link pages reuse the same path with the public manifest endpoint.

**Preview.** `FilePreviewDialog` shows images, video and PDFs from the API's preview URL.

**Sharing.** `ShareDialog` has a People tab (search users by username, share and unshare) and a Links tab (create public links with an optional expiry, copy, revoke).

## Project structure

```
src/
  App.tsx              # Routes
  api/                 # One module per API resource, plus apiClient and interceptors
  components/          # AppShell, dialogs (create, rename, move, share, delete, preview), uploads, list items
  contexts/            # AuthContext, DownloadsContext, NotificationContext
  hooks/               # useChunkedUpload, useFolderDownload
  lib/cognitoClient.ts
  pages/
  theme/               # MUI theme + light/dark provider (choice saved in localStorage)
  types/
  utils/               # chunkFile, folderZipDownload, downloadHelpers, fileTypeHelpers, formatters
grunt-agent-guide/     # How to post tasks to grunt, the agent task runner
```

## Environment

Set in `.env.local` for local work and in the Vercel project for deploys.

| Variable | Description |
|----------|-------------|
| `REACT_APP_API_BASE_URL` | file-manager-api base URL (defaults to `http://localhost:3007`) |
| `REACT_APP_COGNITO_USER_POOL_ID` | Cognito user pool |
| `REACT_APP_COGNITO_APP_CLIENT_ID` | Cognito app client |
| `REACT_APP_PAGE_NAME` | Browser tab title (defaults to `File Manager`) |

The pool must match the API environment you point at: the dev API only accepts dev-pool tokens.

## Scripts

```bash
npm install
npm start        # dev server on :3000
npm test         # Jest + Testing Library (watch mode; CI=true for a single run)
npm run build    # production build in build/
```

## Deploy

Vercel builds every push. `main` deploys production (project `file-manager`); `dev` deploys the dev site (project `file-manager-dev`). `grunt` is where automated task work lands before it is merged into `dev`.
