function parseVisibilityConfig(raw) {
    if (!raw)
        return { logic: "and", conditions: [] };
    try {
        const obj = JSON.parse(raw);
        // New format
        if (obj && Array.isArray(obj.conditions))
            return obj;
        // Legacy format { fieldId, value }
        if (obj && typeof obj.fieldId === "string") {
            return {
                logic: "and",
                conditions: [
                    {
                        fieldId: obj.fieldId,
                        operator: obj.value ? "equals" : "not_empty",
                        value: obj.value || undefined,
                    },
                ],
            };
        }
    }
    catch {
        // ignore
    }
    return { logic: "and", conditions: [] };
}
export { parseVisibilityConfig };
