// --- Supabase Configuration ---
const SB_URL = "https://fbnukudaifwgymcwkxtp.supabase.co";
const SB_KEY = "sb_publishable_GF9pNYXBur0A642Elh5_uA_M_ImgGlf";
const supabase = window.supabase.createClient(SB_URL, SB_KEY);

// --- State & Data ---
let kosts = [];
let users = JSON.parse(localStorage.getItem('kost_users')) || [
    { username: 'Student', password: '12345', name: 'HELLO USER', role: 'mahasiswa' },
    { username: 'Owner', password: '54321', name: 'HELLO ADMIN', role: 'pemilik' }
];

let currentUser = JSON.parse(localStorage.getItem('kost_session')) || null;
let favorites = JSON.parse(localStorage.getItem('kost_favs')) || [];
let activeFilters = new Set(['all']);
let searchQuery = "";

// --- Data Synchronization ---
const fetchKosts = async () => {
    const { data, error } = await supabase.from('kosts').select('*').order('created_at', { ascending: false });
    if (error) {
        console.error("Error fetching kosts:", error);
        return;
    }
    kosts = data;
    renderKosts();
    renderAdminTable();
};

// --- Utilities ---
const formatPrice = (num) => `Rp ${parseInt(num).toLocaleString('id-ID')}`;
const initIcons = () => window.lucide && window.lucide.createIcons();

const showToast = (message, type = 'success') => {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<i data-lucide="${type === 'success' ? 'check-circle' : 'alert-circle'}"></i><span>${message}</span>`;
    container.appendChild(toast);
    initIcons();
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => toast.remove(), 400);
    }, 3000);
};

// --- Intelligent Scoring (Multi-Preference) ---
const calculateScoreDetail = (kost) => {
    let score = 8.5; 
    let insights = { price: true, distance: true, facilities: true };

    if (activeFilters.has('budget')) {
        if (kost.price > 1200000) { score -= 1.5; insights.price = false; }
        else { score += 0.5; }
    }
    if (activeFilters.has('near')) {
        if (kost.distance > 1.0) { score -= 1.5; insights.distance = false; }
        else { score += 0.8; }
    }
    if (activeFilters.has('wifi')) {
        if (!kost.facilities.includes('Wifi')) { score -= 2.0; insights.facilities = false; }
        else { score += 0.5; }
    }
    if (activeFilters.has('ac')) {
        if (!kost.facilities.includes('AC')) { score -= 2.0; insights.facilities = false; }
        else { score += 0.5; }
    }
    
    score += (Math.random() * 0.2) - 0.1;
    return { score: Math.min(Math.max(score, 1), 9.9).toFixed(1), insights };
};

// --- View Protection & Routing ---
const showApp = (user) => {
    document.getElementById('auth-container').style.display = 'none';
    document.getElementById('app').style.display = 'flex';
    document.getElementById('greeting-text').innerText = user.role === 'pemilik' ? "HELLO ADMIN 👋" : "HELLO USER 👋";
    
    // Select sidebar links
    const dashboardLink = document.querySelector('[data-view="dashboard"]')?.parentElement;
    const searchLink = document.querySelector('[data-view="search"]')?.parentElement;
    const favoritesLink = document.querySelector('[data-view="favorites"]')?.parentElement;
    const adminLink = document.querySelector('[data-view="admin"]')?.parentElement;

    if (user.role === 'pemilik') {
        if (dashboardLink) dashboardLink.style.display = 'none';
        if (searchLink) searchLink.style.display = 'none';
        if (favoritesLink) favoritesLink.style.display = 'none';
        if (adminLink) adminLink.style.display = 'block';
        switchView('admin');
    } else {
        if (dashboardLink) dashboardLink.style.display = 'block';
        if (searchLink) searchLink.style.display = 'block';
        if (favoritesLink) favoritesLink.style.display = 'block';
        if (adminLink) adminLink.style.display = 'none';
        switchView('dashboard');
    }
};

const switchView = (view) => {
    if (view === 'admin' && currentUser.role !== 'pemilik') {
        showToast('Unauthorized access!', 'error');
        return switchView('dashboard');
    }
    if (view === 'dashboard' && currentUser.role === 'pemilik') {
        return switchView('admin');
    }

    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(l => {
        l.classList.remove('active');
        if (l.dataset.view === view) l.classList.add('active');
    });

    const dashboardView = document.getElementById('dashboard-view');
    const adminView = document.getElementById('admin-view');

    if (view === 'admin') {
        if (dashboardView) dashboardView.style.display = 'none';
        if (adminView) adminView.style.display = 'block';
        renderAdminTable();
    } else {
        if (dashboardView) dashboardView.style.display = 'block';
        if (adminView) adminView.style.display = 'none';
        renderKosts(view === 'favorites' ? 'favorites' : 'dashboard');
    }
};

// --- Admin CRUD Logic ---
window.renderAdminTable = () => {
    const tbody = document.getElementById('admin-kost-list');
    if (!tbody) return;
    tbody.innerHTML = kosts.map(kost => `
        <tr>
            <td>${kost.name}</td>
            <td>${kost.location}</td>
            <td>${formatPrice(kost.price)}</td>
            <td><span class="status-badge">Aktif</span></td>
            <td>
                <div style="display:flex; gap:8px;">
                    <button class="action-icon edit" onclick="editKost(${kost.id})"><i data-lucide="edit-3"></i></button>
                    <button class="action-icon delete" onclick="deleteKost(${kost.id})"><i data-lucide="trash-2"></i></button>
                </div>
            </td>
        </tr>
    `).join('');
    initIcons();
};

window.editKost = (id) => {
    const kost = kosts.find(k => k.id === id);
    if (!kost) return;
    document.getElementById('modal-title').innerText = "Edit Kost Listing";
    document.getElementById('form-id').value = kost.id;
    document.getElementById('form-name').value = kost.name;
    document.getElementById('form-location').value = kost.location;
    document.getElementById('form-price').value = kost.price;
    document.getElementById('form-distance').value = kost.distance;
    document.getElementById('form-facilities').value = kost.facilities.join(', ');
    document.getElementById('form-desc').value = kost.description || "";
    const preview = document.getElementById('image-preview');
    if (preview) {
        preview.src = kost.image;
        document.getElementById('image-preview-container').style.display = 'block';
    }
    document.getElementById('modal-overlay').classList.add('active');
};

window.deleteKost = async (id) => {
    if (!confirm('Are you sure you want to delete this listing?')) return;
    const { error } = await supabase.from('kosts').delete().eq('id', id);
    if (error) {
        showToast('Error deleting kost', 'error');
        return;
    }
    showToast('Deleted successfully');
    fetchKosts();
};

// --- Rendering Kosts ---
const renderKosts = (view = 'dashboard') => {
    const grid = document.getElementById('kost-grid');
    if (!grid) return;

    // Scoring & Filtering
    let displayKosts = kosts.map(k => {
        const detail = calculateScoreDetail(k);
        return { ...k, matchScore: parseFloat(detail.score), insights: detail.insights };
    }).sort((a, b) => b.matchScore - a.matchScore);

    if (view === 'favorites') {
        displayKosts = displayKosts.filter(k => favorites.includes(k.id));
    }
    
    if (searchQuery) {
        const q = searchQuery.toLowerCase();
        displayKosts = displayKosts.filter(k => 
            k.name.toLowerCase().includes(q) || k.location.toLowerCase().includes(q)
        );
    }

    grid.innerHTML = displayKosts.map((kost, index) => {
        const isTop = index === 0 && !activeFilters.has('all') && view !== 'favorites';
        return `
            <div class="kost-card glass fade-in ${isTop ? 'top-pick' : ''}" onclick="openDetail(${kost.id})">
                <div class="match-score">
                    <span class="score">${kost.matchScore.toFixed(1)}</span>
                    <span class="label">MATCH</span>
                </div>
                <button class="fav-btn ${favorites.includes(kost.id) ? 'active' : ''}" 
                        onclick="event.stopPropagation(); toggleFavorite(${kost.id}, this)">
                    <i data-lucide="heart" style="width:18px; height:18px; fill: ${favorites.includes(kost.id) ? 'currentColor' : 'none'}"></i>
                </button>
                <img src="${kost.image}" alt="${kost.name}" class="kost-image">
                <div class="kost-info">
                    <h3>${kost.name}</h3>
                    <p style="color: var(--primary); font-weight: 700; margin: 8px 0;">${formatPrice(kost.price)}</p>
                    <p class="text-muted" style="font-size: 12px;"><i data-lucide="map-pin" style="width:12px;"></i> ${kost.location}</p>
                </div>
            </div>
        `;
    }).join('');
    initIcons();
};

window.toggleFavorite = (id, btn) => {
    if (favorites.includes(id)) {
        favorites = favorites.filter(fid => fid !== id);
        btn.classList.remove('active');
    } else {
        favorites.push(id);
        btn.classList.add('active');
    }
    localStorage.setItem('kost_favs', JSON.stringify(favorites));
    if (document.querySelector('.nav-link.active')?.dataset.view === 'favorites') renderKosts('favorites');
};

window.openDetail = (id) => {
    const kost = kosts.find(k => k.id === id);
    if (!kost) return;
    document.getElementById('detail-img').src = kost.image;
    document.getElementById('detail-name').innerText = kost.name;
    document.getElementById('detail-desc').innerText = kost.description || "No description provided.";
    document.getElementById('detail-price').innerText = formatPrice(kost.price);
    document.getElementById('detail-facilities').innerHTML = kost.facilities.map(f => `<span class="pill" style="padding: 6px 12px; font-size: 12px">${f}</span>`).join('');
    document.getElementById('detail-overlay').classList.add('active');
    initIcons();
};

const triggerSearch = () => {
    const grid = document.getElementById('kost-grid');
    if (!grid) return;
    grid.style.opacity = '0.5';
    setTimeout(() => {
        grid.style.opacity = '1';
        renderKosts();
    }, 400);
};

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    // Splash Screen
    setTimeout(() => {
        const splash = document.getElementById('splash-screen');
        if (splash) {
            splash.style.opacity = '0';
            setTimeout(() => splash.style.display = 'none', 1200);
        }
    }, 5500);

    if (currentUser) showApp(currentUser);
    fetchKosts();

    // Filter Pills
    document.querySelectorAll('#quick-filters .pill').forEach(pill => {
        pill.onclick = () => {
            const filter = pill.dataset.filter;
            if (filter === 'all') {
                activeFilters.clear(); activeFilters.add('all');
                document.querySelectorAll('#quick-filters .pill').forEach(p => p.classList.remove('active'));
                pill.classList.add('active');
            } else {
                activeFilters.delete('all');
                document.querySelector('[data-filter="all"]')?.classList.remove('active');
                if (activeFilters.has(filter)) { activeFilters.delete(filter); pill.classList.remove('active'); }
                else { activeFilters.add(filter); pill.classList.add('active'); }
                if (activeFilters.size === 0) { activeFilters.add('all'); document.querySelector('[data-filter="all"]')?.classList.add('active'); }
            }
            triggerSearch();
        };
    });

    // Search
    const searchInput = document.getElementById('global-search');
    const searchBtn = document.getElementById('search-trigger');
    if (searchInput) {
        searchInput.oninput = (e) => { searchQuery = e.target.value; renderKosts(); };
    }
    if (searchBtn) {
        searchBtn.onclick = () => renderKosts();
    }

    // Auth
    document.getElementById('login-form').onsubmit = (e) => {
        e.preventDefault();
        const user = users.find(u => u.username === document.getElementById('login-username').value && u.password === document.getElementById('login-password').value);
        if (user) {
            currentUser = user;
            localStorage.setItem('kost_session', JSON.stringify(user));
            showApp(user);
        } else {
            document.getElementById('login-error').style.display = 'block';
        }
    };

    document.getElementById('logout-btn').onclick = () => { localStorage.removeItem('kost_session'); window.location.reload(); };

    // Navigation
    document.querySelectorAll('.nav-link').forEach(link => {
        if (link.id === 'logout-btn') return;
        link.onclick = (e) => { e.preventDefault(); switchView(link.dataset.view); };
    });

    // Modal
    document.getElementById('close-modal').onclick = () => document.getElementById('modal-overlay').classList.remove('active');
    document.getElementById('close-detail').onclick = () => document.getElementById('detail-overlay').classList.remove('active');

    // Admin Form
    document.getElementById('kost-form').onsubmit = async (e) => {
        e.preventDefault();
        const id = document.getElementById('form-id').value;
        const newKost = {
            name: document.getElementById('form-name').value,
            location: document.getElementById('form-location').value,
            price: parseFloat(document.getElementById('form-price').value),
            distance: parseFloat(document.getElementById('form-distance').value),
            facilities: document.getElementById('form-facilities').value.split(',').map(f => f.trim()),
            description: document.getElementById('form-desc').value,
            image: document.getElementById('image-preview').src || "https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?auto=format&fit=crop&q=80&w=800",
            rating: 4.5
        };

        let result;
        if (id) {
            result = await supabase.from('kosts').update(newKost).eq('id', id);
        } else {
            result = await supabase.from('kosts').insert([newKost]);
        }

        if (result.error) {
            showToast('Error saving kost', 'error');
            console.error(result.error);
        } else {
            showToast('Saved successfully');
            document.getElementById('modal-overlay').classList.remove('active');
            fetchKosts();
        }
    };

    // Image Preview Handling
    const imageInput = document.getElementById('form-image-input');
    if (imageInput) {
        imageInput.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    const preview = document.getElementById('image-preview');
                    preview.src = event.target.result;
                    document.getElementById('image-preview-container').style.display = 'block';
                };
                reader.readAsDataURL(file);
            }
        };
    }
});

window.openModal = () => {
    document.getElementById('modal-title').innerText = "Add New Kost";
    document.getElementById('kost-form').reset();
    document.getElementById('form-id').value = "";
    document.getElementById('image-preview-container').style.display = 'none';
    document.getElementById('modal-overlay').classList.add('active');
};
