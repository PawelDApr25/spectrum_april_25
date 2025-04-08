import { main } from './index';

// Mock console.log to capture output
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
let consoleOutput: string[] = [];

describe('Main application', () => {
  beforeEach(() => {
    // Setup console mock
    consoleOutput = [];
    console.log = jest.fn((...args) => {
      consoleOutput.push(args.join(' '));
    });
    console.error = jest.fn((...args) => {
      consoleOutput.push('ERROR: ' + args.join(' '));
    });
  });

  afterEach(() => {
    // Restore console
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
  });

  test('should run without errors and produce expected output', () => {
    // Export the main function in index.ts to make it testable
    main();
    
    // Check for expected output
    expect(consoleOutput.some(line => line.includes('Spectrum calculated successfully'))).toBe(true);
    expect(consoleOutput.some(line => line.includes('Integrated spectrum quantity'))).toBe(true);
    expect(consoleOutput.some(line => line.includes('Invalid number of lines correctly rejected'))).toBe(true);
  });
}); 