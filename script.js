const previewImg = document.getElementById("previewImg");
const imageFile = document.getElementById("imageFile");
const imageUrl = document.getElementById("imageUrl");
const loadUrlBtn = document.getElementById("loadUrlBtn");
const thresholdRange = document.getElementById("thresholdRange");
const canvas = document.getElementById("canvas");
const downloadBtn = document.getElementById("downloadBtn");

const cannyCheckbox = document.getElementById("cannyCheckbox");
const sketchCheckbox = document.getElementById("sketchCheckbox");
const posterizeCheckbox = document.getElementById("posterizeCheckbox");
const gaussianBlurRange = document.getElementById("gaussianBlurRange");


let cvReady = false;
let modified = false;

function onOpenCvReady() {
    cvReady = true;
    console.log("OpenCV is ready");
}


let loadedImage = new Image();
loadedImage.crossOrigin = "Anonymous";

// Load image from file
imageFile.addEventListener("change", () => {
    const file = imageFile.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = e => setImageSource(e.target.result);
    reader.readAsDataURL(file);
});

// Load image from URL
loadUrlBtn.addEventListener("click", () => {
    if (imageUrl.value.trim() === "") return;
    setImageSource(imageUrl.value.trim());
});

function setImageSource(src) {
    saveImageToLocal(src);       // <-- ADD THIS LINE
    loadedImage.onload = () => {
        previewImg.src = loadedImage.src;
        previewImg.classList.remove("d-none");
        canvas.classList.add("d-none");
        downloadBtn.classList.add("d-none");
        modified = false;
    };
    loadedImage.src = src;
}

window.addEventListener("DOMContentLoaded", () => {
        const savedImg = localStorage.getItem("savedImageBase64");
        if (savedImg) {
            setImageSource(savedImg);   // use your existing function
            clearSavedBtn.classList.remove("d-none");
        } else {
            clearSavedBtn.classList.add("d-none");
        }
    });

// Utility: Posterize (reduce colors)
function posterizePixel(value, levels = 4) {
    return Math.floor(value / 256 * levels) * Math.floor(256 / levels);
}

// Utility: Pencil sketch effect
function pencilSketch(data) {
    for (let i = 0; i < data.length; i += 4) {
        let avg = (data[i] + data[i+1] + data[i+2]) / 3;
        let inverted = 255 - avg;
        let sketch = 255 - ((inverted * 255) / (avg + 1));
        data[i] = data[i+1] = data[i+2] = sketch;
    }
}

function updateStencil() {
    if (!loadedImage.src) {
        showToast("Please load an image first!", "warning");
        return;
    }

    const threshold = parseInt(thresholdRange.value);

    const ctx = canvas.getContext("2d");
    canvas.width = loadedImage.width;
    canvas.height = loadedImage.height;

    ctx.drawImage(loadedImage, 0, 0);
    let imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let data = imgData.data;

    // Apply pencil sketch
    if (sketchCheckbox.checked) {
        pencilSketch(data);
    } else {
        // Convert to grayscale
        for (let i = 0; i < data.length; i += 4) {
            let avg = (data[i] + data[i+1] + data[i+2]) / 3;
            data[i] = data[i+1] = data[i+2] = avg;
        }
    }

    // Posterize colors
    if (posterizeCheckbox.checked) {
        for (let i = 0; i < data.length; i += 4) {
            data[i] = posterizePixel(data[i]);
            data[i+1] = posterizePixel(data[i+1]);
            data[i+2] = posterizePixel(data[i+2]);
        }
    }

    ctx.putImageData(imgData, 0, 0);


    // Canny edge detection using OpenCV.js
    if (cannyCheckbox.checked) {
        if (!cvReady) {
            showToast("OpenCV.js is still loading. Please wait a few seconds.", "warning");
            return;
        }

        let src = cv.imread(canvas);
        let dst = new cv.Mat();
        cv.cvtColor(src, src, cv.COLOR_RGBA2GRAY, 0);
        cv.Canny(src, dst, 50, 150, 3, false);
        cv.imshow(canvas, dst);
        src.delete(); dst.delete();
    } else {
        // Apply threshold if no Canny
        for (let i = 0; i < data.length; i += 4) {
            let v = data[i] > threshold ? 255 : 0;
            data[i] = data[i+1] = data[i+2] = v;
        }
        ctx.putImageData(imgData, 0, 0);
    }

    canvas.classList.remove("d-none");

    // ----------------------------
    // Apply Gaussian Blur (final)
    // ----------------------------
    let blurValue = parseInt(gaussianBlurRange.value);

    if (blurValue > 1) {
        if (!cvReady) {
            showToast("OpenCV.js is still loading. Please wait a few seconds.", "warning");
            return;
        }
        let srcBlur = cv.imread(canvas);
        let dstBlur = new cv.Mat();

        // Ensure odd kernel size (required by OpenCV)
        let ksize = new cv.Size(blurValue, blurValue);

        cv.GaussianBlur(srcBlur, dstBlur, ksize, 0, 0, cv.BORDER_DEFAULT);
        cv.imshow(canvas, dstBlur);

        srcBlur.delete();
        dstBlur.delete();
    }

    downloadBtn.href = canvas.toDataURL("image/png");
    downloadBtn.classList.remove("d-none");
    if (!modified) {
        previewImg.classList.add("d-none");
    }
    modified = true;
}



// Include Gaussian blur in live update listeners
[thresholdRange, cannyCheckbox, sketchCheckbox, posterizeCheckbox, gaussianBlurRange].forEach(el => {
    el.addEventListener("input", updateStencil);
});

// Save image to browser (localStorage)
function saveImageToLocal(base64) {
    try {
        localStorage.setItem("savedImageBase64", base64);
        console.log("Image saved locally.");
        clearSavedBtn.classList.remove("d-none");
    } catch (e) {
        showToast("LocalStorage save failed:" + e, warning);
    }
}


// Clear saved base64 from localStorage
const clearSavedBtn = document.getElementById("clearSavedBtn");
clearSavedBtn?.addEventListener("click", () => {
    localStorage.removeItem("savedImageBase64");
    showToast("Saved image cleared.", "success");
    clearSavedBtn.classList.add("d-none");
});

function showToast(message, type = "info", delay = 3000) {
    const toastContainer = document.getElementById("toastContainer");
    const toastId = `toast-${Date.now()}`;

    const toastEl = document.createElement("div");
    toastEl.className = `toast align-items-center text-bg-${type} border-0`;
    toastEl.id = toastId;
    toastEl.setAttribute("role", "alert");
    toastEl.setAttribute("aria-live", "assertive");
    toastEl.setAttribute("aria-atomic", "true");
    toastEl.innerHTML = `
        <div class="d-flex">
            <div class="toast-body">
                ${message}
            </div>
            <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
        </div>
    `;

    toastContainer.appendChild(toastEl);

    const toast = new bootstrap.Toast(toastEl, { delay });
    toast.show();

    toastEl.addEventListener("hidden.bs.toast", () => {
        toastEl.remove();
    });
}



document.addEventListener('DOMContentLoaded', function () {
    const themeToggleWrapper = document.getElementById('themeToggleWrapper');
    const themeIcon = document.getElementById('themeIcon');
    const body = document.body;

    function updateThemeIcon() {
        if (themeIcon) {
            themeIcon.textContent = body.classList.contains('dark-mode') ? '🌙' : '☀️';
        }
    }

    // Default to dark theme unless explicitly set to 'light'
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark' || savedTheme === null) {
        body.classList.add('dark-mode');
        localStorage.setItem('theme', 'dark');
    }


    updateThemeIcon();

    themeToggleWrapper.addEventListener('click', () => {
        body.classList.toggle('dark-mode');
        localStorage.setItem('theme', body.classList.contains('dark-mode') ? 'dark' : 'light');
        updateThemeIcon();
    });
});


// Translation dictionary
const translations = {
    en: {
        inputImage: "🖼️ Input Image",
        upload: "Upload",
        load: "Load",
        clearSaved: "Clear Saved",
        intensity: "🎚️ Intensity",
        intensityTip: "Tip: adjust threshold to tune contrast.",
        effects: "✨ Effects",
        effectsTip: "Tip: toggle effects and preview result.",
        edgeDetect: "Edge Detect (Canny)",
        pencilSketch: "Pencil Sketch",
        posterize: "Posterize",
        blur: "🧼 Blur",
        blurTip: "Tip: use Gaussian Blur to remove small artifacts.",
        downloadStencil: "Download Stencil",
        loadImageFirst: "Please load an image first!",
        savedImageCleared: "Saved image cleared."
    },
    de: {
        inputImage: "🖼️ Eingabebild",
        upload: "Hochladen",
        load: "Laden",
        clearSaved: "Gespeichertes löschen",
        intensity: "🎚️ Intensität",
        intensityTip: "Tipp: Schwellenwert anpassen, um den Kontrast zu optimieren.",
        effects: "✨ Effekte",
        effectsTip: "Tipp: Effekte umschalten und Ergebnis ansehen.",
        edgeDetect: "Kantenerkennung (Canny)",
        pencilSketch: "Bleistiftskizze",
        posterize: "Posterize",
        blur: "🧼 Weichzeichnen",
        blurTip: "Tipp: Gaussian Blur verwenden, um kleine Artefakte zu entfernen.",
        downloadStencil: "Stencil herunterladen",
        loadImageFirst: "Bitte zuerst ein Bild laden!",
        savedImageCleared: "Gespeichertes Bild gelöscht."
    },
    es: {
        inputImage: "🖼️ Imagen de entrada",
        upload: "Subir",
        load: "Cargar",
        clearSaved: "Borrar guardado",
        intensity: "🎚️ Intensidad",
        intensityTip: "Consejo: ajusta el umbral para mejorar el contraste.",
        effects: "✨ Efectos",
        effectsTip: "Consejo: activa/desactiva efectos y previsualiza.",
        edgeDetect: "Detección de bordes (Canny)",
        pencilSketch: "Dibujo a lápiz",
        posterize: "Posterizar",
        blur: "🧼 Desenfoque",
        blurTip: "Consejo: usa Gaussian Blur para eliminar pequeños artefactos.",
        downloadStencil: "Descargar stencil",
        loadImageFirst: "¡Carga primero una imagen!",
        savedImageCleared: "Imagen guardada borrada."
    }
};

// Function to update UI text
function updateLanguage(lang) {
    document.querySelectorAll("[data-i18n]").forEach(el => {
        const key = el.getAttribute("data-i18n");
        if (translations[lang][key]) {
            el.textContent = translations[lang][key];
        }
    });
}

// On language change
const languageSelector = document.getElementById("languageSelector");
languageSelector.addEventListener("change", () => {
    const lang = languageSelector.value;
    localStorage.setItem("lang", lang);
    updateLanguage(lang);
});

// Load saved language
document.addEventListener("DOMContentLoaded", () => {
    const savedLang = localStorage.getItem("lang") || "en";
    languageSelector.value = savedLang;
    updateLanguage(savedLang);
});
