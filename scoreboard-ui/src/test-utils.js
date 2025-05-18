import React from 'react';
import { render } from '@testing-library/react';

// Mock the useTokenExpiryCheck hook
jest.mock('./useTokenExpiryCheck', () => ({
  __esModule: true,
  default: () => {},
}));

// Mock user for testing
export const mockUser = {
  token: 'mock-access-token',
  decoded: { email: 'test@example.com', name: 'Test User' },
};

// Custom render function that injects user and setUser as props
export const renderWithUser = (ui, { user = mockUser, setUser = jest.fn(), ...renderOptions } = {}) => {
  // Clone the element and inject user/setUser props
  const element = React.cloneElement(ui, { user, setUser });
  return render(element, renderOptions);
}; 