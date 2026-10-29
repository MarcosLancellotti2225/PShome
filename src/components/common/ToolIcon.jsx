import {
  Send, FileSpreadsheet, Mail, GanttChart, FileJson, FileText, FileCog, Table, Table2,
  PenTool, Palette, Ticket, Users, Upload, Download, Code, LayoutDashboard, MessageSquare,
  KeyRound, ShieldCheck, Workflow, ClipboardList, Wrench,
} from 'lucide-react';

// Íconos disponibles para src/config/tools.js (campo `icon`).
// Para usar uno nuevo de https://lucide.dev/icons, importalo arriba y sumalo acá.
const ICONS = {
  Send, FileSpreadsheet, Mail, GanttChart, FileJson, FileText, FileCog, Table, Table2,
  PenTool, Palette, Ticket, Users, Upload, Download, Code, LayoutDashboard, MessageSquare,
  KeyRound, ShieldCheck, Workflow, ClipboardList, Wrench,
};

export default function ToolIcon({ name, ...props }) {
  const Icon = ICONS[name] || Wrench;
  return <Icon {...props} />;
}
