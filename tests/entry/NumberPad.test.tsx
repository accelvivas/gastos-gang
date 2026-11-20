import { fireEvent, render, screen } from '@testing-library/react-native';

import { NumberPad } from '@/components/NumberPad';

jest.mock('@/lib/haptics', () => ({ tapHaptic: jest.fn() }));

describe('NumberPad', () => {
  test('exposes every amount action and reports the pressed key', async () => {
    const onKeyPress = jest.fn();
    await render(<NumberPad onKeyPress={onKeyPress} />);

    await fireEvent.press(screen.getByRole('button', { name: '7' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Decimal point' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Delete digit' }));

    expect(onKeyPress).toHaveBeenNthCalledWith(1, '7');
    expect(onKeyPress).toHaveBeenNthCalledWith(2, '.');
    expect(onKeyPress).toHaveBeenNthCalledWith(3, 'backspace');
    expect(onKeyPress).toHaveBeenCalledTimes(3);
  });
});
