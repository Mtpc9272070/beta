// yarvis_guide.js - Módulo para el asistente flotante de Yarvis

let guideSession = null;
let onOptionClickCallback = null;

function createGuideUI() {
    const guideContainer = document.createElement('div');
    guideContainer.id = 'yarvis-guide-container';
    guideContainer.className = 'fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2';
    guideContainer.innerHTML = `
        <!-- Opciones de respuesta (inicialmente ocultas) -->
        <div id="yarvis-guide-options" class="flex flex-col items-end gap-2"></div>

        <!-- Botón principal de Yarvis -->
        <div id="yarvis-guide-bubble" class="relative bg-indigo-600 text-white w-16 h-16 rounded-full shadow-2xl flex items-center justify-center cursor-pointer transform hover:scale-110 transition-transform">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3c7.2 0 9 1.8 9 9s-1.8 9-9 9-9-1.8-9-9 1.8-9 9-9z"></path><path d="M20.62 5.23a.5.5 0 0 0-.84 0l-1.03 1.03a.5.5 0 0 0 0 .7.5.5 0 0 0 .7 0l1.04-1.03a.5.5 0 0 0 .13-.7z"></path><path d="M12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12z"></path></svg>
            
            <!-- Burbuja de mensaje -->
            <div id="yarvis-guide-message" class="absolute bottom-full right-0 mb-2 w-64 bg-white text-gray-800 p-3 rounded-lg shadow-xl border border-gray-200 text-sm hidden">
                <p>...</p>
                <div class="absolute bottom-0 right-4 w-0 h-0 border-l-8 border-l-transparent border-r-8 border-r-transparent border-t-8 border-t-white -mb-2"></div>
            </div>
        </div>
    `;
    document.body.appendChild(guideContainer);

    document.getElementById('yarvis-guide-bubble').addEventListener('click', () => {
        document.getElementById('yarvis-guide-message').classList.toggle('hidden');
    });
}

function showMessage(message, options = []) {
    const messageBubble = document.getElementById('yarvis-guide-message');
    const optionsContainer = document.getElementById('yarvis-guide-options');

    if (message) {
        messageBubble.querySelector('p').textContent = message;
        messageBubble.classList.remove('hidden');
    } else {
        messageBubble.classList.add('hidden');
    }

    optionsContainer.innerHTML = '';
    if (options.length > 0) {
        options.forEach(opt => {
            const btn = document.createElement('button');
            btn.className = 'bg-white text-indigo-700 text-sm font-semibold px-4 py-2 rounded-full shadow-lg border border-gray-200 hover:bg-indigo-50';
            btn.textContent = opt.text;
            btn.onclick = () => {
                if (onOptionClickCallback) {
                    onOptionClickCallback(opt.value);
                }
                // Ocultar opciones después de hacer clic
                optionsContainer.innerHTML = '';
            };
            optionsContainer.appendChild(btn);
        });
    }
}

function executeCurrentStep() {
    if (!guideSession || guideSession.currentStep >= guideSession.steps.length) {
        endGuide();
        return;
    }

    const step = guideSession.steps[guideSession.currentStep];
    showMessage(step.message, step.options);
}

export function advanceGuide() {
    if (!guideSession) return;
    guideSession.currentStep++;
    sessionStorage.setItem('yarvisGuideSession', JSON.stringify(guideSession));
    executeCurrentStep();
}

export function endGuide() {
    const container = document.getElementById('yarvis-guide-container');
    if (container) {
        container.remove();
    }
    sessionStorage.removeItem('yarvisGuideSession');
}

export function initGuide(optionCallback) {
    const sessionData = sessionStorage.getItem('yarvisGuideSession');
    if (!sessionData) {
        return; // No hay guía activa
    }

    guideSession = JSON.parse(sessionData);
    onOptionClickCallback = optionCallback;

    if (guideSession.active) {
        createGuideUI();
        executeCurrentStep();
    }
}

export function updateGuideMessage(message, options = []) {
    showMessage(message, options);
}