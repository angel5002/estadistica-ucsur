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
    <div class="post-body">`;

  // Contexto (texto antes de la imagen) — usa 'contexto' si existe, si no 'enunciado'
  const contexto = item.contexto || item.enunciado || '';
  const preguntas = item.preguntas || '';
  const hasEnunciadoImages = item.imagenesEnunciado && item.imagenesEnunciado.length > 0;

  if (contexto) inner += `<div class="post-enunciado">${contexto}</div>`;

  if (hasEnunciadoImages) {
    inner += `<div class="post-images">`;
    item.imagenesEnunciado.forEach(src => {
      inner += `<img class="post-image" src="${src}" alt="Imagen del enunciado" loading="lazy" onerror="this.style.display='none'">`;
    });
    inner += `</div>`;
  }

  if (preguntas) inner += `<div class="post-enunciado post-preguntas">${preguntas}</div>`;

  inner += `<div class="post-desarrollo">${item.desarrollo}</div>`;

  // Table (before answer images)
  if (item.tabla) {
    inner += buildTable(item.tabla);
  }

  // Answer images
  if (item.imagenes && item.imagenes.length > 0) {
    inner += `<div class="post-images">`;
    item.imagenes.forEach(src => {
      inner += `<img class="post-image" src="${src}" alt="Resolución" loading="lazy" onerror="this.style.display='none'">`;
    });
    inner += `</div>`;
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
  { id:1, nombre:'Angel Vargas',   foto:'imgs/profiles/estudiante-1.svg', bio:'Estudiante apasionado por el análisis de datos y la toma de decisiones basada en evidencia. Encuentra en la estadística una herramienta clave para entender el mundo que nos rodea.' },
  { id:2, nombre:'Keyla Mendoza',  foto:'imgs/profiles/estudiante-2.svg', bio:'Curiosa por naturaleza, disfruta resolver problemas aplicando métodos estadísticos. Cree que detrás de cada dato hay una historia esperando ser contada.' },
  { id:3, nombre:'Leonardo Abanto',foto:'imgs/profiles/estudiante-3.svg', bio:'Le apasiona la intersección entre la estadística y las ciencias sociales. Busca convertir los números en narrativas comprensibles para todos.' },
  { id:4, nombre:'Laryel Negron',  foto:'imgs/profiles/estudiante-4.svg', bio:'Orientado al detalle y al rigor metodológico. Para él, la estadística es el lenguaje preciso con el que la realidad puede ser descrita y cuestionada.' },
  { id:5, nombre:'Hideki Fukuhara',foto:'imgs/profiles/estudiante-5.svg', bio:'Comprometido con aprender y compartir conocimiento. Valora el trabajo en equipo y la diversidad de perspectivas que cada compañero aporta al grupo.' },
  { id:6, nombre:'Manuel Salas',   foto:'imgs/profiles/estudiante-6.svg', bio:'Estudiante con interés en la estadística aplicada a los negocios. Usa los datos como puente entre la teoría académica y las decisiones del mundo real.' },
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
      { estudianteId:1, numero:1, enunciado:'Complete los espacios en blanco con el concepto estadístico correcto.\n\na. La _____________ es el conjunto total de elementos o individuos que poseen una característica común y que son objeto de estudio.\nb. Una _____________ es un subconjunto de la población que se selecciona para realizar el análisis.\nc. La _____________ es la rama de la estadística que se encarga de recolectar, organizar, resumir y presentar datos mediante tablas y gráficos.\nd. La _____________ utiliza datos de una muestra para hacer generalizaciones o inferencias sobre una población.\ne. El elemento individual que forma parte de la población se denomina _____________.', desarrollo:'', imagenes:['imgs/semanas/semana01/ficha/respuesta-1.jpeg'], tabla:null, grafico:null },
      { estudianteId:2, numero:2, enunciado:'Indique si cada afirmación corresponde a población, muestra o unidad de análisis.\n\na. Los 2 000 estudiantes matriculados en una universidad privada de Lima. ( )\nb. 120 estudiantes seleccionados para participar en una encuesta sobre hábitos de estudio. ( )\nc. Cada estudiante que responde el cuestionario aplicado en el estudio. ( )\nd. Todos los clientes que compran en un supermercado durante un mes. ( )\ne. 80 clientes elegidos aleatoriamente para evaluar el nivel de satisfacción. ( )', desarrollo:'', imagenes:['imgs/semanas/semana01/ficha/respuesta-2.jpeg'], tabla:null, grafico:null },
      { estudianteId:3, numero:3, enunciado:'Indique el tipo de variable usando la clasificación según su naturaleza y escala de medición:', desarrollo:'', imagenes:['imgs/semanas/semana01/ficha/respuesta-3.jpeg'], tabla:{ encabezados:['Variable','Tipo (Naturaleza)','Escala de Medición'], filas:[['Peso','',''],['Rangos de peso: 1=Menos de 40kg, 2=De 40 a 60kg, 3=Más de 60kg','',''],['Sexo biológico: 1=Femenino, 2=Masculino','',''],['Código del carnet universitario','',''],['Calificación de un examen','',''],['Calificación de un examen: 1=Insuficiente, 2=Aceptable, 3=Sobresaliente','',''],['Admisión en UCI: 1=Si, 2=No','',''],['Transfusión sanguínea: 1=Recibió transfusión, 2=No recibió transfusión','',''],['Número de operaciones','',''],['Grupo sanguíneo: 1=A, 2=B, 3=AB, 4=O','',''],['Número de faltas en un partido de fútbol','',''],['Número de libros vendidos en Amazon','',''],['Tiempo que demora el delivery','',''],['Temperatura en °C del horno','',''],['Ruido en decibelios','',''],['Puntaje de satisfacción por un servicio de: 1, 2, 3, 4, 5','',''],['Condición de mayor de edad: Si / No','',''],['Edad en años','','']] }, grafico:null },
      { estudianteId:4, numero:4, enunciado:'Ante el desarrollo de nuevas infraestructuras portuarias en la zona, un instituto de investigación socioeconómica decide evaluar cómo ha cambiado la situación laboral de los residentes del distrito de Chancay. Se realiza una entrevista presencial a 420 ciudadanos residentes en el distrito, todos mayores de edad. En la entrevista se les pregunta: estado civil, ingreso económico mensual en soles, tipo de ocupación principal (independiente, dependiente, desempleado) y el número de horas semanales dedicadas al trabajo. A partir de los datos recolectados, el instituto concluye que el ingreso promedio del total de habitantes del distrito ha aumentado en un 15% respecto al año anterior.\n\nA partir del caso, identifica:\na. Población y Muestra.\nb. Unidad de análisis.\nc. Identifica todas las variables mencionadas en el texto.', desarrollo:'', imagenes:['imgs/semanas/semana01/ficha/respuesta-4.jpeg'], tabla:null, grafico:null },
      { estudianteId:5, numero:5, enunciado:'Una consultora realiza una encuesta a una muestra aleatoria de 176 universitarios limeños que han recibido al menos una tutoría durante el ciclo 2023-2. Algunos de los resultados del estudio fueron:\n• El 47% de los estudiantes utiliza los servicios de tutoría grupales; el 22%, los servicios de tutoría individuales; y el 31%, ambos tipos de tutorías.\n• Los estudiantes realizaron un promedio de 4 tutorías grupales durante el ciclo 2023-1.\n• El 33% de los estudiantes ha calificado como "muy bueno" los servicios de tutoría individual; el 32%, como "bueno"; el 20%, como "regular"; y el resto, como "malo".\n• Los estudiantes que han contratado los servicios de tutorías individuales han pagado un promedio de 37 soles por hora.\n\nEn base a la información proporcionada, complete:\nLa población de estudio es: ___________\nLa muestra es: ___________\nLa unidad elemental es: ___________\nIdentifique una variable cuantitativa continua: ___________\nIdentifique una variable cuantitativa discreta: ___________\nIdentifique una variable cualitativa nominal: ___________\nIdentifique una variable cualitativa ordinal: ___________\nUn ejemplo de estadístico es: ___________', desarrollo:'', imagenes:['imgs/semanas/semana01/ficha/respuesta-5.jpeg'], tabla:null, grafico:null },
      { estudianteId:6, numero:6, enunciado:'Una universidad del departamento de Piura desea analizar el uso de plataformas de aprendizaje virtual entre sus estudiantes de primer ciclo. Para ello, durante el semestre académico se realizó una encuesta a 120 estudiantes seleccionados aleatoriamente de un total de 850 estudiantes matriculados en primer ciclo. Los principales resultados del estudio fueron los siguientes:\n• El 55% de los estudiantes encuestados son mujeres y el 45% hombres.\n• La edad promedio de los estudiantes es 19.8 años.\n• Los estudiantes utilizan en promedio 3.6 horas semanales las plataformas virtuales.\n• El nivel de satisfacción con la plataforma virtual fue calificado como: 40% Muy satisfecho, 35% Satisfecho, 15% Regular y 10% Insatisfecho.\n• El número promedio de cursos virtuales matriculados es 4 cursos por semestre.\n\na. Identifique los elementos del estudio:\nPoblación: ___________\nMuestra: ___________\nUnidad elemental: ___________\n\nb. Clasifique las variables del estudio:', desarrollo:'', imagenes:['imgs/semanas/semana01/ficha/respuesta-6.jpeg'], tabla:{ encabezados:['Variable','Según naturaleza','Escala de medición'], filas:[['','',''],['','',''],['','',''],['','',''],['','','']] }, grafico:null },
      { estudianteId:1, numero:7, enunciado:'Una empresa de alimentos está realizando un estudio de mercado sobre las preferencias de consumo de cereales entre adultos jóvenes en el distrito de Lurín. Se encuestaron a 900 personas de 18 a 30 años, obteniendo los siguientes resultados:\n• El 60% prefiere cereales sin azúcar añadida, el 30% prefiere los cereales con poca azúcar y el 10% los prefieren muy dulces.\n• El 20% de los consumidores compra cereales integrales, el 50% compran cereales comunes y el 30% cereales con sabor a chocolate.\n• La edad promedio de los consumidores es de 27 años.\n• El 40% de los consumidores compra cereales en supermercados, el 30% en tiendas de conveniencia y el resto en mercados locales.\n• El 20% de los consumidores son solteros y el resto son casados.\n\na. Identifique los elementos del estudio:\nPoblación: ___________\nMuestra: ___________\nUnidad elemental: ___________\n\nb. Clasifique las variables del estudio:', desarrollo:'', imagenes:['imgs/semanas/semana01/ficha/respuesta-7.jpeg'], tabla:{ encabezados:['Variable','Según naturaleza','Escala de medición'], filas:[['','',''],['','',''],['','',''],['','',''],['','','']] }, grafico:null },
    ],
  },
  {
    numero:2, titulo:'Semana 2',
    descripcion:'Distribución de frecuencias, tablas estadísticas y análisis de datos agrupados e intervalos.',
    cuestionario:[
      { estudianteId:1, numero:1, contexto:'Se ha observado la variable X = "Saldo (en Euros)" de 400 cuentas corrientes de clientes con edades comprendidas entre 18 y 25 años. El siguiente gráfico recoge la distribución de porcentajes acumulados de esta variable.', imagenesEnunciado:['imgs/semanas/semana02/enunciados/enunciado-1.jpeg'], preguntas:'Indique el número de cuentas con un saldo de:\na) Menor de 110 Euros.\nb) Mínimo 90 Euros.', desarrollo:'', imagenes:['imgs/semanas/semana02/cuestionario/respuesta-1.jpeg'], tabla:null, grafico:null },
      { estudianteId:2, numero:2, contexto:'La empresa de investigación de mercados Alpha Datum S. A. realizó un estudio para evaluar la caída de la Bolsa de Valores de Lima (BVL) en las Administradoras de Fondos de Pensiones (AFP). En este estudio, se tomó una muestra de 50 afiliados de entre 25 y 35 años seleccionados al azar en Lima y se registraron los datos referentes a sus ingresos mensuales (en cientos de soles).', imagenesEnunciado:['imgs/semanas/semana02/enunciados/enunciado-2.jpeg'], preguntas:'¿Qué porcentaje de los afiliados tienen ingresos entre 151 mil y 349 mil soles?', desarrollo:'', imagenes:['imgs/semanas/semana02/cuestionario/respuesta-2.jpeg'], tabla:null, grafico:null },
      { estudianteId:3, numero:3, contexto:'Los ingresos mensuales (en miles de dólares) que lograron 40 empresas de la ciudad de Lima se resumen en la siguiente tabla de frecuencias con 6 intervalos de amplitud constante:', imagenesEnunciado:['imgs/semanas/semana02/enunciados/enunciado-3.jpeg'], preguntas:'¿Qué porcentaje de empresas tuvieron ingresos de por lo menos 40 000 dólares?', desarrollo:'', imagenes:['imgs/semanas/semana02/cuestionario/respuesta-3.jpeg'], tabla:null, grafico:null },
      { estudianteId:4, numero:4, contexto:'El número de operaciones bancarias virtuales que realizan 50 clientes de un banco durante una semana viene dado por la siguiente serie:', imagenesEnunciado:['imgs/semanas/semana02/enunciados/enunciado-4.jpeg'], preguntas:'¿Cuántos clientes realizan máximo 3 operaciones?\n¿Qué porcentaje de los clientes realizan menos de 3 operaciones?', desarrollo:'', imagenes:['imgs/semanas/semana02/cuestionario/respuesta-4.jpeg'], tabla:null, grafico:null },
      { estudianteId:5, numero:5, contexto:'La empresa de investigación de mercados Alpha Datum S. A. realizó un estudio para evaluar la caída de la Bolsa de Valores de Lima (BVL) en las Administradoras de Fondos de Pensiones (AFP). En este estudio, se tomó una muestra de 50 afiliados de entre 25 y 35 años seleccionados al azar en Lima y se registraron los datos referentes a sus ingresos mensuales (en cientos de soles).', imagenesEnunciado:['imgs/semanas/semana02/enunciados/enunciado-5.jpeg'], preguntas:'¿Calcule la amplitud y la cantidad de intervalos?', desarrollo:'', imagenes:['imgs/semanas/semana02/cuestionario/respuesta-5.jpeg'], tabla:null, grafico:null },
    ],
    ficha:[
      { estudianteId:1, numero:1, enunciado:'Se realizó un estudio a 40 personas que visitan frecuentemente el centro histórico de Lima para conocer su estado civil. Los resultados obtenidos fueron los siguientes (C=Casado, S=Soltero, V=Viudo, D=Divorciado):\n\na. ¿Qué tipo de variable es el estado civil?\nb. Construye la tabla de distribución de frecuencias absolutas, relativas y porcentuales.\nc. Elabora un gráfico circular (o de sectores) para presentar estos datos.\nd. ¿Cuál es la categoría con mayor frecuencia?\ne. ¿Cuántas personas se encuentran casadas?\nf. ¿Qué porcentaje de personas son viudas?\ng. ¿Qué porcentaje de las personas encuestadas no están solteras?', desarrollo:'', imagenes:['imgs/semanas/semana02/ficha/respuesta-1.jpeg'], tabla:{ encabezados:['','','','','','','','','',''], filas:[['S','S','C','D','S','V','C','S','S','S'],['D','C','S','V','S','C','D','S','S','C'],['C','S','V','D','S','S','S','C','S','S'],['D','C','D','D','V','C','S','D','C','S']] }, grafico:null },
      { estudianteId:2, numero:2, enunciado:'A continuación, se muestra el registro del número de cursos que llevan los estudiantes que trabajan durante el ciclo 2023-2:\n\na. Construya la tabla de distribución de frecuencias adecuada y coloque el título apropiado.\nb. Realice la siguiente interpretación F₂ y h₃%.\nc. Dibuje el gráfico más adecuado para esta variable (gráfico de bastones o barras).\nd. ¿Qué porcentaje de estudiantes que trabajan llevan cuatro cursos durante el ciclo 2023-2?\ne. ¿Cuántos estudiantes que trabajan llevan como mínimo seis cursos durante el ciclo 2023-2?\nf. ¿Cuántos estudiantes que trabajan llevan a lo más cinco cursos durante el ciclo 2023-2?', desarrollo:'', imagenes:['imgs/semanas/semana02/ficha/respuesta-2.jpeg'], tabla:{ encabezados:['','','','','','','','','',''], filas:[['3','3','3','4','4','4','4','5','5','5'],['5','5','5','5','6','6','6','7','7','7']] }, grafico:null },
      { estudianteId:3, numero:3, enunciado:'Complete la siguiente distribución de frecuencias:', desarrollo:'', imagenes:['imgs/semanas/semana02/ficha/respuesta-3.jpeg'], tabla:{ encabezados:['Categoría','Marca de clase','fᵢ','hᵢ%','Fᵢ','Hᵢ%'], filas:[['[135 — [','','','10%','',''],['[ — [','12','','','',''],['[155 — [','','','','42',''],['[ — ]','','','','',''],['Total','—','60','','','']] }, grafico:null },
      { estudianteId:4, numero:4, enunciado:'Los siguientes datos son las remuneraciones mensuales de 40 operadores de call center que incluye su sueldo básico y sus comisiones:\n\na. Construya la distribución de frecuencias agrupando los datos.\nb. Interpretar f₂, F₃, h₂%, H₂%.', desarrollo:'', imagenes:['imgs/semanas/semana02/ficha/respuesta-4.jpeg'], tabla:{ encabezados:['','','','','','','','','',''], filas:[['1650','1820','1890','1960','1995','2030','2030','2030','2065','2100'],['2135','2275','2310','2345','2345','2345','2345','2345','2380','2415'],['2415','2450','2450','2450','2520','2555','2555','2660','2660','2695'],['2695','2695','2765','2800','2870','2975','3010','3080','3255','3290']] }, grafico:null },
      { estudianteId:5, numero:5, enunciado:'En un proceso de selección laboral se registra el tiempo que demoran en realizar un examen de aptitud a un grupo de 20 postulantes. A continuación, se muestran los datos en horas:\n\nSe solicita:\na. Identificar la unidad de análisis y la variable de estudio.\nb. Construir una distribución de frecuencia utilizando la regla de Sturges para determinar el número de intervalos y coloque el título apropiado.\nc. Interpretar f₃, H₂%.\nd. ¿Qué porcentaje de postulantes demoraron en realizar el examen de aptitud de por lo menos 1,37 horas?\ne. ¿Cuántos postulantes demoraron en realizar el examen de aptitud menos de 1,46 horas?', desarrollo:'', imagenes:['imgs/semanas/semana02/ficha/respuesta-5.jpeg'], tabla:{ encabezados:['','','','','','','','','',''], filas:[['1,2','1,15','1,3','1,3','1,2','1,5','1,45','1,43','1,25','1,1'],['1,48','1,3','1,15','1,15','1,25','1,32','1,35','1,4','1,35','1,52']] }, grafico:null },
      { estudianteId:6, numero:6, enunciado:'En el centro de salud mental comunitario ubicado en la zona de Bayóvar, se está ejecutando el Proyecto "Bienestar Emocional", cuyo objetivo es evaluar los niveles de ansiedad autoevaluada en una muestra de 20 adolescentes, utilizando una escala estandarizada que va de 0 a 30. Los puntajes obtenidos son los siguientes:\n\nSe solicita:\na. Organiza los datos en una tabla de frecuencias utilizando la regla de Sturges.\nb. Interpreta las siguientes frecuencias: F₂ y H₃%.\nc. Si se considera un puntaje mínimo de 13 como indicador de ansiedad significativa, ¿qué porcentaje de adolescentes presenta esta condición?\nd. Si se desea identificar al 25% de los adolescentes con los niveles de ansiedad más bajos para un estudio de factores protectores, ¿hasta qué puntaje se incluirían en este grupo?\ne. Si se define un rango de ansiedad "leve" con un puntaje mínimo de 7 pero menos de 17, ¿qué porcentaje de adolescentes se encuentra en este rango?', desarrollo:'', imagenes:['imgs/semanas/semana02/ficha/respuesta-6.jpeg'], tabla:{ encabezados:['','','','','','','','','',''], filas:[['7','8','8','8','11','12','13','14','15','16'],['17','18','20','21','22','23','25','26','29','29']] }, grafico:null },
      { estudianteId:1, numero:7, enunciado:'Utilizando el SPSS:\na. Elaborar una tabla de frecuencias y su gráfico respectivo de los datos de las preguntas 1 y 2.\nb. Elaborar una tabla de frecuencias con intervalos y su gráfico respectivo de los datos de las preguntas 4, 5 y 6.', desarrollo:'', imagenes:['imgs/semanas/semana02/ficha/respuesta-7.jpeg'], tabla:null, grafico:null },
    ],
  },
  ...[3,4,5,6,7,8,9,10,11,12,13,14,15,16].map(n => ({ numero:n, titulo:`Semana ${n}`, descripcion:'', cuestionario:[], ficha:[] })),
];
