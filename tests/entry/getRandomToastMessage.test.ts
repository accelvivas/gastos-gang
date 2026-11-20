import {
  gastosToastMessages,
  genericToastMessages,
} from '@/features/entry/copy/gastosToastMessages';
import { getRandomToastMessage } from '@/features/entry/utils/getRandomToastMessage';

describe('getRandomToastMessage', () => {
  afterEach(() => jest.restoreAllMocks());

  test.each(Object.keys(gastosToastMessages) as (keyof typeof gastosToastMessages)[])(
    'returns only messages from %s',
    (category) => {
      jest.spyOn(Math, 'random').mockReturnValue(0.75);
      expect(gastosToastMessages[category]).toContain(getRandomToastMessage(category));
    }
  );

  test('matches category names case-insensitively after trimming', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0);
    expect(getRandomToastMessage('  FoOd  ')).toBe(gastosToastMessages.food[0]);
  });

  test('uses the generic collection for a custom category', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0);
    expect(getRandomToastMessage('Coffee')).toBe(genericToastMessages[0]);
  });

  test('does not immediately repeat the previous message', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0);
    const previous = gastosToastMessages.food[0];
    const next = getRandomToastMessage('Food', previous);
    expect(next).not.toBe(previous);
    expect(gastosToastMessages.food).toContain(next);
  });

  test('always returns a defined message', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.999999);
    expect(getRandomToastMessage('')).toEqual(expect.any(String));
  });
});
