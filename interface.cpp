#pragma once

#include <vector>
#include <string>
#include <map>
#include <chrono>

// Enum for window types
enum class WindowType 
{
    Hanning,
    Rectangular
};

// Enum for window types
enum class Quantity
{
    Acceleration,
    Velocity,
    Displacement
};

// Struct for time waveform
struct TimeWaveform 
{
    std::vector<double> data;
    double sampleRate;
    Quantity quantity;
};

// Struct for spectrum results
struct SpectrumResult 
{
    double maxFrequency;
    double resolution;
    
    Quantity quantity;
    
    // Maps pair with filter range to calculated value
    std::map<std::pair<int,int>, double> bandPeaks;
};

// Class for Spectrum Calculation Module
class SpectrumCalculationModule 
{
public:
    // Constructor
    SpectrumCalculationModule();

    // Set input parameters
    void setNumberOfLines(int lines);
    void setWindowType(WindowType type);
    void setMinFrequency(double frequency);
    void setMaxFrequency(double frequency);

    // Calculate spectrum
    SpectrumResult calculateSpectrum(const TimeWaveform& waveform);

    // Integration and derivation in frequency domain
    SpectrumResult integrateSpectrum(const SpectrumResult& spectrum);

    // Band calculations
    double calculatePeakInBand(const SpectrumResult& spectrum, double startFreq, double endFreq);

    // Trend analysis <date, peak in band value>
    std::map<std::string, double> getPeakInBandTrend(const std::string& startDate, const std::string& endDate);

    // Machine speed calculation
    double calculateMachineSpeed(const std::string& date, SpectrumResult>& spectralData);

    // Database operations
    void storeSpectrumResult(const std::string& timestamp, const SpectrumResult& result);
    SpectrumResult retrieveSpectrumResult(const std::string& timestamp);
};