import { fireEvent, render, screen } from '@testing-library/react-native';

import { ExpenseToast } from '@/components/ExpenseToast';
import { streetColors } from '@/theme/tokens';

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

    const heading = screen.getByText('✓ GASTOS LOGGED, BOSS!');
    expect(heading).toBeOnTheScreen();
    expect(heading).toHaveStyle({ fontSize: 12 });
    expect(screen.getByText('₱70.00 · Food')).toBeOnTheScreen();
    const funnyMessage = screen.getByText(joke);
    expect(funnyMessage).toBeOnTheScreen();
    expect(funnyMessage).toHaveStyle({ color: streetColors.lime, fontSize: 16, fontWeight: '900' });
    const undoButton = screen.getByRole('button', { name: 'Undo saved expense' });
    expect(undoButton).toHaveStyle({ minWidth: 44, minHeight: 44 });
    await fireEvent.press(undoButton);
    expect(onUndo).toHaveBeenCalledTimes(1);
  });
});
