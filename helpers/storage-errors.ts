// Tells "the file is not there" apart from every other storage failure

// True only when storage confirmed the object does not exist.
// Timeouts, credential errors and outages are NOT "missing".
export function isMissingObjectError(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const e = err as {
    name?: unknown;
    code?: unknown;
    $metadata?: { httpStatusCode?: unknown };
  };

  // A missing bucket is a configuration problem, not a missing file
  if (e.name === "NoSuchBucket") return false;

  return (
    e.name === "NotFound" || // S3/R2 HeadObject on a missing key
    e.name === "NoSuchKey" ||
    e.code === "ENOENT" || // mock mode: local file is gone
    e.$metadata?.httpStatusCode === 404
  );
}
