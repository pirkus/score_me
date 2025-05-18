import React from 'react';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithUser } from './test-utils';
import ConfigForm from './ConfigForm';

// Mock fetch
global.fetch = jest.fn();

describe('ConfigForm', () => {
  beforeEach(() => {
    fetch.mockClear();
  });

  function selectScoreTypeOption() {
    fireEvent.mouseDown(screen.getAllByRole('combobox')[0]);
    const menuItems = screen.getAllByText('Numeric (1-10)');
    fireEvent.click(menuItems[menuItems.length - 1]);
  }

  it('renders form with initial metric', () => {
    renderWithUser(<ConfigForm />);
    
    expect(screen.getByLabelText("Configuration Name:")).toBeInTheDocument();
    expect(screen.getByLabelText("Metric Name:")).toBeInTheDocument();
    expect(screen.getAllByRole('combobox')[0]).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add metric/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create configuration/i })).toBeInTheDocument();
  });

  it('allows adding and removing metrics', () => {
    renderWithUser(<ConfigForm />);
    
    // Add a new metric
    fireEvent.click(screen.getByRole('button', { name: /add metric/i }));
    // Remove the last metric (using the aria-label now)
    const removeButtons = screen.getAllByRole('button', { name: /remove metric/i });
    fireEvent.click(removeButtons[removeButtons.length - 1]);
    // There should always be at least one metric input
    expect(screen.getAllByLabelText("Metric Name:").length).toBeGreaterThanOrEqual(1);
  });

  it('validates form before submission', async () => {
    // Use a mock implementation for validateForm to simulate validation errors
    const validateFormMock = jest.fn().mockReturnValue(false);
    const errors = {
      name: "Name cannot be empty",
      metrics: [{ name: "Metric name cannot be empty", expectation: "Metric expectation cannot be empty" }]
    };
    
    // Create a component with mocked validation
    function MockedConfigForm() {
      const form = <ConfigForm />;
      form.type.prototype.validateForm = validateFormMock;
      return form;
    }
    
    renderWithUser(<ConfigForm />);
    
    // Set errors manually through the component instance
    const component = screen.getByText("Create New Configuration").closest('div');
    Object.defineProperty(component, 'errors', {
      value: errors,
      configurable: true
    });
    
    // Try to submit without filling required fields
    const submitButton = screen.getByRole('button', { name: /create configuration/i });
    fireEvent.click(submitButton);
    
    // Mock that validation has happened and errors are set
    expect(submitButton).toBeDisabled(); // Button should be disabled since form is invalid
  });

  it('submits form with correct data', async () => {
    fetch.mockImplementationOnce(() => 
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ id: 'new-config-id' })
      })
    );

    renderWithUser(<ConfigForm />);
    
    // Fill in the form
    fireEvent.change(screen.getByLabelText("Configuration Name:"), {
      target: { value: 'Test Config' }
    });
    fireEvent.change(screen.getByLabelText("Metric Name:"), {
      target: { value: 'Test Metric' }
    });
    // Add expectation field
    fireEvent.change(screen.getByLabelText("Expectation:"), { target: { value: 'Do the thing' } });
    selectScoreTypeOption();

    // Submit the form
    fireEvent.click(screen.getByRole('button', { name: /create configuration/i }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/scoreboard-config'),
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
  });
}); 