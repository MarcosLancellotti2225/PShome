// Matriz interna: ficha cerrada + main de Signaframe (+ matriz del INS) → matriz interna (.xlsx).
// Lógica copiada TAL CUAL de legacy-src/ficha-formulario/interno.html (MI v3.0.0): lectura de la ficha,
// buildMatrix y exportXlsx. Único agregado: la función matrizInterna() de abajo, que reemplaza a miRun()
// sin tocar el DOM (el catálogo y ExcelJS se pasan como parámetros).
/* eslint-disable */
import { DIC, DIC_PDF } from './dic.js';

let ExcelJS = null;
const esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));

/* ═══════════════════ Lectura de la ficha ═══════════════════ */
const cellTxt=v=>{
  if(v==null)return"";
  if(typeof v==="object"){
    if(v.richText)return v.richText.map(r=>r.text).join("");
    if(v.text!=null)return String(v.text);
    if(v.result!=null)return String(v.result);
    if(v instanceof Date)return v.toISOString().slice(0,10);
    return"";
  }
  return String(v);
};
function sheetRows(ws){
  const out=[];if(!ws)return out;
  const n=ws.columnCount;
  ws.eachRow({includeEmpty:true},(row,i)=>{const a=[];for(let c=1;c<=n;c++)a.push(cellTxt(row.getCell(c).value).trim());out[i-1]=a});
  for(let i=0;i<out.length;i++)if(!out[i])out[i]=[];
  return out;
}
const normR=r=>String(r||"").trim().replace(/\[(?:i|\d*)\]/g,"[0]");
const unq=s=>String(s||"").trim().replace(/^["“”']+|["“”']+$/g,"").trim();
const deacc=s=>String(s||"").normalize("NFD").replace(/[̀-ͯ]/g,"");
const slug=s=>deacc(s).toLowerCase().replace(/\(.*?\)/g,"").replace(/[^a-z0-9]+/g,"_").replace(/^_|_$/g,"");
const snake=s=>String(s||"").replace(/([a-z0-9])([A-Z])/g,"$1_$2").toLowerCase();
const leafOf=r=>{const m=String(r||"").match(/([A-Za-z0-9_]+)(?:\[\d*\])?$/);return m?m[1]:""};
const parentOf=r=>String(r||"").replace(/\.[^.]+$/,"");

function readFicha(wb){
  const ws=wb.getWorksheet("Formulario");
  if(!ws)throw new Error("La ficha no tiene la hoja «Formulario»");
  const rows=sheetRows(ws);
  const hi=rows.findIndex(r=>r.includes("ID")&&r.includes("Pregunta"));
  if(hi<0)throw new Error("No encuentro el encabezado de «Formulario»");
  const H=rows[hi],col=n=>H.indexOf(n);
  const C={id:col("ID"),sec:col("Sección"),sub:col("Subsección"),label:col("Pregunta"),tipo:col("Tipo de respuesta"),oblig:col("Obligatoria"),
    origen:col("Origen"),repite:col("Se repite"),armado:col("Se arma con / parte de"),muestra:col("Se muestra si"),opts:col("Opciones"),
    reglas:col("Reglas / formato"),valor:col("Valor o cálculo"),boxes:col("Casilleros del PDF"),estadoPdf:col("Estado PDF"),
    ruta:col("Ruta JSON"),estadoJson:col("Estado JSON"),notas:col("Trazabilidad")};
  if(C.notas<0)C.notas=col("Notas");
  const g=(r,k)=>C[k]>=0?(r[C[k]]||""):"";
  const Q=[];
  for(const r of rows.slice(hi+1)){
    const id=g(r,"id");
    if(!/^P-\d+/.test(id))continue;
    const boxes=g(r,"boxes").split(/\s*\/\s*|\n/).map(s=>s.trim()).filter(s=>s&&!/^[—-]/.test(s));
    Q.push({id,sec:g(r,"sec"),sub:g(r,"sub"),label:g(r,"label").replace(/\s*:\s*$/,""),rawLabel:g(r,"label"),tipo:g(r,"tipo"),
      oblig:/^s[ií]/i.test(g(r,"oblig")),obligTxt:g(r,"oblig"),origen:g(r,"origen"),repite:g(r,"repite"),reglas:g(r,"reglas"),
      valor:g(r,"valor"),boxes,ruta:normR(g(r,"ruta")),rutaFicha:g(r,"ruta"),estadoJson:g(r,"estadoJson"),notas:g(r,"notas"),opts:[]});
  }
  const byId=Object.fromEntries(Q.map(q=>[q.id,q]));
  const wo=wb.getWorksheet("Opciones");
  if(wo){
    const R=sheetRows(wo),h=R[0]||[],oc=n=>h.indexOf(n);
    const ci={id:oc("ID"),ord:oc("Orden"),lab:oc("Opción (como se ve)"),code:oc("Código"),box:oc("Casilla del PDF")};
    for(const r of R.slice(1)){
      const q=byId[r[ci.id]];if(!q)continue;
      const box=(r[ci.box]||"").trim();
      q.opts.push({ord:+r[ci.ord]||q.opts.length+1,label:(r[ci.lab]||"").trim(),code:unq(r[ci.code]),box:/^[—-]/.test(box)?"":box});
    }
  }
  const routes=new Set();
  const wj=wb.getWorksheet("JSON del cliente");
  if(wj){const R=sheetRows(wj);const c=(R[0]||[]).indexOf("Ruta");for(const r of R.slice(1))if(r[c])routes.add(normR(r[c]))}
  const sheets=wb.worksheets.map(w=>({name:w.name,rows:sheetRows(w)}));
  return{Q,byId,routes,sheets};
}

/* Texto legal de la Matriz del INS: filas «Texto Informativo» */
function readInsLegal(wb){
  const out=[];
  for(const ws of wb.worksheets){
    const R=sheetRows(ws);const h=R[0]||[];
    const cTipo=h.findIndex(x=>/tipo de control/i.test(x)),cNom=h.findIndex(x=>/nombre del campo en formulario/i.test(x)),cSec=h.findIndex(x=>/^secci/i.test(x));
    if(cTipo<0||cNom<0)continue;
    for(const r of R.slice(1))if(/texto informativo/i.test(r[cTipo]||"")&&(r[cNom]||"").length>40)out.push({hoja:ws.name,seccion:r[cSec]||"",texto:r[cNom]});
  }
  return out;
}

/* ═══════════════════ Reglas ═══════════════════ */
const CR_DATE={placeholder:"dd/mm/aaaa",jsonDateFormat:"DD/MM/YYYY",pdfDateFormat:"DD/MM/YYYY"};
const EMAIL={validationPattern:"^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$",validationErrorMessage:"Correo electrónico no válido"};
/* Códigos INS de tipo de identificación (los mismos del 5919 y de la matriz v1) */
const TIPO_ID=[["Cédula Física Nacional","0",/cedula/],["DIMEX","6",/dimex/],["DIDI","12",/didi/],["Pasaporte","9",/pasaporte/]];
const NAME_PARTS=["primerApellido","segundoApellido","primerNombre","segundoNombre"];
const IDENT_ORDER=["codigoTipoIdentificacion","numeroIdentificacion",...NAME_PARTS,"nombreCompleto","correoElectronico"];
const ENC_ID={codigoTipoFormulario:"codigo_tipo_formulario",descripcionTipoFormulario:"descripcion_tipo_formulario",codigoTipoTramite:"codigo_tipo_tramite",
  descripcionTipoTramite:"descripcion_tipo_tramite",identificadorTransaccionInterno:"identificador_transaccion",correoElectronico:"correo",
  codigoProducto:"codigo_producto",descripcionProducto:"descripcion_producto",nombreCompletoCliente:"nombre_cliente",identificadorArchivo:"identificador_archivo",
  conozcaClienteActualizado:"conozca_cliente",sedeAdministradora:"sede",descripcionSedeAdministradora:"descripcion_sede",metodoEnvioFormulario:"metodo_envio"};

/* Pasos en el orden fijo del diccionario */
const STEPS=[
  {k:"dg",id:"section_datos_generales",title:"Datos Generales"},
  {k:"per",id:"section_persona",title:"Datos del Asegurado"},
  {k:"dep",id:"section_dependientes",title:"Dependientes"},
  {k:"rie",id:"section_riesgo",title:"Información del Riesgo"},
  {k:"ben",id:"section_beneficiarios",title:"Beneficiarios"},
  {k:"fir",id:"section_firmas",title:"Firmas",hidden:true,always:true},
  {k:"dec",id:"section_declaraciones",title:"Declaraciones y Autorización",always:true}
];
/* Subsecciones fijas (nombres del diccionario V10) */
const SUBS=[
  {k:"poliza",step:"dg",id:"sub_poliza_madre",title:"Datos de la Póliza Madre (oculto)",hidden:true,re:/datosGenerales\.polizaMadre\./},
  {k:"asesor",step:"dg",id:"sub_asesor",title:"Datos del Asesor",re:/datosGenerales\.intermediario\./},
  {k:"solicitud",step:"dg",id:"sub_solicitud",title:"Información de la Solicitud",re:/datosGenerales\.(lugar|fechaCreacion)$/},
  {k:"adicional",step:"dg",id:"sub_informacion_adicional",title:"Información adicional",re:/datosFormulario\.datosAdicionales\./},
  {k:"sistema",step:"dg",id:"sub_datos_sistema",title:"Datos del Sistema (oculto)",hidden:true,re:/^encabezado\.|personas\[0\]\.(codigoTipo|descripcionTipo)$/},
  {k:"persona",step:"per",id:"sub_datos_persona",title:"Datos del Asegurado",re:/personas\[0\]\.[A-Za-z]+$/},
  {k:"contacto",step:"per",id:"sub_contacto",title:"Contacto y Ubicación",re:/personas\[0\]\.direccion/},
  {k:"notif",step:"per",id:"sub_notificacion",title:"Preferencias de Notificación",re:/personas\[0\]\.mediosNotificacion/},
  {k:"firmas",step:"fir",id:"sub_firmas",title:"Firmas"},
  {k:"decl",step:"dec",id:"sub_declaraciones",title:"Declaraciones y Autorización",re:/indicadorAceptaTerminos$/}
];
const DIC_BY_ROUTE={};
for(const d of DIC)DIC_BY_ROUTE[normR(String(d[4]||"").replace(/\[\]/g,"[0]"))]=d;

function placeQ(q){
  const r=q.ruta;
  for(const s of SUBS)if(s.re&&s.re.test(r)&&s.k!=="persona")return{step:s.step,sub:s};
  if(/\.riesgo\[/.test(r)||/riesgo/i.test(q.sec))return{step:"rie",subTitle:q.sub||"Riesgo"};
  if(/beneficiari/i.test(r)||/beneficiari/i.test(q.sub))return{step:"ben",subTitle:q.sub||"Beneficiarios"};
  if(/personas\[[1-9]\d*\]|dependiente/i.test(r)||/dependiente/i.test(q.sub))return{step:"dep",subTitle:q.sub||"Dependientes"};
  if(/^datosFormulario\.datosGenerales\./.test(r))return{step:"dg",sub:SUBS.find(s=>s.k==="solicitud")};
  const per=SUBS.find(s=>s.k==="persona");
  if(per.re.test(r))return{step:"per",sub:per};
  const d=DIC_BY_ROUTE[r];
  if(d){const st=/riesgo/i.test(d[2])?"rie":/benef/i.test(d[2])?"ben":/depend/i.test(d[2])?"dep":/declarac/i.test(d[2])?"dec":/general/i.test(d[2])?"dg":"per";return{step:st,subTitle:d[3]}}
  return{step:"per",sub:per};
}

/* Ids: los campos del PDF son siempre field_<casillero>; el resto sale de la ruta */
function baseFromRoute(r){
  const leaf=leafOf(r);
  if(/^encabezado\./.test(r))return"enc_"+(ENC_ID[leaf]||snake(leaf));
  if(/polizaMadre\./.test(r))return"pm_"+snake(leaf).replace("tipo_identificacion","tipo_id");
  if(/intermediario\./.test(r))return"intermediario_"+snake(leaf).replace(/_intermediario$/,"").replace("correo_electronico","correo").replace("tipo_identificacion","tipo_id");
  let b=snake(leaf).replace("correo_electronico","correo").replace(/^indicador_/,"");
  if(/^descripcion_/.test(b))b=b.replace("tipo_identificacion","tipo_id");
  if(/^codigo_[a-z]+_/.test(b))b=b.replace(/^codigo_/,"");
  else if(/^codigo_(provincia|canton|distrito|pais)$/.test(b))b=b.replace(/^codigo_/,"");
  return(/personas\[0\]/.test(r)?"asg_":"")+b;
}
const boxBase=bs=>{ // prefijo común de un grupo de casilleros
  if(!bs.length)return"";
  let p=bs[0];for(const b of bs)while(!b.startsWith(p))p=p.slice(0,-1);
  return p.replace(/_+$/,"");
};
const helperBase=b=>b.replace(/^asg_/,"").replace(/^field_/,"");

function buildMatrix(F,opts={}){
  const main=opts.main||null,CAT=opts.cat||null,legal=opts.legal||[];
  const R={warn:[],added:[],dropped:[],fuera:[],repeaters:[]};
  const mainNames=main?new Set(main.sections.flatMap(s=>s.fields||[]).filter(f=>f.sourceMeta&&f.sourceMeta.sourceName).map(f=>f.sourceMeta.sourceName)):null;
  const usedIds=new Set();
  const uid=id=>{let x=id,n=2;while(usedIds.has(x))x=id+"_"+(n++);usedIds.add(x);return x};
  const ficha=q=>q?{q}:{interno:true};
  const hasNombreCompleto=F.Q.some(q=>leafOf(q.ruta)==="nombreCompleto"&&/personas\[0\]/.test(q.ruta));
  const forced=q=>/datosGenerales\.(polizaMadre|intermediario)\.|^encabezado\.|indicadorAceptaTerminos$|personas\[0\]\.(codigoTipo|descripcionTipo)$/.test(q.ruta)
    ||(hasNombreCompleto&&NAME_PARTS.includes(leafOf(q.ruta))&&/personas\[0\]\.[a-zA-Z]+$/.test(q.ruta));

  /* 1 · dentro / fuera */
  const inQ=[];
  for(const q of F.Q){
    const inJson=F.routes.has(q.ruta);
    if(!q.boxes.length&&!inJson&&!forced(q)){q.fuera="No está en el PDF ni en el JSON del cliente";R.fuera.push(q);continue}
    inQ.push(q);
  }

  /* 2 · ubicación en pasos y subsecciones */
  const steps=STEPS.map(s=>({...s,subs:[]}));
  const stepOf=k=>steps.find(s=>s.k===k);
  const subOf=(stepK,def)=>{
    const st=stepOf(stepK);
    let s=st.subs.find(x=>x.id===def.id);
    if(!s){s={id:def.id,title:def.title,hidden:!!def.hidden,k:def.k||def.id,qs:[],fields:[],tail:[]};st.subs.push(s)}
    return s;
  };
  for(const q of inQ){
    const p=placeQ(q);
    const def=p.sub||{id:"sub_"+slug(p.subTitle),title:p.subTitle};
    q._sub=subOf(p.step,def);q._sub.qs.push(q);
  }
  /* orden fijo de subsecciones de Datos Generales y Persona */
  const ORD=SUBS.map(s=>s.id);
  for(const st of steps)if(st.k==="dg"||st.k==="per")st.subs.sort((a,b)=>(ORD.indexOf(a.id)+1||99)-(ORD.indexOf(b.id)+1||99));

  /* orden dentro de la subsección */
  for(const st of steps)for(const s of st.subs){
    if(s.id==="sub_datos_persona"){
      const idx=q=>{const i=IDENT_ORDER.indexOf(leafOf(q.ruta));return i<0?99:i};
      const head=s.qs.filter(q=>idx(q)<99).sort((a,b)=>idx(a)-idx(b));
      let rest=s.qs.filter(q=>idx(q)===99);
      // la moneda va pegada al monto (tipoMonedaIngreso → ingreso…)
      for(const m of rest.filter(q=>/^tipoMoneda(\w+)/.test(leafOf(q.ruta)))){
        const w=leafOf(m.ruta).replace(/^tipoMoneda/,"").toLowerCase();
        const t=rest.find(q=>q!==m&&leafOf(q.ruta).toLowerCase().startsWith(w));
        if(t){rest=rest.filter(q=>q!==m);rest.splice(rest.indexOf(t)+1,0,m)}
      }
      s.qs=[...head,...rest];
    }
    // la pregunta que «despliega todas» va primero
    const all=s.qs.find(q=>/despliega todas/i.test(q.reglas));
    if(all){s.qs=[all,...s.qs.filter(q=>q!==all)]}
  }

  /* 3 · campos */
  const isSiNo=q=>/s[ií]\s*\/\s*no/i.test(q.tipo);
  const T={"Texto corto":"text","Texto largo":"textarea","Número":"number","Fecha":"date","Email":"text","Porcentaje":"number","Casilla de aceptación":"checkbox"};
  const maxLenOf=q=>{let m=q.reglas.match(/alfanum[ée]rico\s*\((\d+)\)/i)||q.notas.match(/num[ée]rico y (\d+) d[ií]gitos/i)||q.notas.match(/(\d+) caracteres/i);return m?+m[1]:null};
  const phOf=q=>{const m=q.notas.match(/placeholder con el texto:\s*(.+)/i);return m?m[1].trim():null};
  const helpOf=q=>{const m=q.notas.match(/descripci[oó]n de cada opci[oó]n del combo:\s*([\s\S]+?)(?:\n(?:Cruce|La matriz|La ficha|Mapeo|dato solo)|$)/i);
    return m?m[1].split(/\n+/).map(x=>x.trim()).filter(Boolean).map(x=>x.replace(/:\s*(\p{Lu})/u,(_,c)=>": "+c.toLowerCase())).join(" "):null};
  const prellen=q=>/prellenado/i.test(q.origen);
  const optsClean=q=>{
    const out=[];
    for(const o of q.opts){
      if(/^s[ií]\s*\/\s*no$/i.test(o.label))continue;
      if(/^pendiente$/i.test(o.code)){R.dropped.push(`${q.id} «${q.label}»: opción «${o.label}» sin código (pendiente) — no se incluye`);continue}
      const code=/^del$/i.test(o.code)?"":o.code;
      out.push({label:o.label,pdfValue:o.label,jsonValue:code||o.label,_box:o.box});
    }
    return out;
  };
  const base=(q,f)=>{ // propiedades comunes de un campo con JSON
    f.jsonOutputPath=q.ruta;f.prefillKey=q.ruta;
    return f;
  };
  const push=(s,q,f,{tail=false}={})=>{f._q=q;(tail?s.tail:s.fields).push(f);return f};
  const W=(q,type)=>{
    const l=leafOf(q.ruta);
    if(type==="date")return l==="fechaCreacion"?"fit":"quarter";
    if(type==="number")return"quarter";
    if(type==="select")return"third";
    if(NAME_PARTS.includes(l))return"quarter";
    if(/^(numeroIdentificacion|lugar|correoElectronico|nombre)$/.test(l))return"half";
    if(l==="identificacion"||l==="codigoIntermediario")return"quarter";
    if(l==="datosNotificacion")return"two-thirds";
    return"full";
  };
  const siNoRadios=(s,q,b,{withBox})=>{
    const si=uid("field_"+b+"_si"),no=uid("field_"+b+"_no");
    const common={optionsLayout:"horizontal",sharedValue:true,pdfValue:"X"};
    if(withBox)common.checkedPdfValue=true;
    const fs=push(s,q,{id:si,type:"radio",label:"Sí",radioGroupLabel:q.label,required:q.oblig,width:"full",excludeFromJson:true,_box:withBox?b+"_si":"",
      ...common,radioGroupFields:[no],jsonValue:"true"});
    const fn=push(s,q,{id:no,type:"radio",label:"No",required:q.oblig,width:null,excludeFromJson:true,_box:withBox?b+"_no":"",
      ...common,radioGroupFields:[si],jsonValue:"false"});
    if(q.ruta)push(s,q,{id:uid("field_helper_"+helperBase(b)),type:"boolean",label:q.label+" (helper)",hidden:true,readOnly:true,jsonOutputPath:q.ruta,
      autoFillConcat:{sourceFieldIds:[si,no],separator:"",parts:[{kind:"text",value:"true",condition:{fieldId:si,op:"notEmpty"}}]},sharedValue:true},{tail:true});
    q._si=si;q._no=no;
  };

  /* repeaters: grupos de preguntas cuyo arreglo tiene casilleros numerados (cond_1_…, cond_2_…) */
  const repGroups={};
  for(const q of inQ){
    const nums=new Set(q.boxes.map(b=>(b.match(/_(\d+)_/)||[])[1]).filter(Boolean));
    const m=q.ruta.match(/^(.*\.([A-Za-z]+))\[0\]\.[A-Za-z]+$/);
    if(nums.size>1&&m){(repGroups[m[1]]=repGroups[m[1]]||{path:m[1],leaf:m[2],qs:[]}).qs.push(q);q._rep=repGroups[m[1]]}
  }

  for(const st of steps)for(const s of st.subs){
    const system=s.k==="sistema"||s.k==="poliza";
    for(const q of s.qs){
      const leaf=leafOf(q.ruta),opts=optsClean(q);
      /* sistema / póliza madre: ocultos, prellenados, solo lectura */
      if(system){
        const t=isSiNo(q)?"boolean":"text";
        push(s,q,base(q,{id:uid("field_"+baseFromRoute(q.ruta)),type:t,label:q.label,hidden:true,readOnly:true,sharedValue:true}));
        continue;
      }
      /* asesor: prellenado y bloqueado */
      if(s.k==="asesor"){
        const hid=/codigoTipoIdentificacion$/.test(leaf);
        const f=base(q,{id:uid("field_"+baseFromRoute(q.ruta)),type:q.tipo==="Número"?"number":"text",label:q.label,hidden:hid||undefined,readOnly:true,width:hid?null:W(q,q.tipo==="Número"?"number":"text")});
        const ml=maxLenOf(q);if(ml)f.maxLength=ml;
        if(hid)f.sharedValue=true;
        push(s,q,f);continue;
      }
      /* repeater */
      if(q._rep){
        const g=q._rep;
        if(!g.done){
          g.done=true;
          const ctrl=s.qs.slice(0,s.qs.indexOf(q)).reverse().find(x=>x._si);
          const sing=g.leaf.replace(/es$/,"").replace(/s$/,"");
          const maxN=Math.max(...g.qs.flatMap(x=>x.boxes.map(b=>+(b.match(/_(\d+)_/)||[])[1]||0)));
          const sub=[],slots=[];
          for(const x of g.qs){
            const sl=leafOf(x.ruta),xo=optsClean(x);
            let t=T[x.tipo]||(xo.length?"select":"text");
            const sf={id:sl,type:t,label:x.label,options:t==="select"?xo.map(({_box,...o})=>o):null,required:x.oblig,readOnly:false,defaultValue:null};
            if(t==="date")Object.assign(sf,CR_DATE);
            const h=helpOf(x);if(h)sf.helpText=h;
            sub.push(sf);
            for(const b of x.boxes){const n=+(b.match(/_(\d+)_/)||[])[1];if(n)slots.push({n,sub:sl,box:b,q:x})}
          }
          slots.sort((a,b)=>a.n-b.n||sub.findIndex(z=>z.id===a.sub)-sub.findIndex(z=>z.id===b.sub));
          const repId=uid("field_repeater_"+snake(g.leaf));
          const rep=push(s,null,{id:repId,type:"repeater",label:q.sub||g.leaf,required:false,width:"full",sharedValue:true,
            conditionalVisibility:ctrl?JSON.stringify({logic:"or",conditions:[{fieldId:ctrl._si,operator:"not_empty"}]}):null,
            repeaterConfig:{itemLabel:sing.charAt(0).toUpperCase()+sing.slice(1),itemLabelPlural:g.leaf.charAt(0).toUpperCase()+g.leaf.slice(1),
              addButtonLabel:"Agregar "+sing,minItems:1,maxItems:maxN,fields:sub,child:null,
              slotMappings:slots.map(z=>({itemIndex:z.n-1,subFieldId:z.sub,targetFieldId:"field_"+z.box})),
              slotPattern:null,jsonSlotPattern:g.path+"[{i}].{sub}",overflow:null,overflowThreshold:maxN}});
          rep._origen="Interno Signaframe";
          const ss=subOf(st.k,{id:s.id+"_casilleros",title:s.title+" · casilleros del PDF (oculto)",hidden:true});
          ss._after=s.id;
          for(const z of slots)push(ss,z.q,{id:uid("field_"+z.box),type:"text",label:`${z.q.label} ${z.n} (casillero PDF)`,hidden:true,readOnly:true,excludeFromJson:true,sharedValue:true,_box:z.box});
          R.repeaters.push({id:repId,items:maxN,slots:slots.length,pattern:g.path+"[{i}].{sub}"});
        }
        continue;
      }
      /* Sí / No */
      if(isSiNo(q)){
        const bs=q.boxes.filter(b=>/_(si|no)$/.test(b));
        if(bs.length===2)siNoRadios(s,q,boxBase(bs.map(b=>b.replace(/_(si|no)$/,""))),{withBox:true});
        else siNoRadios(s,q,leaf.replace(/^indicador/,"").replace(/^./,c=>c.toLowerCase()).replace(/([a-z0-9])([A-Z])/g,"$1_$2").toLowerCase()||slug(q.label),{withBox:false});
        continue;
      }
      /* número + unidad (combo) que se concatenan */
      if(opts.some(o=>/del combo:/i.test(o.label))&&/concaten/i.test(q.reglas)){
        const box=q.boxes[0]||"",k=box?helperBase(box):baseFromRoute(q.ruta).replace(/^asg_/,"");
        const ml=(q.opts.map(o=>o.label).join(" ").match(/(\d+)\s*caracteres/)||[])[1];
        const ph=phOf(q)||"Ej.: 15";
        const nId=uid("field_"+k+"_numero"),uId=uid("field_"+k+"_unidad");
        const nf=push(s,q,{id:nId,type:"number",label:q.label,required:q.oblig,width:"quarter",excludeFromJson:true});
        if(ml)nf.maxLength=+ml;nf.placeholder=ph;nf.sharedValue=true;
        push(s,q,{id:uId,type:"select",label:"Unidad",required:q.oblig,width:"quarter",excludeFromJson:true,
          options:opts.filter(o=>/del combo:/i.test(o.label)).map(o=>{const v=o.label.replace(/^.*del combo:\s*/i,"").trim();return{label:v,pdfValue:v,jsonValue:v}}),sharedValue:true});
        push(s,q,{id:uid(box?"field_"+box:"field_"+baseFromRoute(q.ruta)),type:"text",label:q.label+" (PDF/JSON concatenado)",hidden:true,readOnly:true,jsonOutputPath:q.ruta,
          autoFillConcat:{sourceFieldIds:[nId,uId],separator:" ",parts:[{kind:"field",fieldId:nId},{kind:"field",fieldId:uId,valueSource:"visible"}]},sharedValue:true,_box:box});
        q._ctrlIds=[nId,uId];
        continue;
      }
      /* lista con un casillero por opción → radios + helper */
      if(opts.length>1&&opts.every(o=>o._box)){
        const ids=opts.map(o=>uid("field_"+o._box));
        opts.forEach((o,i)=>push(s,q,{id:ids[i],type:"radio",label:o.label,radioGroupLabel:i?undefined:q.label,required:q.oblig,width:i?null:"full",excludeFromJson:true,_box:o._box,
          radioGroupFields:ids.filter((_,j)=>j!==i),optionsLayout:"horizontal",checkedPdfValue:true,sharedValue:true,jsonValue:o.jsonValue,pdfValue:"X"}));
        q._optRadios=Object.fromEntries(opts.map((o,i)=>[o.label,ids[i]]));
        push(s,q,{id:uid("field_helper_"+helperBase(boxBase(opts.map(o=>o._box)))),type:"text",label:q.label+" (helper)",hidden:true,readOnly:true,jsonOutputPath:q.ruta,
          autoFillConcat:{sourceFieldIds:ids,separator:"",parts:opts.map((o,i)=>({kind:"text",value:o.jsonValue,condition:{fieldId:ids[i],op:"notEmpty"}}))},sharedValue:true},{tail:true});
        continue;
      }
      /* tipo de identificación: select + casillas ocultas que pintan el PDF */
      if(leaf==="codigoTipoIdentificacion"&&(q.boxes.length>1||opts.some(o=>/c[ée]dula f[ií]sica/i.test(o.label)))){
        const sel=base(q,{id:uid("field_"+baseFromRoute(q.ruta)),type:"select",label:q.label,required:q.oblig,width:"half",
          options:TIPO_ID.map(([l,c])=>({label:l,pdfValue:l,jsonValue:c})),sharedValue:true});
        push(s,q,sel);
        for(const b of q.boxes){
          const t=TIPO_ID.find(x=>x[2].test(b));
          const f={id:uid("field_"+b),type:"checkbox",label:(t?t[0]:"Otro")+(t?" (casilla PDF)":" (casilla PDF, sin código INS)"),hidden:true,readOnly:true,excludeFromJson:true,_box:b};
          if(t){f.autoFillConcat={sourceFieldIds:[sel.id],separator:"",parts:[{kind:"text",value:true,condition:{fieldId:sel.id,op:"equals",values:t[0]}},{kind:"text",value:true,condition:{fieldId:sel.id,op:"equals",values:t[1]}}]};f.sharedValue=true}
          else R.warn.push(`${q.id}: el casillero ${b} no tiene código INS; queda sin pintar`);
          f.checkedPdfValue=true;
          push(s,q,f,{tail:true});
        }
        q._sel=sel.id;continue;
      }
      /* descripciones que salen del select hermano */
      const sib=leaf==="medioNotificacion"?"codigoMedioNotificacion":/^descripcion[A-Z]/.test(leaf)?"codigo"+leaf.replace(/^descripcion/,""):null;
      const sibQ=sib&&s.qs.concat(...st.subs.map(x=>x.qs)).find(x=>x.ruta===parentOf(q.ruta)+"."+sib);
      if(sibQ){q._descOf=sibQ;continue} // se arma al final, cuando ya existe el select
      /* catálogo geográfico */
      if(/^codigo(Provincia|Canton|Distrito)$/.test(leaf)&&CAT){
        const lvl=leaf.replace("codigo","").toLowerCase();
        const f=base(q,{id:uid("field_"+baseFromRoute(q.ruta)),type:"select",label:q.label,required:q.oblig,width:"third",sharedValue:true});
        f.options=(CAT[lvl==="canton"?"canton":lvl]||[]).map(([l,c,p])=>({label:l,pdfValue:l,jsonValue:c,parentValues:lvl==="provincia"?"":p}));
        push(s,q,f);q._geo=lvl;continue;
      }
      if(leaf==="codigoPais"){push(s,q,base(q,{id:uid("field_"+baseFromRoute(q.ruta)),type:"text",label:q.label+" (código)",hidden:true,readOnly:true,sharedValue:true}));continue}
      /* nombre completo concatenado */
      if(leaf==="nombreCompleto"&&/personas\[0\]\.nombreCompleto$/.test(q.ruta)){
        const f={id:uid(q.boxes[0]?"field_"+q.boxes[0]:"field_asg_nombre_completo"),type:"text",label:q.label,readOnly:true,width:"full",jsonOutputPath:q.ruta,_box:q.boxes[0]||"",sharedValue:true};
        q._nc=f;push(s,q,f);continue;
      }
      /* resto: un campo por pregunta */
      let t=T[q.tipo]||(opts.length?"select":"text");
      if(/opci[oó]n/i.test(q.tipo))t="select";
      if(q.boxes.length>1)R.warn.push(`${q.id} «${q.label}»: ${q.boxes.length} casilleros para un solo campo (${q.boxes.join(", ")})`);
      const box=q.boxes[0]||"";
      const f=base(q,{id:uid(box?"field_"+box:"field_"+baseFromRoute(q.ruta)),type:t,label:q.label,required:q.oblig,width:W(q,t),_box:box});
      if(/prellenado bloqueado/i.test(q.origen))f.readOnly=true;
      if(t==="select"){f.options=opts.map(({_box,...o})=>o);if(!f.options.length)R.warn.push(`${q.id} «${q.label}»: lista sin opciones en la ficha`)}
      if(t==="date"){if(leaf==="fechaCreacion")f.defaultValue="today";Object.assign(f,CR_DATE)}
      if(q.tipo==="Email")Object.assign(f,EMAIL);
      if(t!=="select"&&t!=="date"){const ml=maxLenOf(q);if(ml)f.maxLength=ml}
      const ph=phOf(q);if(ph)f.placeholder=ph;
      const h=helpOf(q);if(h)f.helpText=h;
      if(t==="checkbox"){f.width="full";f.sharedValue=true}
      if(prellen(q))f.sharedValue=true;
      push(s,q,f);
    }
  }

  /* ids de cada pregunta → para condiciones y helpers */
  const fieldsOfQ=q=>steps.flatMap(st=>st.subs.flatMap(s=>s.fields.concat(s.tail))).filter(f=>f._q===q);
  const mainField=q=>q._sel||fieldsOfQ(q).find(f=>!f.hidden)?.id||fieldsOfQ(q)[0]?.id;

  /* geo: padres y abuelos */
  const geo={};for(const q of inQ)if(q._geo)geo[q._geo]=mainField(q);
  for(const st of steps)for(const s of st.subs)for(const f of s.fields){
    if(f.id===geo.canton&&geo.provincia)f.parentFieldId=geo.provincia;
    if(f.id===geo.distrito&&geo.canton){f.parentFieldId=geo.canton;if(geo.provincia)f.grandParentFieldId=geo.provincia}
  }
  /* descripciones (valueSource visible) */
  for(const st of steps)for(const s of st.subs)for(const q of s.qs)if(q._descOf){
    const src=mainField(q._descOf);
    if(!src){R.warn.push(`${q.id}: no encuentro el campo de ${q._descOf.id} para armar la descripción`);continue}
    let id="field_"+baseFromRoute(q.ruta);if(usedIds.has(id))id+="_desc";
    push(s,q,{id:uid(id),type:"text",label:q.label+" (helper)",hidden:true,readOnly:true,jsonOutputPath:q.ruta,
      autoFillConcat:{sourceFieldIds:[src],separator:"",parts:[{kind:"field",fieldId:src,valueSource:"visible"}]},sharedValue:true},{tail:true});
  }
  /* nombre completo: se arma con las partes */
  for(const q of inQ)if(q._nc){
    const P={};for(const x of inQ)if(NAME_PARTS.includes(leafOf(x.ruta))&&/personas\[0\]\.[a-zA-Z]+$/.test(x.ruta))P[leafOf(x.ruta)]=mainField(x);
    const src=NAME_PARTS.map(k=>P[k]).filter(Boolean),ord=["primerNombre","segundoNombre","primerApellido","segundoApellido"].map(k=>P[k]).filter(Boolean);
    if(src.length)q._nc.autoFillConcat={sourceFieldIds:src,separator:" ",parts:ord.map(id=>({kind:"field",fieldId:id}))};
    else{q._nc.prefillKey=q.ruta;R.warn.push(`${q.id}: nombre completo sin partes en la ficha; queda prellenado`)}
  }

  /* 4 · lo que no puede faltar (Diccionario V10 + Signaframe) */
  noPuedeFaltar({steps,subOf,push,uid,R,legal,mainField,inQ,mainNames});

  /* 5 · condiciones (lectura de «Reglas / formato») */
  const cond=ids=>JSON.stringify({logic:"or",conditions:ids.map(id=>({fieldId:id,operator:"not_empty"}))});
  for(const st of steps)for(const s of st.subs){
    const all=s.qs.find(q=>/despliega todas/i.test(q.reglas)&&q._si);
    s.qs.forEach((q,i)=>{
      if(q._rep||q._descOf)return;
      const prev=s.qs.slice(0,i).reverse();
      const reg=q.reglas;let ids=null,m;
      if((m=reg.match(/visualiza si indic[oó] que no (\w+)/i))){
        const t=prev.find(x=>x._no&&new RegExp("\\b"+m[1],"i").test(x.label));if(t)ids=[t._no];
      }else if((m=reg.match(/dej[oó] de (\w+) o (\w+)/i))&&/visualiza/i.test(reg)){
        ids=prev.filter(x=>x._si&&(new RegExp("dej[oó] de "+m[1],"i").test(x.label)||new RegExp("dej[oó] de "+m[2],"i").test(x.label))).map(x=>x._si).reverse();
      }else if(/combo anterior/i.test(reg)){
        const t=prev.find(x=>x._optRadios);if(t)ids=Object.entries(t._optRadios).filter(([l])=>new RegExp("\\b"+l+"\\b","i").test(reg)).map(([,id])=>id);
      }else if(/(habilita|despliega|visualiza)[\s\S]*s[ií]\b/i.test(reg)&&!q._si||/^detalle/i.test(q.label)){
        const t=prev.find(x=>x._si);if(t)ids=[t._si];
      }
      if(!ids&&!q._si){ // preguntas que despliegan un bloque (fuma / vapea → cantidad y tiempo)
        const blk=[];for(const x of prev){if(x._si&&/despliega preguntas de/i.test(x.reglas))blk.unshift(x._si);else if(blk.length||x._si)break}
        if(blk.length)ids=blk;
      }
      if(!ids&&/datosNotificacion$/.test(q.ruta)){const t=s.qs.find(x=>/codigoMedioNotificacion$/.test(x.ruta));if(t)ids=[mainField(t)]}
      if(!ids&&all&&all!==q)ids=[all._si];
      if(!ids||!ids.length)return;
      for(const f of fieldsOfQ(q))if(!f.hidden)f.conditionalVisibility=cond(ids);
    });
  }

  /* subsecciones de casilleros ocultos: justo después de su subsección */
  for(const st of steps){
    const extra=st.subs.filter(s=>s._after);
    for(const e of extra){st.subs.splice(st.subs.indexOf(e),1);st.subs.splice(st.subs.findIndex(s=>s.id===e._after)+1,0,e)}
  }

  /* 6 · casilleros del main */
  const allF=steps.flatMap(st=>st.subs.flatMap(s=>s.fields.concat(s.tail)));
  const chk={total:0,ok:0,missing:[],extra:[]};
  if(mainNames){
    chk.total=mainNames.size;
    const got=new Set(allF.filter(f=>f._box).map(f=>f._box));
    for(const n of mainNames){if(got.has(n)&&allF.find(f=>f._box===n).id==="field_"+n.toLowerCase())chk.ok++;else chk.missing.push(n)}
    for(const n of got)if(!mainNames.has(n))chk.extra.push(n);
  }

  return{steps,fuera:R.fuera,R,chk,F,legal};
}

/* ═══════════════════ v3 · No puede faltar ═══════════════════ */
const DIC_ROUTE=d=>normR(String(d[4]||"").replace(/\[\]/g,"[0]"));
const DIC_SIS=DIC.filter(d=>/^encabezado\./.test(d[4])||/personas\[\]\.(codigoTipo|descripcionTipo)$/.test(d[4]));
const DIC_PM=DIC.filter(d=>/datosGenerales\.polizaMadre\./.test(d[4])&&+d[5]===1);
const DIC_ASE=DIC.filter(d=>/datosGenerales\.intermediario\./.test(d[4]));
const DIC_ACEPTA=DIC.find(d=>/indicadorAceptaTerminos$/.test(d[4]));
/* Firma: mismas claves que la matriz interna v1 de D0873 */
const FIRMA={id:"field_firma_asegurado",type:"signature",label:"Firma del Asegurado",hidden:true,excludeFromJson:true,prefillKey:"encabezado.correoElectronico",
  sharedValue:true,visibleInReview:true,signatureSignerNamePrefillKey:"encabezado.nombreCompletoCliente",
  signatureCcPrefillKey:"datosFormulario.datosGenerales.intermediario.correoElectronico",
  signatureCcNamesPrefillKey:"datosFormulario.datosGenerales.intermediario.nombre",signatureSendCopy:true};
const legalHtml=t=>{
  const ps=[];let cur="";
  for(const line of String(t).split(/\n/).map(x=>x.trim()).filter(Boolean)){cur+=(cur?" ":"")+line;if(/[.:]$/.test(line)){ps.push(cur);cur=""}}
  if(cur)ps.push(cur);
  return ps.map(p=>"<p>"+esc(p)+"</p>").join("");
};

function noPuedeFaltar({steps,subOf,push,uid,R,legal,mainField,inQ,mainNames}){
  const all=()=>steps.flatMap(st=>st.subs.flatMap(s=>s.fields.concat(s.tail)));
  const writes=()=>new Set(all().map(f=>f.jsonOutputPath).filter(Boolean));
  const SUB=k=>SUBS.find(s=>s.k===k);
  const add=(subK,f,d,why)=>{
    const sd=SUB(subK);const s=subOf(sd.step,sd);
    f._origen="Obligatorio por diccionario";if(d)f._dic={label:d[0],ruta:DIC_ROUTE(d),donde:d[2]+" › "+d[3]};
    const bx=f.id.replace(/^field_/,"");  // si el main trae ese casillero y nadie lo usa, es de este campo
    if(mainNames&&!f.hidden&&[...mainNames].some(n=>n.toLowerCase()===bx)&&!all().some(x=>x._box&&x._box.toLowerCase()===bx))f._box=[...mainNames].find(n=>n.toLowerCase()===bx);
    push(s,null,f,{tail:!!f.hidden&&!["sistema","poliza"].includes(subK)});
    R.added.push({id:f.id,que:f.label,por:why});
    return f;
  };
  const sysField=d=>{const r=DIC_ROUTE(d),l=leafOf(r);
    return{id:uid("field_"+baseFromRoute(r)),type:/^(conozca|indicador)/.test(l)?"boolean":"text",label:d[0],hidden:true,readOnly:true,jsonOutputPath:r,prefillKey:r,sharedValue:true}};

  /* encabezado (14) + codigoTipo / descripcionTipo */
  let w=writes();
  for(const d of DIC_SIS)if(!w.has(DIC_ROUTE(d)))add("sistema",sysField(d),d,"Datos del sistema: el JSON siempre lleva "+DIC_ROUTE(d));
  /* póliza madre, oculta */
  for(const d of DIC_PM)if(!w.has(DIC_ROUTE(d)))add("poliza",sysField(d),d,"Póliza Madre (oculta, se prellena)");
  for(const f of all())if(/datosGenerales\.polizaMadre\./.test(f.jsonOutputPath||"")){f.hidden=true;f.readOnly=true}
  /* asesor: prellenado y solo lectura */
  for(const d of DIC_ASE){
    const r=DIC_ROUTE(d);
    if(!w.has(r)){const hid=/codigoTipoIdentificacion$/.test(r);
      add("asesor",{id:uid("field_"+baseFromRoute(r)),type:/codigoIntermediario$/.test(r)?"number":"text",label:d[0],hidden:hid||undefined,readOnly:true,
        width:hid?null:(/nombre$|correo/i.test(r)?"half":"quarter"),jsonOutputPath:r,prefillKey:r,sharedValue:hid||undefined},d,"Asesor: prellenado y bloqueado")}
  }
  for(const f of all())if(/datosGenerales\.intermediario\./.test(f.jsonOutputPath||"")){
    if(!f.readOnly||!f.prefillKey)R.added.push({id:f.id,que:f.label,por:"Asesor: se marcó solo lectura y prellenado"});f.readOnly=true;f.prefillKey=f.jsonOutputPath}
  /* firma */
  if(!all().some(f=>f.type==="signature")){
    add("firmas",{...FIRMA,id:uid(FIRMA.id)},null,"Signaframe: el formulario se firma (paso Firmas, oculto)");
    R.warn.push("La firma no tiene posición en el PDF: el main no trae sourceMeta para la firma. Cargarla en Signaframe (sin rect no se genera la firma).");
  }
  /* declaraciones: texto legal + casilla de aceptación */
  const ds=subOf("dec",SUB("decl"));
  const txt=legal.map(x=>x.texto).find(t=>/hago constar|declaro|autorizo/i.test(t))||legal[0]?.texto;
  if(!ds.instructions){
    if(txt){ds.instructions=legalHtml(txt);R.added.push({id:ds.id,que:"Texto de Declaraciones y Autorización",por:"Texto legal de la Matriz del INS («Texto Informativo»)"})}
    else R.warn.push("Falta el texto legal de Declaraciones: subí la Matriz del INS o cargalo a mano en «Otras propiedades» de sub_declaraciones (instructions).");
  }
  w=writes();
  if(DIC_ACEPTA&&!w.has(DIC_ROUTE(DIC_ACEPTA)))
    add("decl",{id:uid("field_acepta_terminos"),type:"checkbox",label:"He leído y comprendo el texto anterior, declaro que la información es verídica y acepto las condiciones y autorizaciones descritas.",
      required:true,width:"full",jsonOutputPath:DIC_ROUTE(DIC_ACEPTA),sharedValue:true},DIC_ACEPTA,"Declaraciones: casilla de aceptación obligatoria");
  /* descripciones de cada select (descripcionX ← codigoX, valueSource visible) */
  w=writes();
  for(const f of all().filter(f=>f.type==="select"&&f.jsonOutputPath)){
    const r=f.jsonOutputPath,l=leafOf(r);
    const dl=l==="codigoMedioNotificacion"?"medioNotificacion":/^codigo[A-Z]/.test(l)?"descripcion"+l.replace(/^codigo/,""):null;
    if(!dl)continue;
    const dr=parentOf(r)+"."+dl;
    if(w.has(dr)||!DIC_BY_ROUTE[dr])continue;
    const st=steps.find(st=>st.subs.some(s=>s.fields.includes(f)));const s=st.subs.find(s=>s.fields.includes(f));
    let id="field_"+baseFromRoute(dr);if(all().some(x=>x.id===id))id+="_desc";
    const h={id:uid(id),type:"text",label:DIC_BY_ROUTE[dr][0]+" (helper)",hidden:true,readOnly:true,jsonOutputPath:dr,
      autoFillConcat:{sourceFieldIds:[f.id],separator:"",parts:[{kind:"field",fieldId:f.id,valueSource:"visible"}]},sharedValue:true,
      _origen:"Obligatorio por diccionario",_dic:{label:DIC_BY_ROUTE[dr][0],ruta:dr,donde:DIC_BY_ROUTE[dr][2]+" › "+DIC_BY_ROUTE[dr][3]}};
    push(s,null,h,{tail:true});R.added.push({id:h.id,que:h.label,por:"Descripción del select "+f.id});
  }
  /* nombre completo concatenado */
  const parts=Object.fromEntries(NAME_PARTS.map(k=>[k,all().find(f=>f.jsonOutputPath==="datosFormulario.personas[0]."+k&&!f.hidden)]).filter(x=>x[1]));
  const ncR="datosFormulario.personas[0].nombreCompleto";
  if(Object.keys(parts).length&&!all().some(f=>f.jsonOutputPath===ncR)){
    const ord=["primerNombre","segundoNombre","primerApellido","segundoApellido"].filter(k=>parts[k]).map(k=>parts[k].id);
    add("persona",{id:uid("field_asg_nombre_completo"),type:"text",label:"Nombre completo",readOnly:true,width:"full",jsonOutputPath:ncR,sharedValue:true,
      autoFillConcat:{sourceFieldIds:NAME_PARTS.filter(k=>parts[k]).map(k=>parts[k].id),separator:" ",parts:ord.map(id=>({kind:"field",fieldId:id}))}},DIC_BY_ROUTE[ncR]||null,"Nombre completo: se arma con nombres y apellidos");
  }
  /* Sí/No → radios + helper booleano */
  for(const f of all().filter(f=>f.type==="radio"&&f.jsonValue==="true")){
    const has=all().some(h=>h.type==="boolean"&&(h.autoFillConcat?.sourceFieldIds||[]).includes(f.id));
    if(!has){const q=f._q;
      if(q&&q.ruta)R.warn.push(`${f.id}: grupo Sí/No sin helper booleano (${q.ruta})`);
      else if(!q)R.warn.push(`${f.id}: grupo Sí/No sin ruta JSON; no lleva helper`)}
  }
}

/* ═══════════════════ Excel (formato de matriz_io.py) ═══════════════════ */
const FICHA_COLS=["ID ficha","Pregunta (ficha)","Tipo de respuesta","Obligatoria (ficha)","Origen","Reglas / formato","Ruta JSON (ficha)","Notas"];
const SF_COLS=["Nivel","id","Tipo","Etiqueta","Pregunta del grupo","Oculto","Solo lectura","Obligatorio","Ancho","Casillero PDF","Ruta JSON","Prellenado desde","Excluir del JSON","Se muestra si","Se arma con","Opciones","Otras propiedades"];
const HDR=[...FICHA_COLS,...SF_COLS];
const KEYS={"id":"id","Tipo":"type","Etiqueta":"label","Pregunta del grupo":"radioGroupLabel","Oculto":"hidden","Solo lectura":"readOnly","Obligatorio":"required","Ancho":"width",
  "Ruta JSON":"jsonOutputPath","Prellenado desde":"prefillKey","Excluir del JSON":"excludeFromJson","Se muestra si":"conditionalVisibility","Se arma con":"autoFillConcat","Opciones":"options"};
const BOOLK=new Set(["hidden","readOnly","required","excludeFromJson"]);
const DERIVED=new Set(["sourceMeta","order","salidaJSON","prefillMode"]);
const ARGB=h=>"FF"+h;
const fill=h=>({type:"pattern",pattern:"solid",fgColor:{argb:ARGB(h)}});

function fichaVals(f){
  const q=f._q;
  if(!q&&f._dic)return{"Pregunta (ficha)":"      (no está en la ficha) "+f._dic.label,"Origen":f._origen,"Ruta JSON (ficha)":f._dic.ruta,"Notas":"Diccionario V10: "+f._dic.donde};
  if(!q)return{"Pregunta (ficha)":"      (campo interno)","Origen":f._origen||"Interno Signaframe"};
  return{"ID ficha":q.id,"Pregunta (ficha)":"      "+q.rawLabel,"Tipo de respuesta":q.tipo,"Obligatoria (ficha)":q.obligTxt,"Origen":f._origen||q.origen,
    "Reglas / formato":q.reglas,"Ruta JSON (ficha)":q.rutaFicha,"Notas":q.notas};
}
function sfVals(f,optRows){
  const v={"Nivel":"Campo","Casillero PDF":f._box||""};
  for(const [col,key] of Object.entries(KEYS)){
    let x=f[key];
    if(BOOLK.has(key))x=x?"Sí":"";
    else if(key==="options"){
      if(x&&x.length){x.forEach((o,i)=>{const{label,pdfValue,jsonValue,parentValues,...rest}=o;
        optRows.push([f.id,i+1,label,pdfValue,jsonValue,parentValues===""?"(vacío)":(parentValues??""),Object.keys(rest).length?JSON.stringify(rest):""])});
        x=`${x.length} opciones → hoja Opciones`}else x="";
    }else if(key==="autoFillConcat"||key==="conditionalVisibility")x=x?(typeof x==="string"?x:JSON.stringify(x)):"";
    v[col]=x==null?"":x;
  }
  const extra={};
  for(const [k,x] of Object.entries(f))if(!Object.values(KEYS).includes(k)&&!DERIVED.has(k)&&!k.startsWith("_")&&x!==undefined&&x!==null)extra[k]=x;
  v["Otras propiedades"]=Object.keys(extra).length?JSON.stringify(extra):"";
  return v;
}

async function exportXlsx(M){
  const wb=new ExcelJS.Workbook();
  const ws=wb.addWorksheet("Formulario Signaframe",{properties:{outlineProperties:{summaryBelow:false,summaryRight:false}},views:[{state:"frozen",xSplit:FICHA_COLS.length+2,ySplit:2}]});
  const NF=FICHA_COLS.length;
  ws.addRow(["FICHA DEL CLIENTE (solo lectura)",...Array(NF-1).fill(""),"SIGNAFRAME (fuente del form-def)",...Array(SF_COLS.length-1).fill("")]);
  ws.mergeCells(1,1,1,NF);ws.mergeCells(1,NF+1,1,HDR.length);
  ws.addRow(HDR);
  for(const r of [1,2])for(let c=1;c<=HDR.length;c++){const cell=ws.getCell(r,c);cell.fill=fill(c<=NF?"1F4E79":"1E6B45");cell.font={bold:true,color:{argb:"FFFFFFFF"}};cell.alignment={vertical:"middle",wrapText:true}}
  const optRows=[];
  const border={bottom:{style:"thin",color:{argb:"FFDDDDDD"}}};
  const row=(lvl,vals,fl,font)=>{
    const arr=HDR.map(h=>vals[h]??"");
    const r=ws.addRow(arr);
    if(lvl)r.outlineLevel=lvl;
    for(let c=1;c<=HDR.length;c++){const cell=r.getCell(c);cell.alignment={vertical:"top",wrapText:false};cell.border=border;if(fl)cell.fill=fill(fl);if(font)cell.font=font}
    return r;
  };
  let n=0;const counts={paso:0,sub:0,campo:0,fuera:0,hidden:0};
  for(const st of M.steps){
    if(!st.subs.some(s=>s.fields.length||s.tail.length||s.instructions)&&!st.always)continue;
    n++;counts.paso++;
    row(0,{"Pregunta (ficha)":`PASO ${n} · ${st.title}`,"Nivel":"Paso","id":st.id,"Etiqueta":st.title,"Oculto":st.hidden?"Sí":""},"2F3B52",{bold:true,color:{argb:"FFFFFFFF"}});
    for(const s of st.subs){
      const fs=s.fields.concat(s.tail);
      if(!fs.length&&!s.instructions)continue;
      counts.sub++;
      const extra={};if(s.instructions)extra.instructions=s.instructions;
      row(1,{"Pregunta (ficha)":"   "+s.title,"Nivel":"Subsección","id":s.id,"Etiqueta":s.title,"Oculto":s.hidden?"Sí":"","Se muestra si":s.cond||"",
        "Otras propiedades":Object.keys(extra).length?JSON.stringify(extra):""},"E8ECF4",{bold:true});
      for(const f of fs){counts.campo++;if(f.hidden)counts.hidden++;row(2,{...fichaVals(f),...sfVals(f,optRows)},f.hidden?"F2F2F2":null)}
    }
  }
  row(0,{"Pregunta (ficha)":"PREGUNTAS DE LA FICHA SIN CAMPO EN EL FORMULARIO","Nivel":"Fuera"},"7F1D1D",{bold:true,color:{argb:"FFFFFFFF"}});
  for(const q of M.fuera){counts.fuera++;
    const r=row(2,{"ID ficha":q.id,"Pregunta (ficha)":"      "+q.rawLabel,"Tipo de respuesta":q.tipo,"Obligatoria (ficha)":q.obligTxt,"Origen":q.origen,"Reglas / formato":q.reglas,
      "Ruta JSON (ficha)":q.rutaFicha,"Notas":(q.notas?q.notas+"\n":"")+"Motivo: "+q.fuera,"Nivel":"Fuera"},null);
    for(let c=1;c<=HDR.length;c++)r.getCell(c).font={color:{argb:"FFB4231D"}};
  }
  [8,46,16,10,16,30,40,30,11,34,9,30,30,7,7,7,10,30,48,40,7,34,34,30,40].forEach((w,i)=>ws.getColumn(i+1).width=w);
  ws.autoFilter={from:{row:2,column:1},to:{row:ws.rowCount,column:HDR.length}};
  const colOf=h=>HDR.indexOf(h)+1;
  /* una validación por columna, como rango entero (por celda ExcelJS las superpone) */
  const L=h=>ws.getColumn(colOf(h)).letter,last=ws.rowCount;
  const dv=(cols,list)=>{for(const h of cols)ws.dataValidations.model[`${L(h)}3:${L(h)}${last}`]={type:"list",allowBlank:true,formulae:[`"${list}"`]}};
  dv(["Oculto","Solo lectura","Obligatorio","Excluir del JSON"],"Sí");
  dv(["Ancho"],"full,three-quarters,two-thirds,half,third,quarter,fit");
  dv(["Tipo"],"text,textarea,number,date,select,radio,checkbox,boolean,button,signature,label,repeater");
  const wo=wb.addWorksheet("Opciones",{views:[{state:"frozen",xSplit:1,ySplit:1}]});
  wo.addRow(["id del campo","Orden","Etiqueta","Valor PDF","Valor JSON","Depende de (parentValues)","Otras propiedades"]);
  wo.getRow(1).eachCell(c=>{c.fill=fill("1E6B45");c.font={bold:true,color:{argb:"FFFFFFFF"}}});
  for(const r of optRows)wo.addRow(r);
  [38,7,40,30,16,14,20].forEach((w,i)=>wo.getColumn(i+1).width=w);
  wo.autoFilter={from:{row:1,column:1},to:{row:Math.max(1,wo.rowCount),column:7}};
  const wa=wb.addWorksheet("Agregados por diccionario");
  wa.addRow(["id","Qué","Por qué"]);
  wa.getRow(1).eachCell(c=>{c.fill=fill("1E6B45");c.font={bold:true,color:{argb:"FFFFFFFF"}}});
  for(const a of M.R.added)wa.addRow([a.id,a.que,a.por]);
  [34,50,70].forEach((w,i)=>wa.getColumn(i+1).width=w);
  for(const sh of M.F.sheets){
    const d=wb.addWorksheet(("Ficha · "+sh.name).slice(0,31));
    for(const r of sh.rows)d.addRow(r);
  }
  M.counts={...counts,opciones:optRows.length};
  return wb.xlsx.writeBuffer();
}


/**
 * Arma la matriz interna. Devuelve { M, buf } igual que miRun() del original.
 * opts: { ExcelJS, fichaBuf, main (objeto o null), insBuf (o null), cat (catalogo_cr.json o null) }
 */
export async function matrizInterna({ ExcelJS: X, fichaBuf, main = null, insBuf = null, cat = null }) {
  ExcelJS = X;
  const wb = new ExcelJS.Workbook(); await wb.xlsx.load(fichaBuf);
  const F = readFicha(wb);
  let legal = [];
  if (insBuf) { const w2 = new ExcelJS.Workbook(); await w2.xlsx.load(insBuf); legal = readInsLegal(w2); }
  const M = buildMatrix(F, { main, cat, legal });
  const buf = await exportXlsx(M);
  return { M, buf };
}
