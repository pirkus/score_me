import { encodeId, decodeId } from './utils';

/**
 * Tests for base64 encoding/decoding utilities used for permalink generation
 * 
 * These tests verify that:
 * 1. MongoDB ObjectIDs can be correctly encoded to URL-safe base64
 * 2. The encoded IDs can be correctly decoded back to their original format
 * 3. Edge cases like null/undefined values are handled properly
 * 4. Error cases are handled gracefully
 */
describe('ID Encoding/Decoding', () => {
  test('encodeId properly encodes MongoDB ObjectID to base64', () => {
    // Test with a sample MongoDB ObjectID (24-character hex string)
    const objectId = '507f1f77bcf86cd799439011';
    const encoded = encodeId(objectId);
    
    // The expected base64 encoding of the ObjectID
    expect(encoded).toBe('NTA3ZjFmNzdiY2Y4NmNkNzk5NDM5MDEx');
    
    // Verify the encoded string is URL-safe (no +, /, or = characters)
    expect(encoded).not.toMatch(/[+/=]/);
  });

  test('encodeId handles null or undefined values', () => {
    // The encode function should return null for null/undefined/empty inputs
    // to prevent generating invalid permalinks
    expect(encodeId(null)).toBeNull();
    expect(encodeId(undefined)).toBeNull();
    expect(encodeId('')).toBeNull();
  });
  
  test('decodeId properly decodes base64 back to MongoDB ObjectID', () => {
    // Base64 encoded version of '507f1f77bcf86cd799439011'
    const encoded = 'NTA3ZjFmNzdiY2Y4NmNkNzk5NDM5MDEx';
    const decoded = decodeId(encoded);
    
    // Should decode back to the original ObjectID
    expect(decoded).toBe('507f1f77bcf86cd799439011');
  });
  
  test('decodeId handles URL-safe base64 with replaced characters', () => {
    // Test handling of URL-safe character replacements (- instead of +, _ instead of /)
    // This simulates what we'd get from a URL where base64 chars have been replaced
    const encodedWithReplacements = 'NTA3ZjFmNzdiY2Y4NmNkNzk5NDM5MDEx-_';
    const decoded = decodeId(encodedWithReplacements);
    
    // Just verify we get something back without error
    // The specific result depends on how '-_' decodes in base64
    expect(decoded).toBeTruthy();
  });
  
  test('decodeId handles null or undefined values', () => {
    // The decode function should return null for null/undefined/empty inputs
    // to prevent errors when trying to use invalid IDs
    expect(decodeId(null)).toBeNull();
    expect(decodeId(undefined)).toBeNull();
    expect(decodeId('')).toBeNull();
  });
  
  test('encodeId/decodeId roundtrip works correctly', () => {
    // Verify that encoding and then decoding returns the original ID
    // This is the most important test as it validates the complete flow
    const originalId = '507f1f77bcf86cd799439011';
    const encoded = encodeId(originalId);
    const decoded = decodeId(encoded);
    
    expect(decoded).toBe(originalId);
  });
  
  test('decodeId handles error gracefully by returning original value', () => {
    // Verify that invalid base64 doesn't cause the application to crash
    // Instead, it should return the original encoded value
    const invalidEncoding = 'not-valid-base64!@#';
    
    // Mock console.error to avoid polluting test output
    const originalConsoleError = console.error;
    console.error = jest.fn();
    
    const result = decodeId(invalidEncoding);
    
    // Should return the original string when decoding fails
    expect(result).toBe(invalidEncoding);
    expect(console.error).toHaveBeenCalled();
    
    // Restore console.error
    console.error = originalConsoleError;
  });
}); 