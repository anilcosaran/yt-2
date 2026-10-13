export function isLatestInboxOperation(operationGeneration: number, currentGeneration: number) {
  return operationGeneration === currentGeneration
}
