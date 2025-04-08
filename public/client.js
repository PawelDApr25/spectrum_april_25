document.addEventListener('DOMContentLoaded', function() {
    // Get form elements
    const generateBtn = document.getElementById('generateBtn');
    const waveformTypeSelect = document.getElementById('waveformType');
    const sineOptions = document.getElementById('sineOptions');
    const resultOutput = document.getElementById('resultOutput');
    const errorOutput = document.getElementById('errorOutput');
    
    // Chart objects
    let spectrumChart = null;
    let integratedSpectrumChart = null;
    
    // Store the data for export
    let exportableSpectrumData = null;
    let exportableIntegratedData = null;
    
    // Show/hide sine options based on waveform type
    waveformTypeSelect.addEventListener('change', function() {
        if (this.value === 'sine') {
            sineOptions.style.display = 'block';
            document.getElementById('compositeOptions').style.display = 'none';
        } else if (this.value === 'composite') {
            sineOptions.style.display = 'none';
            document.getElementById('compositeOptions').style.display = 'block';
        } else {
            sineOptions.style.display = 'none';
            document.getElementById('compositeOptions').style.display = 'none';
        }
    });
    
    // Generate waveform and calculate spectrum
    generateBtn.addEventListener('click', async function() {
        // Clear previous results and errors
        resultOutput.value = '';
        errorOutput.value = '';
        document.getElementById('frequencyError').textContent = '';
        document.getElementById('amplitudeError').textContent = '';
        
        // Validate band range
        const bandRange = parseFloat(document.getElementById('bandRange').value);
        const maxFrequency = parseFloat(document.getElementById('maxFrequency').value);
        const minFrequency = parseFloat(document.getElementById('minFrequency').value);
        
        if (bandRange < 1 || bandRange > 100) {
            errorOutput.value = 'Band range must be between 1 and 100 Hz';
            return;
        }
        
        if (bandRange > maxFrequency) {
            errorOutput.value = 'Band range cannot be larger than max frequency';
            return;
        }
        
        if (bandRange < (maxFrequency - minFrequency) / 100) {
            errorOutput.value = 'Band range is too small for the given frequency range';
            return;
        }
        
        // Validate frequencies and amplitudes based on waveform type
        if (waveformTypeSelect.value === 'sine') {
            const frequency = parseFloat(document.getElementById('frequency').value);
            const amplitude = parseFloat(document.getElementById('amplitude').value);
            
            if (frequency < 1 || frequency > 10000) {
                document.getElementById('frequencyError').textContent = 'Frequency must be between 1 and 10000 Hz';
                return;
            }
            
            if (amplitude < 0.1 || amplitude > 10) {
                document.getElementById('amplitudeError').textContent = 'Amplitude must be between 0.1 and 10';
                return;
            }
        } else if (waveformTypeSelect.value === 'composite') {
            // Validate composite waveform frequencies and amplitudes
            const freq1 = parseFloat(document.getElementById('freq1').value);
            const freq2 = parseFloat(document.getElementById('freq2').value);
            const freq3 = parseFloat(document.getElementById('freq3').value);
            const amp1 = parseFloat(document.getElementById('amp1').value);
            const amp2 = parseFloat(document.getElementById('amp2').value);
            const amp3 = parseFloat(document.getElementById('amp3').value);
            
            if (freq1 < 1 || freq1 > 10000 || freq2 < 1 || freq2 > 10000 || freq3 < 1 || freq3 > 10000) {
                errorOutput.value = 'All frequencies must be between 1 and 10000 Hz';
                return;
            }
            
            if (amp1 < 0.1 || amp1 > 10 || amp2 < 0.1 || amp2 > 10 || amp3 < 0.1 || amp3 > 10) {
                errorOutput.value = 'All amplitudes must be between 0.1 and 10';
                return;
            }
        }
        
        // Reset export data
        exportableSpectrumData = null;
        exportableIntegratedData = null;
        document.getElementById('exportSpectrumBtn').style.display = 'none';
        document.getElementById('exportIntegratedBtn').style.display = 'none';
        
        // Destroy any existing charts
        if (spectrumChart) {
            spectrumChart.destroy();
            spectrumChart = null;
        }
        if (integratedSpectrumChart) {
            integratedSpectrumChart.destroy();
            integratedSpectrumChart = null;
        }
        
        try {
            // Show loading indicator
            generateBtn.textContent = 'Calculating...';
            generateBtn.disabled = true;
            
            // Get configuration values
            const config = {
                numberOfLines: document.getElementById('numberOfLines').value,
                windowType: document.getElementById('windowType').value,
                minFrequency: document.getElementById('minFrequency').value,
                maxFrequency: document.getElementById('maxFrequency').value,
                bandRange: document.getElementById('bandRange').value,
                highPassFrequency: document.getElementById('highPassFrequency').value,
                lowPassFrequency: document.getElementById('lowPassFrequency').value,
                integrate: document.getElementById('integrate').checked,
                waveformData: generateWaveform()
            };
            
            // Send request to the server
            const response = await fetch('/api/process', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(config)
            });
            
            const data = await response.json();
            
            if (data.error) {
                errorOutput.value = data.error;
            } else {
                // Format and display the results
                let result = 'Spectrum Calculation Results:\n';
                result += '==========================\n\n';
                
                const spectrum = data.spectrum;
                result += `Resolution: ${spectrum.resolution.toFixed(4)} Hz\n`;
                result += `Quantity: ${spectrum.quantity}\n`;
                result += `Valid: ${spectrum.isValid}\n\n`;
                
                result += 'Peak Values in Frequency Bands:\n';
                result += '------------------------------\n';
                
                // Convert Map to object for display (since JSON doesn't preserve Map)
                const bandPeaks = spectrum.bandPeaks;
                if (bandPeaks && Object.keys(bandPeaks).length > 0) {
                    for (const key in bandPeaks) {
                        const [start, end] = key.split(',');
                        result += `${start}-${end} Hz: ${bandPeaks[key].toFixed(6)}\n`;
                    }
                } else {
                    result += 'No band peaks data available\n';
                }
                
                // Display integrated results if available
                if (data.integratedSpectrum) {
                    const intSpectrum = data.integratedSpectrum;
                    result += '\nIntegrated Spectrum Results:\n';
                    result += '==========================\n';
                    result += `Quantity: ${intSpectrum.quantity}\n`;
                    result += `Valid: ${intSpectrum.isValid}\n\n`;
                    
                    if (!intSpectrum.isValid && intSpectrum.errorMessage) {
                        result += `Error: ${intSpectrum.errorMessage}\n`;
                    } else {
                        result += 'Integrated Peak Values:\n';
                        result += '---------------------\n';
                        
                        const intBandPeaks = intSpectrum.bandPeaks;
                        if (intBandPeaks && Object.keys(intBandPeaks).length > 0) {
                            for (const key in intBandPeaks) {
                                const [start, end] = key.split(',');
                                result += `${start}-${end} Hz: ${intBandPeaks[key].toFixed(6)}\n`;
                            }
                        } else {
                            result += 'No integrated band peaks data available\n';
                        }
                    }
                }
                
                resultOutput.value = result;
                
                // Visualize spectrum data
                if (data.visualizationData && spectrum.isValid) {
                    const { frequencyBins, magnitudeValues } = data.visualizationData;
                    renderSpectrumChart(frequencyBins, magnitudeValues, spectrum.quantity);
                    
                    // Visualize integrated spectrum if available
                    if (data.integratedSpectrum && data.integratedSpectrum.isValid) {
                        const { integratedFrequencyBins, integratedMagnitudeValues } = data.visualizationData;
                        renderIntegratedSpectrumChart(integratedFrequencyBins, integratedMagnitudeValues, data.integratedSpectrum.quantity);
                        document.getElementById('integratedChartContainer').style.display = 'block';
                    } else {
                        document.getElementById('integratedChartContainer').style.display = 'none';
                    }
                }
            }
        } catch (error) {
            errorOutput.value = 'Error: ' + error.message;
        } finally {
            // Reset button
            generateBtn.textContent = 'Generate & Calculate';
            generateBtn.disabled = false;
        }
    });
    
    // Function to render spectrum chart
    function renderSpectrumChart(frequencyBins, magnitudeValues, quantity) {
        const ctx = document.getElementById('spectrumChart').getContext('2d');
        
        // Filter out frequencies outside the min/max range
        const minFreq = parseFloat(document.getElementById('minFrequency').value);
        const maxFreq = parseFloat(document.getElementById('maxFrequency').value);
        
        const filteredData = frequencyBins.map((freq, index) => {
            if (freq >= minFreq && freq <= maxFreq) {
                return { x: freq, y: magnitudeValues[index] };
            }
            return null;
        }).filter(point => point !== null);
        
        // Create filtered arrays for Chart.js
        const chartFreqs = filteredData.map(point => point.x);
        const chartMags = filteredData.map(point => point.y);
        
        // Find the maximum magnitude value for scaling
        const maxMagnitude = Math.max(...chartMags, 0.0001); // Prevent zero max
        
        console.log("Chart data points:", chartFreqs.length);
        console.log("Min/Max frequency:", minFreq, maxFreq);
        console.log("Max magnitude:", maxMagnitude);
        
        // Create chart
        spectrumChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: chartFreqs,
                datasets: [{
                    label: `${quantity} Spectrum`,
                    data: chartMags,
                    borderColor: 'rgb(75, 192, 192)',
                    backgroundColor: 'rgba(75, 192, 192, 0.2)',
                    borderWidth: 2,
                    pointRadius: 0,
                    fill: true,
                    tension: 0.1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        type: 'linear',
                        title: {
                            display: true,
                            text: 'Frequency (Hz)'
                        },
                        min: minFreq,
                        max: maxFreq,
                        ticks: {
                            stepSize: calculateTickStep(minFreq, maxFreq)
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: getYAxisTitle(quantity)
                        },
                        beginAtZero: true,
                        suggestedMax: maxMagnitude * 1.1, // Add 10% padding
                        ticks: {
                            callback: function(value) {
                                // Format tick labels for readability
                                if (value === 0) return '0';
                                if (value < 0.001) return value.toExponential(1);
                                return value.toFixed(value < 0.1 ? 4 : 3);
                            }
                        }
                    }
                },
                plugins: {
                    title: {
                        display: true,
                        text: 'Frequency Spectrum'
                    }
                }
            }
        });
        
        // Store the filtered data for export
        exportableSpectrumData = filteredData;
        
        // Make export button visible
        document.getElementById('exportSpectrumBtn').style.display = 'inline-block';
    }
    
    // Function to render integrated spectrum chart
    function renderIntegratedSpectrumChart(frequencyBins, magnitudeValues, quantity) {
        const ctx = document.getElementById('integratedSpectrumChart').getContext('2d');
        
        // Filter out frequencies above the max frequency
        const maxFreq = parseFloat(document.getElementById('maxFrequency').value);
        const filteredData = frequencyBins.map((freq, index) => {
            if (freq <= maxFreq) {
                return { x: freq, y: magnitudeValues[index] };
            }
            return null;
        }).filter(point => point !== null);
        
        // Create filtered arrays for Chart.js
        const chartFreqs = filteredData.map(point => point.x);
        const chartMags = filteredData.map(point => point.y);
        
        // Create chart
        integratedSpectrumChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: chartFreqs,
                datasets: [{
                    label: `${quantity} Spectrum (Integrated)`,
                    data: chartMags,
                    borderColor: 'rgb(153, 102, 255)',
                    backgroundColor: 'rgba(153, 102, 255, 0.2)',
                    borderWidth: 2,
                    pointRadius: 0,
                    fill: true,
                    tension: 0.1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        type: 'linear',
                        title: {
                            display: true,
                            text: 'Frequency (Hz)'
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: getYAxisTitle(quantity)
                        },
                        beginAtZero: true
                    }
                },
                plugins: {
                    title: {
                        display: true,
                        text: 'Integrated Frequency Spectrum'
                    }
                }
            }
        });
        
        // Store the filtered data for export
        exportableIntegratedData = filteredData;
        
        // Make export button visible
        document.getElementById('exportIntegratedBtn').style.display = 'inline-block';
    }
    
    // Helper function to get appropriate Y-axis title
    function getYAxisTitle(quantity) {
        switch(quantity) {
            case 'Acceleration':
                return 'Amplitude (m/s²)';
            case 'Velocity':
                return 'Amplitude (m/s)';
            case 'Displacement':
                return 'Amplitude (m)';
            default:
                return 'Amplitude';
        }
    }
    
    // Generate waveform based on user settings
    function generateWaveform() {
        const sampleRate = parseInt(document.getElementById('sampleRate').value);
        const duration = parseFloat(document.getElementById('duration').value);
        const quantity = document.getElementById('quantity').value;
        const waveformType = document.getElementById('waveformType').value;
        
        const samples = Math.floor(sampleRate * duration);
        const data = new Array(samples);
        
        switch (waveformType) {
            case 'sine':
                const frequency = parseFloat(document.getElementById('frequency').value);
                const amplitude = parseFloat(document.getElementById('amplitude').value);
                
                // Validate frequency and amplitude
                if (frequency < 1 || frequency > 10000) {
                    throw new Error('Frequency must be between 1 and 10000 Hz');
                }
                if (amplitude < 0.1 || amplitude > 10) {
                    throw new Error('Amplitude must be between 0.1 and 10');
                }
                
                for (let i = 0; i < samples; i++) {
                    const time = i / sampleRate;
                    data[i] = amplitude * Math.sin(2 * Math.PI * frequency * time);
                }
                break;
                
            case 'composite':
                const freq1 = parseFloat(document.getElementById('freq1').value);
                const freq2 = parseFloat(document.getElementById('freq2').value);
                const freq3 = parseFloat(document.getElementById('freq3').value);
                const amp1 = parseFloat(document.getElementById('amp1').value);
                const amp2 = parseFloat(document.getElementById('amp2').value);
                const amp3 = parseFloat(document.getElementById('amp3').value);
                
                // Validate frequencies and amplitudes
                if (freq1 < 1 || freq1 > 10000 || freq2 < 1 || freq2 > 10000 || freq3 < 1 || freq3 > 10000) {
                    throw new Error('All frequencies must be between 1 and 10000 Hz');
                }
                if (amp1 < 0.1 || amp1 > 10 || amp2 < 0.1 || amp2 > 10 || amp3 < 0.1 || amp3 > 10) {
                    throw new Error('All amplitudes must be between 0.1 and 10');
                }
                
                for (let i = 0; i < samples; i++) {
                    const time = i / sampleRate;
                    data[i] = amp1 * Math.sin(2 * Math.PI * freq1 * time) + 
                             amp2 * Math.sin(2 * Math.PI * freq2 * time) + 
                             amp3 * Math.sin(2 * Math.PI * freq3 * time);
                }
                break;
                
            case 'random':
                for (let i = 0; i < samples; i++) {
                    data[i] = (Math.random() * 2 - 1);
                }
                break;
        }
        
        return {
            data,
            sampleRate,
            quantity
        };
    }
    
    // Add this function to your client.js file
    function calculateTickStep(min, max) {
        const range = max - min;
        if (range <= 10) return 1;
        if (range <= 50) return 5;
        if (range <= 100) return 10;
        if (range <= 500) return 50;
        if (range <= 1000) return 100;
        if (range <= 5000) return 500;
        return 1000;
    }
    
    // Add this new function to display spectrum data in a new window
    function displaySpectrumData(data, title) {
        try {
            // Limit to first 3000 points
            const limitedData = data.slice(0, 3000);
            
            // Create HTML content for better readability
            let htmlContent = `
                <!DOCTYPE html>
                <html>
                <head>
                    <title>${title}</title>
                    <style>
                        body { font-family: monospace; padding: 20px; }
                        h1 { margin-bottom: 20px; }
                        table { border-collapse: collapse; width: 100%; }
                        th, td { border: 1px solid #ddd; padding: 8px; text-align: right; }
                        th { background-color: #f2f2f2; }
                        tr:nth-child(even) { background-color: #f9f9f9; }
                    </style>
                </head>
                <body>
                    <h1>${title} (First 3000 points)</h1>
                    <table>
                        <tr><th>#</th><th>Frequency (Hz)</th><th>Magnitude</th></tr>`;
            
            // Add rows for each data point
            limitedData.forEach((point, index) => {
                htmlContent += `<tr>
                    <td>${index + 1}</td>
                    <td>${point.x.toFixed(4)}</td>
                    <td>${point.y.toExponential(6)}</td>
                </tr>`;
            });
            
            htmlContent += `</table>
                <p>Showing ${limitedData.length} of ${data.length} total points</p>
                </body>
                </html>`;
            
            // Open in new window
            const newWindow = window.open();
            newWindow.document.write(htmlContent);
            newWindow.document.close();
        } catch (error) {
            console.error("Error displaying data:", error);
            alert("Failed to display data. See console for details.");
        }
    }

    // Update event listeners for the export buttons to use the new function
    document.getElementById('exportSpectrumBtn').addEventListener('click', function() {
        if (exportableSpectrumData) {
            displaySpectrumData(exportableSpectrumData, 'Spectrum Data');
        } else {
            alert('No spectrum data available to display');
        }
    });

    document.getElementById('exportIntegratedBtn').addEventListener('click', function() {
        if (exportableIntegratedData) {
            displaySpectrumData(exportableIntegratedData, 'Integrated Spectrum Data');
        } else {
            alert('No integrated spectrum data available to display');
        }
    });
}); 