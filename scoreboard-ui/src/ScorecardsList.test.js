import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import ScorecardsList from './ScorecardsList';

// Mock the global fetch
global.fetch = jest.fn();

afterEach(() => {
  jest.clearAllMocks();
});

describe('ScorecardsList', () => {
  const fakeUser = { token: 'tok', decoded: { email: 'user@example.com' } };
  const mockData = [
    { configName: 'Config A', startDate: '2023-07-01', endDate: '2023-07-31', dateCreated: '2023-08-01T12:00:00Z', generalNotes: '' },
    { configName: 'Config B', startDate: '2023-08-01', endDate: '2023-08-31', dateCreated: '2023-09-01T12:00:00Z', generalNotes: 'Notes' }
  ];

  test('renders user scorecards after fetch', async () => {
    fetch.mockResolvedValueOnce({ ok: true, json: async () => mockData });

    render(<ScorecardsList user={fakeUser} />);

    expect(screen.getByText(/loading scorecards/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Config A')).toBeInTheDocument();
      expect(screen.getByText('Config B')).toBeInTheDocument();
    });
  });
}); 