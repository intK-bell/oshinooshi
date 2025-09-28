export async function readableStreamToBuffer(stream) {
  if (stream instanceof Buffer) {
    return stream;
  }

  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}
