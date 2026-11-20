import { fireEvent, render, screen } from '@testing-library/react-native';

import { ExpenseToast } from '@/components/ExpenseToast';

describe('ExpenseToast', () => {
  test('shows the heading, expense details, wrapped joke, and accessible Undo action', async () => {
    const onUndo = jest.fn();
    const joke = 'Solid, bossing! Responsible adult ka na, financially traumatized nga lang!';
    await render(
      <ExpenseToast
        title="GASTOS LOGGED, BOSS!"
        message="₱70.00 · Food"
        joke={joke}
        onUndo={onUndo}
      />
    );

    expect(screen.getByText('✓ GASTOS LOGGED, BOSS!')).toBeOnTheScreen();
    expect(screen.getByText('₱70.00 · Food')).toBeOnTheScreen();
    expect(screen.getByText(joke)).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Undo saved expense' }));
    expect(onUndo).toHaveBeenCalledTimes(1);
  });
});
