import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { vi } from 'vitest';
import { MetadataFields } from './shared';

vi.mock('../common/currentUser', () => ({ useCurrentUser: () => 'jane' }));

afterEach(cleanup);

function Fields(props: Readonly<{ initialExpiry: string; onExpiry: (date: string) => void }>) {
  const [expiresDate, setExpiresDate] = useState(props.initialExpiry);
  return (
    <MetadataFields
      name="accept-cve"
      onNameChange={() => {}}
      reason=""
      onReasonChange={() => {}}
      expiresDate={expiresDate}
      onExpiresDateChange={date => {
        setExpiresDate(date);
        props.onExpiry(date);
      }}
    />
  );
}

function dateInput() {
  return screen.getByLabelText('Expires at') as HTMLInputElement;
}

it('never expires without a date, and proposes one a month ahead to expire', () => {
  const onExpiry = vi.fn();
  render(<Fields initialExpiry="" onExpiry={onExpiry} />);
  const never = screen.getByRole('checkbox', { name: 'Never expires' }) as HTMLInputElement;

  expect(never.checked).toBe(true);
  expect(dateInput().disabled).toBe(true);
  expect(screen.getByText('The exception applies until it is deleted.')).toBeTruthy();

  fireEvent.click(never);
  const proposed = onExpiry.mock.calls[0][0];
  const days = (new Date(proposed).getTime() - Date.now()) / (24 * 60 * 60 * 1000);
  expect(days).toBeGreaterThan(28);
  expect(days).toBeLessThan(31);
  expect(dateInput().disabled).toBe(false);
  expect(dateInput().value).toBe(proposed);

  fireEvent.click(never);
  expect(onExpiry).toHaveBeenLastCalledWith('');
  expect(dateInput().disabled).toBe(true);
});

it('shows the expiry of an exception that has one', () => {
  render(<Fields initialExpiry="2027-01-31" onExpiry={() => {}} />);
  expect(
    (screen.getByRole('checkbox', { name: 'Never expires' }) as HTMLInputElement).checked
  ).toBe(false);
  expect(dateInput().value).toBe('2027-01-31');
});
