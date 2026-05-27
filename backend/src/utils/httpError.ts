export function httpError(status: number, message: string) {
  const error: any = new Error(message);
  error.status = status;
  return error;
}
