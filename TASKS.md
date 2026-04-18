# Upload Refactor — FileManager

Replace the single-request `uploadFile()` call (one large POST per file) with a chunked upload flow that talks to the new S3 multipart endpoints on the API. Each file is split into 10 MB chunks sent as separate requests, so no single request is large enough to hit a load balancer timeout.

**Prerequisite:** All tasks in `file-manager-api/TASKS.md` Tasks 1–9 must be complete before starting Task 4 (you can write Task 1–3 code and tests against mocks without the API being deployed, but Task 4 onward requires the new endpoints to exist).

**Run `npm test` after every task. All tests must pass before starting the next task.**

---

## Task 1 — Add Chunk Utility Function + Unit Tests

**Goal:** Create a pure utility function that splits a `File` into a list of fixed-size `Blob` chunks. No API calls — pure logic, easy to test in isolation.

**File to create:** `src/utils/chunkFile.ts`

```typescript
export const CHUNK_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export interface FileChunk {
  blob: Blob;
  partNumber: number; // 1-based, matching S3 part numbers
  start: number;     // byte offset start (inclusive)
  end: number;       // byte offset end (exclusive)
}

export function chunkFile(file: File, chunkSize = CHUNK_SIZE_BYTES): FileChunk[]
```

**Implementation notes:**
- Use `file.slice(start, end)` to create each `Blob`
- The last chunk will be smaller than `chunkSize` unless the file size is an exact multiple
- A zero-byte file should return an empty array
- A file smaller than `chunkSize` should return exactly one chunk

**File to create:** `src/utils/chunkFile.test.ts`

Write tests for:
- A file of exactly `chunkSize` bytes → 1 chunk; `start=0`, `end=chunkSize`, `partNumber=1`
- A file of `chunkSize + 1` bytes → 2 chunks; second chunk has size 1
- A file smaller than `chunkSize` → 1 chunk
- A zero-byte file → empty array `[]`
- Part numbers are 1-based and sequential
- `start` and `end` values are correct for every chunk in a multi-chunk file

**Acceptance criteria:**
- `chunkFile` is exported from `src/utils/chunkFile.ts`
- `CHUNK_SIZE_BYTES` is exported as a named constant
- All tests in `src/utils/chunkFile.test.ts` pass
- All existing tests continue to pass

---

## Task 2 — Add Chunked Upload API Service + Unit Tests

**Goal:** Create a service module with one function per new API endpoint. This is the only place in the frontend that knows the URLs and HTTP methods for the multipart upload flow.

**File to create:** `src/api/chunkedUploadService.ts`

Use the existing `apiClient` (from `src/api/apiClient.ts`) for all requests.

**Types and functions to export:**

```typescript
import { IFile } from '../types';

export interface InitiateUploadResponse {
  uploadId: string;
  fileId: string;
  key: string;
}

export interface UploadPartResponse {
  partNumber: number;
  etag: string;
}

export interface CompletedPart {
  partNumber: number;
  etag: string;
}

/**
 * POST /api/files/uploads/initiate
 * Starts a multipart upload session.
 */
export async function initiateUpload(payload: {
  filename: string;
  mimeType: string;
  size: number;
  folderId?: string | null;
}): Promise<InitiateUploadResponse>

/**
 * PUT /api/files/uploads/:fileId/parts/:partNumber
 * Uploads one chunk. Body is raw binary (application/octet-stream).
 * Calls onProgress(loaded, total) as bytes are sent.
 */
export async function uploadPart(payload: {
  fileId: string;
  partNumber: number;
  chunk: Blob;
  onProgress?: (loaded: number, total: number) => void;
}): Promise<UploadPartResponse>

/**
 * POST /api/files/uploads/:fileId/complete
 * Finalises the multipart upload and creates the file record.
 */
export async function completeUpload(
  fileId: string,
  parts: CompletedPart[]
): Promise<IFile>

/**
 * DELETE /api/files/uploads/:fileId
 * Aborts the upload and cleans up the session.
 */
export async function abortUpload(fileId: string): Promise<void>
```

**Implementation notes for `uploadPart`:**
- Convert the `Blob` to an `ArrayBuffer` (via `chunk.arrayBuffer()`) then send as the request body
- Set `Content-Type: application/octet-stream` on that request
- Pass `onUploadProgress` to axios so `onProgress` is called with `(event.loaded, event.total ?? chunk.size)`

**File to create:** `src/api/chunkedUploadService.test.ts`

Mock `apiClient` (same pattern used in existing `src/api/fileService.test.ts`). Write tests for each function:
- `initiateUpload` — verify it POSTs to `/api/files/uploads/initiate` with the correct body; verify it returns `{ uploadId, fileId, key }`
- `uploadPart` — verify it PUTs to `/api/files/uploads/{fileId}/parts/{partNumber}` with `Content-Type: application/octet-stream`; verify it returns `{ partNumber, etag }`
- `completeUpload` — verify it POSTs to `/api/files/uploads/{fileId}/complete` with `{ parts }`; verify it returns the file record
- `abortUpload` — verify it DELETEs `/api/files/uploads/{fileId}`

**Acceptance criteria:**
- All four functions are exported from `src/api/chunkedUploadService.ts`
- All tests in `src/api/chunkedUploadService.test.ts` pass
- All existing tests continue to pass

---

## Task 3 — Add `useChunkedUpload` Hook + Unit Tests

**Goal:** Create a React hook that orchestrates the full lifecycle of a chunked upload. Components call this hook instead of calling the service functions directly.

**File to create:** `src/hooks/useChunkedUpload.ts`

```typescript
import { IFile } from '../types';

export interface ChunkedUploadOptions {
  file: File;
  folderId?: string | null;
}

export function useChunkedUpload(): {
  upload: (options: ChunkedUploadOptions) => Promise<IFile>;
  abort: () => void;
  progress: number;    // 0–100
  isUploading: boolean;
  error: string | null;
}
```

**Internal behavior:**
1. Set `isUploading = true`, `progress = 0`, `error = null`
2. Call `initiateUpload({ filename: file.name, mimeType: file.type, size: file.size, folderId })`; store `fileId` in a ref (so `abort()` can use it)
3. Call `chunkFile(file)` to get the list of chunks
4. Upload chunks in **batches of 3 concurrently** using `Promise.all` on each batch. After each chunk completes, increment `progress` by `(1 / totalChunks) * 100` (rounded to nearest integer). Collect `{ partNumber, etag }` from every part response.
5. If `abort()` was called at any point during upload: call `abortUpload(fileId)`, set `isUploading = false`, throw or reject so the caller knows it was aborted. Do not call `completeUpload`.
6. After all parts complete, call `completeUpload(fileId, parts)` and set `progress = 100`, `isUploading = false`
7. On any error: call `abortUpload(fileId)` (best-effort, ignore errors from abort), set `error` to the error message, set `isUploading = false`, re-throw so callers can handle it

**File to create:** `src/hooks/useChunkedUpload.test.ts`

Use `@testing-library/react`'s `renderHook` and mock the service functions from `src/api/chunkedUploadService`. Tests:
- Successful upload of a multi-chunk file: `progress` reaches 100, `isUploading` is false after resolving, returned value is the file record
- `abort()` called mid-upload: `abortUpload` is called, hook resolves/rejects cleanly without calling `completeUpload`
- Error in `uploadPart`: `abortUpload` is called, `error` state is set, `isUploading` is false
- Progress increments correctly as parts complete

**Acceptance criteria:**
- `useChunkedUpload` is exported from `src/hooks/useChunkedUpload.ts`
- All tests in `src/hooks/useChunkedUpload.test.ts` pass
- All existing tests continue to pass

---

## Task 4 — Update `FileUpload` Component + Tests

**Goal:** Replace the `uploadFile()` call in `src/components/FileUpload.tsx` with `useChunkedUpload`. Add client-side file size validation so users get an immediate error for files over 50 GB instead of a silent timeout.

**File to change:** `src/components/FileUpload.tsx`

**Changes required:**
1. Remove the import of `uploadFile` from `../api/fileService`
2. Import and call `useChunkedUpload` at the top of the component
3. Replace the `uploadFile(payload)` call with `upload({ file, folderId })`
4. Use `progress` from the hook for the existing `LinearProgress` component (already wired to a `progress` state — replace that state with the hook value)
5. Use `isUploading` from the hook to control any loading/disabled states currently driven by local state
6. Use `error` from the hook for the existing error `Alert` (replace the local `error` state with the hook value where the hook owns it; keep the local `error` state only for the size-validation error below)
7. Add a client-side size check **before calling `upload()`**: if `file.size > MAX_FILE_SIZE_BYTES` (define this constant as `50 * 1024 ** 3` — 50 GB — at the top of the file), set a local error state to `'File exceeds the maximum upload size of 50 GB'` and return without starting the upload

**File to change:** `src/components/FileUpload.test.tsx`

- Remove the mock of `uploadFile` and replace it with a mock of `useChunkedUpload` from `../hooks/useChunkedUpload`
- Update the existing test for successful upload to use the hook mock
- Update the existing test for upload errors to set `error` via the hook mock
- Add a new test: when a file whose `size` exceeds `MAX_FILE_SIZE_BYTES` is selected, the error message `'File exceeds the maximum upload size of 50 GB'` appears and `upload` is never called
- Keep the existing test that verifies the 413 error message if it applies (the hook surfaces server errors through its `error` state)

**Acceptance criteria:**
- `FileUpload` no longer imports or calls `uploadFile` from `fileService`
- `useChunkedUpload` drives all upload logic in the component
- Files over 50 GB show an error without starting an upload
- All tests in `src/components/FileUpload.test.tsx` pass
- All existing tests continue to pass

---

## Task 5 — Update `FolderUpload` Component + Tests

**Goal:** Replace `uploadFile()` calls in `src/components/FolderUpload.tsx` with the chunked upload service. Folder uploads send files sequentially (one at a time) — keep that behaviour; only the per-file upload mechanism changes.

**File to change:** `src/components/FolderUpload.tsx`

**Changes required:**
1. Remove the import of `uploadFile` from `../api/fileService`
2. Import `initiateUpload`, `uploadPart`, `completeUpload`, `abortUpload` from `../api/chunkedUploadService` and `chunkFile` from `../utils/chunkFile`
3. Replace each `uploadFile(payload)` call inside `orchestrateUpload` with a self-contained chunked upload sequence:
   - Call `initiateUpload({ filename, mimeType, size, folderId })`
   - Call `chunkFile(file)` to split the file
   - Upload chunks sequentially (not in batches — folder upload is already sequential at the file level; keeping per-chunk sequential within each file keeps the implementation simple and avoids overloading the API during a folder upload)
   - On success call `completeUpload(fileId, parts)` → update the overall file list / `onUploaded` callback
   - On any error call `abortUpload(fileId)` then re-throw so the existing error handling in `orchestrateUpload` can display the error
4. Overall folder-level progress (`completedFiles / totalFiles`) stays as-is

**File to change:** `src/components/FolderUpload.test.tsx` (create this file if it does not already exist)

Mock `../api/chunkedUploadService` (all four functions) and `../utils/chunkFile`. Write or update tests for:
- Successful folder upload: `initiateUpload`, `uploadPart`, and `completeUpload` are called for each file; `onUploaded` (or equivalent callback) is called with each created file record
- Error on one file: `abortUpload` is called for the failed file; an error state is shown

**Acceptance criteria:**
- `FolderUpload` no longer imports or calls `uploadFile`
- Each file in a folder upload uses the chunked upload service
- Sequential upload order is maintained at the file level
- All tests in `src/components/FolderUpload.test.tsx` pass
- All existing tests continue to pass
