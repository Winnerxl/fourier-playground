import streamlit as st
import numpy as np
import matplotlib.pyplot as plt
from mpl_toolkits.mplot3d import Axes3D
from PIL import Image
import io
import base64
from streamlit_drawable_canvas import st_canvas

# Sayfa yapılandırması
st.set_page_config(
    page_title="Fourier Spektrum İşleyici",
    page_icon="🎨",
    layout="wide"
)

# CSS ile stil
st.markdown("""
    <style>
    .main {
        padding: 0rem 1rem;
    }
    </style>
    """, unsafe_allow_html=True)

# Başlık
st.title("🎨 Fourier Spektrum Görüntü İşleyici")
st.markdown("---")

# Session state'i başlat
if 'original_image' not in st.session_state:
    st.session_state.original_image = None
    st.session_state.fft_shift = None
    st.session_state.modified_fft = None
    st.session_state.mask = None
    st.session_state.selected_point = None
    st.session_state.spectrum_image = None
    st.session_state.canvas_key = 0  # Canvas'ı sıfırlamak için

def make_square(img):
    """Resmi kare yapar"""
    width, height = img.size
    size = min(width, height)
    left = (width - size) // 2
    top = (height - size) // 2
    return img.crop((left, top, left + size, top + size))

def compute_fft(image_array):
    """Fourier dönüşümü hesaplar"""
    fft = np.fft.fft2(image_array)
    fft_shift = np.fft.fftshift(fft)
    return fft_shift

def get_magnitude_spectrum(fft_shift):
    """Magnitude spektrumunu hesaplar (log scale)"""
    magnitude = np.abs(fft_shift)
    magnitude_spectrum = np.log(magnitude + 1)
    return magnitude_spectrum

def apply_mask_and_reconstruct(fft_shift, mask):
    """Maskeyi uygular ve ters dönüşüm yapar"""
    masked_fft = fft_shift * mask
    fft_ishift = np.fft.ifftshift(masked_fft)
    img_back = np.fft.ifft2(fft_ishift)
    img_back = np.abs(img_back)
    return img_back, masked_fft

def spectrum_to_image(magnitude_spectrum):
    """Spektrumu PIL Image'e çevirir ve kaydet"""
    # Normalize et
    normalized = (magnitude_spectrum - magnitude_spectrum.min()) / \
                 (magnitude_spectrum.max() - magnitude_spectrum.min())
    normalized = (normalized * 255).astype(np.uint8)

    normalized = np.ascontiguousarray(normalized)
    
    # PIL Image oluştur
    img = Image.fromarray(normalized).convert('RGB')
    
    # Resize et (canvas boyutuna)
    img = img.resize((400, 400), Image.Resampling.LANCZOS)
    
    return img

def create_fourier_wave_plot_2d(fourier_value, x, y, fft_shift):
    """Seçilen noktanın 2D Fourier dalgasını 2D grayscale olarak gösterir"""
    magnitude = np.abs(fourier_value)
    phase = np.angle(fourier_value)
    
    # Frekans bileşenleri
    size = fft_shift.shape[0]
    center = size // 2
    
    # u ve v frekans değerleri (normalize edilmiş)
    u = (x - center) / size
    v = (y - center) / size
    
    # 2D uzaysal grid oluştur
    grid_size = 500
    X = np.linspace(0, 1000, grid_size)
    Y = np.linspace(0, 1000, grid_size)
    X, Y = np.meshgrid(X, Y)
    
    # 2D Fourier dalga fonksiyonu: Z = A * cos(2π(ux + vy) + φ)
    Z = magnitude * np.cos(2 * np.pi * (u * X + v * Y) + phase)
    
    # Figure oluştur
    fig, ax = plt.subplots(figsize=(10, 10))
    
    # Grayscale imshow
    im = ax.imshow(Z, cmap='gray', extent=[0, 1000, 0, 1000], origin='lower')
    
    # Etiketler ve başlık
    ax.set_xlabel('X (piksel)', fontsize=12)
    ax.set_ylabel('Y (piksel)', fontsize=12)
    ax.set_title(f'2D Fourier Dalga Bileşeni - Nokta ({x}, {y})\n' + 
                 f'Frekans: u={u:.4f}, v={v:.4f}, Büyüklük={magnitude:.2f}, Faz={phase:.2f}',
                 fontsize=13, fontweight='bold', pad=15)
    
    # Colorbar
    cbar = plt.colorbar(im, ax=ax, fraction=0.046, pad=0.04)
    cbar.set_label('Genlik', rotation=270, labelpad=20, fontsize=11)
    
    # Grid
    ax.grid(True, alpha=0.3, color='red', linewidth=0.5)
    
    plt.tight_layout()
    return fig

def create_fourier_wave_plot_3d(fourier_value, x, y, fft_shift):
    """Seçilen noktanın 2D Fourier dalgasını 3D olarak gösterir"""
    magnitude = np.abs(fourier_value)
    phase = np.angle(fourier_value)
    
    # Frekans bileşenleri
    size = fft_shift.shape[0]
    center = size // 2
    
    # u ve v frekans değerleri (normalize edilmiş)
    u = (x - center) / size
    v = (y - center) / size
    
    # 2D uzaysal grid oluştur
    grid_size = 100
    X = np.linspace(0, 1000, grid_size)
    Y = np.linspace(0, 1000, grid_size)
    X, Y = np.meshgrid(X, Y)
    
    # 2D Fourier dalga fonksiyonu: Z = A * cos(2π(ux + vy) + φ)
    Z = magnitude * np.cos(2 * np.pi * (u * X + v * Y) + phase)
    
    # 3D plot oluştur
    fig = plt.figure(figsize=(12, 9))
    ax = fig.add_subplot(111, projection='3d')
    
    # Surface plot
    surf = ax.plot_surface(X, Y, Z, cmap='viridis', 
                          linewidth=0, antialiased=True, alpha=0.9)
    
    # Etiketler ve başlık
    ax.set_xlabel('X (piksel)', fontsize=10)
    ax.set_ylabel('Y (piksel)', fontsize=10)
    ax.set_zlabel('Genlik', fontsize=10)
    ax.set_title(f'2D Fourier Dalga Bileşeni - Nokta ({x}, {y})\n' + 
                 f'Frekans: u={u:.4f}, v={v:.4f}, Büyüklük={magnitude:.2f}, Faz={phase:.2f}',
                 fontsize=12, fontweight='bold', pad=20)
    
    # Colorbar
    fig.colorbar(surf, ax=ax, shrink=0.5, aspect=5)
    
    # Görünüm açısı
    ax.view_init(elev=30, azim=45)
    
    # Grid
    ax.grid(True, alpha=0.3)
    
    plt.tight_layout()
    return fig

# Sidebar - Kontroller
with st.sidebar:
    st.header("⚙️ Kontroller")
    
    # Resim yükleme
    uploaded_file = st.file_uploader(
        "Resim Yükle",
        type=['png', 'jpg', 'jpeg', 'bmp'],
        help="Bir resim yükleyin. Otomatik olarak kare yapılacaktır."
    )
    
    if uploaded_file is not None:
        # Resmi işle
        img = Image.open(uploaded_file).convert('L')
        img = make_square(img)
        
        # İlk yüklemede veya yeni resim yüklendiyse
        if st.session_state.original_image is None or \
           not np.array_equal(np.array(img), st.session_state.original_image):
            st.session_state.original_image = np.array(img, dtype=float)
            st.session_state.fft_shift = compute_fft(st.session_state.original_image)
            st.session_state.modified_fft = st.session_state.fft_shift.copy()
            st.session_state.mask = np.ones_like(st.session_state.fft_shift, dtype=float)
            
            # Spektrum görüntüsünü oluştur
            magnitude_spectrum = get_magnitude_spectrum(st.session_state.fft_shift)
            st.session_state.spectrum_image = spectrum_to_image(magnitude_spectrum)
        
        st.success("✅ Resim yüklendi!")
        
        st.markdown("---")
        st.subheader("🎨 Çizim Modu")
        
        drawing_mode = st.radio(
            "Mod Seç",
            ["Nokta Seç (Bilgi Göster)", "Fırça (Güçlendir)", "Silgi (Sıfırla)"],
            help="Spektrum üzerinde işlem yapmak için bir mod seçin"
        )
        
        if drawing_mode != "Nokta Seç (Bilgi Göster)":
            stroke_width = st.slider(
                "Fırça/Silgi Kalınlığı",
                min_value=1,
                max_value=30,
                value=10,
                help="Çizim kalınlığı"
            )
            
            if drawing_mode == "Fırça (Güçlendir)":
                brush_strength = st.slider(
                    "Fırça Gücü",
                    min_value=1.1,
                    max_value=5.0,
                    value=2.0,
                    step=0.1,
                    help="Fırça ne kadar güçlendirsin?"
                )
        else:
            stroke_width = 0
        
        st.markdown("---")
        st.subheader("📊 Grafik Tipi")
        
        plot_type = st.radio(
            "Fourier dalga grafiği türü seçin:",
            ["2D (Grayscale)", "3D (Yüzey)"],
            help="2D: Genlik beyaz-siyah tonlarla gösterilir\n3D: Genlik yükseklik olarak gösterilir"
        )
        
        st.markdown("---")
        
        if st.button("🔄 Spektrumu Sıfırla", use_container_width=True):
            st.session_state.mask = np.ones_like(st.session_state.fft_shift, dtype=float)
            st.session_state.modified_fft = st.session_state.fft_shift.copy()
            st.session_state.selected_point = None
            magnitude_spectrum = get_magnitude_spectrum(st.session_state.fft_shift)
            st.session_state.spectrum_image = spectrum_to_image(magnitude_spectrum)
            st.session_state.canvas_key += 1  # Canvas'ı sıfırlamak için key'i değiştir
            st.rerun()
        
        st.markdown("---")
        st.markdown("""
        ### 💡 Nasıl Kullanılır?
        
        **Nokta Seç Modu:**
        - Spektrum üzerine tıklayın
        - Fourier bilgilerini görün
        - Dalga grafiğini inceleyin
        
        **Fırça Modu:**
        - Spektrum üzerinde çizin
        - Frekansları güçlendirin
        
        **Silgi Modu:**
        - Spektrum üzerinde çizin
        - Frekansları sıfırlayın
        """)
    else:
        plot_type = "2D (Grayscale)"  # Default değer

# Ana içerik
if st.session_state.original_image is not None:
    
    # Üç sütun oluştur
    col1, col2, col3 = st.columns(3)
    
    with col1:
        st.subheader("📷 Orijinal Resim")
        fig1, ax1 = plt.subplots(figsize=(5, 5))
        ax1.imshow(st.session_state.original_image, cmap='gray')
        ax1.axis('off')
        st.pyplot(fig1)
        plt.close()
    
    with col2:
        st.subheader("🌈 Fourier Spektrumu (Tıklanabilir)")
        
        # Canvas için mod belirleme
        if drawing_mode == "Nokta Seç (Bilgi Göster)":
            canvas_drawing_mode = "point"
            stroke_color = "#00FFFF"  # Cyan
        elif drawing_mode == "Fırça (Güçlendir)":
            canvas_drawing_mode = "freedraw"
            stroke_color = "#00FF00"  # Yeşil
        else:  # Silgi
            canvas_drawing_mode = "freedraw"
            stroke_color = "#FF0000"  # Kırmızı
        
        current_magnitude = get_magnitude_spectrum(st.session_state.modified_fft)
        fresh_spectrum_image = spectrum_to_image(current_magnitude)

        # Drawable canvas
        canvas_result = st_canvas(
            fill_color="rgba(0, 0, 0, 0)",
            stroke_width=stroke_width,
            stroke_color=stroke_color,
            background_image=fresh_spectrum_image, # BURASI DEĞİŞTİ
            update_streamlit=True,
            height=400,
            width=400,
            drawing_mode=canvas_drawing_mode,
            point_display_radius=3 if canvas_drawing_mode == "point" else 0,
            key=f"canvas_{st.session_state.canvas_key}", 
        )
        
        # Canvas'tan veri al
        if canvas_result.json_data is not None:
            objects = canvas_result.json_data["objects"]
            
            if len(objects) > 0:
                last_obj = objects[-1]
                
                if drawing_mode == "Nokta Seç (Bilgi Göster)":
                    # Nokta seçimi
                    if last_obj["type"] == "circle":
                        # Canvas koordinatlarını spektrum koordinatlarına çevir
                        canvas_x = last_obj["left"]
                        canvas_y = last_obj["top"]
                        
                        spectrum_size = st.session_state.modified_fft.shape[0]
                        canvas_size = 400
                        
                        x = int(canvas_x * spectrum_size / canvas_size)
                        y = int(canvas_y * spectrum_size / canvas_size)
                        
                        # Sınırları kontrol et
                        x = max(0, min(spectrum_size - 1, x))
                        y = max(0, min(spectrum_size - 1, y))
                        
                        st.session_state.selected_point = (x, y)
                
                else:
                    # Fırça veya silgi çizimi
                    if last_obj["type"] == "path":
                        path = last_obj["path"]
                        
                        spectrum_size = st.session_state.modified_fft.shape[0]
                        canvas_size = 400
                        
                        # Path boyunca maskeyi güncelle
                        for i in range(0, len(path) - 1):
                            if len(path[i]) >= 2 and len(path[i+1]) >= 2:
                                x1 = int(path[i][1] * spectrum_size / canvas_size)
                                y1 = int(path[i][2] * spectrum_size / canvas_size)
                                x2 = int(path[i+1][1] * spectrum_size / canvas_size)
                                y2 = int(path[i+1][2] * spectrum_size / canvas_size)
                                
                                # Çizgi boyunca noktaları işle
                                steps = max(abs(x2-x1), abs(y2-y1)) + 1
                                for step in range(steps):
                                    t = step / max(1, steps - 1)
                                    x = int(x1 + t * (x2 - x1))
                                    y = int(y1 + t * (y2 - y1))
                                    
                                    # Fırça yarıçapı içindeki pikselleri güncelle
                                    radius = stroke_width // 2
                                    for dy in range(-radius, radius + 1):
                                        for dx in range(-radius, radius + 1):
                                            if dx*dx + dy*dy <= radius*radius:
                                                ny, nx = y + dy, x + dx
                                                if 0 <= ny < spectrum_size and 0 <= nx < spectrum_size:
                                                    if drawing_mode == "Fırça (Güçlendir)":
                                                        st.session_state.mask[ny, nx] *= brush_strength
                                                    else:  # Silgi
                                                        st.session_state.mask[ny, nx] = 0
                        
                        # Spektrumu güncelle
                        st.session_state.modified_fft = st.session_state.fft_shift * st.session_state.mask
                        magnitude_spectrum = get_magnitude_spectrum(st.session_state.modified_fft)
                        st.session_state.spectrum_image = spectrum_to_image(magnitude_spectrum)
    
    with col3:
        st.subheader("🔄 Yeniden Oluşturulmuş")
        reconstructed, _ = apply_mask_and_reconstruct(
            st.session_state.fft_shift,
            st.session_state.mask
        )
        
        fig3, ax3 = plt.subplots(figsize=(5, 5))
        ax3.imshow(reconstructed, cmap='gray')
        ax3.axis('off')
        st.pyplot(fig3)
        plt.close()
    
    # Seçili nokta bilgisi ve grafik
    if st.session_state.selected_point is not None:
        st.markdown("---")
        
        x, y = st.session_state.selected_point
        fourier_value = st.session_state.modified_fft[y, x]
        
        # İki sütun: sol bilgiler, sağ grafik
        col_info, col_graph = st.columns([1, 2])
        
        with col_info:
            st.subheader("ℹ️ Seçili Nokta Bilgisi")
            
            st.metric("📍 Konum", f"({x}, {y})")
            
            magnitude = np.abs(fourier_value)
            st.metric("📊 Büyüklük", f"{magnitude:.2f}")
            
            phase = np.angle(fourier_value)
            st.metric("🔄 Faz (rad)", f"{phase:.4f}")
            
            phase_deg = np.degrees(phase)
            st.metric("🔄 Faz (°)", f"{phase_deg:.2f}")
            
            st.markdown("---")
            st.markdown("**📊 Fourier Katsayısı:**")
            st.write(f"**Gerçek:** {fourier_value.real:.2f}")
            st.write(f"**Sanal:** {fourier_value.imag:.2f}")
            
            st.markdown("---")
            st.markdown("**🔢 Polar Gösterim:**")
            st.latex(f"{magnitude:.2f} \cdot e^{{i \cdot {phase:.4f}}}")
        
        with col_graph:
            st.subheader("📈 Fourier Dalga Grafiği")
            
            # Kullanıcının seçimine göre grafik oluştur
            if plot_type == "2D (Grayscale)":
                wave_fig = create_fourier_wave_plot_2d(fourier_value, x, y, st.session_state.fft_shift)
                st.pyplot(wave_fig)
                plt.close()
                st.info("💡 Bu grafik, seçilen frekans bileşeninin 2D uzaysal dalga formunu gösterir. " +
                       "Beyaz ve siyah tonlar genliği temsil eder.")
            else:  # 3D
                wave_fig = create_fourier_wave_plot_3d(fourier_value, x, y, st.session_state.fft_shift)
                st.pyplot(wave_fig)
                plt.close()
                st.info("💡 Bu grafik, seçilen frekans bileşeninin 2D uzaysal dalga formunu 3D olarak gösterir. " +
                       "Yüzey yüksekliği genliği temsil eder.")
    
    # İstatistikler
    st.markdown("---")
    col1, col2, col3, col4 = st.columns(4)
    
    with col1:
        active_freq = np.sum(st.session_state.mask > 0.1)
        total_freq = st.session_state.mask.size
        st.metric(
            "Aktif Frekanslar",
            f"{active_freq}",
            f"{(active_freq/total_freq*100):.1f}%"
        )
    
    with col2:
        avg_magnitude = np.mean(np.abs(st.session_state.modified_fft))
        st.metric("Ort. Büyüklük", f"{avg_magnitude:.2f}")
    
    with col3:
        max_magnitude = np.max(np.abs(st.session_state.modified_fft))
        st.metric("Maks. Büyüklük", f"{max_magnitude:.2f}")
    
    with col4:
        mask_avg = np.mean(st.session_state.mask)
        st.metric("Ort. Maske Değeri", f"{mask_avg:.2f}")

else:
    # Resim yüklenmemişse
    st.info("👈 Lütfen sol menüden bir resim yükleyin")
    
    col1, col2 = st.columns(2)
    
    with col1:
        st.markdown("""
        ## 📖 Nasıl Kullanılır?
        
        ### 1️⃣ Resim Yükle
        Sol menüden bir resim seçin
        
        ### 2️⃣ Nokta Seç Modu
        - Spektrum üzerine **tıklayın**
        - Fourier katsayılarını görün
        - Dalga grafiğini inceleyin
        
        ### 3️⃣ Fırça Modu
        - Spektrum üzerinde **çizin**
        - Frekansları güçlendirin
        - Sonucu anında görün
        
        ### 4️⃣ Silgi Modu
        - Spektrum üzerinde **çizin**
        - İstenmeyen frekansları temizleyin
        - Filtreleme efektleri oluşturun
        """)
    
    with col2:
        st.markdown("""
        ## 🎯 Özellikler
        
        - ✅ **Tıklanabilir** Fourier spektrumu
        - ✅ **Interaktif** fırça ve silgi
        - ✅ **2D/3D** dalga grafiği seçeneği
        - ✅ Detaylı Fourier katsayısı bilgisi
        - ✅ Polar ve kartezyen gösterim
        - ✅ Canlı görselleştirme
        
        ## 💡 İpuçları
        
        - **Merkez:** DC bileşen (ortalama)
        - **Merkeze yakın:** Düşük frekanslar
        - **Kenarlara yakın:** Yüksek frekanslar
        - **Silgi (kenarda):** Blur efekti
        - **Silgi (merkez):** Keskinleştirme
        """)

# Footer
st.markdown("---")
st.markdown(
    """
    <div style='text-align: center; color: gray;'>
    <p>🎓 Image Processing Dersi - Interaktif Fourier Spektrum Analizi</p>
    </div>
    """,
    unsafe_allow_html=True
)
