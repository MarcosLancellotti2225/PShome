// ============================================
// TRANSFORMATIONS ENGINE v4.0.0
// Sistema completo de transformaciones
// ============================================

const Transformations = {
    
    // ============================================
    // DIVISIÓN SIMPLE
    // ============================================
    split(data, sourceColumn, separator, partNames) {
        const newColumns = partNames.map(name => `${sourceColumn}_${name}`);
        
        // Procesar datos
        data.forEach(row => {
            const value = row[sourceColumn] || '';
            const parts = String(value).split(separator);
            
            partNames.forEach((name, idx) => {
                const newColName = `${sourceColumn}_${name}`;
                row[newColName] = parts[idx] || '';
            });
        });
        
        return {
            newColumns,
            data
        };
    },
    
    // ============================================
    // DIVISIÓN MÚLTIPLE (nuevo)
    // ============================================
    splitMultiple(data, sourceColumn, config) {
        /*
        config = {
            separators: [',', ' '],  // Separadores en orden
            partNames: ['apellido1', 'apellido2', 'nombre1', 'nombre2']
        }
        
        Ejemplo: "GARCIA,PEREZ JUAN CARLOS"
        separators[0] = ',' → ["GARCIA", "PEREZ JUAN CARLOS"]
        separators[1] = ' ' en parte 1 → ["GARCIA", "PEREZ JUAN CARLOS"]
                              en parte 2 → ["GARCIA", "PEREZ", "JUAN", "CARLOS"]
        */
        
        const newColumns = config.partNames.map(name => `${sourceColumn}_${name}`);
        
        data.forEach(row => {
            const value = row[sourceColumn] || '';
            let parts = [value];
            
            // Aplicar separadores secuencialmente
            config.separators.forEach((sep, sepIdx) => {
                const newParts = [];
                parts.forEach(part => {
                    const subParts = String(part).split(sep);
                    newParts.push(...subParts);
                });
                parts = newParts;
            });
            
            // Asignar a las columnas
            config.partNames.forEach((name, idx) => {
                const newColName = `${sourceColumn}_${name}`;
                row[newColName] = parts[idx] || '';
            });
        });
        
        return {
            newColumns,
            data
        };
    },
    
    // ============================================
    // DIVISIÓN CON LÍMITE (nuevo)
    // ============================================
    splitLimit(data, sourceColumn, separator, limit, partNames) {
        /*
        Ejemplo: "marcos,lancellotti,quagliardi" con limit=2
        → ["marcos", "lancellotti,quagliardi"]
        */
        
        const newColumns = partNames.map(name => `${sourceColumn}_${name}`);
        
        data.forEach(row => {
            const value = row[sourceColumn] || '';
            const parts = String(value).split(separator, limit);
            
            // Si hay más texto después del límite, agregarlo a la última parte
            if (limit > 0) {
                const fullSplit = String(value).split(separator);
                if (fullSplit.length > limit) {
                    parts[limit - 1] = fullSplit.slice(limit - 1).join(separator);
                }
            }
            
            partNames.forEach((name, idx) => {
                const newColName = `${sourceColumn}_${name}`;
                row[newColName] = parts[idx] || '';
            });
        });
        
        return {
            newColumns,
            data
        };
    },
    
    // ============================================
    // COMBINAR COLUMNAS (nuevo)
    // ============================================
    combine(data, sourceColumns, targetColumn, separator = ' ') {
        data.forEach(row => {
            const values = sourceColumns.map(col => row[col] || '');
            row[targetColumn] = values.filter(v => v).join(separator);
        });
        
        return {
            newColumns: [targetColumn],
            data
        };
    },
    
    // ============================================
    // EXTRACCIÓN CON REGEX (nuevo)
    // ============================================
    extractRegex(data, sourceColumn, pattern, groupNames) {
        /*
        Ejemplo: pattern = /(\w+)@(\w+\.com)/
        groupNames = ['usuario', 'dominio']
        */
        
        const regex = new RegExp(pattern);
        const newColumns = groupNames.map(name => `${sourceColumn}_${name}`);
        
        data.forEach(row => {
            const value = row[sourceColumn] || '';
            const match = String(value).match(regex);
            
            groupNames.forEach((name, idx) => {
                const newColName = `${sourceColumn}_${name}`;
                // match[0] es el match completo, match[1] es el primer grupo
                row[newColName] = match && match[idx + 1] ? match[idx + 1] : '';
            });
        });
        
        return {
            newColumns,
            data
        };
    },
    
    // ============================================
    // REEMPLAZAR TEXTO (nuevo)
    // ============================================
    replace(data, sourceColumn, find, replaceWith, targetColumn = null) {
        const target = targetColumn || sourceColumn;
        const isRegex = find instanceof RegExp;
        
        data.forEach(row => {
            const value = row[sourceColumn] || '';
            
            if (isRegex) {
                row[target] = String(value).replace(find, replaceWith);
            } else {
                row[target] = String(value).split(find).join(replaceWith);
            }
        });
        
        return {
            newColumns: targetColumn ? [targetColumn] : [],
            data
        };
    },
    
    // ============================================
    // TRANSFORMAR MAYÚSCULAS/MINÚSCULAS (nuevo)
    // ============================================
    changeCase(data, sourceColumn, caseType, targetColumn = null) {
        /*
        caseType: 'upper', 'lower', 'title', 'sentence'
        */
        
        const target = targetColumn || sourceColumn;
        
        data.forEach(row => {
            const value = row[sourceColumn] || '';
            let transformed = value;
            
            switch (caseType) {
                case 'upper':
                    transformed = String(value).toUpperCase();
                    break;
                case 'lower':
                    transformed = String(value).toLowerCase();
                    break;
                case 'title':
                    transformed = String(value)
                        .toLowerCase()
                        .split(' ')
                        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                        .join(' ');
                    break;
                case 'sentence':
                    transformed = String(value).charAt(0).toUpperCase() + 
                                  String(value).slice(1).toLowerCase();
                    break;
            }
            
            row[target] = transformed;
        });
        
        return {
            newColumns: targetColumn ? [targetColumn] : [],
            data
        };
    },
    
    // ============================================
    // TRIM Y LIMPIEZA (nuevo)
    // ============================================
    clean(data, sourceColumn, options = {}, targetColumn = null) {
        /*
        options: {
            trim: true,
            removeExtraSpaces: true,
            removeSpecialChars: false,
            removeNumbers: false
        }
        */
        
        const target = targetColumn || sourceColumn;
        
        data.forEach(row => {
            let value = row[sourceColumn] || '';
            
            if (options.trim) {
                value = String(value).trim();
            }
            
            if (options.removeExtraSpaces) {
                value = String(value).replace(/\s+/g, ' ');
            }
            
            if (options.removeSpecialChars) {
                value = String(value).replace(/[^a-zA-Z0-9\s]/g, '');
            }
            
            if (options.removeNumbers) {
                value = String(value).replace(/\d/g, '');
            }
            
            row[target] = value;
        });
        
        return {
            newColumns: targetColumn ? [targetColumn] : [],
            data
        };
    },
    
    // ============================================
    // SUBSTRING / SLICE (nuevo)
    // ============================================
    substring(data, sourceColumn, start, length, targetColumn) {
        data.forEach(row => {
            const value = row[sourceColumn] || '';
            row[targetColumn] = String(value).substring(start, start + length);
        });
        
        return {
            newColumns: [targetColumn],
            data
        };
    },
    
    // ============================================
    // PADDING (nuevo)
    // ============================================
    pad(data, sourceColumn, totalLength, padChar = '0', padLeft = true, targetColumn = null) {
        const target = targetColumn || sourceColumn;
        
        data.forEach(row => {
            const value = String(row[sourceColumn] || '');
            
            if (padLeft) {
                row[target] = value.padStart(totalLength, padChar);
            } else {
                row[target] = value.padEnd(totalLength, padChar);
            }
        });
        
        return {
            newColumns: targetColumn ? [targetColumn] : [],
            data
        };
    },
    
    // ============================================
    // CONDICIONAL (nuevo)
    // ============================================
    conditional(data, sourceColumn, conditions, targetColumn) {
        /*
        conditions = [
            { if: (value) => value > 100, then: 'Alto' },
            { if: (value) => value > 50, then: 'Medio' },
            { else: 'Bajo' }
        ]
        */
        
        data.forEach(row => {
            const value = row[sourceColumn];
            let result = '';
            
            for (const condition of conditions) {
                if (condition.else) {
                    result = condition.else;
                    break;
                }
                
                if (condition.if(value)) {
                    result = condition.then;
                    break;
                }
            }
            
            row[targetColumn] = result;
        });
        
        return {
            newColumns: [targetColumn],
            data
        };
    }
};