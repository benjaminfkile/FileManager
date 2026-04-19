import { chunkFile, CHUNK_SIZE_BYTES } from "./chunkFile";

function createMockFile(size: number, name = "test.bin"): File {
  const buffer = new ArrayBuffer(size);
  return new File([buffer], name);
}

describe("chunkFile", () => {
  it("returns 1 chunk for a file of exactly chunkSize bytes", () => {
    const file = createMockFile(CHUNK_SIZE_BYTES);
    const chunks = chunkFile(file);

    expect(chunks).toHaveLength(1);
    expect(chunks[0].partNumber).toBe(1);
    expect(chunks[0].start).toBe(0);
    expect(chunks[0].end).toBe(CHUNK_SIZE_BYTES);
    expect(chunks[0].blob.size).toBe(CHUNK_SIZE_BYTES);
  });

  it("returns 2 chunks for a file of chunkSize + 1 bytes", () => {
    const file = createMockFile(CHUNK_SIZE_BYTES + 1);
    const chunks = chunkFile(file);

    expect(chunks).toHaveLength(2);
    expect(chunks[0].blob.size).toBe(CHUNK_SIZE_BYTES);
    expect(chunks[1].blob.size).toBe(1);
    expect(chunks[1].start).toBe(CHUNK_SIZE_BYTES);
    expect(chunks[1].end).toBe(CHUNK_SIZE_BYTES + 1);
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
});
