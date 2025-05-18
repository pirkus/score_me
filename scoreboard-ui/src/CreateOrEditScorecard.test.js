import React from 'react';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithUser } from './test-utils';
import CreateOrEditScorecard from './CreateOrEditScorecard';

// Mock fetch
global.fetch = jest.fn();

describe('CreateOrEditScorecard', () => {
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

  const mockExistingScorecard = {
    id: 'existing-scorecard-id',
    configName: 'Test Config',
    startDate: '2023-02-01',
    endDate: '2023-02-28',
    generalNotes: 'Some general notes',
    dateCreated: '2023-02-01T12:00:00Z',
    scores: [
      { metricName: 'Numeric Metric', devScore: 7.5, mentorScore: 8, notes: 'Numeric notes' },
      { metricName: 'Checkbox Metric', devScore: true, mentorScore: false, notes: 'Checkbox notes' }
    ]
  };

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

  it('renders form with config selection in create mode', () => {
    renderWithUser(<CreateOrEditScorecard configs={mockConfigs} />);
    expect(screen.getByLabelText(/select configuration/i)).toBeInTheDocument();
    expect(screen.getByText(/create scorecard/i)).toBeInTheDocument();
  });

  it('displays correct input types based on metric score type', async () => {
    renderWithUser(<CreateOrEditScorecard configs={mockConfigs} />);
    await selectConfigOption();
    
    // Wait for the UI to update with the metrics
    await waitFor(() => {
      const numericInputs = screen.getAllByRole('spinbutton');
      const checkboxInputs = screen.getAllByRole('checkbox');
      
      expect(numericInputs.length).toBe(2); // Dev and mentor score for numeric metric
      expect(checkboxInputs.length).toBe(2); // Dev and mentor checkbox for checkbox metric
    });
  });

  it('validates numeric scores', async () => {
    renderWithUser(<CreateOrEditScorecard configs={mockConfigs} />);
    await selectConfigOption();
    
    await waitFor(() => {
      // Find the numeric inputs
      const numericInputs = screen.getAllByRole('spinbutton');
      const devScoreInput = numericInputs[0];
      
      fireEvent.change(devScoreInput, { target: { value: '11' } });
      fireEvent.click(screen.getByRole('button', { name: /submit scorecard/i }));
    });
    
    await waitFor(() => {
      expect(screen.getByText(/score must be between 0 and 10/i)).toBeInTheDocument();
    });
  });

  it('submits form with both score types in create mode', async () => {
    fetch.mockImplementationOnce(() => Promise.resolve({ 
      ok: true, 
      json: () => Promise.resolve({ id: 'new-scorecard-id' }) 
    }));
    
    // Render with mocked clock
    jest.useFakeTimers();
    renderWithUser(<CreateOrEditScorecard configs={mockConfigs} />);
    
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
      expect(screen.getByText('Metric')).toBeInTheDocument();
    });
    
    // Set values for numeric metric
    const numericInputs = screen.getAllByRole('spinbutton');
    fireEvent.change(numericInputs[0], { target: { value: '8' } }); // Dev score
    fireEvent.change(numericInputs[1], { target: { value: '7' } }); // Mentor score
    
    // Set values for checkbox metric
    const checkboxInputs = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxInputs[0]); // Dev checkbox
    fireEvent.click(checkboxInputs[1]); // Mentor checkbox
    
    // Set notes for metrics
    const textareas = screen.getAllByRole('textbox');
    fireEvent.change(textareas[1], { target: { value: 'Good progress' } }); // First metric notes
    fireEvent.change(textareas[2], { target: { value: 'Done well' } }); // Second metric notes
    
    // Set general notes
    fireEvent.change(textareas[0], { target: { value: 'Overall feedback' } }); // General notes
    
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
            'Content-Type': 'application/json'
          }),
          body: expect.stringContaining('Test Config')
        })
      );
      
      const requestBody = JSON.parse(fetch.mock.calls[0][1].body);
      expect(requestBody.configName).toBe('Test Config');
      expect(requestBody.startDate).toBe('2024-01-01');
      expect(requestBody.endDate).toBe('2024-01-31');
      expect(requestBody.generalNotes).toBe('Overall feedback');
      expect(requestBody.scores.length).toBe(2);
      expect(requestBody.scores[0].devScore).toBe(8);
      expect(requestBody.scores[1].devScore).toBe(true);
    });
    
    // Clean up
    jest.useRealTimers();
  });

  // New tests for edit functionality
  it('renders in edit mode with pre-populated values when existingScorecard is provided', () => {
    renderWithUser(
      <CreateOrEditScorecard 
        configs={mockConfigs} 
        existingScorecard={mockExistingScorecard} 
      />
    );
    
    // Check that we're in edit mode
    expect(screen.getByRole('heading', { name: /update scorecard/i })).toBeInTheDocument();
    
    // Check that form is pre-populated with scorecard data
    expect(screen.getByLabelText(/select configuration/i)).toBeDisabled();
    expect(screen.getByLabelText(/select configuration/i)).toHaveValue(mockExistingScorecard.configName);
    expect(screen.getByLabelText(/start date/i)).toHaveValue(mockExistingScorecard.startDate);
    expect(screen.getByLabelText(/end date/i)).toHaveValue(mockExistingScorecard.endDate);
    expect(screen.getByLabelText(/general notes/i)).toHaveValue(mockExistingScorecard.generalNotes);
  });

  it('submits an update with the correct scorecard ID in edit mode', async () => {
    fetch.mockImplementationOnce(() => Promise.resolve({ 
      ok: true, 
      json: () => Promise.resolve({ id: mockExistingScorecard.id }) 
    }));
    
    renderWithUser(
      <CreateOrEditScorecard 
        configs={mockConfigs} 
        existingScorecard={mockExistingScorecard} 
      />
    );
    
    // Wait for the component to load metrics
    await waitFor(() => {
      expect(screen.getByText('Numeric Metric')).toBeInTheDocument();
    });
    
    // Update some values
    const numericInputs = screen.getAllByRole('spinbutton');
    fireEvent.change(numericInputs[0], { target: { value: '9' } }); // Update dev score
    
    const textareas = screen.getAllByRole('textbox');
    fireEvent.change(textareas[0], { target: { value: 'Updated general notes' } }); // Update general notes
    
    // Submit the form
    const submitButton = screen.getByRole('button', { name: /update scorecard/i });
    fireEvent.click(submitButton);
    
    // Check that fetch was called with the right data
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/create-scoreboard'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining(mockExistingScorecard.id)
        })
      );
      
      const requestBody = JSON.parse(fetch.mock.calls[0][1].body);
      expect(requestBody._id).toBe(mockExistingScorecard.id);
      expect(requestBody.generalNotes).toBe('Updated general notes');
      expect(requestBody.scores[0].devScore).toBe(9);
    });
  });

  it('calls onSaveSuccess callback after successful update', async () => {
    fetch.mockImplementationOnce(() => Promise.resolve({ 
      ok: true, 
      json: () => Promise.resolve({ id: mockExistingScorecard.id }) 
    }));
    
    const mockOnSaveSuccess = jest.fn();
    
    renderWithUser(
      <CreateOrEditScorecard 
        configs={mockConfigs} 
        existingScorecard={mockExistingScorecard}
        onSaveSuccess={mockOnSaveSuccess}
      />
    );
    
    // Wait for the component to load metrics
    await waitFor(() => {
      expect(screen.getByText('Numeric Metric')).toBeInTheDocument();
    });
    
    // Submit the form without making changes
    const submitButton = screen.getByRole('button', { name: /update scorecard/i });
    fireEvent.click(submitButton);
    
    // Check that onSaveSuccess was called after successful update
    await waitFor(() => {
      expect(mockOnSaveSuccess).toHaveBeenCalledTimes(1);
    });
  });
}); 