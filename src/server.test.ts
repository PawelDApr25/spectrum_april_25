import request from 'supertest';
import express from 'express';
import bodyParser from 'body-parser';
import { SpectrumCalculationModule } from './SpectrumCalculationModule';
import { WindowType, Quantity } from './types';

// Create a test server
const app = express();
app.use(bodyParser.json({ limit: '50mb' }));

const spectrumModule = new SpectrumCalculationModule();

// Add the API endpoint
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
    const waveform = {
      data: waveformData.data,
      sampleRate: parseFloat(waveformData.sampleRate),
      quantity: waveformData.quantity as Quantity
    };

    // Calculate the spectrum
    const spectrum = spectrumModule.calculateSpectrum(waveform);
    
    // Simplified response for testing
    res.json({
      spectrum: {
        isValid: spectrum.isValid,
        resolution: spectrum.resolution,
        quantity: spectrum.quantity,
        errorMessage: spectrum.errorMessage
      }
    });
  } catch (error) {
    res.status(400).json({ 
      error: (error as Error).message 
    });
  }
});

describe('Server API', () => {
  test('should process spectrum data correctly', async () => {
    // Create a simple sine wave
    const sampleRate = 10000;
    const duration = 1;
    const samples = sampleRate * duration;
    const data = new Array(samples);
    
    for (let i = 0; i < samples; i++) {
      const time = i / sampleRate;
      data[i] = Math.sin(2 * Math.PI * 50 * time);
    }
    
    const response = await request(app)
      .post('/api/process')
      .send({
        numberOfLines: 1024,
        windowType: WindowType.Hanning,
        minFrequency: 10,
        maxFrequency: 1000,
        highPassFrequency: 10,
        lowPassFrequency: 1000,
        integrate: false,
        waveformData: {
          data,
          sampleRate,
          quantity: Quantity.Acceleration
        }
      });
    
    expect(response.status).toBe(200);
    expect(response.body.spectrum.isValid).toBe(true);
    expect(response.body.spectrum.quantity).toBe(Quantity.Acceleration);
  });
  
  test('should handle invalid parameters', async () => {
    const response = await request(app)
      .post('/api/process')
      .send({
        numberOfLines: 50, // Below minimum
        windowType: WindowType.Hanning,
        minFrequency: 10,
        maxFrequency: 1000,
        highPassFrequency: 10,
        lowPassFrequency: 1000,
        integrate: false,
        waveformData: {
          data: [0, 0, 0], // Dummy data
          sampleRate: 1000,
          quantity: Quantity.Acceleration
        }
      });
    
    expect(response.status).toBe(400);
    expect(response.body.error).toContain('Number of lines cannot be less than');
  });
}); 