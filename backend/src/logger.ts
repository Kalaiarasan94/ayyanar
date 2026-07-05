// In-memory error log shown on the deployment status page ("/").
// Keeps the most recent 50 errors; resets when the server restarts.

type ErrorEntry = {
  time: string;
  context: string;
  message: string;
};

const errors: ErrorEntry[] = [];

export const logError = (context: string, error: any) => {
  errors.unshift({
    time: new Date().toISOString(),
    context,
    message: error?.message || String(error),
  });
  if (errors.length > 50) errors.pop();
};

export const getErrorLogs = (): ErrorEntry[] => errors;
