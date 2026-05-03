const ONE_MB = 1024 * 1024;

export const MIN_CHUNK_SIZE_BYTES = 10 * ONE_MB; // 10 MB floor
export const MAX_CHUNK_COUNT = 9000; // S3 multipart limit headroom

export interface FileChunk {
  blob: Blob;
  partNumber: number; // 1-based, matching S3 part numbers
  start: number; // byte offset start (inclusive)
  end: number; // byte offset end (exclusive)
}

export function pickChunkSize(fileSize: number): number {
  const minBytesPerChunk = Math.ceil(fileSize / MAX_CHUNK_COUNT);
  const roundedToMB = Math.ceil(minBytesPerChunk / ONE_MB) * ONE_MB;
  return Math.max(MIN_CHUNK_SIZE_BYTES, roundedToMB);
}

export function chunkFile(
  file: File,
  chunkSize: number = pickChunkSize(file.size),
): FileChunk[] {
  if (file.size === 0) {
    return [];
  }

  const chunks: FileChunk[] = [];
  let start = 0;
  let partNumber = 1;

  while (start < file.size) {
    const end = Math.min(start + chunkSize, file.size);
    chunks.push({
      blob: file.slice(start, end),
      partNumber,
      start,
      end,
    });
    start = end;
    partNumber++;
  }

  return chunks;
}
