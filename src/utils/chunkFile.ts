export const CHUNK_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export interface FileChunk {
  blob: Blob;
  partNumber: number; // 1-based, matching S3 part numbers
  start: number; // byte offset start (inclusive)
  end: number; // byte offset end (exclusive)
}

export function chunkFile(
  file: File,
  chunkSize = CHUNK_SIZE_BYTES
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
