import React, { useRef, useEffect } from 'react';

const Wave2D = ({ selectedPoint, size = 256 }) => {
    const canvasRef = useRef(null);

    useEffect(() => {
        if (!selectedPoint || !canvasRef.current) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        const { x, y, phase } = selectedPoint;
        
        // 1. Prepare image buffer
        const imgData = ctx.createImageData(size, size);
        const data = imgData.data;

        // 2. Calculate Frequency (u, v) normalized
        // Note: We use the spectrum size (512) to normalize the frequency
        const SPECTRUM_SIZE = 512; 
        const center = SPECTRUM_SIZE / 2;
        const u = (x - center) / SPECTRUM_SIZE;
        const v = (y - center) / SPECTRUM_SIZE;

        // 3. Generate Wave Pixels
        for (let py = 0; py < size; py++) {
            for (let px = 0; px < size; px++) {
                // Formula: cos(2 * pi * (ux + vy) + phase)
                // We multiply px, py by a scale factor if we want to "zoom" in
                const waveVal = Math.cos(2 * Math.PI * (u * px + v * py) + phase);
                
                // Normalize (-1 to 1) -> (0 to 255)
                const color = Math.floor(((waveVal + 1) / 2) * 255);

                const idx = (py * size + px) * 4;
                data[idx] = color;     // R
                data[idx + 1] = color; // G
                data[idx + 2] = color; // B
                data[idx + 3] = 255;   // Alpha
            }
        }

        ctx.putImageData(imgData, 0, 0);
    }, [selectedPoint, size]);

    return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%' }}>
        <h4 style={{ margin: '0 0 5px 0', fontSize: '12px', color: '#666' }}>2D Basis Function</h4>
        <canvas 
            ref={canvasRef} 
            width={size} 
            height={size} 
            style={{ 
                borderRadius: '4px', 
                boxShadow: '0 4px 10px rgba(0,0,0,0.3)',
                maxWidth: '100%',
                height: 'auto'
            }} 
        />
    </div>
    );
};

export default Wave2D;