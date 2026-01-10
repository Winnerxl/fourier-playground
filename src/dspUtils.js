import FFT from 'fft.js';

// Must be a power of 2 (e.g., 512)
export const COMP_SIZE = 512; 

// Helper: Convert Image Data to Grayscale Array
export function imageToGrayscaleArray(imageData) {
    const { data, width, height } = imageData;
    const gray = new Float32Array(width * height);
    for (let i = 0; i < gray.length; i++) {
        // Simple luminance formula
        gray[i] = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];
    }
    return gray;
}

// Helper: Perform Robust 2D FFT (Complex-to-Complex for both passes)
export function computeFFT2D(realInput, width, height) {
    const fftRow = new FFT(width);
    const fftCol = new FFT(height);
    
    // 1. Prepare Complex Data (Real input, Imaginary zeros)
    // We use a flat array approach for better performance with fft.js
    // Size is width * height
    const intermediateReal = new Float32Array(width * height);
    const intermediateImag = new Float32Array(width * height);
    
    // --- ROW PASS (Horizontal) ---
    const rowInput = new Float32Array(width * 2); // Interleaved Real/Imag
    const rowOutput = new Float32Array(width * 2);
    
    for (let y = 0; y < height; y++) {
        // Fill input for this row
        for(let x = 0; x < width; x++) {
            rowInput[x*2] = realInput[y*width + x]; // Real
            rowInput[x*2+1] = 0;                    // Imag
        }
        
        fftRow.transform(rowOutput, rowInput);
        
        // Save to intermediate buffer
        for(let x = 0; x < width; x++) {
            intermediateReal[y*width + x] = rowOutput[x*2];
            intermediateImag[y*width + x] = rowOutput[x*2+1];
        }
    }
    
    // --- COLUMN PASS (Vertical) ---
    const outputReal = new Float32Array(width * height);
    const outputImag = new Float32Array(width * height);
    
    const colInput = new Float32Array(height * 2);
    const colOutput = new Float32Array(height * 2);

    for (let x = 0; x < width; x++) {
        // Extract column from intermediate result
        for(let y = 0; y < height; y++) {
            colInput[y*2] = intermediateReal[y*width + x];
            colInput[y*2+1] = intermediateImag[y*width + x];
        }
        
        fftCol.transform(colOutput, colInput);
        
        // Save to final output
        for(let y = 0; y < height; y++) {
            outputReal[y*width + x] = colOutput[y*2];
            outputImag[y*width + x] = colOutput[y*2+1];
        }
    }

    return { real: outputReal, imag: outputImag };
}

// Helper: FFT Shift (Swap Quadrants)
export function fftShift(data, width, height) {
    const shiftedReal = new Float32Array(data.real.length);
    const shiftedImag = new Float32Array(data.imag.length);
    const halfW = width / 2;
    const halfH = height / 2;

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const newY = (y + halfH) % height;
            const newX = (x + halfW) % width;
            
            const idx = y * width + x;
            const newIdx = newY * width + newX;
            
            shiftedReal[newIdx] = data.real[idx];
            shiftedImag[newIdx] = data.imag[idx];
        }
    }
    return { real: shiftedReal, imag: shiftedImag };
}

// Helper: Inverse FFT Shift
export function ifftShift(data, width, height) {
    // For even dimensions, Forward Shift == Inverse Shift
    return fftShift(data, width, height); 
}

// Helper: Compute Inverse 2D FFT
export function computeIFFT2D(complexData, width, height) {
    const fftRow = new FFT(width);
    const fftCol = new FFT(height);

    // --- ROW PASS (Inverse) ---
    const intermediateReal = new Float32Array(width * height);
    const intermediateImag = new Float32Array(width * height);
    
    const rowInput = new Float32Array(width * 2);
    const rowOutput = new Float32Array(width * 2);

    for (let y = 0; y < height; y++) {
        for(let x = 0; x < width; x++) {
            rowInput[x*2] = complexData.real[y*width + x];
            rowInput[x*2+1] = complexData.imag[y*width + x];
        }
        
        fftRow.inverseTransform(rowOutput, rowInput);
        
        for(let x = 0; x < width; x++) {
            intermediateReal[y*width + x] = rowOutput[x*2];
            intermediateImag[y*width + x] = rowOutput[x*2+1];
        }
    }

    // --- COLUMN PASS (Inverse) ---
    const outPixels = new Float32Array(width * height);
    
    const colInput = new Float32Array(height * 2);
    const colOutput = new Float32Array(height * 2);

    for (let x = 0; x < width; x++) {
        for(let y = 0; y < height; y++) {
            colInput[y*2] = intermediateReal[y*width + x];
            colInput[y*2+1] = intermediateImag[y*width + x];
        }
        
        fftCol.inverseTransform(colOutput, colInput);
        
        for(let y = 0; y < height; y++) {
            // Calculate Magnitude for final image display
            const r = colOutput[y*2];
            const i = colOutput[y*2+1];
            // Since fft.js inverse is scaled by 1/N, we might need a small adjustment 
            // depending on the library version, but typically magnitude is enough.
            outPixels[y*width + x] = Math.sqrt(r*r + i*i); 
        }
    }
    
    return outPixels;
}

// Helper: Log Magnitude Spectrum
export function getMagnitudeSpectrum(complexData) {
    const mag = new Float32Array(complexData.real.length);
    for(let i=0; i<mag.length; i++) {
        const m = Math.sqrt(complexData.real[i]**2 + complexData.imag[i]**2);
        // Log compression for better visualization: log(1 + magnitude)
        mag[i] = Math.log(m + 1);
    }
    return mag;
}
