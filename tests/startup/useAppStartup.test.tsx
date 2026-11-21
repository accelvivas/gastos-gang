import { act, renderHook } from '@testing-library/react-native';

import { useAppStartup } from '@/hooks/useAppStartup';

test('initialization errors cannot be overwritten by a delayed readiness callback', async () => {
  const hook = await renderHook(() => useAppStartup());
  await act(() => hook.result.current.markError());
  await act(() => hook.result.current.markReady());
  expect(hook.result.current.phase).toBe('error');
});

test('transitions through startup once and does not replay after completion', async () => {
  const hook = await renderHook(() => useAppStartup());

  expect(hook.result.current.phase).toBe('initializing');

  await act(() => hook.result.current.markReady());
  expect(hook.result.current.phase).toBe('ready');

  await act(() => hook.result.current.markAnimating());
  await act(() => hook.result.current.markCompleted());

  expect(hook.result.current.phase).toBe('completed');
  await hook.rerender({});
  expect(hook.result.current.phase).toBe('completed');
  await hook.unmount();
  const remount = await renderHook(() => useAppStartup());
  await act(() => remount.result.current.markReady());
  expect(remount.result.current.phase).toBe('completed');
});
