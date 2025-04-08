import { SpectrumCalculationModule } from './SpectrumCalculationModule';
import { TimeWaveform, Quantity, WindowType } from './types';

// Create a sample time waveform
const createSampleWaveform = (): TimeWaveform => {
  const sampleRate = 10000; // 10 kHz
  const duration = 1; // 1 second
  const samples = sampleRate * duration;
  const data: number[] = [];
  
  // Generate a composite of sine waves
  for (let i = 0; i < samples; i++) {
    const time = i / sampleRate;
    // 50 Hz fundamental with harmonics at 100 Hz and 150 Hz
    data.push(
      1.0 * Math.sin(2 * Math.PI * 50 * time) + 
      0.5 * Math.sin(2 * Math.PI * 100 * time) + 
      0.3 * Math.sin(2 * Math.PI * 150 * time)
    );
  }
  
  return {
    data,
    sampleRate,
    quantity: Quantity.Acceleration
  };
};

// Main function
export const main = () => {
  // Create module
  const spectrumModule = new SpectrumCalculationModule();
  
  try {
    // Configure settings
    spectrumModule.setNumberOfLines(1024);
    spectrumModule.setWindowType(WindowType.Hanning);
    spectrumModule.setMinFrequency(10); // 10 Hz high-pass
    spectrumModule.setMaxFrequency(1000); // 1 kHz low-pass
    spectrumModule.setHighPassFrequency(10); // Enable integration
    spectrumModule.setLowPassFrequency(1000);
    
    // Create sample data
    const waveform = createSampleWaveform();
    
    console.log('Sample rate:', waveform.sampleRate, 'Hz');
    console.log('Number of samples:', waveform.data.length);
    
    // Calculate spectrum
    const spectrum = spectrumModule.calculateSpectrum(waveform);
    
    if (spectrum.isValid) {
      console.log('Spectrum calculated successfully');
      console.log('Resolution:', spectrum.resolution, 'Hz');
      console.log('Number of bands:', spectrum.bandPeaks.size);
      
      // Calculate and display peak in specific bands
      console.log('Peak in 40-60 Hz band:', spectrumModule.calculatePeakInBand(spectrum, 40, 60));
      console.log('Peak in 90-110 Hz band:', spectrumModule.calculatePeakInBand(spectrum, 90, 110));
      console.log('Peak in 140-160 Hz band:', spectrumModule.calculatePeakInBand(spectrum, 140, 160));
      
      // Store result
      const timestamp = new Date().toISOString();
      spectrumModule.storeSpectrumResult(timestamp, spectrum);
      
      // Retrieve and verify
      const retrieved = spectrumModule.retrieveSpectrumResult(timestamp);
      console.log('Retrieved spectrum result:', retrieved !== undefined && retrieved.isValid);
      
      // Integrate spectrum (acceleration to velocity)
      const integratedSpectrum = spectrumModule.integrateSpectrum(spectrum);
      
      if (integratedSpectrum.isValid) {
        console.log('Integrated spectrum quantity:', integratedSpectrum.quantity);
        
        // Try to integrate again (velocity to displacement)
        const doubleIntegrated = spectrumModule.integrateSpectrum(integratedSpectrum);
        if (doubleIntegrated.isValid) {
          console.log('Double integrated spectrum quantity:', doubleIntegrated.quantity);
        } else {
          console.log('Double integration failed:', doubleIntegrated.errorMessage);
        }
      } else {
        console.log('Integration failed:', integratedSpectrum.errorMessage);
      }
      
      // Calculate machine speed
      const speed = spectrumModule.calculateMachineSpeed(timestamp, spectrum);
      if (speed > 0) {
        console.log('Calculated machine speed:', speed, 'RPM');
      } else {
        console.log('Could not calculate machine speed (invalid result)');
      }
    } else {
      console.error('Spectrum calculation failed:', spectrum.errorMessage);
    }
    
    // Test invalid configurations
    
    // 1. Test invalid number of lines
    try {
      spectrumModule.setNumberOfLines(50); // Less than minimum 100
      console.log('Should not reach here');
    } catch (error) {
      console.log('Invalid number of lines correctly rejected:', (error as Error).message);
    }
    
    // 2. Test integration without high-pass filter
    spectrumModule.setHighPassFrequency(0); // Disable high-pass (integration not allowed)
    
    const spectrumNoHighPass = spectrumModule.calculateSpectrum(waveform);
    if (spectrumNoHighPass.isValid) {
      const integrated = spectrumModule.integrateSpectrum(spectrumNoHighPass);
      console.log('Integration with no high-pass result:', 
        integrated.isValid ? 'Valid (incorrect)' : 'Invalid (correct)', 
        integrated.errorMessage || '');
    }
    
  } catch (error) {
    console.error('Error:', (error as Error).message);
  }
};

// Only run the main function if this file is executed directly
if (require.main === module) {
  main();
}