import React from 'react';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithUser } from './test-utils';
import CreateScorecard from './CreateScorecard';

// Mock fetch
global.fetch = jest.fn();

describe('CreateScorecard', () => {
  const mockConfigs = [
    {
      id: 'config-1',
      name: 'Test Config',
      metrics: [
        { name: 'Numeric Metric', scoreType: 'numeric' },
        { name: 'Checkbox Metric', scoreType: 'checkbox' }
      ]
    }
  ];

  beforeEach(() => {
    fetch.mockClear();
  });

  function selectConfigOption() {
    // Select the config dropdown
    const selectElement = screen.getByLabelText(/select configuration/i);
    // Simulate the selection change
    fireEvent.change(selectElement, { target: { value: mockConfigs[0].name } });
    
    // Wait for the config details to be set
    return new Promise(resolve => setTimeout(resolve, 0));
  }

  it('renders form with config selection', () => {
    renderWithUser(<CreateScorecard configs={mockConfigs} />);
    expect(screen.getByLabelText(/select configuration/i)).toBeInTheDocument();
  });

  it('displays correct input types based on metric score type', async () => {
    renderWithUser(<CreateScorecard configs={mockConfigs} />);
    await selectConfigOption();
    
    // Wait for the UI to update with the metrics
    await waitFor(() => {
      // Look for number inputs instead of role="spinbutton"
      expect(screen.getAllByLabelText(/dev score for/i).length).toBeGreaterThan(0); 
      expect(screen.getAllByLabelText(/mentor score for/i).length).toBeGreaterThan(0);
      expect(screen.getAllByRole('checkbox').length).toBeGreaterThan(0);
    });
  });

  it('validates numeric scores', async () => {
    renderWithUser(<CreateScorecard configs={mockConfigs} />);
    await selectConfigOption();
    
    await waitFor(() => {
      // Find the number input by its label
      const devScoreInput = screen.getAllByLabelText(/dev score for/i)[0];
      expect(devScoreInput).toBeInTheDocument();
      
      fireEvent.change(devScoreInput, { target: { value: '11' } });
      fireEvent.click(screen.getByRole('button', { name: /submit scorecard/i }));
    });
    
    await waitFor(() => {
      expect(screen.getByText(/score must be between 0 and 10/i)).toBeInTheDocument();
    });
  });

  it('submits form with both score types', async () => {
    fetch.mockImplementationOnce(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ id: 'new-scorecard-id' }) }));
    
    // Render with mocked clock
    jest.useFakeTimers();
    renderWithUser(<CreateScorecard configs={mockConfigs} />);
    
    // Select config and set date values first
    const configSelect = screen.getByLabelText(/select configuration/i);
    fireEvent.change(configSelect, { target: { value: mockConfigs[0].name } });
    
    // Advance the timer to ensure state updates
    jest.advanceTimersByTime(100);
    
    // Set date values
    fireEvent.change(screen.getByLabelText(/start date/i), { target: { value: '2024-01-01' } });
    fireEvent.change(screen.getByLabelText(/end date/i), { target: { value: '2024-01-31' } });
    
    // Wait for the UI to update and the metrics to be visible
    await waitFor(() => {
      expect(screen.getByText('Numeric Metric')).toBeInTheDocument();
    });
    
    // Set values for numeric metric
    const devScoreInput = screen.getByLabelText(/dev score for numeric metric/i);
    fireEvent.change(devScoreInput, { target: { value: '8' } });
    
    const mentorScoreInput = screen.getByLabelText(/mentor score for numeric metric/i);
    fireEvent.change(mentorScoreInput, { target: { value: '7' } });
    
    // Set values for checkbox metric
    const checkboxInputs = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxInputs[0]); // Dev checkbox
    fireEvent.click(checkboxInputs[1]); // Mentor checkbox
    
    // Set notes
    const noteInputs = screen.getAllByLabelText(/notes for/i);
    fireEvent.change(noteInputs[0], { target: { value: 'Good progress' } });
    fireEvent.change(noteInputs[1], { target: { value: 'Done well' } });
    
    // Set general notes
    const generalNotes = screen.getByLabelText(/general notes/i);
    fireEvent.change(generalNotes, { target: { value: 'Overall feedback' } });
    
    // Submit the form
    const submitButton = screen.getByRole('button', { name: /submit scorecard/i });
    fireEvent.click(submitButton);
    
    // Check that fetch was called with the right data
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/create-scoreboard'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            Authorization: expect.any(String)
          }),
          body: expect.stringContaining('Test Config')
        })
      );
    });
    
    // Clean up
    jest.useRealTimers();
  });
}); 