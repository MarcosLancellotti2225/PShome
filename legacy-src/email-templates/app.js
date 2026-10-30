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
    'sign_button': 'Boton de Signaturit (sign_request, signatures_request y pending_sign)',
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
    buttonWidth: '200',
    buttonFontSize: '18',
    buttonLineHeight: '22',
    buttonFontWeight: 'normal',
    buttonNoWrap: 'yes',
    textFontSize: '16',
    textLineHeight: '24',
    textLetterSpacing: '0',
    textAlign: 'left',
    textFontWeight: 'normal',
    footerEnabled: 'no',
    footerWidth: '100',
    footerContent: '',
    footerImageUrl: '',
    footerImageWidth: '150px',
    footerImageHeight: 'auto',
    footerBgColor: '#3d3d3d',
    footerTextColor: '#ffffff',
    footerFontSize: '12',
    footerLineHeight: '18',
    footerTextAlign: 'center',
    footerBorderColor: '#cccccc',
    footerBorderTop: '0',
    footerBorderRight: '0',
    footerBorderBottom: '0',
    footerBorderLeft: '0',
    footerPaddingTop: '15',
    footerPaddingRight: '25',
    footerPaddingBottom: '15',
    footerPaddingLeft: '25'
};

// Todos los tipos de template posibles (nombres oficiales de la API de Signaturit)
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

// Mapeo de nombres que la API devuelve (shorthand) a nombres oficiales
const API_NAME_MAP = {
    'sign_receipt': 'signatures_receipt',
    'email_request': 'emails_request'
};

// Normalizar nombre de template de la API a nombre oficial
function normalizeTemplateName(name) {
    return API_NAME_MAP[name] || name;
}

// Magic words obligatorias por tipo de template
const REQUIRED_MAGIC_WORDS = {
    signatures_request: ['{{sign_button}}'],
    pending_sign: ['{{sign_button}}'],
    emails_request: ['{{email_button}}'],
    validation_request: ['{{validate_button}}']
};

// Magic words PERMITIDAS por tipo de template
// Si un template no está en esta lista, solo se permiten las universales
const UNIVERSAL_MAGIC_WORDS = ['{{signer_name}}', '{{signer_email}}', '{{sender_email}}', '{{filename}}', '{{logo}}'];
const ALLOWED_MAGIC_WORDS = {
    sign_request: [...UNIVERSAL_MAGIC_WORDS, '{{sign_button}}'],
    signatures_request: [...UNIVERSAL_MAGIC_WORDS, '{{sign_button}}', '{{email_body}}'],
    signatures_receipt: [...UNIVERSAL_MAGIC_WORDS],
    request_expired: [...UNIVERSAL_MAGIC_WORDS],
    pending_sign: [...UNIVERSAL_MAGIC_WORDS, '{{sign_button}}', '{{remaining_time}}'],
    document_canceled: [...UNIVERSAL_MAGIC_WORDS],
    emails_request: [...UNIVERSAL_MAGIC_WORDS, '{{email_button}}', '{{email_body}}'],
    validation_request: [...UNIVERSAL_MAGIC_WORDS, '{{validate_button}}'],
    signed_document: [...UNIVERSAL_MAGIC_WORDS, '{{signers}}'],
    document_declined: [...UNIVERSAL_MAGIC_WORDS, '{{reason}}', '{{dashboard_button}}'],
    request_expired_requester: [...UNIVERSAL_MAGIC_WORDS]
};

// ═══════════════════════════════════
//  TEMPLATES PREDEFINIDOS POR IDIOMA
// ═══════════════════════════════════

const EMAIL_TEMPLATES = {
    es: {
        sign_request: {
            subject: 'Solicitud de firma',
            content: 'Estimado/a {{signer_name}},\n\nLe hacemos llegar la siguiente documentacion para su firma:\n\n{{filename}}\n\nPor favor, revise el documento y proceda a firmarlo haciendo clic en el siguiente boton:\n\n{{sign_button}}\n\nSi tiene alguna duda, puede contactarnos en {{sender_email}}.\n\nSaludos cordiales.'
        },
        signatures_request: {
            subject: 'Solicitud de firmas',
            content: 'Estimado/a {{signer_name}},\n\nTiene documentacion pendiente de firma:\n\n{{filename}}\n\n{{email_body}}\n\nPara firmar, haga clic en el siguiente boton:\n\n{{sign_button}}\n\nPara cualquier consulta, contacte con {{sender_email}}.\n\nSaludos cordiales.'
        },
        signatures_receipt: {
            subject: 'Confirmacion de firma',
            content: 'Estimado/a {{signer_name}},\n\nLe confirmamos que el siguiente documento ha sido firmado correctamente:\n\n{{filename}}\n\nTodos los firmantes han completado el proceso.\n\nPuede descargar el documento firmado desde su panel.\n\nSaludos cordiales.'
        },
        request_expired: {
            subject: 'Solicitud expirada',
            content: 'Estimado/a {{signer_name}},\n\nLe informamos que la solicitud de firma del siguiente documento ha expirado:\n\n{{filename}}\n\nLa fecha limite era: {{remaining_time}}\n\nSi aun necesita firmar, contacte con {{sender_email}} para solicitar un nuevo envio.\n\nSaludos cordiales.'
        },
        pending_sign: {
            subject: 'Recordatorio de firma pendiente',
            content: 'Estimado/a {{signer_name}},\n\nLe recordamos que tiene pendiente la firma del siguiente documento:\n\n{{filename}}\n\nFecha limite: {{remaining_time}}\n\nPor favor, proceda a firmarlo cuanto antes haciendo clic en:\n\n{{sign_button}}\n\nSaludos cordiales.'
        },
        document_canceled: {
            subject: 'Documento cancelado',
            content: 'Estimado/a {{signer_name}},\n\nLe informamos que la solicitud de firma del siguiente documento ha sido cancelada:\n\n{{filename}}\n\nSi tiene alguna pregunta, contacte con {{sender_email}}.\n\nSaludos cordiales.'
        },
        emails_request: {
            subject: 'Solicitud por email',
            content: 'Estimado/a {{signer_name}},\n\nTiene una nueva solicitud pendiente:\n\n{{filename}}\n\n{{email_body}}\n\nPara proceder, haga clic en el siguiente boton:\n\n{{email_button}}\n\nSaludos cordiales.'
        },
        validation_request: {
            subject: 'Solicitud de validacion',
            content: 'Estimado/a {{signer_name}},\n\nSe requiere la validacion del siguiente documento:\n\n{{filename}}\n\nPor favor, revise y valide el documento haciendo clic en:\n\n{{validate_button}}\n\nSaludos cordiales.'
        },
        signed_document: {
            subject: 'Documento firmado',
            content: 'Le informamos que el siguiente documento ha sido firmado:\n\n{{filename}}\n\nFirmantes:\n{{signers}}\n\nPuede descargar el documento firmado desde su panel de control.\n\nSaludos cordiales.'
        },
        document_declined: {
            subject: 'Documento rechazado',
            content: 'Le informamos que el siguiente documento ha sido rechazado:\n\n{{filename}}\n\nMotivo del rechazo: {{reason}}\n\nPara mas detalles, acceda a su panel:\n\n{{dashboard_button}}\n\nSaludos cordiales.'
        },
        request_expired_requester: {
            subject: 'Su solicitud ha expirado',
            content: 'Le informamos que la solicitud de firma que envio ha expirado:\n\n{{filename}}\n\nLos siguientes firmantes no completaron la firma a tiempo:\n{{signers}}\n\nPuede reenviar la solicitud desde su panel de control:\n\n{{dashboard_button}}\n\nSaludos cordiales.'
        }
    },
    en: {
        sign_request: {
            subject: 'Signature request',
            content: 'Dear {{signer_name}},\n\nPlease find attached the following document for your signature:\n\n{{filename}}\n\nPlease review the document and proceed to sign it by clicking the button below:\n\n{{sign_button}}\n\nIf you have any questions, please contact us at {{sender_email}}.\n\nBest regards.'
        },
        signatures_request: {
            subject: 'Signatures request',
            content: 'Dear {{signer_name}},\n\nYou have documentation pending signature:\n\n{{filename}}\n\n{{email_body}}\n\nTo sign, please click the button below:\n\n{{sign_button}}\n\nFor any questions, please contact {{sender_email}}.\n\nBest regards.'
        },
        signatures_receipt: {
            subject: 'Signature confirmation',
            content: 'Dear {{signer_name}},\n\nWe confirm that the following document has been successfully signed:\n\n{{filename}}\n\nAll signers have completed the process.\n\nYou can download the signed document from your dashboard.\n\nBest regards.'
        },
        request_expired: {
            subject: 'Request expired',
            content: 'Dear {{signer_name}},\n\nWe inform you that the signature request for the following document has expired:\n\n{{filename}}\n\nThe deadline was: {{remaining_time}}\n\nIf you still need to sign, please contact {{sender_email}} to request a new submission.\n\nBest regards.'
        },
        pending_sign: {
            subject: 'Pending signature reminder',
            content: 'Dear {{signer_name}},\n\nThis is a reminder that you have a pending signature for the following document:\n\n{{filename}}\n\nDeadline: {{remaining_time}}\n\nPlease proceed to sign as soon as possible by clicking:\n\n{{sign_button}}\n\nBest regards.'
        },
        document_canceled: {
            subject: 'Document canceled',
            content: 'Dear {{signer_name}},\n\nWe inform you that the signature request for the following document has been canceled:\n\n{{filename}}\n\nIf you have any questions, please contact {{sender_email}}.\n\nBest regards.'
        },
        emails_request: {
            subject: 'Email request',
            content: 'Dear {{signer_name}},\n\nYou have a new pending request:\n\n{{filename}}\n\n{{email_body}}\n\nTo proceed, please click the button below:\n\n{{email_button}}\n\nBest regards.'
        },
        validation_request: {
            subject: 'Validation request',
            content: 'Dear {{signer_name}},\n\nValidation is required for the following document:\n\n{{filename}}\n\nPlease review and validate the document by clicking:\n\n{{validate_button}}\n\nBest regards.'
        },
        signed_document: {
            subject: 'Document signed',
            content: 'We inform you that the following document has been signed:\n\n{{filename}}\n\nSigners:\n{{signers}}\n\nYou can download the signed document from your control panel.\n\nBest regards.'
        },
        document_declined: {
            subject: 'Document declined',
            content: 'We inform you that the following document has been declined:\n\n{{filename}}\n\nReason for rejection: {{reason}}\n\nFor more details, access your dashboard:\n\n{{dashboard_button}}\n\nBest regards.'
        },
        request_expired_requester: {
            subject: 'Your request has expired',
            content: 'We inform you that the signature request you sent has expired:\n\n{{filename}}\n\nThe following signers did not complete the signature in time:\n{{signers}}\n\nYou can resend the request from your control panel:\n\n{{dashboard_button}}\n\nBest regards.'
        }
    },
    ca: {
        sign_request: {
            subject: 'Sol·licitud de signatura',
            content: 'Benvolgut/da {{signer_name}},\n\nLi fem arribar la seguent documentacio per a la seva signatura:\n\n{{filename}}\n\nSi us plau, revisi el document i procedeixi a signar-lo fent clic al seguent boto:\n\n{{sign_button}}\n\nSi te algun dubte, pot contactar-nos a {{sender_email}}.\n\nSalutacions cordials.'
        },
        signatures_request: {
            subject: 'Sol·licitud de signatures',
            content: 'Benvolgut/da {{signer_name}},\n\nTe documentacio pendent de signatura:\n\n{{filename}}\n\n{{email_body}}\n\nPer signar, faci clic al seguent boto:\n\n{{sign_button}}\n\nPer a qualsevol consulta, contacti amb {{sender_email}}.\n\nSalutacions cordials.'
        },
        signatures_receipt: {
            subject: 'Confirmacio de signatura',
            content: 'Benvolgut/da {{signer_name}},\n\nLi confirmem que el seguent document ha estat signat correctament:\n\n{{filename}}\n\nTots els signants han completat el proces.\n\nPot descarregar el document signat des del seu panell.\n\nSalutacions cordials.'
        },
        request_expired: {
            subject: 'Sol·licitud expirada',
            content: 'Benvolgut/da {{signer_name}},\n\nL\'informem que la sol·licitud de signatura del seguent document ha expirat:\n\n{{filename}}\n\nLa data limit era: {{remaining_time}}\n\nSi encara necessita signar, contacti amb {{sender_email}} per sol·licitar un nou enviament.\n\nSalutacions cordials.'
        },
        pending_sign: {
            subject: 'Recordatori de signatura pendent',
            content: 'Benvolgut/da {{signer_name}},\n\nLi recordem que te pendent la signatura del seguent document:\n\n{{filename}}\n\nData limit: {{remaining_time}}\n\nSi us plau, procedeixi a signar-lo com mes aviat millor fent clic a:\n\n{{sign_button}}\n\nSalutacions cordials.'
        },
        document_canceled: {
            subject: 'Document cancel·lat',
            content: 'Benvolgut/da {{signer_name}},\n\nL\'informem que la sol·licitud de signatura del seguent document ha estat cancel·lada:\n\n{{filename}}\n\nSi te alguna pregunta, contacti amb {{sender_email}}.\n\nSalutacions cordials.'
        },
        emails_request: {
            subject: 'Sol·licitud per email',
            content: 'Benvolgut/da {{signer_name}},\n\nTe una nova sol·licitud pendent:\n\n{{filename}}\n\n{{email_body}}\n\nPer procedir, faci clic al seguent boto:\n\n{{email_button}}\n\nSalutacions cordials.'
        },
        validation_request: {
            subject: 'Sol·licitud de validacio',
            content: 'Benvolgut/da {{signer_name}},\n\nEs requereix la validacio del seguent document:\n\n{{filename}}\n\nSi us plau, revisi i validi el document fent clic a:\n\n{{validate_button}}\n\nSalutacions cordials.'
        },
        signed_document: {
            subject: 'Document signat',
            content: 'L\'informem que el seguent document ha estat signat:\n\n{{filename}}\n\nSignants:\n{{signers}}\n\nPot descarregar el document signat des del seu panell de control.\n\nSalutacions cordials.'
        },
        document_declined: {
            subject: 'Document rebutjat',
            content: 'L\'informem que el seguent document ha estat rebutjat:\n\n{{filename}}\n\nMotiu del rebuig: {{reason}}\n\nPer mes detalls, accedeixi al seu panell:\n\n{{dashboard_button}}\n\nSalutacions cordials.'
        },
        request_expired_requester: {
            subject: 'La seva sol·licitud ha expirat',
            content: 'L\'informem que la sol·licitud de signatura que va enviar ha expirat:\n\n{{filename}}\n\nEls seguents signants no van completar la signatura a temps:\n{{signers}}\n\nPot reenviar la sol·licitud des del seu panell de control:\n\n{{dashboard_button}}\n\nSalutacions cordials.'
        }
    }
};

const TEMPLATE_LANGUAGE_NAMES = {
    es: 'Espanol',
    en: 'English',
    ca: 'Catala',
    signaturit: 'Signaturit (default)'
};

// ═══════════════════════════════════
//  TEMPLATES HTML COMPLETOS (Signbook)
// ═══════════════════════════════════

const SIGNBOOK_BUTTON = function(magicWord) {
    return '<table class="miboton" align="center" style="width:200px;background:#0056b3;">' +
        '<tr><td style="padding:0cm 0cm 0cm 0cm;line-height:12px">' +
        '<p style="text-align:center;">' +
        '<span class="mititulo" style="font-size:12px;font-family:Arial;color:white;text-transform:none !important;">' + magicWord + '</span>' +
        '</p></td></tr></table>';
};

const SIGNBOOK_P = function(text, padded) {
    var pad = padded ? ' padding:10px;' : '';
    return '<p style="margin:0 0 12px 0;font-size:16px;line-height:24px;font-family:Helvetica Neue, Helvetica, Arial;' + pad + '">' + text + '</p>';
};

function buildSignbookHTML(bodyHTML) {
    return '<!DOCTYPE html>' +
        '<html lang="es" xmlns="http://www.w3.org/1999/xhtml" xmlns:o="urn:schemas-microsoft-com:office:office">' +
        '<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
        '<style>table, td, div, h1, p {font-family: Helvetica Neue, Helvetica, Arial;}</style></head>' +
        '<body style="margin:0;padding:0;background-color: #f6f6f6;">' +
        '<table role="presentation" style="width:100%;border-collapse:collapse;border:0;border-spacing:0;margin:30px 0px;">' +
        '<tr><td align="center" style="padding:0;">' +
        '<table role="presentation" style="width:800px;border-collapse:collapse;border:1px solid #cccccc;border-spacing:0;text-align:left;background:#ffffff">' +
        '<tr><td align="center" style="padding:30px 0 20px 0;">' +
        '<img width="300px" height="auto" style="width:300px;height:auto;display:block;" alt="Logo" src="https://static.tech-value.es/LogoSignbook.jpg">' +
        '</td></tr>' +
        '<tr><td style="padding:10px 25px 0px 25px;">' +
        '<table role="presentation" style="width:100%;border-collapse:collapse;border:0;border-spacing:0;">' +
        '<tr><td style="padding:0 0 25px 0;color:#153643;">' +
        bodyHTML +
        '</td></tr></table></td></tr></table></td></tr></table></body></html>';
}

const SIGNBOOK_HTML_TEMPLATES = {
    es: {
        sign_request: buildSignbookHTML(
            SIGNBOOK_P('Estimado/a {{signer_name}}, le hacemos llegar la siguiente documentación para su firma:') +
            SIGNBOOK_P('{{filename}}', true) +
            SIGNBOOK_P('Para proceder con la revisión y firma de la documentación presione el siguiente botón:') +
            SIGNBOOK_BUTTON('{{sign_button}}')
        ),
        signatures_request: buildSignbookHTML(
            SIGNBOOK_P('Estimado/a {{signer_name}}, le hacemos llegar la siguiente documentación para firmar:') +
            SIGNBOOK_P('{{filename}}', true) +
            SIGNBOOK_P('Para proceder con la revisión de la documentación presione el siguiente botón:') +
            SIGNBOOK_BUTTON('{{sign_button}}') +
            SIGNBOOK_P('{{email_body}}')
        ),
        signatures_receipt: buildSignbookHTML(
            SIGNBOOK_P('Estimado/a {{signer_name}}, le adjuntamos una copia del documento que ha firmado electrónicamente.')
        ),
        request_expired: buildSignbookHTML(
            SIGNBOOK_P('Estimado/a {{signer_name}}, le informamos que ha expirado el proceso de firma de la siguiente documentación:') +
            SIGNBOOK_P('{{filename}}', true)
        ),
        pending_sign: buildSignbookHTML(
            SIGNBOOK_P('Estimado/a {{signer_name}}, nos gustaría recordarle que tiene una petición de firma pendiente para la siguiente documentación, que expirará el próximo {{remaining_time}}:') +
            SIGNBOOK_P('{{filename}}', true) +
            SIGNBOOK_P('Presione el siguiente botón para acceder a la documentación:') +
            SIGNBOOK_BUTTON('{{sign_button}}')
        ),
        document_canceled: buildSignbookHTML(
            SIGNBOOK_P('Estimado/a {{signer_name}}, le informamos que se ha cancelado el proceso de firma de la siguiente documentación:') +
            SIGNBOOK_P('{{filename}}', true)
        ),
        emails_request: buildSignbookHTML(
            SIGNBOOK_P('Estimado/a {{signer_name}}, le hacemos llegar la siguiente documentación:') +
            SIGNBOOK_P('{{filename}}', true) +
            SIGNBOOK_P('Para proceder con su revisión presione el siguiente botón:') +
            SIGNBOOK_BUTTON('{{email_button}}') +
            SIGNBOOK_P('{{email_body}}')
        ),
        validation_request: buildSignbookHTML(
            SIGNBOOK_P('Estimado/a {{signer_name}}, le hacemos llegar la siguiente documentación para su validación:') +
            SIGNBOOK_P('{{filename}}', true) +
            SIGNBOOK_P('Para proceder con la validación de la documentación presione el siguiente botón:') +
            SIGNBOOK_BUTTON('{{validate_button}}')
        ),
        signed_document: buildSignbookHTML(
            SIGNBOOK_P('Estimado/a {{signer_name}}, le informamos que se ha completado la firma de la siguiente documentación:') +
            SIGNBOOK_P('{{filename}}', true) +
            SIGNBOOK_P('Se adjunta una copia del documento firmado para su registro.')
        ),
        document_declined: buildSignbookHTML(
            SIGNBOOK_P('Estimado/a {{signer_name}}, le informamos que se ha rechazado la firma de la siguiente documentación:') +
            SIGNBOOK_P('{{filename}}', true) +
            SIGNBOOK_P('{{decline_reason}}')
        ),
        request_expired_requester: buildSignbookHTML(
            SIGNBOOK_P('Estimado/a {{signer_name}}, le informamos que ha expirado la solicitud de firma que envió para la siguiente documentación:') +
            SIGNBOOK_P('{{filename}}', true) +
            SIGNBOOK_P('Si lo desea, puede volver a enviar una nueva solicitud de firma desde su cuenta.')
        )
    }
};

const SIGNATURIT_DEFAULT_TEMPLATE = `<!DOCTYPE html>
<html lang="es" xmlns="http://www.w3.org/1999/xhtml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="x-apple-disable-message-reformatting">
  <title>Solicitud de Firma</title>
  <style>
    table, td, div, h1, p {font-family: 'Helvetica Neue', Helvetica, Arial;}
    body { margin:0; padding:0; background-color: #f5f5f5; }
  </style>
</head>
<body style="margin:0;padding:0;background-color: #f5f5f5;">
  <table role="presentation" style="width:100%;border-collapse:collapse;border:0;border-spacing:0;margin:30px 0px;">
    <tr>
      <td align="center" style="padding:0;">
        <table role="presentation" style="width:100%;max-width:600px;border-collapse:collapse;border:0;border-spacing:0;">
          <tr>
            <td align="center" style="padding:30px 20px;background-color:#ffffff;">
              {{logo}}
            </td>
          </tr>
        </table>
        <table role="presentation" style="width:100%;max-width:600px;border-collapse:collapse;border:0;border-spacing:0;background-color:#ffffff;">
          <tr>
            <td style="padding:40px 30px;">
              <p style="margin:0 0 20px 0;font-size:14px;line-height:20px;color:#333333;">
                Hola {{signer_name}},
              </p>
              <p style="margin:0 0 20px 0;font-size:14px;line-height:20px;color:#333333;">
                {{sender_email}} te ha enviado un documento para firmar a través de Signaturit.
              </p>
              <p style="margin:0 0 20px 0;font-size:14px;line-height:20px;color:#333333;">
                <strong>Documento:</strong>
              </p>
              <ul style="margin:0 0 20px 0;padding-left:20px;font-size:14px;line-height:20px;color:#333333;">
                <li>{{filename}}</li>
              </ul>
              <p style="margin:0 0 30px 0;font-size:14px;line-height:20px;color:#333333;">
                Para proceder con la lectura y firma, haz clic en el siguiente botón:
              </p>
              <table role="presentation" class="miboton" align="center" style="margin:0 0 40px 0;border-collapse:collapse;border:0;border-spacing:0;">
                <tr>
                  <td align="center" style="border-radius:6px;background-color:#6BA32D;">
                    <p style="margin:0;padding:12px 30px;font-size:14px;font-weight:bold;">
                      <span class="mititulo" style="color:#ffffff;text-decoration:none;">{{sign_button}}</span>
                    </p>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 15px 0;font-size:12px;line-height:18px;color:#666666;font-style:italic;">
                <strong>Aviso legal:</strong> este mensaje está destinado únicamente al titular de la cuenta de correo electrónico.
              </p>
              <ul style="margin:0 0 20px 0;padding-left:20px;font-size:12px;line-height:18px;color:#666666;font-style:italic;">
                <li style="margin-bottom:8px;">Si no eres el titular de la cuenta de correo electrónico, no abras ni firmes el documento.</li>
                <li>No reenvíes ni compartas este mensaje, ya que podría invalidar el proceso.</li>
              </ul>
              <p style="margin:0;font-size:11px;line-height:16px;color:#666666;font-style:italic;">
                La consulta y/o firma de documentos por parte de una persona distinta del destinatario constituye un delito penal de suplantación de identidad y falsificación de documentos.
              </p>
            </td>
          </tr>
        </table>
        <table role="presentation" style="width:100%;max-width:600px;border-collapse:collapse;border:0;border-spacing:0;background-color:#001a4d;">
          <tr>
            <td style="padding:40px 30px;">
              <p style="margin:0 0 15px 0;font-size:12px;line-height:18px;color:#ffffff;">
                <strong>Signaturit Group</strong> - A Namirial Company<br><br>
                Ivnosys Soluciones, S.L.U<br>
                Acceso Ademuz, 12 /Office 1 \\u2013 1st floor 46980 Paterna (Valencia)
              </p>
              <table role="presentation" style="margin:20px 0 0 0;border-collapse:collapse;border:0;border-spacing:0;">
                <tr>
                  <td style="padding-right:15px;">
                    <a href="https://www.linkedin.com/company/signaturit/" title="LinkedIn" style="display:inline-block;width:32px;height:32px;background-color:#ffffff;border-radius:4px;text-align:center;line-height:32px;text-decoration:none;">
                      <img style="width:16px;height:16px;display:inline-block;vertical-align:middle;" src="https://logo.signaturit.com/linkedin_white.svg" alt="LinkedIn">
                    </a>
                  </td>
                  <td style="padding-right:15px;">
                    <a href="https://x.com/signaturit" title="Twitter / X" style="display:inline-block;width:32px;height:32px;background-color:#ffffff;border-radius:4px;text-align:center;line-height:32px;text-decoration:none;">
                      <img style="width:16px;height:16px;display:inline-block;vertical-align:middle;" src="https://logo.signaturit.com/x_white.svg" alt="Twitter">
                    </a>
                  </td>
                  <td style="padding-right:15px;">
                    <a href="https://www.instagram.com/signaturit_team/" title="Instagram" style="display:inline-block;width:32px;height:32px;background-color:#ffffff;border-radius:4px;text-align:center;line-height:32px;text-decoration:none;">
                      <img style="width:16px;height:16px;display:inline-block;vertical-align:middle;" src="https://logo.signaturit.com/instagram_white.svg" alt="Instagram">
                    </a>
                  </td>
                  <td>
                    <a href="https://www.facebook.com/signaturit" title="Facebook" style="display:inline-block;width:32px;height:32px;background-color:#ffffff;border-radius:4px;text-align:center;line-height:32px;text-decoration:none;">
                      <img style="width:16px;height:16px;display:inline-block;vertical-align:middle;" src="https://logo.signaturit.com/facebook_white.svg" alt="Facebook">
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

const CUSTOM_HTML_TEMPLATES = {
    signaturit: {
        sign_request: SIGNATURIT_DEFAULT_TEMPLATE,
        signatures_request: SIGNATURIT_DEFAULT_TEMPLATE,
        pending_sign: SIGNATURIT_DEFAULT_TEMPLATE,
        emails_request: SIGNATURIT_DEFAULT_TEMPLATE,
        validation_request: SIGNATURIT_DEFAULT_TEMPLATE
    }
};

// ── Estado global ──
let apiBrandings = [];
let selectedBrandingId = null;
let selectedBrandingTemplates = {}; // {templateName: htmlContent}
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
    return document.getElementById('apiToken').value.trim().replace(/[^\x20-\x7E]/g, '');
}

// Wrapper: todas las llamadas pasan por POST al proxy
async function apiCall(method, path, body) {
    const sanitize = (s) => s.replace(/[^\x20-\x7E]/g, '');
    const headers = {
        'x-signaturit-token': sanitize(getToken()),
        'x-api-url': sanitize(getSignaturitUrl(path)),
    };

    if (method !== 'POST') {
        headers['x-method-override'] = method;
    }

    const fetchOptions = {
        method: 'POST',
        headers: headers
    };

    if (body) {
        if (body instanceof URLSearchParams) {
            fetchOptions.body = body;
            headers['Content-Type'] = 'application/x-www-form-urlencoded';
        } else if (typeof body === 'object') {
            fetchOptions.body = JSON.stringify(body);
            headers['Content-Type'] = 'application/json';
        } else {
            fetchOptions.body = body;
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
    selectedBrandingTemplates = {};
    isNewBranding = false;
    renderBrandingsPage();
    showView('viewDashboard');
}

function goToEditorNew() {
    selectedBrandingId = null;
    selectedBrandingTemplates = {};
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
    document.getElementById('templateTypeGroup').style.display = '';

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

        // Guardar todos los templates para poder cambiar entre ellos (normalizando nombres)
        selectedBrandingTemplates = {};
        templatesArray.forEach(t => {
            if (t && t.name) selectedBrandingTemplates[normalizeTemplateName(t.name)] = t.content || '';
        });

        // Actualizar dropdown para mostrar cuáles templates tienen contenido
        updateTemplateDropdownLabels();

        if (templatesArray.length > 0) {
            // Tomar el primer template del array
            const firstTemplate = templatesArray[0];
            const loadedType = normalizeTemplateName(firstTemplate.name);
            const templateHTML = firstTemplate.content;

            // Setear el dropdown al tipo detectado
            if (loadedType) {
                const tplDropdown = document.getElementById('templateType');
                tplDropdown.value = loadedType;
                tplDropdown._previousValue = loadedType;
            }

            if (templateHTML) {
                try {
                    parseHTMLTemplate(templateHTML);
                } catch (e) {
                    document.getElementById('emailContent').value = templateHTML;
                    updatePreview();
                }
                showToast('Template "' + loadedType + '" cargado (' + templatesArray.length + '/' + ALL_TEMPLATE_TYPES.length + ' templates configurados)');
            } else {
                updatePreview();
            }
        } else {
            document.getElementById('templateType')._previousValue = document.getElementById('templateType').value;
            updatePreview();
        }

        // Actualizar colores desde el branding completo
        if (fullBranding.text_color) {
            setColorField('textColor', fullBranding.text_color);
        }
        if (fullBranding.layout_color) {
            setColorField('bgColor', fullBranding.layout_color);
        }

        // Cargar parametros de branding app
        loadBrandingAppParams(fullBranding);
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

        // Convertir array [{name, content}] a map {name: content} (normalizando nombres)
        const templatesMap = {};
        templatesArray.forEach(t => {
            if (t && t.name) templatesMap[normalizeTemplateName(t.name)] = t.content || '';
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
                '<div class="branding-card-actions">' +
                    '<span class="branding-card-action-btn rename" onclick="event.stopPropagation(); renameBranding(\'' + b.id + '\', \'' + escapeHTML(name).replace(/'/g, "\\'") + '\')">Renombrar</span>' +
                    '<span class="branding-card-action-btn rename" onclick="event.stopPropagation(); duplicateBranding(\'' + b.id + '\', \'' + escapeHTML(name).replace(/'/g, "\\'") + '\')">Duplicar</span>' +
                    '<span class="branding-card-action">Editar &rarr;</span>' +
                '</div>' +
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

async function renameBranding(brandingId, currentName) {
    const newName = prompt('Nuevo nombre para el branding:', currentName);
    if (!newName || newName.trim() === '' || newName.trim() === currentName) return;

    const formBody = new URLSearchParams();
    formBody.append('name', newName.trim());

    try {
        await apiCall('PATCH', '/brandings/' + brandingId + '.json', formBody);
        showToast('Branding renombrado a "' + newName.trim() + '"');

        // Actualizar en la lista local
        const branding = apiBrandings.find(b => b.id === brandingId);
        if (branding) branding.name = newName.trim();
        renderBrandingsPage();
    } catch (error) {
        console.error('Error renaming branding:', error);
        showToast('Error al renombrar: ' + error.message);
    }
}

async function duplicateBranding(brandingId, currentName) {
    const newName = prompt('Nombre para la copia del branding:', currentName + ' (copia)');
    if (!newName || newName.trim() === '') return;

    try {
        showToast('Duplicando branding...');

        // Fetch full branding data
        const fullBranding = await apiCall('GET', '/brandings/' + brandingId + '.json');

        const body = { name: newName.trim() };

        const templatesBody = new URLSearchParams();
        if (fullBranding.templates && Array.isArray(fullBranding.templates)) {
            fullBranding.templates.forEach(t => {
                if (t.name && t.content) {
                    templatesBody.append('templates[' + normalizeTemplateName(t.name) + ']', minifyHTML(t.content));
                }
            });
        }

        // Copy branding params
        if (fullBranding.header_color) body.header_color = fullBranding.header_color;
        if (fullBranding.footer_color) body.footer_color = fullBranding.footer_color;
        if (fullBranding.layout_color) body.layout_color = fullBranding.layout_color;
        if (fullBranding.text_color) body.text_color = fullBranding.text_color;
        if (fullBranding.signature_color) body.signature_color = fullBranding.signature_color;
        if (fullBranding.csv_position) body.csv_position = fullBranding.csv_position;
        if (fullBranding.show_welcome_page !== undefined) body.show_welcome_page = fullBranding.show_welcome_page;
        if (fullBranding.show_csv !== undefined) body.show_csv = fullBranding.show_csv;
        if (fullBranding.show_biometric_hash !== undefined) body.show_biometric_hash = fullBranding.show_biometric_hash;
        if (fullBranding.application_texts) body.application_texts = fullBranding.application_texts;
        const result = await apiCall('POST', '/brandings.json', body);
        if ([...templatesBody.keys()].length > 0) {
            await apiCall('PATCH', '/brandings/' + result.id + '.json', templatesBody);
        }
        showToast('Branding duplicado como "' + newName.trim() + '"');

        // Reload brandings list
        apiBrandings = await apiCall('GET', '/brandings.json');
        document.getElementById('dashboardCount').textContent = apiBrandings.length;
        renderBrandingsPage();
    } catch (error) {
        console.error('Error duplicating branding:', error);
        showToast('Error al duplicar: ' + error.message);
    }
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

        // Buscar el template por nombre en el array (normalizando nombres de API)
        const found = templatesArray.find(t => normalizeTemplateName(t.name) === templateType);

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
            document.getElementById('templateType').value = normalizeTemplateName(first.name);
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

        // Cargar parametros de branding app
        loadBrandingAppParams(branding);

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

// Actualizar labels del dropdown para mostrar cuáles templates tienen contenido
function updateTemplateDropdownLabels() {
    const select = document.getElementById('templateType');
    for (const option of select.options) {
        const type = option.value;
        const hasContent = !!selectedBrandingTemplates[type];
        const required = REQUIRED_MAGIC_WORDS[type];
        let label = type;
        if (required) label += ' (requiere ' + required.join(', ') + ')';
        if (hasContent) label = '● ' + label;
        option.textContent = label;
    }
}

// ═══════════════════════════════════
//  API: GUARDAR TEMPLATE (POST / PATCH)
// ═══════════════════════════════════

async function saveTemplateToAPI() {
    let templateType = document.getElementById('templateType').value;

    const textareaContent = document.getElementById('emailContent').value;

    // Auto-detectar tipo de template basado en el botón usado en el contenido
    const buttonToTemplate = {
        '{{sign_button}}': 'signatures_request',
        '{{email_button}}': 'emails_request',
        '{{validate_button}}': 'validation_request'
    };
    for (const [btn, expectedType] of Object.entries(buttonToTemplate)) {
        if (textareaContent.includes(btn) && templateType !== expectedType
            && !(btn === '{{sign_button}}' && templateType === 'pending_sign')
            && !(btn === '{{sign_button}}' && templateType === 'sign_request')) {
            document.getElementById('templateType').value = expectedType;
            templateType = expectedType;
            showToast('Tipo de template auto-corregido a "' + expectedType + '"');
            break;
        }
    }

    // Validar magic words obligatorias
    const requiredWords = REQUIRED_MAGIC_WORDS[templateType];
    if (requiredWords) {
        const missing = requiredWords.filter(w => !textareaContent.includes(w));
        if (missing.length > 0) {
            showToast('Faltan variables obligatorias: ' + missing.join(', '));
            return;
        }
    }

    // Validar que no se usen magic words no permitidas para este template
    const allowed = ALLOWED_MAGIC_WORDS[templateType];
    if (allowed) {
        const usedWords = textareaContent.match(/\{\{[a-z_]+\}\}/g) || [];
        const forbidden = usedWords.filter(w => !allowed.includes(w));
        if (forbidden.length > 0) {
            showToast('Variables no permitidas en ' + templateType + ': ' + [...new Set(forbidden)].join(', '));
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

    // Mostrar todos los templates que se enviarán en el PATCH
    if (method === 'PATCH') {
        const allTypes = Object.keys(selectedBrandingTemplates).filter(t => selectedBrandingTemplates[t]);
        if (!allTypes.includes(templateType)) allTypes.push(templateType);
        details += '<div style="margin-bottom: 6px;">' +
            '<span class="confirm-label">Templates totales:</span> ' + allTypes.length + ' (' + allTypes.join(', ') + ')' +
            '</div>';
    }

    details += '<div style="margin-bottom: 6px;">' +
        '<span class="confirm-label">Entorno:</span> <span style="font-weight:600;' +
        (env === 'production' ? 'color:#dc2626;"' : 'color:#2563eb;"') + '>' + envLabel + '</span>' +
        '</div>';

    // Mostrar parametros de branding app que se enviaran
    const appParams = collectBrandingAppParams();
    details += '<div style="margin-top: 12px; padding-top: 10px; border-top: 1px solid #e5e7eb;">' +
        '<span class="confirm-label" style="font-size: 12px;">Parametros de Branding App:</span>' +
        '<div style="margin-top: 6px; font-size: 11px; font-family: monospace; color: #6b7280;">';

    if (method === 'PATCH') {
        const nameVal = document.getElementById('editorBrandingName').value.trim();
        if (nameVal) {
            details += '<div style="margin-bottom: 3px;"><span style="color: #374151;">name:</span> ' + escapeHTML(nameVal) + '</div>';
        }
    }

    Object.keys(appParams).forEach(key => {
        const val = appParams[key];
        if (key === 'application_texts' && typeof val === 'object') {
            Object.keys(val).forEach(subKey => {
                details += '<div style="margin-bottom: 3px;"><span style="color: #374151;">application_texts.' + subKey + ':</span> ' + escapeHTML(val[subKey]) + '</div>';
            });
            return;
        }
        const displayVal = String(val);
        const colorPreview = displayVal.startsWith('#') ? ' <span style="display:inline-block;width:12px;height:12px;border-radius:2px;background:' + displayVal + ';vertical-align:middle;border:1px solid #ddd;"></span>' : '';
        details += '<div style="margin-bottom: 3px;"><span style="color: #374151;">' + key + ':</span> ' + escapeHTML(displayVal) + colorPreview + '</div>';
    });

    details += '</div></div>';

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

// Helper: cargar parametros de branding app desde un objeto branding de la API
function loadBrandingAppParams(branding) {
    if (branding.header_color) {
        setColorField('brandingHeaderColor', branding.header_color);
    }
    if (branding.footer_color) {
        setColorField('brandingFooterColor', branding.footer_color);
    }
    if (branding.layout_color) {
        setColorField('brandingLayoutColor', branding.layout_color);
    }
    if (branding.text_color) {
        setColorField('brandingTextColor', branding.text_color);
    }
    // application_texts puede ser un objeto con varios campos
    console.log('API application_texts:', branding.application_texts);
    if (branding.application_texts) {
        if (branding.application_texts.terms_and_conditions) {
            const termsEl = document.getElementById('brandingTermsText');
            if (termsEl) termsEl.value = branding.application_texts.terms_and_conditions;
        }
        if (branding.application_texts.open_sign_button) {
            const el = document.getElementById('brandingOpenSignButton');
            if (el) el.value = branding.application_texts.open_sign_button;
            const ebText = document.getElementById('emailButtonText');
            if (ebText) ebText.value = branding.application_texts.open_sign_button;
        }
        if (branding.application_texts.open_email_button) {
            const el = document.getElementById('brandingOpenEmailButton');
            if (el) el.value = branding.application_texts.open_email_button;
        }
        if (branding.application_texts.send_button) {
            const el = document.getElementById('brandingSendButton');
            if (el) el.value = branding.application_texts.send_button;
        }
        if (branding.application_texts.sign_button) {
            const el = document.getElementById('brandingSignButton');
            if (el) el.value = branding.application_texts.sign_button;
        }
        if (branding.application_texts.multi_page) {
            const el = document.getElementById('brandingMultiPage');
            if (el) el.value = branding.application_texts.multi_page;
        }
        if (branding.application_texts.photo) {
            const el = document.getElementById('brandingPhotoText');
            if (el) el.value = branding.application_texts.photo;
        }
        if (branding.application_texts.voice) {
            const el = document.getElementById('brandingVoiceText');
            if (el) el.value = branding.application_texts.voice;
        }
    }
    // show_welcome_page: 1 = true, 0 = false
    const welcomeEl = document.getElementById('brandingShowWelcome');
    if (welcomeEl) {
        welcomeEl.checked = branding.show_welcome_page === 1 || branding.show_welcome_page === '1' || branding.show_welcome_page === true;
    }
    // show_csv: 1 = true, 0 = false
    const csvEl = document.getElementById('brandingShowCsv');
    if (csvEl) {
        csvEl.checked = branding.show_csv === 1 || branding.show_csv === '1' || branding.show_csv === true;
    }
    // show_biometric_hash: 1 = true, 0 = false
    const hashEl = document.getElementById('brandingShowBiometricHash');
    if (hashEl) {
        hashEl.checked = branding.show_biometric_hash === 1 || branding.show_biometric_hash === '1' || branding.show_biometric_hash === true;
    }
    // signature_color
    if (branding.signature_color) {
        const sigColorEl = document.getElementById('brandingSignatureColor');
        if (sigColorEl) sigColorEl.value = branding.signature_color;
    }
    // csv_position
    if (branding.csv_position) {
        const csvPosEl = document.getElementById('brandingCsvPosition');
        if (csvPosEl) csvPosEl.value = branding.csv_position;
    }
    // subject_tag
    if (branding.subject_tag) {
        const subjectTagEl = document.getElementById('brandingSubjectTag');
        if (subjectTagEl) subjectTagEl.value = branding.subject_tag;
    }
}

// Helper: recoger todos los parametros de branding app
function collectBrandingAppParams() {
    const params = {};
    const headerColor = document.getElementById('brandingHeaderColor');
    const footerColor = document.getElementById('brandingFooterColor');
    const layoutColor = document.getElementById('brandingLayoutColor');
    const textColor = document.getElementById('brandingTextColor');
    const termsText = document.getElementById('brandingTermsText');
    const showWelcome = document.getElementById('brandingShowWelcome');

    const showCsv = document.getElementById('brandingShowCsv');
    const showBiometricHash = document.getElementById('brandingShowBiometricHash');
    const signatureColor = document.getElementById('brandingSignatureColor');
    const csvPosition = document.getElementById('brandingCsvPosition');
    const openSignButton = document.getElementById('brandingOpenSignButton');
    const openEmailButton = document.getElementById('brandingOpenEmailButton');
    const sendButton = document.getElementById('brandingSendButton');

    if (headerColor) params.header_color = headerColor.value;
    if (footerColor) params.footer_color = footerColor.value;
    if (layoutColor) params.layout_color = layoutColor.value;
    if (textColor) params.text_color = textColor.value;

    const subjectTag = document.getElementById('brandingSubjectTag');
    if (subjectTag && subjectTag.value.trim()) params.subject_tag = subjectTag.value.trim();

    // application_texts como objeto anidado para JSON
    const appTexts = {};
    if (termsText && termsText.value.trim()) appTexts.terms_and_conditions = termsText.value.trim();
    const emailBtnText = document.getElementById('emailButtonText');
    const openSignVal = (openSignButton && openSignButton.value.trim()) || (emailBtnText && emailBtnText.value.trim());
    if (openSignVal) appTexts.open_sign_button = openSignVal;
    if (openEmailButton && openEmailButton.value.trim()) appTexts.open_email_button = openEmailButton.value.trim();
    if (sendButton && sendButton.value.trim()) appTexts.send_button = sendButton.value.trim();

    const signButton = document.getElementById('brandingSignButton');
    const multiPage = document.getElementById('brandingMultiPage');
    const photoText = document.getElementById('brandingPhotoText');
    const voiceText = document.getElementById('brandingVoiceText');
    if (signButton && signButton.value.trim()) appTexts.sign_button = signButton.value.trim();
    if (multiPage && multiPage.value.trim()) appTexts.multi_page = multiPage.value.trim();
    if (photoText && photoText.value.trim()) appTexts.photo = photoText.value.trim();
    if (voiceText && voiceText.value.trim()) appTexts.voice = voiceText.value.trim();

    if (Object.keys(appTexts).length > 0) params.application_texts = appTexts;
    console.log('collectBrandingAppParams - application_texts:', JSON.stringify(appTexts));

    if (showWelcome) params.show_welcome_page = showWelcome.checked ? 1 : 0;
    if (showCsv) params.show_csv = showCsv.checked ? 1 : 0;
    if (showBiometricHash) params.show_biometric_hash = showBiometricHash.checked ? 1 : 0;
    if (signatureColor && signatureColor.value) params.signature_color = signatureColor.value;
    if (csvPosition && csvPosition.value) params.csv_position = csvPosition.value;

    return params;
}

// Helper: agregar parametros de branding app al body
function appendBrandingAppParams(target) {
    const params = collectBrandingAppParams();
    if (target instanceof URLSearchParams) {
        Object.keys(params).forEach(key => {
            const val = params[key];
            if (typeof val === 'object' && val !== null) {
                Object.keys(val).forEach(subKey => {
                    target.append(key + '[' + subKey + ']', val[subKey]);
                });
            } else {
                target.append(key, val);
            }
        });
    } else {
        Object.keys(params).forEach(key => {
            target[key] = params[key];
        });
    }
}

// Helper: convertir objeto a URLSearchParams con bracket notation
function objectToFormParams(obj) {
    const params = new URLSearchParams();
    Object.keys(obj).forEach(key => {
        const val = obj[key];
        if (typeof val === 'object' && val !== null) {
            Object.keys(val).forEach(subKey => {
                params.append(key + '[' + subKey + ']', val[subKey]);
            });
        } else {
            params.append(key, val);
        }
    });
    return params;
}

async function createNewBranding(templateType) {
    const name = document.getElementById('newBrandingName').value.trim();
    if (!name) {
        showToast('Ingresa un nombre para el nuevo branding');
        return;
    }

    let html = generateHTML();
    html = minifyHTML(html);

    // Step 1: Create branding with name only (JSON, lightweight)
    const createBody = { name: name };
    const appParams = collectBrandingAppParams();
    Object.keys(appParams).forEach(key => {
        createBody[key] = appParams[key];
    });

    try {
        const result = await apiCall('POST', '/brandings.json', createBody);
        const newId = result.id;
        showToast('Branding "' + name + '" creado, guardando template...');

        // Step 2: PATCH templates as form-urlencoded (same as update)
        const templatesBody = new URLSearchParams();
        templatesBody.append('templates[' + templateType + ']', html);
        try {
            await apiCall('PATCH', '/brandings/' + newId + '.json', templatesBody);
        } catch (tplError) {
            console.error('Error saving template after create:', tplError.message);
            showToast('Branding creado pero error al guardar template: ' + tplError.message);
        }

        showToast('Branding "' + name + '" creado con ID: ' + newId.substring(0, 8) + '...');

        // Recargar lista de brandings
        try {
            apiBrandings = await apiCall('GET', '/brandings.json');
            document.getElementById('dashboardCount').textContent = apiBrandings.length;
        } catch (e) { /* silenciar error de recarga */ }

        // Cambiar a modo edicion del branding recien creado
        selectedBrandingId = newId;
        selectedBrandingTemplates = {};
        selectedBrandingTemplates[templateType] = html;
        isNewBranding = false;
        updateSaveBar();
        document.getElementById('editorBrandingName').value = name;
        document.getElementById('editorBrandingId').textContent = newId;
        document.getElementById('newBrandingNameGroup').style.display = 'none';
        document.getElementById('templateTypeGroup').style.display = '';
        const tplDropdown = document.getElementById('templateType');
        tplDropdown.value = templateType;
        tplDropdown._previousValue = templateType;

    } catch (error) {
        console.error('Error creating branding:', error);
        showToast('Error al crear branding: ' + error.message);
    }
}

async function updateExistingBranding(brandingId, templateType) {
    let html = generateHTML();
    // Siempre minificar para reducir tamaño del body
    html = minifyHTML(html);

    // Actualizar el template actual en memoria antes de guardar
    selectedBrandingTemplates[templateType] = html;

    const brandingName = document.getElementById('editorBrandingName').value.trim();
    const appParams = collectBrandingAppParams();
    const patchUrl = '/brandings/' + brandingId + '.json';

    // PATCH 1: Branding params + application_texts como JSON (SIN templates)
    // application_texts es un objeto anidado que requiere JSON, no form-urlencoded
    const jsonParams = {};
    if (brandingName) jsonParams.name = brandingName;
    Object.keys(appParams).forEach(key => {
        jsonParams[key] = appParams[key];
    });

    console.log('PATCH 1 - Branding params JSON (sin templates):', JSON.stringify(jsonParams));

    try {
        await apiCall('PATCH', patchUrl, jsonParams);
        console.log('PATCH 1 OK - params guardados');
    } catch (error) {
        console.error('PATCH 1 error:', error.message);
    }

    // PATCH 2: SOLO templates
    const templatesBody = new URLSearchParams();
    let templateCount = 0;
    for (const [tplName, tplContent] of Object.entries(selectedBrandingTemplates)) {
        if (tplContent) {
            const minified = minifyHTML(tplContent);
            templatesBody.append('templates[' + tplName + ']', minified);
            templateCount++;
        }
    }

    console.log('PATCH 2 - Enviando ' + templateCount + ' templates');
    console.log('Body size aprox:', templatesBody.toString().length, 'chars');

    try {
        await apiCall('PATCH', patchUrl, templatesBody);
        console.log('PATCH 2 OK - templates guardados');

        // Verificar: recargar el branding completo para confirmar qué se guardó realmente
        try {
            const verifyBranding = await apiCall('GET', '/brandings/' + brandingId + '.json');
            const savedTemplates = verifyBranding.templates || [];
            const savedNames = savedTemplates.map(t => normalizeTemplateName(t.name));
            console.log('Templates guardados en API:', savedNames, '(' + savedNames.length + ' total)');
            console.log('application_texts en API:', JSON.stringify(verifyBranding.application_texts));
            console.log('layout_color en API:', verifyBranding.layout_color);

            // Sincronizar selectedBrandingTemplates con lo real de la API (normalizando nombres)
            selectedBrandingTemplates = {};
            savedTemplates.forEach(t => {
                if (t && t.name) selectedBrandingTemplates[normalizeTemplateName(t.name)] = t.content || '';
            });

            if (savedNames.length < templateCount) {
                showToast('ATENCION: Se enviaron ' + templateCount + ' pero solo se guardaron ' + savedNames.length + ': ' + savedNames.join(', '));
            } else {
                showToast('Guardado OK (' + savedNames.length + ' templates)');
            }
        } catch (e) {
            showToast('Template "' + templateType + '" guardado');
        }

        updateTemplateDropdownLabels();

        // Recargar la lista para reflejar cambios
        try {
            apiBrandings = await apiCall('GET', '/brandings.json');
        } catch (e) { /* silenciar error de recarga */ }

    } catch (error) {
        console.error('Error updating branding:', error);
        // Si falla con todos, intentar guardar SOLO el template actual
        console.log('Reintentando con solo el template actual...');
        try {
            const fallbackBody = new URLSearchParams();
            if (brandingName) fallbackBody.append('name', brandingName);
            fallbackBody.append('templates[' + templateType + ']', html);
            await apiCall('PATCH', patchUrl, fallbackBody);
            showToast('Solo se guardó "' + templateType + '" (error al guardar todos: ' + error.message + ')');
        } catch (error2) {
            showToast('Error al actualizar: ' + error.message);
        }
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

// Parses any CSS color (rgba, rgb, #hex) and returns { hex: '#rrggbb', opacity: '0'-'1' }
// Returns null if the color string cannot be parsed.
function parseColor(colorStr) {
    if (!colorStr) return null;
    colorStr = colorStr.trim();

    // #hex
    if (colorStr.startsWith('#')) {
        return { hex: colorStr.length === 4
            ? '#' + colorStr[1]+colorStr[1] + colorStr[2]+colorStr[2] + colorStr[3]+colorStr[3]
            : colorStr, opacity: '1' };
    }

    // rgba(r, g, b, a)
    const rgbaMatch = colorStr.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\s*\)/);
    if (rgbaMatch) {
        const r = parseInt(rgbaMatch[1]).toString(16).padStart(2, '0');
        const g = parseInt(rgbaMatch[2]).toString(16).padStart(2, '0');
        const b = parseInt(rgbaMatch[3]).toString(16).padStart(2, '0');
        const a = rgbaMatch[4] !== undefined ? rgbaMatch[4] : '1';
        return { hex: '#' + r + g + b, opacity: a };
    }

    return null;
}

function copyCallbackSnippet() {
    const url = document.getElementById('callbackUrlRef').value.trim();
    if (!url) {
        showToast('Ingresa una URL primero');
        return;
    }
    const snippet = `// Ejemplo: crear signature request con callback_url
// POST https://api.signaturit.com/v3/signatures.json

const formData = new FormData();
formData.append('recipients[0][name]', 'Nombre Firmante');
formData.append('recipients[0][email]', 'firmante@email.com');
formData.append('callback_url', '${url}');
// formData.append('files[0]', file);  // tu documento

fetch('https://api.signaturit.com/v3/signatures.json', {
  method: 'POST',
  headers: { 'Authorization': 'Bearer TU_API_TOKEN' },
  body: formData
});`;

    const box = document.getElementById('callbackSnippetBox');
    const code = document.getElementById('callbackSnippetCode');
    code.textContent = snippet;
    box.style.display = 'block';

    navigator.clipboard.writeText(snippet).then(() => {
        showToast('Snippet copiado al portapapeles');
    }).catch(() => {
        showToast('Snippet generado (copia manualmente)');
    });
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
    const confirmModal = document.getElementById('confirmPushModal');

    if (event.target === variableModal) {
        closeVariableModal();
    }
    if (event.target === pasteModal) {
        closePasteHTMLModal();
    }
    if (event.target === confirmModal) {
        closeConfirmPushModal();
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
        ['textColor', 'textColorValue'],
        ['brandingHeaderColor', 'brandingHeaderColorValue'],
        ['brandingFooterColor', 'brandingFooterColorValue'],
        ['brandingLayoutColor', 'brandingLayoutColorValue'],
        ['brandingTextColor', 'brandingTextColorValue'],
        ['footerBgColor', 'footerBgColorValue'],
        ['footerTextColor', 'footerTextColorValue'],
        ['footerBorderColor', 'footerBorderColorValue']
    ];

    colorPairs.forEach(([pickerId, valueId]) => {
        const picker = document.getElementById(pickerId);
        const value = document.getElementById(valueId);

        picker.addEventListener('input', (e) => {
            value.value = e.target.value;
        });

        value.addEventListener('input', (e) => {
            if (/^#[0-9A-F]{6}$/i.test(e.target.value)) {
                picker.value = e.target.value;
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
    const buttonMarginBottom = document.getElementById('buttonMarginBottom').value || '10';
    const buttonAlign = document.getElementById('buttonAlign').value || 'center';
    const buttonWidth = document.getElementById('buttonWidth').value || '200';
    const buttonFontSize = document.getElementById('buttonFontSize').value || defaults.buttonFontSize;
    const buttonLineHeight = document.getElementById('buttonLineHeight').value || defaults.buttonLineHeight;
    const buttonFontWeight = document.getElementById('buttonFontWeight').value || defaults.buttonFontWeight;

    const logoObjectFitStyle = logoObjectFit !== 'none' ? `object-fit:${logoObjectFit};` : '';
    const logoStyles = `width:${logoWidth};height:${logoHeight};${logoObjectFitStyle}display:block;`;

    const logoSection = logoUrl ? `        <table role="presentation" style="width:100%;max-width:600px;border-collapse:collapse;border:0;border-spacing:0;">
          <tr>
            <td align="center" style="padding:30px 20px;background-color:${containerColor};">
              <img style="${logoStyles}" alt="Logo" src="${logoUrl}">
            </td>
          </tr>
        </table>` : '';

    const buttonBorderStyle = buttonBorderWidth > 0 ? `border:${buttonBorderWidth}px solid ${buttonBorderColor};` : '';
    const buttonPaddingStyle = `padding:${buttonPaddingTop}px ${buttonPaddingRight}px ${buttonPaddingBottom}px ${buttonPaddingLeft}px;`;
    const buttonMarginLeft = buttonAlign === 'center' ? 'auto' : (buttonAlign === 'right' ? 'auto' : '0');
    const buttonMarginRight = buttonAlign === 'center' ? 'auto' : (buttonAlign === 'left' ? 'auto' : '0');
    const buttonMarginStyle = `margin:${buttonMarginTop}px ${buttonMarginRight} ${buttonMarginBottom}px ${buttonMarginLeft};`;
    const buttonAlignAttr = buttonAlign;
    const buttonFontWeightStyle = buttonFontWeight !== 'normal' ? `font-weight:${buttonFontWeight};` : '';
    const buttonNoWrap = document.getElementById('buttonNoWrap').value || defaults.buttonNoWrap;
    const buttonNoWrapStyle = buttonNoWrap === 'yes' ? 'white-space:nowrap;' : '';
    const emailButtonText = document.getElementById('emailButtonText').value.trim() || 'Firmar';

    // Signaturit replaces magic words with its own buttons,
    // so we use <span> with the magic word as text (not <a href>)
    const buildMagicWordButtonHTML = (magicWord) => `              <table role="presentation" class="miboton" align="${buttonAlignAttr}" style="${buttonMarginStyle}border-collapse:collapse;border:0;border-spacing:0;">
                <tr>
                  <td align="center" style="border-radius:${buttonBorderRadius}px;background-color:${buttonColor};${buttonBorderStyle}">
                    <p style="margin:0;${buttonPaddingStyle}font-size:${buttonFontSize}px;${buttonFontWeightStyle}${buttonNoWrapStyle}">
                      <span class="mititulo" style="color:${buttonTextColor};text-decoration:none;">${magicWord}</span>
                    </p>
                  </td>
                </tr>
              </table>`;

    const textFontSize = document.getElementById('textFontSize').value || defaults.textFontSize;
    const textLineHeight = document.getElementById('textLineHeight').value || defaults.textLineHeight;
    const textLetterSpacing = document.getElementById('textLetterSpacing').value || defaults.textLetterSpacing;
    const textAlign = document.getElementById('textAlign').value || defaults.textAlign;
    const textFontWeight = document.getElementById('textFontWeight').value || defaults.textFontWeight;

    const letterSpacingStyle = textLetterSpacing !== '0' ? `letter-spacing:${textLetterSpacing}px;` : '';
    const fontWeightStyle = textFontWeight !== 'normal' ? `font-weight:${textFontWeight};` : '';
    const textAlignStyle = textAlign !== 'left' ? `text-align:${textAlign};` : '';
    const baseTextStyle = `margin:0 0 20px 0;font-size:${textFontSize}px;line-height:${textLineHeight}px;${letterSpacingStyle}${fontWeightStyle}${textAlignStyle}color:${textColor};`;

    const listStyle = `font-size:${textFontSize}px;line-height:${textLineHeight}px;${letterSpacingStyle}${fontWeightStyle}color:${textColor};margin:0 0 4px 0;`;
    const formatInline = (text) => {
        let t = text;
        t = t.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        t = t.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>');
        t = t.replace(/__(.+?)__/g, '<u>$1</u>');
        return t;
    };

    const parseLineStyle = (line) => {
        const m = line.match(/^\{(?!\{)([^}]*)\}\s*/);
        if (!m) return { text: line, style: baseTextStyle, liStyle: listStyle };
        const text = line.substring(m[0].length);
        let fontSize = textFontSize;
        let lineHeight = textLineHeight;
        let color = textColor;
        let italic = false;
        const tokenParts = [];
        let depth = 0, cur = '';
        for (const ch of m[1]) {
            if (ch === '(') depth++;
            if (ch === ')') depth--;
            if (ch === ',' && depth === 0) { tokenParts.push(cur); cur = ''; }
            else cur += ch;
        }
        if (cur) tokenParts.push(cur);
        tokenParts.forEach(part => {
            const p = part.trim();
            if (p.startsWith('s:')) fontSize = p.substring(2);
            else if (p.startsWith('c:')) { color = parseColorToHex(p.substring(2)) || p.substring(2); }
            else if (p === 'i') italic = true;
        });
        lineHeight = Math.round(parseInt(fontSize) * 1.45);
        const italicStyle = italic ? 'font-style:italic;' : '';
        const style = `margin:0 0 20px 0;font-size:${fontSize}px;line-height:${lineHeight}px;${letterSpacingStyle}${fontWeightStyle}${textAlignStyle}color:${color};${italicStyle}`;
        const liSt = `font-size:${fontSize}px;line-height:${lineHeight}px;${letterSpacingStyle}${fontWeightStyle}color:${color};${italicStyle}margin:0 0 4px 0;`;
        return { text, style, liStyle: liSt };
    };

    const lines = emailContent.split('\n').map(l => l.trim()).filter(line => line !== '');
    const htmlParts = [];
    let i = 0;
    while (i < lines.length) {
        const line = lines[i];
        const rawText = line.replace(/^\{(?!\{)[^}]*\}\s*/, '');
        if (rawText.includes('{{sign_button}}')) {
            htmlParts.push(buildMagicWordButtonHTML('{{sign_button}}'));
        } else if (rawText.includes('{{email_button}}')) {
            htmlParts.push(buildMagicWordButtonHTML('{{email_button}}'));
        } else if (rawText.includes('{{validate_button}}')) {
            htmlParts.push(buildMagicWordButtonHTML('{{validate_button}}'));
        } else if (rawText.includes('{{dashboard_button}}')) {
            htmlParts.push(buildMagicWordButtonHTML('{{dashboard_button}}'));
        } else if (rawText.trim() === '---') {
            htmlParts.push(`<hr style="border:0;border-top:1px solid #e0e0e0;margin:16px 0;">`);
        } else if (/^(\{(?!\{)[^}]*\}\s*)?[-•]\s/.test(line)) {
            const firstParsed = parseLineStyle(lines[i]);
            const items = [];
            while (i < lines.length && /^(\{(?!\{)[^}]*\}\s*)?[-•]\s/.test(lines[i])) {
                const p = parseLineStyle(lines[i]);
                items.push(`\n                <li style="${p.liStyle}">${formatInline(p.text.replace(/^[-•]\s*/, ''))}</li>`);
                i++;
            }
            htmlParts.push(`              <ul style="margin:0 0 20px 0;padding-left:20px;${firstParsed.style}">${items.join('')}\n              </ul>`);
            continue;
        } else if (/^(\{(?!\{)[^}]*\}\s*)?\d+\.\s/.test(line)) {
            const firstParsed = parseLineStyle(lines[i]);
            const items = [];
            while (i < lines.length && /^(\{(?!\{)[^}]*\}\s*)?\d+\.\s/.test(lines[i])) {
                const p = parseLineStyle(lines[i]);
                items.push(`\n                <li style="${p.liStyle}">${formatInline(p.text.replace(/^\d+\.\s*/, ''))}</li>`);
                i++;
            }
            htmlParts.push(`              <ol style="margin:0 0 20px 0;padding-left:20px;${firstParsed.style}">${items.join('')}\n              </ol>`);
            continue;
        } else {
            const parsed = parseLineStyle(line);
            htmlParts.push(`              <p style="${parsed.style}">\n                ${formatInline(parsed.text)}\n              </p>`);
        }
        i++;
    }
    const contentParagraphs = htmlParts.join('\n');

    // Footer del email
    const footerEnabled = document.getElementById('footerEnabled').value;
    let footerSection = '';
    if (footerEnabled === 'yes') {
        const footerWidth = document.getElementById('footerWidth').value || defaults.footerWidth;
        const footerContent = document.getElementById('footerContent').value || '';
        const footerImageUrl = document.getElementById('footerImageUrl').value || '';
        const footerImageWidth = document.getElementById('footerImageWidth').value || defaults.footerImageWidth;
        const footerImageHeight = document.getElementById('footerImageHeight').value || defaults.footerImageHeight;
        const footerBgColor = document.getElementById('footerBgColor').value || defaults.footerBgColor;
        const footerTextColor = document.getElementById('footerTextColor').value || defaults.footerTextColor;
        const footerFontSize = document.getElementById('footerFontSize').value || defaults.footerFontSize;
        const footerLineHeight = document.getElementById('footerLineHeight').value || defaults.footerLineHeight;
        const footerTextAlign = document.getElementById('footerTextAlign').value || defaults.footerTextAlign;
        const footerBorderColor = document.getElementById('footerBorderColor').value || defaults.footerBorderColor;
        const fBorderTop = document.getElementById('footerBorderTop').value || '0';
        const fBorderRight = document.getElementById('footerBorderRight').value || '0';
        const fBorderBottom = document.getElementById('footerBorderBottom').value || '0';
        const fBorderLeft = document.getElementById('footerBorderLeft').value || '0';
        const footerPaddingTop = document.getElementById('footerPaddingTop').value || defaults.footerPaddingTop;
        const footerPaddingRight = document.getElementById('footerPaddingRight').value || defaults.footerPaddingRight;
        const footerPaddingBottom = document.getElementById('footerPaddingBottom').value || defaults.footerPaddingBottom;
        const footerPaddingLeft = document.getElementById('footerPaddingLeft').value || defaults.footerPaddingLeft;
        const footerPadding = `${footerPaddingTop}px ${footerPaddingRight}px ${footerPaddingBottom}px ${footerPaddingLeft}px`;

        let footerBorderStyle = '';
        if (fBorderTop !== '0') footerBorderStyle += `border-top:${fBorderTop}px solid ${footerBorderColor};`;
        if (fBorderRight !== '0') footerBorderStyle += `border-right:${fBorderRight}px solid ${footerBorderColor};`;
        if (fBorderBottom !== '0') footerBorderStyle += `border-bottom:${fBorderBottom}px solid ${footerBorderColor};`;
        if (fBorderLeft !== '0') footerBorderStyle += `border-left:${fBorderLeft}px solid ${footerBorderColor};`;

        const footerTextStyle = `margin:0 0 15px 0;font-size:${footerFontSize}px;line-height:${footerLineHeight}px;color:${footerTextColor};`;

        const footerImageHTML = footerImageUrl
            ? `<img src="${footerImageUrl}" alt="Footer" style="width:${footerImageWidth};height:${footerImageHeight};display:block;margin:0 auto 8px auto;">\n`
            : '';

        const footerParagraphs = footerContent
            .split('\n')
            .filter(line => line.trim() !== '')
            .map(line => {
                let processedLine = line;
                processedLine = processedLine.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
                processedLine = processedLine.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>');
                processedLine = processedLine.replace(/__(.+?)__/g, '<u>$1</u>');
                return `<p style="${footerTextStyle}">${processedLine}</p>`;
            })
            .join('\n');

        const footerLinkedin = document.getElementById('footerLinkedin').value.trim();
        const footerTwitter = document.getElementById('footerTwitter').value.trim();
        const footerInstagram = document.getElementById('footerInstagram').value.trim();
        const footerFacebook = document.getElementById('footerFacebook').value.trim();

        let socialHTML = '';
        const socialItems = [];
        const socialIcon = (url, title, imgSrc, alt) =>
            `<td style="padding-right:15px;"><a href="${url}" title="${title}" style="display:inline-block;width:32px;height:32px;background-color:#ffffff;border-radius:4px;text-align:center;line-height:32px;text-decoration:none;"><img style="width:16px;height:16px;display:inline-block;vertical-align:middle;" src="${imgSrc}" alt="${alt}"></a></td>`;

        if (footerLinkedin) socialItems.push(socialIcon(footerLinkedin, 'LinkedIn', 'https://logo.signaturit.com/linkedin_white.svg', 'LinkedIn'));
        if (footerTwitter) socialItems.push(socialIcon(footerTwitter, 'Twitter / X', 'https://logo.signaturit.com/x_white.svg', 'Twitter'));
        if (footerInstagram) socialItems.push(socialIcon(footerInstagram, 'Instagram', 'https://logo.signaturit.com/instagram_white.svg', 'Instagram'));
        if (footerFacebook) socialItems.push(socialIcon(footerFacebook, 'Facebook', 'https://logo.signaturit.com/facebook_white.svg', 'Facebook'));

        if (socialItems.length > 0) {
            socialHTML = `<table role="presentation" style="margin:20px 0 0 0;border-collapse:collapse;border:0;border-spacing:0;"><tr>${socialItems.join('')}</tr></table>`;
        }

        if (footerImageUrl || footerParagraphs || socialHTML) {
            const footerInner = `${footerImageHTML}${footerParagraphs}${socialHTML}`;
            const footerMaxW = footerWidth === '100' ? '600' : Math.round(600 * parseInt(footerWidth) / 100);
            footerSection = `        <table role="presentation" style="width:100%;max-width:${footerMaxW}px;border-collapse:collapse;border:0;border-spacing:0;background-color:${footerBgColor};${footerBorderStyle}">
          <tr>
            <td style="padding:${footerPadding};">
${footerInner}
            </td>
          </tr>
        </table>`;
        }
    }

    return `<!DOCTYPE html>
<html lang="es" xmlns="http://www.w3.org/1999/xhtml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="x-apple-disable-message-reformatting">
  <title>${(document.getElementById('emailSubject').value.trim()) || 'Solicitud de Firma'}</title>
  <style>
    table, td, div, h1, p {font-family: 'Helvetica Neue', Helvetica, Arial;}
    body { margin:0; padding:0; background-color: ${bgColor}; }
${getMobileCSS()}
  </style>
</head>
<body style="margin:0;padding:0;background-color: ${bgColor};">
  <table role="presentation" style="width:100%;border-collapse:collapse;border:0;border-spacing:0;margin:30px 0px;">
    <tr>
      <td align="center" style="padding:0;">
${logoSection}
        <table role="presentation" style="width:100%;max-width:600px;border-collapse:collapse;border:0;border-spacing:0;background-color:${containerColor};">
          <tr>
            <td style="padding:40px 30px;">
${contentParagraphs}
            </td>
          </tr>
        </table>
${footerSection}
      </td>
    </tr>
  </table>
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

function buildStylePrefix(pNode) {
    const style = pNode.getAttribute('style') || '';
    const parts = [];
    const defaultSize = document.getElementById('textFontSize').value || '14';
    const defaultColor = document.getElementById('textColor').value || '#333333';

    const fsMatch = style.match(/font-size:\s*(\d+)px/);
    if (fsMatch && fsMatch[1] !== defaultSize) parts.push('s:' + fsMatch[1]);

    const colorMatch = style.match(/(?<![a-z-])color:\s*([^;]+)/);
    if (colorMatch) {
        const c = colorMatch[1].trim();
        const hex = parseColorToHex(c);
        if (hex && hex.toLowerCase() !== defaultColor.toLowerCase()) parts.push('c:' + hex);
    }

    if (style.includes('font-style') && style.includes('italic')) parts.push('i');

    return parts.length > 0 ? '{' + parts.join(',') + '} ' : '';
}

function parseColorToHex(str) {
    if (!str) return null;
    str = str.trim();
    if (str.startsWith('#')) return str.length === 4 ? '#' + str[1]+str[1]+str[2]+str[2]+str[3]+str[3] : str;
    const m = str.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
    if (m) return '#' + [m[1],m[2],m[3]].map(x => parseInt(x).toString(16).padStart(2,'0')).join('');
    return str;
}

// Parsear solo el contenido del email (textarea) sin modificar estilos del formulario
function parseEmailContentOnly(htmlString) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlString, 'text/html');

    const contentArea = doc.querySelector('td[style*="padding:0 0 25px 0"]') ||
                       doc.querySelector('td[style*="padding:40px 30px"]') ||
                       doc.querySelector('.note') ||
                       doc.querySelector('table[bgcolor="#ffffff"] td') ||
                       doc.querySelector('body');

    if (!contentArea) {
        document.getElementById('emailContent').value = '';
        return;
    }

    // Reusar la misma lógica de extracción de texto que parseHTMLTemplate
    const processNode = (node) => {
        let result = '';
        if (node.nodeType === Node.TEXT_NODE) return node.textContent;
        if (node.nodeName === 'BR') return '\n';
        if (node.nodeName === 'HR') return '---\n';
        if (node.classList && node.classList.contains('miboton')) {
            var btnText = node.textContent.trim();
            if (btnText.includes('{{email_button}}')) return '{{email_button}}';
            if (btnText.includes('{{validate_button}}')) return '{{validate_button}}';
            if (btnText.includes('{{sign_button}}')) return '{{sign_button}}';
            if (btnText.includes('{{dashboard_button}}')) return '{{dashboard_button}}';
            return '{{sign_button}}';
        }
        const tag = node.nodeName;
        if (tag === 'UL') {
            let prefix = buildStylePrefix(node);
            let items = '';
            for (const li of node.querySelectorAll(':scope > li')) {
                let liContent = '';
                for (const c of li.childNodes) liContent += processNode(c);
                items += prefix + '- ' + liContent.trim() + '\n';
            }
            return items;
        }
        if (tag === 'OL') {
            let prefix = buildStylePrefix(node);
            let items = '';
            let idx = 1;
            for (const li of node.querySelectorAll(':scope > li')) {
                let liContent = '';
                for (const c of li.childNodes) liContent += processNode(c);
                items += prefix + idx + '. ' + liContent.trim() + '\n';
                idx++;
            }
            return items;
        }
        let childContent = '';
        for (const child of node.childNodes) childContent += processNode(child);
        if (tag === 'STRONG' || tag === 'B') result = '**' + childContent + '**';
        else if (tag === 'EM' || tag === 'I') result = '*' + childContent + '*';
        else if (tag === 'U') result = '__' + childContent + '__';
        else if (tag === 'P') {
            let prefix = buildStylePrefix(node);
            result = prefix + childContent.trim() + '\n';
        }
        else result = childContent;
        return result;
    };

    let emailContent = '';
    for (const child of contentArea.childNodes) emailContent += processNode(child);

    if (!emailContent.trim()) emailContent = contentArea.textContent || '';

    emailContent = emailContent.split('\n').map(l => l.trim()).join('\n').replace(/\n{3,}/g, '\n\n').trim();
    document.getElementById('emailContent').value = emailContent;
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

    // Email subject from <title>
    const titleEl = doc.querySelector('title');
    if (titleEl && titleEl.textContent.trim()) {
        document.getElementById('emailSubject').value = titleEl.textContent.trim();
        extractedSomething = true;
    }

    // Logo
    const logoImg = doc.querySelector('img[alt="Logo"]') ||
                   doc.querySelector('img[alt="logo"]') ||
                   doc.querySelector('td[style*="padding:30px"] img') ||
                   doc.querySelector('td[style*="padding:20px"] img:not([alt="LinkedIn"]):not([alt="Twitter"]):not([alt="Instagram"]):not([alt="Facebook"])');

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
            const parsed = parseColor(bgColorMatch[1]);
            if (parsed) {
                document.getElementById('bgColor').value = parsed.hex;
                document.getElementById('bgColorValue').value = parsed.hex;
                document.getElementById('bgColorOpacity').value = parsed.opacity;
                const opLabel = document.getElementById('bgColorOpacityValue');
                if (opLabel) opLabel.textContent = parsed.opacity;
                extractedSomething = true;
            }
        }
    }

    // Container colors
    const tables = doc.querySelectorAll('table[bgcolor], table[style*="background"]');
    if (tables.length > 0) {
        for (let table of tables) {
            const bgcolor = table.getAttribute('bgcolor');
            const style = table.getAttribute('style') || '';

            const parsedBg = parseColor(bgcolor);
            if (parsedBg) {
                document.getElementById('containerColor').value = parsedBg.hex;
                document.getElementById('containerColorValue').value = parsedBg.hex;
                document.getElementById('containerColorOpacity').value = parsedBg.opacity;
                const opLabel = document.getElementById('containerColorOpacityValue');
                if (opLabel) opLabel.textContent = parsedBg.opacity;
                extractedSomething = true;
                break;
            }

            const bgMatch = style.match(/background(?:-color)?:\s*([^;]+)/);
            if (bgMatch) {
                const parsedStyle = parseColor(bgMatch[1]);
                if (parsedStyle) {
                    document.getElementById('containerColor').value = parsedStyle.hex;
                    document.getElementById('containerColorValue').value = parsedStyle.hex;
                    document.getElementById('containerColorOpacity').value = parsedStyle.opacity;
                    const opLabel = document.getElementById('containerColorOpacityValue');
                    if (opLabel) opLabel.textContent = parsedStyle.opacity;
                    extractedSomething = true;
                    break;
                }
            }
        }
    }

    // Border color & text color from main container table
    const mainTable = doc.querySelector('table[style*="width:800px"]');
    if (mainTable) {
        const mtStyle = mainTable.getAttribute('style') || '';
        const borderMatch = mtStyle.match(/border:\s*\d+px solid ([^;]+)/);
        if (borderMatch) {
            const parsedBorder = parseColor(borderMatch[1]);
            if (parsedBorder) {
                document.getElementById('borderColor').value = parsedBorder.hex;
                document.getElementById('borderColorValue').value = parsedBorder.hex;
                document.getElementById('borderColorOpacity').value = parsedBorder.opacity;
                const opLabel = document.getElementById('borderColorOpacityValue');
                if (opLabel) opLabel.textContent = parsedBorder.opacity;
            }
        }
    }

    // Text format (font-size, line-height, text-align, font-weight, letter-spacing) from first <p> in content
    const firstP = doc.querySelector('td[style*="padding:0 0 25px 0"] p') ||
                  doc.querySelector('td[style*="padding:40px 30px"] p');

    // Text color from content td or first <p>
    const contentTd = doc.querySelector('td[style*="padding:0 0 25px 0"]') ||
                     doc.querySelector('td[style*="padding:40px 30px"]');
    let textColorFound = false;
    if (contentTd) {
        const ctStyle = contentTd.getAttribute('style') || '';
        const colorMatch = ctStyle.match(/(?<![a-z-])color:\s*([^;]+)/);
        if (colorMatch) {
            const parsedTxt = parseColor(colorMatch[1]);
            if (parsedTxt) {
                document.getElementById('textColor').value = parsedTxt.hex;
                document.getElementById('textColorValue').value = parsedTxt.hex;
                document.getElementById('textColorOpacity').value = parsedTxt.opacity;
                const opLabel = document.getElementById('textColorOpacityValue');
                if (opLabel) opLabel.textContent = parsedTxt.opacity;
                textColorFound = true;
            }
        }
    }
    if (!textColorFound && firstP) {
        const pStyle = firstP.getAttribute('style') || '';
        const colorMatch = pStyle.match(/(?<![a-z-])color:\s*([^;]+)/);
        if (colorMatch) {
            const parsedTxt = parseColor(colorMatch[1]);
            if (parsedTxt) {
                document.getElementById('textColor').value = parsedTxt.hex;
                document.getElementById('textColorValue').value = parsedTxt.hex;
                document.getElementById('textColorOpacity').value = parsedTxt.opacity;
                const opLabel = document.getElementById('textColorOpacityValue');
                if (opLabel) opLabel.textContent = parsedTxt.opacity;
            }
        }
    }

    if (firstP) {
        const pStyle = firstP.getAttribute('style') || '';
        const fsMatch = pStyle.match(/font-size:\s*(\d+)px/);
        if (fsMatch) document.getElementById('textFontSize').value = fsMatch[1];
        const lhMatch = pStyle.match(/line-height:\s*(\d+)px/);
        if (lhMatch) document.getElementById('textLineHeight').value = lhMatch[1];
        const taMatch = pStyle.match(/text-align:\s*(\w+)/);
        if (taMatch) document.getElementById('textAlign').value = taMatch[1];
        const fwMatch = pStyle.match(/font-weight:\s*(\w+)/);
        if (fwMatch) document.getElementById('textFontWeight').value = fwMatch[1];
        const lsMatch = pStyle.match(/letter-spacing:\s*(\d+)px/);
        if (lsMatch) document.getElementById('textLetterSpacing').value = lsMatch[1];
    }

    // Button styles
    const buttonTable = doc.querySelector('table.miboton') ||
                       doc.querySelector('table[align="center"][style*="background"]');

    if (buttonTable) {
        const buttonStyle = buttonTable.getAttribute('style') || '';
        const buttonTdForColor = buttonTable.querySelector('td');
        const buttonTdStyle = buttonTdForColor ? (buttonTdForColor.getAttribute('style') || '') : '';

        const widthMatch = buttonStyle.match(/width:\s*(\d+)px/);
        if (widthMatch) {
            document.getElementById('buttonWidth').value = widthMatch[1];
            extractedSomething = true;
        }

        const bgMatch = buttonStyle.match(/background(?:-color)?:\s*([^;]+)/) ||
                        buttonTdStyle.match(/background(?:-color)?:\s*([^;]+)/);
        if (bgMatch) {
            const parsedBtn = parseColor(bgMatch[1]);
            if (parsedBtn) {
                document.getElementById('buttonColor').value = parsedBtn.hex;
                document.getElementById('buttonColorValue').value = parsedBtn.hex;
                document.getElementById('buttonColorOpacity').value = parsedBtn.opacity;
                const opLabel = document.getElementById('buttonColorOpacityValue');
                if (opLabel) opLabel.textContent = parsedBtn.opacity;
                extractedSomething = true;
            }
        }

        const radiusMatch = buttonStyle.match(/border-radius:\s*(\d+)px/) ||
                           buttonTdStyle.match(/border-radius:\s*(\d+)px/);
        if (radiusMatch) {
            document.getElementById('buttonBorderRadius').value = radiusMatch[1];
        }

        const borderMatch = buttonStyle.match(/border:\s*(\d+)px solid ([^;]+)/);
        if (borderMatch) {
            document.getElementById('buttonBorderWidth').value = borderMatch[1];
            const parsedBdr = parseColor(borderMatch[2]);
            if (parsedBdr) {
                document.getElementById('buttonBorderColor').value = parsedBdr.hex;
                document.getElementById('buttonBorderColorValue').value = parsedBdr.hex;
                document.getElementById('buttonBorderColorOpacity').value = parsedBdr.opacity;
                const opLabel = document.getElementById('buttonBorderColorOpacityValue');
                if (opLabel) opLabel.textContent = parsedBdr.opacity;
            }
        } else {
            document.getElementById('buttonBorderWidth').value = '0';
        }

        const marginMatch = buttonStyle.match(/margin:\s*(\d+)px\s+(\S+)\s+(\d+)px\s+(\S+)/);
        if (marginMatch) {
            document.getElementById('buttonMarginTop').value = marginMatch[1];
            document.getElementById('buttonMarginBottom').value = marginMatch[3];
            const align = buttonTable.getAttribute('align') || '';
            if (align === 'center' || marginMatch[2] === 'auto') {
                document.getElementById('buttonAlign').value = 'center';
            }
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
            const colorMatch = spanStyle.match(/(?<![a-z-])color:\s*([^;]+)/);
            if (colorMatch) {
                const parsedTxtColor = parseColor(colorMatch[1]);
                if (parsedTxtColor) {
                    document.getElementById('buttonTextColor').value = parsedTxtColor.hex;
                    document.getElementById('buttonTextColorValue').value = parsedTxtColor.hex;
                    document.getElementById('buttonTextColorOpacity').value = parsedTxtColor.opacity;
                    const opLabel = document.getElementById('buttonTextColorOpacityValue');
                    if (opLabel) opLabel.textContent = parsedTxtColor.opacity;
                }
            }
            const btnP = buttonTable.querySelector('p');
            const btnPStyle = btnP ? (btnP.getAttribute('style') || '') : '';
            const btnFontSizeMatch = spanStyle.match(/font-size:\s*(\d+)px/) || btnPStyle.match(/font-size:\s*(\d+)px/);
            if (btnFontSizeMatch) {
                document.getElementById('buttonFontSize').value = btnFontSizeMatch[1];
            }
            const btnLineHeightMatch = spanStyle.match(/line-height:\s*(\d+)px/) || btnPStyle.match(/line-height:\s*(\d+)px/);
            if (btnLineHeightMatch) {
                document.getElementById('buttonLineHeight').value = btnLineHeightMatch[1];
            }
            const btnFontWeightMatch = spanStyle.match(/font-weight:\s*(\w+)/);
            if (btnFontWeightMatch) {
                document.getElementById('buttonFontWeight').value = btnFontWeightMatch[1];
            } else {
                document.getElementById('buttonFontWeight').value = 'normal';
            }
            // Nowrap
            if (spanStyle.includes('white-space') && spanStyle.includes('nowrap')) {
                document.getElementById('buttonNoWrap').value = 'yes';
            } else {
                document.getElementById('buttonNoWrap').value = 'no';
            }

            // Button text (from <a> or <span> text content)
            const btnTextContent = buttonSpan.textContent.trim();
            if (btnTextContent && !btnTextContent.startsWith('{{')) {
                document.getElementById('emailButtonText').value = btnTextContent;
            }
        }
    }

    // Email content
    let emailContent = '';
    const contentArea = doc.querySelector('td[style*="padding:0 0 25px"]') ||
                       doc.querySelector('td[style*="padding: 0 0 25px"]') ||
                       doc.querySelector('td[style*="padding:0px 0px 25px"]') ||
                       doc.querySelector('td[style*="padding:40px 30px"]') ||
                       doc.querySelector('.note') ||
                       doc.querySelector('table[bgcolor="#ffffff"] td') ||
                       doc.querySelector('body');

    if (contentArea) {
        const extractTextAndVariables = (element) => {
            // Recursively extract text, converting <strong>/<b> to **, <em>/<i> to *, <u> to __
            const processNode = (node) => {
                let result = '';
                if (node.nodeType === Node.TEXT_NODE) {
                    return node.textContent;
                }
                if (node.nodeName === 'BR') {
                    return '\n';
                }
                if (node.nodeName === 'HR') {
                    return '---\n';
                }
                if (node.classList && node.classList.contains('miboton')) {
                    var btnText = node.textContent.trim();
                    if (btnText.includes('{{email_button}}')) return '{{email_button}}';
                    if (btnText.includes('{{validate_button}}')) return '{{validate_button}}';
                    if (btnText.includes('{{dashboard_button}}')) return '{{dashboard_button}}';
                    if (btnText.includes('{{sign_button}}')) return '{{sign_button}}';
                    return '{{sign_button}}';
                }
                const tag = node.nodeName;
                if (tag === 'UL') {
                    let prefix = buildStylePrefix(node);
                    let items = '';
                    for (const li of node.querySelectorAll(':scope > li')) {
                        let liContent = '';
                        for (const c of li.childNodes) liContent += processNode(c);
                        items += prefix + '- ' + liContent.trim() + '\n';
                    }
                    return items;
                }
                if (tag === 'OL') {
                    let prefix = buildStylePrefix(node);
                    let items = '';
                    let idx = 1;
                    for (const li of node.querySelectorAll(':scope > li')) {
                        let liContent = '';
                        for (const c of li.childNodes) liContent += processNode(c);
                        items += prefix + idx + '. ' + liContent.trim() + '\n';
                        idx++;
                    }
                    return items;
                }
                let childContent = '';
                for (const child of node.childNodes) {
                    childContent += processNode(child);
                }

                if (tag === 'STRONG' || tag === 'B') {
                    result = '**' + childContent + '**';
                } else if (tag === 'EM' || tag === 'I') {
                    result = '*' + childContent + '*';
                } else if (tag === 'U') {
                    result = '__' + childContent + '__';
                } else if (tag === 'P') {
                    let prefix = buildStylePrefix(node);
                    result = prefix + childContent.trim() + '\n';
                } else {
                    result = childContent;
                }
                return result;
            };

            let content = '';
            for (const child of element.childNodes) {
                content += processNode(child);
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
        .split('\n')
        .map(l => l.trim())
        .join('\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();

    if (emailContent) {
        document.getElementById('emailContent').value = emailContent;
    }

    // Footer parsing
    // The footer is the last <tr> in the main container table, after the content row.
    // It can be a direct <td> with background or a nested centered table.
    // Footer detection: first try inside main 800px table, then external sibling tables
    const mainContainerTable = doc.querySelector('table[style*="width:800px"]');
    let footerTd = null;
    let footerWidthPercent = '100';

    if (mainContainerTable) {
        const allRows = mainContainerTable.querySelectorAll(':scope > tbody > tr, :scope > tr');
        const lastRow = allRows.length > 0 ? allRows[allRows.length - 1] : null;

        if (lastRow) {
            const lastTd = lastRow.querySelector('td');
            const lastTdStyle = lastTd ? (lastTd.getAttribute('style') || '') : '';

            const nestedTable = lastTd ? lastTd.querySelector('table[align="center"]') : null;
            if (nestedTable) {
                const nestedStyle = nestedTable.getAttribute('style') || '';
                const nestedWidthMatch = nestedStyle.match(/width:\s*(\d+)%/);
                if (nestedWidthMatch) {
                    footerWidthPercent = nestedWidthMatch[1];
                }
                footerTd = nestedTable.querySelector('td');
            } else if (lastTdStyle.includes('background') && !lastTdStyle.includes('padding:30px 0 20px 0') && !lastTdStyle.includes('padding:0 0 25px 0')) {
                footerTd = lastTd;
            }
        }
    }

    // External footer: look for last max-width:600px table with dark background
    let externalFooterTableStyle = '';
    if (!footerTd) {
        const allMaxWidthTables = doc.querySelectorAll('table[style*="max-width:600px"]');
        if (allMaxWidthTables.length > 1) {
            const lastTable = allMaxWidthTables[allMaxWidthTables.length - 1];
            const ltStyle = lastTable.getAttribute('style') || '';
            if (ltStyle.includes('background')) {
                footerTd = lastTable.querySelector('td');
                externalFooterTableStyle = ltStyle;
            }
        }
    }

    if (footerTd) {
        const ftdStyle = footerTd.getAttribute('style') || '';
        const combinedFooterStyle = ftdStyle + ';' + externalFooterTableStyle;

        document.getElementById('footerEnabled').value = 'yes';
        const footerOpts = document.getElementById('footerOptions');
        if (footerOpts) footerOpts.style.display = 'block';

        document.getElementById('footerWidth').value = footerWidthPercent;
        const footerWidthValue = document.getElementById('footerWidthValue');
        if (footerWidthValue) footerWidthValue.textContent = footerWidthPercent + '%';

        const ftBgMatch = combinedFooterStyle.match(/background(?:-color)?:\s*([^;]+)/);
        if (ftBgMatch) {
            const parsedFtBg = parseColor(ftBgMatch[1]);
            if (parsedFtBg) {
                document.getElementById('footerBgColor').value = parsedFtBg.hex;
                document.getElementById('footerBgColorValue').value = parsedFtBg.hex;
            }
        }

        const ftPadMatch = ftdStyle.match(/padding:\s*(\d+)px\s+(\d+)px\s+(\d+)px\s+(\d+)px/);
        if (ftPadMatch) {
            document.getElementById('footerPaddingTop').value = ftPadMatch[1];
            document.getElementById('footerPaddingRight').value = ftPadMatch[2];
            document.getElementById('footerPaddingBottom').value = ftPadMatch[3];
            document.getElementById('footerPaddingLeft').value = ftPadMatch[4];
        } else {
            const ftPadMatch2 = ftdStyle.match(/padding:\s*(\d+)px\s+(\d+)px/);
            if (ftPadMatch2) {
                document.getElementById('footerPaddingTop').value = ftPadMatch2[1];
                document.getElementById('footerPaddingRight').value = ftPadMatch2[2];
                document.getElementById('footerPaddingBottom').value = ftPadMatch2[1];
                document.getElementById('footerPaddingLeft').value = ftPadMatch2[2];
            }
        }

        const ftBorderTopMatch = ftdStyle.match(/border-top:\s*(\d+)px solid ([^;]+)/);
        const ftBorderRightMatch = ftdStyle.match(/border-right:\s*(\d+)px solid ([^;]+)/);
        const ftBorderBottomMatch = ftdStyle.match(/border-bottom:\s*(\d+)px solid ([^;]+)/);
        const ftBorderLeftMatch = ftdStyle.match(/border-left:\s*(\d+)px solid ([^;]+)/);

        if (ftBorderTopMatch) document.getElementById('footerBorderTop').value = ftBorderTopMatch[1];
        if (ftBorderRightMatch) document.getElementById('footerBorderRight').value = ftBorderRightMatch[1];
        if (ftBorderBottomMatch) document.getElementById('footerBorderBottom').value = ftBorderBottomMatch[1];
        if (ftBorderLeftMatch) document.getElementById('footerBorderLeft').value = ftBorderLeftMatch[1];

        const borderColorSource = ftBorderTopMatch || ftBorderRightMatch || ftBorderBottomMatch || ftBorderLeftMatch;
        if (borderColorSource) {
            const parsedFtBdr = parseColor(borderColorSource[2]);
            if (parsedFtBdr) {
                document.getElementById('footerBorderColor').value = parsedFtBdr.hex;
                document.getElementById('footerBorderColorValue').value = parsedFtBdr.hex;
            }
        }

        const footerImg = footerTd.querySelector('img');
        if (footerImg) {
            const imgSrc = footerImg.getAttribute('src') || '';
            if (imgSrc && !imgSrc.includes('data:image')) {
                document.getElementById('footerImageUrl').value = imgSrc;
            }
            const imgStyle = footerImg.getAttribute('style') || '';
            const imgWMatch = imgStyle.match(/width:\s*([^;]+)/);
            if (imgWMatch) document.getElementById('footerImageWidth').value = imgWMatch[1].trim();
            const imgHMatch = imgStyle.match(/height:\s*([^;]+)/);
            if (imgHMatch) document.getElementById('footerImageHeight').value = imgHMatch[1].trim();
        }

        const footerPs = footerTd.querySelectorAll(':scope > p');
        let footerText = '';
        let firstFooterP = true;
        const extractInlineFormatting = (el) => {
            let r = '';
            for (const ch of el.childNodes) {
                if (ch.nodeType === Node.TEXT_NODE) { r += ch.textContent; }
                else if (ch.nodeName === 'STRONG' || ch.nodeName === 'B') { r += '**' + extractInlineFormatting(ch) + '**'; }
                else if (ch.nodeName === 'EM' || ch.nodeName === 'I') { r += '*' + extractInlineFormatting(ch) + '*'; }
                else if (ch.nodeName === 'U') { r += '__' + extractInlineFormatting(ch) + '__'; }
                else if (ch.nodeName === 'BR') { r += '\n'; }
                else { r += extractInlineFormatting(ch); }
            }
            return r;
        };
        footerPs.forEach(p => {
            if (!firstFooterP) footerText += '\n';
            firstFooterP = false;
            footerText += extractInlineFormatting(p).trim();

            const pStyle = p.getAttribute('style') || '';
            const ftColorMatch = pStyle.match(/(?<![a-z-])color:\s*([^;]+)/);
            if (ftColorMatch) {
                const parsedFtTxt = parseColor(ftColorMatch[1]);
                if (parsedFtTxt) {
                    document.getElementById('footerTextColor').value = parsedFtTxt.hex;
                    document.getElementById('footerTextColorValue').value = parsedFtTxt.hex;
                }
            }
            const ftFsMatch = pStyle.match(/font-size:\s*(\d+)px/);
            if (ftFsMatch) document.getElementById('footerFontSize').value = ftFsMatch[1];
            const ftLhMatch = pStyle.match(/line-height:\s*(\d+)px/);
            if (ftLhMatch) document.getElementById('footerLineHeight').value = ftLhMatch[1];
            const ftAlignMatch = pStyle.match(/text-align:\s*(\w+)/);
            if (ftAlignMatch) document.getElementById('footerTextAlign').value = ftAlignMatch[1];
        });
        document.getElementById('footerContent').value = footerText;

        // Social links from footer
        const footerLinks = footerTd.querySelectorAll('a[href]');
        footerLinks.forEach(a => {
            const href = a.getAttribute('href') || '';
            if (href.includes('linkedin.com')) document.getElementById('footerLinkedin').value = href;
            else if (href.includes('x.com') || href.includes('twitter.com')) document.getElementById('footerTwitter').value = href;
            else if (href.includes('instagram.com')) document.getElementById('footerInstagram').value = href;
            else if (href.includes('facebook.com')) document.getElementById('footerFacebook').value = href;
        });

        extractedSomething = true;
    } else {
        document.getElementById('footerEnabled').value = 'no';
        const footerOpts = document.getElementById('footerOptions');
        if (footerOpts) footerOpts.style.display = 'none';
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
//  CARGAR TEMPLATE PREDEFINIDO
// ═══════════════════════════════════

function loadPresetTemplate() {
    const lang = document.getElementById('templateLanguage').value;
    const templateType = document.getElementById('templateType').value;

    if (!lang) {
        showToast('Selecciona un idioma primero');
        return;
    }

    // Intentar cargar HTML custom (Revel, etc.)
    const customTemplates = CUSTOM_HTML_TEMPLATES[lang];
    if (customTemplates && customTemplates[templateType]) {
        parseHTMLTemplate(customTemplates[templateType]);
        showToast('Template HTML "' + templateType + '" (' + TEMPLATE_LANGUAGE_NAMES[lang] + ') cargado');
        return;
    }
    if (customTemplates && !customTemplates[templateType]) {
        const availableType = Object.keys(customTemplates)[0];
        if (availableType) {
            parseHTMLTemplate(customTemplates[availableType]);
            showToast('Template "' + availableType + '" (' + TEMPLATE_LANGUAGE_NAMES[lang] + ') cargado (unico disponible)');
            return;
        }
    }

    // Intentar cargar HTML completo precargado (Signbook)
    const htmlTemplates = SIGNBOOK_HTML_TEMPLATES[lang];
    if (htmlTemplates && htmlTemplates[templateType]) {
        parseHTMLTemplate(htmlTemplates[templateType]);
        showToast('Template HTML "' + templateType + '" (' + TEMPLATE_LANGUAGE_NAMES[lang] + ') cargado');
        return;
    }

    // Fallback: cargar solo texto
    const templates = EMAIL_TEMPLATES[lang];
    if (!templates || !templates[templateType]) {
        showToast('No hay template predefinido para este tipo e idioma');
        return;
    }

    const template = templates[templateType];
    document.getElementById('emailContent').value = template.content;

    // Abrir seccion de contenido del email
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

    updatePreview();
    showToast('Template "' + templateType + '" (' + TEMPLATE_LANGUAGE_NAMES[lang] + ') cargado');
}

// ═══════════════════════════════════
//  BRANDING APP PREVIEW
// ═══════════════════════════════════

function updateBrandingPreview() {
    const frame = document.getElementById('brandingPreviewFrame');
    if (!frame) return;

    const headerColor = document.getElementById('brandingHeaderColor').value;
    const footerColor = document.getElementById('brandingFooterColor').value;
    const layoutColor = document.getElementById('brandingLayoutColor').value;
    const appTextColor = document.getElementById('brandingTextColor').value;
    const logoUrl = document.getElementById('logoUrl').value || '';
    const termsText = document.getElementById('brandingTermsText').value || '';
    const showWelcome = document.getElementById('brandingShowWelcome').checked;

    // Formato de texto (compartido con el email)
    const textFontSize = document.getElementById('textFontSize').value || '16';
    const textLineHeight = document.getElementById('textLineHeight').value || '24';
    const textAlign = document.getElementById('textAlign').value || 'left';
    const textFontWeight = document.getElementById('textFontWeight').value || 'normal';

    // Textos personalizados de botones
    const signButtonText = document.getElementById('brandingSignButton').value.trim() || 'Firmar';
    const sendButtonText = document.getElementById('brandingSendButton').value.trim() || 'Acepto';
    const openSignButtonText = document.getElementById('brandingOpenSignButton').value.trim() || 'VER DOCUMENTO';
    const openEmailButtonText = document.getElementById('brandingOpenEmailButton').value.trim() || 'VER EMAIL';
    const multiPageText = document.getElementById('brandingMultiPage').value.trim() || '';
    const photoText = document.getElementById('brandingPhotoText').value.trim() || '';
    const voiceText = document.getElementById('brandingVoiceText').value.trim() || '';

    // Determinar color de texto para contraste
    const isDarkBg = isColorDark(layoutColor);
    const btnTextColor = isDarkBg ? '#ffffff' : '#333333';

    const isDarkHeader = isColorDark(headerColor);
    const headerTextColor = isDarkHeader ? '#ffffff' : '#333333';

    const isDarkFooter = isColorDark(footerColor);
    const footerTextColor = isDarkFooter ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.5)';

    const logoHTML = logoUrl
        ? '<img src="' + escapeHTML(logoUrl) + '" alt="Logo" style="max-height: 36px; max-width: 180px; object-fit: contain;">'
        : '<div style="font-family: \'Brush Script MT\', cursive; font-size: 22px; color: ' + headerTextColor + ';">Signaturit</div>';

    const termsHTML = termsText
        ? '<div style="margin-top: 12px; padding: 10px 14px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; font-size: 11px; color: #6b7280; max-height: 80px; overflow-y: auto;">' +
          '<strong style="color: #374151;">Terminos y condiciones:</strong><br>' +
          escapeHTML(termsText) +
          '</div>'
        : '';

    // Welcome page preview
    const welcomePageHTML = showWelcome ? `
        <div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 24px; background: white; margin-bottom: 16px; max-width: 320px; margin-left: auto; margin-right: auto;">
            <div style="text-align: center; margin-bottom: 16px;">
                ${logoUrl ? '<img src="' + escapeHTML(logoUrl) + '" alt="Logo" style="max-height: 50px; max-width: 200px; object-fit: contain;">' : '<div style="font-family: \'Brush Script MT\', cursive; font-size: 28px; color: #333;">Signaturit</div><div style="font-size: 10px; color: #999; margin-top: -4px;">Sign anywhere, anytime</div>'}
            </div>
            <div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px;">
                <h4 style="margin: 0 0 14px 0; font-size: 14px; color: #333; text-align: center;">Como funciona?</h4>
                <div style="display: flex; align-items: flex-start; gap: 10px; margin-bottom: 12px;">
                    <div style="width: 24px; height: 24px; border-radius: 50%; background: ${layoutColor}15; display: flex; align-items: center; justify-content: center; flex-shrink: 0; font-size: 12px; color: ${layoutColor};">1</div>
                    <div>
                        <div style="font-size: 12px; font-weight: 600; color: #333;">Revisa el documento</div>
                        <div style="font-size: 11px; color: #888;">Si no estas de acuerdo, contacta con el remitente.</div>
                    </div>
                </div>
                <div style="display: flex; align-items: flex-start; gap: 10px; margin-bottom: 12px;">
                    <div style="width: 24px; height: 24px; border-radius: 50%; background: ${layoutColor}15; display: flex; align-items: center; justify-content: center; flex-shrink: 0; font-size: 12px; color: ${layoutColor};">2</div>
                    <div>
                        <div style="font-size: 12px; font-weight: 600; color: #333;">Firma el documento</div>
                        <div style="font-size: 11px; color: #888;">Pulsa el boton "${escapeHTML(signButtonText)}" o el campo de firma.</div>
                    </div>
                </div>
                <div style="display: flex; align-items: flex-start; gap: 10px; margin-bottom: 16px;">
                    <div style="width: 24px; height: 24px; border-radius: 50%; background: ${layoutColor}15; display: flex; align-items: center; justify-content: center; flex-shrink: 0; font-size: 12px; color: ${layoutColor};">3</div>
                    <div>
                        <div style="font-size: 12px; font-weight: 600; color: #333;">Terminos y condiciones</div>
                        <div style="font-size: 11px; color: #888;">Acepta los terminos y pulsa "Enviar documento".</div>
                    </div>
                </div>
                <button style="width: 100%; padding: 10px; background: ${layoutColor}; color: ${btnTextColor}; border: none; border-radius: 6px; font-size: 13px; font-weight: 600; cursor: default;">Empezar</button>
            </div>
        </div>
    ` : '';

    const previewHTML = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; background: #f5f5f5; min-height: 100%; overflow: auto;">
        <!-- Header -->
        <div style="background: ${headerColor}; padding: 10px 20px; display: flex; align-items: center; justify-content: space-between; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
            <div style="display: flex; align-items: center; gap: 12px;">
                <div style="background: rgba(255,255,255,0.15); padding: 6px 12px; border-radius: 4px; font-size: 12px; color: ${headerTextColor}; cursor: default;">Acciones</div>
                <span style="font-size: 12px; color: ${headerTextColor}; opacity: 0.8;">Tienes 3 campos a rellenar</span>
            </div>
            <button style="background: ${layoutColor}; color: ${btnTextColor}; border: none; padding: 8px 20px; border-radius: 4px; font-size: 12px; font-weight: 600; cursor: default;">${escapeHTML(signButtonText)}</button>
        </div>

        <div style="padding: 20px;">
            ${welcomePageHTML}

            <!-- Document area -->
            <div style="background: white; border-radius: 8px; padding: 30px; max-width: 500px; margin: 0 auto; box-shadow: 0 1px 3px rgba(0,0,0,0.06);">
                <div style="text-align: center; margin-bottom: 20px;">
                    ${logoUrl ? '<img src="' + escapeHTML(logoUrl) + '" alt="Logo" style="max-height: 60px; max-width: 250px; object-fit: contain;">' : '<div style="font-family: \'Brush Script MT\', cursive; font-size: 32px; color: #333;">Signaturit</div><div style="font-size: 11px; color: #999; margin-top: -4px; text-align: center;">Sign anywhere, anytime</div>'}
                </div>

                <h3 style="text-align: ${textAlign}; font-size: ${parseInt(textFontSize) + 2}px; color: ${appTextColor}; margin: 20px 0 16px; font-weight: bold;">Sample document template</h3>

                <p style="font-size: ${textFontSize}px; color: ${appTextColor}; line-height: ${textLineHeight}px; text-align: ${textAlign}; margin-bottom: 20px; font-weight: ${textFontWeight};">
                    This is an example of a document created with Signaturit, the fastest way to get documents signed with legal validity.
                </p>

                <div style="border: 2px dashed ${layoutColor}; border-radius: 8px; padding: 16px; text-align: center; margin-bottom: 20px;">
                    <div style="background: ${layoutColor}; color: ${btnTextColor}; display: inline-block; padding: 6px 14px; border-radius: 4px; font-size: 11px; font-weight: 500;">Pulsa para rellenar campo en la pagina 1</div>
                </div>

                ${termsHTML}

                <div style="margin-top: 16px;">
                    <label style="display: flex; align-items: center; gap: 8px; font-size: 12px; color: #555; cursor: default; margin-bottom: 8px;">
                        <input type="checkbox" disabled style="width: 14px; height: 14px; accent-color: ${layoutColor};">
                        Acepto los <a style="color: ${layoutColor}; text-decoration: underline;">terminos y condiciones</a>
                    </label>
                    <label style="display: flex; align-items: center; gap: 8px; font-size: 11px; color: #555; cursor: default;">
                        <input type="checkbox" disabled style="width: 14px; height: 14px; accent-color: ${layoutColor};">
                        Acepto que se encripte la biometria de la firma
                    </label>
                </div>

                <button style="margin-top: 16px; padding: 10px 28px; background: ${layoutColor}; color: ${btnTextColor}; border: none; border-radius: 6px; font-size: 13px; font-weight: 600; cursor: default;">${escapeHTML(sendButtonText)}</button>
            </div>
        </div>

        <!-- Email Preview: Sending Email -->
        <div style="max-width: 500px; margin: 20px auto; background: white; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.06); overflow: hidden;">
            <div style="background: ${headerColor}; padding: 14px 20px; text-align: center;">
                ${logoUrl ? '<img src="' + escapeHTML(logoUrl) + '" alt="Logo" style="max-height: 40px; max-width: 180px; object-fit: contain;">' : '<div style="font-family: \'Brush Script MT\', cursive; font-size: 24px; color: ' + headerTextColor + ';">Signaturit</div>'}
            </div>
            <div style="padding: 24px 20px; text-align: ${textAlign};">
                <div style="font-size: 11px; color: #999; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px;">Preview Email de Firma</div>
                <p style="font-size: ${textFontSize}px; color: ${appTextColor}; line-height: ${textLineHeight}px; margin: 0 0 8px; font-weight: ${textFontWeight};">Estimado/a <em>Nombre Firmante</em>,</p>
                <p style="font-size: ${textFontSize}px; color: ${appTextColor}; line-height: ${textLineHeight}px; margin: 0 0 16px; font-weight: ${textFontWeight};">Tiene documentacion pendiente de firma.</p>
                <a style="display: inline-block; padding: 12px 32px; background: ${layoutColor}; color: ${btnTextColor}; border-radius: 6px; font-size: 14px; font-weight: 600; text-decoration: none; cursor: default;">${escapeHTML(openSignButtonText)}</a>
            </div>
            <div style="background: ${footerColor}; padding: 10px 20px; text-align: center;">
                <div style="font-size: 10px; color: ${footerTextColor};">Powered by Signaturit</div>
            </div>
        </div>

        <!-- Email Preview: Certified Email -->
        <div style="max-width: 500px; margin: 20px auto; background: white; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.06); overflow: hidden;">
            <div style="background: ${headerColor}; padding: 14px 20px; text-align: center;">
                ${logoUrl ? '<img src="' + escapeHTML(logoUrl) + '" alt="Logo" style="max-height: 40px; max-width: 180px; object-fit: contain;">' : '<div style="font-family: \'Brush Script MT\', cursive; font-size: 24px; color: ' + headerTextColor + ';">Signaturit</div>'}
            </div>
            <div style="padding: 24px 20px; text-align: ${textAlign};">
                <div style="font-size: 11px; color: #999; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px;">Preview Email Certificado</div>
                <p style="font-size: ${textFontSize}px; color: ${appTextColor}; line-height: ${textLineHeight}px; margin: 0 0 16px; font-weight: ${textFontWeight};">Tiene un nuevo email certificado pendiente.</p>
                <a style="display: inline-block; padding: 12px 32px; background: ${layoutColor}; color: ${btnTextColor}; border-radius: 6px; font-size: 14px; font-weight: 600; text-decoration: none; cursor: default;">${escapeHTML(openEmailButtonText)}</a>
            </div>
            <div style="background: ${footerColor}; padding: 10px 20px; text-align: center;">
                <div style="font-size: 10px; color: ${footerTextColor};">Powered by Signaturit</div>
            </div>
        </div>

        ${multiPageText || photoText || voiceText ? '<div style="max-width: 500px; margin: 20px auto; background: white; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.06); padding: 16px 20px;">' +
            '<div style="font-size: 11px; color: #999; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 10px; text-align: center;">Textos Personalizados</div>' +
            (multiPageText ? '<div style="display: flex; align-items: center; gap: 8px; padding: 8px 12px; background: #f0f4ff; border-radius: 6px; margin-bottom: 6px;"><span style="font-size: 16px;">📄</span><span style="font-size: 12px; color: #555;"><strong>Multi-pagina:</strong> ' + escapeHTML(multiPageText) + '</span></div>' : '') +
            (photoText ? '<div style="display: flex; align-items: center; gap: 8px; padding: 8px 12px; background: #f0fff4; border-radius: 6px; margin-bottom: 6px;"><span style="font-size: 16px;">📷</span><span style="font-size: 12px; color: #555;"><strong>Foto:</strong> ' + escapeHTML(photoText) + '</span></div>' : '') +
            (voiceText ? '<div style="display: flex; align-items: center; gap: 8px; padding: 8px 12px; background: #fff4f0; border-radius: 6px;"><span style="font-size: 16px;">🎤</span><span style="font-size: 12px; color: #555;"><strong>Voz:</strong> ' + escapeHTML(voiceText) + '</span></div>' : '') +
            '</div>' : ''}

        <!-- Footer -->
        <div style="background: ${footerColor}; padding: 14px 20px; text-align: center; margin-top: 20px;">
            <div style="font-size: 11px; color: ${footerTextColor};">Powered by Signaturit - Firma electronica con validez legal</div>
        </div>
    </div>`;

    frame.innerHTML = previewHTML;
}

function isColorDark(hexColor) {
    const hex = hexColor.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance < 0.5;
}

// ── Email Content Format Helpers ──
function wrapEmailSelection(before, after) {
    const textarea = document.getElementById('emailContent');
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = textarea.value.substring(start, end);
    const wrapped = before + (selected || 'texto') + after;
    textarea.value = textarea.value.substring(0, start) + wrapped + textarea.value.substring(end);
    textarea.focus();
    // Select the inner text for easy replacement
    const innerStart = start + before.length;
    const innerEnd = innerStart + (selected || 'texto').length;
    textarea.setSelectionRange(innerStart, innerEnd);
    updatePreview();
}

function insertListPrefix(prefix) {
    const textarea = document.getElementById('emailContent');
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = textarea.value.substring(start, end);
    if (selected.includes('\n')) {
        const lines = selected.split('\n').map(l => l.trim() ? prefix + l.replace(/^[-•]\s*|^\d+\.\s*/, '') : l);
        textarea.value = textarea.value.substring(0, start) + lines.join('\n') + textarea.value.substring(end);
    } else {
        const lineStart = textarea.value.lastIndexOf('\n', start - 1) + 1;
        const before = textarea.value.substring(0, lineStart);
        const currentLine = textarea.value.substring(lineStart, end);
        const after = textarea.value.substring(end);
        const newLine = currentLine.replace(/^[-•]\s*|^\d+\.\s*/, '');
        textarea.value = before + prefix + newLine + after;
    }
    textarea.focus();
    updatePreview();
}

function insertLineBreak() {
    const textarea = document.getElementById('emailContent');
    if (!textarea) return;
    const pos = textarea.selectionStart;
    textarea.value = textarea.value.substring(0, pos) + '\n---\n' + textarea.value.substring(pos);
    textarea.focus();
    textarea.setSelectionRange(pos + 5, pos + 5);
    updatePreview();
}

function applyLineStyle() {
    const textarea = document.getElementById('emailContent');
    if (!textarea) return;
    const size = document.getElementById('lineStyleSize').value;
    const color = document.getElementById('lineStyleColor').value;
    if (!size && color === '#333333') {
        showToast('Selecciona un tamaño y/o color distinto');
        return;
    }
    const pos = textarea.selectionStart;
    const text = textarea.value;
    let lineStart = text.lastIndexOf('\n', pos - 1) + 1;
    let lineEnd = text.indexOf('\n', pos);
    if (lineEnd === -1) lineEnd = text.length;
    let line = text.substring(lineStart, lineEnd);

    // Remove existing style marker
    line = line.replace(/^\{(?!\{)[^}]*\}\s*/, '');

    // Build new marker
    const parts = [];
    if (size) parts.push('s:' + size);
    if (color && color !== '#333333') parts.push('c:' + color);
    const marker = parts.length > 0 ? '{' + parts.join(',') + '} ' : '';

    textarea.value = text.substring(0, lineStart) + marker + line + text.substring(lineEnd);
    textarea.focus();
    const newPos = lineStart + marker.length + line.length;
    textarea.setSelectionRange(newPos, newPos);
    updatePreview();
}

function wrapFooterSelection(before, after) {
    const textarea = document.getElementById('footerContent');
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = textarea.value.substring(start, end);
    const wrapped = before + (selected || 'texto') + after;
    textarea.value = textarea.value.substring(0, start) + wrapped + textarea.value.substring(end);
    textarea.focus();
    const innerStart = start + before.length;
    const innerEnd = innerStart + (selected || 'texto').length;
    textarea.setSelectionRange(innerStart, innerEnd);
    updatePreview();
}

// ── HTML Format Helpers for Terms ──
function insertHTMLTag(textareaId, tag, selfClosing) {
    const textarea = document.getElementById(textareaId);
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = textarea.value.substring(start, end);

    let insertion;
    if (selfClosing) {
        insertion = '<' + tag + '>';
    } else {
        insertion = '<' + tag + '>' + selected + '</' + tag + '>';
    }

    textarea.value = textarea.value.substring(0, start) + insertion + textarea.value.substring(end);
    textarea.focus();
    const cursorPos = selfClosing ? start + insertion.length : start + tag.length + 2 + selected.length;
    textarea.setSelectionRange(cursorPos, cursorPos);
    updateTermsPreview();
}

function insertHTMLLink(textareaId) {
    const textarea = document.getElementById(textareaId);
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = textarea.value.substring(start, end) || 'texto del link';
    const url = prompt('URL del enlace:', 'https://');
    if (!url) return;

    const insertion = '<a href="' + url + '">' + selected + '</a>';
    textarea.value = textarea.value.substring(0, start) + insertion + textarea.value.substring(end);
    textarea.focus();
    updateTermsPreview();
}

function updateTermsPreview() {
    const textarea = document.getElementById('brandingTermsText');
    const previewDiv = document.getElementById('termsPreview');
    const previewContent = document.getElementById('termsPreviewContent');
    if (!textarea || !previewDiv || !previewContent) return;

    const val = textarea.value.trim();
    if (val) {
        previewDiv.style.display = '';
        // Sanitize: only allow b, i, u, a, br, strong, em tags
        const sanitized = val.replace(/<(?!\/?(?:b|i|u|a|br|strong|em)\b)[^>]*>/gi, '');
        previewContent.innerHTML = sanitized;
    } else {
        previewDiv.style.display = 'none';
        previewContent.innerHTML = '';
    }
}

// ── Preview Tabs ──
let currentPreviewTab = 'email';

function switchPreviewTab(tab) {
    currentPreviewTab = tab;
    const emailContainer = document.getElementById('previewContainer');
    const brandingContainer = document.getElementById('brandingPreviewContainer');
    const tabEmail = document.getElementById('tabEmailPreview');
    const tabBranding = document.getElementById('tabBrandingPreview');

    if (tab === 'email') {
        emailContainer.style.display = '';
        brandingContainer.style.display = 'none';
        tabEmail.classList.add('active');
        tabBranding.classList.remove('active');
        updatePreview();
    } else {
        emailContainer.style.display = 'none';
        brandingContainer.style.display = '';
        tabEmail.classList.remove('active');
        tabBranding.classList.add('active');
        updateBrandingPreview();
    }

    // Show/hide editor sections based on active tab
    updateEditorSectionsVisibility(tab);
}

function switchEditorTab(tab) {
    if (tab === 'email') switchPreviewTab('email');
    else if (tab === 'app') switchPreviewTab('branding');
    else updateEditorSectionsVisibility(tab);
}

function updateEditorSectionsVisibility(tab) {
    // Normalize: switchPreviewTab passes 'branding' but data attributes use 'app'
    const normalizedTab = (tab === 'branding') ? 'app' : tab;
    document.querySelectorAll('.editor-tab').forEach(btn => {
        const isActive = btn.getAttribute('data-editor-tab') === normalizedTab;
        btn.classList.toggle('active', isActive);
        btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });
    const visibleSections = [];
    document.querySelectorAll('[data-preview-tab]').forEach(el => {
        const sectionTab = el.getAttribute('data-preview-tab');
        if (sectionTab === normalizedTab) {
            el.style.display = '';
            if (el.classList.contains('collapsible-section')) visibleSections.push(el);
        } else {
            el.style.display = 'none';
        }
    });
    // Open the first section only if the tab has nothing open, so the panel stays short
    const anyOpen = visibleSections.some(s => s.querySelector('.collapsible-content.active'));
    if (!anyOpen && visibleSections.length > 0) {
        visibleSections[0].querySelector('.collapsible-header')?.classList.add('active');
        visibleSections[0].querySelector('.collapsible-content')?.classList.add('active');
    }
    const controls = document.querySelector('.controls');
    if (controls) controls.scrollTop = 0;
    updateSaveBar();
}

function updateSaveBar() {
    const label = document.getElementById('savebarLabel');
    const value = document.getElementById('savebarValue');
    if (!label || !value) return;
    const tplType = document.getElementById('templateType')?.value || '';
    if (isNewBranding) {
        label.textContent = 'Nuevo branding';
        value.textContent = 'se crea al guardar · ' + tplType;
    } else {
        label.textContent = 'Template';
        value.textContent = tplType;
    }
}

function refreshCurrentPreview() {
    if (currentPreviewTab === 'email') {
        updatePreview();
    } else {
        updateBrandingPreview();
    }
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
//  MOBILE RESPONSIVE
// ═══════════════════════════════════

function getMobileCSS() {
    const enabled = document.getElementById('mobileEnabled');
    if (!enabled || !enabled.checked) return '';

    const maxWidth = document.getElementById('mobileMaxWidth').value || '100';
    const fontSize = document.getElementById('mobileFontSize').value || '14';
    const lineHeight = document.getElementById('mobileLineHeight').value || '20';
    const btnFontSize = document.getElementById('mobileButtonFontSize').value || '16';
    const btnWidth = document.getElementById('mobileButtonWidth').value || '100';
    const padding = document.getElementById('mobilePadding').value || '10';
    const logoWidth = document.getElementById('mobileLogoWidth').value || '120';

    return `
\t\t@media only screen and (max-width: 600px) {
\t\t\tbody { padding: 0 !important; margin: 0 !important; }
\t\t\ttable[role="presentation"] { width: ${maxWidth}% !important; }
\t\t\ttd { padding-left: ${padding}px !important; padding-right: ${padding}px !important; }
\t\t\tp { font-size: ${fontSize}px !important; line-height: ${lineHeight}px !important; }
\t\t\timg[alt="Logo"] { width: ${logoWidth}px !important; height: auto !important; }
\t\t\ttable.miboton { width: ${btnWidth}% !important; margin-left: auto !important; margin-right: auto !important; }
\t\t\ttable.miboton span.mititulo { font-size: ${btnFontSize}px !important; }
\t\t}`;
}

let isMobilePreview = false;

function toggleMobilePreview() {
    isMobilePreview = !isMobilePreview;
    const previewContainer = document.getElementById('previewContainer');
    const btn = document.getElementById('btnMobilePreview');
    const frame = document.getElementById('previewFrame');

    if (isMobilePreview) {
        previewContainer.style.display = 'flex';
        previewContainer.style.justifyContent = 'center';
        frame.style.maxWidth = '375px';
        frame.style.width = '375px';
        frame.style.margin = '0 auto';
        frame.style.transition = 'max-width 0.3s ease';
        frame.style.padding = '0';
        frame.style.overflow = 'hidden';
        btn.style.background = '#0d6efd';
        btn.style.color = '#fff';
        btn.textContent = 'Desktop';
    } else {
        frame.style.maxWidth = '';
        frame.style.width = '100%';
        frame.style.margin = '';
        frame.style.padding = '20px';
        frame.style.overflow = 'auto';
        previewContainer.style.justifyContent = '';
        btn.style.background = '';
        btn.style.color = '';
        btn.textContent = 'Mobile';
    }
    updatePreview();
}

// ═══════════════════════════════════
//  PREVIEW
// ═══════════════════════════════════

function updatePreview() {
    updateSaveBar();
    const frame = document.getElementById('previewFrame');
    if (frame) {
        let html = generateHTML();

        // Reemplazar magic words con valores de preview
        const emailButtonText = document.getElementById('emailButtonText').value.trim();
        const openSignBtn = document.getElementById('brandingOpenSignButton');
        const openEmailBtn = document.getElementById('brandingOpenEmailButton');

        html = html.replace(/\{\{sign_button\}\}/g, emailButtonText || (openSignBtn && openSignBtn.value.trim()) || 'VER DOCUMENTO');
        html = html.replace(/\{\{email_button\}\}/g, emailButtonText || (openEmailBtn && openEmailBtn.value.trim()) || 'VER EMAIL');
        html = html.replace(/\{\{validate_button\}\}/g, emailButtonText || 'VALIDAR');
        html = html.replace(/\{\{dashboard_button\}\}/g, emailButtonText || 'IR AL DASHBOARD');
        html = html.replace(/\{\{signer_name\}\}/g, 'Nombre Firmante');
        html = html.replace(/\{\{signer_email\}\}/g, 'firmante@ejemplo.com');
        html = html.replace(/\{\{sender_email\}\}/g, 'remitente@ejemplo.com');
        html = html.replace(/\{\{filename\}\}/g, 'documento_ejemplo.pdf');
        html = html.replace(/\{\{remaining_time\}\}/g, '31/12/2026');
        html = html.replace(/\{\{email_body\}\}/g, 'Texto adicional del email');
        html = html.replace(/\{\{code\}\}/g, '123456');
        html = html.replace(/\{\{reason\}\}/g, 'Motivo de rechazo');
        html = html.replace(/\{\{signers\}\}/g, 'Firmante 1, Firmante 2');

        // Logo: usar URL del logo si existe
        const logoUrl = document.getElementById('logoUrl').value;
        if (logoUrl) {
            html = html.replace(/\{\{logo\}\}/g, '<img src="' + logoUrl + '" alt="Logo" style="max-height:60px;">');
        } else {
            html = html.replace(/\{\{logo\}\}/g, 'Logo');
        }

        if (isMobilePreview) {
            // Use iframe so media queries fire based on iframe width, not browser viewport
            frame.innerHTML = '';
            const iframe = document.createElement('iframe');
            iframe.style.width = '100%';
            iframe.style.border = 'none';
            iframe.style.display = 'block';
            frame.appendChild(iframe);
            const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
            iframeDoc.open();
            iframeDoc.write(html);
            iframeDoc.close();
            // Auto-adjust iframe height to content
            const adjustHeight = () => {
                const h = iframeDoc.documentElement.scrollHeight || iframeDoc.body.scrollHeight;
                iframe.style.height = h + 'px';
            };
            iframe.onload = adjustHeight;
            setTimeout(adjustHeight, 100);
            setTimeout(adjustHeight, 500);
        } else {
            frame.innerHTML = html;
        }
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
    // Reset footer toggle visibility
    const footerOpts = document.getElementById('footerOptions');
    if (footerOpts) footerOpts.style.display = 'none';

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

    // Event listeners para todos los inputs del editor - actualizan ambas previews
    function updateActivePreview() {
        if (currentPreviewTab === 'email') {
            updatePreview();
        } else {
            updateBrandingPreview();
        }
    }

    document.querySelectorAll('#viewEditor input:not([type="range"]):not([type="checkbox"]):not([type="file"]), #viewEditor textarea, #viewEditor select').forEach(element => {
        element.addEventListener('input', updateActivePreview);
    });

    // Sync emailButtonText <-> brandingOpenSignButton
    const ebText = document.getElementById('emailButtonText');
    const osbText = document.getElementById('brandingOpenSignButton');
    if (ebText && osbText) {
        ebText.addEventListener('input', () => { osbText.value = ebText.value; });
        osbText.addEventListener('input', () => { ebText.value = osbText.value; });
    }

    // Al cambiar tipo de template, cargar el contenido del nuevo tipo
    // NO regeneramos HTML del tipo anterior para evitar contaminar con magic words incorrectas.
    // Los templates originales de la API se preservan intactos en selectedBrandingTemplates.
    // Solo se actualizan cuando el usuario hace "Guardar" explícitamente.
    document.getElementById('templateType').addEventListener('change', function() {
        const newType = this.value;
        this._previousValue = newType;

        const templateHTML = selectedBrandingTemplates[newType];
        if (templateHTML) {
            try {
                // Parsear solo el contenido del email, no resetear estilos
                parseEmailContentOnly(templateHTML);
            } catch (e) {
                document.getElementById('emailContent').value = '';
            }
            updatePreview();
            showToast('Template "' + newType + '" cargado');
        } else {
            // Template vacío - solo limpiar textarea, mantener estilos
            document.getElementById('emailContent').value = '';
            updatePreview();
            showToast('Template "' + newType + '" — nuevo (sin contenido previo)');
        }
        renderVariables();
    });

    // Checkboxes de la app
    const brandingShowWelcome = document.getElementById('brandingShowWelcome');
    if (brandingShowWelcome) {
        brandingShowWelcome.addEventListener('change', updateActivePreview);
    }

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
                updateActivePreview();
            });
        }
    });

    // Footer width slider
    const footerWidthSlider = document.getElementById('footerWidth');
    const footerWidthValue = document.getElementById('footerWidthValue');
    if (footerWidthSlider && footerWidthValue) {
        footerWidthSlider.addEventListener('input', function() {
            footerWidthValue.textContent = this.value + '%';
            updateActivePreview();
        });
    }

    // Footer toggle
    const footerEnabledSelect = document.getElementById('footerEnabled');
    if (footerEnabledSelect) {
        const footerOpts = document.getElementById('footerOptions');
        footerEnabledSelect.addEventListener('change', function() {
            if (footerOpts) footerOpts.style.display = this.value === 'yes' ? 'block' : 'none';
            updateActivePreview();
        });
        // Set initial state
        if (footerOpts) footerOpts.style.display = footerEnabledSelect.value === 'yes' ? 'block' : 'none';
    }

    // Terms preview auto-update
    const termsTextarea = document.getElementById('brandingTermsText');
    if (termsTextarea) {
        termsTextarea.addEventListener('input', () => {
            updateTermsPreview();
        });
    }

    updatePreview();
    updateEditorSectionsVisibility(currentPreviewTab);
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

// ═══════════════════════════════════
//  EXPORTAR / IMPORTAR BRANDING
// ═══════════════════════════════════

// IDs de todos los campos del formulario para exportar/importar
const EXPORT_FIELD_IDS = [
    // Email content
    'logoUrl', 'logoWidth', 'logoHeight', 'logoObjectFit', 'emailContent', 'emailButtonText',
    // Email colors
    'bgColor', 'bgColorOpacity', 'containerColor', 'containerColorOpacity',
    'borderColor', 'borderColorOpacity', 'textColor', 'textColorOpacity',
    // Button style
    'buttonColor', 'buttonColorOpacity', 'buttonTextColor', 'buttonTextColorOpacity',
    'buttonBorderColor', 'buttonBorderColorOpacity',
    'buttonBorderWidth', 'buttonBorderRadius',
    'buttonPaddingTop', 'buttonPaddingRight', 'buttonPaddingBottom', 'buttonPaddingLeft',
    'buttonMarginTop', 'buttonMarginBottom', 'buttonAlign',
    'buttonWidth', 'buttonFontSize', 'buttonLineHeight', 'buttonFontWeight', 'buttonNoWrap',
    // Text format
    'textFontSize', 'textLineHeight', 'textLetterSpacing', 'textAlign', 'textFontWeight',
    // Footer
    'footerEnabled', 'footerWidth', 'footerContent', 'footerImageUrl', 'footerImageWidth', 'footerImageHeight',
    'footerBgColor', 'footerTextColor', 'footerFontSize', 'footerLineHeight', 'footerTextAlign',
    'footerBorderColor', 'footerBorderTop', 'footerBorderRight', 'footerBorderBottom', 'footerBorderLeft',
    'footerPaddingTop', 'footerPaddingRight', 'footerPaddingBottom', 'footerPaddingLeft',
    'footerLinkedin', 'footerTwitter', 'footerInstagram', 'footerFacebook',
    // App branding colors
    'brandingHeaderColor', 'brandingFooterColor', 'brandingLayoutColor', 'brandingTextColor',
    // App branding flags
    'brandingShowWelcome', 'brandingShowCsv', 'brandingShowBiometricHash',
    'brandingSignatureColor', 'brandingCsvPosition',
    // App branding application_texts
    'brandingSignButton', 'brandingSendButton', 'brandingOpenSignButton', 'brandingOpenEmailButton',
    'brandingMultiPage', 'brandingPhotoText', 'brandingVoiceText', 'brandingTermsText',
    // Mobile
    'mobileEnabled', 'mobileMaxWidth', 'mobileFontSize', 'mobileLineHeight',
    'mobileButtonFontSize', 'mobileButtonWidth', 'mobilePadding', 'mobileLogoWidth',
    // Subjects
    'emailSubject', 'brandingSubjectTag',
    // Callback ref
    'callbackUrlRef'
];

function exportBranding() {
    const brandingName = document.getElementById('editorBrandingName').value || 'branding';
    const data = {
        _exportVersion: 1,
        _exportDate: new Date().toISOString(),
        brandingName: brandingName,
        templates: {},
        formFields: {}
    };

    // Export all templates
    for (const [name, content] of Object.entries(selectedBrandingTemplates)) {
        if (content) {
            data.templates[name] = content;
        }
    }

    // Export all form field values
    for (const id of EXPORT_FIELD_IDS) {
        const el = document.getElementById(id);
        if (!el) continue;
        if (el.type === 'checkbox') {
            data.formFields[id] = el.checked;
        } else {
            data.formFields[id] = el.value;
        }
    }

    // Export variables list
    if (typeof variables !== 'undefined' && variables.length > 0) {
        data.variables = variables;
    }

    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const safeName = brandingName.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 30);
    a.href = url;
    a.download = safeName + '_branding.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Branding exportado: ' + a.download);
}

function importBranding() {
    document.getElementById('importBrandingFile').click();
}

function handleImportBranding(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            if (!data.formFields && !data.templates) {
                showToast('Archivo no valido: no contiene datos de branding');
                return;
            }

            // Restore branding name
            if (data.brandingName) {
                document.getElementById('editorBrandingName').value = data.brandingName;
            }

            // Restore form fields
            if (data.formFields) {
                for (const [id, value] of Object.entries(data.formFields)) {
                    const el = document.getElementById(id);
                    if (!el) continue;
                    if (el.type === 'checkbox') {
                        el.checked = !!value;
                    } else {
                        el.value = value;
                    }
                    // Sync color text inputs
                    const colorValueEl = document.getElementById(id + 'Value');
                    if (colorValueEl && el.type === 'color') {
                        colorValueEl.value = value;
                    }
                    // Sync opacity display spans
                    const opacitySpan = document.getElementById(id + 'Value');
                    if (id.endsWith('Opacity') && opacitySpan) {
                        opacitySpan.textContent = Math.round(parseFloat(value) * 100) + '%';
                    }
                }

                // Show/hide footer options
                const footerEnabled = document.getElementById('footerEnabled');
                const footerOptions = document.getElementById('footerOptions');
                if (footerEnabled && footerOptions) {
                    footerOptions.style.display = footerEnabled.value === 'yes' ? '' : 'none';
                }

                // Sync footer width slider display
                const footerWidth = document.getElementById('footerWidth');
                const footerWidthValue = document.getElementById('footerWidthValue');
                if (footerWidth && footerWidthValue) {
                    footerWidthValue.textContent = footerWidth.value + '%';
                }
            }

            // Restore templates
            if (data.templates) {
                selectedBrandingTemplates = {};
                for (const [name, content] of Object.entries(data.templates)) {
                    selectedBrandingTemplates[name] = content;
                }
            }

            // Restore variables list
            if (data.variables && Array.isArray(data.variables)) {
                variables = data.variables;
            }

            // Update UI
            updatePreview();
            renderVariables();
            renderVariablesInline();
            updateVariableCount();

            showToast('Branding importado: ' + (data.brandingName || file.name));
        } catch (err) {
            showToast('Error al importar: ' + err.message);
            console.error('Import error:', err);
        }
    };
    reader.readAsText(file);
    // Reset para permitir re-importar el mismo archivo
    event.target.value = '';
}

// Arrancar cuando el DOM este listo
document.addEventListener('DOMContentLoaded', initApp);
