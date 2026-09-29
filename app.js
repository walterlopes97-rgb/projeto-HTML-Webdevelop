/**
 * PROJETO ACADÊMICO: Previsão do Tempo Dinâmica (Recife - PE)
 * Fonte de Dados: API Pública Governamental do INMET (Instituto Nacional de Meteorologia)
 * Estação: A301 (Recife - PE)
 */

// URL da API Governamental do INMET para a Estação Automática de Recife
const API_URL = "https://api.inmet.gov.br/estacao/dados/A301";

// Estado da aplicação
/**entender isso
let forecastData = [];
let currentSelectedDayIndex = 0; // 0 = Dom, 1 = Seg, ..., 6 = Sáb
*/

// Mapeamento de elementos do DOM
const mainHeader = document.getElementById('main-header');
const headerCity = document.getElementById('header-city');
const headerTime = document.getElementById('header-time');
const headerCondition = document.getElementById('header-condition');
const headerTemp = document.getElementById('header-temp');
const timeControl = document.getElementById('time-control');
const celestialBody = document.getElementById('celestial-body');
const cardsContainer = document.getElementById('cards-container');

fetch('https://ipapi.co/json/')
    .then(response => response.json())
    .then(data => { 
        if (headerCity) headerCity.textContent = `${data.city}, ${data.region_code}`;
    })



 //PONTO 1: Comunicação com a API Governamental (INMET)
async function fetchWeatherData() {
    console.log("[LOG API INMET] Conectando à API do Governo Federal (Estação Recife A301)...");
    
    try {
        const response = await fetch(API_URL);
        console.log(`[LOG API INMET] Resposta recebida. Status HTTP: ${response.status}`);

        // Tratamento de Erro 500 ou falha de servidor governamental
        if (response.status >= 500) {
            console.error("[LOG API Error] Erro 500: Servidor do INMET instável ou indisponível.");
            alert("Serviço indisponível");
            throw new Error("Serviço indisponível");
        }

        if (!response.ok) {
            throw new Error(`Erro na requisição: ${response.statusText}`);
        }

        const data = await response.json();
        console.log("[LOG API INMET] Dados meteorológicos de Recife recebidos com sucesso:", data);

        if (!Array.isArray(data) || data.length === 0) {
            throw new Error("Formato de dados inválido retornado pelo INMET.");
        }

        forecastData = data;

        // Renderiza os cards e atualiza o Header
        renderWeeklyCards();
        updateHeaderWeather();

    } catch (error) {
        console.error("[LOG API Error] Falha na comunicação com a API:", error.message);
        if (headerCondition) headerCondition.textContent = "Erro ao carregar dados do INMET";
    }
}

/**
 * PONTO 2: Mapeamento de Radiação e Umidade para Clima Visual
 * O INMET fornece Radiação Global (RAD_GLO) e Umidade (UMD_INS)
 */
function deriveWeatherCondition(radGlo, umidade, isDaytime) {
    const rad = parseFloat(radGlo) || 0;
    const umd = parseFloat(umidade) || 50;

    if (!isDaytime) {
        if (umd > 85) {
            return { condition: "Tempestade (Noite)", classSuffix: "tempestade-noite", iconClass: "icon-storm" };
        } else if (umd > 75) {
            return { condition: "Tempo Chuvoso", classSuffix: "chuvoso-noite", iconClass: "icon-rain" };
        } else if (umd > 65) {
            return { condition: "Nublado", classSuffix: "nublado", iconClass: "icon-cloud" };
        }
        return { condition: "Noite Limpa", classSuffix: "noite", iconClass: "icon-moon" };
    } else {
        if (umd > 85) {
            return { condition: "Tempestade (Dia)", classSuffix: "tempestade-dia", iconClass: "icon-storm" };
        } else if (umd > 75) {
            return { condition: "Chuvoso em Recife", classSuffix: "chuvoso-dia", iconClass: "icon-rain" };
        } else if (rad < 800) {
            return { condition: "Parcialmente Nublado", classSuffix: "nublado", iconClass: "icon-cloud" };
        }
        return { condition: "Ensolarado", classSuffix: "dia", iconClass: "icon-sun" };
    }
}

/**
 * PONTO 3: Atualização Dinâmica do Header conforme o Slider Sol/Lua
 */
function updateHeaderWeather() {
    if (!forecastData || forecastData.length === 0) return;

    // Converte os minutos do slider em hora (00:00 até 23:59)
    const totalMinutes = parseInt(timeControl.value, 10);
    const hour = Math.floor(totalMinutes / 60);
    const minute = totalMinutes % 60;

    const formattedTime = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    headerTime.textContent = `Horário: ${formattedTime}`;

    // Determina se é dia (06:00 às 17:59) ou noite
    const isDaytime = hour >= 6 && hour < 18;
    celestialBody.className = isDaytime ? "sun-icon" : "moon-icon";

    // Procura na medição do INMET o registro correspondente à hora selecionada
    const targetHourStr = String(hour).padStart(2, '0') + "00";
    const hourReading = forecastData.find(item => item.HR_MEDICAO === targetHourStr) || forecastData[0];

    const temp = hourReading.TEM_INS ? Math.round(parseFloat(hourReading.TEM_INS)) : 27;
    const weatherInfo = deriveWeatherCondition(hourReading.RAD_GLO, hourReading.UMD_INS, isDaytime);

    // Atualiza a interface
    headerTemp.textContent = `${temp}°C`;
    headerCondition.textContent = weatherInfo.condition;
    mainHeader.className = `header-thumb-${weatherInfo.classSuffix}`;

    console.log(`[LOG APP] Recife [INMET] - Horário: ${formattedTime} | Temp: ${temp}°C | Condição: ${weatherInfo.condition}`);
}

/**
 * PONTO 4: Renderização dos Cards Semanais
 */
function renderWeeklyCards() {
    const dayNames = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
    cardsContainer.innerHTML = "";

    // Pega como referência a medição do meio-dia (12:00) do INMET
    const noonReading = forecastData.find(item => item.HR_MEDICAO === "1200") || forecastData[0];
    const baseTemp = noonReading.TEM_INS ? Math.round(parseFloat(noonReading.TEM_INS)) : 28;

    for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
        // Simulação de variações diárias em cima da estação oficial de Recife
        const tempVariation = (dayIndex % 3) - 1; 
        const dayTemp = baseTemp + tempVariation;
        const weatherInfo = deriveWeatherCondition(noonReading.RAD_GLO, noonReading.UMD_INS, true);

        const card = document.createElement('article');
        card.className = `weather-card ${dayIndex === currentSelectedDayIndex ? 'active' : ''}`;
        card.setAttribute('data-day', dayIndex);
        card.setAttribute('tabindex', '0');

        card.innerHTML = `
            <h3 class="day-name">${dayNames[dayIndex]}</h3>
            <div class="weather-icon ${weatherInfo.iconClass}"></div>
            <span class="card-temp">${dayTemp}°C</span>
            <p class="card-condition">${weatherInfo.condition}</p>
        `;

        card.addEventListener('click', () => selectDay(dayIndex));
        cardsContainer.appendChild(card);
    }
}

/**
 * PONTO 5: Seleção de Card da Semana
 */
function selectDay(dayIndex) {
    console.log(`[LOG APP] Card do dia ${dayIndex} selecionado. Resetando relógio para 00:00.`);
    currentSelectedDayIndex = dayIndex;

    // Reseta o slider para 00:00
    timeControl.value = 0;

    // Atualiza o card ativo na interface
    const allCards = document.querySelectorAll('.weather-card');
    allCards.forEach((card, idx) => {
        card.classList.toggle('active', idx === dayIndex);
    });

    updateHeaderWeather();
}

// Escuta a movimentação do slider Sol/Lua
timeControl.addEventListener('input', updateHeaderWeather);

// Inicializa a aplicação buscando os dados do INMET
fetchWeatherData();