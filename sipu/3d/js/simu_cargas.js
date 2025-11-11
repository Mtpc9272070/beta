/* ========== GLOBALS & ENGINE SETUP ========== */


const canvas = document.getElementById("renderCanvas");
const engine = new BABYLON.Engine(canvas, true);

let boxes = []; // Almacena { id, mesh, metadata }
let batchesToLoad = []; // NUEVO: Almacena los lotes definidos por el usuario
let cargoIdCounter = 0;

let selectedMesh = null;
let container = null;

// --- CORRECCIÓN 1: Mover la declaración de estas variables al ámbito global ---
let highlightLayer;
let gizmoManager;

// NUEVO: URLs para las texturas de aduana
const TEXTURES = {
    container: 'https://sdmntprcentralus.oaiusercontent.com/files/00000000-5298-71f5-9bc1-a72213c6b40e/raw?se=2025-11-10T16%3A53%3A41Z&sp=r&sv=2024-08-04&sr=b&scid=333f1e77-8fc2-4f47-a83e-fcf7b0367893&skoid=33096a49-a96b-4506-9fc4-04a7517f8175&sktid=a48cca56-e6da-484e-a814-9c849652bcb3&skt=2025-11-10T09%3A23%3A27Z&ske=2025-11-11T09%3A23%3A27Z&sks=b&skv=2024-08-04&sig=bTInuTelXNJFXU%2BrYofJQ7HJXxqBSRfGMHoNUn5cszk%3D', // Textura de contenedor con transparencia
    box: 'https://www.babylonjs-playground.com/textures/crate.png' // Textura de caja de madera/cartón
};

const PALLET_DIMENSIONS = { l: 1.2, w: 1.0, h: 0.15 }; // Largo, ancho, alto en metros
let pallets = [];

/* ========== SCENE CREATION ========== */
const createScene = function () {
    const scene = new BABYLON.Scene(engine);
    scene.clearColor = new BABYLON.Color4(0.05, 0.07, 0.1, 1.0);

    // --- Cámara ---
    const camera = new BABYLON.ArcRotateCamera("camera", -Math.PI / 2, Math.PI / 2.5, 15, new BABYLON.Vector3(0, 1, 0), scene);
    camera.attachControl(canvas, true);
    camera.lowerRadiusLimit = 5;
    camera.upperRadiusLimit = 50;

    // --- Luces ---
    const light = new BABYLON.HemisphericLight("light", new BABYLON.Vector3(0, 1, 0), scene);
    light.intensity = 0.7;
    const dirLight = new BABYLON.DirectionalLight("dirLight", new BABYLON.Vector3(-1, -2, -1), scene);
    dirLight.position = new BABYLON.Vector3(20, 40, 20);

    // --- Suelo ---
    const ground = BABYLON.MeshBuilder.CreateGround("ground", {width: 50, height: 50}, scene);
    const groundMat = new BABYLON.StandardMaterial("groundMat", scene);
    groundMat.diffuseColor = new BABYLON.Color3.FromHexString("#0A0E1A");
    ground.material = groundMat;

    // --- Contenedor ---
    createContainer(scene, { l: 6.058, w: 2.438, h: 2.591 }); // Crear contenedor inicial
    const containerMat = new BABYLON.StandardMaterial("containerMat", scene);
    containerMat.alpha = 0.15;
    containerMat.diffuseColor = BABYLON.Color3.FromHexString("#0077ff"); // Color por defecto
    container.material = containerMat;
    container.position.y = 2.591 / 2;
    container.enableEdgesRendering();
    container.edgesWidth = 4.0;
    container.edgesColor = new BABYLON.Color4(0, 0.46, 1, 0.5);

    // --- Capa de Resaltado (Highlight) ---
    highlightLayer = new BABYLON.HighlightLayer("hl1", scene); // Inicializar la variable global

    // --- Gestor de Gizmos (Controles de Transformación) ---
    gizmoManager = new BABYLON.GizmoManager(scene); // Inicializar la variable global
    gizmoManager.positionGizmoEnabled = true;
    gizmoManager.rotationGizmoEnabled = true;
    gizmoManager.scaleGizmoEnabled = false;
    gizmoManager.usePointerToAttachGizmos = false; // El gizmo se adjuntará manualmente

    // --- Lógica de Selección ---
    const selectObject = (mesh) => {
        if (selectedMesh) {
            highlightLayer.removeMesh(selectedMesh);
        }
        selectedMesh = mesh;
        gizmoManager.attachToMesh(selectedMesh);
        highlightLayer.addMesh(selectedMesh, BABYLON.Color3.Yellow());
        updateBoxList();
    };

    const deselectObject = () => {
        if (selectedMesh) {
            highlightLayer.removeMesh(selectedMesh);
        }
        selectedMesh = null;
        gizmoManager.attachToMesh(null);
        updateBoxList();
    };

    // --- Lógica de Selección ---
    scene.onPointerObservable.add((pointerInfo) => {
        if (pointerInfo.type === BABYLON.PointerEventTypes.POINTERDOWN) {
            // Si el clic fue en un gizmo, no hacemos nada más para evitar la deselección
            if (gizmoManager.is  ) {
                return;
            }

            const pickResult = scene.pick(scene.pointerX, scene.pointerY, (mesh) => mesh.metadata && (mesh.metadata.type === 'box' || mesh.metadata.type === 'cylinder'));
            if (pickResult.hit) {
                selectObject(pickResult.pickedMesh);
            } else {
                deselectObject();
            }
        } else if (pointerInfo.type === BABYLON.PointerEventTypes.POINTERMOVE) {
            const pickResult = scene.pick(scene.pointerX, scene.pointerY, (mesh) => mesh.metadata && mesh.metadata.type === 'box');
            const pickResultCylinder = scene.pick(scene.pointerX, scene.pointerY, (mesh) => mesh.metadata && mesh.metadata.type === 'cylinder');
            const finalPickResult = pickResult.hit ? pickResult : pickResultCylinder;

            if (finalPickResult.hit) {
                const hoveredMesh = finalPickResult.pickedMesh;
                const boxData = boxes.find(b => b.mesh === hoveredMesh);
                if (boxData) {
                    const meta = boxData.metadata;
                    const dimsText = meta.type === 'box'
                        ? `${meta.l.toFixed(2)}x${meta.w.toFixed(2)}x${meta.h.toFixed(2)} m`
                        : `Ø ${meta.diameter.toFixed(2)} x ${meta.height.toFixed(2)} m`;
                    const volume = meta.type === 'box' ? (meta.l * meta.w * meta.h) : (Math.PI * Math.pow(meta.diameter / 2, 2) * meta.height);
                    tooltip.innerHTML = `
                        <strong>${meta.type === 'box' ? 'Caja' : 'Cilindro'} #${boxData.id}</strong><br>
                        ${dimsText}<br>
                        Volumen: ${volume.toFixed(3)} m³
                    `;
                    tooltip.style.left = `${scene.pointerX + 10}px`;
                    tooltip.style.top = `${scene.pointerY + 10}px`;
                    tooltip.classList.remove('hidden');
                }
            } else {
                tooltip.classList.add('hidden');
            }
        } else if (pointerInfo.type === BABYLON.PointerEventTypes.POINTERUP) {
            // Cuando se suelta el clic después de mover un objeto
            if (gizmoManager.isGizmoAttached) { // Si un gizmo estaba activo
                checkCollisions();
                updateStats();
            }
        }
    });

    return scene;
};

const scene = createScene(); // La escena se crea una vez

/* ========== OBJECTS MANAGEMENT ========== */
/**
 * Crea o reemplaza el contenedor principal en la escena.
 * @param {BABYLON.Scene} scene La escena de Babylon.
 * @param {object} dims Dimensiones {l, w, h}.
 */
function createContainer(scene, dims) {
    if (container) {
        container.dispose(); // Eliminar el mesh anterior
    }

    const theme = document.getElementById('theme-selector').value;

    container = BABYLON.MeshBuilder.CreateBox("container", {width: dims.l, height: dims.h, depth: dims.w}, scene);
    const containerMat = new BABYLON.StandardMaterial("containerMat", scene);

    // MODIFICADO: Aplicar textura o color según el tema seleccionado
    if (theme === 'aduana') {
        containerMat.diffuseTexture = new BABYLON.Texture(TEXTURES.container, scene);
        containerMat.useAlphaFromDiffuseTexture = true; // Usar la transparencia de la imagen PNG
        containerMat.opacityTexture = containerMat.diffuseTexture; // Asegurar transparencia
        container.edgesColor = new BABYLON.Color4(0.8, 0.8, 0.8, 0.4); // Bordes más sutiles
    } else { // Tema 'moderno'
        containerMat.alpha = 0.15;
        containerMat.diffuseColor = new BABYLON.Color3.FromHexString("#0077ff");
        container.edgesColor = new BABYLON.Color4(0, 0.46, 1, 0.5);
    }

    container.material = containerMat;
    container.position.y = dims.h / 2;
    container.enableEdgesRendering();
    container.edgesWidth = 4.0;
    container.isPickable = false; // El contenedor no debe ser seleccionable por el raycaster de cajas


    // Almacenar las dimensiones actuales del contenedor
    container.metadata = { l: dims.l, w: dims.w, h: dims.h };
}

const deselectObject = () => {
    if (selectedMesh) {
        highlightLayer.removeMesh(selectedMesh);
    }
    selectedMesh = null;
    gizmoManager.attachToMesh(null);
    updateBoxList();
};


/* ========== FUNCIONES DEL SIMULADOR ========== */

/**
 * Crea los palets y los distribuye en el contenedor.
 * @param {BABYLON.Scene} scene La escena de Babylon.
 * @param {number} qty Cantidad de palets a crear.
 */
function createPallets(scene, qty) {
    // Eliminar palets existentes
    pallets.forEach(pallet => pallet.dispose());
    pallets = [];

    const containerDims = container.metadata;
    const numPalletsX = Math.floor(Math.sqrt(qty * containerDims.l / containerDims.w));
    const numPalletsZ = Math.ceil(qty / numPalletsX);

    const stepX = containerDims.l / numPalletsX;
    const stepZ = containerDims.w / numPalletsZ;

    let palletCount = 0;
    for (let i = 0; i < numPalletsX; i++) {
        for (let j = 0; j < numPalletsZ; j++) {
            if (palletCount < qty) {
                const x = -containerDims.l / 2 + stepX / 2 + i * stepX;
                const z = -containerDims.w / 2 + stepZ / 2 + j * stepZ;
                const pallet = createPallet(scene, new BABYLON.Vector3(x, PALLET_DIMENSIONS.h / 2, z));
                pallets.push(pallet);
                palletCount++;
            }
        }
    }
}
/**
 * Crea una nueva caja y la añade a la escena.
 * MODIFICADO: Ahora se llama createCargo y puede crear cajas o cilindros.
 * @param {BABYLON.Scene} scene La escena de Babylon.
 * @param {BABYLON.Vector3} position Posición inicial de la caja.
 * @param {object} dims Dimensiones {l, w, h}.
 * @param {string} colorHex Color en formato hexadecimal.
 * @param {string} type El tipo de carga ('box' o 'cylinder').
 */
function createCargo(scene, position, dims, colorHex, type) {
    let cargoMesh;
    const theme = document.getElementById('theme-selector').value;
    const cargoMat = new BABYLON.StandardMaterial(`mat_${cargoIdCounter}`, scene);

    if (type === 'cylinder') {
        cargoMesh = BABYLON.MeshBuilder.CreateCylinder(`cyl_${cargoIdCounter}`, {
            diameter: dims.diameter,
            height: dims.height
        }, scene);
    } else { // 'box' por defecto
        cargoMesh = BABYLON.MeshBuilder.CreateBox(`box_${cargoIdCounter}`, {
            width: dims.l,
            height: dims.h,
            depth: dims.w
        }, scene);
    }

    cargoMesh.position = position;


    // MODIFICADO: Aplicar textura o color según el tema
    if (theme === 'aduana') {
        cargoMat.diffuseTexture = new BABYLON.Texture(TEXTURES.box, scene);
    } else {
        cargoMat.diffuseColor = BABYLON.Color3.FromHexString(colorHex);
    }

    cargoMesh.material = cargoMat;

    // Habilitar bordes para la caja
    cargoMesh.enableEdgesRendering();
    cargoMesh.edgesWidth = 2.0;
    cargoMesh.edgesColor = new BABYLON.Color4(0.015, 0.117, 0.258, 1); // Color azul oscuro

    // Almacenar el color original para la detección de colisiones
    cargoMesh.metadata = {
        type: type,
        id: cargoIdCounter++,
        ...dims, // Copia todas las propiedades de dims (l, w, h o diameter, height)
        // MODIFICADO: Guardar color o textura para restaurarlo después
        originalColor: theme === 'moderno' ? cargoMat.diffuseColor.clone() : null,
        originalTexture: theme === 'aduana' ? cargoMat.diffuseTexture : null
    };

    // Deshabilitar el input de color si estamos en modo aduana
    document.getElementById('box-color').disabled = (theme === 'aduana');

    boxes.push(cargoMesh);
    updateBoxList();
    updateStats();
    checkCollisions();
}

function createPallet(scene, position) {
    const pallet = BABYLON.MeshBuilder.CreateBox("pallet", {
        width: PALLET_DIMENSIONS.l,
        height: PALLET_DIMENSIONS.h,
        depth: PALLET_DIMENSIONS.w
    }, scene);

    pallet.position = position;
    pallet.isPickable = false;
    const palletMat = new BABYLON.StandardMaterial("palletMat", scene);
    palletMat.diffuseColor = new BABYLON.Color3(0.6, 0.4, 0.2); // Color madera
    pallet.material = palletMat;
    return pallet
}

/**
 * Elimina todas las cajas de la escena.
 */
function clearBoxes() {
    boxes.forEach(box => {
        box.dispose();
    });
    boxes = [];
    cargoIdCounter = 0;
     pallets.forEach(pallet => {
        pallet.dispose();
    });
    pallets = [];
    updateBoxList();
    updateStats();
}



/**
 * Comprueba colisiones entre todas las cajas.
 */
function checkCollisions() {
    // 1. Restaurar color original de todas las cajas
    boxes.forEach(box => {
        // MODIFICADO: Restaurar color o textura según corresponda
        if (box.metadata.originalColor) {
            (box.material).diffuseColor = box.metadata.originalColor;
        }
        if (box.metadata.originalTexture) {
            (box.material).diffuseTexture = box.metadata.originalTexture;
        }
    });

    // 2. Comprobar intersecciones entre cajas
    for (let i = 0; i < boxes.length; i++) {
        for (let j = i + 1; j < boxes.length; j++) {
            // MODIFICADO: El segundo parámetro 'true' habilita la comprobación precisa,
            // que es crucial para formas no cúbicas como los cilindros.
            if (boxes[i].intersectsMesh(boxes[j], true)) {
                // Si hay colisión, pintar ambas de rojo
                const collisionColor = BABYLON.Color3.Red();
                boxes[i].material.diffuseTexture = null; // Quitar textura para mostrar color de colisión
                boxes[i].material.diffuseColor = collisionColor;
                boxes[j].material.diffuseColor = collisionColor;
                boxes[j].material.diffuseTexture = null;
            }
        }
    }

    // Opcional: Comprobar si las cajas están dentro del contenedor
    // Esto es más complejo y requeriría una lógica de bounding box más detallada.
}

function deleteSelectedBox() {
    if (selectedMesh) {
        const boxToDelete = selectedMesh;
        deselectObject();
        boxToDelete.dispose(); // Eliminar la malla de la escena y liberar recursos
        boxes = boxes.filter(box => box !== boxToDelete);
        updateBoxList();
        updateStats();
        checkCollisions();
    }
}

/* ========== UI & UTILS ========== */
const tooltip = document.getElementById('tooltip');

const ui = {
    contL: document.getElementById('cont-l'),
    contW: document.getElementById('cont-w'),
    contH: document.getElementById('cont-h'),
    cargoType: document.getElementById('cargo-type'),
    boxDimsGroup: document.getElementById('box-dims-group'),
    cylDimsGroup: document.getElementById('cylinder-dims-group'),
    boxL: document.getElementById('box-l'),
    boxW: document.getElementById('box-w'),
    boxH: document.getElementById('box-h'),
    boxQty: document.getElementById('box-qty'),
    boxColor: document.getElementById('box-color'),
    palletQty: document.getElementById('pallet-qty'),
    // --- CORRECCIÓN 2: Eliminar la referencia al botón 'addBtn' que ya no existe ---
    addBatchBtn: document.getElementById('addBatchBtn'), // NUEVO
    loadAllBtn: document.getElementById('loadAllBtn'), // NUEVO
    clearBtn: document.getElementById('clearBtn'),
    deleteBtn: document.getElementById('deleteBtn'),
    statsEl: document.getElementById('stats'),
    boxListEl: document.getElementById('lista-cajas'),
};

function updateStats() {
    const containerDims = container.metadata;


    const containerVolume = containerDims.l * containerDims.w * containerDims.h;
    const boxesVolume = boxes.reduce((acc, box) => {
        const meta = box.metadata;
        let volume = 0;
        if (meta.type === 'box') {
            volume = meta.l * meta.w * meta.h;
        } else if (meta.type === 'cylinder') {
            volume = Math.PI * Math.pow(meta.diameter / 2, 2) * meta.height;
        }
        return acc + volume;
    }, 0);
    const palletsVolume = pallets.length * PALLET_DIMENSIONS.l * PALLET_DIMENSIONS.w * PALLET_DIMENSIONS.h;

    const totalVolume = boxesVolume + palletsVolume;

    const occupation = containerVolume > 0 ? (boxesVolume / containerVolume) * 100 : 0;

    ui.statsEl.innerHTML = `
        <div><span>Volumen Contenedor:</span><strong>${containerVolume.toFixed(2)} m³</strong></div>
        <div><span>Volumen Ocupado:</span><strong>${boxesVolume.toFixed(2)} m³</strong></div>
        <div><span>Ocupación:</span><strong>${occupation.toFixed(1)} %</strong></div>
        <div><span>Cajas Totales:</span><strong>${boxes.length}</strong></div>
    `;
}

function updateBoxList() {
    if (boxes.length === 0) {
        ui.boxListEl.innerHTML = `<p class="muted">No hay carga en la escena.</p>`;
        return;
    }

    ui.boxListEl.innerHTML = boxes.map(box => {
        const meta = box.metadata;
        const isSelected = selectedMesh === box;
        const name = meta.type === 'box' ? 'Caja' : 'Cilindro';
        const dimsText = meta.type === 'box'
            ? `${meta.l}x${meta.w}x${meta.h} m`
            : `Ø${meta.diameter} x ${meta.height} m`;
        return `
            <div class="box-item ${isSelected ? 'selected' : ''}" data-id="${meta.id}">
                <div class="box-color" style="background-color:${
                    meta.originalColor ? meta.originalColor.toHexString() : '#8B4513' // Usar color original o un color por defecto para textura
                };"></div>
                <div>
                    <strong>${name} #${meta.id}</strong>
                    <small>${dimsText}</small>
                </div>
            </div>
        `;
    }).join('');

    // Add event listeners to list items for selection
    ui.boxListEl.querySelectorAll('.box-item').forEach(item => {
        item.addEventListener('click', (e) => {
            const id = parseInt(e.currentTarget.dataset.id);
            const box = boxes.find(b => b.metadata.id === id);
            if (box) {
                selectObject(box);
            }
        });
    });
}

/**
 * NUEVO: Añade el lote definido a la lista de `batchesToLoad`.
 */
function addBatchToList() {
    const cargoType = ui.cargoType.value;
    let dims;
    if (cargoType === 'box') {
        dims = { l: parseFloat(ui.boxL.value), w: parseFloat(ui.boxW.value), h: parseFloat(ui.boxH.value) };
    } else {
        dims = { diameter: parseFloat(ui.cylDiameter.value), height: parseFloat(ui.cylHeight.value) };
    }
    const qty = parseInt(ui.boxQty.value);
    const color = ui.boxColor.value;

    const batch = { type: cargoType, dims, qty, color, id: Date.now() };
    batchesToLoad.push(batch);
    renderBatchList();
}

/**
 * NUEVO: Renderiza la lista de lotes en el panel.
 */
function renderBatchList() {
    const batchListEl = document.getElementById('batch-list');
    if (batchesToLoad.length === 0) {
        batchListEl.innerHTML = `<p class="muted">Aún no has añadido lotes.</p>`;
        return;
    }

    batchListEl.innerHTML = batchesToLoad.map(batch => {
        const dimsText = batch.type === 'box'
            ? `${batch.dims.l}x${batch.dims.w}x${batch.dims.h}`
            : `Ø${batch.dims.diameter}x${batch.dims.height}`;
        return `
            <div class="batch-item" data-batch-id="${batch.id}">
                <div class="batch-item-details">
                    <div class="batch-item-color" style="background-color: ${batch.color};"></div>
                    <span><b>${batch.qty}x</b> ${batch.type === 'box' ? 'Cajas' : 'Cilindros'} de ${dimsText}m</span>
                </div>
                <button onclick="removeBatch(${batch.id})" style="width: auto; padding: 2px 6px; font-size: 10px;" class="secondary">X</button>
            </div>
        `;
    }).join('');
}

window.removeBatch = function(batchId) {
    batchesToLoad = batchesToLoad.filter(b => b.id !== batchId);
    renderBatchList();
}

/* ========== INICIALIZACIÓN Y BUCLE PRINCIPAL (MOVED TO BOTTOM) ========== */

// Bucle de renderizado
engine.runRenderLoop(function () {
    scene.render();
});

/* ========== EVENT LISTENERS DE LA INTERFAZ ========== */
document.addEventListener('DOMContentLoaded', () => {


    // Actualizar contenedor
 const ui = {
        cargoType: document.getElementById('cargo-type'),
        boxDimsGroup: document.getElementById('box-dims-group'),
        cylDimsGroup: document.getElementById('cylinder-dims-group'),
        cylDiameter: document.getElementById('cyl-diameter'),
        cylHeight: document.getElementById('cyl-height'),
        boxL: document.getElementById('box-l'),
        boxW: document.getElementById('box-w'),
        boxColor: document.getElementById('box-color'),
        addBatchBtn: document.getElementById('addBatchBtn'),
        loadAllBtn: document.getElementById('loadAllBtn'),
        boxQty: document.getElementById('box-qty'),
        clearBtn: document.getElementById('clearBtn'),
        deleteBtn: document.getElementById('deleteBtn'),
        contL: document.getElementById('cont-l'),
        contW: document.getElementById('cont-w'),
        contH: document.getElementById('cont-h'),
        palletQty: document.getElementById('pallet-qty'),
        themeSelector: document.getElementById('theme-selector'), // NUEVO
    };
    [ui.contL, ui.contW, ui.contH].forEach(el => {
        el.addEventListener('change', () => {
            createContainer(scene, { l: parseFloat(ui.contL.value), w: parseFloat(ui.contW.value), h: parseFloat(ui.contH.value) });
            updateStats();
            checkCollisions();
        });
    });

    // Listener para cambiar el tipo de carga y mostrar/ocultar inputs
    ui.cargoType.addEventListener('change', (e) => {
        const isBox = e.target.value === 'box';
        ui.boxDimsGroup.classList.toggle('hidden', !isBox);
        ui.cylDimsGroup.classList.toggle('hidden', isBox);
    });





    // NUEVO: Listener para cambiar el tema visual
    ui.themeSelector.addEventListener('change', () => {
        // Forzar la recreación de todos los elementos con el nuevo estilo
        createContainer(scene, { l: parseFloat(ui.contL.value), w: parseFloat(ui.contW.value), h: parseFloat(ui.contH.value) });
        clearBoxes(); // Limpia las cajas para que las nuevas se creen con el estilo correcto
        document.getElementById('box-color').disabled = (ui.themeSelector.value === 'aduana');
    })

    // --- NUEVA LÓGICA DE BOTONES ---
    ui.addBatchBtn.addEventListener('click', addBatchToList);

    ui.loadAllBtn.addEventListener('click', () => {
        clearBoxes(); // Limpiar la escena antes de cargar los nuevos lotes
        loadAllBatches();
        batchesToLoad = []; // Vaciar la lista después de cargar
        renderBatchList();
    });

    /**
     * NUEVO: Algoritmo principal para cargar todos los lotes de la lista.
     */
    function loadAllBatches() {
        const containerDims = container.metadata;
        let nextAvailablePosition = null; // El "cursor" que rastrea dónde colocar la siguiente caja

        batchesToLoad.forEach(batch => {
            const { type, dims, qty, color } = batch;
            const cargoWidth = type === 'box' ? dims.w : dims.diameter;
            const cargoLength = type === 'box' ? dims.l : dims.diameter;
            const cargoHeight = type === 'box' ? dims.h : dims.height;

            const stepX = cargoLength + 0.01;
            const stepZ = cargoWidth + 0.01;
            const stepY = cargoHeight + 0.01;

            // Si es el primer lote, inicializamos la posición. Si no, usamos la última conocida.
            if (!nextAvailablePosition) {
                nextAvailablePosition = {
                    x: -containerDims.l / 2 + cargoLength / 2,
                    y: cargoHeight / 2,
                    z: -containerDims.w / 2 + cargoWidth / 2,
                };
            }

            for (let i = 0; i < qty; i++) {
                // Verificar si la caja cabe en la posición actual
                if (nextAvailablePosition.x + cargoLength / 2 > containerDims.l / 2) {
                    // No cabe en X, mover a la siguiente fila (Z)
                    nextAvailablePosition.z += stepZ;
                    nextAvailablePosition.x = -containerDims.l / 2 + cargoLength / 2; // Reiniciar X
                }

                if (nextAvailablePosition.z + cargoWidth / 2 > containerDims.w / 2) {
                    // No cabe en Z, mover a la siguiente capa (Y)
                    nextAvailablePosition.y += stepY;
                    nextAvailablePosition.x = -containerDims.l / 2 + cargoLength / 2; // Reiniciar X
                    nextAvailablePosition.z = -containerDims.w / 2 + cargoWidth / 2; // Reiniciar Z
                }

                if (nextAvailablePosition.y + cargoHeight / 2 > containerDims.h) {
                    console.warn(`No hay más espacio en el contenedor para el lote actual. Se detiene la carga.`);
                    Swal.fire('Contenedor Lleno', 'No se pudieron cargar todos los lotes por falta de espacio.', 'warning');
                    return; // Salir del bucle forEach del lote actual
                }

                let yOffset = pallets.length > 0 ? PALLET_DIMENSIONS.h : 0;
                createCargo(scene, new BABYLON.Vector3(nextAvailablePosition.x, nextAvailablePosition.y + yOffset, nextAvailablePosition.z), dims, color, type);

                // Mover el cursor a la siguiente posición en la fila actual (X)
                nextAvailablePosition.x += stepX;
            }
        });
    }

    ui.clearBtn.addEventListener('click', () => {
        clearBoxes();
        batchesToLoad = []; // Limpiar también la lista de lotes
        renderBatchList();
    });

     ui.palletQty.addEventListener('change', () => {
        const qty = parseInt(ui.palletQty.value);
        createPallets(scene, qty);
        updateStats();
        checkCollisions();
    });

    ui.deleteBtn.addEventListener('click', () => {
        deleteSelectedBox();
    });

    // Ajustar el tamaño del canvas al cambiar el tamaño de la ventana
    window.addEventListener("resize", function () {
        engine.resize();
    });

    // --- LÓGICA DEL PANEL COLAPSABLE ---
    const appContainer = document.getElementById('app');
    const toggleBtn = document.getElementById('panel-toggle-btn');
    const orientationBtn = document.getElementById('orientation-toggle-btn');

    // Comprobar si el panel debe estar colapsado por defecto (definido en CSS)
    const initialPanelState = getComputedStyle(appContainer).getPropertyValue('--initial-panel-state').trim();
    if (initialPanelState === "'collapsed'") {
        appContainer.classList.add('panel-collapsed');
        toggleBtn.textContent = '›';
    }

    toggleBtn.addEventListener('click', () => {
        appContainer.classList.toggle('panel-collapsed');
        const isCollapsed = appContainer.classList.contains('panel-collapsed');
        toggleBtn.textContent = isCollapsed ? '›' : '‹';
        // Dar tiempo a la animación CSS para que termine antes de redimensionar el canvas
        setTimeout(() => {
            engine.resize();
        }, 300);
    });

    // --- LÓGICA DE CAMBIO DE ORIENTACIÓN ---
    orientationBtn.addEventListener('click', () => {
        appContainer.classList.toggle('horizontal-layout');
        // Dar tiempo a la animación CSS para que termine antes de redimensionar el canvas
        setTimeout(() => {
            engine.resize();
        }, 300);
    });
});
