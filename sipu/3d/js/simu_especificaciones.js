/* ========== GLOBALS & ENGINE SETUP ========== */
const canvas = document.getElementById("renderCanvas");
const engine = new BABYLON.Engine(canvas, true);
let dynamicTexture;
let container;

const ui = {
    ownerCode: document.getElementById('owner-code'),
    serialNumber: document.getElementById('serial-number'),
    checkDigit: document.getElementById('check-digit'),
    isoCode: document.getElementById('iso-code'),
    maxGross: document.getElementById('max-gross'),
    tare: document.getElementById('tare'),
    net: document.getElementById('net'),
    capacity: document.getElementById('capacity'),
    containerColor: document.getElementById('container-color'),
};

/* ========== SCENE CREATION ========== */
const createScene = function () {
    const scene = new BABYLON.Scene(engine);
    scene.clearColor = new BABYLON.Color4(0.039, 0.055, 0.1, 1.0);

    // --- Cámara ---
    const camera = new BABYLON.ArcRotateCamera("camera", -Math.PI / 2.5, Math.PI / 2.5, 10, new BABYLON.Vector3(0, 1, 0), scene);
    camera.attachControl(canvas, true);
    camera.lowerRadiusLimit = 5;
    camera.upperRadiusLimit = 20;

    // --- Luces ---
    const light = new BABYLON.HemisphericLight("light", new BABYLON.Vector3(0, 1, 0), scene);
    light.intensity = 1.0;

    // --- Contenedor ---
    // Usamos un tamaño estándar de contenedor de 20 pies (en metros)
    container = BABYLON.MeshBuilder.CreateBox("container", {width: 6.058, height: 2.591, depth: 2.438}, scene);
    const containerMat = new BABYLON.StandardMaterial("containerMat", scene);
    container.material = containerMat;

    // --- Textura Dinámica ---
    // Esta es la clave: una textura creada a partir de un canvas 2D
    const textureResolution = 2048;
    dynamicTexture = new BABYLON.DynamicTexture("dynamicTexture", {width: textureResolution, height: textureResolution}, scene, true);
    containerMat.diffuseTexture = dynamicTexture;

    // Actualizar la textura por primera vez
    updateContainerTexture();

    return scene;
};

const scene = createScene();

engine.runRenderLoop(function () {
    scene.render();
});

window.addEventListener("resize", function () {
    engine.resize();
});

/* ========== DYNAMIC TEXTURE LOGIC ========== */

/**
 * Dibuja toda la información del contenedor en el canvas 2D de la textura dinámica.
 */
function updateContainerTexture() {
    const ctx = dynamicTexture.getContext();
    const size = dynamicTexture.getSize();
    const width = size.width;
    const height = size.height;

    // 1. Fondo (color del contenedor)
    ctx.fillStyle = ui.containerColor.value;
    ctx.fillRect(0, 0, width, height);

    // 2. Configuración de texto
    ctx.fillStyle = 'white';
    ctx.strokeStyle = 'black';
    ctx.lineWidth = 2;

    // --- DIBUJAR CARA FRONTAL (aquí simplificado, en una app real se usarían UV maps) ---
    // Para este ejemplo, dibujaremos todo en una gran área para que sea visible.
    
    // 3. Dibujar Número de Contenedor (grande)
    const fullContainerNumber = `${ui.ownerCode.value.toUpperCase()} ${ui.serialNumber.value} ${ui.checkDigit.value}`;
    ctx.font = `bold 120px "${getComputedStyle(document.documentElement).getPropertyValue('--font-mono')}"`;
    ctx.textAlign = 'center';
    ctx.strokeText(fullContainerNumber, width / 2, 200);
    ctx.fillText(fullContainerNumber, width / 2, 200);

    // 4. Dibujar Código ISO
    ctx.font = `bold 80px "${getComputedStyle(document.documentElement).getPropertyValue('--font-mono')}"`;
    ctx.strokeText(ui.isoCode.value.toUpperCase(), width / 2, 320);
    ctx.fillText(ui.isoCode.value.toUpperCase(), width / 2, 320);

    // 5. Dibujar Tabla de Especificaciones (CSC Plate simulada)
    drawSpecTable(ctx, width / 2, 500);

    // Actualizar la textura en la escena 3D
    dynamicTexture.update();
}

/**
 * Dibuja una tabla con las especificaciones de peso y capacidad.
 * @param {CanvasRenderingContext2D} ctx El contexto del canvas 2D.
 * @param {number} x Posición X central de la tabla.
 * @param {number} y Posición Y inicial de la tabla.
 */
function drawSpecTable(ctx, x, y) {
    const tableWidth = 800;
    const rowHeight = 70;
    const startX = x - tableWidth / 2;

    ctx.font = `40px "${getComputedStyle(document.documentElement).getPropertyValue('--font-family')}"`;
    ctx.textAlign = 'left';

    const specs = [
        { label: 'MAX. GROSS', value: `${ui.maxGross.value} KGS` },
        { label: 'TARE', value: `${ui.tare.value} KGS` },
        { label: 'NET', value: `${ui.net.value} KGS` },
        { label: 'CU. CAP.', value: `${ui.capacity.value} CU.M` }
    ];

    // Dibuja un recuadro para la tabla
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 4;
    ctx.strokeRect(startX - 20, y - 50, tableWidth + 40, (specs.length * rowHeight) + 40);

    specs.forEach((spec, index) => {
        const currentY = y + (index * rowHeight);
        
        // Dibuja la etiqueta
        ctx.fillStyle = '#dddddd';
        ctx.fillText(spec.label, startX, currentY);

        // Dibuja el valor
        ctx.fillStyle = 'white';
        ctx.font = `bold 50px "${getComputedStyle(document.documentElement).getPropertyValue('--font-mono')}"`;
        ctx.fillText(spec.value, startX + 350, currentY);

        // Restaurar fuente para la siguiente etiqueta
        ctx.font = `40px "${getComputedStyle(document.documentElement).getPropertyValue('--font-family')}"`;
    });
}


/* ========== EVENT LISTENERS DE LA INTERFAZ ========== */
document.addEventListener('DOMContentLoaded', () => {
    // Agrega un listener a todos los inputs del panel
    const inputs = document.querySelectorAll('#panel input, #panel select');
    inputs.forEach(input => {
        input.addEventListener('input', updateContainerTexture);
    });
});