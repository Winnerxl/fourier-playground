import React from 'react';
import Plot from 'react-plotly.js';

const Wave3D = ({ selectedPoint }) => {
    if (!selectedPoint) return null;

    const gridSize = 50; // Keep this low (e.g. 50x50) for performance
    const xRange = Array.from({ length: gridSize }, (_, i) => i);
    const yRange = Array.from({ length: gridSize }, (_, i) => i);

    const { x, y, mag, phase } = selectedPoint;
    const SPECTRUM_SIZE = 512;
    const center = SPECTRUM_SIZE / 2;
    const u = (x - center) / SPECTRUM_SIZE;
    const v = (y - center) / SPECTRUM_SIZE;

    // Generate Z data (2D array)
    const zData = yRange.map(py => {
        return xRange.map(px => {
            // Z = Amplitude * cos(...)
            return mag * Math.cos(2 * Math.PI * (u * px + v * py) + phase);
        });
    });

    return (
        <div style={{ width: '100%', height: '100%', minHeight: '200px' }}>
             <Plot
                data={[
                    {
                        z: zData,
                        type: 'surface',
                        colorscale: 'Viridis',
                        showscale: false, // Hide the color bar sidebar to save space
                        contours: {
                            z: { show: true, usecolormap: true, highlightcolor: "#limegreen", project: { z: true } }
                        }
                    }
                ]}
                layout={{
                    autosize: true,
                    margin: { l: 0, r: 0, b: 0, t: 20 }, // Remove whitespace
                    paper_bgcolor: 'rgba(0,0,0,0)',      // Transparent background
                    plot_bgcolor: 'rgba(0,0,0,0)',
                    font: { color: '#a0a0a0', family: 'Inter, sans-serif' }, // Dark mode text
                    scene: {
                        xaxis: { title: '', showgrid: false, zeroline: false, showticklabels: false },
                        yaxis: { title: '', showgrid: false, zeroline: false, showticklabels: false },
                        zaxis: { title: '', showgrid: true, gridcolor: '#444' }, // Subtle grid
                        bgcolor: 'rgba(0,0,0,0)',
                        camera: { eye: { x: 1.2, y: 1.2, z: 1.2 } }
                    },
                    title: {
                        text: '3D Topology',
                        font: { size: 12, color: '#666' },
                        y: 0.98
                    }
                }}
                useResizeHandler={true}
                style={{ width: '100%', height: '100%' }}
                config={{ displayModeBar: false }} // Hides the annoying hover toolbar
            />
        </div>
    );
};

export default Wave3D;