// URL da API Open-Meteo
const API_URL = "https://api.open-meteo.com/v1/forecast";

// Estado da aplicação
let forecastData = null;
let currentSelectedDayIndex = 0; // 0 = Dom, 1 = Seg, ..., 6 = Sáb

// Mapeamento de elementos do DOM
const mainHeader = document.getElementById('main-header');
const headerCity = document.getElementById('header-city');
const headerTime = document.getElementById('header-time');
const headerCondition = document.getElementById('header-condition');
const headerTemp = document.getElementById('header-temp');
const timeControl = document.getElementById('time-control');
const celestialBody = document.getElementById('celestial-body');
const cardsContainer = document.getElementById('cards-container');
const calendarMonth = document.getElementById('calendar-date');

let latitude;
let longitude;
let city;
let region;


// ============================================================
// Buscador de região por IP com Fallback
// ============================================================

async function getLocationByIP() {
    try {
        const response = await fetch('https://ipapi.co/json/');

        if (!response.ok) {
            throw new Error(`Erro ao obter localização: ${response.status}`);
        }

        const data = await response.json();

        city = data.city;
        region = data.region_code;
        latitude = data.latitude;
        longitude = data.longitude;
        

        headerCity.textContent = `${city}, ${region}`;

        console.log(`[LOG LOCALIZAÇÃO] Localização detectada: ${city}-${region}`);
        console.log(`[LOG LOCALIZAÇÃO] Coordenadas: ${latitude}, ${longitude}`);

    } catch (error) {
        console.warn("[LOG LOCALIZAÇÃO] Falha ao obter localização por IP.", error);
    }
}


// ============================================================
// Comunicação com a API Open-Meteo
// ============================================================

async function fetchWeatherData() {

    console.log(
        `[LOG API Open-Meteo] Conectando à API para ${city}-${region}...`
    );

    const requestUrl =
        `${API_URL}?` +
        `latitude=${latitude}` +
        `&longitude=${longitude}` +
        `&hourly=temperature_2m,relative_humidity_2m,shortwave_radiation` +
        `&timezone=America%2FSao_Paulo`;

    console.log(
        `[LOG API Open-Meteo] URL: ${requestUrl}`
    );

    try {
        const response = await fetch(requestUrl);

        console.log(
            `[LOG API Open-Meteo] Resposta recebida. Status HTTP: ${response.status}`
        );

        // Tratamento de erro 500
        if (response.status >= 500) {
            console.error(
                "[LOG API Error] Servidor da Open-Meteo indisponível."
            );
            alert("Serviço indisponível");
            throw new Error(
                "Serviço indisponível"
            );
        }

        // Outros erros HTTP
        if (!response.ok) {
            throw new Error(
                `Erro na requisição: ${response.statusText}`
            );
        }

        // Converte a resposta para JSON
        const data = await response.json();

        console.log(
            "[LOG API Open-Meteo] Dados meteorológicos recebidos:",
            data
        );

        if (
            !data ||
            !data.hourly ||
            !Array.isArray(data.hourly.time)
        ) {
            throw new Error(
                "Formato de dados inválido retornado pela Open-Meteo."
            );
        }

        forecastData = data;

        console.log(
            "[LOG API Open-Meteo] Dados carregados com sucesso."
        );

        // Renderiza os cards da semana
        renderWeeklyCards();

        // Atualiza o Header
        updateHeaderWeather();

    } catch (error) {
        console.error(
            "[LOG API Error] Falha na comunicação com a API:",
            error.message
        );

        if (headerCondition) {
            headerCondition.textContent =
                "Erro ao carregar dados da Open-Meteo";
        }
    }
}


// ============================================================
// Mapeamento de Radiação e Umidade para Clima Visual
// ============================================================

function deriveWeatherCondition(radGlo, umidade, isDaytime) {

    const rad = parseFloat(radGlo) || 0;
    const umd = parseFloat(umidade) || 50;

    if (!isDaytime) {

        if (umd > 85) {
            return {
                condition: "Tempestade (Noite)",
                classSuffix: "tempestade-noite",
                iconClass: "icon-storm"
            };
        } else if (umd > 75) {
            return {
                condition: "Tempo Chuvoso",
                classSuffix: "chuvoso-noite",
                iconClass: "icon-rain"
            };
        } else if (umd > 65) {
            return {
                condition: "Nublado",
                classSuffix: "nublado",
                iconClass: "icon-cloud"
            };
        }

        return {
            condition: "Noite Limpa",
            classSuffix: "noite",
            iconClass: "icon-moon"
        };

    } else {

        if (umd > 85) {
            return {
                condition: "Tempestade (Dia)",
                classSuffix: "tempestade-dia",
                iconClass: "icon-storm"
            };
        } else if (umd > 75) {
            return {
                condition: "Chuvoso em Recife",
                classSuffix: "chuvoso-dia",
                iconClass: "icon-rain"
            };
        } else if (rad < 800) {
            return {
                condition: "Parcialmente Nublado",
                classSuffix: "nublado",
                iconClass: "icon-cloud"
            };
        }

        return {
            condition: "Ensolarado",
            classSuffix: "dia",
            iconClass: "icon-sun"
        };
    }
}


// ============================================================
// FUNÇÕES AUXILIARES DE DATA E HORÁRIO
// ============================================================

/**
 * Retorna a data no formato dd/mm/aaaa para um determinado índice de dia.
 * @param {number} dayIndex - Índice do dia (0 a 6)
 * @returns {string} Data formatada como "DD/MM/AAAA"
 */
function getFormattedDate(dayIndex) {
    // 1. Tenta obter a data vinda da API Open-Meteo (ex: "2026-10-03T00:00")
    const apiTime = forecastData?.hourly?.time?.[dayIndex * 24];

    if (apiTime) {
        const dateOnly = apiTime.split("T")[0]; // "YYYY-MM-DD"
        const [year, month, day] = dateOnly.split("-");
        return `${day}/${month}/${year}`;
    }

    // 2. Fallback: usa a data atual do sistema + incremento de dias
    const today = new Date();
    today.setDate(today.getDate() + dayIndex);

    const day = String(today.getDate()).padStart(2, '0');
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const year = today.getFullYear();

    return `${day}/${month}/${year}`;
}

/**
 * Obtém o índice horário da API para o dia e hora solicitados
 */
function getHourlyIndex(dayIndex, hour) {

    if (
        !forecastData ||
        !forecastData.hourly ||
        !forecastData.hourly.time
    ) {
        return -1;
    }

    const targetDate =
        forecastData.hourly.time[
            dayIndex * 24
        ]?.split("T")[0];

    if (!targetDate) {
        return -1;
    }

    const targetHour =
        `${targetDate}T${String(hour).padStart(2, '0')}:00`;

    return forecastData.hourly.time.indexOf(targetHour);
}


// ============================================================
// Atualização Dinâmica do Header conforme o Slider
// ============================================================

function updateHeaderWeather() {

    // Converte os minutos do slider em hora (00:00 até 23:59)
    const totalMinutes = parseInt(timeControl.value, 10);
    const hour = Math.floor(totalMinutes / 60);
    const minute = totalMinutes % 60;

    const formattedTime =
        `${String(hour).padStart(2, '0')}:` +
        `${String(minute).padStart(2, '0')}`;

    headerTime.textContent = `Horário: ${formattedTime}`;


    // Determina se é dia (entre 06:00 e 17:59)
    const isDaytime = hour >= 6 && hour < 18;

    celestialBody.className = isDaytime ? "moon-icon" : "sun-icon";

    // Localiza a medição correspondente
    const hourlyIndex = getHourlyIndex(currentSelectedDayIndex, hour);
    const index = hourlyIndex >= 0 ? hourlyIndex : 0;

    // Dados da Open-Meteo
    const tempValue = forecastData.hourly.temperature_2m[index];
    const humidityValue = forecastData.hourly.relative_humidity_2m[index];
    const radiationValue = forecastData.hourly.shortwave_radiation[index];

    // Temperatura
    const temp =
        tempValue !== null && tempValue !== undefined
            ? Math.round(parseFloat(tempValue))
            : 27;

    // Condição climática
    const weatherInfo = deriveWeatherCondition(
        radiationValue,
        humidityValue,
        isDaytime
    );

    // Atualiza interface
    headerTemp.textContent = `${temp}°C`;
    headerCondition.textContent = weatherInfo.condition;
    mainHeader.className = `header-thumb-${weatherInfo.classSuffix}`;

    console.log(
        `[LOG APP] ${city} [Open-Meteo] - ` +
        `Horário: ${formattedTime} | ` +
        `Temp: ${temp}°C | ` +
        `Umidade: ${humidityValue}% | ` +
        `Radiação: ${radiationValue} W/m² | ` +
        `Condição: ${weatherInfo.condition}`
    );
}


// ============================================================
// Renderização dos Cards da Semana
// ============================================================

function renderWeeklyCards() {

    const dayNames = [
        "Dom",
        "Seg",
        "Ter",
        "Qua",
        "Qui",
        "Sex",
        "Sáb"
    ];

    cardsContainer.innerHTML = "";

    for (let dayIndex = 0; dayIndex < 7; dayIndex++) {

        // Data formatada em DD/MM/AAAA para o card
        const dayNumber = getFormattedDate(dayIndex);

        // Identifica o dia da semana correto baseado na data real
        const dateParts = dayNumber.split('/');
        const realDate = new Date(dateParts[2], dateParts[1] - 1, dateParts[0]);
        const dayName = dayNames[realDate.getDay()];

        // Índice correspondente ao meio-dia (12h) para o dia atual do loop
        const noonIndex = (dayIndex * 24) + 12;

        const baseTemp = forecastData?.hourly?.temperature_2m?.[noonIndex] !== undefined
            ? Math.round(parseFloat(forecastData.hourly.temperature_2m[noonIndex]))
            : 28;

        const noonRadiation = forecastData?.hourly?.shortwave_radiation?.[noonIndex] || 0;
        const noonHumidity = forecastData?.hourly?.relative_humidity_2m?.[noonIndex] || 50;

        // Variação diária simulated/derivada
        const tempVariation = (dayIndex % 3) - 1;
        const dayTemp = baseTemp + tempVariation;

        const weatherInfo = deriveWeatherCondition(
            noonRadiation,
            noonHumidity,
            true
        );

        // Criação do elemento DOM do card
        const card = document.createElement('article');

        card.className = `weather-card ${dayIndex === currentSelectedDayIndex ? 'active' : ''
            }`;

        card.setAttribute('data-day', dayIndex);
        card.setAttribute('tabindex', '0');

        card.innerHTML = `
            <h3 class="day-name">
                ${dayName}
            </h3>

            <p class="data-day-number">
                ${dayNumber}
            </p>

            <div class="weather-icon ${weatherInfo.iconClass}">
            </div>

            <span class="card-temp">
                ${dayTemp}°C
            </span>

            <p class="card-condition">
                ${weatherInfo.condition}
            </p>
        `;

        card.addEventListener(
            'click',
            () => selectDay(dayIndex)
        );

        cardsContainer.appendChild(card);
    }
}


// ============================================================
// Seleção de Card da Semana
// ============================================================

function selectDay(dayIndex) {

    console.log(
        `[LOG APP] Card do dia ${dayIndex} selecionado. Resetando relógio para 00:00.`
    );

    currentSelectedDayIndex = dayIndex;

    // Reseta slider para 00:00
    timeControl.value = 0;

    // Atualiza classe ativa nos cards
    const allCards = document.querySelectorAll('.weather-card');

    allCards.forEach((card, idx) => {
        card.classList.toggle('active', idx === dayIndex);
    });

    updateHeaderWeather();
}


// ============================================================
// Input de calendário para seleção de data
// ============================================================

function setCalendarDateTime() {

    const hoje = new Date();
    const ano = hoje.getFullYear();
    const mes = String(hoje.getMonth() + 1).padStart(2, '0');
    const dia = String(hoje.getDate()).padStart(2, '0');
    const horas = hoje.getHours();
    const minutos = hoje.getMinutes();
    const totalMinutosAtuais = (horas * 60) + minutos;
    timeControl.value = totalMinutosAtuais;
    calendarMonth.value = `${ano}-${mes}-${dia}`;
}

// Função exclusiva para mudar a cor do botão/thumb
function updateThumbColor() {
    const totalMinutes = parseInt(timeControl.value, 10);
    const hour = Math.floor(totalMinutes / 60);
    const isDaytime = hour >= 6 && hour < 18;

    if (isDaytime) {
        timeControl.style.setProperty('--thumb-bg', '#ffd700');
        timeControl.style.setProperty('--thumb-glow', 'rgba(255, 215, 0, 0.8)');
    } else {
        timeControl.style.setProperty('--thumb-bg', '#ffffff');
        timeControl.style.setProperty('--thumb-glow', 'rgba(74, 144, 226, 0.8)');
    }
}

// ============================================================
// ESCUTA EVENTOS DO SLIDER
// ============================================================
timeControl.addEventListener('input', () => {
    updateHeaderWeather();
    updateThumbColor();
});


// ============================================================
// INICIALIZAÇÃO DA APLICAÇÃO
// ============================================================

async function initializeApp() {

    setCalendarDateTime();
    await getLocationByIP();

    if (
        latitude === undefined ||
        longitude === undefined ||
        latitude === null ||
        longitude === null
    ) {
        console.error(
            "[LOG APP] Não foi possível obter as coordenadas."
        );
        return;
    }

    await fetchWeatherData();
}


// Inicializa a aplicação
initializeApp();