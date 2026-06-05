type Result<T, E = Error> = 
  | { ok: true; value: T }
  | { ok: false; error: E };

export async function safe<T>(promise: Promise<T>): Promise<Result<T>> {
  try {
    const value = await promise;
    return { ok: true, value };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error : new Error(String(error)) };
  }
}
