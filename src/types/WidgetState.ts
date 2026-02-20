export type WidgetStatus =
  | 'loading'
  | 'error'
  | 'empty'
  | 'active'
  | 'completed'
  | 'disabled';

export interface WidgetState<T> {
  status: WidgetStatus;
  data: T | null;
  errorMessage: string | null;
}

export function widgetLoading<T>(): WidgetState<T> {
  return { status: 'loading', data: null, errorMessage: null };
}

export function widgetError<T>(message: string): WidgetState<T> {
  return { status: 'error', data: null, errorMessage: message };
}

export function widgetEmpty<T>(): WidgetState<T> {
  return { status: 'empty', data: null, errorMessage: null };
}

export function widgetActive<T>(data: T): WidgetState<T> {
  return { status: 'active', data, errorMessage: null };
}

export function widgetCompleted<T>(data: T): WidgetState<T> {
  return { status: 'completed', data, errorMessage: null };
}
