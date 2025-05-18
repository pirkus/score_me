import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import { renderWithUser } from './test-utils';
import ViewScorecard from './ViewScorecard';

// Mock fetch
global.fetch = jest.fn();

describe('ViewScorecard', () => {
  const mockScorecard = {
    id: 'scorecard-1',
    configId: 'config-1',
    configName: 'Test Config',
    startDate: '2024-01-01',
    endDate: '2024-01-31',
    dateCreated: '2024-01-01T00:00:00Z',
    generalNotes: 'Some notes',
    scores: [
      { metricName: 'Numeric Metric', devScore: 8, mentorScore: 9, notes: 'Good' },
      { metricName: 'Checkbox Metric', devScore: true, mentorScore: false, notes: 'Done' }
    ]
  };

  beforeEach(() => {
    fetch.mockClear();
  });

  it('shows loading state initially', () => {
    renderWithUser(<ViewScorecard />);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('displays scorecard details after loading', async () => {
    fetch.mockImplementationOnce(() => Promise.resolve({ ok: true, json: () => Promise.resolve(mockScorecard) }));
    renderWithUser(<ViewScorecard scorecardId="scorecard-1" />);
    await waitFor(() => {
      expect(screen.getByText('Test Config')).toBeInTheDocument();
      expect(screen.getByText('2024-01-01 - 2024-01-31')).toBeInTheDocument();
      expect(screen.getByText('Good')).toBeInTheDocument();
      expect(screen.getAllByText('Done').length).toBeGreaterThan(0);
      expect(screen.getByText('Not done')).toBeInTheDocument();
    });
  });

  it('handles fetch error', async () => {
    fetch.mockImplementationOnce(() => 
      Promise.reject(new Error('Failed to fetch'))
    );

    renderWithUser(<ViewScorecard />);

    await waitFor(() => {
      expect(screen.getByText(/error loading scorecard/i)).toBeInTheDocument();
    });
  });

  it('shows not found message for non-existent scorecard', async () => {
    fetch.mockImplementationOnce(() => 
      Promise.resolve({
        ok: false,
        status: 404
      })
    );

    const mockUser = { token: 'fake-token', decoded: { email: 'test@example.com' } };
    renderWithUser(<ViewScorecard user={mockUser} setUser={jest.fn()} scorecardId="notfound-id" />);

    await waitFor(() => {
      expect(screen.getByText(/scorecard not found/i)).toBeInTheDocument();
    });
  });
}); 