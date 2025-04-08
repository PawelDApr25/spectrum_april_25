// Enum for window types
export enum WindowType {
    Hanning = "Hanning",
    Rectangular = "Rectangular"
  }
  
  // Enum for quantity types
  export enum Quantity {
    Acceleration = "Acceleration",
    Velocity = "Velocity",
    Displacement = "Displacement"
  }
  
  // Interface for time waveform
  export interface TimeWaveform {
    data: number[];
    sampleRate: number;
    quantity: Quantity;
  }
  
  // Interface for spectrum results - updated to handle invalid results
  export interface SpectrumResult {
    maxFrequency: number;
    resolution: number;
    quantity: Quantity;
    // Maps frequency band range to calculated value
    bandPeaks: Map<[number, number], number>;
    isValid: boolean; // Flag to indicate if the result is valid
    errorMessage?: string; // Optional error message when invalid
  }
  
  // Type for trend analysis results
  export type TrendData = Map<string, number>;
  
  // Constants according to requirements
  export const CONSTANTS = {
    MAX_LINES: 102400,
    MIN_LINES: 100,
    MAX_SAMPLE_RATE: 131072, // Hz
    MAX_WAVEFORM_LENGTH: 5 * 60, // 5 minutes in seconds
    MAX_SPECTRUM_CALC_TIME: 100, // ms
    PEAK_TOLERANCE: 0.01
  };