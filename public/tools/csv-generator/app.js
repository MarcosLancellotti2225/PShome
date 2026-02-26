// ============================================
// CSV Generator v4.5.1
// Multi-format + Multi-sheet + Transformations
// ============================================

(function() {
    'use strict';

    // ============================================
    // UTILIDADES
    // ============================================
    function sanitizeHTML(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // ============================================
    // ESTADO GLOBAL
    // ============================================
    const state = {
        selectedProduct: null,
        selectedCommand: null,
        selectedFormat: 'xlsx',  // NUEVO: formato seleccionado
        currentWorkbook: null,   // NUEVO: workbook para hojas múltiples
        excelColumns: [],
        excelData: [],
        mapping: {},
        customDefaults: {},      // v4.5.1: valores por defecto del usuario
        transformations: {},     // v4.5.1: transformaciones aplicadas por columna
        hasHeaderRow: true
    };

    // ============================================
    // TEMPLATES (IvSign + IvNeos)
    // ============================================
    const templates = {
        ivsign: {
            'users-add': {
                columns: ['userid', 'email', 'nombre', 'apellidos', 'dni', 'telefono', 'rol', 'password'],
                defaults: {}
            },
            'users-modify': {
                columns: ['userid', 'email', 'nombre', 'apellidos', 'dni', 'telefono', 'rol'],
                defaults: {}
            },
            'users-delete': {
                columns: ['userid'],
                defaults: {}
            },
            'certs-add': {
                columns: ['userid', 'certType', 'p12File', 'p12Pass'],
                defaults: {}
            },
            'certs-modify': {
                columns: ['userid', 'certType', 'p12File', 'p12Pass'],
                defaults: {}
            },
            'certs-delegate': {
                columns: ['userid', 'certType', 'certSerial', 'certOwner'],
                defaults: {}
            },
            'delegs-add': {
                columns: ['userid', 'delegType', 'delegUser', 'delegStart', 'delegEnd'],
                defaults: {}
            },
            'delegs-modify': {
                columns: ['userid', 'delegType', 'delegUser', 'delegStart', 'delegEnd'],
                defaults: {}
            },
            'delegs-delete': {
                columns: ['userid', 'delegUser'],
                defaults: {}
            },
            'rules-add': {
                columns: ['userid', 'ruleType', 'ruleValue'],
                defaults: {}
            },
            'rules-modify': {
                columns: ['userid', 'ruleType', 'ruleValue'],
                defaults: {}
            }
        },
        ivneos: {
            'clientes': {
                columns: ['identificador', 'razon_social', 'nif', 'email', 'telefono'],
                defaults: {}
            },
            'grupos': {
                columns: ['id_grupo', 'nombre_grupo', 'descripcion'],
                defaults: {}
            },
            'usuarios': {
                columns: ['userid', 'email', 'nombre', 'apellidos', 'dni', 'telefono', 'grupo'],
                defaults: {}
            }
        }
    };

    // ============================================
    // INICIALIZACIÓN
    // ============================================
    document.addEventListener('DOMContentLoaded', init);

    function init() {
        setupProductSelection();
        setupFormatSelection();  // NUEVO
        setupFileUpload();
        setupHeaderOptions();
        setupDownload();
        setupReset();
    }

    // ============================================
    // PASO 1: SELECCIÓN DE PRODUCTO Y COMANDO
    // ============================================
    function setupProductSelection() {
        // Product cards
        document.querySelectorAll('.product-card').forEach(card => {
            card.onclick = () => {
                const product = card.dataset.product;
                selectProduct(product);
            };
        });

        // Template buttons
        document.getElementById('createTemplateBtn').onclick = () => {
            if (!state.selectedCommand) {
                alert('⚠️ Primero selecciona un comando');
                return;
            }
            createEmptyTemplate();
        };

        document.getElementById('loadExcelBtn').onclick = () => {
            if (!state.selectedCommand) {
                alert('⚠️ Primero selecciona un comando');
                return;
            }
            // Show format selector
            document.getElementById('formatSelector').style.display = 'block';
            document.getElementById('formatSelector').scrollIntoView({ 
                behavior: 'smooth', 
                block: 'start' 
            });
        };

        document.getElementById('downloadTemplateBtn').onclick = () => {
            if (!state.selectedCommand) {
                alert('⚠️ Primero selecciona un comando');
                return;
            }
            downloadTemplate();
        };
    }

    function selectProduct(product) {
        state.selectedProduct = product;
        
        // Update UI
        document.querySelectorAll('.product-card').forEach(card => {
            card.classList.remove('selected');
        });
        const selectedCard = document.querySelector(`[data-product="${product}"]`);
        if (selectedCard) {
            selectedCard.classList.add('selected');
        }

        // Show command selection
        const commandSelection = document.getElementById('commandSelection');
        if (!commandSelection) {
            console.error('❌ ERROR: commandSelection element not found in HTML');
            alert('Error: Falta el elemento commandSelection en el HTML. Verifica que hayas actualizado index.html correctamente.');
            return;
        }
        commandSelection.style.display = 'block';
        
        // Generate command buttons dynamically
        const commandGrid = document.getElementById('commandGrid');
        if (!commandGrid) {
            console.error('❌ ERROR: commandGrid element not found in HTML');
            alert('Error: Falta el elemento commandGrid en el HTML. Verifica que hayas actualizado index.html correctamente.');
            return;
        }
        commandGrid.innerHTML = '';
        
        const productTemplates = templates[product];
        if (!productTemplates) {
            console.error('❌ ERROR: No templates found for product:', product);
            return;
        }
        
        Object.keys(productTemplates).forEach(cmdKey => {
            const btn = document.createElement('button');
            btn.className = 'command-item';
            btn.dataset.command = cmdKey;
            btn.textContent = cmdKey;
            btn.onclick = () => selectCommand(cmdKey);
            commandGrid.appendChild(btn);
        });
        
        // Scroll
        commandSelection.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'center' 
        });
    }

    function selectCommand(command) {
        state.selectedCommand = command;
        
        // Update UI
        document.querySelectorAll('.command-item').forEach(item => {
            item.classList.remove('selected');
        });
        const selectedItem = document.querySelector(`[data-command="${command}"]`);
        if (selectedItem) {
            selectedItem.classList.add('selected');
        }

        // Show columns info
        const template = getTemplate();
        const columnsInfo = document.getElementById('columnsInfo');
        const requiredColumns = document.getElementById('requiredColumns');
        
        if (columnsInfo && requiredColumns) {
            columnsInfo.style.display = 'block';
            requiredColumns.textContent = template.columns.join(', ');
        }
        
        // Show next step (create/load file)
        const steps = document.querySelectorAll('.step');
        if (steps.length >= 3) {
            steps[2].scrollIntoView({
                behavior: 'smooth',
                block: 'center'
            });
        }
    }

    // ============================================
    // TEMPLATES
    // ============================================
    function createEmptyTemplate() {
        const template = getTemplate();
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet([template.columns]);
        XLSX.utils.book_append_sheet(wb, ws, 'Template');
        XLSX.writeFile(wb, `template_${state.selectedCommand}.xlsx`);
    }

    function downloadTemplate() {
        const template = getTemplate();
        const sampleData = [
            template.columns,
            template.columns.map(col => template.defaults[col] || `ejemplo_${col}`)
        ];
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(sampleData);
        XLSX.utils.book_append_sheet(wb, ws, 'Template');
        XLSX.writeFile(wb, `template_${state.selectedCommand}_con_ejemplo.xlsx`);
    }

    function getTemplate() {
        return templates[state.selectedProduct][state.selectedCommand];
    }

    // ============================================
    // PASO 2: SELECCIÓN DE FORMATO (NUEVO)
    // ============================================
    function setupFormatSelection() {
        const formatCards = document.querySelectorAll('.format-card');
        
        formatCards.forEach(card => {
            card.onclick = () => {
                const format = card.dataset.format;
                selectFormat(format);
            };
        });
    }

    function selectFormat(format) {
        state.selectedFormat = format;
        
        // Update UI
        document.querySelectorAll('.format-card').forEach(card => {
            card.classList.remove('selected');
        });
        document.querySelector(`[data-format="${format}"]`).classList.add('selected');

        // Show/hide format options
        document.getElementById('csvOptions').style.display = 'none';
        document.getElementById('xmlOptions').style.display = 'none';

        if (format === 'csv') {
            document.getElementById('csvOptions').style.display = 'block';
        } else if (format === 'xml') {
            document.getElementById('xmlOptions').style.display = 'block';
        }

        // Update file input accept
        const accepts = {
            xlsx: '.xlsx,.xls',
            csv: '.csv',
            json: '.json',
            xml: '.xml'
        };
        document.getElementById('fileInput').accept = accepts[format];

        // Show upload area
        document.getElementById('uploadArea').style.display = 'block';
    }

    // ============================================
    // CARGA DE ARCHIVOS (MULTI-FORMATO)
    // ============================================
    function setupFileUpload() {
        const uploadArea = document.getElementById('uploadArea');
        const fileInput = document.getElementById('fileInput');

        // Evitar que el click del fileInput burbujee al uploadArea
        // (sino fileInput.click() burbujea → uploadArea.onclick → fileInput.click() → loop)
        fileInput.addEventListener('click', (e) => {
            e.stopPropagation();
        });

        // Click en el area abre el selector de archivo
        uploadArea.addEventListener('click', () => {
            fileInput.value = ''; // Reset para permitir re-subir el mismo archivo
            fileInput.click();
        });

        // Drag & drop
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('dragover');
        });

        uploadArea.addEventListener('dragleave', () => {
            uploadArea.classList.remove('dragover');
        });

        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
            const file = e.dataTransfer.files[0];
            if (file) {
                handleFileUpload(file);
            }
        });

        // File input change
        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                handleFileUpload(file);
            }
        });
    }

    async function handleFileUpload(file) {
        if (!state.selectedCommand) {
            alert('⚠️ Primero selecciona un comando');
            return;
        }

        try {
            let result;
            
            // Cargar según formato seleccionado
            switch (state.selectedFormat) {
                case 'xlsx':
                    result = await loadXLSXFile(file);
                    break;
                    
                case 'csv':
                    const csvOptions = {
                        delimiter: document.getElementById('csvDelimiter').value === 'auto' ? null : document.getElementById('csvDelimiter').value,
                        encoding: document.getElementById('csvEncoding').value,
                        hasHeader: document.getElementById('csvHasHeader').checked
                    };
                    result = await FormatLoaders.loadCSV(file, csvOptions);
                    break;
                    
                case 'json':
                    result = await FormatLoaders.loadJSON(file);
                    break;
                    
                case 'xml':
                    const xmlOptions = {
                        rowPath: document.getElementById('xmlRowPath').value || null
                    };
                    result = await FormatLoaders.loadXML(file, xmlOptions);
                    break;
            }
            
            // Guardar datos
            state.excelColumns = result.columns;
            state.excelData = result.data;
            
            // Mostrar opciones de header (solo para XLSX)
            if (state.selectedFormat === 'xlsx') {
                document.getElementById('headerOption').style.display = 'block';
                document.getElementById('headerOption').scrollIntoView({ 
                    behavior: 'smooth', 
                    block: 'center' 
                });
            } else {
                // Para otros formatos, ir directo al mapeo
                setupMapping();
            }
            
        } catch (error) {
            alert('❌ Error al procesar archivo:\n' + error.message);
            console.error(error);
        }
    }

    // Cargar XLSX con soporte multi-hoja
    async function loadXLSXFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    state.currentWorkbook = workbook;
                    
                    // Si hay múltiples hojas, mostrar selector
                    if (workbook.SheetNames.length > 1) {
                        showSheetSelector(workbook);
                        resolve({ columns: [], data: [] }); // Placeholder
                    } else {
                        // Solo una hoja
                        const result = processSheet(workbook, workbook.SheetNames[0]);
                        resolve(result);
                    }
                    
                } catch (error) {
                    reject(error);
                }
            };
            
            reader.onerror = () => reject(new Error('Error al leer el archivo'));
            reader.readAsArrayBuffer(file);
        });
    }

    function showSheetSelector(workbook) {
        const html = `
            <div style="margin: 20px 0; padding: 20px; background: #f8f9ff; border: 2px solid #667eea; border-radius: 10px;">
                <h4 style="color: #667eea; margin-bottom: 15px;">
                    📑 Este archivo tiene ${workbook.SheetNames.length} hojas
                </h4>
                <p style="margin-bottom: 15px; color: #666;">
                    Selecciona qué hoja quieres procesar:
                </p>
                <select id="sheetSelector" style="width: 100%; padding: 12px; border: 2px solid #667eea; border-radius: 8px; font-size: 1em; margin-bottom: 15px;">
                    ${workbook.SheetNames.map((name, idx) => 
                        `<option value="${idx}">${name}</option>`
                    ).join('')}
                </select>
                <button id="loadSheetBtn" class="btn btn-primary" style="width: 100%;">
                    ✅ Cargar Hoja Seleccionada
                </button>
            </div>
        `;
        
        const container = document.getElementById('headerOption');
        container.insertAdjacentHTML('beforebegin', `<div id="sheetSelectorDiv">${html}</div>`);
        
        document.getElementById('loadSheetBtn').onclick = () => {
            const idx = document.getElementById('sheetSelector').value;
            const sheetName = workbook.SheetNames[idx];
            const result = processSheet(workbook, sheetName);
            
            state.excelColumns = result.columns;
            state.excelData = result.data;
            
            document.getElementById('sheetSelectorDiv').remove();
            document.getElementById('headerOption').style.display = 'block';
            document.getElementById('headerOption').scrollIntoView({ 
                behavior: 'smooth', 
                block: 'center' 
            });
        };
    }

    function processSheet(workbook, sheetName) {
        const sheet = workbook.Sheets[sheetName];
        const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
        
        if (rawData.length === 0) {
            throw new Error('La hoja está vacía');
        }
        
        // Asumir que tiene header por defecto
        const columns = rawData[0].map(h => String(h).trim());
        const dataRows = rawData.slice(1);
        
        const data = dataRows.map(row => {
            const obj = {};
            columns.forEach((col, idx) => {
                obj[col] = row[idx] !== undefined ? String(row[idx]).trim() : '';
            });
            return obj;
        });
        
        return { columns, data };
    }

    // ============================================
    // OPCIONES DE HEADER
    // ============================================
    function setupHeaderOptions() {
        document.getElementById('processFileBtn').onclick = () => {
            const hasHeader = document.getElementById('hasHeaderRow').value === 'true';
            
            if (!hasHeader) {
                // Regenerar columnas como A, B, C...
                const numCols = state.excelData[0] ? Object.keys(state.excelData[0]).length : 0;
                state.excelColumns = Array.from({ length: numCols }, (_, i) => {
                    let col = '';
                    let n = i;
                    while (n >= 0) {
                        col = String.fromCharCode(65 + (n % 26)) + col;
                        n = Math.floor(n / 26) - 1;
                    }
                    return `Columna ${col}`;
                });
            }
            
            setupMapping();
        };

        // Header option cards
        document.getElementById('optionWithHeader').onclick = function() {
            document.getElementById('hasHeaderRow').value = 'true';
            this.style.background = '#f8f9ff';
            this.style.borderColor = '#667eea';
            this.querySelector('h4').style.color = '#667eea';
            
            document.getElementById('optionWithoutHeader').style.background = 'white';
            document.getElementById('optionWithoutHeader').style.borderColor = '#e0e0e0';
            document.getElementById('optionWithoutHeader').querySelector('h4').style.color = '#666';
        };

        document.getElementById('optionWithoutHeader').onclick = function() {
            document.getElementById('hasHeaderRow').value = 'false';
            this.style.background = '#fff8e1';
            this.style.borderColor = '#ffc107';
            this.querySelector('h4').style.color = '#f57c00';
            
            document.getElementById('optionWithHeader').style.background = 'white';
            document.getElementById('optionWithHeader').style.borderColor = '#e0e0e0';
            document.getElementById('optionWithHeader').querySelector('h4').style.color = '#666';
        };
    }

    // ============================================
    // MAPEO DE COLUMNAS
    // ============================================
    function setupMapping() {
        const template = getTemplate();
        
        // Auto-mapeo
        state.mapping = {};
        let autoMappedCount = 0;
        
        template.columns.forEach(reqCol => {
            const match = state.excelColumns.find(excelCol => 
                excelCol.toLowerCase().includes(reqCol.toLowerCase()) ||
                reqCol.toLowerCase().includes(excelCol.toLowerCase())
            );
            
            if (match) {
                state.mapping[reqCol] = match;
                autoMappedCount++;
            } else {
                state.mapping[reqCol] = '';
            }
        });

        // Mostrar sección de mapeo
        document.getElementById('mappingSection').style.display = 'block';
        
        // Actualizar UI
        renderMappingTable();
        
        // Setup manual mapping toggle button
        document.getElementById('manualMappingBtn').onclick = () => {
            const details = document.getElementById('mappingDetails');
            if (details.style.display === 'none') {
                details.style.display = 'block';
            } else {
                details.style.display = 'none';
            }
        };

        // Setup apply button
        document.getElementById('applyMappingBtn').onclick = () => {
            updateMapping();
            generatePreview();
        };

        // Scroll
        document.getElementById('mappingSection').scrollIntoView({
            behavior: 'smooth',
            block: 'center'
        });
    }

    function renderMappingTable() {
        const template = getTemplate();
        const tbody = document.querySelector('#mappingTable tbody');
        tbody.innerHTML = '';

        template.columns.forEach(reqCol => {
            const tr = document.createElement('tr');

            // Columna requerida
            const tdReq = document.createElement('td');
            tdReq.textContent = reqCol;
            tdReq.style.fontWeight = '600';
            tr.appendChild(tdReq);

            // Dropdown de mapeo
            const tdMap = document.createElement('td');
            const select = document.createElement('select');
            select.className = 'mapping-select';
            select.dataset.column = reqCol;

            const optionEmpty = document.createElement('option');
            optionEmpty.value = '';
            optionEmpty.textContent = '-- Seleccionar --';
            select.appendChild(optionEmpty);

            state.excelColumns.forEach(excelCol => {
                const option = document.createElement('option');
                option.value = excelCol;
                option.textContent = excelCol;
                if (state.mapping[reqCol] === excelCol) {
                    option.selected = true;
                }
                select.appendChild(option);
            });

            tdMap.appendChild(select);
            tr.appendChild(tdMap);

            // Botón transformar (reemplaza "Dividir")
            const tdAction = document.createElement('td');
            const btnTransform = document.createElement('button');
            btnTransform.textContent = '🔧 Transformar';
            btnTransform.className = 'btn btn-secondary';
            btnTransform.style.padding = '5px 10px';
            btnTransform.style.fontSize = '0.9em';
            btnTransform.onclick = () => openTransformModal(reqCol);
            tdAction.appendChild(btnTransform);

            // Mostrar badge de transformaciones aplicadas
            if (state.transformations[reqCol] && state.transformations[reqCol].length > 0) {
                const badge = document.createElement('span');
                badge.style.cssText = 'display:inline-block;margin-left:8px;background:#28a745;color:white;padding:2px 8px;border-radius:10px;font-size:0.8em;';
                badge.textContent = state.transformations[reqCol].length + ' aplicada(s)';
                tdAction.appendChild(badge);
            }

            tr.appendChild(tdAction);

            // Valor por defecto (editable)
            const tdDefault = document.createElement('td');
            const defaultInput = document.createElement('input');
            defaultInput.type = 'text';
            defaultInput.className = 'default-value-input';
            defaultInput.dataset.column = reqCol;
            defaultInput.placeholder = '';
            defaultInput.value = state.customDefaults[reqCol] || '';
            defaultInput.style.cssText = 'width:100%;padding:8px;border:1px solid #e0e0e0;border-radius:5px;font-size:0.9em;';

            defaultInput.oninput = function() {
                state.customDefaults[reqCol] = this.value;
            };

            tdDefault.appendChild(defaultInput);
            tr.appendChild(tdDefault);

            tbody.appendChild(tr);
        });

        // Mostrar estado
        updateMappingStatus();
    }

    function updateMapping() {
        document.querySelectorAll('.mapping-select').forEach(select => {
            const reqCol = select.dataset.column;
            state.mapping[reqCol] = select.value;
        });

        // v4.5.1: Recoger valores por defecto del usuario
        document.querySelectorAll('.default-value-input').forEach(input => {
            const reqCol = input.dataset.column;
            state.customDefaults[reqCol] = input.value.trim();
        });

        updateMappingStatus();
    }

    function updateMappingStatus() {
        const template = getTemplate();
        const mapped = template.columns.filter(col => state.mapping[col]).length;
        const withDefault = template.columns.filter(col =>
            !state.mapping[col] && (state.customDefaults[col] || template.defaults[col] !== undefined)
        ).length;
        const unmapped = template.columns.filter(col =>
            !state.mapping[col] && !state.customDefaults[col] && template.defaults[col] === undefined
        ).length;
        const withTransform = template.columns.filter(col =>
            state.transformations[col] && state.transformations[col].length > 0
        ).length;

        const statusDiv = document.getElementById('mappingStatus');
        statusDiv.innerHTML = `
            <div style="display: flex; align-items: center; gap: 15px; flex-wrap: wrap;">
                <div style="display: flex; align-items: center; gap: 5px;">
                    <span style="font-size: 1.5em;">📊</span>
                    <strong>Estado del mapeo:</strong>
                </div>
                <div style="display: flex; gap: 20px; flex-wrap: wrap;">
                    <span style="color: #28a745;">✅ Mapeadas: ${mapped}/${template.columns.length}</span>
                    <span style="color: #ffc107;">🔧 Con valor por defecto: ${withDefault}</span>
                    <span style="color: #dc3545;">⚠️ Sin mapear: ${unmapped} (quedarán vacías)</span>
                    ${withTransform > 0 ? `<span style="color: #667eea;">🔄 Con transformaciones: ${withTransform}</span>` : ''}
                </div>
            </div>
        `;
    }

    // ============================================
    // DIVISIÓN DE COLUMNAS
    // ============================================
    let divisionState = {
        currentColumn: null,
        sourceColumn: null,
        sourceData: [],
        separator: '',
        columnNames: []
    };

    function openDivisionModal(columnName) {
        divisionState.currentColumn = columnName;
        divisionState.sourceColumn = state.mapping[columnName];
        
        if (!divisionState.sourceColumn) {
            alert('⚠️ Primero mapea esta columna a una columna de tu archivo');
            return;
        }
        
        // Obtener datos
        divisionState.sourceData = state.excelData.map(row => row[divisionState.sourceColumn] || '');
        
        // Mostrar modal
        document.getElementById('divisionModal').style.display = 'flex';
        document.getElementById('divisionColumnName').textContent = divisionState.sourceColumn;

        // Mostrar datos originales
        const previewHTML = divisionState.sourceData.slice(0, 5).map((val, idx) =>
            `<div style="padding: 8px; border-bottom: 1px solid #e0e0e0;">
                <strong>Fila ${idx + 1}:</strong> "${sanitizeHTML(val)}"
            </div>`
        ).join('');

        document.getElementById('originalData').innerHTML = previewHTML;

        // Limpiar
        document.getElementById('separatorInput').value = '';
        document.getElementById('livePreview').innerHTML = '<span style="color: #999;">Ingresa un separador para ver el preview...</span>';
        document.getElementById('namingSection').style.display = 'none';
    }

    function closeDivisionModal() {
        document.getElementById('divisionModal').style.display = 'none';
    }

    function setDivisionSeparator(sep) {
        document.getElementById('separatorInput').value = sep;
        updateDivisionPreview();
    }

    function updateDivisionPreview() {
        const separator = document.getElementById('separatorInput').value;

        if (!separator) {
            document.getElementById('livePreview').innerHTML = '<span style="color: #999;">Ingresa un separador...</span>';
            document.getElementById('namingSection').style.display = 'none';
            document.getElementById('applyBtn').disabled = true;
            return;
        }
        
        divisionState.separator = separator;
        
        // Preview
        const previewData = divisionState.sourceData.slice(0, 5).map((val, rowIdx) => {
            const parts = String(val).split(separator);
            return `
                <div style="padding: 10px; border: 1px solid #28a745; border-radius: 5px; margin-bottom: 10px; background: white;">
                    <strong>Fila ${rowIdx + 1}:</strong> "${sanitizeHTML(val)}"
                    <div style="margin-top: 5px; padding-left: 20px;">
                        ${parts.map((part, idx) => `
                            <div style="color: #667eea;">
                                → Parte ${idx + 1}: "<strong>${sanitizeHTML(part)}</strong>"
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }).join('');
        
        document.getElementById('livePreview').innerHTML = previewData;

        // Detectar número de partes
        const maxParts = Math.max(...divisionState.sourceData.map(val => String(val).split(separator).length));

        // Mostrar inputs de nombres
        showDivisionNaming(maxParts);

        document.getElementById('applyBtn').disabled = false;
        document.getElementById('applyBtn').style.opacity = '1';
    }

    function showDivisionNaming(numParts) {
        const html = Array.from({ length: numParts }, (_, i) => `
            <div style="margin-bottom: 10px;">
                <label style="display: block; margin-bottom: 5px; font-weight: 600;">
                    Nombre para Parte ${i + 1}:
                </label>
                <input 
                    type="text" 
                    class="division-part-name" 
                    data-index="${i}"
                    placeholder="Ej: apellidos, nombre, etc."
                    style="width: 100%; padding: 10px; border: 2px solid #667eea; border-radius: 5px;">
            </div>
        `).join('');
        
        document.getElementById('namingInputs').innerHTML = html;
        document.getElementById('namingSection').style.display = 'block';
    }

    function applyDivision() {
        // Obtener nombres
        const names = Array.from(document.querySelectorAll('.division-part-name')).map(input => {
            return input.value.trim() || `parte${input.dataset.index}`;
        });
        
        divisionState.columnNames = names;
        
        // Crear nuevas columnas
        const newColumns = names.map(name => `${divisionState.sourceColumn}_${name}`);
        
        // Procesar datos
        state.excelData.forEach(row => {
            const value = row[divisionState.sourceColumn] || '';
            const parts = String(value).split(divisionState.separator);
            
            names.forEach((name, idx) => {
                const newColName = `${divisionState.sourceColumn}_${name}`;
                row[newColName] = parts[idx] || '';
            });
        });
        
        // Agregar a columnas disponibles
        newColumns.forEach(col => {
            if (!state.excelColumns.includes(col)) {
                state.excelColumns.push(col);
            }
        });
        
        // Auto-mapear si coincide
        newColumns.forEach((newCol, idx) => {
            const partName = names[idx];
            const matchingRequired = Object.keys(state.mapping).find(req => 
                req.toLowerCase().includes(partName.toLowerCase()) ||
                partName.toLowerCase().includes(req.toLowerCase())
            );
            
            if (matchingRequired) {
                state.mapping[matchingRequired] = newCol;
            }
        });
        
        // Refrescar tabla
        renderMappingTable();
        
        // Cerrar modal
        closeDivisionModal();
        
        alert(`✅ División exitosa!\n\nColumnas creadas:\n${newColumns.join('\n')}`);
    }

    // Eventos del modal de división
    window.closeDivisionModal = closeDivisionModal;
    window.setDivisionSeparator = setDivisionSeparator;
    window.updateDivisionPreview = updateDivisionPreview;
    window.applyDivision = applyDivision;

    // ============================================
    // MODAL DE TRANSFORMACIONES v4.5.1
    // ============================================
    let transformState = {
        currentColumn: null,       // columna requerida
        sourceColumn: null,        // columna del archivo mapeada
        sourceData: [],            // datos originales
        selectedTransform: null,   // tipo de transformación seleccionada
        config: {}                 // configuración de la transformación
    };

    function openTransformModal(columnName) {
        transformState.currentColumn = columnName;
        transformState.sourceColumn = state.mapping[columnName];
        transformState.selectedTransform = null;
        transformState.config = {};

        if (!transformState.sourceColumn) {
            alert('⚠️ Primero mapea esta columna a una columna de tu archivo');
            return;
        }

        // Obtener datos
        transformState.sourceData = state.excelData.map(row => row[transformState.sourceColumn] || '');

        // Mostrar modal
        document.getElementById('transformModal').style.display = 'flex';
        document.getElementById('transformColumnName').textContent = transformState.sourceColumn;

        // Mostrar datos originales
        const previewHTML = transformState.sourceData.slice(0, 5).map((val, idx) =>
            `<div style="padding: 6px; border-bottom: 1px solid #e0e0e0;">
                <strong>Fila ${idx + 1}:</strong> "${sanitizeHTML(String(val))}"
            </div>`
        ).join('');
        document.getElementById('transformOriginalData').innerHTML = previewHTML;

        // Mostrar transformaciones aplicadas si hay
        renderAppliedTransforms();

        // Resetear áreas
        document.getElementById('transformConfigArea').style.display = 'none';
        document.getElementById('transformPreviewArea').style.display = 'none';
        document.getElementById('transformNamingSection').style.display = 'none';
        document.getElementById('applyTransformBtn').disabled = true;
        document.getElementById('applyTransformBtn').style.opacity = '0.5';

        // Deseleccionar botones
        document.querySelectorAll('.transform-option-btn').forEach(b => b.classList.remove('selected'));
    }

    function closeTransformModal() {
        document.getElementById('transformModal').style.display = 'none';
    }

    function renderAppliedTransforms() {
        const col = transformState.currentColumn;
        const transforms = state.transformations[col] || [];

        const listDiv = document.getElementById('appliedTransformsList');
        const contentDiv = document.getElementById('appliedTransformsContent');
        const clearBtn = document.getElementById('clearTransformsBtn');

        if (transforms.length === 0) {
            listDiv.style.display = 'none';
            clearBtn.style.display = 'none';
            return;
        }

        listDiv.style.display = 'block';
        clearBtn.style.display = 'inline-block';

        const labels = {
            uppercase: '🔠 MAYÚSCULAS',
            lowercase: '🔡 minúsculas',
            titlecase: '🔤 Título',
            trim: '🧹 Limpiar espacios',
            prefix: '➡️ Prefijo',
            suffix: '⬅️ Sufijo',
            replace: '🔄 Reemplazar',
            removeSpecial: '🚫 Quitar especiales'
        };

        contentDiv.innerHTML = transforms.map((t, idx) => {
            let detail = '';
            if (t.type === 'prefix') detail = ` → "${sanitizeHTML(t.value)}"`;
            if (t.type === 'suffix') detail = ` → "${sanitizeHTML(t.value)}"`;
            if (t.type === 'replace') detail = ` → "${sanitizeHTML(t.find)}" → "${sanitizeHTML(t.replaceWith)}"`;
            return `<div style="display:flex;align-items:center;gap:10px;padding:6px 0;border-bottom:1px solid #c8e6c9;">
                <span>${labels[t.type] || t.type}${detail}</span>
                <button onclick="removeTransform(${idx})" style="background:#dc3545;color:white;border:none;border-radius:50%;width:22px;height:22px;cursor:pointer;font-size:0.8em;">✖</button>
            </div>`;
        }).join('');
    }

    function removeTransform(idx) {
        const col = transformState.currentColumn;
        state.transformations[col].splice(idx, 1);
        renderAppliedTransforms();
        renderMappingTable();
    }

    function clearTransformations() {
        const col = transformState.currentColumn;
        state.transformations[col] = [];
        renderAppliedTransforms();
        renderMappingTable();
    }

    function selectTransform(type) {
        transformState.selectedTransform = type;

        // Marcar botón seleccionado
        document.querySelectorAll('.transform-option-btn').forEach(b => b.classList.remove('selected'));
        event.currentTarget.classList.add('selected');

        // Si es "divide", abrir el modal de división directamente
        if (type === 'divide') {
            closeTransformModal();
            openDivisionModal(transformState.currentColumn);
            return;
        }

        // Mostrar configuración según tipo
        const configArea = document.getElementById('transformConfigArea');
        const configTitle = document.getElementById('transformConfigTitle');
        const configContent = document.getElementById('transformConfigContent');
        configArea.style.display = 'block';

        switch (type) {
            case 'uppercase':
                configTitle.textContent = '🔠 Convertir a MAYÚSCULAS';
                configContent.innerHTML = '<p style="color:#666;">Se convertirá todo el texto a mayúsculas.</p>';
                enableTransformApply();
                showTransformPreview(type);
                break;

            case 'lowercase':
                configTitle.textContent = '🔡 Convertir a minúsculas';
                configContent.innerHTML = '<p style="color:#666;">Se convertirá todo el texto a minúsculas.</p>';
                enableTransformApply();
                showTransformPreview(type);
                break;

            case 'titlecase':
                configTitle.textContent = '🔤 Convertir a Título';
                configContent.innerHTML = '<p style="color:#666;">Primera letra de cada palabra en mayúscula.</p>';
                enableTransformApply();
                showTransformPreview(type);
                break;

            case 'trim':
                configTitle.textContent = '🧹 Limpiar espacios';
                configContent.innerHTML = '<p style="color:#666;">Se eliminarán espacios al inicio, al final y espacios dobles internos.</p>';
                enableTransformApply();
                showTransformPreview(type);
                break;

            case 'prefix':
                configTitle.textContent = '➡️ Agregar Prefijo';
                configContent.innerHTML = `
                    <input type="text" id="transformPrefixInput" placeholder="Texto a agregar al inicio..."
                        style="width:100%;padding:12px;border:2px solid #667eea;border-radius:8px;font-size:1.1em;font-family:monospace;"
                        oninput="onTransformConfigChange('prefix')">
                `;
                disableTransformApply();
                break;

            case 'suffix':
                configTitle.textContent = '⬅️ Agregar Sufijo';
                configContent.innerHTML = `
                    <input type="text" id="transformSuffixInput" placeholder="Texto a agregar al final..."
                        style="width:100%;padding:12px;border:2px solid #667eea;border-radius:8px;font-size:1.1em;font-family:monospace;"
                        oninput="onTransformConfigChange('suffix')">
                `;
                disableTransformApply();
                break;

            case 'replace':
                configTitle.textContent = '🔄 Buscar y Reemplazar';
                configContent.innerHTML = `
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
                        <div>
                            <label style="display:block;margin-bottom:5px;font-weight:600;">Buscar:</label>
                            <input type="text" id="transformFindInput" placeholder="Texto a buscar..."
                                style="width:100%;padding:10px;border:2px solid #667eea;border-radius:8px;font-family:monospace;"
                                oninput="onTransformConfigChange('replace')">
                        </div>
                        <div>
                            <label style="display:block;margin-bottom:5px;font-weight:600;">Reemplazar con:</label>
                            <input type="text" id="transformReplaceInput" placeholder="Texto de reemplazo..."
                                style="width:100%;padding:10px;border:2px solid #667eea;border-radius:8px;font-family:monospace;"
                                oninput="onTransformConfigChange('replace')">
                        </div>
                    </div>
                `;
                disableTransformApply();
                break;

            case 'removeSpecial':
                configTitle.textContent = '🚫 Quitar caracteres especiales';
                configContent.innerHTML = '<p style="color:#666;">Se eliminarán todos los caracteres que no sean letras, números o espacios.</p>';
                enableTransformApply();
                showTransformPreview(type);
                break;
        }
    }

    function onTransformConfigChange(type) {
        switch (type) {
            case 'prefix': {
                const val = document.getElementById('transformPrefixInput').value;
                if (val) {
                    transformState.config = { value: val };
                    enableTransformApply();
                    showTransformPreview('prefix');
                } else {
                    disableTransformApply();
                    document.getElementById('transformPreviewArea').style.display = 'none';
                }
                break;
            }
            case 'suffix': {
                const val = document.getElementById('transformSuffixInput').value;
                if (val) {
                    transformState.config = { value: val };
                    enableTransformApply();
                    showTransformPreview('suffix');
                } else {
                    disableTransformApply();
                    document.getElementById('transformPreviewArea').style.display = 'none';
                }
                break;
            }
            case 'replace': {
                const find = document.getElementById('transformFindInput').value;
                const replaceWith = document.getElementById('transformReplaceInput').value;
                if (find) {
                    transformState.config = { find, replaceWith: replaceWith || '' };
                    enableTransformApply();
                    showTransformPreview('replace');
                } else {
                    disableTransformApply();
                    document.getElementById('transformPreviewArea').style.display = 'none';
                }
                break;
            }
        }
    }

    function applyTransformToValue(value, transform) {
        let v = String(value);
        switch (transform.type) {
            case 'uppercase':
                return v.toUpperCase();
            case 'lowercase':
                return v.toLowerCase();
            case 'titlecase':
                return v.toLowerCase().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
            case 'trim':
                return v.trim().replace(/\s+/g, ' ');
            case 'prefix':
                return transform.value + v;
            case 'suffix':
                return v + transform.value;
            case 'replace':
                return v.split(transform.find).join(transform.replaceWith);
            case 'removeSpecial':
                return v.replace(/[^a-zA-Z0-9\sáéíóúÁÉÍÓÚñÑüÜ]/g, '');
            default:
                return v;
        }
    }

    function showTransformPreview(type) {
        const previewArea = document.getElementById('transformPreviewArea');
        const previewContent = document.getElementById('transformLivePreview');
        previewArea.style.display = 'block';

        const transform = { type, ...transformState.config };

        // Calcular el valor acumulado con transformaciones previas + la nueva
        const col = transformState.currentColumn;
        const existingTransforms = state.transformations[col] || [];

        const previewHTML = transformState.sourceData.slice(0, 5).map((val, idx) => {
            // Aplicar transformaciones existentes primero
            let current = String(val);
            existingTransforms.forEach(t => {
                current = applyTransformToValue(current, t);
            });
            const before = current;
            // Aplicar la nueva transformación
            const after = applyTransformToValue(current, transform);

            return `<div style="padding:8px;border-bottom:1px solid #c8e6c9;">
                <strong>Fila ${idx + 1}:</strong> "${sanitizeHTML(before)}" → "<strong style="color:#28a745;">${sanitizeHTML(after)}</strong>"
            </div>`;
        }).join('');

        previewContent.innerHTML = previewHTML;
    }

    function enableTransformApply() {
        document.getElementById('applyTransformBtn').disabled = false;
        document.getElementById('applyTransformBtn').style.opacity = '1';
    }

    function disableTransformApply() {
        document.getElementById('applyTransformBtn').disabled = true;
        document.getElementById('applyTransformBtn').style.opacity = '0.5';
    }

    function applyCurrentTransform() {
        const type = transformState.selectedTransform;
        if (!type) return;

        const col = transformState.currentColumn;
        if (!state.transformations[col]) {
            state.transformations[col] = [];
        }

        const transform = { type, ...transformState.config };
        state.transformations[col].push(transform);

        // Resetear UI del modal
        transformState.selectedTransform = null;
        transformState.config = {};
        document.querySelectorAll('.transform-option-btn').forEach(b => b.classList.remove('selected'));
        document.getElementById('transformConfigArea').style.display = 'none';
        document.getElementById('transformPreviewArea').style.display = 'none';
        disableTransformApply();

        // Refrescar lista de aplicadas
        renderAppliedTransforms();
        renderMappingTable();
    }

    // Eventos del modal de transformaciones
    window.openTransformModal = openTransformModal;
    window.closeTransformModal = closeTransformModal;
    window.selectTransform = selectTransform;
    window.onTransformConfigChange = onTransformConfigChange;
    window.applyCurrentTransform = applyCurrentTransform;
    window.removeTransform = removeTransform;
    window.clearTransformations = clearTransformations;

    // ============================================
    // PREVIEW Y GENERACIÓN
    // ============================================
    function generatePreview() {
        const template = getTemplate();

        // Generar CSV data
        const csvData = state.excelData.map(row => {
            const csvRow = {};
            template.columns.forEach(col => {
                if (state.mapping[col]) {
                    csvRow[col] = row[state.mapping[col]] || '';
                } else if (state.customDefaults[col]) {
                    // v4.5.1: Prioridad a custom defaults del usuario
                    csvRow[col] = state.customDefaults[col];
                } else if (template.defaults[col] !== undefined) {
                    csvRow[col] = template.defaults[col];
                } else {
                    csvRow[col] = '';
                }

                // v4.5.1: Aplicar transformaciones
                if (state.transformations[col] && state.transformations[col].length > 0) {
                    state.transformations[col].forEach(t => {
                        csvRow[col] = applyTransformToValue(csvRow[col], t);
                    });
                }
            });
            return csvRow;
        });
        
        // Mostrar preview
        document.getElementById('previewSection').style.display = 'block';
        
        const previewHTML = `
            <div style="overflow-x: auto;">
                <table class="preview-table">
                    <thead>
                        <tr>
                            ${template.columns.map(col => `<th>${sanitizeHTML(col)}</th>`).join('')}
                        </tr>
                    </thead>
                    <tbody>
                        ${csvData.slice(0, 10).map(row => `
                            <tr>
                                ${template.columns.map(col => `<td>${sanitizeHTML(row[col])}</td>`).join('')}
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            ${csvData.length > 10 ? `<p style="margin-top: 10px; color: #666;">Mostrando 10 de ${csvData.length} filas</p>` : ''}
        `;
        
        document.getElementById('previewTable').innerHTML = previewHTML;
        
        // Guardar para descarga
        window.generatedCSVData = csvData;
        
        // Scroll
        document.getElementById('previewSection').scrollIntoView({ 
            behavior: 'smooth', 
            block: 'center' 
        });
    }

    // ============================================
    // DESCARGA Y RESET
    // ============================================
    function setupDownload() {
        document.getElementById('downloadBtn').onclick = () => {
            if (!window.generatedCSVData) {
                alert('⚠️ Primero genera el preview');
                return;
            }
            
            const template = getTemplate();
            const csvContent = [
                template.columns.join(','),
                ...window.generatedCSVData.map(row =>
                    template.columns.map(col => {
                        const val = String(row[col] || '').replace(/"/g, '""');
                        return `"${val}"`;
                    }).join(',')
                )
            ].join('\n');

            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            const customName = document.getElementById('csvNameInput').value.trim();
            link.download = customName
                ? `${customName}.csv`
                : `${state.selectedProduct}_${state.selectedCommand}_${Date.now()}.csv`;
            link.click();
        };
    }

    function setupReset() {
        document.getElementById('resetBtn').onclick = () => {
            if (confirm('¿Seguro que quieres reiniciar? Se perderán todos los datos.')) {
                location.reload();
            }
        };
    }

})();