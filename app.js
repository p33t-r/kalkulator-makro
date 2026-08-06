// ==========================================
// 1. POMOCNICZE FUNKCJE DATY
// ==========================================

// Zwraca dzisiejszą datę w formacie YYYY-MM-DD
function getTodayDateString() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// ==========================================
// 2. LOGIKA CZYSZCZENIA DANYCH W NOWYM DNIU
// ==========================================

function checkAndResetDailyData() {
  const today = getTodayDateString();
  const lastActiveDate = localStorage.getItem('lastActiveDate');

  // Jeśli brak zapisanej daty LUB zapisana data jest inna niż dzisiejsza
  if (lastActiveDate !== today) {
    clearAllData();
    localStorage.setItem('lastActiveDate', today);
  } else {
    // Jeśli to ten sam dzień, odtwórz wcześniej zapisane dane
    loadSavedData();
  }
}

// Zresetowanie formularza i pamięci localStorage
function clearAllData() {
  // Czyszczenie pól tekstowych/formularzy
  document.getElementById('dailyForm').reset();

  // Czyszczenie wyświetlanych wyników
  document.querySelectorAll('.calculated-result').forEach(el => el.textContent = '-');
  document.getElementById('lastSavedTime').textContent = 'Brak danych z dzisiaj';

  // Usunięcie wpisów z localStorage (z wyjątkiem daty)
  localStorage.removeItem('appData');
}

// ==========================================
// 3. ZAPIS I ODTWARZANIE DANYCH
// ==========================================

function saveData() {
  const valA = parseFloat(document.getElementById('inputA').value) || 0;
  const valB = parseFloat(document.getElementById('inputB').value) || 0;

  const sum = valA + valB;
  const product = valA * valB;
  const timestamp = new Date().toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });

  const dataToSave = {
    inputA: document.getElementById('inputA').value,
    inputB: document.getElementById('inputB').value,
    sum: sum,
    product: product,
    savedAt: timestamp
  };

  // Zapis do localStorage
  localStorage.setItem('appData', JSON.stringify(dataToSave));
  localStorage.setItem('lastActiveDate', getTodayDateString());

  // Aktualizacja widoku
  renderResults(dataToSave);
}

function loadSavedData() {
  const saved = localStorage.getItem('appData');
  if (!saved) return;

  const data = JSON.parse(saved);

  // Wypełnij formularz
  document.getElementById('inputA').value = data.inputA || '';
  document.getElementById('inputB').value = data.inputB || '';

  // Wypełnij wyniki
  renderResults(data);
}

function renderResults(data) {
  document.getElementById('resultSum').textContent = data.sum !== undefined ? data.sum : '-';
  document.getElementById('resultProduct').textContent = data.product !== undefined ? data.product : '-';
  document.getElementById('lastSavedTime').textContent = data.savedAt || '-';
}

// ==========================================
// 4. INICJALIZACJA I OBSŁUGA ZDARZEŃ
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
  // Sprawdź datę i dane przy pierwszym załadowaniu
  checkAndResetDailyData();

  // Reakcja na przyciski
  document.getElementById('calcBtn').addEventListener('click', saveData);
  document.getElementById('resetBtn').addEventListener('click', () => {
    clearAllData();
    localStorage.setItem('lastActiveDate', getTodayDateString());
  });

  // Reakcja na ponowne wejście w kartę przeglądarki (np. po nocy)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      checkAndResetDailyData();
    }
  });
});