import { fireEvent, render, screen } from '@testing-library/react-native';

import { NoteInput } from '@/features/entry/components/NoteInput';
import { TodayDamageCard } from '@/features/entry/components/TodayDamageCard';

describe('streetwear entry UI', () => {
  test('renders the live total and local date in the damage card', async () => {
    await render(<TodayDamageCard dayKey="2026-11-20" totalCentavos={24_500} />);

    expect(screen.getByText("TODAY'S DAMAGE")).toBeOnTheScreen();
    expect(screen.getByText('FRI · NOV 20')).toBeOnTheScreen();
    expect(screen.getByText('₱245.00')).toBeOnTheScreen();
  });

  test('expands note entry and exposes a separate clear-amount action', async () => {
    const onClearAmount = jest.fn();
    await render(
      <NoteInput note="" onChangeNote={jest.fn()} onClearAmount={onClearAmount} />
    );

    await fireEvent.press(screen.getByRole('button', { name: 'Clear amount' }));
    expect(onClearAmount).toHaveBeenCalledTimes(1);

    await fireEvent.press(screen.getByRole('button', { name: 'Add a note (optional)' }));
    expect(screen.getByLabelText('Expense note')).toBeOnTheScreen();
  });
});
