# Fourier Playground

An interactive web application for exploring the 2D Fast Fourier Transform (FFT) and frequency domain image processing. Upload images, visualize their frequency spectra, and manipulate frequencies in real-time to see how changes in the frequency domain affect the reconstructed image.

## Features

### Image Processing
- **Image Upload**: Upload any image file and automatically convert to grayscale
- **Smart Resizing**: Images are automatically cropped/resized to 512×512 pixels (power of 2 for efficient FFT computation)
- **Real-time Processing**: Instant FFT computation and visualization

### Frequency Domain Visualization
- **Interactive Spectrum**: Click and drag on the frequency spectrum to manipulate frequencies
- **Live Preview**: See changes to the reconstructed image in real-time
- **Magnitude Display**: Logarithmic magnitude spectrum visualization for better dynamic range

### Interactive Tools
- **Inspect Tool**: Click on any frequency component to view its properties (magnitude, phase) and see the corresponding 2D basis function
- **Brush Tool**: Enhance specific frequencies by painting on the spectrum
- **Eraser Tool**: Remove or suppress frequencies by erasing them
- **Adjustable Parameters**: Control brush size (1-50px) and strength/opacity (1-5x)

### ⚡ Preset Filters
- **Low-Pass Filter**: Blur images by keeping only low frequencies
- **High-Pass Filter**: Extract edges by keeping only high frequencies
- **Band-Pass Filter**: Isolate specific frequency ranges
- **Notch Filters**: Remove horizontal or vertical stripes (periodic patterns)

### Analysis Tools
- **2D Basis Function Visualization**: See the 2D sinusoidal wave pattern for any selected frequency component
- **3D Topology View**: Interactive 3D surface plot showing the wave's amplitude and phase
- **Frequency Metrics**: Display position, magnitude, and phase information for selected points

## Technical Details

### Core Technologies
- **React 19**: Modern React with hooks for state management
- **fft.js**: Fast Fourier Transform library for efficient 2D FFT computation
- **Plotly.js**: 3D surface visualization for wave topology
- **Chart.js**: Additional charting capabilities

### FFT Implementation
- **2D FFT**: Row-column decomposition for efficient computation
- **FFT Shift**: Automatic quadrant swapping for centered frequency display
- **Complex Number Handling**: Separate real and imaginary component arrays
- **Inverse FFT**: Real-time reconstruction from modified frequency domain

### Image Processing Pipeline
1. **Input**: Image file → Canvas → Grayscale conversion
2. **Forward FFT**: Grayscale array → 2D FFT → Frequency domain (complex)
3. **Visualization**: Complex data → Magnitude spectrum → Canvas display
4. **Masking**: User interactions → Frequency mask → Applied to complex data
5. **Inverse FFT**: Masked complex data → IFFT → Reconstructed image

## Getting Started

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm start
```

The application will open at [http://localhost:3000](http://localhost:3000)

### Build for Production

```bash
npm run build
```

## Usage

1. **Upload an Image**: Click "Choose Image" and select an image file
2. **Explore the Spectrum**: The frequency spectrum appears in the center panel
3. **Interact**:
   - Use **Inspect** to click and view frequency component details
   - Use **Brush** to enhance frequencies (paint with green cursor)
   - Use **Eraser** to remove frequencies (paint with red cursor)
4. **Apply Presets**: Try the preset filters to see common frequency domain operations
5. **Analyze**: Click on frequencies to see 2D and 3D visualizations of the basis functions

## Project Structure

```
src/
├── App.js          # Main application component with FFT logic
├── Wave2D.js       # 2D basis function visualization
├── Wave3D.js       # 3D surface plot visualization
├── dspUtils.js     # FFT computation and image processing utilities
└── App.css         # Styling
```

## Key Concepts

### Frequency Domain
Images can be represented as a sum of sinusoidal waves of different frequencies, orientations, and phases. The FFT converts spatial domain images into this frequency representation.

### Frequency Masking
By multiplying frequency components by a mask (0 to 1), you can:
- **Suppress frequencies** (mask = 0): Remove patterns
- **Enhance frequencies** (mask > 1): Amplify patterns
- **Preserve frequencies** (mask = 1): Keep original

### Basis Functions
Each point in the frequency domain represents a 2D sinusoidal wave pattern. The magnitude determines amplitude, phase determines shift, and position determines frequency and orientation.

## License

This project is open source and available for educational and personal use.
