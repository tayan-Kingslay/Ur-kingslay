const sb=supabase.createClient(UR_CONFIG.supabaseUrl,UR_CONFIG.supabaseKey);
const A={products:[],categories:[],user:null};
const $=id=>document.getElementById(id);
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[c]));
const money=v=>Number(v||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
function toast(t){const x=$("toast");x.textContent=t;x.classList.add("show");clearTimeout(window.__t);window.__t=setTimeout(()=>x.classList.remove("show"),2400)}
function errText(e){return e?.message||e?.error_description||"Ocorreu um erro."}
async function isAdmin(user){const {data,error}=await sb.from("admin_users").select("user_id").eq("user_id",user.id).maybeSingle();return !error&&!!data}
async function boot(){
 const {data:{session}}=await sb.auth.getSession();
 if(session?.user&&await isAdmin(session.user)){A.user=session.user;showApp();await loadAll()}else{showLogin()}
 sb.auth.onAuthStateChange(async(_event,session)=>{if(session?.user&&await isAdmin(session.user)){A.user=session.user;showApp();await loadAll()}else if(!session){showLogin()}})
}
function showLogin(){$("loginView").classList.remove("hidden");$("signupView").classList.add("hidden");$("appView").classList.add("hidden")}
function showSignup(){$("loginView").classList.add("hidden");$("signupView").classList.remove("hidden");$("appView").classList.add("hidden");$("signupError").textContent=""}
function showApp(){$("loginView").classList.add("hidden");$("signupView").classList.add("hidden");$("appView").classList.remove("hidden")}
$("showSignupBtn").onclick=showSignup;
$("backLoginBtn").onclick=showLogin;
$("signupForm").addEventListener("submit",async e=>{
 e.preventDefault();
 $("signupError").textContent="Criando administrador...";
 const email=$("signupEmail").value.trim();
 const password=$("signupPassword").value;
 const password2=$("signupPassword2").value;
 if(password!==password2){$("signupError").textContent="As senhas não conferem.";return}
 if(password.length<10){$("signupError").textContent="Use uma senha com pelo menos 10 caracteres.";return}
 $("signupBtn").disabled=true;
 try{
   const {data:boot,error:bootError}=await sb.functions.invoke("bootstrap-admin",{body:{email,password}});
   if(bootError)throw bootError;
   if(!boot?.ok)throw new Error(boot?.error||"Não foi possível criar o administrador.");
   const {data:login,error:loginError}=await sb.auth.signInWithPassword({email,password});
   if(loginError)throw loginError;
   if(!login?.user)throw new Error("Não foi possível iniciar a sessão do administrador.");
   $("signupError").textContent="";
   toast("Administrador criado com sucesso.");
   A.user=login.user;
   showApp();
   await loadAll();
 }catch(e){
   $("signupError").textContent=errText(e);
 }finally{
   $("signupBtn").disabled=false;
 }
});
$("loginForm").addEventListener("submit",async e=>{e.preventDefault();$("loginError").textContent="Entrando...";const {error}=await sb.auth.signInWithPassword({email:$("email").value.trim(),password:$("password").value});if(error){$("loginError").textContent=errText(error)}else{$("loginError").textContent=""}})
$("logoutBtn").onclick=async()=>{await sb.auth.signOut();showLogin()}
document.querySelectorAll(".tab").forEach(b=>b.onclick=()=>{document.querySelectorAll(".tab").forEach(x=>x.classList.remove("active"));b.classList.add("active");$("productsTab").classList.toggle("hidden",b.dataset.tab!=="products");$("categoriesTab").classList.toggle("hidden",b.dataset.tab!=="categories");$("siteTab").classList.toggle("hidden",b.dataset.tab!=="site");if(b.dataset.tab==="site")loadSiteContent()})
async function loadAll(){await Promise.all([loadProducts(),loadCategories()]);renderStats()}
async function loadProducts(){const {data,error}=await sb.from("products").select("*").order("created_at",{ascending:false});if(error){toast(errText(error));return}A.products=data||[];renderProducts()}
async function loadCategories(){const {data,error}=await sb.from("categories").select("*").order("sort_order");if(error){toast(errText(error));return}A.categories=data||[];renderCategories();fillCategorySelect();renderStats()}
function renderStats(){ $("statActive").textContent=A.products.filter(p=>p.active).length;$("statInactive").textContent=A.products.filter(p=>!p.active).length;$("statNoLink").textContent=A.products.filter(p=>p.active&&!p.buy_url).length;$("statCategories").textContent=A.categories.filter(c=>c.active).length}
function renderProducts(){
 const q=($("productSearch").value||"").toLowerCase().trim();const list=A.products.filter(p=>!q||[p.name,p.brand,p.category_id,p.description].some(v=>String(v||"").toLowerCase().includes(q)));
 $("productList").innerHTML=list.length?list.map(p=>'<article class="product-row"><img src="'+esc(p.image_url)+'" alt=""><div class="product-info"><h3>'+esc(p.name)+'</h3><p>'+esc(p.brand||"Sem marca")+' · '+money(p.price)+' · '+esc(p.category_id)+'</p><div class="badges"><span class="badge '+(p.active?"ok":"off")+'">'+(p.active?"Ativo":"Inativo")+'</span><span class="badge">'+(p.buy_url?"TikTok ✓":"Sem TikTok")+'</span>'+(p.featured?'<span class="badge">Destaque</span>':"")+(p.is_fashion?'<span class="badge">Moda</span>':"")+'</div></div><div class="row-actions"><button onclick="editProduct(\''+p.id+'\')">Editar</button><button onclick="toggleProduct(\''+p.id+'\')">'+(p.active?"Desativar":"Ativar")+'</button><button class="danger" onclick="deleteProduct(\''+p.id+'\')">Excluir</button></div></article>').join(""):'<div class="empty">Nenhum produto encontrado.</div>'
}
$("productSearch").addEventListener("input",renderProducts);
function fillCategorySelect(){ $("pCategory").innerHTML=A.categories.filter(c=>c.active||c.id==="all").map(c=>'<option value="'+esc(c.id)+'">'+esc(c.name)+'</option>').join("")}
function openModal(id){$(id).classList.remove("hidden")}function closeModal(id){$(id).classList.add("hidden")}
document.querySelectorAll("[data-close]").forEach(b=>b.onclick=()=>closeModal(b.dataset.close));
$("newProductBtn").onclick=()=>{resetProductForm();openModal("productModal")}
function resetProductForm(){ $("productForm").reset();$("productId").value="";$("pPix").value="à vista no Pix";$("pDiscount").value="0";$("pStyleWeight").value="1";$("pFashion").checked=true;$("pActive").checked=true;$("productMode").textContent="NOVO PRODUTO";$("productModalTitle").textContent="Cadastrar produto";$("saveProductBtn").textContent="Publicar produto";setPreview("")}
function setPreview(url){$("imagePreview").src=url||"";$("imagePreview").classList.toggle("visible",!!url);$("imagePlaceholder").style.display=url?"none":"block";$("pImageUrl").value=url||""}
$("pImageFile").addEventListener("change",()=>{const f=$("pImageFile").files[0];if(f)setPreview(URL.createObjectURL(f))})
function editProduct(id){const p=A.products.find(x=>x.id===id);if(!p)return;$("productId").value=p.id;$("pName").value=p.name;$("pBrand").value=p.brand||"";$("pCategory").value=p.category_id;$("pPrice").value=p.price;$("pOldPrice").value=p.old_price??"";$("pDiscount").value=p.discount||0;$("pPix").value=p.pix_label||"à vista no Pix";$("pBuyUrl").value=p.buy_url||"";$("pDescription").value=p.description||"";$("pStyleType").value=p.style_type||"";$("pStyleColor").value=p.style_color||"";$("pStyleGender").value=p.style_gender||"";$("pStyleFit").value=p.style_fit||"";$("pStyleMaterial").value=p.style_material||"";$("pStyleWeight").value=p.style_weight||1;$("pAccessoryType").value=p.style_accessory_type||"";$("pStyleTags").value=(p.style_tags||[]).join(", ");$("pFashion").checked=!!p.is_fashion;$("pFeatured").checked=!!p.featured;$("pActive").checked=!!p.active;$("productMode").textContent="EDITAR PRODUTO";$("productModalTitle").textContent=p.name;$("saveProductBtn").textContent="Salvar alterações";setPreview(p.image_url);openModal("productModal")}
async function uploadImage(file){const ext=(file.name.split(".").pop()||"jpg").toLowerCase();const path=A.user.id+"/"+crypto.randomUUID()+"."+ext;const {error}=await sb.storage.from("product-images").upload(path,file,{upsert:false,contentType:file.type,cacheControl:"31536000"});if(error)throw error;return sb.storage.from("product-images").getPublicUrl(path).data.publicUrl}
$("productForm").addEventListener("submit",async e=>{e.preventDefault();$("productFormError").textContent="";const id=$("productId").value;const file=$("pImageFile").files[0];try{$("saveProductBtn").disabled=true;$("saveProductBtn").textContent="Salvando...";
 let imageUrl=$("pImageUrl").value.trim();if(file){if(!["image/jpeg","image/png","image/webp"].includes(file.type))throw new Error("Use JPG, PNG ou WebP.");if(file.size>8*1024*1024)throw new Error("A imagem deve ter no máximo 8 MB.");imageUrl=await uploadImage(file)}
 if(!imageUrl)throw new Error("Escolha uma imagem ou informe uma URL.");
 const tags=$("pStyleTags").value.split(",").map(x=>x.trim()).filter(Boolean);
 const payload={name:$("pName").value.trim(),slug:slugify($("pName").value),brand:$("pBrand").value.trim()||null,category_id:$("pCategory").value,description:$("pDescription").value.trim(),price:Number($("pPrice").value),old_price:$("pOldPrice").value?Number($("pOldPrice").value):null,discount:Number($("pDiscount").value||0),pix_label:$("pPix").value.trim()||"à vista no Pix",image_url:imageUrl,buy_url:$("pBuyUrl").value.trim(),is_fashion:$("pFashion").checked,featured:$("pFeatured").checked,active:$("pActive").checked,style_type:$("pStyleType").value.trim()||null,style_color:$("pStyleColor").value.trim()||null,style_tags:tags,style_weight:Number($("pStyleWeight").value||1),style_accessory_type:$("pAccessoryType").value.trim()||null,style_gender:$("pStyleGender").value.trim()||null,style_fit:$("pStyleFit").value.trim()||null,style_material:$("pStyleMaterial").value.trim()||null,updated_at:new Date().toISOString()};
 let result;if(id)result=await sb.from("products").update(payload).eq("id",id);else result=await sb.from("products").insert(payload);if(result.error)throw result.error;toast(id?"Produto atualizado":"Produto publicado");closeModal("productModal");await loadProducts();renderStats()
 }catch(e){$("productFormError").textContent=errText(e)}finally{$("saveProductBtn").disabled=false;$("saveProductBtn").textContent=id?"Salvar alterações":"Publicar produto"}})
function slugify(v){return v.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"")}
async function toggleProduct(id){const p=A.products.find(x=>x.id===id);if(!p)return;const {error}=await sb.from("products").update({active:!p.active,updated_at:new Date().toISOString()}).eq("id",id);if(error)toast(errText(error));else{toast(p.active?"Produto desativado":"Produto ativado");await loadProducts();renderStats()}}
async function deleteProduct(id){const p=A.products.find(x=>x.id===id);if(!p||!confirm("Excluir definitivamente “"+p.name+"”? Isso pode quebrar referências do AI Stylist."))return;const {error}=await sb.from("products").delete().eq("id",id);if(error)toast(errText(error));else{toast("Produto excluído");await loadProducts();renderStats()}}
function renderCategories(){$("categoryList").innerHTML=A.categories.map(c=>'<div class="category-row"><div><b>'+esc(c.name)+'</b><span class="badge '+(c.active?"ok":"off")+'">'+(c.active?"Ativa":"Inativa")+'</span><small>'+esc(c.id)+' · ordem '+c.sort_order+'</small></div><button class="ghost-btn" onclick="editCategory(\''+esc(c.id)+'\')">Editar</button></div>').join("")}
$("newCategoryBtn").onclick=()=>{ $("cId").disabled=false;$("categoryForm").reset();$("categoryOriginalId").value="";$("cOrder").value="10";$("cActive").checked=true;$("categoryModalTitle").textContent="Nova categoria";openModal("categoryModal")}
function editCategory(id){const c=A.categories.find(x=>x.id===id);if(!c)return;$("cId").disabled=false;$("categoryOriginalId").value=c.id;$("cId").value=c.id;$("cName").value=c.name;$("cOrder").value=c.sort_order;$("cActive").checked=!!c.active;$("cId").disabled=c.id==="all";$("categoryModalTitle").textContent="Editar categoria";openModal("categoryModal")}
$("categoryForm").addEventListener("submit",async e=>{e.preventDefault();$("categoryFormError").textContent="";try{const oldId=$("categoryOriginalId").value;const payload={id:$("cId").value.trim(),name:$("cName").value.trim(),sort_order:Number($("cOrder").value||10),active:$("cActive").checked};let result;if(oldId){if(oldId!==payload.id){throw new Error("Por segurança, não altere o ID de uma categoria existente.")}result=await sb.from("categories").update({name:payload.name,sort_order:payload.sort_order,active:payload.active}).eq("id",oldId)}else result=await sb.from("categories").insert(payload);if(result.error)throw result.error;toast("Categoria salva");closeModal("categoryModal");await loadCategories()}catch(e){$("categoryFormError").textContent=errText(e)}})
window.editProduct=editProduct;window.toggleProduct=toggleProduct;window.deleteProduct=deleteProduct;window.editCategory=editCategory;
boot();

const SITE_DEFAULTS={id:"home",hero_title:"Seu estilo.<br><em>Seu momento.</em>",hero_subtitle:"Encontre produtos, salve seus favoritos e descubra combinações para cada ocasião.",hero_button_text:"Explorar agora",hero_button_url:"#produtos",hero_image_url:"https://images.unsplash.com/photo-1496747611176-843222e1e57c?auto=format&fit=crop&w=1400&q=85",hero_mobile_image_url:null,logo_text:"UR Kingslay",logo_image_url:null,logo_mobile_image_url:null,primary_color:"#11110f",accent_color:"#b99a67",background_color:"#f7f2e8",hero_active:true};
let SITE={...SITE_DEFAULTS};
async function loadSiteContent(){const {data,error}=await sb.from("site_content").select("*").eq("id","home").maybeSingle();if(error){$("siteFormError").textContent=errText(error);return}SITE={...SITE_DEFAULTS,...(data||{})};fillSiteForm()}
function fillSiteForm(){$("siteLogoText").value=SITE.logo_text||"";$("siteLogoUrl").value=SITE.logo_image_url||"";$("siteHeroTitle").value=SITE.hero_title||"";$("siteHeroSubtitle").value=SITE.hero_subtitle||"";$("siteHeroButtonText").value=SITE.hero_button_text||"";$("siteHeroButtonUrl").value=SITE.hero_button_url||"#produtos";$("siteHeroImageUrl").value=SITE.hero_image_url||"";$("sitePrimaryColor").value=SITE.primary_color||"#11110f";$("siteAccentColor").value=SITE.accent_color||"#b99a67";$("siteBackgroundColor").value=SITE.background_color||"#f7f2e8";$("siteHeroActive").checked=SITE.hero_active!==false;setSitePreview(SITE.hero_image_url,SITE.logo_image_url,SITE.logo_text)}
function setSitePreview(hero,logo,text){$("siteHeroPreview").src=hero||"";$("siteLogoPreview").src=logo||"";$("siteLogoPreview").classList.toggle("visible",!!logo);$("siteLogoPlaceholder").style.display=logo?"none":"block";$("siteHeroPreview").classList.toggle("visible",!!hero)}
async function uploadSiteImage(file,kind){const ext=(file.name.split(".").pop()||"jpg").toLowerCase();const path=A.user.id+"/site-"+kind+"-"+crypto.randomUUID()+"."+ext;const {error}=await sb.storage.from("site-media").upload(path,file,{upsert:false,contentType:file.type,cacheControl:"31536000"});if(error)throw error;return sb.storage.from("site-media").getPublicUrl(path).data.publicUrl}
$("siteHeroImageFile").addEventListener("change",()=>{const f=$("siteHeroImageFile").files[0];if(f)$("siteHeroPreview").src=URL.createObjectURL(f),$("siteHeroPreview").classList.add("visible")});
$("siteLogoFile").addEventListener("change",()=>{const f=$("siteLogoFile").files[0];if(f)$("siteLogoPreview").src=URL.createObjectURL(f),$("siteLogoPreview").classList.add("visible"),$("siteLogoPlaceholder").style.display="none"});
$("siteForm").addEventListener("submit",async e=>{e.preventDefault();$("siteFormError").textContent="";try{$("saveSiteBtn").disabled=true;$("saveSiteBtn").textContent="Salvando...";let hero=$("siteHeroImageUrl").value.trim()||SITE_DEFAULTS.hero_image_url;let logo=$("siteLogoUrl").value.trim()||null;const hf=$("siteHeroImageFile").files[0],lf=$("siteLogoFile").files[0],mf=$("siteHeroMobileImageFile").files[0];if(hf){if(hf.size>8*1024*1024)throw new Error("A imagem do banner deve ter no máximo 8 MB.");hero=await uploadSiteImage(hf,"hero")}if(lf){if(lf.size>8*1024*1024)throw new Error("A logo deve ter no máximo 8 MB.");logo=await uploadSiteImage(lf,"logo")}let mobile=SITE.hero_mobile_image_url;if(mf){if(mf.size>8*1024*1024)throw new Error("A imagem mobile deve ter no máximo 8 MB.");mobile=await uploadSiteImage(mf,"hero-mobile")}const payload={id:"home",logo_text:$("siteLogoText").value.trim()||"UR Kingslay",logo_image_url:logo,hero_title:$("siteHeroTitle").value.trim()||SITE_DEFAULTS.hero_title,hero_subtitle:$("siteHeroSubtitle").value.trim()||SITE_DEFAULTS.hero_subtitle,hero_button_text:$("siteHeroButtonText").value.trim()||SITE_DEFAULTS.hero_button_text,hero_button_url:$("siteHeroButtonUrl").value.trim()||"#produtos",hero_image_url:hero,hero_mobile_image_url:mobile,primary_color:$("sitePrimaryColor").value,accent_color:$("siteAccentColor").value,background_color:$("siteBackgroundColor").value,hero_active:$("siteHeroActive").checked,updated_at:new Date().toISOString()};const {error}=await sb.from("site_content").upsert(payload);if(error)throw error;SITE={...SITE,...payload};toast("Personalização salva");setSitePreview(hero,logo,payload.logo_text)}catch(e){$("siteFormError").textContent=errText(e)}finally{$("saveSiteBtn").disabled=false;$('saveSiteBtn').textContent="Salvar alterações"}});
$("resetSiteBtn").onclick=()=>{SITE={...SITE_DEFAULTS};fillSiteForm();toast("Prévia restaurada. Salve para aplicar.")};
