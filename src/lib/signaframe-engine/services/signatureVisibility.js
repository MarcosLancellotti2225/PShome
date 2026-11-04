import { collectHiddenFieldIds, computeButtonOverrides, getAllDefinitionFields, isFieldVisible, } from './formValidation.js';
export function computeSignatureVisibility(templates) {
    const visible = new Set();
    const hidden = new Set();
    const visibilityByFieldId = {};
    const visibilityByTemplateId = {};
    const fields = [];
    for (const tpl of templates) {
        const definition = tpl.formDefinition ?? null;
        if (!definition)
            continue;
        const allFields = getAllDefinitionFields(definition);
        const hiddenByContainer = collectHiddenFieldIds(definition, tpl.data);
        const overrides = computeButtonOverrides(definition.sections, tpl.data);
        for (const field of allFields) {
            if (field.type !== 'signature')
                continue;
            const fieldVisible = !hiddenByContainer.has(field.id) &&
                isFieldVisible(field, tpl.data, allFields, overrides, definition.sections);
            if (fieldVisible)
                visible.add(field.id);
            else
                hidden.add(field.id);
            visibilityByFieldId[field.id] = fieldVisible;
            if (tpl.templateId) {
                visibilityByTemplateId[tpl.templateId] = visibilityByTemplateId[tpl.templateId] ?? {};
                visibilityByTemplateId[tpl.templateId][field.id] = fieldVisible;
            }
            fields.push({ templateId: tpl.templateId, fieldId: field.id, visible: fieldVisible });
        }
    }
    return {
        visibleFieldIds: Array.from(visible),
        hiddenFieldIds: Array.from(hidden),
        visibilityByFieldId,
        visibilityByTemplateId,
        fields,
    };
}
