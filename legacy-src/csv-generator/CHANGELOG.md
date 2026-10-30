# 📝 CHANGELOG

## v3.3.0 (2025-02-25)

### 🐛 Critical Bug Fix

**Problema encontrado:** Modal de división mostraba datos vacíos (`""`)

**Causa raíz:** 
- El código usaba `row[índiceNumérico]` para acceder a los datos
- Pero los datos están almacenados como objetos: `{columna: valor}`
- Esto causaba que `row[2]` devolviera `undefined`

**Solución implementada:**
```javascript
// ANTES
const value = row[colIndex];  // ❌ undefined con objetos

// AHORA  
const value = row[excelColumn];  // ✅ funciona correctamente
```

**Archivos modificados:**
- `app.js` - Función `openDivisionModal()` 
- `app.js` - Función `applyDivision()`

**Cambios:**
- ✅ Extracción de datos usa nombres de columna
- ✅ Preview muestra datos reales
- ✅ División aplica correctamente
- ✅ Nuevas columnas se crean como objetos

---

## v3.2.0 (2025-02-25)

### 🎉 Major Update - Auto-detección de Separadores

#### Nueva Funcionalidad
- **Auto-detección automática del separador más probable**
- Botones rápidos para separadores comunes
- Sugerencia visual del separador detectado

#### Características
- ✅ Detecta automáticamente: `, ` (coma + espacio)
- ✅ Detecta automáticamente: `,` (solo coma)
- ✅ Detecta automáticamente: `;` `-` y otros
- ✅ Botones rápidos: coma+espacio, coma, espacio, punto y coma, guión
- ✅ Tip visual para casos como "APELLIDO, NOMBRE"
- ✅ Botón "Usar este separador" para un click

#### Mejoras
- Interfaz más intuitiva para usuarios
- No requiere adivinar el separador
- Preview aparece con un click
- Ideal para archivos con formato "APELLIDO, NOMBRE"

#### Ejemplo Real
```
Dato: "CIRUGEDA GARCIA, MANUEL"
Auto-detecta: ", " (coma + espacio)
Muestra: ✅ Usar este separador
Click → Preview instantáneo
```

---

## v3.1.0 (2025-02-25)

### 🎉 Major Update - División Visual Simple

#### Nueva Funcionalidad
- **Preview EN VIVO que SÍ funciona**
- Interfaz completamente rediseñada
- Sistema simple de 3 pasos: Separador → Nombrar → Aplicar

#### Características
- ✅ Muestra datos originales (primeras 3 filas)
- ✅ Input de separador con actualización en tiempo real
- ✅ Preview automático en formato tabla
- ✅ Inputs dinámicos para nombrar partes
- ✅ Validación automática
- ✅ Vista clara del antes/después

#### Mejoras vs v3.0.x
- ❌ Eliminado constructor complejo con bloques
- ❌ Eliminados 4 tipos de bloques confusos
- ✅ Interfaz mucho más simple e intuitiva
- ✅ Preview que realmente funciona
- ✅ Usuario ve exactamente qué va a pasar

#### Archivos
- index.html - 336 líneas (reducido)
- app.js - 900 líneas (simplificado)
- styles.css - Sin cambios

---

## v3.0.1 (2025-02-25)

### ✅ Fixed
- Producto selector funcionando correctamente
- IvSign muestra 11 comandos filtrados
- IvNeos muestra 3 comandos filtrados
- Tarjetas de productos con estados visuales (selected/hover)
- Constructor visual operativo

### 🎨 UI/UX
- Selector de productos con iconos emoji
- IvSign: Nube flotante ☁️
- IvNeos: Tres sobres ✉️
- Versión visible en badge superior derecho

---

## v3.0.0 (2025-02-25)

### 🚀 Major Update - Constructor Visual de Columnas

#### Nueva Funcionalidad
- Constructor visual por bloques para dividir/unir columnas
- 4 tipos de bloques:
  - 🆕 Nueva Columna
  - 📝 Texto Fijo
  - 🗑️ Descartar
  - 📋 Usar Columna Existente

#### Características
- Preview en tiempo real
- Bloques ilimitados
- Reordenar con flechas ⬆️⬇️
- Separadores personalizables
- Nombres automáticos: `ColumnaOrigen_nombre`
- Validación automática

#### Productos
- IvSign: 11 comandos (Users, Certs, Delegs, Rules)
- IvNeos: 3 comandos (Clientes, Grupos, Usuarios)

#### Archivos
- index.html - Interfaz principal con selector de productos
- styles.css - Estilos + animaciones + product cards
- app.js - Lógica + Constructor visual
- README.md - Documentación completa

---

## v2.2.0 (2025-02-25)

### Added
- Split simple con modal
- Separadores básicos (espacio, coma, guión, custom)
- Preview de división

### Fixed
- Error "Cannot set properties of null"
- Bug de "undefined" en transformaciones

---

## v2.1.0 (2025-02-25)

### Added
- Sistema de transformaciones de columnas
- Versión visible en HTML
- Badge de versión en interfaz

### Fixed
- Modal de transformaciones con datos correctos
- Mapeo antes de abrir modal

---

## v2.0.0 (2025-02-25)

### Added
- IvNeos product support (3 comandos)
- Sistema complejo de transformaciones (4 tipos)
- Logos en CSS puro

---

## v1.0.0 (2025-02-24)

### Initial Release
- Soporte para IvSign (11 comandos)
- Mapeo automático de columnas
- Carga/procesamiento de Excel
- Generación de CSV
- Templates vacíos
