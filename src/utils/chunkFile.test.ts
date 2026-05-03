import {
  chunkFile,
  pickChunkSize,
  MIN_CHUNK_SIZE_BYTES,
  MAX_CHUNK_COUNT,
} from "./chunkFile";

const ONE_MB = 1024 * 1024;
const ONE_GB = 1024 * ONE_MB;
const ONE_TB = 1024 * ONE_GB;

function createMockFile(size: number, name = "test.bin"): File {
  // Allocating a real buffer is fine up to a few MB; for boundary tests on
  // multi-GB files we mock size + slice so we don't OOM the test runner.
  if (size <= 4 * ONE_MB) {
    return new File([new ArrayBuffer(size)], name);
  }
  const file = new File([], name);
  Object.defineProperty(file, "size", { value: size });
  const realSlice = file.slice.bind(file);
  Object.defineProperty(file, "slice", {
    value: (start: number, end: number) => {
      const blob = realSlice();
      Object.defineProperty(blob, "size", { value: end - start });
      return blob;
    },
  });
  return file;
}

const BOUNDARY_SIZES: { label: string; size: number }[] = [
  { label: "1 MB", size: ONE_MB },
  { label: "10 MB", size: 10 * ONE_MB },
  { label: "100 MB", size: 100 * ONE_MB },
  { label: "100 GB", size: 100 * ONE_GB },
  { label: "1 TB", size: ONE_TB },
  { label: "5 TB", size: 5 * ONE_TB },
];

describe("pickChunkSize", () => {
  it.each(BOUNDARY_SIZES)(
    "$label: returns >= 10 MB, MB-aligned, and keeps chunk count <= 9000",
    ({ size }) => {
      const chunkSize = pickChunkSize(size);
      expect(chunkSize).toBeGreaterThanOrEqual(MIN_CHUNK_SIZE_BYTES);
      expect(chunkSize % ONE_MB).toBe(0);
      expect(Math.ceil(size / chunkSize)).toBeLessThanOrEqual(MAX_CHUNK_COUNT);
    },
  );

  it("returns the 10 MB floor for tiny files", () => {
    expect(pickChunkSize(1)).toBe(MIN_CHUNK_SIZE_BYTES);
    expect(pickChunkSize(0)).toBe(MIN_CHUNK_SIZE_BYTES);
  });

  it("scales chunk size up so a 5 TB file fits within the 9000-part budget", () => {
    const fiveTB = 5 * ONE_TB;
    const chunkSize = pickChunkSize(fiveTB);
    expect(chunkSize).toBeGreaterThan(MIN_CHUNK_SIZE_BYTES);
    expect(Math.ceil(fiveTB / chunkSize)).toBeLessThanOrEqual(MAX_CHUNK_COUNT);
  });
});

describe("chunkFile", () => {
  it("returns 1 chunk for a file of exactly the chunk size", () => {
    const file = createMockFile(MIN_CHUNK_SIZE_BYTES);
    const chunks = chunkFile(file);

    expect(chunks).toHaveLength(1);
    expect(chunks[0].partNumber).toBe(1);
    expect(chunks[0].start).toBe(0);
    expect(chunks[0].end).toBe(MIN_CHUNK_SIZE_BYTES);
    expect(chunks[0].blob.size).toBe(MIN_CHUNK_SIZE_BYTES);
  });

  it("returns 2 chunks for a file of chunkSize + 1 bytes", () => {
    const file = createMockFile(MIN_CHUNK_SIZE_BYTES + 1);
    const chunks = chunkFile(file);

    expect(chunks).toHaveLength(2);
    expect(chunks[0].blob.size).toBe(MIN_CHUNK_SIZE_BYTES);
    expect(chunks[1].blob.size).toBe(1);
    expect(chunks[1].start).toBe(MIN_CHUNK_SIZE_BYTES);
    expect(chunks[1].end).toBe(MIN_CHUNK_SIZE_BYTES + 1);
  });

  it("returns 1 chunk for a file smaller than chunkSize", () => {
    const size = 1024;
    const file = createMockFile(size);
    const chunks = chunkFile(file);

    expect(chunks).toHaveLength(1);
    expect(chunks[0].partNumber).toBe(1);
    expect(chunks[0].start).toBe(0);
    expect(chunks[0].end).toBe(size);
    expect(chunks[0].blob.size).toBe(size);
  });

  it("returns an empty array for a zero-byte file", () => {
    const file = createMockFile(0);
    const chunks = chunkFile(file);

    expect(chunks).toEqual([]);
  });

  it("assigns 1-based sequential part numbers", () => {
    const chunkSize = 100;
    const file = createMockFile(350);
    const chunks = chunkFile(file, chunkSize);

    expect(chunks.map((c) => c.partNumber)).toEqual([1, 2, 3, 4]);
  });

  it("has correct start and end values for every chunk in a multi-chunk file", () => {
    const chunkSize = 100;
    const fileSize = 350;
    const file = createMockFile(fileSize);
    const chunks = chunkFile(file, chunkSize);

    expect(chunks).toHaveLength(4);
    expect(chunks[0]).toMatchObject({ start: 0, end: 100 });
    expect(chunks[1]).toMatchObject({ start: 100, end: 200 });
    expect(chunks[2]).toMatchObject({ start: 200, end: 300 });
    expect(chunks[3]).toMatchObject({ start: 300, end: 350 });

    // Last chunk is smaller
    expect(chunks[3].blob.size).toBe(50);
  });

  describe("boundary file sizes", () => {
    it.each(BOUNDARY_SIZES)(
      "$label: chunk count <= 9000, every chunk >= 10 MB, parts cover the file exactly",
      ({ size }) => {
        const file = createMockFile(size);
        const chunks = chunkFile(file);

        expect(chunks.length).toBeGreaterThan(0);
        expect(chunks.length).toBeLessThanOrEqual(MAX_CHUNK_COUNT);

        // First chunk starts at 0; last chunk ends at file size; all contiguous.
        let cursor = 0;
        for (const chunk of chunks) {
          expect(chunk.start).toBe(cursor);
          expect(chunk.end).toBeGreaterThan(chunk.start);
          expect(chunk.blob.size).toBe(chunk.end - chunk.start);
          cursor = chunk.end;
        }
        expect(cursor).toBe(size);

        // Every chunk except possibly the trailing remainder is at least 10 MB.
        const fullChunks = chunks.slice(0, -1);
        for (const chunk of fullChunks) {
          expect(chunk.end - chunk.start).toBeGreaterThanOrEqual(
            MIN_CHUNK_SIZE_BYTES,
          );
        }
      },
    );
  });
});
