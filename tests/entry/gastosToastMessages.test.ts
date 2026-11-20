import {
  gastosToastMessages,
  genericToastMessages,
} from '@/features/entry/copy/gastosToastMessages';

describe('gastosToastMessages', () => {
  test('contains five unique, non-empty messages for all six default categories', () => {
    const collections = Object.values(gastosToastMessages);
    expect(collections).toHaveLength(6);

    for (const messages of collections) {
      expect(messages).toHaveLength(5);
      expect(new Set(messages).size).toBe(5);
      expect(messages.every((message) => message.trim().length > 0)).toBe(true);
    }

    expect(collections.flat()).toHaveLength(30);
  });

  test('contains five generic fallback messages', () => {
    expect(genericToastMessages).toHaveLength(5);
    expect(new Set(genericToastMessages).size).toBe(5);
  });
});
