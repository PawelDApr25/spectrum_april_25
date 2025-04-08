import express from 'express';
import bodyParser from 'body-parser';
import path from 'path';
import { SpectrumCalculationModule } from './SpectrumCalculationModule';
import { WindowType, Quantity, TimeWaveform } from './types';

const app = express();
const port = 1337;

// Set up middleware
app.use(bodyParser.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, '../public')));

// Create a single instance of our spectrum module
const spectrumModule = new SpectrumCalculationModule();

// API endpoint to process spectrum data
app.post('/api/process', (req, res) => {
  try {
    const {
      numberOfLines,
      windowType,
      minFrequency,
      maxFrequency,
      highPassFrequency,
      lowPassFrequency,
      waveformData
    } = req.body;

    // Configure the module
    spectrumModule.setNumberOfLines(parseInt(numberOfLines));
    spectrumModule.setWindowType(windowType as WindowType);
    spectrumModule.setMinFrequency(parseFloat(minFrequency));
    spectrumModule.setMaxFrequency(parseFloat(maxFrequency));
    spectrumModule.setHighPassFrequency(parseFloat(highPassFrequency));
    spectrumModule.setLowPassFrequency(parseFloat(lowPassFrequency));

    // Create the time waveform from the provided data
    const waveform: TimeWaveform = {
      data: waveformData.data,
      sampleRate: parseFloat(waveformData.sampleRate),
      quantity: waveformData.quantity as Quantity
    };

    // Calculate the spectrum
    const spectrum = spectrumModule.calculateSpectrum(waveform);
    
    // For visualization, we need the full spectrum data
    let frequencyBins: number[] = [];
    let magnitudeValues: Array<number> = [];
    
    if (spectrum.isValid) {
      // Use the raw FFT data directly for visualization
      const rawFFTData = (spectrum as any).rawSpectrum || [];
      const resolution = spectrum.resolution;
      
      // Create properly scaled frequency bins and FFT magnitude values
      const maxBins = Math.min(rawFFTData.length, Math.floor(parseFloat(req.body.maxFrequency) / resolution) + 1);
      
      for (let i = 0; i < maxBins; i++) {
        const frequency = i * resolution;
        frequencyBins.push(frequency);
        magnitudeValues.push(rawFFTData[i] || 0);
      }
      
      // If no raw data is available, fall back to band peaks
      if (magnitudeValues.every(v => v === 0)) {
        console.log("Warning: Using band peaks for visualization as raw FFT data is not available");
        
        // Use band peaks data
        for (const [band, value] of spectrum.bandPeaks.entries()) {
          const bandStart = parseFloat(band[0].toString());
          const bandEnd = parseFloat(band[1].toString());
          const centerFreq = (bandStart + bandEnd) / 2;
          const index = Math.floor(centerFreq / resolution);
          
          if (index >= 0 && index < maxBins) {
            // Create a new array with the updated value at index
            const newValue = value as number;
            magnitudeValues = [...magnitudeValues.slice(0, index), newValue, ...magnitudeValues.slice(index + 1)];
          }
        }
      }
    }
    
    // Convert Map to object for proper JSON serialization
    const serializedSpectrum = {
      ...spectrum,
      bandPeaks: Object.fromEntries(
        Array.from(spectrum.bandPeaks).map(([key, value]) => [key.toString(), value])
      )
    };

    // If integration is requested
    let serializedIntegratedSpectrum = null;
    let integratedFrequencyBins: number[] = [];
    let integratedMagnitudeValues: number[] = [];
    
    if (req.body.integrate && spectrum.isValid) {
      const integratedSpectrum = spectrumModule.integrateSpectrum(spectrum);
      serializedIntegratedSpectrum = {
        ...integratedSpectrum,
        bandPeaks: Object.fromEntries(
          Array.from(integratedSpectrum.bandPeaks).map(([key, value]) => [key.toString(), value])
        )
      };
      
      // Get visualization data for integrated spectrum
      if (integratedSpectrum.isValid) {
        integratedFrequencyBins = [...frequencyBins];
        
        for (const [band, value] of integratedSpectrum.bandPeaks.entries()) {
          const centerFreq = (parseFloat(band[0].toString()) + parseFloat(band[1].toString())) / 2;
          const index = Math.floor(centerFreq / spectrum.resolution);
          if (index >= 0 && index < integratedFrequencyBins.length) {
            integratedMagnitudeValues[index] = value;
          }
        }
        
        // Fill in any missing values
        for (let i = 0; i < integratedFrequencyBins.length; i++) {
          if (!integratedMagnitudeValues[i]) integratedMagnitudeValues[i] = 0;
        }
      }
    }

    // Return the results
    res.json({
      spectrum: serializedSpectrum,
      integratedSpectrum: serializedIntegratedSpectrum,
      visualizationData: {
        frequencyBins,
        magnitudeValues,
        integratedFrequencyBins,
        integratedMagnitudeValues
      },
      error: spectrum.isValid ? null : spectrum.errorMessage
    });
  } catch (error) {
    res.status(400).json({ 
      error: (error as Error).message 
    });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
}); 