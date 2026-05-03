// Manual mock — client-zip is ESM and uses browser-only APIs (TextDecoder,
// Blob.prototype.stream) at module load. We never need its real behavior in
// tests since `streamZipToDisk` is always mocked at a higher layer, so this
// stub exists purely to satisfy the import graph.

export const downloadZip = jest.fn(() => {
  return new Response(new Blob());
});

export const makeZip = jest.fn();
export const predictLength = jest.fn(() => 0);
