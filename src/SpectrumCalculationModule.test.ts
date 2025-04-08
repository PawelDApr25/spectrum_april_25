import { SpectrumCalculationModule } from './SpectrumCalculationModule';
import { Quantity, WindowType, TimeWaveform } from './types';

describe('SpectrumCalculationModule', () => {
  let module: SpectrumCalculationModule;
  
  // Create a helper to generate test waveforms
  function createTestWaveform(options: {
    sampleRate?: number;
    duration?: number;
    frequency?: number;
    quantity?: Quantity;
  } = {}): TimeWaveform {
    const {
      sampleRate = 10000,
      duration = 1,
      frequency = 50,
      quantity = Quantity.Acceleration
    } = options;
    
    const samples = Math.floor(sampleRate * duration);
    const data = new Array(samples);
    
    for (let i = 0; i < samples; i++) {
      const time = i / sampleRate;
      data[i] = Math.sin(2 * Math.PI * frequency * time);
    }
    
    return {
      data,
      sampleRate,
      quantity
    };
  }
  
  // Create a composite waveform (50Hz, 100Hz, 150Hz)
  function createCompositeWaveform(options: {
    sampleRate?: number;
    duration?: number;
    quantity?: Quantity;
  } = {}): TimeWaveform {
    const {
      sampleRate = 10000,
      duration = 1,
      quantity = Quantity.Acceleration
    } = options;
    
    const samples = Math.floor(sampleRate * duration);
    const data = new Array(samples);
    
    for (let i = 0; i < samples; i++) {
      const time = i / sampleRate;
      data[i] = 1.0 * Math.sin(2 * Math.PI * 50 * time) + 
                0.5 * Math.sin(2 * Math.PI * 100 * time) + 
                0.3 * Math.sin(2 * Math.PI * 150 * time);
    }
    
    return {
      data,
      sampleRate,
      quantity
    };
  }
  
  beforeEach(() => {
    module = new SpectrumCalculationModule();
    // Set some default parameters
    module.setNumberOfLines(1024);
    module.setWindowType(WindowType.Hanning);
    module.setMinFrequency(10);
    module.setMaxFrequency(1000);
  });
  
  // Requirement 1: Integration - acceleration to velocity, velocity to displacement
  test('should integrate acceleration to velocity', () => {
    const waveform = createTestWaveform();
    module.setHighPassFrequency(10); // Enable integration
    
    const spectrum = module.calculateSpectrum(waveform);
    expect(spectrum.isValid).toBe(true);
    expect(spectrum.quantity).toBe(Quantity.Acceleration);
    
    const integratedSpectrum = module.integrateSpectrum(spectrum);
    expect(integratedSpectrum.isValid).toBe(true);
    expect(integratedSpectrum.quantity).toBe(Quantity.Velocity);
  });
  
  test('should integrate velocity to displacement', () => {
    const waveform = createTestWaveform({ quantity: Quantity.Velocity });
    module.setHighPassFrequency(10); // Enable integration
    
    const spectrum = module.calculateSpectrum(waveform);
    expect(spectrum.isValid).toBe(true);
    expect(spectrum.quantity).toBe(Quantity.Velocity);
    
    const integratedSpectrum = module.integrateSpectrum(spectrum);
    expect(integratedSpectrum.isValid).toBe(true);
    expect(integratedSpectrum.quantity).toBe(Quantity.Displacement);
  });
  
  // Requirement 2: Prevent double integration
  test('should not allow double integration (displacement to beyond)', () => {
    const waveform = createTestWaveform({ quantity: Quantity.Displacement });
    module.setHighPassFrequency(10); // Enable integration
    
    const spectrum = module.calculateSpectrum(waveform);
    expect(spectrum.isValid).toBe(true);
    
    const integratedSpectrum = module.integrateSpectrum(spectrum);
    expect(integratedSpectrum.isValid).toBe(false);
    expect(integratedSpectrum.errorMessage).toContain('Cannot integrate displacement');
  });
  
  // Requirement 3a: calculateSpectrum invalid results
  test('should return invalid results when parameters are not set correctly', () => {
    const waveform = createTestWaveform();
    
    // Test with invalid number of lines
    try {
      module.setNumberOfLines(50); // Below minimum
      fail('Should have thrown an error for invalid number of lines');
    } catch (error) {
      expect((error as Error).message).toContain('Number of lines cannot be less than');
    }
    
    // Reset to valid value
    module.setNumberOfLines(1024);
    
    // Test with low sample rate
    const lowSampleRateWaveform = createTestWaveform({ sampleRate: 1000 });
    module.setMaxFrequency(2000); // Requires sample rate > 5120 Hz
    
    const spectrum = module.calculateSpectrum(lowSampleRateWaveform);
    expect(spectrum.isValid).toBe(false);
    expect(spectrum.errorMessage).toContain('Sample rate must be at least 2.56 times higher');
  });
  
  // Requirement 3b: Zero padding to nearest power of two
  test('should perform zero padding when samples are not power of two', () => {
    // Create a waveform with non-power-of-two samples
    const nonPowerOfTwoWaveform = createTestWaveform({ 
      sampleRate: 10000, 
      duration: 0.9 // Creates 9000 samples (not power of two) 
    });
    
    const spectrum = module.calculateSpectrum(nonPowerOfTwoWaveform);
    expect(spectrum.isValid).toBe(true);
    
    // The resolution should reflect zero padding to 16384 (next power of two above 9000)
    const expectedResolution = nonPowerOfTwoWaveform.sampleRate / 16384;
    expect(Math.abs(spectrum.resolution - expectedResolution)).toBeLessThan(0.01);
  });
  
  // Requirement 3e: Integration only allowed with high pass filter
  test('should not allow integration when high pass filter is not set', () => {
    const waveform = createTestWaveform();
    module.setHighPassFrequency(0); // Disable high pass
    
    const spectrum = module.calculateSpectrum(waveform);
    expect(spectrum.isValid).toBe(true);
    
    const integratedSpectrum = module.integrateSpectrum(spectrum);
    expect(integratedSpectrum.isValid).toBe(false);
    expect(integratedSpectrum.errorMessage).toContain('Integration is not allowed when high pass filter is not used');
  });
  
  // Requirement 3f: High pass must be smaller than low pass
  test('should validate that high pass is smaller than low pass', () => {
    const waveform = createTestWaveform();
    module.setHighPassFrequency(200);
    module.setLowPassFrequency(100); // High pass > low pass
    
    const spectrum = module.calculateSpectrum(waveform);
    expect(spectrum.isValid).toBe(false);
    expect(spectrum.errorMessage).toContain('High pass frequency must be smaller than low pass frequency');
  });
  
  // Requirement 4: Integration in frequency domain
  test('should perform integration by dividing by 2*pi*frequency', () => {
    const waveform = createCompositeWaveform();
    module.setHighPassFrequency(10); // Enable integration
    
    const spectrum = module.calculateSpectrum(waveform);
    expect(spectrum.isValid).toBe(true);
    
    const integratedSpectrum = module.integrateSpectrum(spectrum);
    expect(integratedSpectrum.isValid).toBe(true);
    
    // Check that band values are divided by 2*pi*f during integration
    // Get a sample band from around 50Hz
    const findBand = (peaks: Map<[number, number], number>, targetFreq: number) => {
      for (const [band, value] of peaks.entries()) {
        const [start, end] = band;
        if (targetFreq >= start && targetFreq <= end) {
          return { band, value };
        }
      }
      return null;
    };
    
    const band50Hz = findBand(spectrum.bandPeaks, 50);
    const intBand50Hz = findBand(integratedSpectrum.bandPeaks, 50);
    
    if (band50Hz && intBand50Hz) {
      const originalValue = band50Hz.value;
      const integratedValue = intBand50Hz.value;
      const centerFreq = (band50Hz.band[0] + band50Hz.band[1]) / 2;
      const expectedIntegrated = originalValue / (2 * Math.PI * centerFreq);
      
      // Allow for some numerical error
      expect(Math.abs(integratedValue - expectedIntegrated) / expectedIntegrated).toBeLessThan(0.1);
    }
  });
  
  // Requirement 5: Peak in band defined as maximum value
  test('should calculate peak in band as maximum value', () => {
    // Create a test waveform with clearly separated frequency components
    const sampleRate = 10000;
    const duration = 1;
    const samples = Math.floor(sampleRate * duration);
    const data = new Array(samples);
    
    for (let i = 0; i < samples; i++) {
      const time = i / sampleRate;
      // Make 50Hz component 10x stronger than 25Hz
      data[i] = 0.1 * Math.sin(2 * Math.PI * 25 * time) + 
                1.0 * Math.sin(2 * Math.PI * 50 * time);
    }
    
    const testWaveform = {
      data,
      sampleRate,
      quantity: Quantity.Acceleration
    };
    
    // Configure with 25Hz-wide bands
    module.setMinFrequency(0);
    module.setMaxFrequency(100);
    module.setNumberOfLines(4096);
    
    const spectrum = module.calculateSpectrum(testWaveform);
    expect(spectrum.isValid).toBe(true);
    
    // Log all bands for inspection
    console.log("All band peaks:");
    Array.from(spectrum.bandPeaks.entries()).forEach(([band, value]) => {
      console.log(`Band ${band[0]}-${band[1]} Hz: ${value}`);
    });
    
    // Get exact 25Hz and 50Hz bands
    const band25Hz = Array.from(spectrum.bandPeaks.entries())
      .find(([band]) => band[0] === 0 && band[1] === 25);
    const band50Hz = Array.from(spectrum.bandPeaks.entries())
      .find(([band]) => band[0] === 25 && band[1] === 50);
    const band75Hz = Array.from(spectrum.bandPeaks.entries())
      .find(([band]) => band[0] === 50 && band[1] === 75);
    
    console.log("Specific band values:");
    console.log("0-25Hz band:", band25Hz ? band25Hz[1] : "not found");
    console.log("25-50Hz band:", band50Hz ? band50Hz[1] : "not found");
    console.log("50-75Hz band:", band75Hz ? band75Hz[1] : "not found");
    
    // The 50-75Hz band should have higher peak than 0-25Hz band
    // (since our 50Hz component is 10x stronger than 25Hz)
    expect(band75Hz).toBeDefined();
    expect(band25Hz).toBeDefined();
    expect(band75Hz![1]).toBeGreaterThan(band25Hz![1]);
  });
  
  // Requirement 6 & 7: Trends collection and spectrum storage
  test('should store spectrum results and retrieve peak trends', () => {
    const waveform = createTestWaveform();
    module.setHighPassFrequency(10); // Enable integration
    
    const timestamp1 = '2023-01-01T00:00:00Z';
    const timestamp2 = '2023-01-01T01:00:00Z';
    
    // Calculate and store two spectrums
    const spectrum1 = module.calculateSpectrum(waveform);
    module.storeSpectrumResult(timestamp1, spectrum1);
    
    // Create a different waveform with higher amplitude
    const waveform2 = createTestWaveform();
    waveform2.data = waveform2.data.map(val => val * 2); // Double amplitude
    
    const spectrum2 = module.calculateSpectrum(waveform2);
    module.storeSpectrumResult(timestamp2, spectrum2);
    
    // Retrieve and verify
    const retrieved1 = module.retrieveSpectrumResult(timestamp1);
    expect(retrieved1).toBeDefined();
    expect(retrieved1).toEqual(spectrum1);
    
    // Get trend data
    const trend = module.getPeakInBandTrend('2023-01-01T00:00:00Z', '2023-01-01T02:00:00Z');
    expect(trend.size).toBe(2);
    expect(trend.has(timestamp1)).toBe(true);
    expect(trend.has(timestamp2)).toBe(true);
  });
  
  // Requirement 8: Speed calculation
  test('should calculate speed from spectrum data', () => {
    const waveform = createCompositeWaveform();
    module.setHighPassFrequency(10); // Enable integration
    
    const spectrum = module.calculateSpectrum(waveform);
    expect(spectrum.isValid).toBe(true);
    
    const timestamp = '2023-01-01T00:00:00Z';
    module.storeSpectrumResult(timestamp, spectrum);
    
    const speed = module.calculateMachineSpeed(timestamp, spectrum);
    expect(speed).toBeGreaterThan(0); // Should return a positive speed
  });
  
  // Requirement 9 & 14: Number of lines limits
  test('should enforce minimum and maximum number of lines', () => {
    // Test minimum lines
    try {
      module.setNumberOfLines(50); // Below minimum of 100
      fail('Should have thrown an error for lines < 100');
    } catch (error) {
      expect((error as Error).message).toContain('Number of lines cannot be less than');
    }
    
    // Test maximum lines
    try {
      module.setNumberOfLines(150000); // Above maximum of 102400
      fail('Should have thrown an error for lines > 102400');
    } catch (error) {
      expect((error as Error).message).toContain('Number of lines cannot exceed');
    }
    
    // Valid number of lines
    expect(() => module.setNumberOfLines(1024)).not.toThrow();
    expect(() => module.setNumberOfLines(102400)).not.toThrow();
  });
  
  // Requirement 10: Maximum spectrum calculation time
  test('should limit spectrum calculation time', () => {
    // Create a very large waveform to test calculation time
    const largeWaveform = createTestWaveform({
      sampleRate: 131072, // Maximum sample rate
      duration: 0.2 // 26214 samples
    });
    
    module.setNumberOfLines(16384); // Use more lines to increase calculation time
    
    const startTime = Date.now();
    const spectrum = module.calculateSpectrum(largeWaveform);
    const calcTime = Date.now() - startTime;
    
    expect(calcTime).toBeLessThanOrEqual(200); // Allow some leeway beyond 100ms
    
    if (calcTime > 100) {
      expect(spectrum.isValid).toBe(false);
      expect(spectrum.errorMessage).toContain('Spectrum calculation time exceeded maximum');
    }
  });
  
  // Requirement 11: Maximum sample rate
  test('should enforce maximum sample rate', () => {
    const waveformWithHighSampleRate = createTestWaveform({
      sampleRate: 150000, // Above maximum of 131072
    });
    
    const spectrum = module.calculateSpectrum(waveformWithHighSampleRate);
    expect(spectrum.isValid).toBe(false);
    expect(spectrum.errorMessage).toContain('Sample rate cannot exceed');
  });
  
  // Requirement 12: Maximum waveform length
  test('should enforce maximum waveform length', () => {
    // Create a waveform that's too long
    // 5 minutes at max sample rate would be 131072 * 60 * 5 = 39,321,600 samples
    // We'll create a smaller one that still exceeds the limit for testing performance
    const tooLongWaveform = {
      data: new Array(131072 * 60 * 6), // 6 minutes at max sample rate
      sampleRate: 131072,
      quantity: Quantity.Acceleration
    };
    
    // Fill with random data
    for (let i = 0; i < tooLongWaveform.data.length; i++) {
      tooLongWaveform.data[i] = Math.random() * 2 - 1;
    }
    
    const spectrum = module.calculateSpectrum(tooLongWaveform);
    expect(spectrum.isValid).toBe(false);
    expect(spectrum.errorMessage).toContain('Time waveform length exceeds maximum allowed');
  });
  
  // Requirement 13: No negative frequencies
  test('should not allow negative frequencies', () => {
    try {
      module.setMinFrequency(-10);
      fail('Should have thrown an error for negative frequency');
    } catch (error) {
      expect((error as Error).message).toContain('Frequency cannot be negative');
    }
    
    try {
      module.setMaxFrequency(-10);
      fail('Should have thrown an error for negative frequency');
    } catch (error) {
      expect((error as Error).message).toContain('Frequency cannot be negative');
    }
    
    try {
      module.setHighPassFrequency(-10);
      fail('Should have thrown an error for negative frequency');
    } catch (error) {
      expect((error as Error).message).toContain('Frequency cannot be negative');
    }
    
    try {
      module.setLowPassFrequency(-10);
      fail('Should have thrown an error for negative frequency');
    } catch (error) {
      expect((error as Error).message).toContain('Frequency cannot be negative');
    }
  });
  
  // Requirement 15: Filter behavior
  test('should treat 0 as no filtering', () => {
    const waveform = createTestWaveform();
    
    // Test with high pass at 0 (no high pass)
    module.setHighPassFrequency(0);
    module.setLowPassFrequency(1000);
    
    const spectrum = module.calculateSpectrum(waveform);
    expect(spectrum.isValid).toBe(true);
    
    // Integration should not be allowed
    const integratedSpectrum = module.integrateSpectrum(spectrum);
    expect(integratedSpectrum.isValid).toBe(false);
    expect(integratedSpectrum.errorMessage).toContain('Integration is not allowed when high pass filter is not used');
    
    // Test with low pass at 0 (no low pass)
    module.setHighPassFrequency(10);
    module.setLowPassFrequency(0);
    
    const spectrum2 = module.calculateSpectrum(waveform);
    expect(spectrum2.isValid).toBe(true);
    
    // Integration should be allowed now
    const integratedSpectrum2 = module.integrateSpectrum(spectrum2);
    expect(integratedSpectrum2.isValid).toBe(true);
  });
  
  // Requirement 16: Peak in band tolerance
  test('should calculate peaks within tolerance', () => {
    const waveform = createCompositeWaveform();
    module.setHighPassFrequency(10); // Enable integration
    
    const spectrum = module.calculateSpectrum(waveform);
    expect(spectrum.isValid).toBe(true);
    
    // Calculate peak in band manually and check that module result is similar
    const band50Hz = Array.from(spectrum.bandPeaks.entries())
      .find(([band]) => band[0] <= 50 && band[1] >= 50);
    
    if (band50Hz) {
      const [, peakValue] = band50Hz;
      const calculatedPeak = module.calculatePeakInBand(spectrum, band50Hz[0][0], band50Hz[0][1]);
      
      // Check that the calculated peak is within 0.01 tolerance
      expect(Math.abs(calculatedPeak - peakValue)).toBeLessThanOrEqual(0.01);
    }
  });

  // Test band range validation
  test('should validate band range settings', () => {
    const waveform = createTestWaveform();
    
    // Test with band range larger than max frequency
    module.setMinFrequency(0);
    module.setMaxFrequency(100);
    
    // Expect an error when setting invalid band range
    expect(() => {
      module.setBandRange(150); // Larger than max frequency
    }).toThrow('Band range cannot be larger than max frequency');
    
    // Test with valid band range
    module.setBandRange(25);
    const validSpectrum = module.calculateSpectrum(waveform);
    expect(validSpectrum.isValid).toBe(true);
    
    // Verify band widths
    const bands = Array.from(validSpectrum.bandPeaks.keys());
    expect(bands.length).toBeGreaterThan(0);
    bands.forEach(([start, end]) => {
      expect(end - start).toBe(25); // Each band should be 25Hz wide
    });
  });
}); 