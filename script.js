// Импорт Firebase через CDN (специально для браузера/GitHub Pages)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, doc, setDoc, getDoc, query, orderBy, limit, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- 🔥 ТВОИ НАСТРОЙКИ С КАРТИНКИ (Я ИХ УЖЕ ВСТАВИЛ) 🔥 ---
const firebaseConfig = {
    apiKey: "AIzaSyDwb1lT9GZCF1MViq71aXr1ggtMKYNK2qE",
    authDomain: "memory-4569e.firebaseapp.com",
    projectId: "memory-4569e",
    storageBucket: "memory-4569e.firebasestorage.app",
    messagingSenderId: "405838410040",
    appId: "1:405838410040:web:6aa0b8e8c15ad4eeef91cd",
    measurementId: "G-VEG2RSWXQT"
};

// Инициализация базы данных
let db;
try {
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    console.log("Firebase успешно подключен!");
} catch (e) {
    console.error("Ошибка подключения Firebase:", e);
}

// Подключаем Телеграм
const tg = window.Telegram.WebApp;
tg.expand(); // Разворачиваем на весь экран

// --- НАСТРОЙКИ ИГРЫ ---
// Убедись, что картинки с такими именами лежат в папке img
const imageFiles = [
    'img/item1.png', 
    'img/item2.png', 
    'img/item3.png', 
    'img/item4.png',
    'img/item5.png', 
    'img/item6.png', 
    'img/item7.png', 
    'img/roman.png'
];

let cards = [];
let flippedCards = [];
let matchedPairs = 0;
let timer;
let timeElapsed = 0;
let isPlaying = false;

// Данные пользователя (если открыли не в ТГ, будет "Гость")
const user = tg.initDataUnsafe.user || { id: 'test_user_pc', first_name: 'Гость', photo_url: '' };

// --- УПРАВЛЕНИЕ ЭКРАНАМИ ---
function showScreen(screenId) {
    // Скрываем все экраны
    document.querySelectorAll('.screen').forEach(s => {
        s.classList.remove('active');
        s.classList.add('hidden');
    });
    // Показываем нужный
    const screen = document.getElementById(screenId);
    screen.classList.remove('hidden');
    screen.classList.add('active');

    // Если открыли лидерборд - загружаем данные
    if (screenId === 'leaderboard-screen') {
        loadLeaderboard();
    }
}

// --- КНОПКИ ---
document.getElementById('btn-play').addEventListener('click', () => {
    showScreen('game-screen');
    initGame();
});

document.getElementById('btn-leaders').addEventListener('click', () => {
    showScreen('leaderboard-screen');
});

document.getElementById('btn-back-menu').addEventListener('click', () => {
    clearInterval(timer);
    showScreen('menu-screen');
});

document.getElementById('btn-back-from-leaders').addEventListener('click', () => {
    showScreen('menu-screen');
});

document.getElementById('btn-menu-win').addEventListener('click', () => {
    document.getElementById('modal').classList.add('hidden');
    showScreen('menu-screen');
});

document.getElementById('btn-restart').addEventListener('click', () => {
    document.getElementById('modal').classList.add('hidden');
    initGame();
});


// --- ЛОГИКА ИГРЫ ---
function shuffle(array) {
    return array.sort(() => Math.random() - 0.5);
}

function initGame() {
    const board = document.getElementById('board');
    board.innerHTML = '';
    matchedPairs = 0;
    timeElapsed = 0;
    flippedCards = [];
    
    // Сброс текстов
    document.getElementById('time').innerText = '0с';
    document.getElementById('score').innerText = '0';
    
    // Перемешиваем и удваиваем карты
    cards = shuffle([...imageFiles, ...imageFiles]);

    // Создаем карточки на поле
    cards.forEach((imgSrc, index) => {
        const card = document.createElement('div');
        card.classList.add('card');
        card.dataset.index = index;
        card.dataset.img = imgSrc;

        // Внимание: тут прописаны классы card-front и card-back
        // card-front - это ЛИЦО (картинка)
        // card-back - это РУБАШКА
        card.innerHTML = `
            <div class="card-front"><img src="${imgSrc}"></div>
            <div class="card-back"></div>
        `;

        card.addEventListener('click', flipCard);
        board.appendChild(card);
    });

    // Запускаем таймер
    clearInterval(timer);
    timer = setInterval(() => {
        timeElapsed++;
        document.getElementById('time').innerText = `${timeElapsed}с`;
    }, 1000);
    
    isPlaying = true;
}

function flipCard() {
    if (!isPlaying) return;
    if (flippedCards.length >= 2) return; // Нельзя открыть 3 карты сразу
    if (this.classList.contains('flipped')) return; // Нельзя нажать на уже открытую

    this.classList.add('flipped');
    flippedCards.push(this);

    if (flippedCards.length === 2) {
        checkMatch();
    }
}

function checkMatch() {
    const [card1, card2] = flippedCards;

    // Сравниваем картинки
    if (card1.dataset.img === card2.dataset.img) {
        // СОВПАДЕНИЕ
        matchedPairs++;
        flippedCards = [];
        
        // Если нашли все пары
        if (matchedPairs === imageFiles.length) {
            endGame();
        }
    } else {
        // НЕ СОВПАЛИ - закрываем через 0.7 сек
        setTimeout(() => {
            card1.classList.remove('flipped');
            card2.classList.remove('flipped');
            flippedCards = [];
        }, 700);
    }
}

function endGame() {
    clearInterval(timer);
    isPlaying = false;
    
    // --- ПОДСЧЕТ ОЧКОВ ---
    // Формула: 10000 / (время + 10).
    // Пример: 40 сек -> ~200 очков.
    let score = Math.floor(10000 / (timeElapsed + 10));
    
    document.getElementById('final-time').innerText = timeElapsed;
    document.getElementById('final-score').innerText = score;
    document.getElementById('modal').classList.remove('hidden');

    saveScore(score);
}

// --- РАБОТА С БАЗОЙ ДАННЫХ (Лидерборд) ---

async function saveScore(newScore) {
    if (!db) return;
    
    const userId = user.id.toString();
    const userRef = doc(db, "leaderboard", userId);

    try {
        // Сначала проверяем старый рекорд
        const docSnap = await getDoc(userRef);
        let bestScore = 0;
        
        if (docSnap.exists()) {
            bestScore = docSnap.data().score;
        }

        // Если новый результат лучше старого -> сохраняем
        if (newScore > bestScore) {
            await setDoc(userRef, {
                username: user.first_name, // Имя из ТГ
                avatar: user.photo_url || "", // Аватарка из ТГ
                score: newScore,
                time: timeElapsed,
                date: Date.now()
            });
            console.log("Новый рекорд сохранен!");
        }
    } catch (e) { 
        console.error("Ошибка сохранения рекорда:", e); 
    }
}

async function loadLeaderboard() {
    const list = document.getElementById('leaderboard-list');
    list.innerHTML = '<li class="loading">Загрузка магии... 🔮</li>';

    if (!db) {
        list.innerHTML = '<li>Ошибка подключения к БД</li>';
        return;
    }

    try {
        // Берем топ-20 игроков по очкам
        const q = query(collection(db, "leaderboard"), orderBy("score", "desc"), limit(20));
        const querySnapshot = await getDocs(q);

        list.innerHTML = '';
        let rank = 1;

        if (querySnapshot.empty) {
            list.innerHTML = '<li style="padding:15px; text-align:center;">Пока пусто. Стань первым!</li>';
            return;
        }

        querySnapshot.forEach((doc) => {
            const data = doc.data();
            const li = document.createElement('li');
            li.classList.add('leader-item');
            
            // Раскрашиваем 1, 2, 3 места
            if (rank === 1) li.classList.add('rank-1');
            if (rank === 2) li.classList.add('rank-2');
            if (rank === 3) li.classList.add('rank-3');

            // Иконки медалей
            let rankIcon = rank + '.';
            if (rank === 1) rankIcon = '🥇';
            if (rank === 2) rankIcon = '🥈';
            if (rank === 3) rankIcon = '🥉';

            // Если аватарки нет, ставим заглушку
            const avatarSrc = data.avatar ? data.avatar : 'https://cdn-icons-png.flaticon.com/512/847/847969.png';

            li.innerHTML = `
                <div class="leader-rank">${rankIcon}</div>
                <img src="${avatarSrc}" class="leader-avatar">
                <div class="leader-name">${data.username}</div>
                <div class="leader-score">${data.score}</div>
            `;
            list.appendChild(li);
            rank++;
        });

    } catch (e) {
        console.error(e);
        list.innerHTML = '<li>Ошибка загрузки :(</li>';
    }
}
