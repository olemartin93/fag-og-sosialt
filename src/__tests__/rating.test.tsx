import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nProvider } from '../lib/i18n';
import { RatingDistribution, RatingPicker } from '../components/rating';

describe('RatingPicker', () => {
  it('offers ten options and supports the keyboard', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <I18nProvider locale="nb">
        <RatingPicker value={7} onChange={onChange} />
      </I18nProvider>,
    );
    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(10);
    expect(screen.getByRole('radio', { name: 'Karakter 7' })).toHaveAttribute('aria-checked', 'true');
    await user.click(screen.getByRole('radio', { name: 'Karakter 9' }));
    expect(onChange).toHaveBeenLastCalledWith(9);
    screen.getByRole('radio', { name: 'Karakter 7' }).focus();
    await user.keyboard('{ArrowRight}');
    expect(onChange).toHaveBeenLastCalledWith(8);
  });

  it('shows vote counts for every score', () => {
    render(
      <I18nProvider locale="nb">
        <RatingDistribution distribution={[0, 0, 0, 0, 0, 1, 2, 2, 3, 4]} />
      </I18nProvider>,
    );
    expect(screen.getByText('4 stemmer')).toBeInTheDocument();
    expect(screen.getByText('1 stemme')).toBeInTheDocument();
  });
});
