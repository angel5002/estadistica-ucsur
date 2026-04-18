/* ============================================================
   DATA LOADING
   Attempts fetch first (server mode); falls back to embedded
   data when opened as a local file (file://).
   ============================================================ */

async function loadJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function loadData() {
  try {
    const [students, semanas] = await Promise.all([
      loadJSON('data/students.json'),
      loadJSON('data/semanas.json'),
    ]);
    return { students, semanas };
  } catch {
    console.warn('Fetch falló — usando datos embebidos. Sirve el proyecto con un servidor para cargar JSON externos.');
    return { students: FALLBACK_STUDENTS, semanas: FALLBACK_SEMANAS };
  }
}

/* ============================================================
   APP STATE
   ============================================================ */
let studentsMap = {};
let semanasData = [];
let activeCharts = [];
let currentSemanaNumero = null;

/* ============================================================
   NAVIGATION
   ============================================================ */
function initNav(semanas) {
  const btn   = document.getElementById('semanas-btn');
  const panel = document.getElementById('dropdown-panel');
  const list  = document.getElementById('dropdown-list');

  semanas.forEach(s => {
    const li = document.createElement('li');
    li.textContent = `Sem. ${s.numero}`;
    li.dataset.numero = s.numero;
    li.addEventListener('click', () => {
      showSemana(s.numero);
      closeDropdown();
    });
    list.appendChild(li);
  });

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = panel.classList.contains('open');
    isOpen ? closeDropdown() : openDropdown();
  });

  document.addEventListener('click', closeDropdown);
  panel.addEventListener('click', e => e.stopPropagation());

  function openDropdown() {
    panel.classList.add('open');
    btn.classList.add('active');
    btn.setAttribute('aria-expanded', 'true');
    panel.setAttribute('aria-hidden', 'false');
  }

  function closeDropdown() {
    panel.classList.remove('open');
    btn.classList.remove('active');
    btn.setAttribute('aria-expanded', 'false');
    panel.setAttribute('aria-hidden', 'true');
  }

  // Hero "Ver semanas" button — stopPropagation evita que el click
  // burbujee al document y cierre el dropdown al instante de abrirlo
  document.getElementById('hero-semanas-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    openDropdown();
  });
}

/* ============================================================
   STUDENTS
   ============================================================ */
function renderStudents(students) {
  const container = document.getElementById('students-container');

  students.forEach((student, i) => {
    const isReverse = i % 2 !== 0;
    const card = document.createElement('div');
    card.className = `student-card ${isReverse ? 'reverse from-right' : 'from-left'}`;
    card.dataset.id = student.id;

    const photoSide = `
      <div class="student-photo-wrap">
        <div class="student-photo">
          <img src="${student.foto}" alt="Foto de ${student.nombre}" loading="lazy">
        </div>
      </div>`;

    const infoSide = `
      <div class="student-info">
        <span class="student-number">Integrante 0${i + 1}</span>
        <h3 class="student-name">${student.nombre}</h3>
        <p class="student-bio">${student.bio}</p>
      </div>`;

    card.innerHTML = isReverse
      ? infoSide + photoSide
      : photoSide + infoSide;

    container.appendChild(card);
  });

  initScrollAnimations();
}

function initScrollAnimations() {
  const cards = document.querySelectorAll('.student-card');
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15 });

  cards.forEach(card => observer.observe(card));
}

/* ============================================================
   SEMANA MODE — oculta hero+equipo, muestra solo la semana
   ============================================================ */
function enterSemanaMode() {
  document.getElementById('hero').classList.add('hidden');
  document.getElementById('equipo').classList.add('hidden');
  document.getElementById('semana-section').classList.remove('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function exitSemanaMode() {
  document.getElementById('semana-section').classList.add('hidden');
  document.getElementById('hero').classList.remove('hidden');
  document.getElementById('equipo').classList.remove('hidden');
  activeCharts.forEach(c => c.destroy());
  activeCharts = [];
  currentSemanaNumero = null;
  document.querySelectorAll('#dropdown-list li').forEach(li => li.classList.remove('active'));
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ============================================================
   WEEK CONTENT
   ============================================================ */
function showSemana(numero) {
  const semana = semanasData.find(s => s.numero === numero);
  if (!semana) return;

  activeCharts.forEach(c => c.destroy());
  activeCharts = [];
  currentSemanaNumero = numero;

  const section  = document.getElementById('semana-section');
  const header   = document.getElementById('semana-header');
  const cPosts   = document.getElementById('cuestionario-posts');
  const fPosts   = document.getElementById('ficha-posts');
  const blocks   = document.getElementById('content-blocks');
  const empty    = document.getElementById('semana-empty');

  // Mark active in dropdown
  document.querySelectorAll('#dropdown-list li').forEach(li => {
    li.classList.toggle('active', parseInt(li.dataset.numero) === numero);
  });

  // Header
  header.innerHTML = `
    <span class="overline">Universidad Científica del Sur — Estadística General</span>
    <h2>${semana.titulo}</h2>
    ${semana.descripcion ? `<p>${semana.descripcion}</p>` : ''}`;

  const hasCuestionario = semana.cuestionario && semana.cuestionario.length > 0;
  const hasFicha        = semana.ficha && semana.ficha.length > 0;
  const hasContent      = hasCuestionario || hasFicha;

  if (hasContent) {
    blocks.classList.remove('hidden');
    empty.classList.add('hidden');
    cPosts.innerHTML = '';
    fPosts.innerHTML = '';

    if (hasCuestionario) {
      document.getElementById('cuestionario-block').classList.remove('hidden');
      semana.cuestionario.forEach(item => {
        cPosts.appendChild(buildPost(item, 'Cuestionario'));
      });
    } else {
      document.getElementById('cuestionario-block').classList.add('hidden');
    }

    if (hasFicha) {
      document.getElementById('ficha-block').classList.remove('hidden');
      semana.ficha.forEach(item => {
        fPosts.appendChild(buildPost(item, 'Ficha'));
      });
    } else {
      document.getElementById('ficha-block').classList.add('hidden');
    }

    // Render charts after DOM is ready
    requestAnimationFrame(() => renderCharts());
  } else {
    blocks.classList.add('hidden');
    empty.classList.remove('hidden');
  }

  enterSemanaMode();
  updateNavButtons(numero);
}

function buildPost(item, tipo) {
  const student = studentsMap[item.estudianteId];
  const card = document.createElement('article');
  card.className = 'post-card';

  const authorName  = student ? student.nombre : 'Estudiante';
  const authorPhoto = student ? student.foto : '';
  const label       = `${tipo} — Ejercicio ${item.numero}`;

  let inner = `
    <div class="post-header">
      ${authorPhoto ? `<img class="post-avatar" src="${authorPhoto}" alt="${authorName}">` : ''}
      <div class="post-author-info">
        <div class="post-author-name">${authorName}</div>
        <div class="post-exercise-label">${label}</div>
      </div>
    </div>
    <div class="post-body">
      <div class="post-enunciado">${item.enunciado}</div>
      <div class="post-desarrollo">${item.desarrollo}</div>`;

  // Images
  if (item.imagenes && item.imagenes.length > 0) {
    inner += `<div class="post-images">`;
    item.imagenes.forEach(src => {
      inner += `<img class="post-image" src="${src}" alt="Resolución" loading="lazy" onerror="this.style.display='none'">`;
    });
    inner += `</div>`;
  }

  // Table
  if (item.tabla) {
    inner += buildTable(item.tabla);
  }

  // Chart placeholder (canvas rendered later)
  if (item.grafico) {
    const chartId = `chart-${tipo}-${item.estudianteId}-${item.numero}`;
    inner += `
      <div class="post-chart-wrap">
        <canvas id="${chartId}" data-chart='${JSON.stringify(item.grafico)}'></canvas>
      </div>`;
  }

  inner += `</div>`;
  card.innerHTML = inner;

  // Lightbox for post images
  card.querySelectorAll('.post-image').forEach(img => {
    img.addEventListener('click', () => openLightbox(img.src));
  });

  return card;
}

function buildTable(tabla) {
  const headers = tabla.encabezados.map(h => `<th>${h}</th>`).join('');
  const rows = tabla.filas.map(row =>
    `<tr>${row.map(cell => `<td>${cell}</td>`).join('')}</tr>`
  ).join('');

  return `
    <div class="post-table-wrap">
      <table class="post-table">
        <thead><tr>${headers}</tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

function renderCharts() {
  document.querySelectorAll('[data-chart]').forEach(canvas => {
    const config = JSON.parse(canvas.dataset.chart);

    const chart = new Chart(canvas, {
      type: config.tipo,
      data: {
        labels: config.labels,
        datasets: config.datasets.map(ds => ({
          ...ds,
          borderRadius: 4,
        })),
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          title: {
            display: !!config.titulo,
            text: config.titulo,
            color: '#b0aea5',
            font: { family: 'Georgia, serif', size: 13, weight: '500' },
            padding: { bottom: 16 },
          },
          legend: {
            labels: {
              color: '#87867f',
              font: { family: 'system-ui, Arial, sans-serif', size: 12 },
              boxWidth: 12,
              boxHeight: 12,
            },
          },
        },
        scales: config.tipo !== 'pie' && config.tipo !== 'doughnut' ? {
          x: {
            ticks: { color: '#87867f', font: { size: 12 } },
            grid:  { color: 'rgba(255,255,255,0.05)' },
          },
          y: {
            ticks: { color: '#87867f', font: { size: 12 } },
            grid:  { color: 'rgba(255,255,255,0.05)' },
          },
        } : {},
      },
    });

    activeCharts.push(chart);
  });
}

/* ============================================================
   LIGHTBOX
   ============================================================ */
function openLightbox(src) {
  const overlay = document.createElement('div');
  overlay.className = 'lightbox-overlay';

  const img = document.createElement('img');
  img.src = src;
  img.alt = 'Imagen ampliada';
  overlay.appendChild(img);

  overlay.addEventListener('click', () => {
    overlay.classList.remove('open');
    setTimeout(() => overlay.remove(), 250);
  });

  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('open'));
}

/* ============================================================
   NAV BUTTONS (prev / home / next)
   ============================================================ */
function updateNavButtons(numero) {
  const total   = semanasData.length;
  const btnPrev = document.getElementById('btn-prev');
  const btnNext = document.getElementById('btn-next');

  if (numero <= 1) {
    btnPrev.classList.add('hidden');
  } else {
    btnPrev.classList.remove('hidden');
    btnPrev.textContent = `← Semana ${numero - 1}`;
  }

  if (numero >= total) {
    btnNext.classList.add('hidden');
  } else {
    btnNext.classList.remove('hidden');
    btnNext.textContent = `Semana ${numero + 1} →`;
  }
}

function initNavButtons() {
  document.getElementById('btn-home').addEventListener('click', exitSemanaMode);

  document.getElementById('btn-prev').addEventListener('click', () => {
    if (currentSemanaNumero > 1) showSemana(currentSemanaNumero - 1);
  });

  document.getElementById('btn-next').addEventListener('click', () => {
    if (currentSemanaNumero < semanasData.length) showSemana(currentSemanaNumero + 1);
  });

  // Logo → siempre va al inicio
  document.getElementById('nav-logo-btn').addEventListener('click', () => {
    if (currentSemanaNumero !== null) {
      exitSemanaMode();
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  });

  // Equipo → si hay semana activa, sale primero y luego scrollea a equipo
  document.getElementById('nav-equipo-btn').addEventListener('click', () => {
    if (currentSemanaNumero !== null) {
      exitSemanaMode();
      setTimeout(() => {
        document.getElementById('equipo').scrollIntoView({ behavior: 'smooth' });
      }, 50);
    } else {
      document.getElementById('equipo').scrollIntoView({ behavior: 'smooth' });
    }
  });
}

/* ============================================================
   INIT
   ============================================================ */
document.addEventListener('DOMContentLoaded', async () => {
  const { students, semanas } = await loadData();

  studentsMap = Object.fromEntries(students.map(s => [s.id, s]));
  semanasData = semanas;

  initNav(semanas);
  renderStudents(students);
  initNavButtons();
});

/* ============================================================
   FALLBACK DATA (used when page is opened via file://)
   ============================================================ */
const FALLBACK_STUDENTS = [
  { id:1, nombre:'Ana García',    foto:'imgs/profiles/estudiante-1.svg', bio:'Estudiante apasionada por el análisis de datos y la toma de decisiones basada en evidencia. Encuentra en la estadística una herramienta clave para entender el mundo que nos rodea.' },
  { id:2, nombre:'Carlos Mendoza',foto:'imgs/profiles/estudiante-2.svg', bio:'Curioso por naturaleza, disfruta resolver problemas aplicando métodos estadísticos. Cree que detrás de cada dato hay una historia esperando ser contada.' },
  { id:3, nombre:'Lucía Torres',  foto:'imgs/profiles/estudiante-3.svg', bio:'Le apasiona la intersección entre la estadística y las ciencias sociales. Busca convertir los números en narrativas comprensibles para todos.' },
  { id:4, nombre:'Diego Ramírez', foto:'imgs/profiles/estudiante-4.svg', bio:'Orientado al detalle y al rigor metodológico. Para él, la estadística es el lenguaje preciso con el que la realidad puede ser descrita y cuestionada.' },
  { id:5, nombre:'Sofía Vargas',  foto:'imgs/profiles/estudiante-5.svg', bio:'Comprometida con aprender y compartir conocimiento. Valora el trabajo en equipo y la diversidad de perspectivas que cada compañero aporta al grupo.' },
  { id:6, nombre:'Mateo Flores',  foto:'imgs/profiles/estudiante-6.svg', bio:'Estudiante con interés en la estadística aplicada a los negocios. Usa los datos como puente entre la teoría académica y las decisiones del mundo real.' },
];

const FALLBACK_SEMANAS = [
  {
    numero:1, titulo:'Semana 1',
    descripcion:'Introducción a la estadística descriptiva. Conceptos básicos, tipos de variables y primeras medidas de resumen.',
    cuestionario:[
      { estudianteId:1, numero:1, enunciado:'Clasifique la variable de acuerdo a su naturaleza y su medición: Tiempo de vida útil de un foco con filamento nuevo.', desarrollo:'', imagenes:['imgs/semanas/semana01/cuestionario/respuesta-1.jpeg'], tabla:null, grafico:null },
      { estudianteId:2, numero:2, enunciado:'Clasifique la variable de acuerdo a su naturaleza y su medición: Calidad del servicio de atención: Excelente ( ) Bueno ( ) Regular ( ) Deficiente ( )', desarrollo:'', imagenes:['imgs/semanas/semana01/cuestionario/respuesta-2.jpeg'], tabla:null, grafico:null },
      { estudianteId:3, numero:3, enunciado:'Clasifique la variable de acuerdo a su naturaleza y su medición: Número de DNI.', desarrollo:'', imagenes:['imgs/semanas/semana01/cuestionario/respuesta-3.jpeg'], tabla:null, grafico:null },
      { estudianteId:4, numero:4, enunciado:'Clasifique la variable de acuerdo a su naturaleza y su medición: Niveles de estrés (leve, moderado, severo).', desarrollo:'', imagenes:['imgs/semanas/semana01/cuestionario/respuesta-4.jpeg'], tabla:null, grafico:null },
      { estudianteId:5, numero:5, enunciado:'Clasifique la variable de acuerdo a su naturaleza y su medición: Ingreso mensual por la venta de las acciones durante un mes.', desarrollo:'', imagenes:['imgs/semanas/semana01/cuestionario/respuesta-5.jpeg'], tabla:null, grafico:null },
    ],
    ficha:[
      { estudianteId:4, numero:1, enunciado:'Se encuestaron 30 estudiantes sobre el número de horas de estudio diarias. Construye la tabla de distribución de frecuencias.', desarrollo:'Para construir la tabla de distribución de frecuencias, primero ordeno los datos y cuento las repeticiones de cada valor. Obtenemos los siguientes resultados:', imagenes:[], tabla:{ encabezados:['Horas (Xi)','Frec. Abs. (fi)','Frec. Rel. (hi)','Frec. Abs. Acum. (Fi)','Frec. Rel. Acum. (Hi)'], filas:[['2','5','0.167','5','0.167'],['3','9','0.300','14','0.467'],['4','8','0.267','22','0.733'],['5','5','0.167','27','0.900'],['6','3','0.100','30','1.000'],['Total','30','1.000','—','—']] }, grafico:{ tipo:'bar', titulo:'Distribución de horas de estudio diarias', labels:['2 hrs','3 hrs','4 hrs','5 hrs','6 hrs'], datasets:[{ label:'Frecuencia absoluta', data:[5,9,8,5,3], backgroundColor:'rgba(201,100,66,0.75)', borderColor:'#c96442', borderWidth:1 }] } },
      { estudianteId:5, numero:2, enunciado:'Calcula e interpreta la moda, la mediana y la media aritmética.', desarrollo:'Trabajando con los 30 datos de horas de estudio:\n\n**Media aritmética (x̄):**\nx̄ = (2×5 + 3×9 + 4×8 + 5×5 + 6×3) / 30 = 112/30 ≈ 3.73 horas\n\n**Mediana (Me):** posición 15 y 16 → Me = 4 horas\n\n**Moda (Mo):** Mo = 3 horas (aparece 9 veces)\n\n**Interpretación:** En promedio los estudiantes estudian 3.73 horas diarias, el valor más común es 3 horas y el 50% estudia 4 horas o menos.', imagenes:[], tabla:null, grafico:null },
      { estudianteId:6, numero:3, enunciado:'Grafica el histograma de frecuencias relativas.', desarrollo:'Para el histograma de frecuencias relativas, utilizamos los valores calculados en la tabla de distribución. Las frecuencias relativas (hi) representan la proporción de cada valor respecto al total de observaciones.', imagenes:[], tabla:null, grafico:{ tipo:'bar', titulo:'Histograma de Frecuencias Relativas', labels:['2 hrs','3 hrs','4 hrs','5 hrs','6 hrs'], datasets:[{ label:'Frecuencia relativa (hi)', data:[0.167,0.300,0.267,0.167,0.100], backgroundColor:'rgba(93,92,88,0.75)', borderColor:'#5e5d59', borderWidth:1 }] } },
    ],
  },
  ...[2,3,4,5,6,7,8,9,10,11,12,13,14,15,16].map(n => ({ numero:n, titulo:`Semana ${n}`, descripcion:'', cuestionario:[], ficha:[] })),
];
