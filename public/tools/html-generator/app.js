// ══════════════════════════════════════════════
//  Signaturit Email Template Generator - App JS
// ══════════════════════════════════════════════

// Variables oficiales de Signaturit
let variables = [
    'sender_email',
    'sign_button',
    'validate_button',
    'signer_name',
    'signer_email',
    'filename',
    'logo',
    'remaining_time',
    'email_button',
    'email_body',
    'code',
    'reason',
    'dashboard_button',
    'signers'
];

// Descripciones de variables oficiales
const variableDescriptions = {
    'sender_email': 'Email del remitente',
    'sign_button': 'Boton de Signaturit (solo signatures_request y pending_sign)',
    'validate_button': 'Boton de validar documento (solo validation_request)',
    'signer_name': 'Nombre del firmante',
    'signer_email': 'Email del firmante',
    'filename': 'Nombre del archivo (o archivos)',
    'logo': 'Logo actual',
    'remaining_time': 'Fecha de expiracion del documento (solo pending_sign)',
    'email_button': 'Boton de Signaturit (solo emails_request)',
    'email_body': 'Texto del parametro body (solo signatures_request)',
    'code': 'Codigo SMS (solo sms_verify y sms_validate)',
    'reason': 'Razon por la que se rechazo la firma (solo document_declined)',
    'dashboard_button': 'Boton para ver detalles en dashboard (solo document_declined)',
    'signers': 'Nombre y email del firmante en formato NOMBRE - EMAIL (solo signed_document)'
};

// Valores por defecto
const defaults = {
    logoUrl: '',
    logoWidth: '300px',
    logoHeight: 'auto',
    logoObjectFit: 'none',
    emailContent: 'Estimado/a {{signer_name}}, le hacemos llegar la siguiente documentacion para firmar:\n\n{{filename}}\n\nPara proceder con la revision de la documentacion presione el siguiente boton:\n\n{{sign_button}}\n\n{{email_body}}',
    bgColor: '#ffffff',
    bgColorOpacity: '1',
    containerColor: '#ffffff',
    containerColorOpacity: '1',
    borderColor: '#cccccc',
    borderColorOpacity: '1',
    textColor: '#153643',
    textColorOpacity: '1',
    buttonColor: '#070707',
    buttonColorOpacity: '1',
    buttonTextColor: '#ffffff',
    buttonTextColorOpacity: '1',
    buttonBorderColor: '#070707',
    buttonBorderColorOpacity: '1',
    buttonBorderWidth: '0',
    buttonBorderRadius: '20',
    buttonPaddingTop: '15',
    buttonPaddingRight: '15',
    buttonPaddingBottom: '15',
    buttonPaddingLeft: '15',
    buttonMarginTop: '10',
    buttonMarginRight: '0',
    buttonMarginBottom: '10',
    buttonMarginLeft: '0',
    buttonWidth: '200'
};

// Todos los tipos de template posibles
const ALL_TEMPLATE_TYPES = [
    'sign_request',
    'signatures_request',
    'signatures_receipt',
    'request_expired',
    'pending_sign',
    'document_canceled',
    'emails_request',
    'validation_request',
    'signed_document',
    'document_declined',
    'request_expired_requester'
];

// Magic words obligatorias por tipo de template
const REQUIRED_MAGIC_WORDS = {
    signatures_request: ['{{sign_button}}'],
    pending_sign: ['{{sign_button}}'],
    emails_request: ['{{email_button}}'],
    validation_request: ['{{validate_button}}']
};

// ── Estado global ──
let apiBrandings = [];
let selectedBrandingId = null;
let isNewBranding = false;
let currentPage = 1;
const ITEMS_PER_PAGE = 10;

// ── Proxy (Edge Function en Supabase) ──
// La Edge Function solo acepta POST. Para GET/PATCH se usa x-method-override.
const PROXY_URL = 'https://plejrqzzxnypnxxnamxj.supabase.co/functions/v1/signaturit-proxy';

const SIGNATURIT_URLS = {
    sandbox: 'https://api.sandbox.signaturit.com/v3',
    production: 'https://api.signaturit.com/v3'
};

function getSignaturitUrl(path) {
    const env = document.getElementById('apiEnvironment').value;
    const base = SIGNATURIT_URLS[env] || SIGNATURIT_URLS.sandbox;
    return base + path;
}

function getToken() {
    return document.getElementById('apiToken').value.trim();
}

// Wrapper: todas las llamadas pasan por POST al proxy
async function apiCall(method, path, body) {
    const headers = {
        'x-signaturit-token': getToken(),
        'x-api-url': getSignaturitUrl(path),
    };

    if (method !== 'POST') {
        headers['x-method-override'] = method;
    }

    const fetchOptions = {
        method: 'POST',
        headers: headers
    };

    if (body) {
        fetchOptions.body = body;
        if (body instanceof URLSearchParams) {
            headers['Content-Type'] = 'application/x-www-form-urlencoded';
        }
    }

    const response = await fetch(PROXY_URL, fetchOptions);

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error('HTTP ' + response.status + ': ' + errorText);
    }

    return response.json();
}

// ═══════════════════════════════════
//  NAVEGACION DE VISTAS
// ═══════════════════════════════════

function showView(viewId) {
    document.querySelectorAll('.view').forEach(v => v.style.display = 'none');
    document.getElementById(viewId).style.display = '';
}

function goToDashboard() {
    selectedBrandingId = null;
    isNewBranding = false;
    renderBrandingsPage();
    showView('viewDashboard');
}

function goToEditorNew() {
    selectedBrandingId = null;
    isNewBranding = true;

    document.getElementById('editorBrandingName').value = 'Nuevo Branding';
    document.getElementById('editorBrandingId').textContent = '';
    document.getElementById('newBrandingNameGroup').style.display = 'block';
    document.getElementById('newBrandingName').value = '';
    document.getElementById('templateTypeGroup').style.display = 'block';

    resetToDefault(true);
    initEditorListeners();
    showView('viewEditor');
}

async function goToEditorExisting(brandingId) {
    const branding = apiBrandings.find(b => b.id === brandingId);
    if (!branding) return;

    selectedBrandingId = brandingId;
    isNewBranding = false;

    const templatesArr = branding.templates || [];
    const firstTplName = templatesArr.length > 0 ? templatesArr[0].name : null;
    document.getElementById('editorBrandingName').value = branding.name || firstTplName || 'Sin nombre';
    document.getElementById('editorBrandingId').textContent = branding.id;
    document.getElementById('newBrandingNameGroup').style.display = 'none';
    document.getElementById('templateTypeGroup').style.display = 'none';

    // Cargar colores del branding si existen
    if (branding.text_color) {
        setColorField('textColor', branding.text_color);
    }
    if (branding.layout_color) {
        setColorField('bgColor', branding.layout_color);
    }

    initEditorListeners();
    showView('viewEditor');

    // Cargar template content desde la API
    try {
        const fullBranding = await apiCall('GET', '/brandings/' + brandingId + '.json');
        const templatesArray = fullBranding.templates || [];

        if (templatesArray.length > 0) {
            // Tomar el primer template del array (generalmente sign_request)
            const firstTemplate = templatesArray[0];
            const loadedType = firstTemplate.name;
            const templateHTML = firstTemplate.content;

            // Setear el dropdown al tipo detectado
            if (loadedType) {
                document.getElementById('templateType').value = loadedType;
            }

            if (templateHTML) {
                try {
                    parseHTMLTemplate(templateHTML);
                } catch (e) {
                    document.getElementById('emailContent').value = templateHTML;
                    updatePreview();
                }
                showToast('Template "' + loadedType + '" cargado');
            } else {
                updatePreview();
            }
        } else {
            updatePreview();
        }

        // Actualizar colores desde el branding completo
        if (fullBranding.text_color) {
            setColorField('textColor', fullBranding.text_color);
        }
        if (fullBranding.layout_color) {
            setColorField('bgColor', fullBranding.layout_color);
        }
    } catch (error) {
        console.error('Error loading branding templates:', error);
        showToast('Branding cargado (sin templates)');
        updatePreview();
    }
}

// ═══════════════════════════════════
//  API: CONECTAR
// ═══════════════════════════════════

async function connectAPI() {
    const token = document.getElementById('apiToken').value.trim();
    if (!token) {
        showLoginError('Ingresa un access token');
        return;
    }

    const btn = document.getElementById('btnConnect');
    btn.disabled = true;
    btn.textContent = 'Conectando...';
    hideLoginError();

    try {
        apiBrandings = await apiCall('GET', '/brandings.json');
        currentPage = 1;

        // Update dashboard info
        const env = document.getElementById('apiEnvironment').value;
        document.getElementById('dashboardEnv').textContent = env === 'sandbox' ? 'Sandbox' : 'Production';
        document.getElementById('dashboardCount').textContent = apiBrandings.length;

        renderBrandingsPage();
        showView('viewDashboard');
        showToast('Conectado - ' + apiBrandings.length + ' brandings encontrados');
    } catch (error) {
        console.error('API Error:', error);
        showLoginError('Error de conexion: ' + error.message);
        btn.disabled = false;
        btn.textContent = 'Conectar';
    }
}

function disconnectAPI() {
    apiBrandings = [];
    selectedBrandingId = null;
    isNewBranding = false;
    currentPage = 1;

    const btn = document.getElementById('btnConnect');
    btn.disabled = false;
    btn.textContent = 'Conectar';

    showView('viewLogin');
    showToast('Desconectado');
}

function showLoginError(msg) {
    const el = document.getElementById('loginError');
    el.textContent = msg;
    el.style.display = 'block';
}

function hideLoginError() {
    document.getElementById('loginError').style.display = 'none';
}

// ═══════════════════════════════════
//  DASHBOARD: RENDER BRANDINGS
// ═══════════════════════════════════

function renderBrandingsPage() {
    const grid = document.getElementById('brandingsGrid');
    const totalPages = Math.max(1, Math.ceil(apiBrandings.length / ITEMS_PER_PAGE));

    if (currentPage > totalPages) currentPage = totalPages;

    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    const end = start + ITEMS_PER_PAGE;
    const pageBrandings = apiBrandings.slice(start, end);

    if (pageBrandings.length === 0) {
        grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 60px 20px; color: #9ca3af;">' +
            '<p style="font-size: 16px; margin-bottom: 8px;">No hay brandings</p>' +
            '<p style="font-size: 13px;">Crea uno nuevo para empezar</p>' +
            '</div>';
        renderPagination(totalPages);
        return;
    }

    let html = '';
    pageBrandings.forEach(b => {
        const templatesArray = b.templates || [];
        const firstTemplateName = templatesArray.length > 0 ? templatesArray[0].name : null;
        const name = b.name || firstTemplateName || 'Sin nombre';
        const initial = name.charAt(0).toUpperCase();

        // Convertir array [{name, content}] a map {name: content}
        const templatesMap = {};
        templatesArray.forEach(t => {
            if (t && t.name) templatesMap[t.name] = t.content || '';
        });

        // Contar templates con contenido
        const configuredTemplates = ALL_TEMPLATE_TYPES.filter(t => templatesMap[t]);
        const totalConfigured = configuredTemplates.length;

        // Badges de templates
        let badgesHTML = '';
        ALL_TEMPLATE_TYPES.forEach(t => {
            const hasContent = !!templatesMap[t];
            const cls = hasContent ? 'has-content' : 'empty';
            const shortName = t.replace('signatures_', 'sig_').replace('request_expired', 'req_exp').replace('_requester', '_req');
            badgesHTML += '<span class="template-badge ' + cls + '">' + shortName + '</span>';
        });

        html += '<div class="branding-card" onclick="goToEditorExisting(\'' + b.id + '\')">' +
            '<div class="branding-card-header">' +
                '<div class="branding-card-icon">' + initial + '</div>' +
                '<div class="branding-card-title">' +
                    '<div class="branding-card-name">' + escapeHTML(name) + '</div>' +
                    '<div class="branding-card-id">' + b.id + '</div>' +
                '</div>' +
            '</div>' +
            '<div class="branding-card-templates">' + badgesHTML + '</div>' +
            '<div class="branding-card-footer">' +
                '<span class="branding-card-meta">' + totalConfigured + '/' + ALL_TEMPLATE_TYPES.length + ' templates</span>' +
                '<span class="branding-card-action">Editar &rarr;</span>' +
            '</div>' +
        '</div>';
    });

    grid.innerHTML = html;
    renderPagination(totalPages);
}

function renderPagination(totalPages) {
    const container = document.getElementById('pagination');

    if (totalPages <= 1) {
        container.innerHTML = '';
        return;
    }

    let html = '<button class="pagination-btn" onclick="changePage(' + (currentPage - 1) + ')"' +
        (currentPage === 1 ? ' disabled' : '') + '>&laquo; Anterior</button>';

    for (let i = 1; i <= totalPages; i++) {
        html += '<button class="pagination-btn' + (i === currentPage ? ' active' : '') + '" onclick="changePage(' + i + ')">' + i + '</button>';
    }

    html += '<button class="pagination-btn" onclick="changePage(' + (currentPage + 1) + ')"' +
        (currentPage === totalPages ? ' disabled' : '') + '>Siguiente &raquo;</button>';

    container.innerHTML = html;
}

function changePage(page) {
    currentPage = page;
    renderBrandingsPage();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// ═══════════════════════════════════
//  API: CARGAR TEMPLATE
// ═══════════════════════════════════

async function loadTemplateFromAPI() {
    if (isNewBranding || !selectedBrandingId) {
        showToast('Selecciona un branding existente para cargar');
        return;
    }

    try {
        const branding = await apiCall('GET', '/brandings/' + selectedBrandingId + '.json');
        const templateType = document.getElementById('templateType').value;
        const templatesArray = branding.templates || [];

        // Buscar el template por nombre en el array
        const found = templatesArray.find(t => t.name === templateType);

        if (found && found.content) {
            try {
                parseHTMLTemplate(found.content);
                showToast('Template "' + templateType + '" cargado desde branding');
            } catch (e) {
                document.getElementById('emailContent').value = found.content;
                updatePreview();
                showToast('Template cargado (sin parsear estructura)');
            }
        } else if (templatesArray.length > 0) {
            // Si no existe el tipo seleccionado, cargar el primero disponible
            const first = templatesArray[0];
            document.getElementById('templateType').value = first.name;
            try {
                parseHTMLTemplate(first.content);
                showToast('Template "' + first.name + '" cargado (auto-detectado)');
            } catch (e) {
                document.getElementById('emailContent').value = first.content;
                updatePreview();
                showToast('Template "' + first.name + '" cargado');
            }
        } else {
            showToast('Este branding no tiene templates');
        }

        if (branding.text_color) {
            setColorField('textColor', branding.text_color);
        }
        if (branding.layout_color) {
            setColorField('bgColor', branding.layout_color);
        }

    } catch (error) {
        console.error('Error loading template:', error);
        showToast('Error al cargar template: ' + error.message);
    }
}

function setColorField(fieldId, hexColor) {
    const picker = document.getElementById(fieldId);
    const textInput = document.getElementById(fieldId + 'Value');
    if (picker && hexColor && hexColor.startsWith('#')) {
        picker.value = hexColor;
        if (textInput) textInput.value = hexColor;
    }
}

// ═══════════════════════════════════
//  API: GUARDAR TEMPLATE (POST / PATCH)
// ═══════════════════════════════════

async function saveTemplateToAPI() {
    const templateType = document.getElementById('templateType').value;

    // Validar magic words obligatorias
    const requiredWords = REQUIRED_MAGIC_WORDS[templateType];
    if (requiredWords) {
        let html = generateHTML();
        const shouldMinify = document.getElementById('minifyHTML').checked;
        if (shouldMinify) {
            html = minifyHTML(html);
        }

        const missing = requiredWords.filter(w => !html.includes(w));
        if (missing.length > 0) {
            showToast('Faltan variables obligatorias: ' + missing.join(', '));
            return;
        }
    }

    if (isNewBranding) {
        const name = document.getElementById('newBrandingName').value.trim();
        if (!name) {
            showToast('Ingresa un nombre para el nuevo branding');
            return;
        }
        showConfirmPushModal('POST', templateType, name, null);
    } else if (selectedBrandingId) {
        const brandingName = document.getElementById('editorBrandingName').value;
        showConfirmPushModal('PATCH', templateType, brandingName, selectedBrandingId);
    } else {
        showToast('Selecciona un branding o crea uno nuevo');
    }
}

function showConfirmPushModal(method, templateType, brandingName, brandingId) {
    const env = document.getElementById('apiEnvironment').value;
    const envLabel = env === 'production' ? 'PRODUCTION' : 'Sandbox';
    const methodClass = method.toLowerCase();

    let details = '<div style="margin-bottom: 10px;">' +
        '<span class="confirm-label">Accion:</span> ' +
        '<span class="confirm-method ' + methodClass + '">' + method + '</span> ' +
        (method === 'POST' ? 'Crear nuevo branding' : 'Actualizar branding existente') +
        '</div>';

    details += '<div style="margin-bottom: 6px;">' +
        '<span class="confirm-label">Branding:</span> ' + escapeHTML(brandingName) +
        '</div>';

    if (brandingId) {
        details += '<div style="margin-bottom: 6px;">' +
            '<span class="confirm-label">ID:</span> <span class="confirm-value">' + brandingId + '</span>' +
            '</div>';
    }

    details += '<div style="margin-bottom: 6px;">' +
        '<span class="confirm-label">Template:</span> <span class="confirm-value">' + templateType + '</span>' +
        '</div>';

    details += '<div>' +
        '<span class="confirm-label">Entorno:</span> <span style="font-weight:600;' +
        (env === 'production' ? 'color:#dc2626;"' : 'color:#2563eb;"') + '>' + envLabel + '</span>' +
        '</div>';

    document.getElementById('confirmPushDetails').innerHTML = details;

    // Guardar datos para ejecutar despues
    window._pendingPush = { method, templateType, brandingId };

    document.getElementById('confirmPushModal').classList.add('show');
}

function closeConfirmPushModal() {
    document.getElementById('confirmPushModal').classList.remove('show');
    window._pendingPush = null;
}

async function executeConfirmedPush() {
    const pending = window._pendingPush;
    if (!pending) return;

    closeConfirmPushModal();

    if (pending.method === 'POST') {
        await createNewBranding(pending.templateType);
    } else {
        await updateExistingBranding(pending.brandingId, pending.templateType);
    }
}

async function createNewBranding(templateType) {
    const name = document.getElementById('newBrandingName').value.trim();
    if (!name) {
        showToast('Ingresa un nombre para el nuevo branding');
        return;
    }

    let html = generateHTML();
    const shouldMinify = document.getElementById('minifyHTML').checked;
    if (shouldMinify) {
        html = minifyHTML(html);
    }

    const body = new URLSearchParams();
    body.append('name', name);
    body.append('templates[' + templateType + ']', html);
    body.append('text_color', document.getElementById('textColor').value);
    body.append('layout_color', document.getElementById('bgColor').value);

    try {
        const result = await apiCall('POST', '/brandings.json', body);
        showToast('Branding "' + name + '" creado con ID: ' + result.id.substring(0, 8) + '...');

        // Recargar lista de brandings
        try {
            apiBrandings = await apiCall('GET', '/brandings.json');
            document.getElementById('dashboardCount').textContent = apiBrandings.length;
        } catch (e) { /* silenciar error de recarga */ }

        // Cambiar a modo edicion del branding recien creado
        selectedBrandingId = result.id;
        isNewBranding = false;
        document.getElementById('editorBrandingName').value = name;
        document.getElementById('editorBrandingId').textContent = result.id;
        document.getElementById('newBrandingNameGroup').style.display = 'none';
        document.getElementById('templateTypeGroup').style.display = 'none';

    } catch (error) {
        console.error('Error creating branding:', error);
        showToast('Error al crear branding: ' + error.message);
    }
}

async function updateExistingBranding(brandingId, templateType) {
    let html = generateHTML();
    const shouldMinify = document.getElementById('minifyHTML').checked;
    if (shouldMinify) {
        html = minifyHTML(html);
    }

    const body = new URLSearchParams();
    body.append('templates[' + templateType + ']', html);
    body.append('text_color', document.getElementById('textColor').value);
    body.append('layout_color', document.getElementById('bgColor').value);

    try {
        await apiCall('PATCH', '/brandings/' + brandingId + '.json', body);
        showToast('Template "' + templateType + '" actualizado en branding');

        // Recargar la lista para reflejar cambios
        try {
            apiBrandings = await apiCall('GET', '/brandings.json');
        } catch (e) { /* silenciar error de recarga */ }

    } catch (error) {
        console.error('Error updating branding:', error);
        showToast('Error al actualizar: ' + error.message);
    }
}

// ═══════════════════════════════════
//  UTILIDADES
// ═══════════════════════════════════

function hexToRgba(hex, opacity) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

function copyBrandingId() {
    const idEl = document.getElementById('editorBrandingId');
    const id = idEl.textContent.trim();
    if (!id) return;
    navigator.clipboard.writeText(id).then(() => {
        showToast('ID copiado: ' + id);
    }).catch(() => {
        showToast('No se pudo copiar');
    });
}

function showToast(message) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// ── Secciones Colapsables ──

function toggleCollapsible(header) {
    header.classList.toggle('active');
    const content = header.nextElementSibling;
    content.classList.toggle('active');
}

// ═══════════════════════════════════
//  VARIABLES
// ═══════════════════════════════════

function renderVariablesInline() {
    const container = document.getElementById('variablesInline');
    if (!container) return;

    if (variables.length === 0) {
        container.innerHTML = '<div class="empty-state">No hay variables disponibles</div>';
        return;
    }

    container.innerHTML = variables.map(varName =>
        `<button class="variable-btn" onclick="insertVariableInline('${varName}')">{{${varName}}}</button>`
    ).join('');
}

function insertVariableInline(varName) {
    const textarea = document.getElementById('emailContent');
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const variable = `{{${varName}}}`;

    textarea.value = text.substring(0, start) + variable + text.substring(end);

    const newPosition = start + variable.length;
    textarea.setSelectionRange(newPosition, newPosition);
    textarea.focus();
    updatePreview();
    showToast(`Variable {{${varName}}} insertada`);
}

function insertLogoVariable() {
    insertVariableInline('logo');
}

function renderVariables() {
    const container = document.getElementById('variablesGrid');
    if (!container) return;

    if (variables.length === 0) {
        container.innerHTML = '<div class="empty-state">No hay variables. Agrega una usando el campo de abajo.</div>';
        updateVariableCount();
        renderVariablesInline();
        return;
    }

    container.innerHTML = variables.map((varName, index) => {
        const description = variableDescriptions[varName] || 'Variable personalizada';
        return `
            <div class="variable-pill" onclick="insertVariableAtCursor('${varName}')">
                <span>{{${varName}}}</span>
                <span class="delete-var" onclick="event.stopPropagation(); deleteVariable(${index})">x</span>
                <div class="variable-tooltip">${description}</div>
            </div>
        `;
    }).join('');

    updateVariableCount();
    renderVariablesInline();
}

function updateVariableCount() {
    const btn = document.getElementById('variableCount');
    if (btn) {
        btn.textContent = variables.length;
    }
}

function addVariableFromModal() {
    const input = document.getElementById('newVariableName');
    const varName = input.value.trim();

    if (!varName) {
        showToast('Ingresa un nombre de variable');
        return;
    }

    if (variables.includes(varName)) {
        showToast('Esta variable ya existe');
        return;
    }

    variables.push(varName);
    renderVariables();
    input.value = '';
    showToast('Variable agregada');
}

function handleVariableKeyPress(event) {
    if (event.key === 'Enter') {
        addVariableFromModal();
    }
}

function insertVariableAtCursor(varName) {
    const textarea = document.getElementById('emailContent');
    const start = textarea.selectionStart || 0;
    const end = textarea.selectionEnd || 0;
    const text = textarea.value;
    const variable = `{{${varName}}}`;

    textarea.value = text.substring(0, start) + variable + text.substring(end);

    const newPosition = start + variable.length;
    textarea.setSelectionRange(newPosition, newPosition);
    textarea.focus();
    updatePreview();
    showToast(`Variable {{${varName}}} insertada`);
}

function deleteVariable(index) {
    if (confirm(`Eliminar la variable {{${variables[index]}}}?`)) {
        variables.splice(index, 1);
        renderVariables();
        showToast('Variable eliminada');
    }
}

// ═══════════════════════════════════
//  MODALES
// ═══════════════════════════════════

function openVariableModal() {
    document.getElementById('variableModal').classList.add('show');
    renderVariables();
}

function closeVariableModal() {
    document.getElementById('variableModal').classList.remove('show');
}

function openPasteHTMLModal() {
    document.getElementById('pasteHTMLModal').classList.add('show');
    document.getElementById('pasteHTMLTextarea').value = '';
    document.getElementById('pasteHTMLTextarea').focus();
}

function closePasteHTMLModal() {
    document.getElementById('pasteHTMLModal').classList.remove('show');
}

window.onclick = function(event) {
    const variableModal = document.getElementById('variableModal');
    const pasteModal = document.getElementById('pasteHTMLModal');

    if (event.target === variableModal) {
        closeVariableModal();
    }
    if (event.target === pasteModal) {
        closePasteHTMLModal();
    }
};

// ═══════════════════════════════════
//  SINCRONIZAR COLORES
// ═══════════════════════════════════

let colorListenersAttached = false;

function syncColorInputs() {
    if (colorListenersAttached) return;
    colorListenersAttached = true;

    const colorPairs = [
        ['bgColor', 'bgColorValue'],
        ['containerColor', 'containerColorValue'],
        ['borderColor', 'borderColorValue'],
        ['buttonColor', 'buttonColorValue'],
        ['buttonTextColor', 'buttonTextColorValue'],
        ['buttonBorderColor', 'buttonBorderColorValue'],
        ['textColor', 'textColorValue']
    ];

    colorPairs.forEach(([pickerId, valueId]) => {
        const picker = document.getElementById(pickerId);
        const value = document.getElementById(valueId);

        picker.addEventListener('input', (e) => {
            value.value = e.target.value;
            updatePreview();
        });

        value.addEventListener('input', (e) => {
            if (/^#[0-9A-F]{6}$/i.test(e.target.value)) {
                picker.value = e.target.value;
                updatePreview();
            }
        });
    });
}

// ═══════════════════════════════════
//  GENERAR HTML
// ═══════════════════════════════════

function generateHTML() {
    const logoUrl = document.getElementById('logoUrl').value || defaults.logoUrl;
    const logoWidth = document.getElementById('logoWidth').value || defaults.logoWidth;
    const logoHeight = document.getElementById('logoHeight').value || defaults.logoHeight;
    const logoObjectFit = document.getElementById('logoObjectFit').value || defaults.logoObjectFit;
    const emailContent = document.getElementById('emailContent').value;

    const bgColor = hexToRgba(document.getElementById('bgColor').value, document.getElementById('bgColorOpacity').value);
    const containerColor = hexToRgba(document.getElementById('containerColor').value, document.getElementById('containerColorOpacity').value);
    const borderColor = hexToRgba(document.getElementById('borderColor').value, document.getElementById('borderColorOpacity').value);
    const textColor = hexToRgba(document.getElementById('textColor').value, document.getElementById('textColorOpacity').value);
    const buttonColor = hexToRgba(document.getElementById('buttonColor').value, document.getElementById('buttonColorOpacity').value);
    const buttonTextColor = hexToRgba(document.getElementById('buttonTextColor').value, document.getElementById('buttonTextColorOpacity').value);
    const buttonBorderColor = hexToRgba(document.getElementById('buttonBorderColor').value, document.getElementById('buttonBorderColorOpacity').value);

    const buttonBorderWidth = document.getElementById('buttonBorderWidth').value || '0';
    const buttonBorderRadius = document.getElementById('buttonBorderRadius').value || '20';
    const buttonPaddingTop = document.getElementById('buttonPaddingTop').value || '15';
    const buttonPaddingRight = document.getElementById('buttonPaddingRight').value || '15';
    const buttonPaddingBottom = document.getElementById('buttonPaddingBottom').value || '15';
    const buttonPaddingLeft = document.getElementById('buttonPaddingLeft').value || '15';
    const buttonMarginTop = document.getElementById('buttonMarginTop').value || '10';
    const buttonMarginRight = document.getElementById('buttonMarginRight').value || '0';
    const buttonMarginBottom = document.getElementById('buttonMarginBottom').value || '10';
    const buttonMarginLeft = document.getElementById('buttonMarginLeft').value || '0';
    const buttonWidth = document.getElementById('buttonWidth').value || '200';

    const logoObjectFitStyle = logoObjectFit !== 'none' ? `object-fit:${logoObjectFit};` : '';
    const logoStyles = `width:${logoWidth};height:${logoHeight};${logoObjectFitStyle}display:block;`;

    const logoSection = logoUrl ? `\t\t\t\t\t<tr>
\t\t\t\t\t\t<td align="center" style="padding:30px 0 20px 0;">
\t\t\t\t\t\t\t<img style="${logoStyles}" alt="Logo" src="${logoUrl}">
\t\t\t\t\t\t</td>
\t\t\t\t\t</tr>` : '';

    const buttonBorderStyle = buttonBorderWidth > 0 ? `border:${buttonBorderWidth}px solid ${buttonBorderColor};` : '';
    const buttonPaddingStyle = `padding:${buttonPaddingTop}px ${buttonPaddingRight}px ${buttonPaddingBottom}px ${buttonPaddingLeft}px;`;
    const buttonMarginStyle = `margin:${buttonMarginTop}px ${buttonMarginRight}px ${buttonMarginBottom}px ${buttonMarginLeft}px;`;
    const buttonHTML = `<table class="miboton" align="center" style='width:${buttonWidth}px;background:${buttonColor};border-radius:${buttonBorderRadius}px;${buttonBorderStyle}${buttonMarginStyle}'>
\t\t\t\t\t\t\t\t\t\t\t<tr>
\t\t\t\t\t\t\t\t\t\t\t\t<td style='${buttonPaddingStyle}line-height:12px'>
\t\t\t\t\t\t\t\t\t\t\t\t\t<p style='text-align:center;margin:0;'>
\t\t\t\t\t\t\t\t\t\t\t\t\t\t<span class="mititulo" style='font-size:18px;font-family:"Arial";color:${buttonTextColor};'>{{sign_button}}</span>
\t\t\t\t\t\t\t\t\t\t\t\t\t</p>
\t\t\t\t\t\t\t\t\t\t\t\t</td>
\t\t\t\t\t\t\t\t\t\t\t</tr>
\t\t\t\t\t\t\t\t\t\t</table>`;

    const contentParagraphs = emailContent
        .split('\n')
        .filter(line => line.trim() !== '')
        .map(line => {
            if (line.includes('{{sign_button}}')) {
                return line.replace('{{sign_button}}', buttonHTML);
            }
            return `\t\t\t\t\t\t\t\t\t\t<p style="margin:0 0 12px 0;font-size:16px;line-height:24px;font-family:'Helvetica Neue', Helvetica, Arial;">\n\t\t\t\t\t\t\t\t\t\t${line}</p>`;
        })
        .join('\n');

    return `<!DOCTYPE html>
<html lang="es" xmlns="http://www.w3.org/1999/xhtml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
\t<meta charset="UTF-8">
\t<meta name="viewport" content="width=device-width,initial-scale=1">
\t<meta name="x-apple-disable-message-reformatting">
\t<title>Solicitud de Firma</title>
\t<!--[if mso]>
\t<noscript>
\t\t<xml>
\t\t\t<o:OfficeDocumentSettings>
\t\t\t\t<o:PixelsPerInch>96</o:PixelsPerInch>
\t\t\t</o:OfficeDocumentSettings>
\t\t</xml>
\t</noscript>
\t<![endif]-->
\t<style>
\t\ttable, td, div, h1, p {font-family: 'Helvetica Neue', Helvetica, Arial;}
\t</style>
</head>
<body style="margin:0;padding:0;background-color: ${bgColor};">
\t<table role="presentation" style="width:100%;border-collapse:collapse;border:0;border-spacing:0;margin:30px 0px;">
\t\t<tr>
\t\t\t<td align="center" style="padding:0;">
\t\t\t\t<table role="presentation" style="width:800px;border-collapse:collapse;border:1px solid ${borderColor};border-spacing:0;text-align:left;background:${containerColor}">
${logoSection}
\t\t\t\t\t<tr>
\t\t\t\t\t\t<td style="padding:10px 25px 0px 25px;">
\t\t\t\t\t\t\t<table role="presentation" style="width:100%;border-collapse:collapse;border:0;border-spacing:0;">
\t\t\t\t\t\t\t\t<tr>
\t\t\t\t\t\t\t\t\t<td style="padding:0 0 25px 0;color:${textColor};">
${contentParagraphs}
\t\t\t\t\t\t\t\t\t</td>
\t\t\t\t\t\t\t\t</tr>
\t\t\t\t\t\t\t</table>
\t\t\t\t\t\t</td>
\t\t\t\t\t</tr>
\t\t\t\t</table>
\t\t\t</td>
\t\t</tr>
\t</table>
</body>
</html>`;
}

// ═══════════════════════════════════
//  IMPORT / PARSE HTML
// ═══════════════════════════════════

function importHTMLFile(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        let htmlContent = e.target.result;

        if (htmlContent.includes('\\"') || htmlContent.includes('\\n')) {
            try {
                htmlContent = JSON.parse('"' + htmlContent + '"');
            } catch (err) {
                htmlContent = htmlContent
                    .replace(/\\"/g, '"')
                    .replace(/\\n/g, '\n')
                    .replace(/\\t/g, '\t')
                    .replace(/\\\\/g, '\\');
            }
        }

        if (htmlContent.includes('Generador de Plantillas HTML') || htmlContent.includes('class="controls"')) {
            showToast('Archivo no valido: Es el generador mismo, no un template');
            return;
        }

        try {
            parseHTMLTemplate(htmlContent);
            showToast('HTML cargado - Edita el contenido arriba');
        } catch (error) {
            console.error('Error parsing HTML:', error);
            showToast('Error: Archivo no es un template de email valido');
        }
    };
    reader.readAsText(file);
}

function loadPastedHTML() {
    let htmlContent = document.getElementById('pasteHTMLTextarea').value.trim();
    if (!htmlContent) {
        showToast('Por favor pega codigo HTML primero');
        return;
    }

    if (htmlContent.includes('\\"') || htmlContent.includes('\\n')) {
        try {
            htmlContent = JSON.parse('"' + htmlContent + '"');
        } catch (e) {
            htmlContent = htmlContent
                .replace(/\\"/g, '"')
                .replace(/\\n/g, '\n')
                .replace(/\\t/g, '\t')
                .replace(/\\\\/g, '\\');
        }
    }

    if (htmlContent.includes('Generador de Plantillas HTML') || htmlContent.includes('class="controls"')) {
        showToast('Parece que pegaste el generador mismo. Pega un email template.');
        return;
    }

    try {
        parseHTMLTemplate(htmlContent);
        closePasteHTMLModal();
        showToast('HTML cargado - Edita el contenido arriba');
    } catch (error) {
        console.error('Error parsing HTML:', error);
        showToast('Error: HTML no es un template de email valido');
    }
}

function parseHTMLTemplate(htmlString) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlString, 'text/html');

    if (htmlString.includes('Generador de Plantillas HTML') ||
        htmlString.includes('class="controls"') ||
        htmlString.includes('id="previewFrame"')) {
        showToast('HTML no valido - Es el generador mismo');
        throw new Error('Cannot import generator code');
    }

    let extractedSomething = false;

    // Logo
    const logoImg = doc.querySelector('img[alt="Logo"]') ||
                   doc.querySelector('img[alt="logo"]') ||
                   doc.querySelector('img');

    if (logoImg) {
        const logoSrc = logoImg.getAttribute('src');
        const logoStyle = logoImg.getAttribute('style') || '';

        if (logoSrc && !logoSrc.includes('data:image')) {
            document.getElementById('logoUrl').value = logoSrc;
            extractedSomething = true;
        }

        const widthMatch = logoStyle.match(/width:\s*([^;]+)/) || logoImg.getAttribute('width');
        if (widthMatch) {
            const width = typeof widthMatch === 'string' ? widthMatch : widthMatch[1].trim();
            document.getElementById('logoWidth').value = width.includes('px') || width.includes('%') ? width : width + 'px';
        }

        const heightMatch = logoStyle.match(/height:\s*([^;]+)/) || logoImg.getAttribute('height');
        if (heightMatch) {
            const height = typeof heightMatch === 'string' ? heightMatch : heightMatch[1].trim();
            document.getElementById('logoHeight').value = height.includes('px') || height.includes('%') || height === 'auto' ? height : height + 'px';
        }

        const objectFitMatch = logoStyle.match(/object-fit:\s*([^;]+)/);
        if (objectFitMatch) {
            document.getElementById('logoObjectFit').value = objectFitMatch[1].trim();
        } else {
            document.getElementById('logoObjectFit').value = 'none';
        }
    } else {
        document.getElementById('logoUrl').value = '';
    }

    // Body background
    const body = doc.querySelector('body');
    if (body) {
        const bodyStyle = body.getAttribute('style') || '';
        const bgColorMatch = bodyStyle.match(/background-color:\s*([^;]+)/);
        if (bgColorMatch) {
            const bgColor = bgColorMatch[1].trim();
            document.getElementById('bgColor').value = bgColor.startsWith('#') ? bgColor : '#ffffff';
            document.getElementById('bgColorValue').value = bgColor.startsWith('#') ? bgColor : '#ffffff';
            extractedSomething = true;
        }
    }

    // Container colors
    const tables = doc.querySelectorAll('table[bgcolor], table[style*="background"]');
    if (tables.length > 0) {
        for (let table of tables) {
            const bgcolor = table.getAttribute('bgcolor');
            const style = table.getAttribute('style') || '';

            if (bgcolor && bgcolor.startsWith('#')) {
                document.getElementById('containerColor').value = bgcolor;
                document.getElementById('containerColorValue').value = bgcolor;
                extractedSomething = true;
                break;
            }

            const bgMatch = style.match(/background(?:-color)?:\s*([^;]+)/);
            if (bgMatch && bgMatch[1].trim().startsWith('#')) {
                document.getElementById('containerColor').value = bgMatch[1].trim();
                document.getElementById('containerColorValue').value = bgMatch[1].trim();
                extractedSomething = true;
                break;
            }
        }
    }

    // Button styles
    const buttonTable = doc.querySelector('table.miboton') ||
                       doc.querySelector('table[align="center"][style*="background"]');

    if (buttonTable) {
        const buttonStyle = buttonTable.getAttribute('style') || '';

        const widthMatch = buttonStyle.match(/width:\s*(\d+)px/);
        if (widthMatch) {
            document.getElementById('buttonWidth').value = widthMatch[1];
            extractedSomething = true;
        }

        const bgMatch = buttonStyle.match(/background(?:-color)?:\s*([^;]+)/);
        if (bgMatch) {
            const btnColor = bgMatch[1].trim();
            if (btnColor.startsWith('#')) {
                document.getElementById('buttonColor').value = btnColor;
                document.getElementById('buttonColorValue').value = btnColor;
                extractedSomething = true;
            }
        }

        const radiusMatch = buttonStyle.match(/border-radius:\s*(\d+)px/);
        if (radiusMatch) {
            document.getElementById('buttonBorderRadius').value = radiusMatch[1];
        }

        const borderMatch = buttonStyle.match(/border:\s*(\d+)px solid ([^;]+)/);
        if (borderMatch) {
            document.getElementById('buttonBorderWidth').value = borderMatch[1];
            const bdrColor = borderMatch[2].trim();
            if (bdrColor.startsWith('#')) {
                document.getElementById('buttonBorderColor').value = bdrColor;
                document.getElementById('buttonBorderColorValue').value = bdrColor;
            }
        } else {
            document.getElementById('buttonBorderWidth').value = '0';
        }

        const marginMatch = buttonStyle.match(/margin:\s*(\d+)px\s+(\d+)px\s+(\d+)px\s+(\d+)px/);
        if (marginMatch) {
            document.getElementById('buttonMarginTop').value = marginMatch[1];
            document.getElementById('buttonMarginRight').value = marginMatch[2];
            document.getElementById('buttonMarginBottom').value = marginMatch[3];
            document.getElementById('buttonMarginLeft').value = marginMatch[4];
        }

        const buttonTd = buttonTable.querySelector('td');
        if (buttonTd) {
            const tdStyle = buttonTd.getAttribute('style') || '';
            const paddingMatch = tdStyle.match(/padding:\s*(\d+)px\s+(\d+)px\s+(\d+)px\s+(\d+)px/);
            if (paddingMatch) {
                document.getElementById('buttonPaddingTop').value = paddingMatch[1];
                document.getElementById('buttonPaddingRight').value = paddingMatch[2];
                document.getElementById('buttonPaddingBottom').value = paddingMatch[3];
                document.getElementById('buttonPaddingLeft').value = paddingMatch[4];
            }
        }

        const buttonSpan = buttonTable.querySelector('span.mititulo') ||
                         buttonTable.querySelector('span') ||
                         buttonTable.querySelector('a');
        if (buttonSpan) {
            const spanStyle = buttonSpan.getAttribute('style') || '';
            const colorMatch = spanStyle.match(/color:\s*([^;]+)/);
            if (colorMatch && colorMatch[1].trim().startsWith('#')) {
                const txtColor = colorMatch[1].trim();
                document.getElementById('buttonTextColor').value = txtColor;
                document.getElementById('buttonTextColorValue').value = txtColor;
            }
        }
    }

    // Email content
    let emailContent = '';
    const contentArea = doc.querySelector('td[style*="padding:0 0 25px 0"]') ||
                       doc.querySelector('.note') ||
                       doc.querySelector('table[bgcolor="#ffffff"] td') ||
                       doc.querySelector('body');

    if (contentArea) {
        const extractTextAndVariables = (element) => {
            let content = '';
            const walker = document.createTreeWalker(
                element,
                NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
                null,
                false
            );

            let node;
            while (node = walker.nextNode()) {
                if (node.nodeType === Node.TEXT_NODE) {
                    const text = node.textContent.trim();
                    if (text) {
                        content += text + '\n';
                    }
                } else if (node.nodeName === 'BR') {
                    content += '\n';
                } else if (node.classList && node.classList.contains('miboton')) {
                    content += '{{sign_button}}\n';
                }
            }
            return content;
        };

        emailContent = extractTextAndVariables(contentArea);

        if (!emailContent.trim()) {
            emailContent = contentArea.textContent || '';
        }

        extractedSomething = true;
    }

    emailContent = emailContent
        .replace(/\n{3,}/g, '\n\n')
        .trim();

    if (emailContent) {
        document.getElementById('emailContent').value = emailContent;
    }

    if (!extractedSomething) {
        showToast('No se pudo extraer informacion - Edita manualmente');
    }

    // Abrir la seccion de contenido
    const allHeaders = document.querySelectorAll('#viewEditor .collapsible-header');
    allHeaders.forEach(header => {
        const content = header.nextElementSibling;
        if (header.closest('.collapsible-section') && header.textContent.includes('Contenido')) {
            if (!header.classList.contains('active')) {
                header.classList.add('active');
                content.classList.add('active');
            }
        }
    });

    const controlsPanel = document.querySelector('.controls');
    if (controlsPanel) {
        controlsPanel.scrollTo({ top: 0, behavior: 'smooth' });
    }

    const textarea = document.getElementById('emailContent');
    textarea.scrollTop = 0;
    setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(0, 0);
    }, 300);

    syncColorInputs();
    updatePreview();
}

// ═══════════════════════════════════
//  MINIFICAR HTML
// ═══════════════════════════════════

function minifyHTML(html) {
    return html
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/>\s+</g, '><')
        .replace(/\s{2,}/g, ' ')
        .trim();
}

// ═══════════════════════════════════
//  PREVIEW
// ═══════════════════════════════════

function updatePreview() {
    const frame = document.getElementById('previewFrame');
    if (frame) {
        const html = generateHTML();
        frame.innerHTML = html;
    }
}

// ═══════════════════════════════════
//  COPIAR / DESCARGAR
// ═══════════════════════════════════

async function copyToClipboard() {
    let html = generateHTML();
    const shouldMinify = document.getElementById('minifyHTML').checked;

    if (shouldMinify) {
        html = minifyHTML(html);
    }

    try {
        await navigator.clipboard.writeText(html);
        showToast(shouldMinify ? 'HTML minificado copiado' : 'HTML copiado al portapapeles');
    } catch (err) {
        showToast('Error al copiar');
    }
}

function downloadHTML() {
    let html = generateHTML();
    const shouldMinify = document.getElementById('minifyHTML').checked;

    if (shouldMinify) {
        html = minifyHTML(html);
    }

    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `signaturit-email-template-${Date.now()}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(shouldMinify ? 'HTML minificado descargado' : 'HTML descargado');
}

// ═══════════════════════════════════
//  RESET
// ═══════════════════════════════════

function resetToDefault(silent) {
    if (!silent && !confirm('Resetear todos los valores a los defaults?')) return;

    Object.keys(defaults).forEach(key => {
        const element = document.getElementById(key);
        if (element) {
            element.value = defaults[key];
        }
        const valueElement = document.getElementById(key + 'Value');
        if (valueElement) {
            valueElement.value = defaults[key];
        }
    });

    const opacityIds = [
        'bgColorOpacity',
        'containerColorOpacity',
        'borderColorOpacity',
        'textColorOpacity',
        'buttonColorOpacity',
        'buttonTextColorOpacity',
        'buttonBorderColorOpacity'
    ];

    opacityIds.forEach(id => {
        const slider = document.getElementById(id);
        if (slider) {
            slider.value = '1';
        }
        const valueSpan = document.getElementById(id + 'Value');
        if (valueSpan) {
            valueSpan.textContent = '100%';
        }
    });

    variables = [
        'sender_email', 'sign_button', 'validate_button', 'signer_name',
        'signer_email', 'filename', 'logo', 'remaining_time',
        'email_button', 'email_body', 'code', 'reason',
        'dashboard_button', 'signers'
    ];
    renderVariables();
    updatePreview();

    if (!silent) {
        showToast('Valores reseteados');
    }
}

// ═══════════════════════════════════
//  INICIALIZACION
// ═══════════════════════════════════

let editorListenersAttached = false;

function initEditorListeners() {
    syncColorInputs();
    renderVariables();

    document.getElementById('emailContent').value = document.getElementById('emailContent').value || defaults.emailContent;

    if (editorListenersAttached) {
        updatePreview();
        return;
    }
    editorListenersAttached = true;

    // Event listeners para todos los inputs del editor
    document.querySelectorAll('#viewEditor input:not([type="range"]):not([type="checkbox"]):not([type="file"]), #viewEditor textarea, #viewEditor select').forEach(element => {
        element.addEventListener('input', updatePreview);
    });

    // Opacity sliders
    const opacitySliders = [
        'bgColorOpacity', 'containerColorOpacity', 'borderColorOpacity',
        'textColorOpacity', 'buttonColorOpacity', 'buttonTextColorOpacity',
        'buttonBorderColorOpacity'
    ];

    opacitySliders.forEach(sliderId => {
        const slider = document.getElementById(sliderId);
        const valueSpan = document.getElementById(sliderId + 'Value');

        if (slider && valueSpan) {
            slider.addEventListener('input', function() {
                const percentage = Math.round(this.value * 100);
                valueSpan.textContent = percentage + '%';
                updatePreview();
            });
        }
    });

    updatePreview();
}

function initApp() {
    // Cerrar modales con Escape
    document.addEventListener('keydown', function(event) {
        if (event.key === 'Escape') {
            closeVariableModal();
            closePasteHTMLModal();
        }
    });

    // Empezar en la vista de login
    showView('viewLogin');
}

// Arrancar cuando el DOM este listo
document.addEventListener('DOMContentLoaded', initApp);
