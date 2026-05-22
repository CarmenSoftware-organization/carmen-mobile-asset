export type CarmenApiErrorCode =
  | 'unauthenticated'
  | 'not_found'
  | 'conflict'
  | 'network_error'
  | 'server_error'
  | 'not_implemented'
  | 'unknown';

export class CarmenApiError extends Error {
  constructor(
    public readonly code: CarmenApiErrorCode,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'CarmenApiError';
  }
}
