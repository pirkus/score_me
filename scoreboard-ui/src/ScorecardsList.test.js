import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
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
  
  test('checkbox to show archived scorecards exists and is unchecked by default', async () => {
    fetch.mockResolvedValueOnce({ ok: true, json: async () => mockData });
    
    render(<ScorecardsList user={fakeUser} />);
    
    await waitFor(() => {
      const checkbox = screen.getByLabelText(/show archived scorecards/i);
      expect(checkbox).toBeInTheDocument();
      expect(checkbox).not.toBeChecked();
    });
  });
  
  test('toggling the checkbox makes a new fetch request with includeArchived parameter', async () => {
    // First fetch for initial render
    fetch.mockResolvedValueOnce({ ok: true, json: async () => mockData });
    
    render(<ScorecardsList user={fakeUser} />);
    
    await waitFor(() => {
      expect(screen.getByText('Config A')).toBeInTheDocument();
    });
    
    // Reset mock for the second fetch when checkbox is toggled
    fetch.mockReset();
    
    // Mock the second fetch that will happen after checkbox toggle
    const archivedMockData = [
      ...mockData,
      { configName: 'Archived Config', startDate: '2023-06-01', endDate: '2023-06-30', dateCreated: '2023-07-01T12:00:00Z', generalNotes: '', archived: true }
    ];
    fetch.mockResolvedValueOnce({ ok: true, json: async () => archivedMockData });
    
    // Find and toggle the checkbox
    const checkbox = screen.getByLabelText(/show archived scorecards/i);
    fireEvent.click(checkbox);
    
    // Verify the fetch was called with the includeArchived parameter
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('?includeArchived=true'),
        expect.any(Object)
      );
      
      // Check that archived scorecards are now displayed
      expect(screen.getByText('Archived Config')).toBeInTheDocument();
      expect(screen.getByText('Archived')).toBeInTheDocument();
    });
  });
  
  test('archive button is hidden for archived scorecards', async () => {
    const mixedMockData = [
      { id: '1', configName: 'Active Config', startDate: '2023-07-01', endDate: '2023-07-31', dateCreated: '2023-08-01T12:00:00Z', archived: false },
      { id: '2', configName: 'Archived Config', startDate: '2023-06-01', endDate: '2023-06-30', dateCreated: '2023-07-01T12:00:00Z', archived: true }
    ];
    
    // Initial fetch
    fetch.mockResolvedValueOnce({ ok: true, json: async () => mixedMockData });
    
    const onViewScorecard = jest.fn();
    render(<ScorecardsList user={fakeUser} onViewScorecard={onViewScorecard} />);
    
    // Wait for component to render with data
    await waitFor(() => {
      expect(screen.getByText('Active Config')).toBeInTheDocument();
    });
    
    // Reset fetch mock before toggling checkbox
    fetch.mockReset();
    
    // Mock the response for after toggling the checkbox
    fetch.mockResolvedValueOnce({ ok: true, json: async () => mixedMockData });
    
    // Toggle checkbox to show archived scorecards
    const checkbox = screen.getByLabelText(/show archived scorecards/i);
    fireEvent.click(checkbox);
    
    await waitFor(() => {
      expect(screen.getByText('Archived Config')).toBeInTheDocument();
      expect(screen.getByText('Archived')).toBeInTheDocument();
      
      // Find all archive buttons - there should be only one (for the active scorecard)
      const archiveButtons = screen.getAllByTitle('Archive Scorecard');
      expect(archiveButtons.length).toBe(1);
      
      // The view button should exist for both scorecards
      const viewButtons = screen.getAllByTitle('View Scorecard');
      expect(viewButtons.length).toBe(2);
    });
  });
}); 