import { WindowType, Quantity, TimeWaveform, SpectrumResult, TrendData, CONSTANTS } from './types';
import FFT from 'fft.js';

export class SpectrumCalculationModule {
  private numberOfLines: number = 1024;
  private windowType: WindowType = WindowType.Hanning;
  private minFrequency: number = 0;
  private maxFrequency: number = 1000;
  private highPassFrequency: number = 0; // Added high pass filter
  private lowPassFrequency: number = 0;  // Added low pass filter
  private bandRange: number = 25; // Default band range
  private spectrumDatabase: Map<string, SpectrumResult> = new Map();
  
  // Helper to check if parameters are properly set
  private areParametersValid(): boolean {
    return (
      this.numberOfLines >= CONSTANTS.MIN_LINES && 
      this.numberOfLines <= CONSTANTS.MAX_LINES &&
      this.minFrequency >= 0 &&
      this.maxFrequency > this.minFrequency &&
      this.bandRange > 0 &&
      this.bandRange <= this.maxFrequency
    );
  }
  
  // Helper to check if high pass and low pass are valid
  private isFilterValid(): boolean {
    if (this.highPassFrequency === 0) {
      return true; // No high pass filter
    }
    
    if (this.lowPassFrequency === 0) {
      return true; // No low pass filter
    }
    
    return this.highPassFrequency < this.lowPassFrequency;
  }
  
  // Helper to check if integration is allowed
  private isIntegrationAllowed(): boolean {
    // High pass filter must be used for integration
    return this.highPassFrequency > 0;
  }

  constructor() {
    // Initialize with default values
  }

  setNumberOfLines(lines: number): void {
    if (lines < CONSTANTS.MIN_LINES) {
      throw new Error(`Number of lines cannot be less than ${CONSTANTS.MIN_LINES}`);
    }
    
    if (lines > CONSTANTS.MAX_LINES) {
      throw new Error(`Number of lines cannot exceed ${CONSTANTS.MAX_LINES}`);
    }
    
    this.numberOfLines = lines;
  }

  setWindowType(type: WindowType): void {
    this.windowType = type;
  }

  setMinFrequency(frequency: number): void {
    if (frequency < 0) {
      throw new Error("Frequency cannot be negative");
    }
    this.minFrequency = frequency;
  }

  setMaxFrequency(frequency: number): void {
    if (frequency < 0) {
      throw new Error("Frequency cannot be negative");
    }
    this.maxFrequency = frequency;
  }
  
  setHighPassFrequency(frequency: number): void {
    if (frequency < 0) {
      throw new Error("Frequency cannot be negative");
    }
    this.highPassFrequency = frequency;
  }
  
  setLowPassFrequency(frequency: number): void {
    if (frequency < 0) {
      throw new Error("Frequency cannot be negative");
    }
    this.lowPassFrequency = frequency;
  }

  setBandRange(range: number): void {
    if (range <= 0) {
      throw new Error("Band range must be positive");
    }
    if (range > this.maxFrequency) {
      throw new Error("Band range cannot be larger than max frequency");
    }
    this.bandRange = range;
  }

  calculateSpectrum(waveform: TimeWaveform): SpectrumResult {
    const startTime = Date.now();
    
    // Check input parameters
    if (!this.areParametersValid()) {
      return {
        maxFrequency: this.maxFrequency,
        resolution: 0,
        quantity: waveform.quantity,
        bandPeaks: new Map(),
        isValid: false,
        errorMessage: "Invalid spectrum parameters"
      };
    }
    
    // Check filter configuration
    if (!this.isFilterValid()) {
      return {
        maxFrequency: this.maxFrequency,
        resolution: 0,
        quantity: waveform.quantity,
        bandPeaks: new Map(),
        isValid: false,
        errorMessage: "High pass frequency must be smaller than low pass frequency"
      };
    }
    
    // Check sample rate against max frequency (2.56 times higher required)
    if (waveform.sampleRate < this.maxFrequency * 2.56) {
      return {
        maxFrequency: this.maxFrequency,
        resolution: 0,
        quantity: waveform.quantity,
        bandPeaks: new Map(),
        isValid: false,
        errorMessage: "Sample rate must be at least 2.56 times higher than maximum frequency"
      };
    }
    
    // Check maximum sample rate
    if (waveform.sampleRate > CONSTANTS.MAX_SAMPLE_RATE) {
      return {
        maxFrequency: this.maxFrequency,
        resolution: 0,
        quantity: waveform.quantity,
        bandPeaks: new Map(),
        isValid: false,
        errorMessage: `Sample rate cannot exceed ${CONSTANTS.MAX_SAMPLE_RATE} Hz`
      };
    }
    
    // Check maximum waveform length
    const maxSamples = CONSTANTS.MAX_SAMPLE_RATE * CONSTANTS.MAX_WAVEFORM_LENGTH;
    if (waveform.data.length > maxSamples) {
      return {
        maxFrequency: this.maxFrequency,
        resolution: 0,
        quantity: waveform.quantity,
        bandPeaks: new Map(),
        isValid: false,
        errorMessage: `Time waveform length exceeds maximum allowed (5 minutes at ${CONSTANTS.MAX_SAMPLE_RATE} Hz)`
      };
    }
    
    // Apply window function based on this.windowType
    const windowedData = this.applyWindow(waveform.data);
    
    // Find the next power of two for zero padding
    const nextPowerOfTwo = this.getNextPowerOfTwo(windowedData.length);
    
    // Zero padding if needed
    let paddedData = windowedData;
    if (nextPowerOfTwo > windowedData.length) {
      paddedData = new Array(nextPowerOfTwo).fill(0);
      for (let i = 0; i < windowedData.length; i++) {
        paddedData[i] = windowedData[i];
      }
    }
    
    // Calculate FFT
    const fft = new FFT(paddedData.length);
    const out = fft.createComplexArray();
    fft.realTransform(out, paddedData);
    
    // Convert to magnitude spectrum with precision limit
    const spectrum = new Array(paddedData.length / 2);
    for (let i = 0; i < paddedData.length / 2; i++) {
      const real = out[2 * i];
      const imag = out[2 * i + 1];
      spectrum[i] = this.limitPrecision(Math.sqrt(real * real + imag * imag) / paddedData.length);
    }
    
    // Calculate frequency resolution
    const resolution = waveform.sampleRate / paddedData.length;
    
    // Apply frequency domain filtering
    const filteredSpectrum = this.applyFrequencyDomainFiltering(spectrum, resolution);
    
    // Limit to number of lines elements
    const limitedSpectrum = filteredSpectrum.slice(0, Math.min(filteredSpectrum.length, this.numberOfLines));
    
    // Create spectrum result
    const result: SpectrumResult = {
      maxFrequency: this.maxFrequency,
      resolution: resolution,
      quantity: waveform.quantity,
      bandPeaks: new Map(),
      isValid: true
    };
    
    // Create bands based on bandRange
    for (let startFreq = this.minFrequency; startFreq < this.maxFrequency; startFreq += this.bandRange) {
      const endFreq = Math.min(startFreq + this.bandRange, this.maxFrequency);
      const peakValue = this.calculateRealPeakInBand(spectrum, startFreq, endFreq, resolution);
      result.bandPeaks.set([startFreq, endFreq], peakValue);
    }
    
    // Store raw spectrum data for visualization
    (result as any).rawSpectrum = spectrum;
    
    // Check if computation time exceeded maximum allowed
    if (Date.now() - startTime > CONSTANTS.MAX_SPECTRUM_CALC_TIME) {
      return {
        maxFrequency: this.maxFrequency,
        resolution: resolution,
        quantity: waveform.quantity,
        bandPeaks: new Map(),
        isValid: false,
        errorMessage: `Spectrum calculation time exceeded maximum allowed (${CONSTANTS.MAX_SPECTRUM_CALC_TIME} ms)`
      };
    }
    
    return result;
  }

  integrateSpectrum(spectrum: SpectrumResult): SpectrumResult {
    // Check if integration is allowed
    if (!this.isIntegrationAllowed()) {
      return {
        ...spectrum,
        isValid: false,
        errorMessage: "Integration is not allowed when high pass filter is not used"
      };
    }
    
    // Check if we're already at displacement (cannot integrate further)
    if (spectrum.quantity === Quantity.Displacement) {
      return {
        ...spectrum,
        isValid: false,
        errorMessage: "Cannot integrate displacement to prevent double integration"
      };
    }
    
    // Change quantity based on integration
    let newQuantity: Quantity;
    
    switch (spectrum.quantity) {
      case Quantity.Acceleration:
        newQuantity = Quantity.Velocity;
        break;
      case Quantity.Velocity:
        newQuantity = Quantity.Displacement;
        break;
      default:
        newQuantity = spectrum.quantity;
    }
    
    const result: SpectrumResult = {
      ...spectrum,
      quantity: newQuantity,
      bandPeaks: new Map(),
      isValid: true
    };
    
    // Apply frequency domain integration to each band
    for (const [band, value] of spectrum.bandPeaks.entries()) {
      const centerFreq = (band[0] + band[1]) / 2;
      
      // Skip bands with too low frequency
      if (centerFreq <= 0) {
        continue;
      }
      
      // Integration in frequency domain with precision limit
      const integratedValue = this.limitPrecision(value / (2 * Math.PI * centerFreq));
      result.bandPeaks.set(band, integratedValue);
    }
    
    return result;
  }

  calculatePeakInBand(spectrum: SpectrumResult, startFreq: number, endFreq: number): number {
    // Check if spectrum is valid
    if (!spectrum.isValid) {
      return -1; // Return invalid value
    }
    
    // Check if this band is already calculated
    for (const [band, value] of spectrum.bandPeaks.entries()) {
      if (band[0] === startFreq && band[1] === endFreq) {
        return value;
      }
    }
    
    // If we have the raw spectrum data, we could calculate the peak
    // For now, return an approximate value (might not be within tolerance)
    return -1;
  }
  
  // This method would be used internally with the actual spectrum data
  private calculateRealPeakInBand(
    spectrum: number[], 
    startFreq: number, 
    endFreq: number, 
    resolution: number
  ): number {
    // Calculate indices corresponding to frequency band
    const startIndex = Math.floor(startFreq / resolution);
    const endIndex = Math.ceil(endFreq / resolution);
    
    // Find the maximum value in the band
    let maxValue = 0;
    for (let i = startIndex; i < endIndex && i < spectrum.length; i++) {
      if (spectrum[i] > maxValue) {
        maxValue = spectrum[i];
      }
    }
    
    // Limit precision to 10 decimal places
    return this.limitPrecision(maxValue);
  }

  getPeakInBandTrend(startDate: string, endDate: string): TrendData {
    // Get trend data for a specific band over time
    const trend: TrendData = new Map();
    
    // Filter spectrum results within the date range
    for (const [timestamp, result] of this.spectrumDatabase.entries()) {
      if (result.isValid && timestamp >= startDate && timestamp <= endDate) {
        // Find the highest peak across all bands
        let maxPeak = 0;
        for (const value of result.bandPeaks.values()) {
          if (value > maxPeak) {
            maxPeak = value;
          }
        }
        trend.set(timestamp, maxPeak);
      }
    }
    
    return trend;
  }

  calculateMachineSpeed(date: string, spectralData: SpectrumResult): number {
    // Check if spectrum is valid
    if (!spectralData.isValid) {
      return -1; // Invalid
    }
    
    // Calculate average of all peaks
    let sum = 0;
    let count = 0;
    const peakValues = Array.from(spectralData.bandPeaks.values());
    
    for (const peak of peakValues) {
      sum += peak;
      count++;
    }
    
    if (count === 0) {
      return -1; // No peaks, invalid result
    }
    
    const avgPeak = sum / count;
    
    // Find frequency for bin which is twice higher than average of all peaks
    const targetValue = avgPeak * 2;
    
    // Find matching peak
    let peakFrequency = -1;
    for (const [band, value] of spectralData.bandPeaks.entries()) {
      if (value >= targetValue) {
        // Use center frequency of the band
        peakFrequency = (band[0] + band[1]) / 2;
        break;
      }
    }
    
    if (peakFrequency === -1) {
      return -1; // No peak found that is twice the average
    }
    
    // Convert frequency to RPM (assuming the frequency is in Hz)
    return peakFrequency * 60;
  }

  storeSpectrumResult(timestamp: string, result: SpectrumResult): void {
    this.spectrumDatabase.set(timestamp, result);
  }

  retrieveSpectrumResult(timestamp: string): SpectrumResult | undefined {
    return this.spectrumDatabase.get(timestamp);
  }

  private applyWindow(data: number[]): number[] {
    const result = [...data];
    const n = data.length;
    
    switch (this.windowType) {
      case WindowType.Hanning:
        // Apply Hanning window
        for (let i = 0; i < n; i++) {
          result[i] *= 0.5 * (1 - Math.cos(2 * Math.PI * i / (n - 1)));
        }
        break;
      case WindowType.Rectangular:
        // Rectangular window is just the original data
        break;
    }
    
    return result;
  }
  
  private getNextPowerOfTwo(n: number): number {
    // If n is already a power of two, return it
    if ((n & (n - 1)) === 0) {
      return n;
    }
    
    // Otherwise, find the next power of two
    let power = 1;
    while (power < n) {
      power *= 2;
    }
    
    return power;
  }
  
  private applyFrequencyDomainFiltering(spectrum: number[], resolution: number): number[] {
    const filtered = [...spectrum];
    
    // Apply high-pass filter (set frequencies below minFrequency to zero)
    const minFreqIndex = Math.floor(this.minFrequency / resolution);
    for (let i = 0; i < minFreqIndex && i < filtered.length; i++) {
      filtered[i] = 0;
    }
    
    // Apply specific high-pass filter if set
    if (this.highPassFrequency > 0) {
      const highPassIndex = Math.floor(this.highPassFrequency / resolution);
      for (let i = 0; i < highPassIndex && i < filtered.length; i++) {
        filtered[i] = 0;
      }
    }
    
    // Apply low-pass filter if set (cut frequencies above maxFrequency or lowPassFrequency)
    const cutoffFreq = this.lowPassFrequency > 0 ? 
      Math.min(this.maxFrequency, this.lowPassFrequency) : 
      this.maxFrequency;
      
    const cutoffIndex = Math.ceil(cutoffFreq / resolution);
    for (let i = cutoffIndex; i < filtered.length; i++) {
      filtered[i] = 0;
    }
    
    return filtered;
  }

  private limitPrecision(value: number): number {
    return parseFloat(value.toFixed(10));
  }
}