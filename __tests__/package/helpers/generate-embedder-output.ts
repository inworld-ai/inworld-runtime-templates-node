/**
 * Generate expected output string for basic_embedder tests
 * @param texts Array of text strings to embed
 * @param embeddingDimension The dimension of embeddings (default: 1024)
 * @returns Formatted string matching the expected output
 */
export function generateEmbedderOutput(
  texts: string[],
  embeddingDimension: number = 1024,
): string {
  const outputLines: string[] = [];

  outputLines.push('Getting embeddings for individual texts:');

  for (const text of texts) {
    outputLines.push(`Text: '${text}'`);
    outputLines.push(`Embedding dimension: ${embeddingDimension}`);
  }

  outputLines.push('');
  outputLines.push('Getting embeddings for batch of texts:');
  outputLines.push(`Number of embeddings: ${texts.length}`);
  outputLines.push(`Embedding dimension: ${embeddingDimension}`);

  return outputLines.join('\n');
}
