const sb=supabase.createClient(UR_CONFIG.supabaseUrl,UR_CONFIG.supabaseKey);
const state={
  products:[],categories:[],occasions:[],recommendations:[],
  category:"all",search:"",
  cart:JSON.parse(localStorage.getItem("ur-kingslay-cart")||"[]"),
  favorites:JSON.parse(localStorage.getItem("ur-kingslay-favorites")||"[]"),
  loading:true
};
const money=v=>Number(v||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});

async function boot(){
  try{
    const [p,c,o,r]=await Promise.all([
      sb.from("products").select("*").eq("active",true).order("featured",{ascending:false}).order("created_at",{ascending:false}),
      sb.from("categories").select("*").eq("active",true).order("sort_order"),
      sb.from("style_occasions").select("*").eq("active",true).order("sort_order"),
      sb.from("style_recommendations").select("*").order("priority")
    ]);
    if(p.error) throw p.error;
    state.products=p.data||[];
    state.categories=c.data||[];
    state.occasions=o.data||[];
    if(r.error) throw r.error;
    state.recommendations=r.data||[];
    renderCategories();
    renderProducts();
    renderCart();
    renderFavorites();
  }catch(e){
    console.error(e);
    document.getElementById("productGrid").innerHTML='<div class="empty">Não foi possível carregar o catálogo agora.<br><button onclick="location.reload()">Tentar novamente</button></div>';
    showToast("Não foi possível carregar os produtos");
  }finally{state.loading=false}
}

function renderCategories(){
  const nav=document.getElementById("categoryNav");
  const chips=document.getElementById("categoryChips");
  const visible=state.categories.filter(c=>c.id!=="all");
  const labels=[{id:"all",name:"Todos"},...visible];
  chips.innerHTML=labels.map(c=>'<button class="chip '+(state.category===c.id?"active":"")+'" onclick="filterCategory(\''+c.id+'\')">'+c.name+'</button>').join("");
  nav.querySelectorAll("[data-category]").forEach(b=>b.classList.toggle("active",b.dataset.category===state.category));
}

function filtered(){
  let list=state.products.filter(p=>(state.category==="all"||p.category_id===state.category)&&(!state.search||p.name.toLowerCase().includes(state.search.toLowerCase())||p.description.toLowerCase().includes(state.search.toLowerCase())));
  const sort=document.getElementById("sort").value;
  if(sort==="low")list.sort((a,b)=>Number(a.price)-Number(b.price));
  if(sort==="high")list.sort((a,b)=>Number(b.price)-Number(a.price));
  return list;
}

function renderProducts(){
  const g=document.getElementById("productGrid"),list=filtered();
  g.innerHTML=list.length?list.map(productCard).join(""):'<div class="empty">Nenhum produto encontrado.<br><button onclick="clearFilters()">Limpar filtros</button></div>';
}

function productCard(p){
  return '<article class="product" onclick="openProduct(\''+p.id+'\')">'+
    (p.discount?'<span class="tag">'+p.discount+'% OFF</span>':'')+
    '<img src="'+p.image_url+'" alt="'+escapeHtml(p.name)+'" loading="lazy">'+
    '<div class="stars">★★★★★ <small>4.8</small></div>'+
    '<h3>'+escapeHtml(p.name)+'</h3>'+
    (p.old_price?'<div class="old">'+money(p.old_price)+'</div>':'')+
    '<div class="price">'+money(p.price)+'</div><div class="pix">'+escapeHtml(p.pix_label)+'</div>'+
    '<div class="product-hint">Toque para ver opções →</div></article>';
}

function filterCategory(c){
  state.category=c;state.search="";
  document.getElementById("searchInput").value="";
  const cat=state.categories.find(x=>x.id===c);
  document.getElementById("sectionTitle").textContent=c==="all"?"Em destaque":(cat?.name||"Produtos");
  renderCategories();renderProducts();toggleMenu(false);
  document.getElementById("produtos").scrollIntoView({behavior:"smooth"});
}
function filterSale(){
  state.category="all";state.search="";
  document.getElementById("searchInput").value="";
  document.getElementById("sectionTitle").textContent="Ofertas";
  const g=document.getElementById("productGrid");
  const list=state.products.filter(p=>p.discount>0);
  g.innerHTML=list.length?list.map(productCard).join(""):'<div class="empty">Nenhuma oferta disponível.</div>';
  renderCategories();toggleMenu(false);
  document.getElementById("produtos").scrollIntoView({behavior:"smooth"});
}
function searchProducts(){
  state.search=document.getElementById("searchInput").value.trim();state.category="all";
  document.getElementById("sectionTitle").textContent=state.search?'Resultados para "'+escapeHtml(state.search)+'"':"Em destaque";
  renderCategories();renderProducts();
  document.getElementById("produtos").scrollIntoView({behavior:"smooth"});
}
function focusSearch(){document.querySelector(".desktop-search").scrollIntoView({behavior:"smooth"});setTimeout(()=>document.getElementById("searchInput").focus(),200)}
document.getElementById("searchInput").addEventListener("keydown",e=>{if(e.key==="Enter")searchProducts()});

function addCart(id){
  const item=state.cart.find(x=>x.id===id);
  if(item)item.qty++;else state.cart.push({id,qty:1});
  saveCart();showToast("Produto adicionado ao carrinho");
}
function saveCart(){localStorage.setItem("ur-kingslay-cart",JSON.stringify(state.cart));renderCart()}
function renderCart(){
  const el=document.getElementById("cartItems"),items=state.cart.map(x=>({x,p:state.products.find(p=>p.id===x.id)})).filter(v=>v.p);
  const count=items.reduce((n,v)=>n+v.x.qty,0),total=items.reduce((n,v)=>n+Number(v.p.price)*v.x.qty,0);
  document.getElementById("cartCount").textContent=count;document.getElementById("cartTotal").textContent=money(total);
  el.innerHTML=items.length?items.map(v=>'<div class="cart-row"><img src="'+v.p.image_url+'"><div><h4>'+escapeHtml(v.p.name)+'</h4><div>'+money(v.p.price)+'</div><div class="qty">Qtd: '+v.x.qty+' · <button onclick="removeCart(\''+v.p.id+'\')">remover</button></div></div><b>'+money(Number(v.p.price)*v.x.qty)+'</b></div>').join(""):'<div class="empty">Seu carrinho está vazio.</div>';
}
function removeCart(id){state.cart=state.cart.filter(x=>x.id!==id);saveCart()}
function toggleCart(force){
  const panel=document.getElementById("cart"),open=force===true||(!panel.classList.contains("open")&&force!==false);
  closeFavorites();panel.classList.toggle("open",open);document.getElementById("overlay").classList.toggle("open",open);
}
function checkout(){
  const first=state.cart.map(x=>state.products.find(p=>p.id===x.id)).find(Boolean);
  if(first?.buy_url)window.open(first.buy_url,"_blank","noopener,noreferrer");
  else showToast("A compra é finalizada pela TikTok Shop de cada produto");
}

function toggleFavorite(id){
  const i=state.favorites.indexOf(id);
  if(i>=0)state.favorites.splice(i,1);else state.favorites.push(id);
  localStorage.setItem("ur-kingslay-favorites",JSON.stringify(state.favorites));
  renderFavorites();renderHeaderCounts();
}
function renderHeaderCounts(){document.getElementById("favoriteCount").textContent=state.favorites.length}
function renderFavorites(){
  renderHeaderCounts();
  const items=state.favorites.map(id=>state.products.find(p=>p.id===id)).filter(Boolean);
  document.getElementById("favoriteItems").innerHTML=items.length?items.map(p=>'<div class="fav-row" onclick="openProduct(\''+p.id+'\')"><img src="'+p.image_url+'"><div><b>'+escapeHtml(p.name)+'</b><span>'+money(p.price)+'</span></div><button onclick="event.stopPropagation();toggleFavorite(\''+p.id+'\')">♥</button></div>').join(""):'<div class="empty">Você ainda não favoritou nenhum produto.</div>';
}
function openFavorites(){closeCart();document.getElementById("favorites").classList.add("open");document.getElementById("overlay").classList.add("open")}
function closeFavorites(){document.getElementById("favorites").classList.remove("open")}
function closeCart(){document.getElementById("cart").classList.remove("open")}
function closePanels(){closeCart();closeFavorites();document.getElementById("overlay").classList.remove("open")}

function toggleMenu(force){
  const n=document.getElementById("categoryNav"),b=document.getElementById("menuButton");
  if(force===false){n.classList.remove("menu-open");b.classList.remove("menu-active");b.textContent="☰";return}
  const open=n.classList.toggle("menu-open");b.classList.toggle("menu-active",open);b.textContent=open?"×":"☰";
}

async function openProduct(id){
  const p=state.products.find(x=>x.id===id);if(!p)return;
  const fav=state.favorites.includes(p.id);
  document.getElementById("modalContent").innerHTML=
  '<div class="modal-product"><img src="'+p.image_url+'" alt="'+escapeHtml(p.name)+'"><div>'+
  '<div class="eyebrow">UR KINGSLAY</div><h2>'+escapeHtml(p.name)+'</h2><div class="stars">★★★★★ 4.8</div>'+
  (p.old_price?'<div class="old">'+money(p.old_price)+'</div>':'')+'<div class="price">'+money(p.price)+'</div>'+
  '<p class="pix">'+escapeHtml(p.pix_label)+'</p><p class="description">'+escapeHtml(p.description)+'</p>'+
  '<div class="modal-actions"><button class="option-btn primary" onclick="addCart(\''+p.id+'\');closeModal()">🛒 Carrinho</button>'+
  '<button class="option-btn favorite '+(fav?"selected":"")+'" onclick="toggleFavorite(\''+p.id+'\');openProduct(\''+p.id+'\')">'+(fav?"♥":"♡")+' Favoritar</button>'+
  '<button class="option-btn buy-now" onclick="buyNow(\''+p.id+'\')">Comprar agora <span>→</span></button></div>'+
  combineHtml(p)+'</div></div>';
  document.getElementById("modal").classList.add("open");
}
function closeModal(e){if(!e||e.target.id==="modal")document.getElementById("modal").classList.remove("open")}

function buyNow(id){
  const p=state.products.find(x=>x.id===id);
  if(p?.buy_url)window.open(p.buy_url,"_blank","noopener,noreferrer");
  else showToast("O link da TikTok Shop deste produto ainda não foi cadastrado");
}

function combineHtml(p){
  if(!p.is_fashion)return "";
  return '<section class="combine-box"><div class="eyebrow">UR KINGSLAY · ESTILO</div><h3>✦ Combinar Estilo</h3><p>Escolha a ocasião e eu monto uma combinação usando o catálogo.</p><button class="combine-start" onclick="showStyleOccasions(\''+p.id+'\')">Combinar meu estilo ✦</button><div id="styleFlow"></div></section>';
}
function showStyleOccasions(id){
  const flow=document.getElementById("styleFlow");
  flow.innerHTML='<div class="occasion-grid">'+state.occasions.map(o=>'<button onclick="generateStyle(\''+id+'\',\''+o.id+'\')">'+o.icon+' '+escapeHtml(o.name)+'</button>').join("")+'</div>';
}
async function generateStyle(id,occasion){
  const p=state.products.find(x=>x.id===id),o=state.occasions.find(x=>x.id===occasion);
  if(!p||!o)return;
  const flow=document.getElementById("styleFlow");
  flow.innerHTML='<div class="ai-result loading-ai"><div class="ai-result-head"><span>✦ IA Stylist analisando</span><small>'+o.icon+' '+escapeHtml(o.name)+'</small></div><div class="ai-steps"><span>Cor</span><i>•</i><span>Silhueta</span><i>•</i><span>Peças</span><i>•</i><span>Acessórios</span></div><p class="ai-copy">Cruzando a peça principal com a ocasião, cores, proporções e os acessórios disponíveis.</p><div class="ai-loader"><i></i><i></i><i></i></div></div>';
  try{
    const {data,error}=await sb.functions.invoke("ai-stylist",{body:{product_id:id,occasion_id:occasion}});
    if(error)throw error;
    const recs=(data?.recommendations||[]).filter(r=>state.products.some(x=>x.id===r.id)).slice(0,5);
    if(!recs.length)throw new Error("A IA não encontrou combinações");
    const accessories=recs.filter(r=>r.role==="accessory");
    const garments=recs.filter(r=>r.role!=="accessory");
    const card=r=>'<div class="combine-item" onclick="openProduct(\''+r.id+'\')"><div class="combine-image-wrap"><img src="'+r.image_url+'" alt="'+escapeHtml(r.name)+'"><span>'+escapeHtml(r.role_label||"Complemento")+'</span></div><div><b>'+escapeHtml(r.name)+'</b><span>'+money(r.price)+'</span><small>'+escapeHtml(r.reason||"Escolhido pela IA")+'</small></div></div>';
    state.currentStyle={baseId:id,occasionId:occasion,recs};
    flow.innerHTML='<div class="ai-result ai-result-premium"><div class="ai-result-head"><span>✦ Look montado pela IA</span><small>'+o.icon+' '+escapeHtml(o.name)+'</small></div><div class="ai-summary"><b>'+escapeHtml(p.name)+'</b><span>Base do look</span></div>'+(
      garments.length?'<div class="style-section"><div class="style-section-title"><b>Look principal</b><span>'+garments.length+' peças</span></div><div class="combine-grid">'+garments.map(card).join("")+'</div></div>':''
    )+(
      accessories.length?'<div class="style-section accessories-section"><div class="style-section-title"><b>✦ Acessórios escolhidos</b><span>'+accessories.length+' itens</span></div><div class="combine-grid">'+accessories.map(card).join("")+'</div></div>':''
    )+'<div class="ai-note">A IA priorizou harmonia de cor, função da peça, silhueta e a ocasião escolhida.</div><div class="style-feedback"><b>O que você achou?</b><span>Essa combinação funciona para você?</span><div><button onclick="approveStyle()">✓ Combinou</button><button onclick="rejectStyle()">✕ Não combina</button><button onclick="redoStyle()">↻ Refazer tudo</button></div></div><button class="change-occasion" onclick="showStyleOccasions(\''+id+'\')">Escolher outra ocasião</button></div>';
  }catch(e){
    console.error(e);
    flow.innerHTML='<div class="ai-result"><div class="ai-result-head"><span>✦ Não consegui montar agora</span><small>'+o.icon+' '+escapeHtml(o.name)+'</small></div><p class="ai-copy">O catálogo ainda está em fase de teste. Quando houver peças compatíveis, a IA monta o look completo e escolhe os acessórios.</p><button class="change-occasion" onclick="showStyleOccasions(\''+id+'\')">Tentar outra ocasião</button></div>';
  }
}
function approveStyle(){
  if(!state.currentStyle.recs.length)return;
  renderLookPage(state.currentStyle.recs,state.currentStyle.occasionId,state.currentStyle.baseId);
  document.getElementById("modal").classList.remove("open");
  document.getElementById("lookPage").classList.add("open");
  document.getElementById("lookPage").setAttribute("aria-hidden","false");
  window.scrollTo({top:0,behavior:"smooth"});
}
function rejectStyle(){
  const flow=document.getElementById("styleFlow");
  flow.innerHTML='<div class="style-feedback rejected"><b>Beleza. Vamos ajustar.</b><span>Escolha outra ocasião para eu tentar uma combinação diferente.</span><div><button onclick="showStyleOccasions(\\''+state.currentStyle.baseId+'\\')">Escolher outra ocasião</button><button onclick="redoStyle()">↻ Refazer tudo</button></div></div>';
}
function redoStyle(){
  if(state.currentStyle.baseId&&state.currentStyle.occasionId) generateStyle(state.currentStyle.baseId,state.currentStyle.occasionId);
}
function renderLookPage(recs,occasionId,baseId){
  const o=state.occasions.find(x=>x.id===occasionId),base=state.products.find(x=>x.id===baseId);
  document.getElementById("lookOccasion").textContent=(o?.icon||"✦")+" "+(o?.name||"Look");
  const all=[...(base?[{id:base.id,name:base.name,price:base.price,image_url:base.image_url,role_label:"Peça principal"}]:[]),...recs];
  document.getElementById("lookProductGrid").innerHTML=all.map(p=>'<article class="look-product" onclick="buyNow(\\''+p.id+'\\')"><img src="'+p.image_url+'" alt="'+escapeHtml(p.name)+'"><div><span>'+escapeHtml(p.role_label||"Peça")+'</span><b>'+escapeHtml(p.name)+'</b><strong>'+money(p.price)+'</strong><button>Ver na TikTok Shop →</button></div></article>').join("");
}
function closeLookPage(){
  document.getElementById("lookPage").classList.remove("open");
  document.getElementById("lookPage").setAttribute("aria-hidden","true");
}

function clearFilters(){state.category="all";state.search="";document.getElementById("searchInput").value="";document.getElementById("sectionTitle").textContent="Em destaque";renderCategories();renderProducts()}
function goHome(){clearFilters();window.scrollTo({top:0,behavior:"smooth"})}
function showToast(t){const x=document.getElementById("toast");x.textContent=t;x.classList.add("show");clearTimeout(window.__toast);window.__toast=setTimeout(()=>x.classList.remove("show"),2400)}
function escapeHtml(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[c]))}

boot();