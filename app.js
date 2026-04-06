// --- State Management & Constants ---
let streakData = JSON.parse(localStorage.getItem('sugarcut_streak')) || { days: 0, rewards: 0, lastUpdate: null };

const ANNA_NAGAR_LAT = 13.0827;
const ANNA_NAGAR_LNG = 80.2118;
const RADIUS_KM = 3; 

// --- DOM Elements ---
const navBtns = document.querySelectorAll('.nav-btn');
const views = document.querySelectorAll('.view');

// Dashboard UI
const streakDaysEl = document.getElementById('streak-days');
const rewardsCountEl = document.getElementById('rewards-count');
const sugarSavedEl = document.getElementById('sugar-saved');

// Routines UI
const routineAlert = document.getElementById('routine-alert');
const modalOverlay = document.getElementById('overlay-modal');
const closeModalBtn = document.getElementById('close-modal');

// AI UI
const analyzeBtn = document.getElementById('analyze-btn');
const aiResultBox = document.getElementById('ai-result-box');
const aiVerdictEl = document.getElementById('ai-verdict');
const estSugarEl = document.getElementById('est-sugar');
const foodImageInput = document.getElementById('food-image');
const foodTextInput = document.getElementById('food-text');
const fileNameEl = document.getElementById('file-name');

// --- Three.js Luxury Setup ---
function initThreeJS() {
    const canvas = document.getElementById('three-canvas');
    if (!canvas || !window.THREE) return;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x09090e, 0.05);

    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 5;
    camera.position.y = 1; // Looking slightly down

    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);

    // Luxury Geometric Core (Icosahedron)
    const geometry = new THREE.IcosahedronGeometry(1.5, 1);
    
    // Wireframe glowing material
    const material = new THREE.MeshStandardMaterial({
        color: 0x00e5ff,
        wireframe: true,
        emissive: 0x00e5ff,
        emissiveIntensity: 0.5,
        transparent: true,
        opacity: 0.8
    });

    const coreMesh = new THREE.Mesh(geometry, material);
    scene.add(coreMesh);

    // Inner Solid Core
    const innerGeo = new THREE.IcosahedronGeometry(1.2, 0);
    const innerMat = new THREE.MeshStandardMaterial({
        color: 0x09090e,
        roughness: 0.1,
        metalness: 0.8
    });
    const innerMesh = new THREE.Mesh(innerGeo, innerMat);
    coreMesh.add(innerMesh);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0x404040);
    scene.add(ambientLight);

    const pointLight1 = new THREE.PointLight(0xB026FF, 2, 10);
    pointLight1.position.set(-2, 2, 2);
    scene.add(pointLight1);

    const pointLight2 = new THREE.PointLight(0x00e5ff, 2, 10);
    pointLight2.position.set(2, -2, 2);
    scene.add(pointLight2);

    // Animation Loop
    function animate() {
        requestAnimationFrame(animate);
        coreMesh.rotation.y += 0.002;
        coreMesh.rotation.x += 0.001;
        innerMesh.rotation.y -= 0.001;
        
        // Gentle float
        coreMesh.position.y = Math.sin(Date.now() * 0.001) * 0.2 + 0.8; 
        
        renderer.render(scene, camera);
    }
    animate();

    // Handle Resize
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });
}

// --- Initialization ---
function init() {
    updateDashboard();
    checkRoutines();
    setInterval(checkRoutines, 60000);
    initThreeJS();
}

// --- Navigation ---
navBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        navBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        const target = btn.getAttribute('data-target');
        views.forEach(v => {
            if (v.id === target) {
                v.classList.add('active');
            } else {
                v.classList.remove('active');
            }
        });
    });
});

// --- Dashboard Logic ---
function updateDashboard() {
    // Demo Initialization
    if (!streakData.lastUpdate) {
        streakData.days = 5;
        streakData.rewards = 2;
        streakData.sugarAvoided = 140; // g
        streakData.lastUpdate = new Date().toDateString();
        localStorage.setItem('sugarcut_streak', JSON.stringify(streakData));
    }

    streakDaysEl.innerText = streakData.days;
    rewardsCountEl.innerText = streakData.rewards;
    if(sugarSavedEl) sugarSavedEl.innerText = (streakData.sugarAvoided || 0) + 'g';
}

// --- Image Handling ---
let currentImageBase64 = null;
let currentImageMimeType = null;

if (foodImageInput) {
    foodImageInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            fileNameEl.innerText = `[${file.name.toUpperCase()}] DETECTED`;
            fileNameEl.style.color = "var(--neon-green)";
            const reader = new FileReader();
            reader.onloadend = () => {
                const result = reader.result;
                const commaIdx = result.indexOf(',');
                currentImageBase64 = result.substring(commaIdx + 1);
                currentImageMimeType = file.type;
            };
            reader.readAsDataURL(file);
        } else {
            fileNameEl.innerText = 'SENSOR IDLE';
            fileNameEl.style.color = "var(--text-muted)";
            currentImageBase64 = null;
            currentImageMimeType = null;
        }
    });
}

// --- AI Analyzer Proxy Logic ---
if (analyzeBtn) {
    analyzeBtn.addEventListener('click', async () => {
        const textInput = foodTextInput.value.trim();
        if (!textInput && !currentImageBase64) {
            alert("UPLINK FAILED: Neural network requires an image or text input.");
            return;
        }

        aiResultBox.style.display = 'block';
        aiVerdictEl.innerText = "Processing Neural Matrix...";
        aiVerdictEl.style.color = 'var(--text-muted)';
        aiVerdictEl.classList.remove('glow-text-red');
        estSugarEl.innerText = "--";

        try {
            let aiResponse = await callBackendAPI(textInput, currentImageBase64, currentImageMimeType);
            
            let parsed = { sugar_g: 0 };
            try {
                const codeBlockMatch = aiResponse.match(/```(?:json)?\n([\s\S]*?)\n```/);
                if (codeBlockMatch) {
                    parsed = JSON.parse(codeBlockMatch[1]);
                } else {
                    const firstBrace = aiResponse.indexOf('{');
                    const lastBrace = aiResponse.lastIndexOf('}');
                    if (firstBrace !== -1 && lastBrace !== -1) {
                        parsed = JSON.parse(aiResponse.substring(firstBrace, lastBrace + 1));
                    } else {
                        throw new Error("No JSON boundaries found");
                    }
                }
            } catch(e) {
                const sugarMatch = aiResponse.match(/sugar.*?(\d+(\.\d+)?)/i);
                if (sugarMatch) {
                    parsed.sugar_g = parseFloat(sugarMatch[1]);
                } else {
                    throw new Error("Unexpected Neural format.");
                }
            }

            if (parsed.sugar_g > 10) {
                aiVerdictEl.innerText = "🛑 TOXICITY HIGH. ABORT.";
                aiVerdictEl.style.color = "var(--vibrant-orange)";
                aiVerdictEl.classList.add('glow-text-red');
            } else if (parsed.sugar_g > 0) {
                aiVerdictEl.innerText = "⚠️ CAUTION: MODERATE TOXICITY.";
                aiVerdictEl.style.color = "var(--vibrant-orange)";
            } else {
                aiVerdictEl.innerText = "✅ SYSTEM CLEARED. SUGAR FREE.";
                aiVerdictEl.style.color = "var(--neon-green)";
            }

            estSugarEl.innerText = parsed.sugar_g;

        } catch (err) {
            console.error(err);
            aiVerdictEl.innerText = "UPLINK ERROR: " + err.message;
            aiVerdictEl.style.color = "var(--vibrant-orange)";
        }
    });
}

// Routes strictly to the local / Vercel API proxy route!
async function callBackendAPI(textContext, base64Image, mimeType) {
    let parts = [
        {
            text: `You are an extremely strict, hardcore diet coach specialized in Indian (specifically Chennai) cuisine.
            Your user is completely cutting out sugar. 
            Analyze the provided image and/or text context: "${textContext}".
            Calculate or strictly estimate the added and natural sugar content in grams.
            Return ONLY a valid JSON object matching exactly this format: {"sugar_g": <number>, "reason": "<string>"}`
        }
    ];

    if (base64Image) {
        parts.push({
            inline_data: {
                mime_type: mimeType,
                data: base64Image
            }
        });
    }

    const payload = {
        contents: [ { role: "user", parts: parts } ],
        generationConfig: { temperature: 0.1 }
    };

    // Note: If running locally without a Node server (just double clicking file), 
    // fetch to /api/gemini will fail. It must be hosted on Vercel.
    const response = await fetch('/api/gemini', {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        let errStr = "Proxy Server Failed";
        try {
            const errData = await response.json();
            errStr = errData.error || errStr;
        } catch(e){}
        throw new Error(errStr);
    }
    
    const data = await response.json();
    return data.candidates[0].content.parts[0].text;
}

// --- Timers & Location Watcher ---
function checkRoutines() {
    const now = new Date();
    const hours = now.getHours();
    const mins = now.getMinutes();

    if (hours === 18 && mins < 30) {
        if(routineAlert) routineAlert.style.display = 'flex';
    } else {
        if(routineAlert) routineAlert.style.display = 'none';
    }

    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition((position) => {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            const distance = calculateDistance(lat, lng, ANNA_NAGAR_LAT, ANNA_NAGAR_LNG);
            
            if (distance < RADIUS_KM && !sessionStorage.getItem('anna_nagar_warned')) {
                if(modalOverlay) modalOverlay.classList.add('active');
                sessionStorage.setItem('anna_nagar_warned', 'true');
            }
        }, () => {});
    }
}

function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; 
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2); 
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

if(closeModalBtn) {
    closeModalBtn.addEventListener('click', () => modalOverlay.classList.remove('active'));
}

// Run Init
init();
