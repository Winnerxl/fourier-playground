import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
    imageToGrayscaleArray, computeFFT2D, fftShift, ifftShift, 
    computeIFFT2D, getMagnitudeSpectrum, COMP_SIZE 
} from './dspUtils';
import './App.css';
import Wave2D from './Wave2D';
import Wave3D from './Wave3D';

function App() {
    // --- State ---
    const [originalImg, setOriginalImg] = useState(null); // ImageData
    const [fftData, setFftData] = useState(null); // {real, imag}
    const [mask, setMask] = useState(null); // Float32Array
    
    const [tool, setTool] = useState('point'); // point, brush, eraser
    const [brushSize, setBrushSize] = useState(10);
    const [brushStrength, setBrushStrength] = useState(2.0);
    
    const [selectedPoint, setSelectedPoint] = useState(null);
    const [hoverPos, setHoverPos] = useState({ x: 0, y: 0 }); // Added for Hover Display
    const [stats, setStats] = useState({ active: 0, max: 0 });

    // Refs for Canvas access
    const baseSpectrumRef = useRef(null);
    const spectrumRef = useRef(null);
    const resultRef = useRef(null);
    const lastPosRef = useRef(null);
    
    // --- Handlers ---

    const handleImageUpload = (e) => {
        const file = e.target.files[0];
        if(!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = COMP_SIZE;
                canvas.height = COMP_SIZE;
                const ctx = canvas.getContext('2d');
                
                // Smart Crop / Resize Logic
                const side = Math.min(img.width, img.height);
                const sx = (img.width - side) / 2;
                const sy = (img.height - side) / 2;
                
                if (side >= COMP_SIZE) {
                    const cx = img.width / 2;
                    const cy = img.height / 2;
                    ctx.drawImage(img, 
                        cx - COMP_SIZE/2, cy - COMP_SIZE/2, COMP_SIZE, COMP_SIZE, 
                        0, 0, COMP_SIZE, COMP_SIZE
                    );
                } else {
                    ctx.drawImage(img, sx, sy, side, side, 0, 0, COMP_SIZE, COMP_SIZE);
                }
                
                const imageData = ctx.getImageData(0, 0, COMP_SIZE, COMP_SIZE);
                
                // Process
                const grayArray = imageToGrayscaleArray(imageData);
                const fftRaw = computeFFT2D(grayArray, COMP_SIZE, COMP_SIZE);
                const fftShifted = fftShift(fftRaw, COMP_SIZE, COMP_SIZE);
                
                // Init State
                setOriginalImg(canvas.toDataURL());
                setFftData(fftShifted);
                setMask(new Float32Array(COMP_SIZE * COMP_SIZE).fill(1.0));
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    };

    const drawSpectrumVisuals = useCallback(() => {
        const canvas = spectrumRef.current;
        if (!canvas || !baseSpectrumRef.current) return;

        const ctx = canvas.getContext('2d');
        
        // 1. Restore the clean spectrum (wipes previous cursor)
        ctx.putImageData(baseSpectrumRef.current, 0, 0);

        // 2. Draw Live Cursor (if tool is active and we have a position)
        if ((tool === 'brush' || tool === 'eraser') && hoverPos) {
            const { x, y } = hoverPos;
            
            ctx.beginPath();
            ctx.arc(x, y, brushSize, 0, 2 * Math.PI);
            ctx.lineWidth = 2;
            // Green for Brush, Red/Pink for Eraser
            ctx.strokeStyle = tool === 'brush' ? 'rgba(0, 255, 0, 0.9)' : 'rgba(255, 0, 85, 0.9)';
            ctx.stroke();
            
            // Optional: Subtle fill to help visualize the area
            ctx.fillStyle = tool === 'brush' ? 'rgba(0, 255, 0, 0.1)' : 'rgba(255, 0, 85, 0.1)';
            ctx.fill();
        }
    }, [hoverPos, tool, brushSize]);

    // --- Main Logic ---

    // Wrapped in useCallback to satisfy ESLint dependency warning
    const reconstructImage = useCallback(() => {
        if(!fftData || !mask) return;

        // 1. Apply Mask to Complex Data
        const maskedReal = new Float32Array(fftData.real.length);
        const maskedImag = new Float32Array(fftData.imag.length);

        for(let i=0; i<maskedReal.length; i++) {
            maskedReal[i] = fftData.real[i] * mask[i];
            maskedImag[i] = fftData.imag[i] * mask[i];
        }

        // 2. IFFT Shift (Unshift)
        const unshifted = ifftShift({real: maskedReal, imag: maskedImag}, COMP_SIZE, COMP_SIZE);

        // 3. Inverse FFT
        const resultPixels = computeIFFT2D(unshifted, COMP_SIZE, COMP_SIZE);

        // 4. Draw to Result Canvas
        const canvas = resultRef.current;
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        const imgData = ctx.createImageData(COMP_SIZE, COMP_SIZE);

        // Normalize Result
        let max = 0;
        for(let p of resultPixels) if(p > max) max = p;

        for(let i=0; i<resultPixels.length; i++) {
            const val = (resultPixels[i] / max) * 255;
            imgData.data[i*4] = val;
            imgData.data[i*4+1] = val;
            imgData.data[i*4+2] = val;
            imgData.data[i*4+3] = 255;
        }
        ctx.putImageData(imgData, 0, 0);
    }, [fftData, mask]);

    // Effect 1: Cursor Animation (Runs on every mouse move)
    useEffect(() => {
        drawSpectrumVisuals();
    }, [drawSpectrumVisuals]);

    // Effect 2: Main Computation (Runs only when Image/Mask changes)
    useEffect(() => {
        if(!fftData || !mask || !spectrumRef.current) return;

        const magnitude = getMagnitudeSpectrum(fftData);
        const ctx = spectrumRef.current.getContext('2d');
        const imgData = ctx.createImageData(COMP_SIZE, COMP_SIZE);

        // --- Math Loop ---
        let maxVal = 0; 
        let minVal = Infinity;
        for(let i=0; i<magnitude.length; i++) {
            const val = magnitude[i] * mask[i]; 
            if(val > maxVal) maxVal = val;
            if(val < minVal) minVal = val;
        }

        for (let i = 0; i < magnitude.length; i++) {
            let val = magnitude[i] * mask[i];
            const norm = ((val - minVal) / (maxVal - minVal)) * 255;
            
            imgData.data[i*4] = norm;     
            imgData.data[i*4+1] = norm;   
            imgData.data[i*4+2] = norm;   
            imgData.data[i*4+3] = 255;    
        }
        
        // Store the clean image in Ref (Cache it!)
        baseSpectrumRef.current = imgData;
        
        // Draw it immediately
        drawSpectrumVisuals();

        // Stats & Reconstruction
        const activeCount = mask.filter(x => x > 0.1).length;
        setStats({
            active: ((activeCount / mask.length) * 100).toFixed(1),
            max: maxVal.toFixed(2)
        });

        reconstructImage();

    }, [fftData, mask, reconstructImage, drawSpectrumVisuals]);

    // --- Interaction ---

    const handleCanvasInteraction = (e) => {
        if(!mask) return;

        // 1. Handle Mouse Up/Leave (Reset the line)
        if (e.type === 'mouseup' || e.type === 'mouseleave') {
            lastPosRef.current = null;
            setHoverPos(null);
            return;
        }

        const canvas = spectrumRef.current;
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;

        const rawX = (e.clientX - rect.left) * scaleX;
        const rawY = (e.clientY - rect.top) * scaleY;
        const x = Math.floor(rawX);
        const y = Math.floor(rawY);

        // Update Hover (Visual cursor)
        if (x >= 0 && x < COMP_SIZE && y >= 0 && y < COMP_SIZE) {
            setHoverPos({ x, y });
        }

        // 2. Button Check
        if (e.buttons !== 1) {
            lastPosRef.current = null; // Reset if not holding click
            return;
        }

        // 3. Define the Brush Helper
        // This updates the mask at a SINGLE point (cx, cy)
        const applyBrushToPoint = (cx, cy, targetMask) => {
            const r = brushSize;
            let modified = false;
            for(let dy = -r; dy <= r; dy++) {
                for(let dx = -r; dx <= r; dx++) {
                    if(dx*dx + dy*dy <= r*r) {
                        const nx = Math.floor(cx + dx);
                        const ny = Math.floor(cy + dy);
                        if(nx >=0 && nx < COMP_SIZE && ny >= 0 && ny < COMP_SIZE) {
                            const idx = ny * COMP_SIZE + nx;
                            const val = tool === 'brush' ? brushStrength : 0.0;
                            // Only update if value is different to save processing
                            if (targetMask[idx] !== val) {
                                targetMask[idx] = val;
                                modified = true;
                            }
                        }
                    }
                }
            }
            return modified;
        };

        // 4. Main Drawing Logic (With Interpolation)
        if (tool !== 'point') {
            const newMask = new Float32Array(mask); // Clone current mask
            let hasChanges = false;

            // If we have a previous position, draw a line from there to here
            if (lastPosRef.current) {
                const x0 = lastPosRef.current.x;
                const y0 = lastPosRef.current.y;
                const dist = Math.hypot(x - x0, y - y0);
                const steps = Math.ceil(dist); // 1 step per pixel

                for (let i = 0; i <= steps; i++) {
                    const t = steps === 0 ? 0 : i / steps;
                    const lerpX = x0 + (x - x0) * t;
                    const lerpY = y0 + (y - y0) * t;
                    
                    if (applyBrushToPoint(lerpX, lerpY, newMask)) {
                        hasChanges = true;
                    }
                }
            } else {
                // First click (no previous pos), just draw the dot
                if (applyBrushToPoint(x, y, newMask)) {
                    hasChanges = true;
                }
            }

            // Update Last Position
            lastPosRef.current = { x, y };

            // 5. Commit State
            // NOTE: If this is still too slow, we can throttle this part
            if (hasChanges) setMask(newMask);
        } else {
            // Point Tool logic (Inspect) remains simple
             if(e.type === 'mousedown') {
                const idx = y * COMP_SIZE + x;
                const mag = Math.sqrt(fftData.real[idx]**2 + fftData.imag[idx]**2);
                const phase = Math.atan2(fftData.imag[idx], fftData.real[idx]);
                setSelectedPoint({ x, y, mag, phase });
            }
        }
    };

    const resetMask = () => {
        if(mask) setMask(new Float32Array(COMP_SIZE * COMP_SIZE).fill(1.0));
    };

    // --- Preset Filters ---
    const applyLowPass = (radius = 100) => {
        if(!mask) return;
        const newMask = new Float32Array(COMP_SIZE * COMP_SIZE);
        const center = COMP_SIZE / 2;
        
        for(let y = 0; y < COMP_SIZE; y++) {
            for(let x = 0; x < COMP_SIZE; x++) {
                const dx = x - center;
                const dy = y - center;
                const dist = Math.sqrt(dx*dx + dy*dy);
                const idx = y * COMP_SIZE + x;
                // Smooth falloff using Gaussian-like curve
                const diff = (dist - radius) / 20;
                newMask[idx] = dist <= radius ? 1.0 : Math.exp(-(diff * diff));
            }
        }
        setMask(newMask);
    };

    const applyHighPass = (radius = 50) => {
        if(!mask) return;
        const newMask = new Float32Array(COMP_SIZE * COMP_SIZE);
        const center = COMP_SIZE / 2;
        
        for(let y = 0; y < COMP_SIZE; y++) {
            for(let x = 0; x < COMP_SIZE; x++) {
                const dx = x - center;
                const dy = y - center;
                const dist = Math.sqrt(dx*dx + dy*dy);
                const idx = y * COMP_SIZE + x;
                // Inverse of low-pass with smooth transition
                const diff = (radius - dist) / 20;
                newMask[idx] = dist >= radius ? 1.0 : Math.exp(-(diff * diff));
            }
        }
        setMask(newMask);
    };

    const applyBandPass = (innerRadius = 50, outerRadius = 150) => {
        if(!mask) return;
        const newMask = new Float32Array(COMP_SIZE * COMP_SIZE);
        const center = COMP_SIZE / 2;
        
        for(let y = 0; y < COMP_SIZE; y++) {
            for(let x = 0; x < COMP_SIZE; x++) {
                const dx = x - center;
                const dy = y - center;
                const dist = Math.sqrt(dx*dx + dy*dy);
                const idx = y * COMP_SIZE + x;
                
                if(dist >= innerRadius && dist <= outerRadius) {
                    newMask[idx] = 1.0;
                } else if(dist < innerRadius) {
                    const diff = (innerRadius - dist) / 15;
                    newMask[idx] = Math.exp(-(diff * diff));
                } else {
                    const diff = (dist - outerRadius) / 15;
                    newMask[idx] = Math.exp(-(diff * diff));
                }
            }
        }
        setMask(newMask);
    };

    const applyNotch = (x1, y1, x2, y2, radius = 15) => {
        if(!mask) return;
        const newMask = new Float32Array(mask); // Start with current mask
        
        // Remove frequencies at two symmetric points
        for(let y = 0; y < COMP_SIZE; y++) {
            for(let x = 0; x < COMP_SIZE; x++) {
                const idx = y * COMP_SIZE + x;
                
                // Distance to first point
                const d1 = Math.sqrt((x - x1) * (x - x1) + (y - y1) * (y - y1));
                // Distance to symmetric point
                const d2 = Math.sqrt((x - x2) * (x - x2) + (y - y2) * (y - y2));
                
                if(d1 <= radius || d2 <= radius) {
                    newMask[idx] = 0.0;
                } else if(d1 <= radius + 10) {
                    const diff = (radius + 10 - d1) / 5;
                    newMask[idx] *= Math.exp(-(diff * diff));
                } else if(d2 <= radius + 10) {
                    const diff = (radius + 10 - d2) / 5;
                    newMask[idx] *= Math.exp(-(diff * diff));
                }
            }
        }
        setMask(newMask);
    };

    const applyVerticalStripes = () => {
        // Remove horizontal frequencies (vertical stripes in image)
        const center = COMP_SIZE / 2;
        applyNotch(center, center - 30, center, center + 30, 20);
    };

    const applyHorizontalStripes = () => {
        // Remove vertical frequencies (horizontal stripes in image)
        const center = COMP_SIZE / 2;
        applyNotch(center - 30, center, center + 30, center, 20);
    };

    return (
        <div className="App">
            <header>
                <div className="header-content">
                    <h1>Fourier Playground</h1>
                    <p className="header-subtitle">Interactive 2D FFT exploration and frequency domain image processing</p>
                </div>
            </header>

            <div className="main-layout">
                {/* 1. SLIMMER SIDEBAR (Controls Only) */}
                <div className="sidebar">
                    <div className="card control-group">
                        <h3>📁 Input</h3>
                        <label className="file-upload-btn">
                            Choose Image
                            <input type="file" accept="image/*" onChange={handleImageUpload} />
                        </label>
                    </div>

                    <div className="card control-group">
                        <h3>🛠 Tools</h3>
                        <div className="btn-group">
                            <button 
                                className={tool==='point'?'active':''} 
                                onClick={()=>setTool('point')} 
                                title="Inspect Spectrum"
                            >🔍 Inspect</button>
                            <button 
                                className={tool==='brush'?'active':''} 
                                onClick={()=>setTool('brush')}
                                title="Enhance Frequencies"
                            >🖌️ Brush</button>
                            <button 
                                className={tool==='eraser'?'active':''} 
                                onClick={()=>setTool('eraser')}
                                title="Remove Frequencies"
                            >🧼 Eraser</button>
                        </div>
                        
                        {tool !== 'point' && (
                            <div className="slider-group">
                                
                                {/* Slider 1: Size */}
                                <div className="slider-item">
                                    <div className="slider-header">
                                        <span>Brush Size</span>
                                        <strong>{brushSize}px</strong>
                                    </div>
                                    <input 
                                        type="range" 
                                        min="1" 
                                        max="50" 
                                        value={brushSize} 
                                        onChange={(e) => setBrushSize(parseInt(e.target.value))} 
                                    />
                                </div>
                                
                                {/* Slider 2: Strength */}
                                <div className="slider-item">
                                    <div className="slider-header">
                                        <span>Opacity/Strength</span>
                                        <strong>{brushStrength}x</strong>
                                    </div>
                                    <input 
                                        type="range" 
                                        min="1" 
                                        max="5" 
                                        step="0.1" 
                                        value={brushStrength} 
                                        onChange={(e) => setBrushStrength(parseFloat(e.target.value))} 
                                    />
                                </div>

                            </div>
                        )}
                        <button className="danger-btn" onClick={resetMask}>Reset Mask</button>
                    </div>

                    <div className="card control-group">
                        <h3>⚡ Preset Filters</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <button 
                                className="preset-btn"
                                onClick={() => applyLowPass(100)}
                                title="Keep low frequencies (blur image)"
                                disabled={!fftData}
                            >
                                🔵 Low-Pass (Blur)
                            </button>
                            <button 
                                className="preset-btn"
                                onClick={() => applyHighPass(50)}
                                title="Keep high frequencies (edges)"
                                disabled={!fftData}
                            >
                                🔴 High-Pass (Edges)
                            </button>
                            <button 
                                className="preset-btn"
                                onClick={() => applyBandPass(50, 150)}
                                title="Keep middle frequencies"
                                disabled={!fftData}
                            >
                                🟡 Band-Pass
                            </button>
                            <button 
                                className="preset-btn"
                                onClick={applyVerticalStripes}
                                title="Remove horizontal lines"
                                disabled={!fftData}
                            >
                                ║ Remove V-Lines
                            </button>
                            <button 
                                className="preset-btn"
                                onClick={applyHorizontalStripes}
                                title="Remove vertical lines"
                                disabled={!fftData}
                            >
                                ═ Remove H-Lines
                            </button>
                        </div>
                    </div>
                </div>

                {/* 2. MAIN WORKSPACE (Flex Column) */}
                <div className="workspace">
                    
                    {/* Top Row: The Images */}
                    <div className="image-stage">
                        <div className="panel">
                            <h4>Original</h4>
                            <div className="canvas-container">
                                {originalImg ? <img src={originalImg} alt="Original" /> : <div className="placeholder">No Image</div>}
                            </div>
                        </div>

                        <div className="panel">
                            <h4>Spectrum <span className="highlight">(Interactive)</span></h4>
                            <div className="canvas-container">
                                <canvas 
                                    ref={spectrumRef} 
                                    width={COMP_SIZE} 
                                    height={COMP_SIZE}
                                    onMouseDown={handleCanvasInteraction}
                                    onMouseMove={handleCanvasInteraction}
                                    onMouseUp={handleCanvasInteraction}
                                    onMouseLeave={handleCanvasInteraction}
                                    style={{ cursor: tool === 'point' ? 'crosshair' : 'none' }}
                                />
                            </div>
                            {/* Updated Stats Bar with Coordinates */}
                            <div className="stats-bar" style={{display: 'flex', justifyContent: 'space-between', width: '100%', marginTop:'5px'}}>
                                <small style={{color: '#4ec9b0'}}>
                                    {hoverPos ? `Pos: (${hoverPos.x}, ${hoverPos.y})` : 'Pos: (-, -)'}
                                    </small>
                                <small>Active: {stats.active}%</small>
                            </div>
                        </div>

                        <div className="panel">
                            <h4>Reconstructed</h4>
                            <div className="canvas-container">
                                <canvas ref={resultRef} width={COMP_SIZE} height={COMP_SIZE} />
                            </div>
                        </div>
                    </div>

                    {/* 3. BOTTOM PANEL: Analysis (Only shows when point selected) */}
                    {selectedPoint && (
                        <div className="analysis-dock">
                            <div className="dock-header">
                                <h3>📊 Frequency Analysis</h3>
                                <button className="close-btn" onClick={() => setSelectedPoint(null)}>×</button>
                            </div>
                            <div className="dock-content">
                                {/* Col 1: Metrics */}
                                <div className="dock-info">
                                    <div className="metric">
                                        <label>POS (X,Y)</label>
                                        <span>{selectedPoint.x}, {selectedPoint.y}</span>
                                    </div>
                                    <div className="metric">
                                        <label>MAGNITUDE</label>
                                        <span style={{color: '#4ec9b0'}}>{selectedPoint.mag.toFixed(1)}</span>
                                    </div>
                                    <div className="metric">
                                        <label>PHASE (RAD)</label>
                                        <span style={{color: '#ce9178'}}>{selectedPoint.phase.toFixed(3)}</span>
                                    </div>
                                </div>
                                
                                {/* Col 2: 2D */}
                                <div className="dock-viz">
                                    <Wave2D selectedPoint={selectedPoint} size={160} />
                                </div>
                                
                                {/* Col 3: 3D */}
                                <div className="dock-viz">
                                    <Wave3D selectedPoint={selectedPoint} />
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default App;
