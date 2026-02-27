// ============================================
// FORMAT LOADERS v4.0.0
// Soporte para XLSX, CSV, JSON, XML
// ============================================

const FormatLoaders = {
    
    // ============================================
    // XLSX LOADER (ya existente, mejorado)
    // ============================================
    async loadXLSX(file, hasHeader = true) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                    const rawData = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: '' });
                    
                    const result = this._processTabularData(rawData, hasHeader);
                    resolve(result);
                } catch (error) {
                    reject(new Error('Error al procesar XLSX: ' + error.message));
                }
            };
            
            reader.onerror = () => reject(new Error('Error al leer el archivo'));
            reader.readAsArrayBuffer(file);
        });
    },
    
    // ============================================
    // CSV LOADER (nuevo)
    // ============================================
    async loadCSV(file, options = {}) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (e) => {
                try {
                    const text = e.target.result;
                    
                    // Auto-detectar configuración
                    const config = this._detectCSVConfig(text, options);
                    
                    // Parsear con PapaParse
                    Papa.parse(text, {
                        delimiter: config.delimiter,
                        header: false,
                        skipEmptyLines: true,
                        encoding: config.encoding,
                        complete: (results) => {
                            try {
                                const result = this._processTabularData(
                                    results.data, 
                                    config.hasHeader
                                );
                                resolve(result);
                            } catch (error) {
                                reject(error);
                            }
                        },
                        error: (error) => {
                            reject(new Error('Error al parsear CSV: ' + error.message));
                        }
                    });
                } catch (error) {
                    reject(new Error('Error al procesar CSV: ' + error.message));
                }
            };
            
            reader.onerror = () => reject(new Error('Error al leer el archivo'));
            reader.readAsText(file, options.encoding || 'UTF-8');
        });
    },
    
    // Auto-detectar configuración CSV
    _detectCSVConfig(text, userOptions = {}) {
        const lines = text.split('\n').slice(0, 5); // Primeras 5 líneas
        const sample = lines.join('\n');
        
        // Detectar separador
        let delimiter = userOptions.delimiter;
        if (!delimiter) {
            const delimiters = [',', ';', '\t', '|'];
            let maxCount = 0;
            
            delimiters.forEach(d => {
                const count = (sample.match(new RegExp('\\' + d, 'g')) || []).length;
                if (count > maxCount) {
                    maxCount = count;
                    delimiter = d;
                }
            });
        }
        
        // Detectar si tiene headers
        let hasHeader = userOptions.hasHeader !== undefined ? userOptions.hasHeader : true;
        
        return {
            delimiter,
            hasHeader,
            encoding: userOptions.encoding || 'UTF-8'
        };
    },
    
    // ============================================
    // JSON LOADER (nuevo)
    // ============================================
    async loadJSON(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (e) => {
                try {
                    const text = e.target.result;
                    const json = JSON.parse(text);
                    
                    // Detectar estructura
                    const result = this._processJSON(json);
                    resolve(result);
                } catch (error) {
                    reject(new Error('Error al procesar JSON: ' + error.message));
                }
            };
            
            reader.onerror = () => reject(new Error('Error al leer el archivo'));
            reader.readAsText(file, 'UTF-8');
        });
    },
    
    _processJSON(json) {
        // Caso 1: Array de objetos
        if (Array.isArray(json) && json.length > 0 && typeof json[0] === 'object') {
            const columns = Object.keys(json[0]);
            const data = json.map(row => {
                const obj = {};
                columns.forEach(col => {
                    obj[col] = row[col] !== undefined ? String(row[col]) : '';
                });
                return obj;
            });
            
            return { columns, data };
        }
        
        // Caso 2: Objeto con arrays
        if (typeof json === 'object' && !Array.isArray(json)) {
            const columns = Object.keys(json);
            
            // Verificar que todos sean arrays
            const allArrays = columns.every(col => Array.isArray(json[col]));
            if (!allArrays) {
                throw new Error('JSON debe ser un array de objetos o un objeto con arrays');
            }
            
            // Obtener longitud máxima
            const maxLength = Math.max(...columns.map(col => json[col].length));
            
            // Convertir a formato estándar
            const data = [];
            for (let i = 0; i < maxLength; i++) {
                const obj = {};
                columns.forEach(col => {
                    obj[col] = json[col][i] !== undefined ? String(json[col][i]) : '';
                });
                data.push(obj);
            }
            
            return { columns, data };
        }
        
        throw new Error('Formato JSON no soportado. Usa: [{col1:val}, {col1:val}] o {col1:[val,val], col2:[val,val]}');
    },
    
    // ============================================
    // XML LOADER (nuevo)
    // ============================================
    async loadXML(file, options = {}) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (e) => {
                try {
                    const text = e.target.result;
                    const result = this._processXML(text, options);
                    resolve(result);
                } catch (error) {
                    reject(new Error('Error al procesar XML: ' + error.message));
                }
            };
            
            reader.onerror = () => reject(new Error('Error al leer el archivo'));
            reader.readAsText(file, 'UTF-8');
        });
    },
    
    _processXML(xmlText, options = {}) {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
        
        // Verificar errores de parseo
        const parseError = xmlDoc.querySelector('parsererror');
        if (parseError) {
            throw new Error('XML mal formado');
        }
        
        // Auto-detectar estructura si no se especifica
        let rowPath = options.rowPath;
        
        if (!rowPath) {
            // Buscar el primer elemento que se repite
            const root = xmlDoc.documentElement;
            const children = Array.from(root.children);
            
            if (children.length > 0) {
                const firstChildName = children[0].tagName;
                const count = children.filter(c => c.tagName === firstChildName).length;
                
                if (count > 1) {
                    rowPath = firstChildName;
                }
            }
        }
        
        if (!rowPath) {
            throw new Error('No se pudo detectar la estructura del XML. Especifica rowPath.');
        }
        
        // Obtener todas las filas
        const rows = xmlDoc.querySelectorAll(rowPath);
        
        if (rows.length === 0) {
            throw new Error(`No se encontraron elementos con el path: ${rowPath}`);
        }
        
        // Extraer columnas del primer elemento
        const firstRow = rows[0];
        const columns = [];
        
        // Obtener elementos hijos (no atributos por ahora)
        Array.from(firstRow.children).forEach(child => {
            if (!columns.includes(child.tagName)) {
                columns.push(child.tagName);
            }
        });
        
        // Convertir a formato estándar
        const data = Array.from(rows).map(row => {
            const obj = {};
            columns.forEach(col => {
                const element = row.querySelector(col);
                obj[col] = element ? (element.textContent || '').trim() : '';
            });
            return obj;
        });
        
        return { columns, data };
    },
    
    // ============================================
    // PROCESADOR COMÚN (tabular data)
    // ============================================
    _processTabularData(rawData, hasHeader = true) {
        if (!rawData || rawData.length === 0) {
            throw new Error('No hay datos para procesar');
        }
        
        let columns, dataRows;
        
        if (hasHeader) {
            columns = rawData[0].map(h => String(h).trim());
            dataRows = rawData.slice(1);
        } else {
            // Generar nombres de columnas: A, B, C, ... Z, AA, AB, ...
            const numColumns = rawData[0].length;
            columns = Array.from({ length: numColumns }, (_, i) => {
                let columnLetter = '';
                let num = i;
                while (num >= 0) {
                    columnLetter = String.fromCharCode(65 + (num % 26)) + columnLetter;
                    num = Math.floor(num / 26) - 1;
                }
                return `Columna ${columnLetter}`;
            });
            dataRows = rawData;
        }
        
        // Convertir a objetos
        const data = dataRows.map(row => {
            const obj = {};
            columns.forEach((col, idx) => {
                obj[col] = row[idx] !== undefined ? String(row[idx]).trim() : '';
            });
            return obj;
        });
        
        return { columns, data };
    }
};